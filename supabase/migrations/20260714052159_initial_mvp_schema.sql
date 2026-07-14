-- OpenAI Build Week MVP: anonymous classroom feedback.
--
-- Security model:
--   * Professors use Supabase Auth and the `authenticated` Postgres role.
--   * Students do not create Auth users. The public SPA client stays signed out and
--     therefore uses only the `anon` Postgres role.
--   * `anon` never receives direct SELECT access to sessions or responses.
--     Session lookup is a narrow RPC and response submission is INSERT-only.
--   * Explicit GRANT statements are intentional. New Supabase projects no longer
--     expose new public-schema objects to the Data API automatically.

create schema if not exists private;

-- Keep implementation helpers outside the schemas exposed through the Data API.
revoke all on schema private from public;

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  professor_id uuid not null default auth.uid()
    references auth.users (id) on delete cascade,
  code text not null,
  title text not null,
  subject text not null,
  topic text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  ended_at timestamptz,

  constraint sessions_code_unique unique (code),
  constraint sessions_code_format check (
    code ~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$'
  ),
  constraint sessions_title_length check (
    char_length(btrim(title)) between 3 and 100
  ),
  constraint sessions_subject_length check (
    char_length(btrim(subject)) between 2 and 80
  ),
  constraint sessions_topic_length check (
    char_length(btrim(topic)) between 2 and 120
  ),
  constraint sessions_active_end_consistency check (
    (is_active and ended_at is null)
    or (not is_active and ended_at is not null)
  )
);

create table public.responses (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null
    references public.sessions (id) on delete cascade,
  anonymous_id uuid not null,
  status text not null,
  question_text text,
  created_at timestamptz not null default now(),

  -- One persistent browser identifier represents one student in each session.
  -- A second submission is rejected with SQLSTATE 23505 and should be presented
  -- by the client as "Ya enviaste una respuesta".
  constraint responses_session_anonymous_unique
    unique (session_id, anonymous_id),
  constraint responses_status_allowed check (
    status in ('understood', 'question', 'lost')
  ),
  constraint responses_question_text_length check (
    question_text is null
    or (
      char_length(question_text) between 1 and 1000
      and char_length(btrim(question_text)) > 0
    )
  )
);

-- These indexes match the professor dashboard queries and the ownership checks.
-- The response FK is also covered by the leading session_id columns below.
create index sessions_professor_created_at_idx
  on public.sessions (professor_id, created_at desc);

create index responses_session_created_at_idx
  on public.responses (session_id, created_at desc);

comment on table public.sessions is
  'Class sessions owned by authenticated professors.';
comment on table public.responses is
  'Anonymous, one-per-browser feedback submitted to active sessions.';
comment on column public.responses.anonymous_id is
  'Random UUID persisted locally in the student browser; it is not an Auth user id.';

-- updated_at is server-owned and cannot be supplied through the Data API.
create or replace function private.set_sessions_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function private.set_sessions_updated_at()
  from public, anon, authenticated, service_role;

create trigger sessions_set_updated_at
before update on public.sessions
for each row
execute function private.set_sessions_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.sessions enable row level security;
alter table public.responses enable row level security;

create policy sessions_select_own
on public.sessions
for select
to authenticated
using (professor_id = (select auth.uid()));

create policy sessions_insert_own
on public.sessions
for insert
to authenticated
with check (professor_id = (select auth.uid()));

create policy sessions_update_own
on public.sessions
for update
to authenticated
using (professor_id = (select auth.uid()))
with check (professor_id = (select auth.uid()));

create policy sessions_delete_own
on public.sessions
for delete
to authenticated
using (professor_id = (select auth.uid()));

create policy responses_select_for_session_owner
on public.responses
for select
to authenticated
using (
  exists (
    select 1
    from public.sessions as session_row
    where session_row.id = responses.session_id
      and session_row.professor_id = (select auth.uid())
  )
);

