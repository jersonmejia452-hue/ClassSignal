begin;

select no_plan();

-- ---------------------------------------------------------------------------
-- Schema, constraints, indexes, RLS, and grants
-- ---------------------------------------------------------------------------

select has_table(
  'public',
  'session_ai_artifacts',
  'session_ai_artifacts exists'
);

select has_column(
  'public',
  'session_ai_artifacts',
  'source_analysis_id',
  'artifacts retain their source analysis'
);

select col_type_is(
  'public',
  'session_ai_artifacts',
  'concept_index',
  'smallint',
  'concept_index is a bounded small integer'
);

select col_not_null(
  'public',
  'session_ai_artifacts',
  'reasoning_effort',
  'reasoning effort is always recorded'
);

select col_not_null(
  'public',
  'session_ai_artifacts',
  'source_captured_at',
  'the conservative source-capture boundary is always recorded'
);

select col_not_null(
  'public',
  'session_ai_artifacts',
  'source_fingerprint',
  'every artifact records its source fingerprint'
);

select ok(
  exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.session_ai_artifacts'::regclass
      and conname = 'session_ai_artifacts_session_owner_fkey'
      and contype = 'f'
  ),
  'session and professor ownership has a composite foreign key'
);

select ok(
  exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.session_ai_artifacts'::regclass
      and conname = 'session_ai_artifacts_pulse_session_fkey'
      and contype = 'f'
  ),
  'pulse and session have a composite foreign key'
);

select ok(
  exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.session_ai_artifacts'::regclass
      and conname = 'session_ai_artifacts_analysis_source_fkey'
      and contype = 'f'
  ),
  'micro-intervention source analysis is tied to pulse, session, and owner'
);

select matches(
  pg_catalog.pg_get_constraintdef(oid),
  '65536',
  'artifact results are limited to 64 KiB'
)
from pg_catalog.pg_constraint
where conrelid = 'public.session_ai_artifacts'::regclass
  and conname = 'session_ai_artifacts_result_size';

select ok(
  not cache_index.indisunique,
  'publication cache history is intentionally non-unique'
)
from pg_catalog.pg_index as cache_index
join pg_catalog.pg_class as cache_class
  on cache_class.oid = cache_index.indexrelid
where cache_class.oid =
  'public.session_ai_artifacts_publication_cache_idx'::regclass;

select ok(
  not cache_index.indisunique,
  'micro-intervention cache history is intentionally non-unique'
)
from pg_catalog.pg_index as cache_index
join pg_catalog.pg_class as cache_class
  on cache_class.oid = cache_index.indexrelid
where cache_class.oid =
  'public.session_ai_artifacts_intervention_cache_idx'::regclass;

select ok(
  pending_index.indisunique and pending_index.indpred is not null,
  'publication pending target has a partial unique index'
)
from pg_catalog.pg_index as pending_index
join pg_catalog.pg_class as pending_class
  on pending_class.oid = pending_index.indexrelid
where pending_class.oid =
  'public.session_ai_artifacts_one_pending_publication_idx'::regclass;

select ok(
  pending_index.indisunique and pending_index.indpred is not null,
  'micro-intervention pending target has a partial unique index'
)
from pg_catalog.pg_index as pending_index
join pg_catalog.pg_class as pending_class
  on pending_class.oid = pending_index.indexrelid
where pending_class.oid =
  'public.session_ai_artifacts_one_pending_intervention_idx'::regclass;

select ok(
  relrowsecurity,
  'row-level security is enabled for session_ai_artifacts'
)
from pg_catalog.pg_class
where oid = 'public.session_ai_artifacts'::regclass;

select ok(
  exists (
    select 1
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'session_ai_artifacts'
      and policyname = 'session_ai_artifacts_select_for_professor'
      and cmd = 'SELECT'
  ),
  'artifacts expose only a professor SELECT policy'
);

select ok(
  has_table_privilege(
    'authenticated',
    'public.session_ai_artifacts',
    'SELECT'
  ),
  'authenticated can select artifacts through RLS'
);

