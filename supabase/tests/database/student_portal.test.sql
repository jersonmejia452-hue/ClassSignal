begin;

select plan(23);

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
    '10000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'professor@example.test',
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
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '20000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'student@example.test',
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

select is(
  (select role from public.profiles where id = '20000000-0000-4000-8000-000000000002'),
  'student',
  'new Auth users receive the student role'
);

update public.profiles
set role = 'professor'
where id = '10000000-0000-4000-8000-000000000001';

select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000001',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select lives_ok(
  $$
    insert into public.courses (
      professor_id,
      name,
      subject,
      description
    ) values (
      '10000000-0000-4000-8000-000000000001',
      'Course for portal tests',
      'Mathematics',
      'A secure test course.'
    )
  $$,
  'a professor can create a course'
);

select
  id as test_course_id,
  enrollment_code as test_enrollment_code
from public.courses
where name = 'Course for portal tests'
\gset

select matches(
  :'test_enrollment_code'::text,
  '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$',
  'the permanent course code has eight non-ambiguous characters'
);

select set_config(
  'request.jwt.claim.sub',
  '20000000-0000-4000-8000-000000000002',
  true
);

select throws_ok(
  $$
    insert into public.courses (professor_id, name, subject)
    values (
      '20000000-0000-4000-8000-000000000002',
      'Forbidden student course',
      'Mathematics'
    )
  $$,
  '42501',
  'new row violates row-level security policy for table "courses"',
  'a student cannot create a professor course'
);

select is(
  (select count(*) from public.courses),
  0::bigint,
  'an enrolled-course candidate is not directly readable before enrollment'
);

select results_eq(
  format(
    'select enrollment_status from public.enroll_in_course(%L)',
    :'test_enrollment_code'
  ),
  $$values ('joined'::text)$$,
  'a student can enroll through the bounded RPC'
);

select results_eq(
  format(
    'select enrollment_status from public.enroll_in_course(%L)',
    :'test_enrollment_code'
  ),
  $$values ('already_enrolled'::text)$$,
  'course enrollment is idempotent'
);

select is(
  (select count(*) from public.get_my_student_courses()),
  1::bigint,
  'the portal lists the enrolled course through a narrow RPC'
);

select is(
  (select count(*) from public.courses),
  0::bigint,
  'enrollment does not grant direct access to the courses table'
);

select throws_ok(
  $$select * from private.course_enrollment_attempts$$,
  '42501',
  'permission denied for table course_enrollment_attempts',
  'students cannot inspect enrollment attempts'
);

select has_pk(
  'private',
  'course_enrollment_attempts',
  'the private enrollment-attempt ledger has a primary key'
);

select ok(
  exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'course_enrollments'
      and policyname = 'Course enrollments are RPC only'
  ),
  'direct enrollment access has an explicit deny policy'
);

reset role;
select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000001',
  true
);
set local role authenticated;

select lives_ok(
  format($test$
    insert into public.sessions (
      professor_id,
      course_id,
      code,
      title,
      subject,
      topic
    ) values (
      '10000000-0000-4000-8000-000000000001',
      %L::uuid,
      'ABC234',
      'Portal test class',
      'Mathematics',
      'Secure student archive'
    )
  $test$, :'test_course_id'),
  'a professor can create a class after role hardening'
);

select id as test_session_id
from public.sessions
where code = 'ABC234'
\gset

select lives_ok(
  format($test$
    insert into public.session_publications (
      session_id,
      summary,
      resources,
      questions_published
    ) values (
      %L::uuid,
      'A professor-reviewed summary for enrolled students.',
      'https://example.test/material',
      false
    )
  $test$, :'test_session_id'),
  'the owning professor can publish a class archive'
);

select id as test_pulse_id
from public.session_pulses
where session_id = :'test_session_id'
  and ordinal = 1
\gset

reset role;

insert into public.responses (
  session_id,
  pulse_id,
  anonymous_id,
  status,
  question_text,
  is_visible_to_students
) values (
  :'test_session_id',
  :'test_pulse_id',
  '30000000-0000-4000-8000-000000000003',
  'question',
  'Approved before publishing',
  true
);

set local role authenticated;

select lives_ok(
  format($test$
    select *
    from public.save_session_publication(
      %L::uuid,
      'A professor-reviewed summary for enrolled students.',
      'https://example.test/material',
      true
    )
  $test$, :'test_session_id'),
  'the narrow publication RPC can update an existing archive'
);

reset role;

insert into public.responses (
  session_id,
  pulse_id,
  anonymous_id,
  status,
  question_text,
  is_visible_to_students
) values (
  :'test_session_id',
  :'test_pulse_id',
  '40000000-0000-4000-8000-000000000004',
  'question',
  'Arrived after publishing',
  true
);

set local role authenticated;

select is(
  public.get_course_enrollment_count(:'test_course_id'),
  1::bigint,
  'the professor sees only the aggregate enrollment count'
);

reset role;
select set_config(
  'request.jwt.claim.sub',
  '20000000-0000-4000-8000-000000000002',
  true
);
set local role authenticated;

select is(
  (
    select summary
    from public.get_student_session_archive(
      :'test_session_id'
    )
  ),
  'A professor-reviewed summary for enrolled students.',
  'an enrolled student can read an explicitly published summary'
);

select is(
  (
    select count(*)
    from public.get_student_archive_questions(:'test_session_id')
  ),
  1::bigint,
  'the archive exposes only questions captured when the publication was saved'
);

select is(
  (
    select max(question_text)
    from public.get_student_archive_questions(:'test_session_id')
  ),
  'Approved before publishing',
  'a later anonymous question is not published automatically'
);

select throws_ok(
  format(
    'select public.set_session_active(%L::uuid, true)',
    :'test_session_id'
  ),
  '42501',
  'professor_role_required',
  'a student cannot call inherited professor lifecycle RPCs'
);

select is(
  (select count(*) from public.responses),
  0::bigint,
  'a student account cannot read anonymous response rows'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'private.set_session_active_unchecked(uuid,boolean)',
    'EXECUTE'
  ),
  'unchecked lifecycle implementation is inaccessible'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.enroll_in_course(text)',
    'EXECUTE'
  ),
  'anonymous users cannot enroll in saved courses'
);

select * from finish();
rollback;
