-- Políticas de lectura reales.
--
-- Las anteriores eran `USING (true)` para el rol `public`: con la anon key
-- —que viaja en el JavaScript público y no es un secreto— cualquiera podía
-- leer nombres, correos, tutores, teléfonos y calificaciones de los alumnos.
-- `registro_columnas`, `avatar_catalogo` y `users` ni siquiera tenían RLS
-- activo, y `users` guarda los hashes de contraseña.
--
-- Criterio: el administrador ve todo; el sub-admin, sólo los grupos que tiene
-- concedidos; el alumno, únicamente lo suyo. Quien no ha iniciado sesión, nada.
--
-- La escritura no lleva política a propósito: pasa entera por RPC SECURITY
-- DEFINER, y una tabla con RLS activo y sin política de INSERT/UPDATE/DELETE
-- deniega esas operaciones, que es justo lo que se busca.

-- ── students ────────────────────────────────────────────────────────────────
drop policy if exists "dev read students" on public.students;
create policy "leer alumnos" on public.students
for select to authenticated
using (es_admin() or puede_ver_grupo(group_id) or id = mi_student_id());

-- ── groups ──────────────────────────────────────────────────────────────────
drop policy if exists "dev read groups" on public.groups;
create policy "leer grupos" on public.groups
for select to authenticated
using (
  es_admin()
  or puede_ver_grupo(id)
  -- El alumno necesita su grupo para ver su nombre, horario y salón.
  or id = (select group_id from students where id = mi_student_id())
);

-- ── evaluations ─────────────────────────────────────────────────────────────
drop policy if exists "read evaluations" on public.evaluations;
create policy "leer evaluaciones" on public.evaluations
for select to authenticated
using (
  es_admin()
  or student_id = mi_student_id()
  or exists (select 1 from students s
             where s.id = evaluations.student_id and puede_ver_grupo(s.group_id))
);

-- ── attendance_sessions ─────────────────────────────────────────────────────
drop policy if exists "read attendance_sessions" on public.attendance_sessions;
create policy "leer sesiones" on public.attendance_sessions
for select to authenticated
using (
  es_admin()
  or puede_ver_grupo(group_id)
  or group_id = (select group_id from students where id = mi_student_id())
);

-- ── attendance_records ──────────────────────────────────────────────────────
drop policy if exists "read attendance_records" on public.attendance_records;
create policy "leer asistencia" on public.attendance_records
for select to authenticated
using (
  es_admin()
  or student_id = mi_student_id()
  or exists (select 1 from students s
             where s.id = attendance_records.student_id and puede_ver_grupo(s.group_id))
);

-- ── sub_admin_access ────────────────────────────────────────────────────────
-- Quién tiene acceso a qué es información de administración. El propio
-- sub-admin ve la suya porque la interfaz la necesita al iniciar sesión.
drop policy if exists "read sub_admin_access" on public.sub_admin_access;
create policy "leer accesos" on public.sub_admin_access
for select to authenticated
using (es_admin() or user_id = auth.uid());

-- ── registro_columnas ───────────────────────────────────────────────────────
-- Estaba sin RLS: la estructura de la hoja de calificaciones era pública.
alter table public.registro_columnas enable row level security;
drop policy if exists "leer columnas" on public.registro_columnas;
create policy "leer columnas" on public.registro_columnas
for select to authenticated
using (
  es_admin()
  or puede_ver_grupo(group_id)
  or group_id = (select group_id from students where id = mi_student_id())
);

-- ── avatar_catalogo ─────────────────────────────────────────────────────────
-- Lo necesita cualquiera que haya iniciado sesión y no contiene ningún dato
-- personal, así que basta con exigir sesión.
alter table public.avatar_catalogo enable row level security;
drop policy if exists "leer avatares" on public.avatar_catalogo;
create policy "leer avatares" on public.avatar_catalogo
for select to authenticated
using (true);

-- ── users ───────────────────────────────────────────────────────────────────
-- Tabla del sistema anterior: contiene los hashes de contraseña. Nadie debe
-- leerla desde el cliente. Sin política, RLS lo deniega todo; los RPC que la
-- usan son SECURITY DEFINER y siguen funcionando.
alter table public.users enable row level security;
