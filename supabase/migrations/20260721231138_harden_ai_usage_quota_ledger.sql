-- Preserve paid-work reservations independently from deletable classroom data.
-- The ledger stores no session, pulse, response, prompt, or generated content.
-- It is private, append-only, and intentionally has no cascading foreign keys.

select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended('classsignal:analysis:global', 837429)
);

-- Close the one migration-time gap where a legacy direct writer could insert
-- after the backfill but before the reservation triggers and revokes commit.
lock table public.session_analyses in share row exclusive mode;
lock table public.session_ai_artifacts in share row exclusive mode;

create table private.ai_usage_ledger (
  work_kind text not null,
  work_id uuid not null,
  professor_id uuid not null,
  reserved_at timestamptz not null,

  constraint ai_usage_ledger_pkey primary key (work_kind, work_id),
  constraint ai_usage_ledger_work_kind_allowed check (
    work_kind in ('analysis', 'publication_draft', 'micro_intervention')
  )
);

comment on table private.ai_usage_ledger is
  'Minimal append-only AI reservation ledger. It survives classroom deletion so rolling quotas cannot be reset by deleting sessions.';
comment on column private.ai_usage_ledger.professor_id is
  'Private quota key only; deliberately not a foreign key so account or session cascades cannot erase global usage history.';

create index ai_usage_ledger_reserved_at_idx
  on private.ai_usage_ledger (reserved_at desc);

create index ai_usage_ledger_professor_reserved_at_idx
  on private.ai_usage_ledger (professor_id, reserved_at desc);

insert into private.ai_usage_ledger (
  work_kind,
  work_id,
  professor_id,
  reserved_at
)
select
  'analysis',
  analysis.id,
  analysis.professor_id,
  analysis.created_at
from public.session_analyses as analysis
union all
select
  artifact.kind,
  artifact.id,
  artifact.professor_id,
  artifact.created_at
from public.session_ai_artifacts as artifact;

create or replace function private.reject_ai_usage_ledger_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception
    using errcode = '23514',
          message = 'AI usage ledger rows are append-only';
  return null;
end;
$$;

revoke all on function private.reject_ai_usage_ledger_mutation()
  from public, anon, authenticated, service_role;

create trigger ai_usage_ledger_reject_row_mutation
before update or delete on private.ai_usage_ledger
for each row
execute function private.reject_ai_usage_ledger_mutation();

create trigger ai_usage_ledger_reject_truncate
before truncate on private.ai_usage_ledger
for each statement
execute function private.reject_ai_usage_ledger_mutation();

create or replace function private.record_ai_usage_reservation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  reservation_kind text;
begin
  if tg_table_schema <> 'public' then
    raise exception
      using errcode = '55000',
            message = 'Unsupported AI usage ledger source';
  end if;

  if tg_table_name = 'session_analyses' then
    reservation_kind := 'analysis';
  elsif tg_table_name = 'session_ai_artifacts' then
    reservation_kind := pg_catalog.to_jsonb(new) ->> 'kind';
  else
    raise exception
      using errcode = '55000',
            message = 'Unsupported AI usage ledger source';
  end if;

  insert into private.ai_usage_ledger (
    work_kind,
    work_id,
    professor_id,
    reserved_at
  ) values (
    reservation_kind,
    new.id,
    new.professor_id,
    new.created_at
  );

  return new;
end;
$$;

revoke all on function private.record_ai_usage_reservation()
  from public, anon, authenticated, service_role;

create trigger session_analyses_record_ai_usage
after insert on public.session_analyses
for each row
execute function private.record_ai_usage_reservation();

create trigger session_ai_artifacts_record_ai_usage
after insert on public.session_ai_artifacts
for each row
execute function private.record_ai_usage_reservation();

alter table private.ai_usage_ledger enable row level security;

revoke all privileges on table private.ai_usage_ledger
  from public, anon, authenticated, service_role;

