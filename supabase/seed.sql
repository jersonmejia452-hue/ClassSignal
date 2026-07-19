-- Optional demonstration data.
--
-- Auth users must be created through Supabase Auth, not inserted directly into
-- auth.users. Therefore this seed is intentionally conditional: after at least
-- one professor has registered, running it adds one demo session, resolves its
-- automatically created Pulso 1 and attaches five responses to that pulse. With
-- no Auth users it is a safe no-op.

do $$
declare
  demo_professor_id uuid;
  demo_session_id constant uuid := '00000000-0000-4000-8000-000000000001';
  demo_pulse_id uuid;
begin
  select auth_user.id
  into demo_professor_id
  from auth.users as auth_user
  order by auth_user.created_at asc
  limit 1;

  if demo_professor_id is null then
    raise notice 'Demo seed skipped: register a professor through Supabase Auth first.';
    return;
  end if;

  insert into public.sessions (
    id,
    professor_id,
    code,
    title,
    subject,
    topic,
    is_active
  )
  values (
    demo_session_id,
    demo_professor_id,
    'AULA24',
    'Clase de demostración',
    'Cálculo diferencial',
    'Regla de la cadena',
    true
  )
  on conflict do nothing;

  -- If the deterministic id/code collided with unrelated data, do not attach
  -- demo responses to somebody else's session.
  if not exists (
    select 1
    from public.sessions
    where id = demo_session_id
      and professor_id = demo_professor_id
      and code = 'AULA24'
  ) then
    raise notice 'Demo seed skipped: the deterministic session id or code is already in use.';
    return;
  end if;

  select pulse.id
  into demo_pulse_id
  from public.session_pulses as pulse
  where pulse.session_id = demo_session_id
    and pulse.ordinal = 1
  limit 1;

  if demo_pulse_id is null then
    raise notice 'Demo seed skipped: Pulso 1 was not created. Apply all migrations first.';
    return;
  end if;

  insert into public.responses (
    id,
    session_id,
    pulse_id,
    anonymous_id,
    status,
    question_text
  )
  values
    (
      '00000000-0000-4000-8000-000000000101',
      demo_session_id,
      demo_pulse_id,
      '10000000-0000-4000-8000-000000000001',
      'understood',
      null
    ),
    (
      '00000000-0000-4000-8000-000000000102',
      demo_session_id,
      demo_pulse_id,
      '10000000-0000-4000-8000-000000000002',
      'understood',
      '¿Podemos ver otro ejemplo con funciones trigonométricas?'
    ),
    (
      '00000000-0000-4000-8000-000000000103',
      demo_session_id,
      demo_pulse_id,
      '10000000-0000-4000-8000-000000000003',
      'question',
      'No entendí cuándo se multiplica por la derivada interna.'
    ),
    (
      '00000000-0000-4000-8000-000000000104',
      demo_session_id,
      demo_pulse_id,
      '10000000-0000-4000-8000-000000000004',
      'question',
      null
    ),
    (
      '00000000-0000-4000-8000-000000000105',
      demo_session_id,
      demo_pulse_id,
      '10000000-0000-4000-8000-000000000005',
      'lost',
      'Me perdí desde la composición de funciones.'
    )
  on conflict do nothing;
end
$$;