select ok(
  not has_table_privilege(
    'authenticated',
    'public.session_ai_artifacts',
    'INSERT'
  )
  and not has_table_privilege(
    'authenticated',
    'public.session_ai_artifacts',
    'UPDATE'
  )
  and not has_table_privilege(
    'authenticated',
    'public.session_ai_artifacts',
    'DELETE'
  ),
  'authenticated cannot write artifacts directly'
);

select ok(
  not has_table_privilege('anon', 'public.session_ai_artifacts', 'SELECT'),
  'anonymous clients have no artifact table access'
);

select ok(
  has_table_privilege('service_role', 'public.session_ai_artifacts', 'SELECT')
  and not has_table_privilege(
    'service_role',
    'public.session_ai_artifacts',
    'INSERT'
  )
  and not has_table_privilege(
    'service_role',
    'public.session_ai_artifacts',
    'UPDATE'
  )
  and not has_table_privilege(
    'service_role',
    'public.session_ai_artifacts',
    'DELETE'
  ),
  'service_role reads artifacts but can mutate them only through RPCs'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.create_session_ai_artifact(uuid,uuid,uuid,text,text,text,smallint,text,uuid,smallint,boolean,integer,timestamptz)',
    'EXECUTE'
  ),
  'service_role can reserve an artifact'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.create_session_ai_artifact(uuid,uuid,uuid,text,text,text,smallint,text,uuid,smallint,boolean,integer,timestamptz)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'anon',
    'public.create_session_ai_artifact(uuid,uuid,uuid,text,text,text,smallint,text,uuid,smallint,boolean,integer,timestamptz)',
    'EXECUTE'
  ),
  'browser roles cannot reserve artifacts through the server RPC'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.finalize_session_ai_artifact(uuid,uuid,text,jsonb,text,text,jsonb)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated',
    'public.finalize_session_ai_artifact(uuid,uuid,text,jsonb,text,text,jsonb)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'anon',
    'public.finalize_session_ai_artifact(uuid,uuid,text,jsonb,text,text,jsonb)',
    'EXECUTE'
  ),
  'only the service role can finalize artifacts'
);

-- ---------------------------------------------------------------------------
-- Isolated accounts, sessions, pulses, and completed source analysis
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
) values
  (
    '00000000-0000-0000-0000-000000000000',
    '51000000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated', 'artifact-prof-a@example.test', '',
    now(), '{}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '52000000-0000-4000-8000-000000000002',
    'authenticated', 'authenticated', 'artifact-prof-b@example.test', '',
    now(), '{}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '53000000-0000-4000-8000-000000000003',
    'authenticated', 'authenticated', 'artifact-prof-c@example.test', '',
    now(), '{}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '54000000-0000-4000-8000-000000000004',
    'authenticated', 'authenticated', 'artifact-prof-d@example.test', '',
    now(), '{}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '55000000-0000-4000-8000-000000000005',
    'authenticated', 'authenticated', 'artifact-student@example.test', '',
    now(), '{}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''
  );

update public.profiles
set role = 'professor'
where id in (
  '51000000-0000-4000-8000-000000000001',
  '52000000-0000-4000-8000-000000000002',
  '53000000-0000-4000-8000-000000000003',
  '54000000-0000-4000-8000-000000000004'
);

insert into public.sessions (
  professor_id,
  code,
  title,
  subject,
  topic
) values
  (
    '51000000-0000-4000-8000-000000000001',
    'ATF234', 'Artifact class A', 'Mathematics', 'Fractions'
  ),
  (
    '52000000-0000-4000-8000-000000000002',
    'ATF235', 'Artifact class B', 'History', 'Primary sources'
  ),
  (
    '53000000-0000-4000-8000-000000000003',
    'ATF236', 'Artifact quota class C', 'Science', 'Energy'
  ),
  (
    '54000000-0000-4000-8000-000000000004',
    'ATF237', 'Artifact quota class D', 'Language', 'Arguments'
  );

select id as session_a_id
from public.sessions where code = 'ATF234'
\gset
select id as session_b_id
from public.sessions where code = 'ATF235'
\gset
select id as session_c_id
from public.sessions where code = 'ATF236'
\gset
select id as session_d_id
from public.sessions where code = 'ATF237'
\gset

