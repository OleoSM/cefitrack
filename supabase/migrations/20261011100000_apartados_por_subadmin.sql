-- Apartados del panel que puede ver cada sub-admin. Los decide un admin.
-- Antes Pagos y Enviar correos estaban cerrados a TODOS los sub-admins y el
-- resto abierto a todos. Ahora cada sub-admin tiene su lista; sin fila, recibe
-- la de siempre (todo menos pagos y correos), para no cambiar a nadie de golpe.
-- El admin lo ve todo. "Acceso y Disposición" nunca es delegable: daría al
-- sub-admin la llave para darse más permisos a sí mismo.
--
-- Pagos y correos se bloquean también en el servidor (RPC y políticas); el
-- (Aplicada en remoto en 3 partes: apartados_por_subadmin, apartados_alta_y_pagos,
-- apartados_politicas_pagos_correos.)
-- resto de apartados se oculta en la interfaz y su información ya está acotada
-- a los grupos del sub-admin por RLS.

create table if not exists public.apartados_personal (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  apartados  text[] not null default '{}',
  updated_at timestamptz not null default now(),
  updated_by uuid
);
alter table public.apartados_personal enable row level security;
drop policy if exists "leer apartados" on public.apartados_personal;
create policy "leer apartados" on public.apartados_personal for select to authenticated
  using (public.es_admin() or user_id = (select auth.uid()));
revoke insert, update, delete on public.apartados_personal from anon, authenticated;

create or replace function public.apartados_catalogo() returns text[]
language sql immutable as $$
  select array['grupos','alumnos','calificaciones','asistencias','evaluaciones',
               'pagos','correos','terminos','configuracion','rankings']
$$;

create or replace function public.apartados_por_defecto() returns text[]
language sql immutable as $$
  select array['grupos','alumnos','calificaciones','asistencias','evaluaciones',
               'terminos','configuracion','rankings']
$$;

-- Interna: sin grant a clientes.
create or replace function public._apartados_de(p_user uuid) returns text[]
language sql stable security definer set search_path = public as $$
  select case p.role
           when 'admin' then public.apartados_catalogo()
           when 'sub_admin' then coalesce((select a.apartados from apartados_personal a where a.user_id = p.id),
                                          public.apartados_por_defecto())
           else '{}'::text[] end
  from profiles p where p.id = p_user and coalesce(p.activo, true)
$$;
revoke execute on function public._apartados_de(uuid) from public, anon, authenticated;

create or replace function public.mis_apartados() returns text[]
language sql stable security definer set search_path = public as $$
  select coalesce(public._apartados_de(auth.uid()), '{}'::text[])
$$;

