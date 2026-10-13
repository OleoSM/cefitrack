-- Gestión de materiales: archivos (solucionarios, respuestas, guías) ligados a
-- una actividad de la hoja, con ventana de visibilidad y BORRADO AUTOMÁTICO al
-- vencer. Se decide qué grupos, sucursales o cursos los ven.
--
-- Suben admins y sub-admins con el apartado "materiales"; el sub-admin solo
-- para sus grupos/sucursales (los cursos completos, solo un admin).
-- El alumno lo ve únicamente entre `visible_desde` y `expira_en`.
-- Al vencer: la RLS lo oculta en el acto y la Edge Function
-- `limpiar-materiales` (cada hora, pg_cron) borra archivo y fila.

-- ── Apartado nuevo, delegable ───────────────────────────────────────────────
create or replace function public.apartados_catalogo() returns text[]
language sql immutable as $$
  select array['grupos','alumnos','calificaciones','asistencias','evaluaciones','materiales',
               'pagos','correos','terminos','configuracion','rankings']
$$;
create or replace function public.apartados_por_defecto() returns text[]
language sql immutable as $$
  select array['grupos','alumnos','calificaciones','asistencias','evaluaciones','materiales',
               'terminos','configuracion','rankings']
$$;

-- ── Tabla ───────────────────────────────────────────────────────────────────
create table if not exists public.materiales (
  id            uuid primary key default gen_random_uuid(),
  titulo        text not null check (length(trim(titulo)) between 1 and 120),
  descripcion   text,
  columna_id    uuid references public.registro_columnas(id) on delete set null,
  storage_path  text not null unique,
  file_name     text not null,
  mime_type     text not null,
  tamano        bigint not null,
  visible_desde timestamptz not null default now(),
  expira_en     timestamptz not null,
  grupos        text[] not null default '{}',
  sucursales    text[] not null default '{}',
  cursos        text[] not null default '{}',
  creado_por    uuid default auth.uid(),
  created_at    timestamptz not null default now(),
  constraint materiales_fechas check (expira_en > visible_desde),
  constraint materiales_alcance check (cardinality(grupos) + cardinality(sucursales) + cardinality(cursos) > 0)
);
create index if not exists materiales_expira_idx on public.materiales (expira_en);
alter table public.materiales enable row level security;

-- Sucursales completas a las que tiene acceso el sub-admin actual.
create or replace function public.mis_sucursales_completas() returns setof text
language sql stable security definer set search_path = public as $$
  select a.sucursal from sub_admin_access a where a.user_id = auth.uid() and a.group_id is null
$$;
revoke execute on function public.mis_sucursales_completas() from public, anon;
grant execute on function public.mis_sucursales_completas() to authenticated;

create or replace function public.puede_ver_material(p_id uuid) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare m materiales; g groups; v_sid text;
begin
  select * into m from materiales where id = p_id;
  if not found then return false; end if;
  if public.es_admin() then return true; end if;
  if public.auth_role() = 'sub_admin' then
    if not public.tiene_apartado('materiales') then return false; end if;
    return m.creado_por = auth.uid()
      or exists (select 1 from mis_grupos() x where x.group_id = any(m.grupos))
      or exists (select 1 from sub_admin_access a where a.user_id = auth.uid() and a.sucursal = any(m.sucursales));
  end if;
  -- Alumno: solo dentro de la ventana y si el alcance le incluye.
  if now() < m.visible_desde or now() >= m.expira_en then return false; end if;
  v_sid := public.mi_student_id();
  if v_sid is null then return false; end if;
  select gr.* into g from students s join groups gr on gr.id = s.group_id where s.id = v_sid;
  if not found then return false; end if;
  return g.id = any(m.grupos) or g.sucursal = any(m.sucursales)
      or coalesce(g.curso, case when g.institucion = 'ecoems' then 'ecoems' else 'universidad' end) = any(m.cursos);
end $$;
revoke execute on function public.puede_ver_material(uuid) from public, anon;
grant execute on function public.puede_ver_material(uuid) to authenticated;

drop policy if exists "ver materiales" on public.materiales;
create policy "ver materiales" on public.materiales for select to authenticated
  using (public.puede_ver_material(id));
