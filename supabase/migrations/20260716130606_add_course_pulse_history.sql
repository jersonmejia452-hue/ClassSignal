-- Return a bounded, aggregate-only history for one professor-owned course.
-- The browser never downloads questions or anonymous identifiers to build the
-- trend. SECURITY INVOKER preserves the existing sessions/responses RLS checks.

create or replace function public.get_course_pulse_history(
  p_course_id uuid,
  p_limit integer default 8
)
returns table (
  session_id uuid,
  title text,
  created_at timestamptz,
  is_active boolean,
  response_count integer,
  understood_count integer,
  question_count integer,
  lost_count integer
)
language sql
stable
security invoker
set search_path = ''
rows 24
as $$
  with recent_sessions as materialized (
    select
      session_row.id,
      session_row.title,
      session_row.created_at,
      session_row.is_active
    from public.sessions as session_row
    where session_row.course_id = p_course_id
      and session_row.professor_id = (select auth.uid())
    order by session_row.created_at desc, session_row.id desc
    limit least(greatest(coalesce(p_limit, 8), 1), 24)
  ),
  session_pulse as (
    select
      recent_session.id as session_id,
      recent_session.title,
      recent_session.created_at,
      recent_session.is_active,
      count(response_row.id)::integer as response_count,
      count(response_row.id) filter (
        where response_row.status = 'understood'
      )::integer as understood_count,
      count(response_row.id) filter (
        where response_row.status = 'question'
      )::integer as question_count,
      count(response_row.id) filter (
        where response_row.status = 'lost'
      )::integer as lost_count
    from recent_sessions as recent_session
    left join public.responses as response_row
      on response_row.session_id = recent_session.id
    group by
      recent_session.id,
      recent_session.title,
      recent_session.created_at,
      recent_session.is_active
  )
  select
    pulse.session_id,
    pulse.title,
    pulse.created_at,
    pulse.is_active,
    pulse.response_count,
    pulse.understood_count,
    pulse.question_count,
    pulse.lost_count
  from session_pulse as pulse
  order by pulse.created_at asc, pulse.session_id asc;
$$;

comment on function public.get_course_pulse_history(uuid, integer) is
  'Returns aggregate understanding counts for the latest professor-owned sessions in one course.';

revoke all on function public.get_course_pulse_history(uuid, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.get_course_pulse_history(uuid, integer)
  to authenticated;