create or replace function private.enforce_ai_usage_quota(
  p_professor_id uuid,
  p_hourly_limit integer,
  p_error_namespace text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  hourly_ceiling constant integer := 12;
  professor_daily_limit constant integer := 20;
  global_daily_limit constant integer := 200;
begin
  if p_professor_id is null
    or p_hourly_limit is null
    or p_hourly_limit < 1
    or p_hourly_limit > 100
    or p_error_namespace not in ('analysis', 'artifact')
  then
    raise exception
      using errcode = '22023',
            message = 'invalid_ai_usage_quota_request';
  end if;

  if (
    select pg_catalog.count(*)
    from private.ai_usage_ledger as usage
    where usage.reserved_at >= pg_catalog.now() - interval '24 hours'
  ) >= global_daily_limit then
    raise exception
      using errcode = 'P0001',
            message = p_error_namespace || '_global_limit';
  end if;

  if (
    select pg_catalog.count(*)
    from private.ai_usage_ledger as usage
    where usage.professor_id = p_professor_id
      and usage.reserved_at >= pg_catalog.now() - interval '24 hours'
  ) >= professor_daily_limit then
    raise exception
      using errcode = 'P0001',
            message = p_error_namespace || '_daily_limit';
  end if;

  if (
    select pg_catalog.count(*)
    from private.ai_usage_ledger as usage
    where usage.professor_id = p_professor_id
      and usage.reserved_at >= pg_catalog.now() - interval '1 hour'
  ) >= least(p_hourly_limit, hourly_ceiling) then
    raise exception
      using errcode = 'P0001',
            message = p_error_namespace || '_hourly_limit';
  end if;
end;
$$;

revoke all on function private.enforce_ai_usage_quota(uuid, integer, text)
  from public, anon, authenticated, service_role;

-- Include the primary key in the immutable analysis metadata boundary.
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

  if new.id is distinct from old.id
    or new.session_id is distinct from old.session_id
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
security definer
set search_path = ''
as $$
declare
  created_analysis public.session_analyses;
  pending_timeout constant interval := interval '10 minutes';
  objective_lock_key text;
begin
  if p_hourly_limit is null
    or p_hourly_limit < 1
    or p_hourly_limit > 100
  then
    raise exception
      using errcode = '22023',
            message = 'invalid_analysis_hourly_limit';
  end if;

  if p_session_id is null
    or p_pulse_id is null
    or p_professor_id is null
    or p_model is null
    or pg_catalog.char_length(pg_catalog.btrim(p_model)) not between 1 and 100
    or p_prompt_version is null
    or p_prompt_version < 1
    or p_response_count is null
    or p_response_count < 1
    or p_source_latest_response_at is null
    or p_source_latest_response_at > pg_catalog.now()
    or p_source_fingerprint is null
    or p_source_fingerprint !~ '^[0-9a-f]{64}$'
  then
    raise exception
      using errcode = '22023',
            message = 'invalid_analysis_metadata';
  end if;

  if not exists (
    select 1
    from public.profiles as profile
    where profile.id = p_professor_id
      and profile.role = 'professor'
  ) then
    raise exception
      using errcode = '42501',
            message = 'professor_role_required';
  end if;

  if not exists (
    select 1
    from public.sessions as session_row
    where session_row.id = p_session_id
      and session_row.professor_id = p_professor_id
  ) then
    raise exception
      using errcode = 'P0001',
            message = 'session_not_found';
  end if;

  if not exists (
    select 1
    from public.session_pulses as pulse
    where pulse.id = p_pulse_id
      and pulse.session_id = p_session_id
  ) then
    raise exception
      using errcode = 'P0001',
            message = 'pulse_not_found';
  end if;

  objective_lock_key := 'classsignal:analysis:pulse:' || p_pulse_id::text;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('classsignal:analysis:global', 837429)
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_professor_id::text, 837429)
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(objective_lock_key, 837429)
  );

  update public.session_analyses as analysis
  set
    status = 'failed',
    error_message =
      'La ejecución anterior no terminó y fue cerrada automáticamente.'
  where analysis.session_id = p_session_id
    and analysis.pulse_id = p_pulse_id
    and analysis.professor_id = p_professor_id
    and analysis.status = 'pending'
    and analysis.created_at <= pg_catalog.now() - pending_timeout;

  if exists (
    select 1
    from public.session_analyses as analysis
    where analysis.pulse_id = p_pulse_id
      and analysis.professor_id = p_professor_id
      and analysis.status = 'completed'
      and analysis.model = p_model
      and analysis.prompt_version = p_prompt_version
      and analysis.source_fingerprint = p_source_fingerprint
  ) then
    raise exception
      using errcode = '23505',
            message = 'analysis_cached';
  end if;

  if exists (
    select 1
    from public.session_analyses as analysis
    where analysis.pulse_id = p_pulse_id
      and analysis.professor_id = p_professor_id
      and analysis.status = 'pending'
  ) then
    raise exception
      using errcode = '23505',
            message = 'analysis_in_progress';
  end if;

  perform private.enforce_ai_usage_quota(
    p_professor_id,
    p_hourly_limit,
    'analysis'
  );

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

