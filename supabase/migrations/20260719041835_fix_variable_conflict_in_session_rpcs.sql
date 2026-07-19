-- Fix: los nombres de columnas de retorno (group_id, session_date, etc.)
-- son ambiguos dentro de plpgsql frente a las columnas reales en ON CONFLICT.
-- #variable_conflict use_column resuelve a favor de la columna de la tabla.

create or replace function public.create_attendance_session(p_group_id text, p_session_date date, p_ttl_minutes int default 90)
returns table(id uuid, group_id text, session_date date, token text, expires_at timestamptz)
language plpgsql security definer set search_path = public, extensions as $$
#variable_conflict use_column
begin
  return query
  insert into attendance_sessions as s (group_id, session_date, token, expires_at)
  values (p_group_id, p_session_date, encode(extensions.gen_random_bytes(16), 'hex'), now() + make_interval(mins => p_ttl_minutes))
  on conflict (group_id, session_date) do update
    set token = encode(extensions.gen_random_bytes(16), 'hex'),
        expires_at = now() + make_interval(mins => p_ttl_minutes)
  returning s.id, s.group_id, s.session_date, s.token, s.expires_at;
end;
$$;

create or replace function public.register_attendance(p_token text, p_student_id text, p_status text default null)
returns table(id uuid, session_id uuid, student_id text, status text, scanned_at timestamptz)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
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
