-- PostgreSQL parses LEAST as a conditional expression, so it cannot be
-- schema-qualified. Replace the v2 function with the portable expression.

create or replace function public.submit_student_response_server_v2(
  p_session_id uuid,
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
    where response_row.session_id = p_session_id
  ) >= 500 then
    return pg_catalog.jsonb_build_object('outcome', 'session_response_limit');
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
  on conflict (session_id, anonymous_id) do nothing
  returning id into created_response_id;

  if created_response_id is null then
    return pg_catalog.jsonb_build_object('outcome', 'duplicate_response');
  end if;

  return pg_catalog.jsonb_build_object(
    'outcome', 'accepted',
    'response_id', created_response_id
  );
end;
$$;
