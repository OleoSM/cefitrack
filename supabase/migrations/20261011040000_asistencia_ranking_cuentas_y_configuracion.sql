-- Correcciones de logica halladas en la auditoria QA del 2026-10-10.

-- ── 1. Asistencia del alumno ────────────────────────────────────────────────
-- Por RLS el alumno solo ve SUS attendance_records: en las sesiones a las que
-- falto, el embebido llegaba vacio, la sesion se descartaba como "no capturada"
-- y su asistencia salia siempre 100 %. Esta RPC decide en el servidor que
-- sesiones estan capturadas y devuelve 'ausente' donde no hay registro.
-- Capturada = lista terminada (finished) o con algun registro.
create or replace function public.asistencia_alumno(p_student_id text)
returns table(session_date date, status text, arrival_label text)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare v_group text;
begin
  if not (p_student_id = public.mi_student_id() or public.puede_gestionar_alumno(p_student_id)) then
    raise exception 'forbidden';
  end if;
  select st.group_id into v_group from students st where st.id = p_student_id;
  if v_group is null then return; end if;
  return query
  select s.session_date, coalesce(r.status, 'ausente'), r.arrival_label
  from attendance_sessions s
  left join attendance_records r on r.session_id = s.id and r.student_id = p_student_id
  where s.group_id = v_group
    and (s.finished or exists (select 1 from attendance_records x where x.session_id = s.id))
  order by s.session_date;
end $$;
revoke execute on function public.asistencia_alumno(text) from public, anon;
grant  execute on function public.asistencia_alumno(text) to authenticated;

-- ── 2. Datos del grupo para el lugar en el grupo ────────────────────────────
-- El alumno solo puede leer su propia fila de students, asi que su ranking
-- siempre era "#1 de 1". Esta RPC devuelve evaluaciones y asistencia de todo
-- el grupo; para un alumno, los companeros van ANONIMIZADOS (sin id real ni
-- nombre): solo necesita su posicion.
create or replace function public.metricas_grupo(p_group_id text)
returns table(member_id text, assignments_done int, assignments_total int, evaluaciones jsonb, asistencia jsonb)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare v_yo text := public.mi_student_id(); v_staff boolean := public.puede_ver_grupo(p_group_id);
begin
  if not (v_staff or exists (select 1 from students st where st.id = v_yo and st.group_id = p_group_id)) then
    raise exception 'forbidden';
  end if;
  return query
  with ses as (
    select s.id, s.session_date from attendance_sessions s
    where s.group_id = p_group_id
      and (s.finished or exists (select 1 from attendance_records x where x.session_id = s.id))
  ), mem as (
    select st.id, st.assignments_done, st.assignments_total,
           case when v_staff or st.id = v_yo then st.id
                else 'anon-' || row_number() over (order by st.id) end as clave
    from students st where st.group_id = p_group_id
  )
  select m.clave, m.assignments_done, m.assignments_total,
    coalesce((select jsonb_agg(jsonb_build_object(
                'id', case when m.clave = m.id then e.id end,
                'student_id', m.clave, 'materia', e.materia, 'tipo', e.tipo,
                'calificacion', e.calificacion, 'cal_max', e.cal_max,
                'fecha', e.fecha, 'periodo', e.periodo))
              from evaluations e where e.student_id = m.id), '[]'::jsonb),
    coalesce((select jsonb_agg(jsonb_build_object(
                'session_date', ss.session_date,
                'status', coalesce(r.status, 'ausente'),
                'arrival_label', r.arrival_label) order by ss.session_date)
              from ses ss
              left join attendance_records r on r.session_id = ss.id and r.student_id = m.id), '[]'::jsonb)
  from mem m;
end $$;
revoke execute on function public.metricas_grupo(text) from public, anon;
grant  execute on function public.metricas_grupo(text) to authenticated;

