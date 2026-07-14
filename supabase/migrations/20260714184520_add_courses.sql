-- Group class sessions into professor-owned courses. Existing sessions remain
-- valid because course_id is optional. The composite foreign key is the
-- database boundary that prevents cross-professor course assignment.

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  professor_id uuid not null default auth.uid()
    references auth.users (id) on delete cascade,
  name text not null,
  subject text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint courses_id_professor_id_key unique (id, professor_id),
  constraint courses_name_length check (
    char_length(name) <= 100
    and char_length(btrim(name)) >= 3
  ),
  constraint courses_subject_length check (
    char_length(subject) <= 80
    and char_length(btrim(subject)) >= 2
  ),
  constraint courses_description_length check (
    description is null
    or (
      char_length(description) <= 500
      and char_length(btrim(description)) > 0
    )
  )
);

create index courses_professor_created_at_idx
  on public.courses (professor_id, created_at desc);

comment on table public.courses is
  'Professor-owned courses used to organize class sessions.';

create or replace function private.set_courses_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function private.set_courses_updated_at()
  from public, anon, authenticated, service_role;

create trigger courses_set_updated_at
before update on public.courses
for each row
execute function private.set_courses_updated_at();

alter table public.sessions
  add column course_id uuid,
  add constraint sessions_course_owner_fkey
    foreign key (course_id, professor_id)
    references public.courses (id, professor_id)
    on delete set null (course_id);

-- Supports course detail queries and the referencing side of the ownership FK.
create index sessions_course_created_at_idx
  on public.sessions (course_id, created_at desc);

comment on column public.sessions.course_id is
  'Optional course container; composite FK guarantees the same professor owns both rows.';

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.courses enable row level security;

create policy courses_select_own
on public.courses
for select
to authenticated
using (professor_id = (select auth.uid()));

create policy courses_insert_own
on public.courses
for insert
to authenticated
with check (professor_id = (select auth.uid()));

create policy courses_update_own
on public.courses
for update
to authenticated
using (professor_id = (select auth.uid()))
with check (professor_id = (select auth.uid()));

create policy courses_delete_own
on public.courses
for delete
to authenticated
using (professor_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Data API privileges (separate from RLS)
-- ---------------------------------------------------------------------------

revoke all privileges on table public.courses
  from public, anon, authenticated, service_role;

grant select, delete on table public.courses to authenticated;
grant insert (professor_id, name, subject, description)
  on table public.courses to authenticated;
grant update (name, subject, description)
  on table public.courses to authenticated;

-- Existing session grants are column-scoped, so opt in the new client field.
grant insert (course_id) on table public.sessions to authenticated;
grant update (course_id) on table public.sessions to authenticated;
