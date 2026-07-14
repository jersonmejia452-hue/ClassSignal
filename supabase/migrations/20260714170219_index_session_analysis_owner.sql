-- Cover the composite ownership foreign key used during session updates and
-- cascades. The history index starts with session_id but not professor_id.
create index session_analyses_session_owner_idx
  on public.session_analyses (session_id, professor_id);