select id as pulse_a_id
from public.session_pulses where session_id = :'session_a_id' and ordinal = 1
\gset
select id as pulse_b_id
from public.session_pulses where session_id = :'session_b_id' and ordinal = 1
\gset
select id as pulse_c_id
from public.session_pulses where session_id = :'session_c_id' and ordinal = 1
\gset
select id as pulse_d_id
from public.session_pulses where session_id = :'session_d_id' and ordinal = 1
\gset

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
  :'session_a_id',
  :'pulse_a_id',
  '51000000-0000-4000-8000-000000000001',
  'gpt-5.6-luna',
  1,
  1,
  now(),
  repeat('a', 64)
)
returning id as analysis_a_id
\gset

update public.session_analyses
set
  status = 'completed',
  result = jsonb_build_object(
    'overview', 'A bounded analysis fixture.',
    'concepts', jsonb_build_array(
      jsonb_build_object('concept', 'Equivalent fractions'),
      jsonb_build_object('concept', 'Common denominators')
    ),
    'recommendations', jsonb_build_array()
  )
where id = :'analysis_a_id';

-- One analysis owned by professor C is enough to exercise the combined hourly
-- budget when that professor asks for an artifact with a limit of one.
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
  :'session_c_id',
  :'pulse_c_id',
  '53000000-0000-4000-8000-000000000003',
  'gpt-5.6-luna',
  1,
  1,
  now(),
  repeat('c', 64)
);

-- ---------------------------------------------------------------------------
-- Type checks, state machine, cache, regeneration, and pending deduplication
-- ---------------------------------------------------------------------------

select throws_ok(
  format($test$
    insert into public.session_ai_artifacts (
      professor_id, session_id, kind, model, reasoning_effort,
      prompt_version, source_fingerprint
    ) values (
      '51000000-0000-4000-8000-000000000001', %L::uuid,
      'unknown_kind', 'gpt-5.6-luna', 'medium', 1, %L
    )
  $test$, :'session_a_id', repeat('0', 64)),
  '23514',
  'new row for relation "session_ai_artifacts" violates check constraint "session_ai_artifacts_kind_allowed"',
  'unknown artifact kinds are rejected'
);

select throws_ok(
  format($test$
    insert into public.session_ai_artifacts (
      professor_id, session_id, pulse_id, kind, model, reasoning_effort,
      prompt_version, source_fingerprint
    ) values (
      '51000000-0000-4000-8000-000000000001', %L::uuid, %L::uuid,
      'publication_draft', 'gpt-5.6-luna', 'medium', 1, %L
    )
  $test$, :'session_a_id', :'pulse_a_id', repeat('0', 64)),
  '23514',
  'new row for relation "session_ai_artifacts" violates check constraint "session_ai_artifacts_target_consistency"',
  'publication drafts cannot retain a pulse or concept target'
);

select throws_ok(
  format($test$
    insert into public.session_ai_artifacts (
      professor_id, session_id, kind, status, model, reasoning_effort,
      prompt_version, source_fingerprint, result
    ) values (
      '51000000-0000-4000-8000-000000000001', %L::uuid,
      'publication_draft', 'completed', 'gpt-5.6-luna', 'medium',
      1, %L, '{"summary":"not allowed"}'::jsonb
    )
  $test$, :'session_a_id', repeat('0', 64)),
  '23514',
  'A session AI artifact must start as pending',
  'an artifact cannot be inserted directly as terminal'
);

-- Professor B's fixture also exercises failed terminal state and immutability.
insert into public.session_ai_artifacts (
  professor_id,
  session_id,
  kind,
  model,
  reasoning_effort,
  prompt_version,
  source_fingerprint
) values (
  '52000000-0000-4000-8000-000000000002',
  :'session_b_id',
  'publication_draft',
  'gpt-5.6-luna',
  'medium',
  1,
  repeat('b', 64)
)
returning id as artifact_b_id
\gset

