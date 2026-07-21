-- Server-generated publication drafts and micro-interventions. The browser may
-- read only artifacts owned by the signed-in professor; creation and terminal
-- transitions are reserved for the authenticated Edge Function service client.

-- A redundant composite key lets the artifact FK prove, in one declarative
-- constraint, that a micro-intervention's analysis, pulse, session, and owner
-- all describe the same immutable analysis row.
alter table public.session_analyses
  add constraint session_analyses_artifact_source_key
  unique (id, pulse_id, session_id, professor_id);

create table public.session_ai_artifacts (
  id uuid primary key default gen_random_uuid(),
  professor_id uuid not null
    references auth.users (id) on delete cascade,
  session_id uuid not null,
  pulse_id uuid,
  source_analysis_id uuid,
  concept_index smallint,
  kind text not null,
  status text not null default 'pending',
  model text not null,
  reasoning_effort text not null,
  prompt_version smallint not null,
  source_fingerprint text not null,
  source_captured_at timestamptz not null default now(),
  result jsonb,
  error_code text,
  error_message text,
  input_tokens integer,
  cached_input_tokens integer,
  output_tokens integer,
  reasoning_tokens integer,
  total_tokens integer,
  estimated_cost_usd numeric(12, 6),
  pricing_version text,
  duration_ms integer,
  provider_request_id text,
  provider_response_id text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,

  constraint session_ai_artifacts_session_owner_fkey
    foreign key (session_id, professor_id)
    references public.sessions (id, professor_id)
    on delete cascade,
  constraint session_ai_artifacts_pulse_session_fkey
    foreign key (pulse_id, session_id)
    references public.session_pulses (id, session_id)
    on delete cascade,
  constraint session_ai_artifacts_analysis_source_fkey
    foreign key (
      source_analysis_id,
      pulse_id,
      session_id,
      professor_id
    )
    references public.session_analyses (
      id,
      pulse_id,
      session_id,
      professor_id
    )
    on delete cascade,
  constraint session_ai_artifacts_kind_allowed check (
    kind in ('publication_draft', 'micro_intervention')
  ),
  constraint session_ai_artifacts_status_allowed check (
    status in ('pending', 'completed', 'failed')
  ),
  constraint session_ai_artifacts_target_consistency check (
    (
      kind = 'publication_draft'
      and pulse_id is null
      and source_analysis_id is null
      and concept_index is null
    )
    or (
      kind = 'micro_intervention'
      and pulse_id is not null
      and source_analysis_id is not null
      and concept_index is not null
    )
  ),
  constraint session_ai_artifacts_concept_index_range check (
    concept_index is null or concept_index between 0 and 9
  ),
  constraint session_ai_artifacts_model_length check (
    char_length(btrim(model)) between 1 and 100
  ),
  constraint session_ai_artifacts_reasoning_effort_allowed check (
    reasoning_effort in ('low', 'medium', 'high', 'xhigh')
  ),
  constraint session_ai_artifacts_prompt_version_positive check (
    prompt_version > 0
  ),
  constraint session_ai_artifacts_source_fingerprint_format check (
    source_fingerprint ~ '^[0-9a-f]{64}$'
  ),
  constraint session_ai_artifacts_result_object check (
    result is null or jsonb_typeof(result) = 'object'
  ),
  constraint session_ai_artifacts_result_size check (
    result is null or octet_length(result::text) <= 65536
  ),
  constraint session_ai_artifacts_error_code_format check (
    error_code is null or error_code ~ '^[a-z][a-z0-9_]{0,63}$'
  ),
  constraint session_ai_artifacts_error_message_length check (
    error_message is null
    or char_length(btrim(error_message)) between 1 and 500
  ),
  constraint session_ai_artifacts_input_tokens_valid check (
    input_tokens is null or input_tokens between 0 and 10000000
  ),
  constraint session_ai_artifacts_cached_input_tokens_valid check (
    cached_input_tokens is null
    or (
      input_tokens is not null
      and cached_input_tokens between 0 and input_tokens
    )
  ),
  constraint session_ai_artifacts_output_tokens_valid check (
    output_tokens is null or output_tokens between 0 and 10000000
  ),
  constraint session_ai_artifacts_reasoning_tokens_valid check (
    reasoning_tokens is null
    or (
      output_tokens is not null
      and reasoning_tokens between 0 and output_tokens
    )
  ),
  constraint session_ai_artifacts_total_tokens_valid check (
    total_tokens is null
    or (
      input_tokens is not null
      and output_tokens is not null
      and total_tokens = input_tokens + output_tokens
      and total_tokens <= 20000000
    )
  ),
  constraint session_ai_artifacts_estimated_cost_valid check (
    estimated_cost_usd is null
    or estimated_cost_usd between 0 and 100
  ),
  constraint session_ai_artifacts_pricing_version_length check (
    pricing_version is null
    or char_length(btrim(pricing_version)) between 1 and 100
  ),
  constraint session_ai_artifacts_duration_valid check (
    duration_ms is null or duration_ms between 0 and 600000
  ),
  constraint session_ai_artifacts_provider_request_id_length check (
    provider_request_id is null
    or char_length(btrim(provider_request_id)) between 1 and 200
  ),
  constraint session_ai_artifacts_provider_response_id_length check (
    provider_response_id is null
    or char_length(btrim(provider_response_id)) between 1 and 200
  ),
  constraint session_ai_artifacts_state_consistency check (
    (
      status = 'pending'
      and result is null
      and error_code is null
      and error_message is null
      and input_tokens is null
      and cached_input_tokens is null
      and output_tokens is null
      and reasoning_tokens is null
      and total_tokens is null
      and estimated_cost_usd is null
      and pricing_version is null
      and duration_ms is null
      and provider_request_id is null
      and provider_response_id is null
      and completed_at is null
    )
    or (
      status = 'completed'
      and result is not null
      and error_code is null
      and error_message is null
      and completed_at is not null
    )
    or (
      status = 'failed'
      and result is null
      and error_code is not null
      and error_message is not null
      and completed_at is not null
    )
  ),
  constraint session_ai_artifacts_completion_time_order check (
    completed_at is null or completed_at >= created_at
  ),
  constraint session_ai_artifacts_source_capture_order check (
    source_captured_at <= created_at
  )
);

