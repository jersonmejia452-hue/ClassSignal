-- Cover every foreign-key lookup introduced by pulse-scoped data.

create index if not exists responses_pulse_session_fk_idx
  on public.responses (pulse_id, session_id);

create index if not exists session_analyses_pulse_session_fk_idx
  on public.session_analyses (pulse_id, session_id);

create index if not exists response_submission_buckets_pulse_session_fk_idx
  on private.response_submission_buckets (pulse_id, session_id);

create index if not exists response_submission_buckets_session_fk_idx
  on private.response_submission_buckets (session_id);
