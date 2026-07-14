-- Cover every column of the composite course-ownership foreign key while
-- preserving the ordering used by course detail queries.

drop index if exists public.sessions_course_created_at_idx;

create index sessions_course_owner_created_at_idx
  on public.sessions (course_id, professor_id, created_at desc);