comment on table public.session_ai_artifacts is
  'Immutable server-generated history of AI publication drafts and micro-interventions.';
comment on column public.session_ai_artifacts.source_fingerprint is
  'SHA-256 of the bounded, canonical, identifier-free academic sources used for this artifact.';
comment on column public.session_ai_artifacts.source_captured_at is
  'Request-start boundary used by the browser to conservatively invalidate artifacts when sources change during generation.';
comment on column public.session_ai_artifacts.source_analysis_id is
  'Completed confusion-map analysis that supplied the selected micro-intervention concept.';
comment on column public.session_ai_artifacts.concept_index is
  'Zero-based index of the immutable concept inside source_analysis_id.';

-- History, quota, ownership-FK, and pulse-FK access paths.
create index session_ai_artifacts_session_owner_history_idx
  on public.session_ai_artifacts (
    session_id,
    professor_id,
    kind,
    created_at desc
  );

create index session_ai_artifacts_professor_created_at_idx
  on public.session_ai_artifacts (professor_id, created_at desc);

create index session_ai_artifacts_created_at_idx
  on public.session_ai_artifacts (created_at desc);

create index session_ai_artifacts_pulse_history_idx
  on public.session_ai_artifacts (
    pulse_id,
    session_id,
    kind,
    created_at desc
  )
  where pulse_id is not null;

create index session_ai_artifacts_analysis_source_idx
  on public.session_ai_artifacts (
    source_analysis_id,
    pulse_id,
    session_id,
    professor_id
  )
  where source_analysis_id is not null;

-- Completed cache entries are deliberately non-unique. Explicit regeneration
-- creates another immutable terminal row with the same source fingerprint.
create index session_ai_artifacts_publication_cache_idx
  on public.session_ai_artifacts (
    session_id,
    source_fingerprint,
    model,
    reasoning_effort,
    prompt_version,
    created_at desc
  )
  where kind = 'publication_draft' and status = 'completed';

create index session_ai_artifacts_intervention_cache_idx
  on public.session_ai_artifacts (
    pulse_id,
    source_analysis_id,
    concept_index,
    source_fingerprint,
    model,
    reasoning_effort,
    prompt_version,
    created_at desc
  )
  where kind = 'micro_intervention' and status = 'completed';

-- One active execution per logical target prevents duplicate paid work while
-- allowing unrelated concepts to be prepared concurrently.
create unique index session_ai_artifacts_one_pending_publication_idx
  on public.session_ai_artifacts (session_id, kind)
  where kind = 'publication_draft' and status = 'pending';

create unique index session_ai_artifacts_one_pending_intervention_idx
  on public.session_ai_artifacts (
    pulse_id,
    source_analysis_id,
    concept_index,
    kind
  )
  where kind = 'micro_intervention' and status = 'pending';

