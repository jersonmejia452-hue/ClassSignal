-- Confusion-map analysis history. Only authenticated session owners may read
-- these rows. Creation and state transitions happen in the authenticated Edge
-- Function through its server-only service client.

create table public.session_analyses (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null
    references public.sessions (id) on delete cascade,
  professor_id uuid not null
    references auth.users (id) on delete cascade,
  status text not null default 'pending',
  model text not null,
  prompt_version smallint not null,
  response_count integer not null,
  source_latest_response_at timestamptz not null,
  result jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,

  constraint session_analyses_status_allowed check (
    status in ('pending', 'completed', 'failed')
  ),
  constraint session_analyses_model_length check (
    char_length(btrim(model)) between 1 and 100
  ),
  constraint session_analyses_prompt_version_positive check (
    prompt_version > 0
  ),
  constraint session_analyses_response_count_positive check (
    response_count > 0
  ),
  constraint session_analyses_result_object check (
    result is null or jsonb_typeof(result) = 'object'
  ),
  constraint session_analyses_result_size check (
    result is null or octet_length(result::text) <= 131072
  ),
  constraint session_analyses_error_message_length check (
    error_message is null
    or char_length(btrim(error_message)) between 1 and 500
  ),
  constraint session_analyses_state_consistency check (
    (
      status = 'pending'
      and result is null
      and error_message is null
      and completed_at is null
    )
    or (
      status = 'completed'
      and result is not null
      and error_message is null
      and completed_at is not null
    )
    or (
      status = 'failed'
      and result is null
      and error_message is not null
      and completed_at is not null
    )
  )
);

-- The leading FK columns support cascade checks as well as the two application
-- access paths: one session's history and one professor's retained history.
create index session_analyses_session_created_at_idx
  on public.session_analyses (session_id, created_at desc);

create index session_analyses_professor_created_at_idx
  on public.session_analyses (professor_id, created_at desc);

-- Multiple browser tabs cannot start duplicate paid work for the same session.
create unique index session_analyses_one_pending_per_session_idx
  on public.session_analyses (session_id)
  where status = 'pending';

-- A completed result is a cache entry for an exact response snapshot and prompt.
create unique index session_analyses_completed_snapshot_idx
  on public.session_analyses (
    session_id,
    response_count,
    source_latest_response_at,
    model,
    prompt_version
  )
  where status = 'completed';

comment on table public.session_analyses is
  'Server-generated, immutable history of confusion-map analyses.';
comment on column public.session_analyses.result is
  'Structured confusion map generated from anonymous response text; never includes anonymous_id.';

-- Analysis source metadata is immutable. A run begins pending and may make one
-- terminal transition to completed or failed; terminal records cannot change.
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

    new.created_at := now();
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
    or new.professor_id is distinct from old.professor_id
    or new.model is distinct from old.model
    or new.prompt_version is distinct from old.prompt_version
    or new.response_count is distinct from old.response_count
    or new.source_latest_response_at is distinct from old.source_latest_response_at
    or new.created_at is distinct from old.created_at
  then
    raise exception
      using errcode = '23514',
            message = 'Session analysis source metadata is immutable';
  end if;

  new.completed_at := now();
  return new;
end;
$$;

revoke all on function private.enforce_session_analysis_state()
  from public, anon, authenticated, service_role;

create trigger session_analyses_enforce_state
before insert or update on public.session_analyses
for each row
execute function private.enforce_session_analysis_state();

alter table public.session_analyses enable row level security;

create policy session_analyses_select_for_session_owner
on public.session_analyses
for select
to authenticated
using (
  exists (
    select 1
    from public.sessions as session_row
    where session_row.id = session_analyses.session_id
      and session_row.professor_id = (select auth.uid())
  )
);

-- Privileges and RLS are deliberately separate. The browser can only read its
-- own rows. The Edge Function uses its server-only secret for state changes.
revoke all privileges on table public.session_analyses
  from public, anon, authenticated, service_role;

grant select on table public.session_analyses to authenticated;
grant select, insert, update on table public.session_analyses to service_role;
