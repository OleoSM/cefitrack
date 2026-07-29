-- Endurecimiento de permisos sobre RPCs.
--
-- Supabase concede EXECUTE a anon/authenticated por default a las funciones
-- nuevas del esquema public, así que `revoke ... from public` NO basta:
-- hay que revocar explícitamente a esos roles.

-- Helpers internos: no son API, solo los usa el trigger / otras RPCs.
-- (Los triggers no verifican EXECUTE del invocador, así que el recálculo
-- de promedios sigue funcionando.)
revoke execute on function public.recalc_student_grade(text) from anon, authenticated;
revoke execute on function public.evaluations_sync_avg() from anon, authenticated;

-- La anon key viaja en el bundle del frontend, así que cualquiera puede llamar
-- esta RPC. Permitir p_role='admin' significaba que cualquiera podía crearse
-- una cuenta de administrador. La app solo la usa para sub-admins; las cuentas
-- admin se crean directamente en SQL.
create or replace function public.create_user_with_password(p_name text, p_email text, p_password text, p_role text)
returns table(id text, name text, email text, role text)
language plpgsql security definer set search_path = public, extensions as $$
begin
  if p_role not in ('student','sub_admin') then
    raise exception 'role_not_allowed_from_client';
  end if;
  return query
  insert into users (name, email, password_hash, role)
  values (p_name, p_email, extensions.crypt(p_password, extensions.gen_salt('bf')), p_role)
  returning users.id, users.name, users.email, users.role;
end;
$$;