comment on function public.create_session_analysis(
  uuid, uuid, uuid, text, smallint, integer, timestamptz, text, integer
) is 'Returns cache/in-progress conflicts before atomically quota-checking and reserving one analysis in the private usage ledger.';

create or replace function public.finalize_session_analysis(
  p_analysis_id uuid,
  p_professor_id uuid,
  p_status text,
  p_result jsonb,
  p_error_message text,
  p_telemetry jsonb
)
returns public.session_analyses
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.session_analyses;
  finalized public.session_analyses;
  telemetry jsonb := coalesce(p_telemetry, '{}'::jsonb);
  objective_lock_key text;
begin
  if p_status is null
    or p_status not in ('completed', 'failed')
    or pg_catalog.jsonb_typeof(telemetry) <> 'object'
    or (
      p_status = 'completed'
      and (
        p_result is null
        or pg_catalog.jsonb_typeof(p_result) <> 'object'
        or p_error_message is not null
      )
    )
    or (
      p_status = 'failed'
      and (
        p_result is not null
        or p_error_message is null
        or pg_catalog.char_length(pg_catalog.btrim(p_error_message)) not between 1 and 500
      )
    )
  then
    raise exception
      using errcode = '22023',
            message = 'invalid_analysis_terminal_state';
  end if;

  select analysis.*
  into target
  from public.session_analyses as analysis
  where analysis.id = p_analysis_id
    and analysis.professor_id = p_professor_id;

  if not found then
    raise exception
      using errcode = 'P0001',
            message = 'analysis_not_found';
  end if;

  objective_lock_key := 'classsignal:analysis:pulse:' || target.pulse_id::text;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(objective_lock_key, 837429)
  );

  update public.session_analyses as analysis
  set
    status = p_status,
    result = p_result,
    error_message = p_error_message,
    input_tokens = (telemetry ->> 'input_tokens')::integer,
    cached_input_tokens = (telemetry ->> 'cached_input_tokens')::integer,
    output_tokens = (telemetry ->> 'output_tokens')::integer,
    reasoning_tokens = (telemetry ->> 'reasoning_tokens')::integer,
    total_tokens = (telemetry ->> 'total_tokens')::integer,
    estimated_cost_usd = (telemetry ->> 'estimated_cost_usd')::numeric,
    pricing_version = nullif(
      pg_catalog.btrim(telemetry ->> 'pricing_version'),
      ''
    ),
    duration_ms = (telemetry ->> 'duration_ms')::integer,
    provider_request_id = nullif(
      pg_catalog.btrim(telemetry ->> 'provider_request_id'),
      ''
    ),
    provider_response_id = nullif(
      pg_catalog.btrim(telemetry ->> 'provider_response_id'),
      ''
    )
  where analysis.id = p_analysis_id
    and analysis.professor_id = p_professor_id
    and analysis.status = 'pending'
  returning analysis.* into finalized;

  if not found then
    raise exception
      using errcode = 'P0001',
            message = 'analysis_not_pending';
  end if;

  return finalized;
end;
$$;

revoke all on function public.finalize_session_analysis(
  uuid, uuid, text, jsonb, text, jsonb
) from public, anon, authenticated, service_role;
grant execute on function public.finalize_session_analysis(
  uuid, uuid, text, jsonb, text, jsonb
) to service_role;

comment on function public.finalize_session_analysis(
  uuid, uuid, text, jsonb, text, jsonb
) is 'Performs the only permitted terminal transition for a pending session analysis.';

