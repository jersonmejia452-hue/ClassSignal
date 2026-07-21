begin;

select no_plan();

-- ---------------------------------------------------------------------------
-- Private ledger shape and privilege boundary
-- ---------------------------------------------------------------------------

select has_table(
  'private',
  'ai_usage_ledger',
  'the private AI usage ledger exists'
);

select ok(
  (select relrowsecurity from pg_catalog.pg_class
   where oid = 'private.ai_usage_ledger'::regclass),
  'RLS is enabled as defense in depth on the private ledger'
);

select results_eq(
  $$
    select column_name::text
    from information_schema.columns
    where table_schema = 'private'
      and table_name = 'ai_usage_ledger'
    order by ordinal_position
  $$,
  $$
    values
      ('work_kind'::text),
      ('work_id'::text),
      ('professor_id'::text),
      ('reserved_at'::text)
  $$,
  'the ledger stores no session, student, prompt, or generated content'
);

select ok(
  not exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'private.ai_usage_ledger'::regclass
      and contype = 'f'
  ),
  'the ledger has no cascading foreign key'
);

select ok(
  not has_table_privilege('anon', 'private.ai_usage_ledger', 'SELECT')
  and not has_table_privilege(
    'authenticated', 'private.ai_usage_ledger', 'SELECT'
  )
  and not has_table_privilege(
    'service_role', 'private.ai_usage_ledger', 'SELECT'
  )
  and not has_table_privilege(
    'service_role', 'private.ai_usage_ledger', 'INSERT'
  )
  and not has_table_privilege(
    'service_role', 'private.ai_usage_ledger', 'UPDATE'
  )
  and not has_table_privilege(
    'service_role', 'private.ai_usage_ledger', 'DELETE'
  ),
  'browser and service roles cannot access the ledger directly'
);

select ok(
  has_table_privilege('service_role', 'public.session_analyses', 'SELECT')
  and not has_table_privilege(
    'service_role', 'public.session_analyses', 'INSERT'
  )
  and not has_table_privilege(
    'service_role', 'public.session_analyses', 'UPDATE'
  )
  and not has_table_privilege(
    'service_role', 'public.session_analyses', 'DELETE'
  ),
  'service_role cannot mutate analyses directly'
);

select ok(
  has_table_privilege(
    'service_role', 'public.session_ai_artifacts', 'SELECT'
  )
  and not has_table_privilege(
    'service_role', 'public.session_ai_artifacts', 'INSERT'
  )
  and not has_table_privilege(
    'service_role', 'public.session_ai_artifacts', 'UPDATE'
  )
  and not has_table_privilege(
    'service_role', 'public.session_ai_artifacts', 'DELETE'
  ),
  'service_role cannot mutate artifacts directly'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.finalize_session_analysis(uuid,uuid,text,jsonb,text,jsonb)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated',
    'public.finalize_session_analysis(uuid,uuid,text,jsonb,text,jsonb)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'anon',
    'public.finalize_session_analysis(uuid,uuid,text,jsonb,text,jsonb)',
    'EXECUTE'
  ),
  'only service_role can finalize an analysis'
);

select matches(
  pg_catalog.col_description(
    'public.session_ai_artifacts'::regclass,
    (
      select attnum
      from pg_catalog.pg_attribute
      where attrelid = 'public.session_ai_artifacts'::regclass
        and attname = 'source_captured_at'
    )
  ),
  'not a PostgreSQL snapshot',
  'source_captured_at does not claim transaction-snapshot causality'
);

-- ---------------------------------------------------------------------------
-- One professor, two paid-work reservations, and RPC-only finalization
-- ---------------------------------------------------------------------------

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) values (
  '00000000-0000-0000-0000-000000000000',
  '61000000-0000-4000-8000-000000000001',
  'authenticated',
  'authenticated',
  'ledger-professor@example.test',
  '',
  now(),
  '{}'::jsonb,
  '{}'::jsonb,
  now(),
  now(),
  '',
  '',
  '',
  ''
);

update public.profiles
set role = 'professor'
where id = '61000000-0000-4000-8000-000000000001';

insert into public.sessions (
  professor_id,
  code,
  title,
  subject,
  topic
) values (
  '61000000-0000-4000-8000-000000000001',
  'LDG901',
  'Ledger class one',
  'Mathematics',
  'Vectors'
);

select id as first_session_id
from public.sessions
where code = 'LDG901'
\gset

select id as first_pulse_id
from public.session_pulses
where session_id = :'first_session_id'
  and ordinal = 1
\gset

set local role service_role;

select throws_ok(
  format($test$
    insert into public.session_analyses (
      session_id, pulse_id, professor_id, model, prompt_version,
      response_count, source_latest_response_at, source_fingerprint
    ) values (
      %L::uuid, %L::uuid, '61000000-0000-4000-8000-000000000001',
      'gpt-5.6-luna', 1, 1, now(), %L
    )
  $test$, :'first_session_id', :'first_pulse_id', repeat('a', 64)),
  '42501',
  'permission denied for table session_analyses',
  'service_role direct analysis insertion is denied'
);

select (
  public.create_session_analysis(
    :'first_session_id'::uuid,
    :'first_pulse_id'::uuid,
    '61000000-0000-4000-8000-000000000001',
    'gpt-5.6-luna',
    1::smallint,
    1,
    now(),
    repeat('b', 64),
    100
  )
).id as analysis_id
\gset

