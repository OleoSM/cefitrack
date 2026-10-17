-- Rachas (solo por asistencia), ranking mensual y avisos automáticos.
--
-- · rachas_grupo(): por alumno, racha actual (clases seguidas asistidas,
--   contando retardos), mejor racha, asistencias y sesiones. Solo cuentan las
--   sesiones terminadas o de días pasados: una clase en curso no rompe la racha.
-- · mi_racha(): lo mismo para el alumno con sesión (su tarjeta de liga).
-- · ranking_mensual(): puntaje = 50 % promedio + 30 % asistencia + 20 % racha
--   (la racha topa en 20 clases). Lo usa el correo del top mensual.
-- · avisos_enviados acepta 'recordatorio_actividad' y 'top_mensual'; los
--   borradores automáticos (tarea programada) pueden no tener autor.

alter table public.avisos_enviados drop constraint if exists avisos_enviados_tipo_check;
alter table public.avisos_enviados add constraint avisos_enviados_tipo_check
  check (tipo in ('actividad', 'material_nuevo', 'material_vence', 'recordatorio_actividad', 'top_mensual'));
alter table public.email_drafts alter column created_by drop not null;

create or replace function public._rachas_grupo(p_group_id text)
returns table(student_id text, racha_actual integer, mejor_racha integer, asistencias integer, sesiones integer)
language plpgsql stable security definer set search_path = public as $$
declare s record; ses record; cur int; best int; tot int; n int; hoy date := (now() at time zone 'America/Mexico_City')::date;
begin
  select count(*) into n from attendance_sessions a where a.group_id = p_group_id and (coalesce(a.finished, false) or a.session_date < hoy);
  for s in select st.id from students st where st.group_id = p_group_id loop
    cur := 0; best := 0; tot := 0;
    for ses in
      select r.status from attendance_sessions a
      left join attendance_records r on r.session_id = a.id and r.student_id = s.id
      where a.group_id = p_group_id and (coalesce(a.finished, false) or a.session_date < hoy)
      order by a.session_date, a.created_at
    loop
      if ses.status in ('presente', 'tardanza') then cur := cur + 1; tot := tot + 1; best := greatest(best, cur);
      else cur := 0; end if;
    end loop;
    student_id := s.id; racha_actual := cur; mejor_racha := best; asistencias := tot; sesiones := n;
    return next;
  end loop;
end $$;
revoke execute on function public._rachas_grupo(text) from public, anon, authenticated;

-- Personal del grupo (o tarea programada).
create or replace function public.rachas_grupo(p_group_id text)
returns table(student_id text, racha_actual integer, mejor_racha integer, asistencias integer, sesiones integer)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (coalesce(auth.role(), '') = 'service_role' or public.es_admin() or public.puede_ver_grupo(p_group_id)) then
    raise exception 'forbidden';
  end if;
  return query select * from public._rachas_grupo(p_group_id);
end $$;

-- El alumno con sesión: su propia racha.
create or replace function public.mi_racha()
returns table(racha_actual integer, mejor_racha integer, asistencias integer, sesiones integer)
language sql stable security definer set search_path = public as $$
  select r.racha_actual, r.mejor_racha, r.asistencias, r.sesiones
  from students s, public._rachas_grupo(s.group_id) r
  where s.id = public.mi_student_id() and r.student_id = s.id
$$;

-- Racha de un alumno para el personal (perfil del alumno).
create or replace function public.racha_alumno(p_student_id text)
returns table(racha_actual integer, mejor_racha integer, asistencias integer, sesiones integer)
language plpgsql stable security definer set search_path = public as $$
declare v_grupo text;
begin
  if not public.puede_gestionar_alumno(p_student_id) then raise exception 'forbidden'; end if;
  select group_id into v_grupo from students where id = p_student_id;
  return query select r.racha_actual, r.mejor_racha, r.asistencias, r.sesiones
    from public._rachas_grupo(v_grupo) r where r.student_id = p_student_id;
end $$;

create or replace function public.ranking_mensual(p_group_id text)
returns table(student_id text, nombre text, promedio numeric, asistencia numeric, racha integer, puntaje numeric, posicion integer)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (coalesce(auth.role(), '') = 'service_role' or public.es_admin() or public.puede_ver_grupo(p_group_id)) then
    raise exception 'forbidden';
  end if;
  return query
  with r as (select * from public._rachas_grupo(p_group_id)),
  b as (
    select s.id, s.name, coalesce(s.avg_grade, 0)::numeric prom,
           case when coalesce(r.sesiones, 0) > 0 then round(r.asistencias * 100.0 / r.sesiones, 1) else 0 end asis,
           coalesce(r.racha_actual, 0) rac
    from students s left join r on r.student_id = s.id
    where s.group_id = p_group_id
  ),
  c as (select b.*, round(b.prom * 10 * 0.5 + b.asis * 0.3 + least(b.rac, 20) * 5 * 0.2, 1) pts from b)
  select c.id, c.name, c.prom, c.asis, c.rac, c.pts, (rank() over (order by c.pts desc))::int
  from c order by c.pts desc, c.name;
end $$;

revoke execute on function public.rachas_grupo(text), public.mi_racha(), public.racha_alumno(text), public.ranking_mensual(text) from public, anon;
grant execute on function public.rachas_grupo(text), public.mi_racha(), public.racha_alumno(text), public.ranking_mensual(text) to authenticated, service_role;
grant execute on function public._rachas_grupo(text) to service_role;