create or replace function public.create_session_ai_artifact(
  p_session_id uuid,
  p_pulse_id uuid,
  p_professor_id uuid,
  p_kind text,
  p_model text,
  p_reasoning_effort text,
  p_prompt_version smallint,
  p_source_fingerprint text,
  p_source_analysis_id uuid,
  p_concept_index smallint,
  p_force_regenerate boolean,
  p_hourly_limit integer,
  p_source_captured_at timestamptz default pg_catalog.now()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  pending_timeout constant interval := interval '10 minutes';
  objective_lock_key text;
  cached_artifact public.session_ai_artifacts;
  pending_artifact public.session_ai_artifacts;
  created_artifact public.session_ai_artifacts;
begin
  if p_hourly_limit is null or p_hourly_limit < 1 or p_hourly_limit > 100 then
    raise exception
      using errcode = '22023',
            message = 'invalid_artifact_hourly_limit';
  end if;

  if p_kind is null
    or p_kind not in ('publication_draft', 'micro_intervention')
  then
    raise exception
      using errcode = '22023',
            message = 'invalid_artifact_kind';
  end if;

  if p_source_captured_at is null then
    raise exception
      using errcode = '22023',
            message = 'invalid_source_capture_time';
  end if;

  if p_model is null
    or pg_catalog.char_length(pg_catalog.btrim(p_model)) not between 1 and 100
    or p_reasoning_effort is null
    or p_reasoning_effort not in ('low', 'medium', 'high', 'xhigh')
    or p_prompt_version is null
    or p_prompt_version < 1
    or p_source_fingerprint is null
    or p_source_fingerprint !~ '^[0-9a-f]{64}$'
  then
    raise exception
      using errcode = '22023',
            message = 'invalid_artifact_metadata';
  end if;

  if p_kind = 'publication_draft' and (
    p_pulse_id is not null
    or p_source_analysis_id is not null
    or p_concept_index is not null
  ) then
    raise exception
      using errcode = '22023',
            message = 'invalid_publication_artifact_target';
  end if;

  if p_kind = 'micro_intervention' and (
    p_pulse_id is null
    or p_source_analysis_id is null
    or p_concept_index is null
    or p_concept_index not between 0 and 9
  ) then
    raise exception
      using errcode = '22023',
            message = 'invalid_intervention_artifact_target';
  end if;

  if not exists (
    select 1
    from public.profiles as profile
    where profile.id = p_professor_id
      and profile.role = 'professor'
  ) then
    raise exception
      using errcode = '42501',
            message = 'professor_role_required';
  end if;

  if not exists (
    select 1
    from public.sessions as session_row
    where session_row.id = p_session_id
      and session_row.professor_id = p_professor_id
  ) then
    raise exception
      using errcode = 'P0001',
            message = 'session_not_found';
  end if;

  if p_kind = 'micro_intervention' then
    if not exists (
      select 1
      from public.session_pulses as pulse
      where pulse.id = p_pulse_id
        and pulse.session_id = p_session_id
    ) then
      raise exception
        using errcode = 'P0001',
              message = 'pulse_not_found';
    end if;

    if not exists (
      select 1
      from public.session_analyses as analysis
      where analysis.id = p_source_analysis_id
        and analysis.pulse_id = p_pulse_id
        and analysis.session_id = p_session_id
        and analysis.professor_id = p_professor_id
        and analysis.status = 'completed'
        and pg_catalog.jsonb_typeof(analysis.result -> 'concepts') = 'array'
        and p_concept_index < pg_catalog.jsonb_array_length(
          analysis.result -> 'concepts'
        )
    ) then
      raise exception
        using errcode = 'P0001',
              message = 'source_analysis_not_found';
    end if;
  end if;

  objective_lock_key := case
    when p_kind = 'publication_draft' then
      'classsignal:artifact:publication:' || p_session_id::text
    else
      'classsignal:artifact:intervention:' || p_pulse_id::text || ':'
        || p_source_analysis_id::text || ':' || p_concept_index::text
  end;

  -- All paid-work reservations take locks in the same order.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('classsignal:analysis:global', 837429)
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_professor_id::text, 837429)
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(objective_lock_key, 837429)
  );

  update public.session_ai_artifacts as artifact
  set
    status = 'failed',
    error_code = 'pending_timeout',
    error_message =
      'La generación anterior no terminó y fue cerrada automáticamente.'
  where artifact.session_id = p_session_id
    and artifact.professor_id = p_professor_id
    and artifact.kind = p_kind
    and artifact.pulse_id is not distinct from p_pulse_id
    and artifact.source_analysis_id is not distinct from p_source_analysis_id
    and artifact.concept_index is not distinct from p_concept_index
    and artifact.status = 'pending'
    and artifact.created_at <= pg_catalog.now() - pending_timeout;

  if not coalesce(p_force_regenerate, false) then
    select artifact.*
    into cached_artifact
    from public.session_ai_artifacts as artifact
    where artifact.session_id = p_session_id
      and artifact.professor_id = p_professor_id
      and artifact.kind = p_kind
      and artifact.pulse_id is not distinct from p_pulse_id
      and artifact.source_analysis_id is not distinct from p_source_analysis_id
      and artifact.concept_index is not distinct from p_concept_index
      and artifact.status = 'completed'
      and artifact.model = p_model
      and artifact.reasoning_effort = p_reasoning_effort
      and artifact.prompt_version = p_prompt_version
      and artifact.source_fingerprint = p_source_fingerprint
    order by artifact.created_at desc, artifact.id desc
    limit 1;

    if found then
      return pg_catalog.jsonb_build_object(
        'outcome', 'cached',
        'artifact', pg_catalog.to_jsonb(cached_artifact)
      );
    end if;
  end if;

  select artifact.*
  into pending_artifact
  from public.session_ai_artifacts as artifact
  where artifact.session_id = p_session_id
    and artifact.professor_id = p_professor_id
    and artifact.kind = p_kind
    and artifact.pulse_id is not distinct from p_pulse_id
    and artifact.source_analysis_id is not distinct from p_source_analysis_id
    and artifact.concept_index is not distinct from p_concept_index
    and artifact.status = 'pending'
  order by artifact.created_at desc, artifact.id desc
  limit 1;

  if found then
    return pg_catalog.jsonb_build_object(
      'outcome', 'in_progress',
      'artifact', pg_catalog.to_jsonb(pending_artifact)
    );
  end if;

  perform private.enforce_ai_usage_quota(
    p_professor_id,
    p_hourly_limit,
    'artifact'
  );

  insert into public.session_ai_artifacts (
    professor_id,
    session_id,
    pulse_id,
    source_analysis_id,
    concept_index,
    kind,
    model,
    reasoning_effort,
    prompt_version,
    source_fingerprint,
    source_captured_at
  ) values (
    p_professor_id,
    p_session_id,
    p_pulse_id,
    p_source_analysis_id,
    p_concept_index,
    p_kind,
    p_model,
    p_reasoning_effort,
    p_prompt_version,
    p_source_fingerprint,
    least(
      p_source_captured_at,
      pg_catalog.transaction_timestamp()
    )
  )
  returning * into created_artifact;

  return pg_catalog.jsonb_build_object(
    'outcome', 'created',
    'artifact', pg_catalog.to_jsonb(created_artifact)
  );
