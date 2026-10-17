-- Accesos (usuarios y correos de las cuentas): el super admin ve todas; el
-- sub-admin, solo la suya y las de los alumnos de sus grupos; el alumno, la
-- suya. Antes cualquier sub-admin leía todas las cuentas (incluidas las de
-- los super admins). Las contraseñas siguen saliendo solo por ver_credenciales.
alter policy "perfiles lectura" on public.profiles using (
  public.es_admin()
  or id = (select auth.uid())
  or (role = 'student' and student_id is not null and public.puede_gestionar_alumno(student_id))
);
