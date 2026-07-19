-- RPCs del portal del alumno: firma de términos y registro QR con retardo
-- calculado en el servidor a partir del cronómetro de tolerancia de la sesión.

create or replace function public.sign_terms(p_student_id text)
returns table(terms_status text, signed_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  return query
  update students s
  set terms_status = 'firmado', signed_at = now()
  where s.id = p_student_id
  returning s.terms_status, s.signed_at;
end;
$$;

-- p_status null → el servidor decide presente/tardanza según la tolerancia
-- de la sesión (started_at_ms + tol_min, descontando pausas).
create or replace function public.register_attendance(p_token text, p_student_id text, p_status text default null)
returns table(id uuid, session_id uuid, student_id text, status text, scanned_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare
  v_session attendance_sessions;
  v_status text;
  v_label text;
begin
  select * into v_session
  from attendance_sessions s
  where s.token = p_token and s.expires_at > now()
  order by s.created_at desc limit 1;
  if v_session.id is null then
    raise exception 'invalid_or_expired_token';
  end if;

  -- el alumno debe pertenecer al grupo de la sesión
  if not exists (select 1 from students st where st.id = p_student_id and st.group_id = v_session.group_id) then
    raise exception 'student_not_in_group';
  end if;

  if p_status is not null then
    v_status := p_status;
  elsif v_session.tol_min is not null and v_session.started_at_ms is not null then
    v_status := case
      when (extract(epoch from now()) * 1000
            - v_session.started_at_ms
            - coalesce(v_session.paused_accum_ms, 0)) / 1000 > v_session.tol_min * 60
      then 'tardanza' else 'presente' end;
  else
    v_status := 'presente';
  end if;

  v_label := to_char(now() at time zone 'America/Mexico_City', 'HH24:MI');

  return query
  insert into attendance_records as r (session_id, student_id, status, arrival_label)
  values (v_session.id, p_student_id, v_status, v_label)
  on conflict (session_id, student_id)
    do update set scanned_at = r.scanned_at  -- ya registrado: no se sobreescribe
  returning r.id, r.session_id, r.student_id, r.status, r.scanned_at;
end;
$$;

revoke all on function public.sign_terms(text) from public;
grant execute on function public.sign_terms(text) to anon, authenticated;
