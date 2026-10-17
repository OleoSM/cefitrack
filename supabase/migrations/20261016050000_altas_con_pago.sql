-- Altas y bajas de alumnos (pedido de CEFIMAT, 2026-10-16):
--  · Solo puede dar de alta o de baja quien tenga el permiso "altas".
--  · Los dueños (Dayan y Mauricio) lo tienen siempre y son los ÚNICOS que
--    deciden quién más lo tiene. Los demás super admins lo tienen por defecto
--    (un dueño se lo puede quitar); los sub-admins no, salvo que un dueño se
--    lo dé (Karen Andrade, atención a clientes, ya habilitada).
--  · Un alumno solo se da de alta junto con su plan de pago y su primer
--    importe, en una sola operación (todo o nada): create_student deja de ser
--    llamable desde el cliente y se usa alta_alumno_con_pago.

create table if not exists public.duenos (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.duenos enable row level security;
revoke all on public.duenos from anon, authenticated;
insert into public.duenos (user_id)
  select id from public.profiles where email in ('dayan.everardo@siga.mx', 'mauricio.hernandez@siga.mx')
  on conflict do nothing;

create or replace function public.es_dueno() returns boolean
language sql stable security definer set search_path = public as $$
  select public.es_admin() and exists (select 1 from duenos where user_id = auth.uid())
$$;

create table if not exists public.permiso_altas (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  puede      boolean not null,
  updated_by uuid default auth.uid(),
  updated_at timestamptz not null default now()
);
alter table public.permiso_altas enable row level security;
drop policy if exists "ver permiso altas" on public.permiso_altas;
create policy "ver permiso altas" on public.permiso_altas for select to authenticated
  using (public.es_admin() or user_id = (select auth.uid()));
revoke insert, update, delete on public.permiso_altas from anon, authenticated;
insert into public.permiso_altas (user_id, puede)
  select id, true from public.profiles where email = 'karen.andrade@cefimat.mx'
  on conflict (user_id) do update set puede = true;

-- Dueño: siempre. Admin: sí, salvo que un dueño se lo haya quitado. Sub-admin: solo si se lo dieron.
create or replace function public.puede_dar_altas() returns boolean
language sql stable security definer set search_path = public as $$
  select public.auth_role() in ('admin', 'sub_admin') and (
    public.es_dueno()
    or coalesce((select puede from permiso_altas where user_id = auth.uid()), public.es_admin()))
$$;

create or replace function public.set_permiso_altas(p_user uuid, p_puede boolean) returns void
language plpgsql security definer set search_path = public as $$
declare v_role text;
begin
  if not public.es_dueno() then raise exception 'solo_duenos'; end if;
  if exists (select 1 from duenos where user_id = p_user) then raise exception 'dueno_no_editable'; end if;
  select role into v_role from profiles where id = p_user;
  if v_role is null then raise exception 'cuenta_no_encontrada'; end if;
  if v_role not in ('admin', 'sub_admin') then raise exception 'solo_personal'; end if;
  insert into permiso_altas (user_id, puede, updated_by, updated_at) values (p_user, p_puede, auth.uid(), now())
  on conflict (user_id) do update set puede = excluded.puede, updated_by = excluded.updated_by, updated_at = now();
end $$;

-- Lista para Acceso y Disposición: la ven todos los admins; solo los dueños editan.
create or replace function public.list_permiso_altas()
returns table(user_id uuid, nombre text, email text, rol text, puede boolean, es_dueno boolean, personalizado boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.es_admin() then raise exception 'solo_admin'; end if;
  return query
  select p.id, p.name, p.email, p.role,
         (d.user_id is not null) or coalesce(pa.puede, p.role = 'admin'),
         d.user_id is not null, pa.user_id is not null
  from profiles p
  left join duenos d on d.user_id = p.id
  left join permiso_altas pa on pa.user_id = p.id
  where p.role in ('admin', 'sub_admin') and coalesce(p.activo, true)
  order by (d.user_id is not null) desc, p.role, p.name;
end $$;

-- create_student exige el permiso de altas (y sigue acotado a los grupos del sub-admin).
create or replace function public.create_student(p_name text, p_email text, p_group_id text, p_password text,
  p_tutor_name text default null, p_tutor_email text default null, p_tutor_phone text default null, p_sucursal text default null)
returns table(id text, name text, email text, group_id text)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare v_student_id text;
begin
  if not public.puede_dar_altas() then raise exception 'sin_permiso_altas'; end if;
  if not (public.es_admin() or (case when p_group_id is not null then public.puede_ver_grupo(p_group_id) else public.puede_sucursal(p_sucursal) end)) then
    raise exception 'forbidden';
  end if;
  if p_group_id is not null and not exists (select 1 from groups g where g.id = p_group_id) then
    raise exception 'group_not_found';
  end if;
  if exists (select 1 from users u where lower(u.email) = lower(p_email))
     or exists (select 1 from auth.users a where lower(a.email) = lower(p_email)) then
    raise exception 'email_already_exists';
  end if;

  insert into students (name, email, group_id, tutor_name, tutor_email, tutor_phone, sucursal)
  values (p_name, lower(p_email), p_group_id, p_tutor_name, p_tutor_email, p_tutor_phone, p_sucursal)
  returning students.id into v_student_id;

  insert into users (id, name, email, password_hash, role, student_id)
  values (v_student_id, p_name, lower(p_email),
          extensions.crypt(p_password, extensions.gen_salt('bf')), 'student', v_student_id);

  perform sincronizar_acceso(p_email, p_password, p_name, 'student', v_student_id);

  return query select s.id, s.name, s.email, s.group_id from students s where s.id = v_student_id;
end $$;

create or replace function public.delete_student(p_id text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.puede_dar_altas() then raise exception 'sin_permiso_altas'; end if;
  if not public.puede_gestionar_alumno(p_id) then raise exception 'forbidden'; end if;
  delete from auth.users where id in (select pr.id from public.profiles pr where pr.student_id = p_id);
  delete from users where student_id = p_id;
  delete from students where id = p_id;
end $$;

-- Alta + plan de pago + primer importe, todo o nada.
create or replace function public.alta_alumno_con_pago(
  p_name text, p_email text, p_group_id text, p_password text,
  p_tutor_name text, p_tutor_email text, p_tutor_phone text, p_sucursal text,
  p_total numeric, p_modalidad text, p_mensualidades integer, p_inicio date, p_concepto text,
  p_monto numeric, p_metodo text, p_es_inscripcion boolean default false, p_referencia text default null)
returns table(id text, name text, email text, group_id text, plan_id uuid, pago_id uuid)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare v_alumno record; v_plan uuid; v_pago uuid; v_quien text;
        v_meses integer := case when p_modalidad = 'contado' then 1 else greatest(1, coalesce(p_mensualidades, 1)) end;
        v_inicio date := coalesce(date_trunc('month', p_inicio)::date, date_trunc('month', current_date)::date);
begin
  if coalesce(p_total, -1) < 0 then raise exception 'falta_total'; end if;
  if p_modalidad not in ('contado', 'mensualidades') then raise exception 'modalidad_invalida'; end if;
  -- Primer importe obligatorio; solo una beca completa (total 0) puede registrarse en 0.
  if coalesce(p_monto, -1) < 0 or (p_total > 0 and p_monto <= 0) then raise exception 'falta_primer_pago'; end if;
  if not coalesce(p_es_inscripcion, false) and p_total > 0 and p_monto > p_total then raise exception 'pago_mayor_al_total'; end if;
  if nullif(trim(coalesce(p_metodo, '')), '') is null then raise exception 'falta_metodo'; end if;

  select * into v_alumno from public.create_student(p_name, p_email, p_group_id, p_password,
    p_tutor_name, p_tutor_email, p_tutor_phone, p_sucursal);

  insert into planes_pago (student_id, concepto, total, modalidad, mensualidades, inicio, activo, created_by)
  values (v_alumno.id, coalesce(nullif(trim(p_concepto), ''), 'Curso'), p_total, p_modalidad, v_meses, v_inicio, true, auth.uid())
  returning planes_pago.id into v_plan;

  select coalesce(nullif(p.name, ''), p.email) into v_quien from profiles p where p.id = auth.uid();
  insert into pagos (plan_id, student_id, monto, metodo, fecha, periodo, cubre_total, concepto, referencia,
                     registrado_por, es_inscripcion, created_by)
  values (v_plan, v_alumno.id, p_monto, p_metodo, (now() at time zone 'America/Mexico_City')::date,
          case when coalesce(p_es_inscripcion, false) or (p_modalidad = 'contado' and p_monto >= p_total) then null else v_inicio end,
          not coalesce(p_es_inscripcion, false) and p_modalidad = 'contado' and p_monto >= p_total,
          case when coalesce(p_es_inscripcion, false) then 'Inscripción' else 'Primer pago' end,
          p_referencia, coalesce(v_quien, 'SIGA'), coalesce(p_es_inscripcion, false), auth.uid())
  returning pagos.id into v_pago;

  return query select v_alumno.id, v_alumno.name, v_alumno.email, v_alumno.group_id, v_plan, v_pago;
end $$;

-- Permisos de ejecución: sin anon; create_student solo por dentro.
revoke execute on function public.es_dueno(), public.puede_dar_altas(), public.list_permiso_altas(),
  public.set_permiso_altas(uuid, boolean), public.alta_alumno_con_pago(text, text, text, text, text, text, text, text, numeric, text, integer, date, text, numeric, text, boolean, text),
  public.delete_student(text)
  from public, anon;
grant execute on function public.es_dueno(), public.puede_dar_altas(), public.list_permiso_altas(),
  public.set_permiso_altas(uuid, boolean), public.alta_alumno_con_pago(text, text, text, text, text, text, text, text, numeric, text, integer, date, text, numeric, text, boolean, text),
  public.delete_student(text)
  to authenticated;
-- Aplicado el 2026-10-16 tras publicar el frontend nuevo (commit 5a5f183):
revoke execute on function public.create_student(text, text, text, text, text, text, text, text) from public, anon, authenticated;

-- 2026-10-16: nadie debe ver que los dueños tienen privilegios extra. La lista
-- ya no los ordena primero y solo otro dueño recibe es_dueno = true.
create or replace function public.list_permiso_altas()
returns table(user_id uuid, nombre text, email text, rol text, puede boolean, es_dueno boolean, personalizado boolean)
language plpgsql stable security definer set search_path = public as $$
declare v_soy_dueno boolean := public.es_dueno();
begin
  if not public.es_admin() then raise exception 'solo_admin'; end if;
  return query
  select p.id, p.name, p.email, p.role,
         (d.user_id is not null) or coalesce(pa.puede, p.role = 'admin'),
         v_soy_dueno and d.user_id is not null,
         pa.user_id is not null
  from profiles p
  left join duenos d on d.user_id = p.id
  left join permiso_altas pa on pa.user_id = p.id
  where p.role in ('admin', 'sub_admin') and coalesce(p.activo, true)
  order by p.role, p.name;
end $$;
