-- Adds a durable student portal without linking authenticated identities to
-- anonymous pulse responses. Existing owners of academic data are promoted to
-- professor; every other account starts as a student and can only join courses
-- through the bounded enrollment RPC.

-- ---------------------------------------------------------------------------
-- Account profiles and server-owned roles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'student',
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint profiles_role_check check (role in ('professor', 'student')),
  constraint profiles_display_name_length check (
    display_name is null
    or (
      char_length(display_name) <= 80
      and char_length(btrim(display_name)) >= 2
    )
  )
);

comment on table public.profiles is
  'Server-owned account role and optional self-managed display name.';
comment on column public.profiles.role is
  'Authorization role. Clients can read it but never insert or update it.';

-- Promote only accounts that already own academic data. Production is checked
-- before deployment so an ownerless teacher can be promoted administratively
-- instead of accidentally treating every historical signup as a professor.
insert into public.profiles (id, role, created_at, updated_at)
select
  auth_user.id,
  'professor',
  auth_user.created_at,
  now()
from auth.users as auth_user
where exists (
  select 1
  from public.courses as course
  where course.professor_id = auth_user.id
)
or exists (
  select 1
  from public.sessions as session_row
  where session_row.professor_id = auth_user.id
)
on conflict (id) do nothing;

insert into public.profiles (id, role, created_at, updated_at)
select auth_user.id, 'student', auth_user.created_at, now()
from auth.users as auth_user
on conflict (id) do nothing;

create or replace function private.set_profiles_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = pg_catalog.now();
  return new;
end;
$$;

revoke all on function private.set_profiles_updated_at()
  from public, anon, authenticated, service_role;

create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function private.set_profiles_updated_at();

create or replace function private.create_student_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, role, created_at, updated_at)
  values (new.id, 'student', new.created_at, pg_catalog.now())
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function private.create_student_profile_for_auth_user()
  from public, anon, authenticated, service_role;

drop trigger if exists classsignal_auth_user_profile on auth.users;
create trigger classsignal_auth_user_profile
after insert on auth.users
for each row
execute function private.create_student_profile_for_auth_user();

-- Catch a signup that could commit between the initial backfill and trigger
-- creation while this migration waits on catalog locks.
insert into public.profiles (id, role, created_at, updated_at)
select auth_user.id, 'student', auth_user.created_at, now()
from auth.users as auth_user
on conflict (id) do nothing;

create or replace function private.current_user_has_role(p_role text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.profiles as profile
      where profile.id = (select auth.uid())
        and profile.role = p_role
    );
$$;

revoke all on function private.current_user_has_role(text)
  from public, anon, authenticated, service_role;
grant usage on schema private to authenticated;
grant execute on function private.current_user_has_role(text) to authenticated;

-- Some lifecycle RPCs were created as SECURITY DEFINER before roles existed.
-- These triggers make the role boundary unavoidable even inside those RPCs.
create or replace function private.require_professor_for_teacher_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null
     and not private.current_user_has_role('professor') then
    raise exception
      using errcode = '42501',
            message = 'professor_role_required';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

revoke all on function private.require_professor_for_teacher_mutation()
  from public, anon, authenticated, service_role;

create trigger sessions_require_professor_role
before insert or update or delete on public.sessions
for each row
execute function private.require_professor_for_teacher_mutation();

create trigger session_pulses_require_professor_role
before insert or update or delete on public.session_pulses
for each row
execute function private.require_professor_for_teacher_mutation();

create or replace function private.current_student_id()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_id uuid := (select auth.uid());
begin
  if current_id is null or not exists (
    select 1
    from public.profiles as profile
    where profile.id = current_id
      and profile.role = 'student'
  ) then
    raise exception
      using errcode = 'P0001',
            message = 'student_role_required';
  end if;

  return current_id;
end;
$$;

revoke all on function private.current_student_id()
  from public, anon, authenticated, service_role;
grant execute on function private.current_student_id() to authenticated;