update public.session_ai_artifacts
set
  status = 'failed',
  error_code = 'provider_timeout',
  error_message = 'The provider timed out safely.'
where id = :'artifact_b_id';

select is(
  (select status from public.session_ai_artifacts where id = :'artifact_b_id'),
  'failed',
  'a pending artifact can transition to failed with a safe error code'
);

select throws_ok(
  format(
    'update public.session_ai_artifacts set error_message = %L where id = %L::uuid',
    'A terminal result cannot change.',
    :'artifact_b_id'
  ),
  '23514',
  'A terminal session AI artifact is immutable',
  'failed artifacts are immutable'
);

create temporary table artifact_rpc_results (
  label text primary key,
  payload jsonb not null
) on commit drop;

insert into artifact_rpc_results (label, payload)
select
  'initial',
  public.create_session_ai_artifact(
    :'session_a_id'::uuid,
    null::uuid,
    '51000000-0000-4000-8000-000000000001',
    'publication_draft',
    'gpt-5.6-luna',
    'medium',
    1::smallint,
    repeat('1', 64),
    null::uuid,
    null::smallint,
    false,
    100,
    pg_catalog.now() - interval '2 seconds'
  );

select is(
  (select payload ->> 'outcome' from artifact_rpc_results where label = 'initial'),
  'created',
  'the first publication request reserves a pending artifact'
);

