-- Fase C del cierre de seguridad (auditoria 2026-10-10).
-- profiles.password_visible guarda contraseñas en claro y cualquier sub_admin
-- podia leerla directamente (la politica "perfiles lectura" deja ver todos los
-- perfiles al personal). Se quita el SELECT de tabla y se concede solo por
-- columnas, sin password_visible.
--
-- Requisito: el frontend ya no hace select('*') sobre profiles (desplegado en
-- 152fae7). Aplicar ANTES de ese despliegue rompia el inicio de sesion.
--
-- Las credenciales se siguen consultando con la RPC ver_credenciales /
-- ver_credenciales_alumno (SECURITY DEFINER), que comprueba quien llama.
revoke select on public.profiles from anon, authenticated;
grant select (id, name, email, role, student_id, activo, created_at) on public.profiles to authenticated;