-- Wrap the two pre-role SECURITY DEFINER lifecycle implementations. A trigger
-- below remains defense in depth, while these wrappers reject students before
-- any row can be returned or lifecycle state can be inferred through errors.
alter function private.open_next_session_pulse(uuid)
  rename to open_next_session_pulse_unchecked;
alter function private.set_session_active(uuid, boolean)
  rename to set_session_active_unchecked;

revoke all on function private.open_next_session_pulse_unchecked(uuid)
  from public, anon, authenticated, service_role;
revoke all on function private.set_session_active_unchecked(uuid, boolean)
  from public, anon, authenticated, service_role;

create or replace function private.open_next_session_pulse(
  p_session_id uuid
)
returns public.session_pulses
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.current_user_has_role('professor') then
    raise exception
      using errcode = '42501',
            message = 'professor_role_required';
  end if;

  return private.open_next_session_pulse_unchecked(p_session_id);
end;
$$;

create or replace function private.set_session_active(
  p_session_id uuid,
  p_is_active boolean
)
returns public.sessions
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.current_user_has_role('professor') then
    raise exception
      using errcode = '42501',
            message = 'professor_role_required';
  end if;

  return private.set_session_active_unchecked(p_session_id, p_is_active);
end;
$$;

revoke all on function private.open_next_session_pulse(uuid)
  from public, anon, authenticated, service_role;
revoke all on function private.set_session_active(uuid, boolean)
  from public, anon, authenticated, service_role;
grant execute on function private.open_next_session_pulse(uuid)
  to authenticated;
grant execute on function private.set_session_active(uuid, boolean)
  to authenticated;

create or replace function public.open_next_session_pulse(
  p_session_id uuid
)
returns public.session_pulses
language sql
volatile
security invoker
set search_path = ''
as $$
  select pulse.*
  from private.open_next_session_pulse(p_session_id) as pulse;
$$;

create or replace function public.set_session_active(
  p_session_id uuid,
  p_is_active boolean
)
returns public.sessions
language sql
volatile
security invoker
set search_path = ''
as $$
  select session_row.*
  from private.set_session_active(p_session_id, p_is_active) as session_row;
$$;

revoke all on function public.open_next_session_pulse(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.set_session_active(uuid, boolean)
  from public, anon, authenticated, service_role;
grant execute on function public.open_next_session_pulse(uuid)
  to authenticated;
grant execute on function public.set_session_active(uuid, boolean)
  to authenticated;

alter table public.profiles enable row level security;

create policy profiles_select_own
on public.profiles
for select
to authenticated
using (id = (select auth.uid()));

create policy profiles_update_own
on public.profiles
for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

revoke all privileges on table public.profiles
  from public, anon, authenticated, service_role;
grant select on table public.profiles to authenticated;
grant update (display_name) on table public.profiles to authenticated;
grant select, insert, update, delete on table public.profiles to service_role;

-- ---------------------------------------------------------------------------
-- Permanent course enrollment codes
-- ---------------------------------------------------------------------------

alter table public.courses
  add column enrollment_code text,
  add column enrollment_open boolean not null default true;

create or replace function private.generate_course_enrollment_code()
returns text
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  random_bytes bytea := extensions.gen_random_bytes(8);
  generated_code text := '';
  byte_index integer;
begin
  for byte_index in 0..7 loop
    generated_code := generated_code || pg_catalog.substr(
      alphabet,
      (pg_catalog.get_byte(random_bytes, byte_index) % 32) + 1,
      1
    );
  end loop;

  return generated_code;
end;
$$;

revoke all on function private.generate_course_enrollment_code()
  from public, anon, authenticated, service_role;

create or replace function private.assign_course_enrollment_code()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  attempt integer;
  candidate text;
begin
  if new.enrollment_code is not null then
    new.enrollment_code = pg_catalog.upper(pg_catalog.btrim(new.enrollment_code));
    return new;
  end if;

  for attempt in 1..20 loop
    candidate := private.generate_course_enrollment_code();
    if not exists (
      select 1
      from public.courses as course
      where course.enrollment_code = candidate
    ) then
      new.enrollment_code = candidate;
      return new;
    end if;
  end loop;

  raise exception
    using errcode = 'P0001',
          message = 'course_enrollment_code_unavailable';
end;
$$;

revoke all on function private.assign_course_enrollment_code()
  from public, anon, authenticated, service_role;

create trigger courses_assign_enrollment_code
before insert on public.courses
for each row
execute function private.assign_course_enrollment_code();

update public.courses
set enrollment_code = private.generate_course_enrollment_code()
where enrollment_code is null;

alter table public.courses
  alter column enrollment_code set not null,
  add constraint courses_enrollment_code_unique unique (enrollment_code),
  add constraint courses_enrollment_code_format check (
    enrollment_code ~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$'
  );

comment on column public.courses.enrollment_code is
  'Permanent eight-character course code used only to create a student enrollment.';
comment on column public.courses.enrollment_open is
  'Professor-controlled switch for accepting new course enrollments.';

grant update (enrollment_open) on table public.courses to authenticated;

-- ---------------------------------------------------------------------------
-- Enrollments and explicit class publications
-- ---------------------------------------------------------------------------

create table public.course_enrollments (
  course_id uuid not null references public.courses (id) on delete cascade,
  student_id uuid not null references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),

  constraint course_enrollments_pkey primary key (course_id, student_id)
);

