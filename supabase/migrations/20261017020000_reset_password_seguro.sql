-- Restablecer la contraseña de un alumno: mínimo 6 caracteres (antes se
-- aceptaba cualquiera, incluso de 1) y cierra sus sesiones abiertas para que
-- la contraseña vieja deje de servir en otros dispositivos.
CREATE OR REPLACE FUNCTION public.reset_student_password(p_student_id text, p_password text)
 RETURNS TABLE(email text, ok boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_email text; v_name text; v_uid uuid;
begin
  if not public.puede_gestionar_alumno(p_student_id) then raise exception 'forbidden'; end if;
  if length(coalesce(p_password, '')) < 6 then raise exception 'contrasena_corta'; end if;
  select s.email, s.name into v_email, v_name from students s where s.id = p_student_id;
  if v_email is null then raise exception 'alumno_no_encontrado: %', p_student_id; end if;

  v_uid := sincronizar_acceso(v_email, p_password, v_name, 'student', p_student_id);
  -- La contraseña vieja deja de servir también en los dispositivos con sesión abierta.
  delete from auth.refresh_tokens r where r.user_id = v_uid::text;
  delete from auth.sessions s where s.user_id = v_uid;
  return query select lower(v_email), true;
end;
$function$;
