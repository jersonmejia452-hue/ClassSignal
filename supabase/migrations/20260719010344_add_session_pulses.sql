-- Add up to six sequential pulse rounds to each class session. Existing data is
-- assigned to pulse 1, while new response and analysis work is scoped to one
-- explicit pulse. Session lifecycle changes remain atomic with pulse lifecycle.

-- ---------------------------------------------------------------------------
-- Pulse rounds and legacy backfill
-- ---------------------------------------------------------------------------

create table public.session_pulses (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null
    references public.sessions (id) on delete cascade,
  ordinal integer not null,
  is_active boolean not null default true,
  questions_visible_to_students boolean not null default false,
  started_at timestamptz not null default now(),
  ended_at timestamptz,

  constraint session_pulses_id_session_id_key unique (id, session_id),
  constraint session_pulses_session_ordinal_key unique (session_id, ordinal),
  constraint session_pulses_ordinal_range check (ordinal between 1 and 6),
  constraint session_pulses_state_consistency check (
    (is_active and ended_at is null)
    or (not is_active and ended_at is not null)
  ),
  constraint session_pulses_time_order check (
    ended_at is null or ended_at >= started_at
  )
);

create unique index session_pulses_one_active_per_session_idx
  on public.session_pulses (session_id)
  where is_active;

create index session_pulses_session_started_at_idx
  on public.session_pulses (session_id, started_at desc);

comment on table public.session_pulses is
  'Sequential understanding checkpoints within one class session; at most one is active.';
comment on column public.session_pulses.questions_visible_to_students is
  'Per-pulse professor toggle for the anonymous student question wall.';

insert into public.session_pulses (
  session_id,
  ordinal,
  is_active,
  questions_visible_to_students,
  started_at,
  ended_at
)
select
  session_row.id,
  1,
  session_row.is_active,
  session_row.questions_visible_to_students,
  session_row.created_at,
  case
    when session_row.is_active then null
    else coalesce(
      session_row.ended_at,
      session_row.updated_at,
      session_row.created_at
    )
  end
from public.sessions as session_row;

-- ---------------------------------------------------------------------------
-- Attach responses and analyses to their backfilled pulse
-- ---------------------------------------------------------------------------

alter table public.responses
  add column pulse_id uuid;

update public.responses as response_row
set pulse_id = pulse.id
from public.session_pulses as pulse
where pulse.session_id = response_row.session_id
  and pulse.ordinal = 1;

alter table public.responses
  alter column pulse_id set not null,
  drop constraint responses_session_anonymous_unique,
  add constraint responses_pulse_anonymous_unique
    unique (pulse_id, anonymous_id),
  add constraint responses_pulse_session_fkey
    foreign key (pulse_id, session_id)
    references public.session_pulses (id, session_id)
    on delete cascade;

create index responses_pulse_created_at_idx
  on public.responses (pulse_id, created_at desc);

comment on column public.responses.pulse_id is
  'Pulse that accepted this anonymous understanding signal.';

alter table public.session_analyses
  add column pulse_id uuid;

-- Existing terminal analyses are intentionally immutable at runtime. The
-- migration already holds an ACCESS EXCLUSIVE lock for the ALTER TABLE above,
-- so suspend only that row trigger while attaching historical rows to Pulse 1.
alter table public.session_analyses
  disable trigger session_analyses_enforce_state;

update public.session_analyses as analysis
set pulse_id = pulse.id
from public.session_pulses as pulse
where pulse.session_id = analysis.session_id
  and pulse.ordinal = 1;

alter table public.session_analyses
  enable trigger session_analyses_enforce_state;

alter table public.session_analyses
  alter column pulse_id set not null,
  add constraint session_analyses_pulse_session_fkey
    foreign key (pulse_id, session_id)
    references public.session_pulses (id, session_id)
    on delete cascade;

