-- Tie every analysis row to the owning professor and cache by a deterministic
-- fingerprint of the exact response payload sent to the model.

alter table public.sessions
  add constraint sessions_id_professor_id_key
  unique (id, professor_id);

alter table public.session_analyses
  add column source_fingerprint text not null,
  add constraint session_analyses_source_fingerprint_format check (
    source_fingerprint ~ '^[0-9a-f]{64}$'
  );

alter table public.session_analyses
  drop constraint session_analyses_session_id_fkey,
  add constraint session_analyses_session_owner_fkey
    foreign key (session_id, professor_id)
    references public.sessions (id, professor_id)
    on delete cascade;

drop index public.session_analyses_completed_snapshot_idx;

create unique index session_analyses_completed_fingerprint_idx
  on public.session_analyses (
    session_id,
    source_fingerprint,
    model,
    prompt_version
  )
  where status = 'completed';

comment on column public.session_analyses.source_fingerprint is
  'SHA-256 of the ordered, bounded response payload used for this analysis.';

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
    or new.source_fingerprint is distinct from old.source_fingerprint
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