create index course_enrollments_student_joined_at_idx
  on public.course_enrollments (student_id, joined_at desc);

create table private.course_enrollment_attempts (
  student_id uuid not null references auth.users (id) on delete cascade,
  attempted_at timestamptz not null default now()
);

create index course_enrollment_attempts_student_time_idx
  on private.course_enrollment_attempts (student_id, attempted_at desc);

revoke all privileges on table private.course_enrollment_attempts
  from public, anon, authenticated, service_role;

comment on table public.course_enrollments is
  'Account-to-course access only. This table is never joined to anonymous responses.';

alter table public.course_enrollments enable row level security;

-- Written questions now require explicit professor approval before appearing
-- in either the live wall or a saved archive. Existing questions return to the
-- private state because the previous opt-out model did not record review.
alter table public.responses
  alter column is_visible_to_students set default false;

update public.responses
set is_visible_to_students = false
where question_text is not null;

comment on column public.responses.is_visible_to_students is
  'Explicit professor approval for inclusion in a live or archived anonymous question wall; defaults to private.';

revoke all privileges on table public.course_enrollments
  from public, anon, authenticated, service_role;
grant select, insert, update, delete on table public.course_enrollments
  to service_role;

create table public.session_publications (
  session_id uuid primary key references public.sessions (id) on delete cascade,
  summary text not null,
  resources text,
  questions_published boolean not null default false,
  published_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint session_publications_summary_length check (
    char_length(summary) <= 5000
    and char_length(btrim(summary)) >= 10
  ),
  constraint session_publications_resources_length check (
    resources is null
    or (
      char_length(resources) <= 2000
      and char_length(btrim(resources)) > 0
    )
  )
);

comment on table public.session_publications is
  'Professor-authored recap explicitly released to enrolled students.';
comment on column public.session_publications.questions_published is
  'Whether the latest professor-reviewed snapshot of anonymous questions is included in the archive.';

create table private.session_publication_questions (
  session_id uuid not null
    references public.session_publications (session_id) on delete cascade,
  response_id uuid not null
    references public.responses (id) on delete cascade,
  primary key (session_id, response_id)
);

create index session_publication_questions_response_id_idx
  on private.session_publication_questions (response_id);

comment on table private.session_publication_questions is
  'Server-owned snapshot of moderated question ids captured whenever a professor saves a publication.';

revoke all privileges on table private.session_publication_questions
  from public, anon, authenticated, service_role;

create or replace function private.set_session_publications_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = pg_catalog.now();
  return new;
end;
$$;

revoke all on function private.set_session_publications_updated_at()
  from public, anon, authenticated, service_role;

create trigger session_publications_set_updated_at
before update on public.session_publications
for each row
execute function private.set_session_publications_updated_at();

