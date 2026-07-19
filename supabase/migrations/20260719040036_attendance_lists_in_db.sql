-- Estado completo del pase de lista en la BD (antes vivía en localStorage):
-- cronómetro de tolerancia, banderas y hora de llegada mostrada en la UI.

alter table attendance_sessions
  add column tol_min int,
  add column started_at_ms bigint,
  add column paused_at_ms bigint,
  add column paused_accum_ms bigint not null default 0,
  add column finished boolean not null default false;

alter table attendance_sessions
  add constraint attendance_sessions_group_date_uidx unique (group_id, session_date);

alter table attendance_records add column arrival_label text;

-- create_attendance_session ahora reutiliza la sesión del día si ya existe
-- (renueva token y expiración) en vez de fallar por el unique constraint.
create or replace function public.create_attendance_session(p_group_id text, p_session_date date, p_ttl_minutes int default 90)
returns table(id uuid, group_id text, session_date date, token text, expires_at timestamptz)
language plpgsql security definer set search_path = public, extensions as $$
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

-- Guarda (upsert) la lista completa de un grupo+fecha: estado de sesión + registros.
create or replace function public.upsert_attendance_list(
  p_group_id text,
  p_date date,
  p_tol_min int,
  p_started_at_ms bigint,
  p_paused_at_ms bigint,
  p_paused_accum_ms bigint,
  p_finished boolean,
  p_records jsonb
)
returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare v_id uuid;
begin
  insert into attendance_sessions as s (group_id, session_date, token, expires_at, tol_min, started_at_ms, paused_at_ms, paused_accum_ms, finished)
  values (p_group_id, p_date, encode(extensions.gen_random_bytes(16), 'hex'), now() + interval '12 hours',
          p_tol_min, p_started_at_ms, p_paused_at_ms, coalesce(p_paused_accum_ms, 0), coalesce(p_finished, false))
  on conflict (group_id, session_date) do update
    set tol_min = excluded.tol_min,
        started_at_ms = excluded.started_at_ms,
        paused_at_ms = excluded.paused_at_ms,
        paused_accum_ms = excluded.paused_accum_ms,
        finished = excluded.finished
  returning s.id into v_id;

  delete from attendance_records where session_id = v_id;
  insert into attendance_records (session_id, student_id, status, arrival_label)
  select v_id, r->>'student_id', coalesce(r->>'status', 'presente'), r->>'time'
  from jsonb_array_elements(coalesce(p_records, '[]'::jsonb)) r;

  return v_id;
end;
$$;

create or replace function public.delete_attendance_list(p_group_id text, p_date date)
returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from attendance_sessions where group_id = p_group_id and session_date = p_date;
end;
$$;

revoke all on function public.upsert_attendance_list(text, date, int, bigint, bigint, bigint, boolean, jsonb) from public;
revoke all on function public.delete_attendance_list(text, date) from public;
grant execute on function public.upsert_attendance_list(text, date, int, bigint, bigint, bigint, boolean, jsonb) to anon, authenticated;
grant execute on function public.delete_attendance_list(text, date) to anon, authenticated;
