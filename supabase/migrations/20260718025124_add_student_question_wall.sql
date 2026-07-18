-- Let professors opt an active session into a bounded, anonymous question wall.
-- Students receive only visible question ids and text through a narrow
-- RPC; they never receive direct SELECT access to sessions or responses.

alter table public.sessions
  add column questions_visible_to_students boolean not null default false;

alter table public.responses
  add column is_visible_to_students boolean not null default true;

comment on column public.sessions.questions_visible_to_students is
  'Professor-controlled toggle that exposes non-excluded questions while the session is active.';

comment on column public.responses.is_visible_to_students is
  'Includes this question in the student wall by default; the professor can exclude it.';

-- The existing owner policies on sessions already protect this new toggle.
grant update (questions_visible_to_students)
  on table public.sessions to authenticated;

-- Professors can moderate only responses that belong to one of their sessions.
create policy responses_update_visibility_for_session_owner
on public.responses
for update
to authenticated
using (
  exists (
    select 1
    from public.sessions as session_row
    where session_row.id = responses.session_id
      and session_row.professor_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.sessions as session_row
    where session_row.id = responses.session_id
      and session_row.professor_id = (select auth.uid())
  )
);

grant update (is_visible_to_students)
  on table public.responses to authenticated;

-- This implementation deliberately bypasses RLS so signed-out students can
-- read a tightly constrained projection. It lives outside exposed schemas,
-- has a fixed search path, and never returns anonymous identifiers or status.
-- The session_id-leading responses_session_created_at_idx supports the bounded
-- newest-first lookup, so no additional index is needed.
create or replace function private.get_student_question_wall(
  p_session_id uuid,
  p_limit integer
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with target_session as materialized (
    select session_row.id
    from public.sessions as session_row
    where session_row.id = p_session_id
      and session_row.is_active
      and session_row.questions_visible_to_students
  ),
  visible_questions as materialized (
    select
      response_row.id,
      response_row.question_text,
      response_row.created_at
    from public.responses as response_row
    join target_session
      on target_session.id = response_row.session_id
    where response_row.is_visible_to_students
      and response_row.question_text is not null
    order by response_row.created_at desc, response_row.id desc
    limit least(greatest(coalesce(p_limit, 50), 1), 100)
  )
  select pg_catalog.jsonb_build_object(
    'visible', exists (select 1 from target_session),
    'questions', coalesce(
      (
        select pg_catalog.jsonb_agg(
          pg_catalog.jsonb_build_object(
            'id', question.id,
            'question_text', question.question_text
          )
          order by question.created_at desc, question.id desc
        )
        from visible_questions as question
      ),
      '[]'::jsonb
    )
  );
$$;

revoke all on function private.get_student_question_wall(uuid, integer)
  from public, anon, authenticated, service_role;
grant execute on function private.get_student_question_wall(uuid, integer)
  to anon;

-- Expose only a SECURITY INVOKER wrapper through the Data API. The default of
-- 50 is clamped by the private implementation to the inclusive range 1..100.
create or replace function public.get_student_question_wall(
  p_session_id uuid,
  p_limit integer default 50
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private.get_student_question_wall(p_session_id, p_limit);
$$;

comment on function public.get_student_question_wall(uuid, integer) is
  'Returns up to 100 non-excluded questions while an opted-in session is active.';

revoke all on function public.get_student_question_wall(uuid, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.get_student_question_wall(uuid, integer)
  to anon;

-- Preserve the original boundary explicitly: students can call the RPC but
-- cannot query either source table through PostgREST.
revoke select on table public.sessions, public.responses from anon;