create or replace function private.refresh_session_publication_questions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from private.session_publication_questions
  where session_id = new.session_id;

  if new.questions_published then
    insert into private.session_publication_questions (
      session_id,
      response_id
    )
    select
      new.session_id,
      response_row.id
    from public.responses as response_row
    where response_row.session_id = new.session_id
      and response_row.is_visible_to_students
      and response_row.question_text is not null
      and char_length(pg_catalog.btrim(response_row.question_text)) > 0
    on conflict do nothing;
  end if;

  return new;
end;
$$;

revoke all on function private.refresh_session_publication_questions()
  from public, anon, authenticated, service_role;

create trigger session_publications_refresh_question_snapshot
after insert or update on public.session_publications
for each row
execute function private.refresh_session_publication_questions();

alter table public.session_publications enable row level security;

create policy session_publications_select_for_professor
on public.session_publications
for select
to authenticated
using (
  private.current_user_has_role('professor')
  and exists (
    select 1
    from public.sessions as session_row
    where session_row.id = session_publications.session_id
      and session_row.professor_id = (select auth.uid())
  )
);

create policy session_publications_insert_for_professor
on public.session_publications
for insert
to authenticated
with check (
  private.current_user_has_role('professor')
  and exists (
    select 1
    from public.sessions as session_row
    where session_row.id = session_publications.session_id
      and session_row.professor_id = (select auth.uid())
  )
);

create policy session_publications_update_for_professor
on public.session_publications
for update
to authenticated
using (
  private.current_user_has_role('professor')
  and exists (
    select 1
    from public.sessions as session_row
    where session_row.id = session_publications.session_id
      and session_row.professor_id = (select auth.uid())
  )
)
with check (
  private.current_user_has_role('professor')
  and exists (
    select 1
    from public.sessions as session_row
    where session_row.id = session_publications.session_id
      and session_row.professor_id = (select auth.uid())
  )
);

create policy session_publications_delete_for_professor
on public.session_publications
for delete
to authenticated
using (
  private.current_user_has_role('professor')
  and exists (
    select 1
    from public.sessions as session_row
    where session_row.id = session_publications.session_id
      and session_row.professor_id = (select auth.uid())
  )
);

revoke all privileges on table public.session_publications
  from public, anon, authenticated, service_role;
grant select, delete on table public.session_publications to authenticated;
grant insert (session_id, summary, resources, questions_published)
  on table public.session_publications to authenticated;
grant update (summary, resources, questions_published)
  on table public.session_publications to authenticated;
grant select, insert, update, delete on table public.session_publications
  to service_role;

create or replace function public.save_session_publication(
  p_session_id uuid,
  p_summary text,
  p_resources text,
  p_questions_published boolean
)
returns table (
  session_id uuid,
  summary text,
  resources text,
  questions_published boolean,
  published_at timestamptz,
  updated_at timestamptz
)
language sql
volatile
security invoker
set search_path = ''
as $$
  insert into public.session_publications as publication (
    session_id,
    summary,
    resources,
    questions_published
  ) values (
    p_session_id,
    p_summary,
    p_resources,
    p_questions_published
  )
  on conflict on constraint session_publications_pkey do update
  set
    summary = excluded.summary,
    resources = excluded.resources,
    questions_published = excluded.questions_published
  returning
    publication.session_id,
    publication.summary,
    publication.resources,
    publication.questions_published,
    publication.published_at,
    publication.updated_at;
$$;

revoke all on function public.save_session_publication(uuid, text, text, boolean)
  from public, anon, authenticated, service_role;
grant execute on function public.save_session_publication(uuid, text, text, boolean)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Professor authorization hardening
-- ---------------------------------------------------------------------------

drop policy if exists courses_select_own on public.courses;
drop policy if exists courses_insert_own on public.courses;
drop policy if exists courses_update_own on public.courses;
drop policy if exists courses_delete_own on public.courses;