create or replace function private.enforce_session_ai_artifact_state()
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
              message = 'A session AI artifact must start as pending';
    end if;

    new.created_at := pg_catalog.now();
    new.completed_at := null;
    return new;
  end if;

  if old.status <> 'pending' then
    raise exception
      using errcode = '23514',
            message = 'A terminal session AI artifact is immutable';
  end if;

  if new.status not in ('completed', 'failed') then
    raise exception
      using errcode = '23514',
            message = 'A pending session AI artifact must become completed or failed';
  end if;

  if new.id is distinct from old.id
    or new.professor_id is distinct from old.professor_id
    or new.session_id is distinct from old.session_id
    or new.pulse_id is distinct from old.pulse_id
    or new.source_analysis_id is distinct from old.source_analysis_id
    or new.concept_index is distinct from old.concept_index
    or new.kind is distinct from old.kind
    or new.model is distinct from old.model
    or new.reasoning_effort is distinct from old.reasoning_effort
    or new.prompt_version is distinct from old.prompt_version
    or new.source_fingerprint is distinct from old.source_fingerprint
    or new.source_captured_at is distinct from old.source_captured_at
    or new.created_at is distinct from old.created_at
  then
    raise exception
      using errcode = '23514',
            message = 'Session AI artifact source metadata is immutable';
  end if;

  new.completed_at := pg_catalog.now();
  return new;
end;
$$;

revoke all on function private.enforce_session_ai_artifact_state()
  from public, anon, authenticated, service_role;

create trigger session_ai_artifacts_enforce_state
before insert or update on public.session_ai_artifacts
for each row
execute function private.enforce_session_ai_artifact_state();

alter table public.session_ai_artifacts enable row level security;

create policy session_ai_artifacts_select_for_professor
on public.session_ai_artifacts
for select
to authenticated
using (
  professor_id = (select auth.uid())
  and private.current_user_has_role('professor')
);

revoke all privileges on table public.session_ai_artifacts
  from public, anon, authenticated, service_role;
grant select on table public.session_ai_artifacts to authenticated;
grant select, insert, update on table public.session_ai_artifacts
  to service_role;

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
  hourly_ceiling constant integer := 12;
  professor_daily_limit constant integer := 20;
  global_daily_limit constant integer := 200;
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

  -- Keep this order identical for every paid-work reservation. The global and
  -- professor keys intentionally match create_session_analysis.
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

  -- A worker can complete between the first cache lookup and the pending
  -- lookup because terminal updates do not take this RPC's advisory lock.
  -- Recheck after observing no pending row so that normal requests never
  -- reserve duplicate paid work in that completion window.
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

  if (
    select count(*)
    from (
      select analysis.created_at
      from public.session_analyses as analysis
      union all
      select artifact.created_at
      from public.session_ai_artifacts as artifact
    ) as paid_work
    where paid_work.created_at >= pg_catalog.now() - interval '24 hours'
  ) >= global_daily_limit then
    raise exception
      using errcode = 'P0001',
            message = 'artifact_global_limit';
  end if;

  if (
    select count(*)
    from (
      select analysis.professor_id, analysis.created_at
      from public.session_analyses as analysis
      union all
      select artifact.professor_id, artifact.created_at
      from public.session_ai_artifacts as artifact
    ) as paid_work
    where paid_work.professor_id = p_professor_id
      and paid_work.created_at >= pg_catalog.now() - interval '24 hours'
  ) >= professor_daily_limit then
    raise exception
      using errcode = 'P0001',
            message = 'artifact_daily_limit';
  end if;

  if (
    select count(*)
    from (
      select analysis.professor_id, analysis.created_at
      from public.session_analyses as analysis
      union all
      select artifact.professor_id, artifact.created_at
      from public.session_ai_artifacts as artifact
    ) as paid_work
    where paid_work.professor_id = p_professor_id
      and paid_work.created_at >= pg_catalog.now() - interval '1 hour'
  ) >= least(p_hourly_limit, hourly_ceiling) then
    raise exception
      using errcode = 'P0001',
            message = 'artifact_hourly_limit';
  end if;

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
      pg_catalog.now() - interval '5 seconds'
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
) is 'Atomically returns cached/in-progress work or reserves one quota-checked session AI artifact.';

