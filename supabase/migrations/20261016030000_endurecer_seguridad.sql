-- Auditoría de seguridad 2026-10-16. Lo que cierra cada bloque:
--
-- 1. CRÍTICO — profiles.password_visible (contraseñas en claro) se podía leer
--    con un SELECT directo: cualquier sub-admin veía la de los ADMINS (escalada
--    de privilegios). Ahora la columna no se puede leer desde el cliente; solo
--    la función ver_credenciales (con sus reglas) la devuelve.
-- 2. El registro público de Supabase Auth está abierto: un extraño puede crear
--    una cuenta y entrar sin perfil. Las lecturas que eran "true" ahora exigen
--    un perfil activo (y hay que apagar el registro en el panel de Supabase).
-- 3. Un sub-admin veía calificaciones, expedientes y garantías de TODOS los
--    alumnos (es_personal). Ahora solo los de sus grupos (puede_gestionar_alumno).
-- 4. Nada de la API es accesible sin sesión: el rol anon pierde tablas y
--    funciones. Las funciones internas dejan de ser llamables desde el cliente.
-- 5. search_path fijo en auth_role / es_admin / es_personal.
-- 6. cupo_correos_hoy y gasto_asistente_mes solo para quien tiene el apartado.

-- ── 1. Contraseñas visibles ──────────────────────────────────────────────
revoke select, insert, update, delete on public.profiles from anon, authenticated;
grant select (id, name, email, role, student_id, activo, created_at) on public.profiles to authenticated;
alter policy "perfiles lectura" on public.profiles to authenticated;

-- ── 2. Cuentas sin perfil (registro abierto, alumnos borrados) ──────────
create or replace function public.tiene_perfil() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and coalesce(activo, true))
$$;

alter policy "configuracion lectura" on public.configuracion using (public.tiene_perfil());
alter policy "sucursales_lectura" on public.sucursales using (public.tiene_perfil());
alter policy "turnos_lectura" on public.turnos using (public.tiene_perfil());
alter policy "leer avatares" on public.avatar_catalogo using (public.tiene_perfil());
alter policy "usuarios leen tyc activo" on public.terms_documents using ((is_active and public.tiene_perfil()) or public.es_personal());
alter policy "usuarios leen tyc" on storage.objects using (bucket_id = 'terminos' and public.tiene_perfil());

-- ── 3. Sub-admin acotado a sus alumnos ───────────────────────────────────
alter policy "leer valores registro" on public.registro_valores
  using (student_id = (select public.mi_student_id()) or public.puede_gestionar_alumno(student_id));
alter policy "documentos lectura expediente" on public.student_documents
  using (public.puede_gestionar_alumno(student_id) or student_id = (select public.mi_student_id()));
alter policy "documentos carga expediente" on public.student_documents
  with check (public.puede_gestionar_alumno(student_id) or student_id = (select public.mi_student_id()));
alter policy "personal actualiza documentos" on public.student_documents
  using (public.puede_gestionar_alumno(student_id)) with check (public.puede_gestionar_alumno(student_id));

alter policy "expedientes lectura" on storage.objects using (bucket_id = 'expedientes' and (
  public.puede_gestionar_alumno((storage.foldername(name))[1]) or (storage.foldername(name))[1] = (select public.mi_student_id())));
alter policy "expedientes alta" on storage.objects with check (bucket_id = 'expedientes' and (
  public.puede_gestionar_alumno((storage.foldername(name))[1]) or (storage.foldername(name))[1] = (select public.mi_student_id())));
alter policy "expedientes reemplazo" on storage.objects
  using (bucket_id = 'expedientes' and (public.puede_gestionar_alumno((storage.foldername(name))[1]) or (storage.foldername(name))[1] = (select public.mi_student_id())))
  with check (bucket_id = 'expedientes' and (public.puede_gestionar_alumno((storage.foldername(name))[1]) or (storage.foldername(name))[1] = (select public.mi_student_id())));

create or replace function public.validar_garantia(p_student_id text) returns text
language plpgsql security definer set search_path = public as $$
begin
  if not public.puede_gestionar_alumno(p_student_id) then raise exception 'forbidden'; end if;
  update public.students set garantia_estado='validada' where id=p_student_id
    and garantia_aceptada and garantia_firma_alumno is not null;
  if not found then raise exception 'garantia_incompleta'; end if;
  return public.recalcular_acceso_alumno(p_student_id);
end $$;

create or replace function public.guardar_garantia(p_student_id text, p_aceptada boolean, p_firma_alumno text, p_firma_tutor text default null)
returns text language plpgsql security definer set search_path = public as $$
begin
  if not public.puede_gestionar_alumno(p_student_id) and p_student_id is distinct from (select public.mi_student_id()) then raise exception 'forbidden'; end if;
  if not coalesce(p_aceptada,false) or p_firma_alumno not like 'data:image/png;base64,%' then raise exception 'garantia_incompleta'; end if;
  update public.students set garantia_aceptada=true, garantia_firma_alumno=p_firma_alumno,
    garantia_firma_tutor=null, garantia_estado='entregada' where id=p_student_id;
  return public.recalcular_acceso_alumno(p_student_id);
end $$;

-- ── 6. Contadores de consumo ─────────────────────────────────────────────
create or replace function public.cupo_correos_hoy() returns table(enviados integer, limite integer)
language sql stable security definer set search_path = public as $$
  select (select count(*)::int from email_envios
           where estado = 'enviado'
             and created_at >= (date_trunc('day', now() at time zone 'America/Mexico_City') at time zone 'America/Mexico_City')),
         (select correo_limite_diario from configuracion limit 1)
  where coalesce(auth.role(), '') = 'service_role' or public.tiene_apartado('correos')
$$;

create or replace function public.gasto_asistente_mes() returns table(usado numeric, limite numeric, consultas integer)
language sql stable security definer set search_path = public as $$
  select coalesce(sum(costo_usd), 0)::numeric(10,4),
         (select asistente_limite_usd from configuracion limit 1),
         count(*)::int
  from asistente_uso
  where created_at >= (date_trunc('month', now() at time zone 'America/Mexico_City') at time zone 'America/Mexico_City')
    and (coalesce(auth.role(), '') = 'service_role' or public.tiene_apartado('ia'))
$$;

-- ── 5. search_path fijo ──────────────────────────────────────────────────
alter function public.auth_role() set search_path = public;
alter function public.es_admin() set search_path = public;
alter function public.es_personal() set search_path = public;

-- ── 4. Sin acceso anónimo; internas fuera del cliente ───────────────────
-- Se conserva exactamente quién podía ejecutar cada función (salvo anon y las
-- internas). No se concede nada a quien antes no lo tenía.
do $$
declare f record; tenia boolean;
begin
  for f in
    select p.oid, p.oid::regprocedure sig, p.proname, p.prorettype = 'trigger'::regtype es_trigger
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
  loop
    tenia := has_function_privilege('authenticated', f.oid, 'EXECUTE');
    execute format('revoke execute on function %s from public, anon', f.sig);
    if tenia and not f.es_trigger
       and f.proname not in ('recalc_student_tasks', 'recalcular_acceso_alumno', 'requisito_cumplido') then
      execute format('grant execute on function %s to authenticated', f.sig);
    else
      execute format('revoke execute on function %s from authenticated', f.sig);
    end if;
    execute format('grant execute on function %s to service_role', f.sig);
  end loop;
end $$;
alter default privileges in schema public revoke execute on functions from public, anon;

revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;

-- Tabla del inicio de sesión antiguo (hashes): fuera del alcance del cliente.
revoke all on public.users from anon, authenticated;
