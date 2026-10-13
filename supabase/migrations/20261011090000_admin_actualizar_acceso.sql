-- Editar usuario (correo) y contraseña de una cuenta desde Acceso y Disposición.
-- p_cuenta: id de perfil (uuid) o id de alumno ('s54'). Vacíos = sin cambio.
-- Solo admin. No permite editar a OTRO administrador (seria una via para
-- tomar su cuenta); si a si mismo, a sub-admins y a alumnos.
-- Mismo camino que el alta (sincronizar_acceso): auth.users (+identities),
-- profiles (password_visible), tabla heredada users y students.email.
-- Cierra las sesiones abiertas de esa persona para que entre con lo nuevo.
create or replace function public.admin_actualizar_acceso(p_cuenta text, p_email text, p_password text)
returns table(id text, email text) language plpgsql security definer set search_path = public as $$
declare
  v_id uuid; v_role text; v_sid text; v_old text; v_activo boolean;
  v_email text := lower(trim(coalesce(p_email, '')));
  v_pass text := coalesce(p_password, '');
  v_hash text;
begin
  if not public.es_admin() then raise exception 'solo_admin'; end if;

  select p.id, p.role, p.student_id, p.email, coalesce(p.activo, true)
    into v_id, v_role, v_sid, v_old, v_activo
  from profiles p where p.id::text = p_cuenta or p.student_id = p_cuenta
  limit 1;
  if not found then raise exception 'cuenta_no_encontrada'; end if;
  if v_role = 'admin' and v_id <> auth.uid() then raise exception 'no_editar_otro_admin'; end if;
  if not v_activo then raise exception 'cuenta_retirada'; end if;

  if v_email = '' then v_email := lower(v_old); end if;
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]{2,}$' then raise exception 'correo_invalido'; end if;
  if v_pass <> '' and length(v_pass) < 6 then raise exception 'contrasena_corta'; end if;
  if v_email = lower(v_old) and v_pass = '' then raise exception 'sin_cambios'; end if;

  if v_email <> lower(v_old) then
    if exists (select 1 from auth.users a where lower(a.email) = v_email and a.id <> v_id)
       or exists (select 1 from profiles x where lower(x.email) = v_email and x.id <> v_id)
       or exists (select 1 from users u where lower(u.email) = v_email and lower(u.email) <> lower(v_old)) then
      raise exception 'correo_repetido';
    end if;
    update auth.users set email = v_email, updated_at = now() where auth.users.id = v_id;
    update auth.identities i set identity_data = coalesce(i.identity_data, '{}'::jsonb) || jsonb_build_object('email', v_email),
           updated_at = now()
     where i.user_id = v_id and i.provider = 'email';
    update users u set email = v_email where lower(u.email) = lower(v_old);
    update profiles x set email = v_email where x.id = v_id;
    if v_sid is not null then update students s set email = v_email where s.id = v_sid; end if;
  end if;

  if v_pass <> '' then
    v_hash := extensions.crypt(v_pass, extensions.gen_salt('bf'));
    update auth.users set encrypted_password = v_hash, updated_at = now() where auth.users.id = v_id;
    update profiles x set password_visible = v_pass where x.id = v_id;
    update users u set password_hash = v_hash where lower(u.email) = v_email;
  end if;

  -- Sus sesiones abiertas dejan de valer (salvo si se edita uno mismo).
  if v_id <> auth.uid() then
    delete from auth.refresh_tokens r where r.user_id = v_id::text;
    delete from auth.sessions s where s.user_id = v_id;
  end if;

  return query select v_id::text, v_email;
end $$;
revoke execute on function public.admin_actualizar_acceso(text, text, text) from public, anon;
grant  execute on function public.admin_actualizar_acceso(text, text, text) to authenticated;
