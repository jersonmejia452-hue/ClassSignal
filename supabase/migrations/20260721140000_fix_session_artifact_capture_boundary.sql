-- Keep the source boundary at the actual request start.
--
-- The original five-second backdating was safe but made artifacts generated
-- immediately after a fresh map or response appear stale before they could be
-- applied. The Edge Function supplies its request-start timestamp, and this
-- RPC still rejects future timestamps by clamping to the database clock.
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

  -- Keep the second exact-cache check as defense in depth. Terminal updates
  -- now share this objective lock through finalize_session_ai_artifact, so a
  -- worker cannot complete inside this reservation transaction.
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
      pg_catalog.now()
    )
  )
  returning * into created_artifact;

  return pg_catalog.jsonb_build_object(
    'outcome', 'created',
    'artifact', pg_catalog.to_jsonb(created_artifact)
  );
end;
$$;