-- The former completed-only cache index allowed a crashed/racing request to
-- leave a pending row beside an already completed row for the same input. Such
-- a pending row is superseded and must be terminal before the stronger index
-- below can be created safely on an existing production database.
update public.session_analyses as pending_analysis
set status = 'failed',
    error_message =
      'Superseded by an already completed analysis during pulse migration.'
where pending_analysis.status = 'pending'
  and exists (
    select 1
    from public.session_analyses as completed_analysis
    where completed_analysis.pulse_id = pending_analysis.pulse_id
      and completed_analysis.source_fingerprint =
        pending_analysis.source_fingerprint
      and completed_analysis.model = pending_analysis.model
      and completed_analysis.prompt_version = pending_analysis.prompt_version
      and completed_analysis.status = 'completed'
  );

drop index public.session_analyses_one_pending_per_session_idx;
drop index public.session_analyses_completed_fingerprint_idx;

create unique index session_analyses_one_pending_per_pulse_idx
  on public.session_analyses (pulse_id)
  where status = 'pending';

-- Reserve a fingerprint while it is pending as well as after completion. This
-- closes the race where a fast first request completes between another
-- request's cache check and pending-row insert, which would otherwise pay for
-- the same model call twice before failing on completion.
create unique index session_analyses_active_pulse_fingerprint_idx
  on public.session_analyses (
    pulse_id,
    source_fingerprint,
    model,
    prompt_version
  )
  where status in ('pending', 'completed');

create index session_analyses_pulse_created_at_idx
  on public.session_analyses (pulse_id, created_at desc);

comment on column public.session_analyses.pulse_id is
  'Pulse snapshot analyzed by the server-side OpenAI workflow.';

-- ---------------------------------------------------------------------------
-- RLS and Data API privileges
-- ---------------------------------------------------------------------------

alter table public.session_pulses enable row level security;

create policy session_pulses_select_for_session_owner
on public.session_pulses
for select
to authenticated
using (
  exists (
    select 1
    from public.sessions as session_row
    where session_row.id = session_pulses.session_id
      and session_row.professor_id = (select auth.uid())
  )
);

create policy session_pulses_update_questions_for_session_owner
on public.session_pulses
for update
to authenticated
using (
  session_pulses.is_active
  and exists (
    select 1
    from public.sessions as session_row
    where session_row.id = session_pulses.session_id
      and session_row.professor_id = (select auth.uid())
      and session_row.is_active
  )
)
with check (
  session_pulses.is_active
  and exists (
    select 1
    from public.sessions as session_row
    where session_row.id = session_pulses.session_id
      and session_row.professor_id = (select auth.uid())
      and session_row.is_active
  )
);

revoke all privileges on table public.session_pulses
  from public, anon, authenticated, service_role;
grant select on table public.session_pulses to authenticated;
grant update (questions_visible_to_students)
  on table public.session_pulses to authenticated;
grant select on table public.session_pulses to service_role;

-- Session state and the legacy session-level wall flag are no longer mutable
-- directly from the browser. The atomic RPCs and per-pulse toggle own them.
revoke update (is_active, ended_at, questions_visible_to_students)
  on table public.sessions from authenticated;

-- ---------------------------------------------------------------------------
-- Pulse/session lifecycle
-- ---------------------------------------------------------------------------

create or replace function private.sync_session_pulse_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_ordinal integer;
begin
  if tg_op = 'INSERT' then
    insert into public.session_pulses (
      session_id,
      ordinal,
      is_active,
      questions_visible_to_students,
      started_at,
      ended_at
    ) values (
      new.id,
      1,
      new.is_active,
      new.questions_visible_to_students,
      new.created_at,
      case
        when new.is_active then null
        else coalesce(new.ended_at, pg_catalog.now())
      end
    );

    return new;
  end if;

  if old.is_active and not new.is_active then
    update public.session_pulses as pulse
    set
      is_active = false,
      ended_at = coalesce(new.ended_at, pg_catalog.now())
    where pulse.session_id = new.id
      and pulse.is_active;
  elsif not old.is_active and new.is_active then
    select coalesce(max(pulse.ordinal), 0) + 1
    into next_ordinal
    from public.session_pulses as pulse
    where pulse.session_id = new.id;

    if next_ordinal > 6 then
      raise exception
        using errcode = 'P0001',
              message = 'pulse_limit_reached';
    end if;

    insert into public.session_pulses (
      session_id,
      ordinal,
      is_active,
      questions_visible_to_students,
      started_at,
      ended_at
    ) values (
      new.id,
      next_ordinal,
      true,
      false,
      pg_catalog.now(),
      null
    );
  end if;

  return new;