create policy courses_select_own
on public.courses
for select
to authenticated
using (
  professor_id = (select auth.uid())
  and private.current_user_has_role('professor')
);

create policy courses_insert_own
on public.courses
for insert
to authenticated
with check (
  professor_id = (select auth.uid())
  and private.current_user_has_role('professor')
);

create policy courses_update_own
on public.courses
for update
to authenticated
using (
  professor_id = (select auth.uid())
  and private.current_user_has_role('professor')
)
with check (
  professor_id = (select auth.uid())
  and private.current_user_has_role('professor')
);

create policy courses_delete_own
on public.courses
for delete
to authenticated
using (
  professor_id = (select auth.uid())
  and private.current_user_has_role('professor')
);

drop policy if exists sessions_select_own on public.sessions;
drop policy if exists sessions_insert_own on public.sessions;
drop policy if exists sessions_update_own on public.sessions;
drop policy if exists sessions_delete_own on public.sessions;

create policy sessions_select_own
on public.sessions
for select
to authenticated
using (
  professor_id = (select auth.uid())
  and private.current_user_has_role('professor')
);

create policy sessions_insert_own
on public.sessions
for insert
to authenticated
with check (
  professor_id = (select auth.uid())
  and private.current_user_has_role('professor')
);

create policy sessions_update_own
on public.sessions
for update
to authenticated
using (
  professor_id = (select auth.uid())
  and private.current_user_has_role('professor')
)
with check (
  professor_id = (select auth.uid())
  and private.current_user_has_role('professor')
);

create policy sessions_delete_own
on public.sessions
for delete
to authenticated
using (
  professor_id = (select auth.uid())
  and private.current_user_has_role('professor')
);

drop policy if exists responses_select_for_session_owner on public.responses;
drop policy if exists responses_update_visibility_for_session_owner on public.responses;

create policy responses_select_for_session_owner
on public.responses
for select
to authenticated
using (
  private.current_user_has_role('professor')
  and exists (
    select 1
    from public.sessions as session_row
    where session_row.id = responses.session_id
      and session_row.professor_id = (select auth.uid())
  )
);

create policy responses_update_visibility_for_session_owner
on public.responses
for update
to authenticated
using (
  private.current_user_has_role('professor')
  and exists (
    select 1
    from public.sessions as session_row
    where session_row.id = responses.session_id
      and session_row.professor_id = (select auth.uid())
  )
)
with check (
  private.current_user_has_role('professor')
  and exists (
    select 1
    from public.sessions as session_row
    where session_row.id = responses.session_id
      and session_row.professor_id = (select auth.uid())
  )
);

drop policy if exists session_pulses_select_for_session_owner
  on public.session_pulses;
drop policy if exists session_pulses_update_questions_for_session_owner
  on public.session_pulses;

create policy session_pulses_select_for_session_owner
on public.session_pulses
for select
to authenticated
using (
  private.current_user_has_role('professor')
  and exists (
    select 1
    from public.sessions as session_row
    where session_row.id = session_pulses.session_id
      and session_row.professor_id = (select auth.uid())
  )
);

create policy session_pulses_update_questions_for_session_owner
on public.session_pulses
for update
to authenticated
using (
  private.current_user_has_role('professor')
  and session_pulses.is_active
  and exists (
    select 1
    from public.sessions as session_row
    where session_row.id = session_pulses.session_id
      and session_row.professor_id = (select auth.uid())
      and session_row.is_active
  )
)
with check (
  private.current_user_has_role('professor')
  and session_pulses.is_active
  and exists (
    select 1
    from public.sessions as session_row
    where session_row.id = session_pulses.session_id
      and session_row.professor_id = (select auth.uid())
      and session_row.is_active
  )
);

drop policy if exists session_analyses_select_for_session_owner
  on public.session_analyses;

create policy session_analyses_select_for_session_owner
on public.session_analyses
for select
to authenticated
using (
  private.current_user_has_role('professor')
  and exists (
    select 1
    from public.sessions as session_row
    where session_row.id = session_analyses.session_id
      and session_row.professor_id = (select auth.uid())
  )
);