revoke insert, update, delete on public.materiales from anon, authenticated;

-- Validación común de alcance (para crear y editar).
create or replace function public._validar_alcance_material(p_grupos text[], p_sucursales text[], p_cursos text[], p_columna_id uuid)
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if coalesce(cardinality(p_grupos), 0) + coalesce(cardinality(p_sucursales), 0) + coalesce(cardinality(p_cursos), 0) = 0 then
    raise exception 'sin_alcance';
  end if;
  if exists (select 1 from unnest(coalesce(p_cursos, '{}')) c where c not in ('ecoems','universidad')) then raise exception 'curso_invalido'; end if;
  if exists (select 1 from unnest(coalesce(p_grupos, '{}')) x where not exists (select 1 from groups g where g.id = x)) then raise exception 'grupo_invalido'; end if;
  if not public.es_admin() then
    if coalesce(cardinality(p_cursos), 0) > 0 then raise exception 'cursos_solo_admin'; end if;
    if exists (select 1 from unnest(coalesce(p_grupos, '{}')) x where not public.puede_ver_grupo(x)) then raise exception 'grupo_ajeno'; end if;
    if exists (select 1 from unnest(coalesce(p_sucursales, '{}')) x where x not in (select public.mis_sucursales_completas())) then
      raise exception 'sucursal_ajena';
    end if;
  end if;
  if p_columna_id is not null and not exists (
       select 1 from registro_columnas c where c.id = p_columna_id and public.puede_ver_grupo(c.group_id)) then
    raise exception 'actividad_ajena';
  end if;
end $$;
revoke execute on function public._validar_alcance_material(text[], text[], text[], uuid) from public, anon, authenticated;

create or replace function public.crear_material(
  p_titulo text, p_descripcion text, p_columna_id uuid, p_path text, p_file_name text, p_mime text, p_tamano bigint,
  p_visible_desde timestamptz, p_expira_en timestamptz, p_grupos text[], p_sucursales text[], p_cursos text[])
returns public.materiales language plpgsql security definer set search_path = public as $$
declare m materiales;
begin
  if not public.tiene_apartado('materiales') then raise exception 'forbidden'; end if;
  if split_part(coalesce(p_path, ''), '/', 1) <> auth.uid()::text then raise exception 'ruta_invalida'; end if;
  if p_mime not in ('application/pdf','image/jpeg','image/png','image/webp') then raise exception 'tipo_invalido'; end if;
  if p_tamano is null or p_tamano <= 0 or p_tamano > 20971520 then raise exception 'archivo_grande'; end if;
  if p_expira_en <= now() then raise exception 'ya_vencido'; end if;
  if p_expira_en <= coalesce(p_visible_desde, now()) then raise exception 'fechas_invalidas'; end if;
  perform public._validar_alcance_material(p_grupos, p_sucursales, p_cursos, p_columna_id);
  insert into materiales(titulo, descripcion, columna_id, storage_path, file_name, mime_type, tamano,
                         visible_desde, expira_en, grupos, sucursales, cursos, creado_por)
  values (trim(p_titulo), nullif(trim(coalesce(p_descripcion, '')), ''), p_columna_id, p_path, p_file_name, p_mime, p_tamano,
          coalesce(p_visible_desde, now()), p_expira_en, coalesce(p_grupos, '{}'), coalesce(p_sucursales, '{}'),
          coalesce(p_cursos, '{}'), auth.uid())
  returning * into m;
  return m;
end $$;
revoke execute on function public.crear_material(text,text,uuid,text,text,text,bigint,timestamptz,timestamptz,text[],text[],text[]) from public, anon;
grant execute on function public.crear_material(text,text,uuid,text,text,text,bigint,timestamptz,timestamptz,text[],text[],text[]) to authenticated;

create or replace function public.actualizar_material(
  p_id uuid, p_titulo text, p_descripcion text, p_columna_id uuid,
  p_visible_desde timestamptz, p_expira_en timestamptz, p_grupos text[], p_sucursales text[], p_cursos text[])