select throws_ok(
  format(
    'update public.session_analyses set status = %L, error_message = %L where id = %L::uuid',
    'failed',
    'Direct finalization must be denied.',
    :'analysis_id'
  ),
  '42501',
  'permission denied for table session_analyses',
  'service_role direct analysis finalization is denied'
);

select is(
  (
    public.finalize_session_analysis(
      :'analysis_id'::uuid,
      '61000000-0000-4000-8000-000000000001',
      'failed',
      null,
      'Closed through the analysis terminal RPC.',
      '{}'::jsonb
    )
  ).status,
  'failed',
  'the analysis terminal RPC closes the pending row'
);

select (
  public.create_session_ai_artifact(
    :'first_session_id'::uuid,
    null::uuid,
    '61000000-0000-4000-8000-000000000001',
    'publication_draft',
    'gpt-5.6-luna',
    'medium',
    1::smallint,
    repeat('c', 64),
    null::uuid,
    null::smallint,
    false,
    100,
    now() + interval '1 day'
  ) #>> '{artifact,id}'
)::uuid as artifact_id
\gset

select throws_ok(
  format(
    'update public.session_ai_artifacts set status = %L, error_code = %L, error_message = %L where id = %L::uuid',
    'failed',
    'direct_write',
    'Direct finalization must be denied.',
    :'artifact_id'
  ),
  '42501',
  'permission denied for table session_ai_artifacts',
  'service_role direct artifact finalization is denied'
);

select is(
  (
    public.finalize_session_ai_artifact(
      :'artifact_id'::uuid,
      '61000000-0000-4000-8000-000000000001',
      'failed',
      null,
      'test_failure',
      'Closed through the artifact terminal RPC.',
      '{}'::jsonb
    )
  ).status,
  'failed',
  'the artifact terminal RPC closes the pending row'
);

reset role;

select is(
  (
    select source_captured_at <= created_at
    from public.session_ai_artifacts
    where id = :'artifact_id'
  ),
  true,
  'a future Edge timestamp is clamped to the database transaction clock'
);

select is(
  (
    select count(*)
    from private.ai_usage_ledger
    where professor_id = '61000000-0000-4000-8000-000000000001'
  ),
  2::bigint,
  'analysis and artifact reservations each create one ledger entry'
);

select throws_ok(
  format(
    'update private.ai_usage_ledger set reserved_at = now() where work_id = %L::uuid',
    :'analysis_id'
  ),
  '23514',
  'AI usage ledger rows are append-only',
  'ledger rows cannot be updated even by the migration owner'
);

select throws_ok(
  format(
    'delete from private.ai_usage_ledger where work_id = %L::uuid',
    :'artifact_id'
  ),
  '23514',
  'AI usage ledger rows are append-only',
  'ledger rows cannot be deleted even by the migration owner'
);

-- ---------------------------------------------------------------------------
-- Session deletion cannot reset professor or global rolling quotas
-- ---------------------------------------------------------------------------

delete from public.sessions where id = :'first_session_id';

select is(
  (select count(*) from public.session_analyses where id = :'analysis_id'),
  0::bigint,
  'class deletion still removes its analysis history'
);

select is(
  (select count(*) from public.session_ai_artifacts where id = :'artifact_id'),
  0::bigint,
  'class deletion still removes its artifact history'
);

select is(
  (
    select count(*)
    from private.ai_usage_ledger
    where professor_id = '61000000-0000-4000-8000-000000000001'
  ),
  2::bigint,
  'class deletion does not erase quota history'
);

insert into public.sessions (
  professor_id,
  code,
  title,
  subject,
  topic
) values (
  '61000000-0000-4000-8000-000000000001',
  'LDG902',
  'Ledger class two',
  'Mathematics',
  'Planes'
);

select id as second_session_id
from public.sessions
where code = 'LDG902'
\gset

select id as second_pulse_id
from public.session_pulses
where session_id = :'second_session_id'
  and ordinal = 1
\gset

set local role service_role;

select throws_ok(
  format($test$
    select public.create_session_analysis(
      %L::uuid,
      %L::uuid,
      '61000000-0000-4000-8000-000000000001',
      'gpt-5.6-luna',
      1::smallint,
      1,
      now(),
      %L,
      2
    )
  $test$, :'second_session_id', :'second_pulse_id', repeat('d', 64)),
  'P0001',
  'analysis_hourly_limit',
  'deleting the first class cannot reset the professor hourly quota'
);

reset role;

insert into private.ai_usage_ledger (
  work_kind,
  work_id,
  professor_id,
  reserved_at
)
select
  'analysis',
  gen_random_uuid(),
  '62000000-0000-4000-8000-000000000002',
  now()
from generate_series(1, 198);

set local role service_role;

select throws_ok(
  format($test$
    select public.create_session_analysis(
      %L::uuid,
      %L::uuid,
      '61000000-0000-4000-8000-000000000001',
      'gpt-5.6-luna',
      1::smallint,
      1,
      now(),
      %L,
      100
    )
  $test$, :'second_session_id', :'second_pulse_id', repeat('e', 64)),
  'P0001',
  'analysis_global_limit',
  'the global rolling-day quota is enforced from the independent ledger'
);

reset role;

select * from finish();
rollback;