-- ---------------------------------------------------------------------------
-- Student enrollment and portal implementations (private, privileged)
-- ---------------------------------------------------------------------------

create or replace function private.enroll_student_in_course(p_code text)
returns table (
  course_id uuid,
  enrollment_status text
)
language plpgsql
security definer
set search_path = ''
rows 1
as $$
declare
  current_student_id uuid := private.current_student_id();
  normalized_code text := pg_catalog.upper(pg_catalog.btrim(p_code));
  selected_course_id uuid;
  inserted_count integer;
  recent_attempt_count integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(current_student_id::text, 721903)
  );

  delete from private.course_enrollment_attempts as attempt
  where attempt.student_id = current_student_id
    and attempt.attempted_at < pg_catalog.now() - interval '10 minutes';

  select count(*)::integer
  into recent_attempt_count
  from private.course_enrollment_attempts as attempt
  where attempt.student_id = current_student_id
    and attempt.attempted_at >= pg_catalog.now() - interval '10 minutes';

  if recent_attempt_count >= 10 then
    course_id := null;
    enrollment_status := 'course_unavailable';
    return next;
    return;
  end if;

  insert into private.course_enrollment_attempts (student_id)
  values (current_student_id);

  if normalized_code !~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$' then
    course_id := null;
    enrollment_status := 'course_unavailable';
    return next;
    return;
  end if;

  select course.id
  into selected_course_id
  from public.courses as course
  join public.profiles as owner_profile
    on owner_profile.id = course.professor_id
   and owner_profile.role = 'professor'
  where course.enrollment_code = normalized_code
    and course.enrollment_open
  limit 1
  for update;

  if selected_course_id is null then
    course_id := null;
    enrollment_status := 'course_unavailable';
    return next;
    return;
  end if;

  insert into public.course_enrollments (course_id, student_id)
  values (selected_course_id, current_student_id)
  on conflict on constraint course_enrollments_pkey do nothing;

  get diagnostics inserted_count = row_count;

  course_id := selected_course_id;
  enrollment_status := case
    when inserted_count = 1 then 'joined'
    else 'already_enrolled'
  end;
  return next;
end;
$$;