returns public.materiales language plpgsql security definer set search_path = public as $$
declare m materiales;
begin
  select * into m from materiales where id = p_id;
  if not found then raise exception 'material_no_encontrado'; end if;
  if not public.es_admin() and not (public.tiene_apartado('materiales') and m.creado_por = auth.uid()) then raise exception 'forbidden'; end if;
  if p_expira_en <= now() then raise exception 'ya_vencido'; end if;
  if p_expira_en <= p_visible_desde then raise exception 'fechas_invalidas'; end if;
  perform public._validar_alcance_material(p_grupos, p_sucursales, p_cursos, p_columna_id);
  update materiales set titulo = trim(p_titulo), descripcion = nullif(trim(coalesce(p_descripcion, '')), ''),
    columna_id = p_columna_id, visible_desde = p_visible_desde, expira_en = p_expira_en,
    grupos = coalesce(p_grupos, '{}'), sucursales = coalesce(p_sucursales, '{}'), cursos = coalesce(p_cursos, '{}')
  where id = p_id returning * into m;
  return m;
end $$;
revoke execute on function public.actualizar_material(uuid,text,text,uuid,timestamptz,timestamptz,text[],text[],text[]) from public, anon;
grant execute on function public.actualizar_material(uuid,text,text,uuid,timestamptz,timestamptz,text[],text[],text[]) to authenticated;

create or replace function public.borrar_material(p_id uuid) returns text
language plpgsql security definer set search_path = public as $$
declare m materiales;
begin
  select * into m from materiales where id = p_id;
  if not found then raise exception 'material_no_encontrado'; end if;
  if not public.es_admin() and not (public.tiene_apartado('materiales') and m.creado_por = auth.uid()) then raise exception 'forbidden'; end if;
  delete from materiales where id = p_id;
  return m.storage_path;
end $$;
revoke execute on function public.borrar_material(uuid) from public, anon;
grant execute on function public.borrar_material(uuid) to authenticated;

-- ── Bucket privado ──────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('materiales', 'materiales', false, 20971520, array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "materiales lectura" on storage.objects;
create policy "materiales lectura" on storage.objects for select to authenticated
  using (bucket_id = 'materiales' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (select 1 from public.materiales m where m.storage_path = name and public.puede_ver_material(m.id))));
drop policy if exists "materiales alta" on storage.objects;
create policy "materiales alta" on storage.objects for insert to authenticated
  with check (bucket_id = 'materiales' and public.tiene_apartado('materiales')
              and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "materiales borrado" on storage.objects;
create policy "materiales borrado" on storage.objects for delete to authenticated
  using (bucket_id = 'materiales' and ((storage.foldername(name))[1] = auth.uid()::text or public.es_admin()));

-- ── Limpieza automática ─────────────────────────────────────────────────────
-- La clave la genera la propia base y vive en Vault: pg_cron la manda en cada
-- llamada y la Edge Function la comprueba con verificar_secreto_limpieza (que
-- solo puede ejecutar el service_role). Nunca sale de la base.
do $$ begin
  if not exists (select 1 from vault.secrets where name = 'limpieza_materiales') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'limpieza_materiales',
                                'Clave de la llamada de pg_cron a la Edge Function limpiar-materiales');
  end if;
end $$;

create or replace function public.verificar_secreto_limpieza(p_secreto text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(p_secreto, '') <> '' and p_secreto = (select decrypted_secret from vault.decrypted_secrets where name = 'limpieza_materiales')
$$;
revoke execute on function public.verificar_secreto_limpieza(text) from public, anon, authenticated;
grant execute on function public.verificar_secreto_limpieza(text) to service_role;

create extension if not exists pg_net;
create extension if not exists pg_cron;

select cron.unschedule(jobid) from cron.job where jobname = 'limpiar-materiales';
select cron.schedule('limpiar-materiales', '7 * * * *', $cron$
  select net.http_post(
    url := 'https://dvtbvmqqlmohbygoicsg.supabase.co/functions/v1/limpiar-materiales',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-limpieza', (select decrypted_secret from vault.decrypted_secrets where name = 'limpieza_materiales')),
    body := '{}'::jsonb)
$cron$);