end;
$$;

revoke all on function private.sync_session_pulse_lifecycle()
  from public, anon, authenticated, service_role;

create trigger sessions_sync_pulse_lifecycle
after insert or update of is_active on public.sessions
for each row
execute function private.sync_session_pulse_lifecycle();

create or replace function private.open_next_session_pulse(
  p_session_id uuid
)
returns public.session_pulses
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  session_is_active boolean;
  active_pulse_id uuid;
  active_response_count integer;
  next_ordinal integer;
  created_pulse public.session_pulses;
begin
  if current_user_id is null then
    raise exception
      using errcode = '42501',
            message = 'unauthorized';
  end if;

  select session_row.is_active
  into session_is_active
  from public.sessions as session_row
  where session_row.id = p_session_id
    and session_row.professor_id = current_user_id
  for update;

  if not found then
    raise exception
      using errcode = 'P0001',
            message = 'session_not_found';
  end if;

  if not session_is_active then
    raise exception
      using errcode = 'P0001',
            message = 'session_inactive';
  end if;

  select
    pulse.id,
    count(response_row.id)::integer
  into active_pulse_id, active_response_count
  from public.session_pulses as pulse
  left join public.responses as response_row
    on response_row.pulse_id = pulse.id
  where pulse.session_id = p_session_id
    and pulse.is_active
  group by pulse.id;

  if active_pulse_id is null then
    raise exception
      using errcode = 'P0001',
            message = 'pulse_inactive';
  end if;

  if active_response_count < 1 then
    raise exception
      using errcode = 'P0001',
            message = 'pulse_has_no_responses';
  end if;

  select coalesce(max(pulse.ordinal), 0) + 1
  into next_ordinal
  from public.session_pulses as pulse
  where pulse.session_id = p_session_id;

  if next_ordinal > 6 then
    raise exception
      using errcode = 'P0001',
            message = 'pulse_limit_reached';
  end if;

  update public.session_pulses as pulse
  set
    is_active = false,
    ended_at = pg_catalog.now()
  where pulse.session_id = p_session_id
    and pulse.is_active;

  insert into public.session_pulses (
    session_id,
    ordinal,
    is_active,
    questions_visible_to_students,
    started_at,
    ended_at
  ) values (
    p_session_id,
    next_ordinal,
    true,
    false,
    pg_catalog.now(),
    null
  )
  returning * into created_pulse;

  return created_pulse;
end;
$$;

create or replace function private.set_session_active(
  p_session_id uuid,
  p_is_active boolean
)
returns public.sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  target_session public.sessions;
  current_max_ordinal integer;
begin
  if current_user_id is null then
    raise exception
      using errcode = '42501',
            message = 'unauthorized';
  end if;

  select session_row.*
  into target_session
  from public.sessions as session_row
  where session_row.id = p_session_id
    and session_row.professor_id = current_user_id
  for update;

  if not found then
    raise exception
      using errcode = 'P0001',
            message = 'session_not_found';
  end if;

  if target_session.is_active = p_is_active then
    return target_session;
  end if;

  if p_is_active then
    select coalesce(max(pulse.ordinal), 0)
    into current_max_ordinal
    from public.session_pulses as pulse
    where pulse.session_id = p_session_id;

    if current_max_ordinal >= 6 then
      raise exception
        using errcode = 'P0001',
              message = 'pulse_limit_reached';
    end if;
  end if;

  update public.sessions as session_row
  set
    is_active = p_is_active,
    ended_at = case when p_is_active then null else pg_catalog.now() end
  where session_row.id = p_session_id
    and session_row.professor_id = current_user_id
  returning session_row.* into target_session;

  return target_session;
