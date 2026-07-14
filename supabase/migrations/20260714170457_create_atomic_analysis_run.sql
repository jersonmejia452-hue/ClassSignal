-- Serialize each professor's quota check and pending-row creation so concurrent
-- requests across different sessions cannot exceed the hourly paid-work limit.
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
begin
  if p_hourly_limit < 1 or p_hourly_limit > 100 then
    raise exception
      using errcode = '22023',
            message = 'invalid_analysis_hourly_limit';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_professor_id::text, 837429)
  );

  if (
    select count(*)
    from public.session_analyses as analysis
    where analysis.professor_id = p_professor_id
      and analysis.created_at >= pg_catalog.now() - interval '1 hour'
  ) >= p_hourly_limit then
    raise exception
      using errcode = 'P0001',
            message = 'analysis_rate_limit';
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
) is 'Atomically enforces the professor analysis quota and creates one pending run.';
