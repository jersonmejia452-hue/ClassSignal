-- Make the intentional RPC-only enrollment boundary explicit to database
-- tooling, and give the private rate-limit ledger a stable row identifier.

alter table private.course_enrollment_attempts
  add column id bigint generated always as identity primary key;

create policy "Course enrollments are RPC only"
on public.course_enrollments
for all
to authenticated
using (false)
with check (false);