create or replace function private.get_my_student_courses()
returns table (
  course_id uuid,
  name text,
  subject text,
  description text,
  joined_at timestamptz,
  session_count bigint,
  active_session_count bigint,
  latest_session_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
rows 100
as $$
declare
  current_student_id uuid := private.current_student_id();
begin
  return query
  select
    course.id,
    course.name,
    course.subject,
    course.description,
    enrollment.joined_at,
    (select count(*) from public.sessions as session_row
      where session_row.course_id = course.id),
    (select count(*) from public.sessions as session_row
      where session_row.course_id = course.id and session_row.is_active),
    (select max(session_row.created_at) from public.sessions as session_row
      where session_row.course_id = course.id)
  from public.course_enrollments as enrollment
  join public.courses as course on course.id = enrollment.course_id
  where enrollment.student_id = current_student_id
  order by enrollment.joined_at desc
  limit 100;
end;
$$;

create or replace function private.get_student_course_details(p_course_id uuid)
returns table (
  course_id uuid,
  name text,
  subject text,
  description text,
  joined_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
rows 1
as $$
declare
  current_student_id uuid := private.current_student_id();
begin
  return query
  select
    course.id,
    course.name,
    course.subject,
    course.description,
    enrollment.joined_at
  from public.course_enrollments as enrollment
  join public.courses as course on course.id = enrollment.course_id
  where enrollment.student_id = current_student_id
    and enrollment.course_id = p_course_id
  limit 1;
end;
$$;

create or replace function private.get_student_course_sessions(p_course_id uuid)
returns table (
  session_id uuid,
  code text,
  title text,
  subject text,
  topic text,
  is_active boolean,
  created_at timestamptz,
  ended_at timestamptz,
  has_publication boolean,
  questions_published boolean
)
language plpgsql
stable
security definer
set search_path = ''
rows 200
as $$
declare
  current_student_id uuid := private.current_student_id();
begin
  if not exists (
    select 1
    from public.course_enrollments as enrollment
    where enrollment.course_id = p_course_id
      and enrollment.student_id = current_student_id
  ) then
    return;
  end if;

  return query
  select
    session_row.id,
    session_row.code,
    session_row.title,
    session_row.subject,
    session_row.topic,
    session_row.is_active,
    session_row.created_at,
    session_row.ended_at,
    publication.session_id is not null,
    coalesce(publication.questions_published, false)
  from public.sessions as session_row
  left join public.session_publications as publication
    on publication.session_id = session_row.id
  where session_row.course_id = p_course_id
  order by session_row.created_at desc
  limit 200;
end;
$$;

create or replace function private.get_student_session_archive(p_session_id uuid)
returns table (
  session_id uuid,
  course_id uuid,
  course_name text,
  code text,
  title text,
  subject text,
  topic text,
  is_active boolean,
  created_at timestamptz,
  ended_at timestamptz,
  summary text,
  resources text,
  questions_published boolean,
  published_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
rows 1
as $$
declare
  current_student_id uuid := private.current_student_id();
begin
  return query
  select
    session_row.id,
    course.id,
    course.name,
    session_row.code,
    session_row.title,
    session_row.subject,
    session_row.topic,
    session_row.is_active,
    session_row.created_at,
    session_row.ended_at,
    publication.summary,
    publication.resources,
    coalesce(publication.questions_published, false),
    publication.published_at
  from public.sessions as session_row
  join public.courses as course on course.id = session_row.course_id
  join public.course_enrollments as enrollment
    on enrollment.course_id = course.id
   and enrollment.student_id = current_student_id
  left join public.session_publications as publication
    on publication.session_id = session_row.id
  where session_row.id = p_session_id
  limit 1;
end;
$$;

create or replace function private.get_student_archive_questions(p_session_id uuid)
returns table (
  response_id uuid,
  pulse_ordinal integer,
  question_text text
)
language plpgsql
stable
security definer
set search_path = ''
rows 200
as $$
declare
  current_student_id uuid := private.current_student_id();
begin
  if not exists (
    select 1
    from public.sessions as session_row
    join public.course_enrollments as enrollment
      on enrollment.course_id = session_row.course_id
     and enrollment.student_id = current_student_id
    join public.session_publications as publication
      on publication.session_id = session_row.id
     and publication.questions_published
    where session_row.id = p_session_id
  ) then
    return;
  end if;

  return query
  select
    response_row.id,
    pulse.ordinal,
    response_row.question_text
  from public.responses as response_row
  join public.session_pulses as pulse on pulse.id = response_row.pulse_id
  join private.session_publication_questions as published_question
    on published_question.session_id = response_row.session_id
   and published_question.response_id = response_row.id
  where response_row.session_id = p_session_id
    and response_row.is_visible_to_students
    and response_row.question_text is not null
    and char_length(pg_catalog.btrim(response_row.question_text)) > 0
  order by pulse.ordinal asc, response_row.created_at asc
  limit 200;
end;
$$;

create or replace function private.get_course_enrollment_count(p_course_id uuid)
returns bigint
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_professor_id uuid := (select auth.uid());
  enrollment_count bigint;
begin
  if current_professor_id is null
     or not private.current_user_has_role('professor')
     or not exists (
       select 1
       from public.courses as course
       where course.id = p_course_id
         and course.professor_id = current_professor_id
     ) then
    raise exception
      using errcode = 'P0001',
            message = 'course_not_found';
  end if;

  select count(*)
  into enrollment_count
  from public.course_enrollments as enrollment
  where enrollment.course_id = p_course_id;

  return enrollment_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Data API wrappers. Privileged implementations remain outside public.
-- ---------------------------------------------------------------------------

create or replace function public.enroll_in_course(p_code text)
returns table (
  course_id uuid,
  enrollment_status text
)
language sql
volatile
security invoker
set search_path = ''
rows 1
as $$
  select * from private.enroll_student_in_course(p_code);
$$;

create or replace function public.get_my_student_courses()
returns table (
  course_id uuid,
  name text,
  subject text,
  description text,
  joined_at timestamptz,
  session_count bigint,
  active_session_count bigint,
  latest_session_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
rows 100
as $$
  select * from private.get_my_student_courses();
$$;

create or replace function public.get_student_course_details(p_course_id uuid)
returns table (
  course_id uuid,
  name text,
  subject text,
  description text,
  joined_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
rows 1
as $$
  select * from private.get_student_course_details(p_course_id);
$$;

create or replace function public.get_student_course_sessions(p_course_id uuid)
returns table (
  session_id uuid,
  code text,
  title text,
  subject text,
  topic text,
  is_active boolean,
  created_at timestamptz,
  ended_at timestamptz,
  has_publication boolean,
  questions_published boolean
)
language sql
stable
security invoker
set search_path = ''
rows 200
as $$
  select * from private.get_student_course_sessions(p_course_id);
$$;

create or replace function public.get_student_session_archive(p_session_id uuid)
returns table (
  session_id uuid,
  course_id uuid,
  course_name text,
  code text,
  title text,
  subject text,
  topic text,
  is_active boolean,
  created_at timestamptz,
  ended_at timestamptz,
  summary text,
  resources text,
  questions_published boolean,
  published_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
rows 1
as $$
  select * from private.get_student_session_archive(p_session_id);
$$;

create or replace function public.get_student_archive_questions(p_session_id uuid)
returns table (
  response_id uuid,
  pulse_ordinal integer,
  question_text text
)
language sql
stable
security invoker
set search_path = ''
rows 200
as $$
  select * from private.get_student_archive_questions(p_session_id);
$$;

create or replace function public.get_course_enrollment_count(p_course_id uuid)
returns bigint
language sql
stable
security invoker
set search_path = ''
as $$
  select private.get_course_enrollment_count(p_course_id);
$$;

revoke all on function private.enroll_student_in_course(text)
  from public, anon, authenticated, service_role;
revoke all on function private.get_my_student_courses()
  from public, anon, authenticated, service_role;
revoke all on function private.get_student_course_details(uuid)
  from public, anon, authenticated, service_role;
revoke all on function private.get_student_course_sessions(uuid)
  from public, anon, authenticated, service_role;
revoke all on function private.get_student_session_archive(uuid)
  from public, anon, authenticated, service_role;
revoke all on function private.get_student_archive_questions(uuid)
  from public, anon, authenticated, service_role;
revoke all on function private.get_course_enrollment_count(uuid)
  from public, anon, authenticated, service_role;

grant execute on function private.enroll_student_in_course(text) to authenticated;
grant execute on function private.get_my_student_courses() to authenticated;
grant execute on function private.get_student_course_details(uuid) to authenticated;
grant execute on function private.get_student_course_sessions(uuid) to authenticated;
grant execute on function private.get_student_session_archive(uuid) to authenticated;
grant execute on function private.get_student_archive_questions(uuid) to authenticated;
grant execute on function private.get_course_enrollment_count(uuid) to authenticated;

revoke all on function public.enroll_in_course(text)
  from public, anon, authenticated, service_role;
revoke all on function public.get_my_student_courses()
  from public, anon, authenticated, service_role;
revoke all on function public.get_student_course_details(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.get_student_course_sessions(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.get_student_session_archive(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.get_student_archive_questions(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.get_course_enrollment_count(uuid)
  from public, anon, authenticated, service_role;

grant execute on function public.enroll_in_course(text) to authenticated;
grant execute on function public.get_my_student_courses() to authenticated;
grant execute on function public.get_student_course_details(uuid) to authenticated;
grant execute on function public.get_student_course_sessions(uuid) to authenticated;
grant execute on function public.get_student_session_archive(uuid) to authenticated;
grant execute on function public.get_student_archive_questions(uuid) to authenticated;
grant execute on function public.get_course_enrollment_count(uuid) to authenticated;
