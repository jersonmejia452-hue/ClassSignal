-- Add auditable OpenAI usage, bounded paid work, and a server-only path for
-- anonymous classroom submissions. The public browser no longer inserts into
-- responses directly; it calls the submit-response Edge Function instead.

-- ---------------------------------------------------------------------------
-- Analysis telemetry and cost controls
-- ---------------------------------------------------------------------------

alter table public.session_analyses
  add column input_tokens integer,
  add column cached_input_tokens integer,
  add column output_tokens integer,
  add column reasoning_tokens integer,
  add column total_tokens integer,
  add column estimated_cost_usd numeric(12, 6),
  add column pricing_version text,
  add column duration_ms integer,
  add column provider_request_id text,
  add column provider_response_id text,
  add constraint session_analyses_input_tokens_valid check (
    input_tokens is null or input_tokens between 0 and 10000000
  ),
  add constraint session_analyses_cached_input_tokens_valid check (
    cached_input_tokens is null
    or cached_input_tokens between 0 and coalesce(input_tokens, 10000000)
  ),
  add constraint session_analyses_output_tokens_valid check (
    output_tokens is null or output_tokens between 0 and 10000000
  ),
  add constraint session_analyses_reasoning_tokens_valid check (
    reasoning_tokens is null
    or reasoning_tokens between 0 and coalesce(output_tokens, 10000000)
  ),
  add constraint session_analyses_total_tokens_valid check (
    total_tokens is null or total_tokens between 0 and 20000000
  ),
  add constraint session_analyses_estimated_cost_valid check (
    estimated_cost_usd is null
    or estimated_cost_usd between 0 and 100
  ),
  add constraint session_analyses_pricing_version_length check (
    pricing_version is null
    or char_length(btrim(pricing_version)) between 1 and 100
  ),
  add constraint session_analyses_duration_valid check (
    duration_ms is null or duration_ms between 0 and 600000
  ),
  add constraint session_analyses_provider_request_id_length check (
    provider_request_id is null
    or char_length(btrim(provider_request_id)) between 1 and 200
  ),
  add constraint session_analyses_provider_response_id_length check (
    provider_response_id is null
    or char_length(btrim(provider_response_id)) between 1 and 200
  ),
  add constraint session_analyses_pending_has_no_telemetry check (
    status <> 'pending'
    or (
      input_tokens is null
      and cached_input_tokens is null
      and output_tokens is null
      and reasoning_tokens is null
      and total_tokens is null
      and estimated_cost_usd is null
      and pricing_version is null
      and duration_ms is null
      and provider_request_id is null
      and provider_response_id is null
    )
  );

comment on column public.session_analyses.estimated_cost_usd is
  'Estimated historical cost using the Luna token prices captured by the Edge Function at request time.';
comment on column public.session_analyses.provider_request_id is
  'OpenAI x-request-id response header, retained for support and request tracing.';
comment on column public.session_analyses.provider_response_id is
  'OpenAI Responses API response object id.';

-- Supports the global rolling-day quota without scanning the complete table.
create index session_analyses_created_at_idx
  on public.session_analyses (created_at desc);

-- Keep the existing RPC contract, but add conservative rolling quotas. A
-- global advisory lock serializes the global check, and the professor lock
-- serializes the account-level checks. Cached reads do not create rows and
-- therefore do not consume quota.
create or replace function public.create_session_analysis(
  p_session_id uuid,
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
    professor_id,
    model,
    prompt_version,
    response_count,
    source_latest_response_at,
    source_fingerprint
  ) values (
    p_session_id,
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
  uuid, uuid, text, smallint, integer, timestamptz, text, integer
) from public, anon, authenticated, service_role;

grant execute on function public.create_session_analysis(
  uuid, uuid, text, smallint, integer, timestamptz, text, integer
) to service_role;

comment on function public.create_session_analysis(
  uuid, uuid, text, smallint, integer, timestamptz, text, integer
) is 'Atomically enforces hourly, professor rolling-day, and global rolling-day analysis quotas.';

-- ---------------------------------------------------------------------------
-- Protected anonymous response submission
-- ---------------------------------------------------------------------------

create table private.response_submission_buckets (
  session_id uuid not null
    references public.sessions (id) on delete cascade,
  network_fingerprint text not null,
  window_started_at timestamptz not null,
  attempts integer not null default 1,
  primary key (session_id, network_fingerprint, window_started_at),
  constraint response_submission_fingerprint_format check (
    network_fingerprint ~ '^[0-9a-f]{64}$'
  ),
  constraint response_submission_attempts_positive check (
    attempts between 1 and 10000
  )
);

comment on table private.response_submission_buckets is
  'Short-lived, one-way network buckets used only to bound anonymous response abuse.';

revoke all on table private.response_submission_buckets
  from public, anon, authenticated, service_role;

-- This RPC is intentionally exposed through PostgREST only to service_role.
-- The public Edge Function validates its body and calls it with the server-only
-- credential. Row locking makes active-state, capacity, and rate checks atomic.
create or replace function public.submit_student_response_server(
  p_session_id uuid,
  p_anonymous_id uuid,
  p_status text,
  p_question_text text,
  p_network_fingerprint text
)
returns uuid
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

  normalized_question := nullif(btrim(p_question_text), '');
  if normalized_question is not null
    and char_length(normalized_question) > 1000
  then
    raise exception
      using errcode = '22023',
            message = 'invalid_question_text';
  end if;

  select session_row.is_active
  into session_is_active
  from public.sessions as session_row
  where session_row.id = p_session_id
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

  current_window := pg_catalog.date_bin(
    interval '15 minutes',
    pg_catalog.now(),
    timestamptz '2001-01-01 00:00:00+00'
  );

  delete from private.response_submission_buckets as bucket
  where bucket.window_started_at < pg_catalog.now() - interval '1 day';

  insert into private.response_submission_buckets (
    session_id,
    network_fingerprint,
    window_started_at,
    attempts
  ) values (
    p_session_id,
    p_network_fingerprint,
    current_window,
    1
  )
  on conflict (session_id, network_fingerprint, window_started_at)
  do update set attempts = private.response_submission_buckets.attempts + 1
  returning attempts into current_attempts;

  if current_attempts > 80 then
    raise exception
      using errcode = 'P0001',
            message = 'response_rate_limit';
  end if;

  if (
    select count(*)
    from public.responses as response_row
    where response_row.session_id = p_session_id
  ) >= 500 then
    raise exception
      using errcode = 'P0001',
            message = 'session_response_limit';
  end if;

  insert into public.responses (
    session_id,
    anonymous_id,
    status,
    question_text
  ) values (
    p_session_id,
    p_anonymous_id,
    p_status,
    normalized_question
  )
  returning id into created_response_id;

  return created_response_id;
end;
$$;

revoke all on function public.submit_student_response_server(
  uuid, uuid, text, text, text
) from public, anon, authenticated, service_role;
grant execute on function public.submit_student_response_server(
  uuid, uuid, text, text, text
) to service_role;

comment on function public.submit_student_response_server(
  uuid, uuid, text, text, text
) is 'Server-only atomic submission for the unauthenticated student Edge Function.';

-- Remove the browser's former direct INSERT path. Professor SELECT and
-- Realtime authorization remain unchanged.
drop policy if exists responses_insert_into_active_session
  on public.responses;
revoke insert (session_id, anonymous_id, status, question_text)
  on table public.responses from anon;
revoke insert on table public.responses from anon;
revoke execute on function private.is_session_active(uuid) from anon;
drop function if exists private.is_session_active(uuid);
