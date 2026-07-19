-- Endurecimiento RLS: se eliminan las políticas allow-all de escritura.
-- Lectura directa permitida (la app usa la anon key sin Supabase Auth);
-- toda escritura pasa por RPCs SECURITY DEFINER con validación server-side.

drop policy "dev all attendance_sessions" on attendance_sessions;
drop policy "dev all attendance_records" on attendance_records;
drop policy "dev all sub_admin_access" on sub_admin_access;

create policy "read attendance_sessions" on attendance_sessions for select using (true);
create policy "read attendance_records" on attendance_records for select using (true);
create policy "read sub_admin_access" on sub_admin_access for select using (true);

-- Crear sesión de asistencia con token aleatorio y expiración.
create or replace function public.create_attendance_session(p_group_id text, p_session_date date, p_ttl_minutes int default 90)
returns table(id uuid, group_id text, session_date date, token text, expires_at timestamptz)
language plpgsql security definer set search_path = public, extensions as $$
begin
  return query
  insert into attendance_sessions (group_id, session_date, token, expires_at)
  values (p_group_id, p_session_date, encode(extensions.gen_random_bytes(16), 'hex'), now() + make_interval(mins => p_ttl_minutes))
  returning attendance_sessions.id, attendance_sessions.group_id, attendance_sessions.session_date, attendance_sessions.token, attendance_sessions.expires_at;
end;
$$;

-- Registrar asistencia validando que el token de sesión esté vigente (flujo QR alumno).
create or replace function public.register_attendance(p_token text, p_student_id text, p_status text default 'presente')
returns table(id uuid, session_id uuid, student_id text, status text, scanned_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare v_session_id uuid;
begin
  select s.id into v_session_id
  from attendance_sessions s
  where s.token = p_token and s.expires_at > now()
  order by s.created_at desc limit 1;
  if v_session_id is null then
    raise exception 'invalid_or_expired_token';
  end if;
  return query
  insert into attendance_records (session_id, student_id, status)
  values (v_session_id, p_student_id, p_status)
  on conflict (session_id, student_id)
    do update set status = excluded.status, scanned_at = now()
  returning attendance_records.id, attendance_records.session_id, attendance_records.student_id, attendance_records.status, attendance_records.scanned_at;
end;
$$;

-- Pase de lista manual del admin (por id de sesión, sin token; la sesión puede estar expirada).
create or replace function public.set_attendance_status(p_session_id uuid, p_student_id text, p_status text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from attendance_sessions s where s.id = p_session_id) then
    raise exception 'session_not_found';
  end if;
  insert into attendance_records (session_id, student_id, status)
  values (p_session_id, p_student_id, p_status)
  on conflict (session_id, student_id)
    do update set status = excluded.status, scanned_at = now();
end;
$$;

-- Gestión de accesos de sub-admins.
create or replace function public.grant_sub_admin_access(p_user_id text, p_sucursal text, p_group_id text default null)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from users u where u.id = p_user_id and u.role = 'sub_admin') then
    raise exception 'user_not_sub_admin';
  end if;
  insert into sub_admin_access (user_id, sucursal, group_id) values (p_user_id, p_sucursal, p_group_id);
end;
$$;

create or replace function public.revoke_sub_admin_access(p_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from sub_admin_access where id = p_id;
end;
$$;

revoke all on function public.create_attendance_session(text, date, int) from public;
revoke all on function public.register_attendance(text, text, text) from public;
revoke all on function public.set_attendance_status(uuid, text, text) from public;
revoke all on function public.grant_sub_admin_access(text, text, text) from public;
revoke all on function public.revoke_sub_admin_access(uuid) from public;
grant execute on function public.create_attendance_session(text, date, int) to anon, authenticated;
grant execute on function public.register_attendance(text, text, text) to anon, authenticated;
grant execute on function public.set_attendance_status(uuid, text, text) to anon, authenticated;
grant execute on function public.grant_sub_admin_access(text, text, text) to anon, authenticated;
grant execute on function public.revoke_sub_admin_access(uuid) to anon, authenticated;