select is(
  (
    select source_captured_at
    from public.session_ai_artifacts
    where id = (
      select (payload #>> '{artifact,id}')::uuid
      from artifact_rpc_results where label = 'initial'
    )
  ),
  pg_catalog.now() - interval '2 seconds',
  'a recent source boundary is preserved instead of being backdated'
);

select throws_ok(
  format(
    'update public.session_ai_artifacts set id = %L::uuid, status = %L, error_code = %L, error_message = %L where id = %L::uuid',
    '59000000-0000-4000-8000-000000000009',
    'failed',
    'test_failure',
    'This update must not be accepted.',
    (
      select payload #>> '{artifact,id}'
      from artifact_rpc_results where label = 'initial'
    )
  ),
  '23514',
  'Session AI artifact source metadata is immutable',
  'the state trigger protects the artifact id and source metadata'
);

update public.session_ai_artifacts
set
  status = 'completed',
  result = jsonb_build_object(
    'summary', 'A generated but un-published classroom summary.',
    'resources_and_next_steps', 'Review one additional example.',
    'review_notes', jsonb_build_array()
  ),
  input_tokens = 100,
  cached_input_tokens = 0,
  output_tokens = 50,
  reasoning_tokens = 20,
  total_tokens = 150,
  estimated_cost_usd = 0.0004,
  pricing_version = 'test-pricing',
  duration_ms = 10,
  provider_request_id = 'request-test-1',
  provider_response_id = 'response-test-1'
where id = (
  select (payload #>> '{artifact,id}')::uuid
  from artifact_rpc_results where label = 'initial'
);

insert into artifact_rpc_results (label, payload)
select
  'cached',
  public.create_session_ai_artifact(
    :'session_a_id'::uuid, null::uuid,
    '51000000-0000-4000-8000-000000000001',
    'publication_draft', 'gpt-5.6-luna', 'medium', 1::smallint,
    repeat('1', 64), null::uuid, null::smallint, false, 1
  );

select is(
  (select payload ->> 'outcome' from artifact_rpc_results where label = 'cached'),
  'cached',
  'cache is rechecked before a saturated hourly quota'
);

select is(
  (
    select payload #>> '{artifact,id}'
    from artifact_rpc_results where label = 'cached'
  ),
  (
    select payload #>> '{artifact,id}'
    from artifact_rpc_results where label = 'initial'
  ),
  'the cached outcome returns the completed artifact'
);

set local role service_role;

select is(
  (
    public.create_session_ai_artifact(
      :'session_a_id'::uuid, null::uuid,
      '51000000-0000-4000-8000-000000000001',
      'publication_draft', 'gpt-5.6-luna', 'medium', 1::smallint,
      repeat('1', 64), null::uuid, null::smallint, false, 1
    ) ->> 'outcome'
  ),
  'cached',
  'the granted service role can execute the cache path end to end'
);

reset role;

insert into artifact_rpc_results (label, payload)
select
  'regenerated',
  public.create_session_ai_artifact(
    :'session_a_id'::uuid, null::uuid,
    '51000000-0000-4000-8000-000000000001',
    'publication_draft', 'gpt-5.6-luna', 'medium', 1::smallint,
    repeat('1', 64), null::uuid, null::smallint, true, 100
  );

select is(
  (
    select payload ->> 'outcome'
    from artifact_rpc_results where label = 'regenerated'
  ),
  'created',
  'force_regenerate reserves another row for identical sources'
);

insert into artifact_rpc_results (label, payload)
select
  'in_progress',
  public.create_session_ai_artifact(
    :'session_a_id'::uuid, null::uuid,
    '51000000-0000-4000-8000-000000000001',
    'publication_draft', 'gpt-5.6-luna', 'medium', 1::smallint,
    repeat('1', 64), null::uuid, null::smallint, true, 100
  );

select is(
  (
    select payload ->> 'outcome'
    from artifact_rpc_results where label = 'in_progress'
  ),
  'in_progress',
  'a concurrent regeneration reuses the pending target'
);

select is(
  (
    select payload #>> '{artifact,id}'
    from artifact_rpc_results where label = 'in_progress'
  ),
  (
    select payload #>> '{artifact,id}'
    from artifact_rpc_results where label = 'regenerated'
  ),
  'in_progress returns the already-reserved pending artifact'
);

select throws_ok(
  format($test$
    insert into public.session_ai_artifacts (
      professor_id, session_id, kind, model, reasoning_effort,
      prompt_version, source_fingerprint
    ) values (
      '51000000-0000-4000-8000-000000000001', %L::uuid,
      'publication_draft', 'gpt-5.6-luna', 'medium', 1, %L
    )
  $test$, :'session_a_id', repeat('9', 64)),
  '23505',
  'duplicate key value violates unique constraint "session_ai_artifacts_one_pending_publication_idx"',
  'the partial unique index independently blocks a duplicate pending target'
);

update public.session_ai_artifacts
set
  status = 'completed',
  result = jsonb_build_object(
    'summary', 'A deliberately regenerated classroom summary.',
    'resources_and_next_steps', 'Try a different short exercise.',
    'review_notes', jsonb_build_array()
  )
where id = (
  select (payload #>> '{artifact,id}')::uuid
  from artifact_rpc_results where label = 'regenerated'
);

select is(
  (
    select count(*)
    from public.session_ai_artifacts
    where session_id = :'session_a_id'
      and kind = 'publication_draft'
      and status = 'completed'
      and source_fingerprint = repeat('1', 64)
  ),
  2::bigint,
  'completed rows with identical fingerprints remain as immutable history'
);

select throws_ok(
  format(
    'update public.session_ai_artifacts set result = %L::jsonb where id = %L::uuid',
    '{"summary":"silently changed"}',
    (
      select payload #>> '{artifact,id}'
      from artifact_rpc_results where label = 'initial'
    )
  ),
  '23514',
  'A terminal session AI artifact is immutable',
  'completed artifacts are immutable'
);

insert into artifact_rpc_results (label, payload)
select
  'micro',
  public.create_session_ai_artifact(
    :'session_a_id'::uuid,
    :'pulse_a_id'::uuid,
    '51000000-0000-4000-8000-000000000001',
    'micro_intervention',
    'gpt-5.6-luna',
    'high',
    1::smallint,
    repeat('2', 64),
    :'analysis_a_id'::uuid,
    0::smallint,
    false,
    100
  );

select is(
  (select payload ->> 'outcome' from artifact_rpc_results where label = 'micro'),
  'created',
  'a completed analysis concept can reserve a micro-intervention'
);

select is(
  (
    select concept_index
    from public.session_ai_artifacts
    where id = (
      select (payload #>> '{artifact,id}')::uuid
      from artifact_rpc_results where label = 'micro'
    )
  ),
  0::smallint,
  'the micro-intervention persists its stable analysis concept target'
);

select is(
  (
    public.finalize_session_ai_artifact(
      (
        select (payload #>> '{artifact,id}')::uuid
        from artifact_rpc_results where label = 'micro'
      ),
      '51000000-0000-4000-8000-000000000001',
      'failed',
      null,
      'test_failure',
      'Closed through the serialized terminal RPC.',
      '{}'::jsonb
    )
  ).status,
  'failed',
  'terminal RPC closes a pending artifact under the shared objective lock'
);

select throws_ok(
  format($test$
    select public.create_session_ai_artifact(
      %L::uuid, %L::uuid,
      '51000000-0000-4000-8000-000000000001',
      'micro_intervention', 'gpt-5.6-luna', 'high', 1::smallint,
      %L, %L::uuid, 9::smallint, false, 100
    )
  $test$,
    :'session_a_id', :'pulse_a_id', repeat('3', 64), :'analysis_a_id'
  ),
  'P0001',
  'source_analysis_not_found',
  'an out-of-range concept is rejected before reserving paid work'
);

-- ---------------------------------------------------------------------------
-- Combined quotas in both directions
-- ---------------------------------------------------------------------------

select throws_ok(
  format($test$
    select public.create_session_ai_artifact(
      %L::uuid, null,
      '53000000-0000-4000-8000-000000000003',
      'publication_draft', 'gpt-5.6-luna', 'medium', 1::smallint,
      %L, null, null, false, 1
    )
  $test$, :'session_c_id', repeat('4', 64)),
  'P0001',
  'artifact_hourly_limit',
  'an existing analysis consumes the shared artifact hourly budget'
);

insert into public.session_ai_artifacts (
  professor_id,
  session_id,
  kind,
  model,
  reasoning_effort,
  prompt_version,
  source_fingerprint
) values (
  '54000000-0000-4000-8000-000000000004',
  :'session_d_id',
  'publication_draft',
  'gpt-5.6-luna',
  'medium',
  1,
  repeat('d', 64)
)
returning id as artifact_d_id
\gset

select throws_ok(
  format($test$
    select public.create_session_analysis(
      %L::uuid, %L::uuid,
      '54000000-0000-4000-8000-000000000004',
      'gpt-5.6-luna', 1::smallint, 1, now(), %L, 1
    )
  $test$, :'session_d_id', :'pulse_d_id', repeat('e', 64)),
  'P0001',
  'analysis_hourly_limit',
  'an existing artifact consumes the shared analysis hourly budget'
);

-- ---------------------------------------------------------------------------
-- Runtime RLS isolation and browser-write denial
-- ---------------------------------------------------------------------------

select (payload #>> '{artifact,id}')::uuid as initial_artifact_id
from artifact_rpc_results
where label = 'initial'
\gset

select set_config(
  'request.jwt.claim.sub',
  '51000000-0000-4000-8000-000000000001',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select is(
  (
    select count(*)
    from public.session_ai_artifacts
    where id = :'initial_artifact_id'
  ),
  1::bigint,
  'a professor can read an owned artifact'
);

select is(
  (
    select count(*)
    from public.session_ai_artifacts
    where id = :'artifact_b_id'
  ),
  0::bigint,
  'a professor cannot read another professor artifact'
);

select throws_ok(
  format($test$
    insert into public.session_ai_artifacts (
      professor_id, session_id, kind, model, reasoning_effort,
      prompt_version, source_fingerprint
    ) values (
      '51000000-0000-4000-8000-000000000001', %L::uuid,
      'publication_draft', 'gpt-5.6-luna', 'medium', 1, %L
    )
  $test$, :'session_a_id', repeat('f', 64)),
  '42501',
  'permission denied for table session_ai_artifacts',
  'the professor browser cannot insert an artifact directly'
);

reset role;
select set_config(
  'request.jwt.claim.sub',
  '55000000-0000-4000-8000-000000000005',
  true
);
set local role authenticated;

select is(
  (select count(*) from public.session_ai_artifacts),
  0::bigint,
  'an authenticated student cannot read any AI artifact'
);

select * from finish();
rollback;
