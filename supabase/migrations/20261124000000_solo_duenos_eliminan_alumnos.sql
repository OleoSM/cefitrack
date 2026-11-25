-- Solicitud de la dirección (2026-11-24): solo las cuentas dueñas (tabla
-- `duenos`: Dayan Everardo y Mauricio Hernández) pueden ELIMINAR alumnos.
-- Dar de alta sigue igual (puede_dar_altas: admins y sub-admins con permiso).
create or replace function public.delete_student(p_id text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_cuentas uuid[];
begin
  if not public.es_dueno() then raise exception 'solo_duenos_eliminan'; end if;
  if not public.puede_gestionar_alumno(p_id) then raise exception 'forbidden'; end if;
  select array_agg(pr.id) into v_cuentas from public.profiles pr where pr.student_id = p_id;
  delete from users where student_id = p_id;
  delete from students where id = p_id;
  delete from auth.users where id = any(coalesce(v_cuentas, '{}'));
end $function$;