create or replace function public.tiene_apartado(p_apartado text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.es_admin()
      or (public.auth_role() = 'sub_admin' and p_apartado = any(public._apartados_de(auth.uid())))
$$;

-- Lista para Acceso y Disposición (solo admin): apartados efectivos de cada sub-admin.
create or replace function public.list_apartados_personal()
returns table(user_id uuid, apartados text[], personalizado boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.es_admin() then raise exception 'solo_admin'; end if;
  return query
  select p.id, public._apartados_de(p.id), exists (select 1 from apartados_personal a where a.user_id = p.id)
  from profiles p where p.role = 'sub_admin';
end $$;

create or replace function public.admin_set_apartados(p_user uuid, p_apartados text[])
returns text[] language plpgsql security definer set search_path = public as $$
declare v_role text; v_limpio text[];
begin
  if not public.es_admin() then raise exception 'solo_admin'; end if;
  select role into v_role from profiles where id = p_user;
  if not found then raise exception 'cuenta_no_encontrada'; end if;
  if v_role <> 'sub_admin' then raise exception 'solo_sub_admin'; end if;
  if exists (select 1 from unnest(coalesce(p_apartados, '{}')) x where x <> all(public.apartados_catalogo())) then
    raise exception 'apartado_invalido';
  end if;
  -- Orden canónico y sin repetidos.
  select coalesce(array_agg(c order by o), '{}') into v_limpio
  from unnest(public.apartados_catalogo()) with ordinality t(c, o)
  where c = any(coalesce(p_apartados, '{}'));
  insert into apartados_personal(user_id, apartados, updated_at, updated_by)
  values (p_user, v_limpio, now(), auth.uid())
  on conflict (user_id) do update set apartados = excluded.apartados, updated_at = now(), updated_by = auth.uid();
  return v_limpio;
end $$;

-- Alta de personal desde el panel: admin o sub-admin (este con sus apartados).
-- Antes el cliente solo podía crear alumnos y sub-admins.
create or replace function public.create_user_with_password(p_name text, p_email text, p_password text, p_role text)
returns table(id text, name text, email text, role text)
language plpgsql security definer set search_path = public as $$
declare v_uid uuid;
begin
  if not es_admin() then raise exception 'solo_admin'; end if;
  if p_role not in ('student','sub_admin','admin') then raise exception 'role_not_allowed_from_client'; end if;
  if exists (select 1 from auth.users a where lower(a.email) = lower(p_email))
     or exists (select 1 from users u where lower(u.email) = lower(p_email)) then
    raise exception 'email_already_exists';
  end if;
  insert into users (name, email, password_hash, role)
  values (p_name, lower(p_email), extensions.crypt(p_password, extensions.gen_salt('bf')), p_role);
  v_uid := sincronizar_acceso(p_email, p_password, p_name, p_role, null);
  return query select v_uid::text, p_name, lower(p_email), p_role;
end $$;

create or replace function public.crear_personal(p_name text, p_email text, p_password text, p_role text, p_apartados text[])
returns table(id text, name text, email text, role text)
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if not public.es_admin() then raise exception 'solo_admin'; end if;
  if p_role not in ('sub_admin','admin') then raise exception 'role_not_allowed_from_client'; end if;
  if length(coalesce(p_password, '')) < 6 then raise exception 'contrasena_corta'; end if;
  if trim(coalesce(p_name, '')) = '' then raise exception 'nombre_vacio'; end if;
  select * into r from public.create_user_with_password(trim(p_name), trim(p_email), p_password, p_role);
  if p_role = 'sub_admin' then
    perform public.admin_set_apartados(r.id::uuid, coalesce(p_apartados, public.apartados_por_defecto()));
  end if;
  return query select r.id, r.name, r.email, r.role;
end $$;

-- ── Pagos: admin, o sub-admin con el apartado y el alumno en sus grupos ─────
create or replace function public.exigir_pagos_alumno(p_student_id text) returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if public.es_admin() then return; end if;
  if not public.tiene_apartado('pagos') or not public.puede_gestionar_alumno(p_student_id) then
    raise exception 'solo_admin_puede_gestionar_pagos';
  end if;
end $$;

create or replace function public.guardar_plan_pago(p_id uuid, p_student_id text, p_total numeric,
  p_modalidad text default 'mensualidades', p_mensualidades integer default 1, p_inicio date default null,
  p_concepto text default 'Curso', p_notas text default null, p_activo boolean default true)
returns planes_pago language plpgsql security definer set search_path = public as $$
declare v_row planes_pago;
        v_inicio date := coalesce(date_trunc('month', p_inicio)::date, date_trunc('month', current_date)::date);
        v_meses integer := case when p_modalidad = 'contado' then 1 else greatest(1, coalesce(p_mensualidades, 1)) end;
        v_previo text;
begin
  if not exists (select 1 from students s where s.id = p_student_id) then raise exception 'student_not_found'; end if;
  perform exigir_pagos_alumno(p_student_id);
  if p_id is null then
    insert into planes_pago (student_id, concepto, total, modalidad, mensualidades, inicio, notas, activo, created_by)
    values (p_student_id, coalesce(nullif(p_concepto,''), 'Curso'), p_total,
            p_modalidad, v_meses, v_inicio, p_notas, coalesce(p_activo, true), auth.uid())
    returning * into v_row;
  else
    select student_id into v_previo from planes_pago where id = p_id;
    if v_previo is null then raise exception 'plan_not_found'; end if;
    perform exigir_pagos_alumno(v_previo);
    update planes_pago
    set concepto = coalesce(nullif(p_concepto,''), 'Curso'),
        total = p_total, modalidad = p_modalidad, mensualidades = v_meses,
        inicio = v_inicio, notas = p_notas, activo = coalesce(p_activo, true)
    where id = p_id
    returning * into v_row;
  end if;
  return v_row;
end $$;

create or replace function public.registrar_pago_v2(p_id uuid, p_plan_id uuid, p_monto numeric, p_metodo text,
  p_fecha date default null, p_periodo date default null, p_cubre_total boolean default false,
  p_concepto text default 'Pago de curso', p_referencia text default null, p_nota text default null,
  p_registrado_por text default null, p_es_inscripcion boolean default false)
returns pagos language plpgsql security definer set search_path = public as $$
declare v_row public.pagos; v_student text; v_quien text;
begin
  select student_id into v_student from public.planes_pago where id = p_plan_id;
  if v_student is null then raise exception 'plan_not_found'; end if;
  perform public.exigir_pagos_alumno(v_student);
  if p_id is not null and not exists (select 1 from public.pagos x where x.id = p_id and x.student_id = v_student) then
    raise exception 'pago_not_found';
  end if;
  v_quien := nullif(trim(p_registrado_por),'');
  if v_quien is null then raise exception 'falta_quien_registra'; end if;
  if coalesce(p_es_inscripcion,false) then p_periodo := null; p_cubre_total := false; end if;
  if p_id is null then
    insert into public.pagos(plan_id,student_id,monto,metodo,fecha,periodo,cubre_total,concepto,
                             referencia,nota,registrado_por,es_inscripcion,created_by)
    values(p_plan_id,v_student,p_monto,p_metodo,coalesce(p_fecha,(now() at time zone 'America/Mexico_City')::date),
      case when p_cubre_total then null else date_trunc('month',p_periodo)::date end,
      coalesce(p_cubre_total,false),
      coalesce(nullif(trim(p_concepto),''), case when coalesce(p_es_inscripcion,false) then 'Inscripción' else 'Pago de curso' end),
      p_referencia,p_nota,v_quien,coalesce(p_es_inscripcion,false),(select auth.uid()))
    returning * into v_row;
  else
    update public.pagos set monto=p_monto,metodo=p_metodo,fecha=coalesce(p_fecha,(now() at time zone 'America/Mexico_City')::date),
      periodo=case when p_cubre_total then null else date_trunc('month',p_periodo)::date end,
      cubre_total=coalesce(p_cubre_total,false),
      concepto=coalesce(nullif(trim(p_concepto),''),'Pago de curso'),
      referencia=p_referencia,nota=p_nota,registrado_por=v_quien,
      es_inscripcion=coalesce(p_es_inscripcion,false)
     where id=p_id returning * into v_row;
  end if;
  return v_row;
end $$;

create or replace function public.set_inscripcion_plan(p_plan_id uuid, p_inscripcion numeric)
returns void language plpgsql security definer set search_path = public as $$
declare v_student text;
begin
  select student_id into v_student from public.planes_pago where id = p_plan_id;
  if v_student is null then raise exception 'plan_not_found'; end if;
  perform public.exigir_pagos_alumno(v_student);
  update public.planes_pago
     set inscripcion = case when coalesce(p_inscripcion,0) > 0 then p_inscripcion else null end
   where id = p_plan_id;
end $$;

create or replace function public.borrar_pago(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_student text;
begin
  select student_id into v_student from pagos where id = p_id;
  if v_student is null then raise exception 'pago_not_found'; end if;
  perform exigir_pagos_alumno(v_student);
  delete from pagos where id = p_id;
end $$;

create or replace function public.borrar_plan_pago(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_student text;
begin
  select student_id into v_student from planes_pago where id = p_id;
  if v_student is null then raise exception 'plan_not_found'; end if;
  perform exigir_pagos_alumno(v_student);
  if exists (select 1 from pagos where plan_id = p_id) then raise exception 'plan_con_pagos'; end if;
  delete from planes_pago where id = p_id;
end $$;

-- Lectura de pagos: el sub-admin solo con el apartado (antes bastaba el grupo).
alter policy "leer pagos" on public.pagos using (
  public.es_admin() or student_id = public.mi_student_id()
  or (public.tiene_apartado('pagos') and exists (select 1 from students s where s.id = pagos.student_id and public.puede_ver_grupo(s.group_id))));
alter policy "leer planes de pago" on public.planes_pago using (
  public.es_admin() or student_id = public.mi_student_id()
  or (public.tiene_apartado('pagos') and exists (select 1 from students s where s.id = planes_pago.student_id and public.puede_ver_grupo(s.group_id))));

-- ── Correos: sub-admin con el apartado, solo a alumnos de sus grupos ────────
alter policy "admin gestiona correos" on public.email_drafts
  using (public.es_admin() or (public.tiene_apartado('correos') and created_by = (select auth.uid())))
  with check (public.es_admin() or (public.tiene_apartado('correos') and created_by = (select auth.uid())));
alter policy "admin crea notificaciones" on public.notifications
  with check (created_by = (select auth.uid()) and (public.es_admin()
    or (public.tiene_apartado('correos') and recipient_student_id is not null
        and public.puede_gestionar_alumno(recipient_student_id))));

revoke execute on function public.apartados_catalogo(), public.apartados_por_defecto(), public.mis_apartados(),
  public.tiene_apartado(text), public.list_apartados_personal(), public.admin_set_apartados(uuid, text[]),
  public.create_user_with_password(text,text,text,text), public.crear_personal(text,text,text,text,text[]),
  public.exigir_pagos_alumno(text), public.guardar_plan_pago(uuid,text,numeric,text,integer,date,text,text,boolean),
  public.registrar_pago_v2(uuid,uuid,numeric,text,date,date,boolean,text,text,text,text,boolean),
  public.set_inscripcion_plan(uuid,numeric), public.borrar_pago(uuid), public.borrar_plan_pago(uuid)
  from public, anon;
grant execute on function public.apartados_catalogo(), public.apartados_por_defecto(), public.mis_apartados(),
  public.tiene_apartado(text), public.list_apartados_personal(), public.admin_set_apartados(uuid, text[]),
  public.create_user_with_password(text,text,text,text), public.crear_personal(text,text,text,text,text[]),
  public.exigir_pagos_alumno(text), public.guardar_plan_pago(uuid,text,numeric,text,integer,date,text,text,boolean),
  public.registrar_pago_v2(uuid,uuid,numeric,text,date,date,boolean,text,text,text,text,boolean),
  public.set_inscripcion_plan(uuid,numeric), public.borrar_pago(uuid), public.borrar_plan_pago(uuid)
  to authenticated;