end;
$$;

revoke all on function private.open_next_session_pulse(uuid)
  from public, anon, authenticated, service_role;
revoke all on function private.set_session_active(uuid, boolean)
  from public, anon, authenticated, service_role;
grant usage on schema private to authenticated;
grant execute on function private.open_next_session_pulse(uuid)
  to authenticated;
grant execute on function private.set_session_active(uuid, boolean)
  to authenticated;

create or replace function public.open_next_session_pulse(
  p_session_id uuid
)
returns public.session_pulses
language sql
volatile
security invoker
set search_path = ''
as $$
  select pulse.*
  from private.open_next_session_pulse(p_session_id) as pulse;
$$;

create or replace function public.set_session_active(
  p_session_id uuid,
  p_is_active boolean
)
returns public.sessions
language sql
volatile
security invoker
set search_path = ''
as $$
  select session_row.*
  from private.set_session_active(p_session_id, p_is_active) as session_row;
$$;

revoke all on function public.open_next_session_pulse(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.set_session_active(uuid, boolean)
  from public, anon, authenticated, service_role;
grant execute on function public.open_next_session_pulse(uuid)
  to authenticated;
grant execute on function public.set_session_active(uuid, boolean)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Public session lookup exposes only the current pulse identity
-- ---------------------------------------------------------------------------

drop function public.get_public_session(text);
drop function private.lookup_session_by_code(text);

create or replace function private.lookup_session_by_code(p_code text)
returns table (
  id uuid,
  code text,
  title text,
  subject text,
  topic text,
  is_active boolean,
  active_pulse_id uuid,
  active_pulse_ordinal integer,
  active_pulse_started_at timestamptz
)
language sql
stable
security definer
set search_path = ''
rows 1
as $$
  select
    session_row.id,
    session_row.code,
    session_row.title,
    session_row.subject,
    session_row.topic,
    session_row.is_active,
    pulse.id,
    pulse.ordinal,
    pulse.started_at
  from public.sessions as session_row
  left join public.session_pulses as pulse
    on pulse.session_id = session_row.id
   and pulse.is_active
  where session_row.code = upper(pg_catalog.btrim(p_code))
    and upper(pg_catalog.btrim(p_code)) ~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$'
  limit 1;
$$;

revoke all on function private.lookup_session_by_code(text)
  from public, anon, authenticated, service_role;
grant execute on function private.lookup_session_by_code(text) to anon;

create or replace function public.get_public_session(p_code text)
returns table (
  id uuid,
  code text,
  title text,
  subject text,
  topic text,
  is_active boolean,
  active_pulse_id uuid,
  active_pulse_ordinal integer,
  active_pulse_started_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
rows 1
as $$
  select lookup.*
  from private.lookup_session_by_code(p_code) as lookup;
$$;

revoke all on function public.get_public_session(text)
  from public, anon, authenticated, service_role;
grant execute on function public.get_public_session(text) to anon;

-- ---------------------------------------------------------------------------
-- Public question wall is explicit and bounded to the active pulse
-- ---------------------------------------------------------------------------

drop function public.get_student_question_wall(uuid, integer);
drop function private.get_student_question_wall(uuid, integer);

create or replace function private.get_student_question_wall(
  p_session_id uuid,
  p_pulse_id uuid,
  p_limit integer
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with target_pulse as materialized (
    select pulse.id
    from public.session_pulses as pulse
    join public.sessions as session_row
      on session_row.id = pulse.session_id
    where session_row.id = p_session_id
      and session_row.is_active
      and pulse.id = p_pulse_id
      and pulse.is_active
      and pulse.questions_visible_to_students
  ),
  visible_questions as materialized (
    select
      response_row.id,
      response_row.question_text,
      response_row.created_at
    from public.responses as response_row
    join target_pulse
      on target_pulse.id = response_row.pulse_id
    where response_row.is_visible_to_students
      and response_row.question_text is not null
    order by response_row.created_at desc, response_row.id desc
    limit least(greatest(coalesce(p_limit, 50), 1), 100)
  )
  select pg_catalog.jsonb_build_object(
    'pulse_id', p_pulse_id,
    'visible', exists (select 1 from target_pulse),
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

revoke all on function private.get_student_question_wall(uuid, uuid, integer)
  from public, anon, authenticated, service_role;
grant execute on function private.get_student_question_wall(uuid, uuid, integer)
  to anon;

create or replace function public.get_student_question_wall(
  p_session_id uuid,
  p_pulse_id uuid,
  p_limit integer default 50
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private.get_student_question_wall(
    p_session_id,
    p_pulse_id,
    p_limit
  );
$$;

revoke all on function public.get_student_question_wall(uuid, uuid, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.get_student_question_wall(uuid, uuid, integer)
  to anon;

-- ---------------------------------------------------------------------------
-- Course history uses the latest pulse that actually received responses
-- ---------------------------------------------------------------------------

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
  latest_pulses as materialized (
    select
      recent_session.id as session_id,
      latest_pulse.id as pulse_id
    from recent_sessions as recent_session
    left join lateral (
      select pulse.id
      from public.session_pulses as pulse
      where pulse.session_id = recent_session.id
        and exists (
          select 1
          from public.responses as candidate_response
          where candidate_response.pulse_id = pulse.id
        )
      order by pulse.ordinal desc
      limit 1
    ) as latest_pulse on true
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
    join latest_pulses as latest_pulse
      on latest_pulse.session_id = recent_session.id
    left join public.responses as response_row
      on response_row.pulse_id = latest_pulse.pulse_id
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

revoke all on function public.get_course_pulse_history(uuid, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.get_course_pulse_history(uuid, integer)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Per-pulse abuse buckets and atomic anonymous submission
-- ---------------------------------------------------------------------------

-- Buckets contain only rolling, one-way abuse counters. Resetting them once at
-- migration avoids inventing a pulse attribution for pre-migration attempts.
truncate table private.response_submission_buckets;

alter table private.response_submission_buckets
  drop constraint response_submission_buckets_pkey,
  add column pulse_id uuid not null,
  add constraint response_submission_buckets_pkey
    primary key (pulse_id, network_fingerprint, window_started_at),
  add constraint response_submission_buckets_pulse_session_fkey
    foreign key (pulse_id, session_id)
    references public.session_pulses (id, session_id)
    on delete cascade;

create or replace function public.submit_student_response_server_v2(
  p_session_id uuid,
  p_pulse_id uuid,
  p_anonymous_id uuid,
  p_status text,
  p_question_text text,
  p_network_fingerprint text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  session_is_active boolean;
  normalized_question text;
  current_attempts integer;
  created_response_id uuid;
  current_window timestamptz;
begin
  if p_status not in ('understood', 'question', 'lost') then
    raise exception
      using errcode = '22023',
            message = 'invalid_response_status';
  end if;

  if p_network_fingerprint !~ '^[0-9a-f]{64}$' then
    raise exception
      using errcode = '22023',
            message = 'invalid_network_fingerprint';
  end if;

  normalized_question := nullif(pg_catalog.btrim(p_question_text), '');
  if normalized_question is not null
    and pg_catalog.char_length(normalized_question) > 1000
  then
    raise exception
      using errcode = '22023',
            message = 'invalid_question_text';
  end if;

  -- Every lifecycle writer locks the session first, so this serializes pulse
  -- rotation with stale student submissions.
  select session_row.is_active
  into session_is_active
  from public.sessions as session_row
  where session_row.id = p_session_id
  for update;

  if not found then
    return pg_catalog.jsonb_build_object('outcome', 'session_not_found');
  end if;

  if not session_is_active then
    return pg_catalog.jsonb_build_object('outcome', 'session_inactive');
  end if;

  if not exists (
    select 1
    from public.session_pulses as pulse
    where pulse.id = p_pulse_id
      and pulse.session_id = p_session_id
      and pulse.is_active
  ) then
    return pg_catalog.jsonb_build_object('outcome', 'pulse_inactive');
  end if;

  current_window := pg_catalog.date_bin(
    interval '15 minutes',
    pg_catalog.now(),
    timestamptz '2001-01-01 00:00:00+00'
  );

  delete from private.response_submission_buckets as bucket
  where bucket.window_started_at < pg_catalog.now() - interval '1 day';

  insert into private.response_submission_buckets (
    session_id,
    pulse_id,
    network_fingerprint,
    window_started_at,
    attempts
  ) values (
    p_session_id,
    p_pulse_id,
    p_network_fingerprint,
    current_window,
    1
  )
  on conflict (pulse_id, network_fingerprint, window_started_at)
  do update set attempts = least(
    private.response_submission_buckets.attempts + 1,
    81
  )
  returning attempts into current_attempts;

  if current_attempts > 80 then
    return pg_catalog.jsonb_build_object('outcome', 'response_rate_limit');
  end if;

  if (
    select count(*)
    from public.responses as response_row
    where response_row.pulse_id = p_pulse_id
  ) >= 500 then
    return pg_catalog.jsonb_build_object('outcome', 'pulse_response_limit');
  end if;

  insert into public.responses (
    session_id,
    pulse_id,
    anonymous_id,
    status,
    question_text
  ) values (
    p_session_id,
    p_pulse_id,
    p_anonymous_id,
    p_status,
    normalized_question
  )
  on conflict (pulse_id, anonymous_id) do nothing
  returning id into created_response_id;

  if created_response_id is null then
    return pg_catalog.jsonb_build_object('outcome', 'duplicate_response');
  end if;

  return pg_catalog.jsonb_build_object(
    'outcome', 'accepted',
    'response_id', created_response_id,
    'pulse_id', p_pulse_id
  );
end;
$$;

revoke all on function public.submit_student_response_server_v2(
  uuid, uuid, uuid, text, text, text
) from public, anon, authenticated, service_role;
grant execute on function public.submit_student_response_server_v2(
  uuid, uuid, uuid, text, text, text
) to service_role;

-- Remove the pre-pulse overload. Accepting it would preserve session-scoped
-- HMAC/Turnstile semantics and could attribute a delayed request to a new pulse.
revoke all on function public.submit_student_response_server_v2(
  uuid, uuid, text, text, text
) from public, anon, authenticated, service_role;
drop function public.submit_student_response_server_v2(
  uuid, uuid, text, text, text
);

-- The superseded v1 function cannot satisfy the per-pulse NOT NULL invariant.
revoke all on function public.submit_student_response_server(
  uuid, uuid, text, text, text
) from public, anon, authenticated, service_role;
drop function public.submit_student_response_server(
  uuid, uuid, text, text, text
);

-- ---------------------------------------------------------------------------
-- Immutable, cached AI analysis per pulse
-- ---------------------------------------------------------------------------

create or replace function private.enforce_session_analysis_state()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'pending' then
      raise exception
        using errcode = '23514',
              message = 'A session analysis must start as pending';
    end if;

    new.created_at := pg_catalog.now();
    new.completed_at := null;
    return new;
  end if;

  if old.status <> 'pending' then
    raise exception
      using errcode = '23514',
            message = 'A terminal session analysis is immutable';
  end if;

  if new.status not in ('completed', 'failed') then
    raise exception
      using errcode = '23514',
            message = 'A pending session analysis must become completed or failed';
  end if;

  if new.session_id is distinct from old.session_id
    or new.pulse_id is distinct from old.pulse_id
    or new.professor_id is distinct from old.professor_id
    or new.model is distinct from old.model
    or new.prompt_version is distinct from old.prompt_version
    or new.response_count is distinct from old.response_count
    or new.source_latest_response_at is distinct from old.source_latest_response_at
    or new.source_fingerprint is distinct from old.source_fingerprint
    or new.created_at is distinct from old.created_at
  then
    raise exception
      using errcode = '23514',
            message = 'Session analysis source metadata is immutable';
  end if;

  new.completed_at := pg_catalog.now();
  return new;
end;
$$;

revoke all on function private.enforce_session_analysis_state()
  from public, anon, authenticated, service_role;

create or replace function public.create_session_analysis(
  p_session_id uuid,
  p_pulse_id uuid,
  p_professor_id uuid,
  p_model text,
  p_prompt_version smallint,
  p_response_count integer,
  p_source_latest_response_at timestamptz,
  p_source_fingerprint text,
  p_hourly_limit integer
)
returns public.session_analyses
language plpgsql
security invoker
set search_path = ''
as $$
declare
  created_analysis public.session_analyses;
  professor_daily_limit constant integer := 20;
  global_daily_limit constant integer := 200;
begin
  if p_hourly_limit < 1 or p_hourly_limit > 100 then
    raise exception
      using errcode = '22023',
            message = 'invalid_analysis_hourly_limit';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('classsignal:analysis:global', 837429)
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_professor_id::text, 837429)
  );

  if (
    select count(*)
    from public.session_analyses as analysis
    where analysis.created_at >= pg_catalog.now() - interval '24 hours'
  ) >= global_daily_limit then
    raise exception
      using errcode = 'P0001',
            message = 'analysis_global_limit';
  end if;

  if (
    select count(*)
    from public.session_analyses as analysis
    where analysis.professor_id = p_professor_id
      and analysis.created_at >= pg_catalog.now() - interval '24 hours'
  ) >= professor_daily_limit then
    raise exception
      using errcode = 'P0001',
            message = 'analysis_daily_limit';
  end if;

  if (
    select count(*)
    from public.session_analyses as analysis
    where analysis.professor_id = p_professor_id
      and analysis.created_at >= pg_catalog.now() - interval '1 hour'
  ) >= p_hourly_limit then
    raise exception
      using errcode = 'P0001',
            message = 'analysis_hourly_limit';
  end if;

  insert into public.session_analyses (
    session_id,
    pulse_id,
    professor_id,
    model,
    prompt_version,
    response_count,
    source_latest_response_at,
    source_fingerprint
  ) values (
    p_session_id,
    p_pulse_id,
    p_professor_id,
    p_model,
    p_prompt_version,
    p_response_count,
    p_source_latest_response_at,
    p_source_fingerprint
  )
  returning * into created_analysis;

  return created_analysis;
end;
$$;

revoke all on function public.create_session_analysis(
  uuid, uuid, uuid, text, smallint, integer, timestamptz, text, integer
) from public, anon, authenticated, service_role;
grant execute on function public.create_session_analysis(
  uuid, uuid, uuid, text, smallint, integer, timestamptz, text, integer
) to service_role;

-- Do not keep the pre-pulse overload: it cannot prove which response snapshot
-- belongs to one round and could persist a mixed-session analysis.
revoke all on function public.create_session_analysis(
  uuid, uuid, text, smallint, integer, timestamptz, text, integer
) from public, anon, authenticated, service_role;
drop function public.create_session_analysis(
  uuid, uuid, text, smallint, integer, timestamptz, text, integer
);

-- ---------------------------------------------------------------------------
-- Realtime: professors can observe pulse rotation under the SELECT policy
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'session_pulses'
  ) then
    alter publication supabase_realtime add table public.session_pulses;
  end if;
end
$$;
