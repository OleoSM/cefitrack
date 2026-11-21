-- Pase de lista guardado por diferencias.
--
-- Antes, upsert_attendance_list borraba TODOS los registros de la sesión y
-- reinsertaba la lista que mandaba el cliente: con dos dispositivos sobre la
-- misma lista ganaba el último en guardar, y los registros de alumnos que el
-- cliente no conocía (dados de baja, fuera del alcance de un sub-admin) se
-- perdían al volver a guardar.
--
-- merge_attendance_list solo toca lo que cambió: agrega/actualiza los alumnos
-- de p_upserts y quita los de p_removes. Nada más se borra.
--
-- Regla de negocio (2026-11-20): solo un administrador puede borrar una lista
-- TERMINADA. Las listas sin terminar las puede descartar quien pasa lista.

create or replace function public.merge_attendance_list(
  p_group_id text,
  p_date date,
  p_tol_min integer,
  p_started_at_ms bigint,
  p_paused_at_ms bigint,
  p_paused_accum_ms bigint,
  p_finished boolean,
  p_upserts jsonb,
  p_removes text[]
) returns uuid
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $$
declare v_id uuid;
begin
  if not public.puede_ver_grupo(p_group_id) then raise exception 'forbidden'; end if;

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

  if coalesce(array_length(p_removes, 1), 0) > 0 then
    delete from attendance_records
     where session_id = v_id and student_id = any(p_removes);
  end if;

  insert into attendance_records (session_id, student_id, status, arrival_label)
  select v_id, r->>'student_id', coalesce(r->>'status', 'presente'), r->>'time'
    from jsonb_array_elements(coalesce(p_upserts, '[]'::jsonb)) r
  on conflict (session_id, student_id) do update
    set status = excluded.status,
        arrival_label = excluded.arrival_label;

  return v_id;
end;
$$;

revoke all on function public.merge_attendance_list(text, date, integer, bigint, bigint, bigint, boolean, jsonb, text[]) from public, anon;
grant execute on function public.merge_attendance_list(text, date, integer, bigint, bigint, bigint, boolean, jsonb, text[]) to authenticated;

create or replace function public.delete_attendance_list(p_group_id text, p_date date)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.puede_ver_grupo(p_group_id) then raise exception 'forbidden'; end if;
  if not public.es_admin() and exists (
    select 1 from attendance_sessions
     where group_id = p_group_id and session_date = p_date and finished
  ) then
    raise exception 'solo_admin_borra_terminadas';
  end if;
  delete from attendance_sessions where group_id = p_group_id and session_date = p_date;
end;
$$;