-- This helper deliberately bypasses sessions RLS so the anon INSERT policy can
-- validate an unguessable session UUID without granting anon table visibility.
-- It is private, fixed-search-path, has no dynamic SQL, and returns one boolean.
create or replace function private.is_session_active(p_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.sessions as session_row
    where session_row.id = p_session_id
      and session_row.is_active
  );
$$;

revoke all on function private.is_session_active(uuid)
  from public, anon, authenticated, service_role;

-- The function is not in an exposed schema, but anon needs USAGE/EXECUTE so the
-- database can evaluate it inside the RLS policy below.
grant usage on schema private to anon;
grant execute on function private.is_session_active(uuid) to anon;

create policy responses_insert_into_active_session
on public.responses
for insert
to anon
with check (private.is_session_active(session_id));

-- ---------------------------------------------------------------------------
-- Public lookup RPC
-- ---------------------------------------------------------------------------

-- The privileged lookup stays outside exposed schemas. It accepts only an exact
-- short code and returns the minimum fields needed by /s/:codigo; professor_id is
-- never disclosed.
create or replace function private.lookup_session_by_code(p_code text)
returns table (
  id uuid,
  code text,
  title text,
  subject text,
  topic text,
  is_active boolean
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
    session_row.is_active
  from public.sessions as session_row
  where session_row.code = upper(btrim(p_code))
    and upper(btrim(p_code)) ~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$'
  limit 1;
$$;

revoke all on function private.lookup_session_by_code(text)
  from public, anon, authenticated, service_role;
grant execute on function private.lookup_session_by_code(text) to anon;

-- The Data API exposes this non-privileged wrapper as the public RPC. The only
-- SECURITY DEFINER implementation remains in the non-exposed private schema.
create or replace function public.get_public_session(p_code text)
returns table (
  id uuid,
  code text,
  title text,
  subject text,
  topic text,
  is_active boolean
)
language sql
stable
security invoker
set search_path = ''
rows 1
as $$
  select
    session_row.id,
    session_row.code,
    session_row.title,
    session_row.subject,
    session_row.topic,
    session_row.is_active
  from private.lookup_session_by_code(p_code) as session_row;
$$;

comment on function public.get_public_session(text) is
  'Returns one session, active or ended, for an exact six-character public code.';

-- PostgreSQL grants EXECUTE on new functions to PUBLIC by default. Revoke it
-- first, then opt in only the signed-out student role.
revoke all on function public.get_public_session(text)
  from public, anon, authenticated, service_role;
grant execute on function public.get_public_session(text) to anon;

-- ---------------------------------------------------------------------------
-- Data API privileges (separate from RLS)
-- ---------------------------------------------------------------------------

grant usage on schema public to anon, authenticated;

revoke all on table public.sessions from anon, authenticated;
revoke all on table public.responses from anon, authenticated;

-- Professors may read/delete their rows. professor_id is supplied by the
-- frontend but cannot be forged because RLS checks it against auth.uid().
-- created_at/updated_at remain server-owned.
grant select, delete on table public.sessions to authenticated;
grant insert (professor_id, code, title, subject, topic)
  on table public.sessions to authenticated;
grant update (title, subject, topic, is_active, ended_at)
  on table public.sessions to authenticated;

-- Students can submit only the four client fields. Omitting SELECT intentionally
-- means the frontend must not chain .select() after .insert().
grant insert (session_id, anonymous_id, status, question_text)
  on table public.responses to anon;

-- Required for the initial professor query and for Realtime authorization.
grant select on table public.responses to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime: professor dashboard receives new responses.
-- ---------------------------------------------------------------------------

-- Supabase creates this publication. The guard keeps the migration safe if the
-- table was already enabled in Dashboard before the migration ran.
do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'responses'
  ) then
    alter publication supabase_realtime add table public.responses;
  end if;
end
$$;

-- Only INSERT events are needed by this MVP, so REPLICA IDENTITY FULL is not
-- enabled. The client must still filter on session_id; RLS remains the actual
-- security boundary for every authenticated Realtime subscriber.