-- Terminal transitions take the same objective lock as reservations. Without
-- this shared lock, a worker could complete a pending row between the cache
-- and pending checks while another request reserves duplicate paid work.
create or replace function public.finalize_session_ai_artifact(
  p_artifact_id uuid,
  p_professor_id uuid,
  p_status text,
  p_result jsonb,
  p_error_code text,
  p_error_message text,
  p_telemetry jsonb
)
returns public.session_ai_artifacts
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.session_ai_artifacts;
  finalized public.session_ai_artifacts;
  objective_lock_key text;
  telemetry jsonb := coalesce(p_telemetry, '{}'::jsonb);
begin
  if p_status not in ('completed', 'failed')
    or pg_catalog.jsonb_typeof(telemetry) <> 'object'
    or (
      p_status = 'completed'
      and (
        p_result is null
        or pg_catalog.jsonb_typeof(p_result) <> 'object'
        or p_error_code is not null
        or p_error_message is not null
      )
    )
    or (
      p_status = 'failed'
      and (
        p_result is not null
        or p_error_code is null
        or p_error_message is null
      )
    )
  then
    raise exception
      using errcode = '22023',
            message = 'invalid_artifact_terminal_state';
  end if;

  select artifact.*
  into target
  from public.session_ai_artifacts as artifact
  where artifact.id = p_artifact_id
    and artifact.professor_id = p_professor_id;

  if not found then
    raise exception
      using errcode = 'P0001',
            message = 'artifact_not_found';
  end if;

  objective_lock_key := case
    when target.kind = 'publication_draft' then
      'classsignal:artifact:publication:' || target.session_id::text
    else
      'classsignal:artifact:intervention:' || target.pulse_id::text || ':'
        || target.source_analysis_id::text || ':' || target.concept_index::text
  end;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(objective_lock_key, 837429)
  );

  update public.session_ai_artifacts as artifact
  set
    status = p_status,
    result = p_result,
    error_code = p_error_code,
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
  where artifact.id = p_artifact_id
    and artifact.professor_id = p_professor_id
    and artifact.status = 'pending'
  returning artifact.* into finalized;

  if not found then
    raise exception
      using errcode = 'P0001',
            message = 'artifact_not_pending';
  end if;

  return finalized;
end;
$$;

revoke all on function public.finalize_session_ai_artifact(
  uuid, uuid, text, jsonb, text, text, jsonb
) from public, anon, authenticated, service_role;
grant execute on function public.finalize_session_ai_artifact(
  uuid, uuid, text, jsonb, text, text, jsonb
) to service_role;

comment on function public.finalize_session_ai_artifact(
  uuid, uuid, text, jsonb, text, text, jsonb
) is 'Closes one pending artifact while serializing against reservations for the same objective.';

-- Keep the existing analysis contract while making all paid AI work share the
-- same hourly, professor-day, and global-day budgets.
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
  hourly_ceiling constant integer := 12;
  professor_daily_limit constant integer := 20;
  global_daily_limit constant integer := 200;
begin
  if p_hourly_limit is null
    or p_hourly_limit < 1
    or p_hourly_limit > 100
  then
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
    from (
      select analysis.created_at
      from public.session_analyses as analysis
      union all
      select artifact.created_at
      from public.session_ai_artifacts as artifact
    ) as paid_work
    where paid_work.created_at >= pg_catalog.now() - interval '24 hours'
  ) >= global_daily_limit then
    raise exception
      using errcode = 'P0001',
            message = 'analysis_global_limit';
  end if;

  if (
    select count(*)
    from (
      select analysis.professor_id, analysis.created_at
      from public.session_analyses as analysis
      union all
      select artifact.professor_id, artifact.created_at
      from public.session_ai_artifacts as artifact
    ) as paid_work
    where paid_work.professor_id = p_professor_id
      and paid_work.created_at >= pg_catalog.now() - interval '24 hours'
  ) >= professor_daily_limit then
    raise exception
      using errcode = 'P0001',
            message = 'analysis_daily_limit';
  end if;

  if (
    select count(*)
    from (
      select analysis.professor_id, analysis.created_at
      from public.session_analyses as analysis
      union all
      select artifact.professor_id, artifact.created_at
      from public.session_ai_artifacts as artifact
    ) as paid_work
    where paid_work.professor_id = p_professor_id
      and paid_work.created_at >= pg_catalog.now() - interval '1 hour'
  ) >= least(p_hourly_limit, hourly_ceiling) then
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

comment on function public.create_session_analysis(
  uuid, uuid, uuid, text, smallint, integer, timestamptz, text, integer
) is 'Atomically enforces shared AI hourly, professor rolling-day, and global rolling-day quotas before creating one pending analysis.';