-- ── 3. Cuentas de acceso sincronizadas con el alumno ────────────────────────
-- update_student cambiaba el correo en students/users pero no en auth.users,
-- asi que el alumno no podia entrar con el correo nuevo. delete_student
-- dejaba viva la cuenta de auth.
do $mig$
declare def text; nuevo text;
begin
  def := pg_get_functiondef('public.update_student(text,text,text,text,text,text,text,text)'::regprocedure);
  if position('auth.identities' in def) = 0 then
    nuevo := replace(def,
      'update users set name = p_name, email = p_email where student_id = p_id;',
      'update users set name = p_name, email = p_email where student_id = p_id;
  update public.profiles set name = p_name, email = lower(p_email) where student_id = p_id;
  update auth.users set email = lower(p_email), updated_at = now()
   where id in (select pr.id from public.profiles pr where pr.student_id = p_id)
     and lower(email) is distinct from lower(p_email);
  update auth.identities
     set identity_data = identity_data || jsonb_build_object(''email'', lower(p_email)), updated_at = now()
   where provider = ''email''
     and user_id in (select pr.id from public.profiles pr where pr.student_id = p_id);');
    nuevo := replace(nuevo,
      '  update students
  set name = p_name',
      '  if exists (select 1 from auth.users a
             where lower(a.email) = lower(p_email)
               and a.id not in (select pr.id from public.profiles pr where pr.student_id = p_id)) then
    raise exception ''email_already_exists'';
  end if;
  update students
  set name = p_name');
    if nuevo = def or position('email_already_exists' in nuevo) = 0 then
      raise exception 'update_student: no se encontro el texto esperado';
    end if;
    execute nuevo;
  end if;

  def := pg_get_functiondef('public.delete_student(text)'::regprocedure);
  if position('auth.users' in def) = 0 then
    nuevo := replace(def,
      'delete from users where student_id = p_id;',
      'delete from auth.users where id in (select pr.id from public.profiles pr where pr.student_id = p_id);
  delete from users where student_id = p_id;');
    if nuevo = def then raise exception 'delete_student: no se encontro el texto esperado'; end if;
    execute nuevo;
  end if;

  -- Borrar una evaluacion ligada a una columna de la Hoja dejaba su celda en
  -- registro_valores: la Hoja mostraba una nota que ya no contaba.
  def := pg_get_functiondef('public.delete_evaluation(uuid)'::regprocedure);
  if position('registro_valores' in def) = 0 then
    nuevo := replace(def,
      'delete from evaluations where id = p_id;',
      'delete from public.registro_valores rv using public.evaluations e
   where e.id = p_id and e.columna_id is not null
     and rv.columna_id = e.columna_id and rv.student_id = e.student_id;
  delete from evaluations where id = p_id;');
    if nuevo = def then raise exception 'delete_evaluation: no se encontro el texto esperado'; end if;
    execute nuevo;
  end if;

  -- Fecha por defecto de un pago: el dia de Mexico, no el de UTC.
  def := pg_get_functiondef('public.registrar_pago_v2(uuid,uuid,numeric,text,date,date,boolean,text,text,text,text,boolean)'::regprocedure);
  if position('current_date' in def) > 0 then
    execute replace(def, 'current_date', '(now() at time zone ''America/Mexico_City'')::date');
  end if;
end
$mig$;

-- Cuentas de auth con rol student sin perfil (restos de pruebas de agosto):
-- seguian pudiendo iniciar sesion. Se bloquean (reversible), no se borran.
update auth.users u
   set banned_until = '9999-12-31 00:00:00+00'::timestamptz
 where u.raw_app_meta_data->>'role' = 'student'
   and u.banned_until is null
   and not exists (select 1 from public.profiles p where p.id = u.id);

-- El QR de sesion del salon se retiro de la app: nadie llama ya a esta RPC.
revoke execute on function public.register_attendance(text,text,text) from public, anon, authenticated;

-- ── 4. Configuracion global ─────────────────────────────────────────────────
-- Los pesos del promedio, la tolerancia y las notificaciones vivian en el
-- localStorage de quien los guardaba: cada navegador calculaba distinto.
create table if not exists public.configuracion (
  id             boolean primary key default true check (id),
  pesos          jsonb   not null default '{"examenes":70,"tareas":20,"asistencia":10}'::jsonb,
  tolerancia_min integer not null default 15 check (tolerancia_min between 0 and 120),
  notif          jsonb   not null default '{"nuevoExamen":true,"resultadoPublicado":true,"ausencia":true}'::jsonb,
  platform_name  text    not null default 'SIGA CEFIMAT',
  updated_at     timestamptz not null default now(),
  updated_by     uuid,
  constraint pesos_suman_100 check (
    (pesos->>'examenes')::int + (pesos->>'tareas')::int + (pesos->>'asistencia')::int = 100)
);
insert into public.configuracion default values on conflict do nothing;
alter table public.configuracion enable row level security;
drop policy if exists "configuracion lectura" on public.configuracion;
create policy "configuracion lectura" on public.configuracion
  for select to authenticated using (true);
drop policy if exists "configuracion escritura admin" on public.configuracion;
create policy "configuracion escritura admin" on public.configuracion
  for update to authenticated using (public.es_admin()) with check (public.es_admin());
revoke all on public.configuracion from anon, public;
grant select, update on public.configuracion to authenticated;