end;
$$;

revoke all on function public.create_session_ai_artifact(
  uuid, uuid, uuid, text, text, text, smallint, text, uuid, smallint,
  boolean, integer, timestamptz
) from public, anon, authenticated, service_role;
grant execute on function public.create_session_ai_artifact(
  uuid, uuid, uuid, text, text, text, smallint, text, uuid, smallint,
  boolean, integer, timestamptz
) to service_role;

comment on function public.create_session_ai_artifact(
  uuid, uuid, uuid, text, text, text, smallint, text, uuid, smallint,
  boolean, integer, timestamptz
) is 'Returns cached/in-progress work or atomically quota-checks and reserves one artifact in the private usage ledger.';

-- This remains useful as a conservative application-side invalidation marker,
-- but timestamps cannot prove which rows a concurrent PostgreSQL transaction
-- made visible. Exact freshness must continue to use source fingerprints and a
-- new source read; this column is not a snapshot or commit boundary.
comment on column public.session_ai_artifacts.source_captured_at is
  'Conservative Edge request-start watermark clamped to the database transaction clock; not a PostgreSQL snapshot or proof that concurrent source rows were observed.';

-- Reads remain available to the trusted Edge clients and professor RLS policy,
-- but all server-side writes must pass through the invariant-preserving RPCs.
revoke all privileges on table public.session_analyses from service_role;
grant select on table public.session_analyses to service_role;

revoke all privileges on table public.session_ai_artifacts from service_role;
grant select on table public.session_ai_artifacts to service_role;
