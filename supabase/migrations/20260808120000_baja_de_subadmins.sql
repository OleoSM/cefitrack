-- Dar de baja a un sub-admin: se RETIRA la cuenta, no se borra.
--
-- La pantalla de Acceso y Disposición ya daba de alta sub-admins y les concedía
-- o quitaba sucursales y grupos, pero no había forma de cerrarle la puerta a
-- alguien que se va del centro. Lo único que existía era el precedente hecho a
-- mano: `retirada+mauricio.subadmin@siga.mx` con activo=false. Esta migración
-- convierte ese apaño en una operación con nombre, reversible y auditable.
--
-- BORRAR vs DESACTIVAR — se desactiva, y no por comodidad:
--
--   1. `sub_admin_access.user_id` apunta a `profiles.id`, y `profiles.id` a
--      `auth.users.id`, ambas en cascada. Borrar no rompe claves foráneas, pero
--      se lleva por delante en silencio el registro de qué sucursales y grupos
--      tuvo esa persona. Cuando alguien pregunte quién pudo ver las
--      calificaciones de CN2 en marzo, no quedará nada que consultar.
--
--   2. Borrar deja un huérfano PELIGROSO que la cascada no ve: la fila de la
--      tabla heredada `users`, que no tiene clave foránea contra profiles y a la
--      que `login_user` sigue consultando mientras la migración de auth siga en
--      pie. Es decir: borrar la cuenta "bien" la dejaría entrando por la puerta
--      de atrás. Retirar la toca en los cuatro sitios a la vez.
--
--   3. `password_visible` guarda la credencial entregada. Retirar la conserva
--      para coordinación; borrar la pierde.
--
-- QUE UNA CUENTA RETIRADA NO PUEDA ENTRAR no es cosa del cliente. Hoy
-- `loginConAuth` mira `profiles.activo` y cierra la sesión, pero para entonces
-- GoTrue YA emitió un JWT válido con role=sub_admin dentro: quien llame a la
-- API sin pasar por la pantalla conserva el acceso que las políticas RLS leen
-- del token. Por eso la retirada actúa sobre la autenticación misma:
--
--   · `banned_until` a cien años  → GoTrue rechaza el inicio de sesión.
--   · el correo pasa a `retirada+…` en auth.users, auth.identities, profiles y
--     users → ni el correo viejo sirve ya, ni la puerta heredada, y el correo
--     original queda libre para volver a darse de alta.
--   · `app_metadata.role` pasa a 'retirado' → aunque un token sobreviviera,
--     `auth_role()` deja de decir 'sub_admin' y `es_personal()` es falso.
--   · se borran sesiones y refresh tokens → la sesión abierta muere ahora, no
--     cuando caduque.
--   · se retiran sus filas de `sub_admin_access` → `mis_grupos()` no le
--     devuelve nada. Reactivar NO las devuelve: los accesos se vuelven a
--     conceder a mano, que es lo correcto para quien regresa meses después.
--
-- Se añade también `list_cuentas_estado`, gemela de `list_cuentas` pero que
-- devuelve `activo` y NO esconde a los retirados. `list_cuentas` se deja intacta
-- por si algo más la consulta: una cuenta que desaparece de la lista se lee como
-- un error del sistema, y el administrador necesita ver a quién retiró.
--
-- Y se cierra un agujero del ALTA: `create_user_with_password` estaba concedida
-- a `anon` y sin comprobar quién llama, o sea que con la clave pública del
-- cliente cualquiera podía fabricarse un sub-admin. Ahora exige `es_admin()` y
-- ya no está al alcance de anon. Además comprueba el correo también contra la
-- tabla heredada `users`, como ya hacía `create_student`: sin eso, un correo que
-- sólo existiera ahí reventaba con un error de índice único en vez de decir que
-- el correo estaba ocupado.


/* ── Alta: sólo un administrador, y el correo se comprueba en los dos sitios ── */

create or replace function public.create_user_with_password(
  p_name text, p_email text, p_password text, p_role text)
returns table(id text, name text, email text, role text)
language plpgsql security definer set search_path to 'public'
as $function$
declare v_uid uuid;
begin
  if not es_admin() then
    raise exception 'solo_admin';
  end if;
  if p_role not in ('student','sub_admin') then
    raise exception 'role_not_allowed_from_client';
  end if;
  if exists (select 1 from auth.users a where lower(a.email) = lower(p_email))
     or exists (select 1 from users u where lower(u.email) = lower(p_email)) then
    raise exception 'email_already_exists';
  end if;

  insert into users (name, email, password_hash, role)
  values (p_name, lower(p_email),
          extensions.crypt(p_password, extensions.gen_salt('bf')), p_role);

  v_uid := sincronizar_acceso(p_email, p_password, p_name, p_role, null);

  return query select v_uid::text, p_name, lower(p_email), p_role;
end;
$function$;

revoke execute on function public.create_user_with_password(text,text,text,text) from anon;
grant  execute on function public.create_user_with_password(text,text,text,text) to authenticated;


/* ── Listado que sí muestra a los retirados ── */

create or replace function public.list_cuentas_estado()
returns table(
  id text, name text, email text, role text,
  grupo_id text, grupo_nombre text, sucursal text,
  activo boolean, created_at timestamptz)
language sql security definer set search_path to 'public'
as $function$
  select * from (
    select p.id::text as id, p.name, p.email, p.role,
           null::text as grupo_id, null::text as grupo_nombre, null::text as sucursal,
           coalesce(p.activo, true) as activo, p.created_at
    from profiles p
    where p.role in ('admin','sub_admin')

    union all

    -- El alumno no se retira desde aquí: su baja es la de `students`.
    select s.id, s.name, s.email, 'student',
           s.group_id, g.name, coalesce(g.sucursal, s.sucursal), true, now()
    from students s
    left join groups g on g.id = s.group_id
  ) t
  order by
    case t.role when 'admin' then 0 when 'sub_admin' then 1 else 2 end,
    t.activo desc,
    t.name;
$function$;

grant execute on function public.list_cuentas_estado() to anon, authenticated;


/* ── Baja ── */

create or replace function public.desactivar_cuenta(p_perfil_id text)
returns table(id text, name text, email text, activo boolean, accesos_retirados integer)
language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_id     uuid;
  v_email  text;
  v_nuevo  text;
  v_role   text;
  v_activo boolean;
  v_n      integer := 0;
begin
  if not es_admin() then raise exception 'solo_admin'; end if;

  begin
    v_id := p_perfil_id::uuid;
  exception when others then
    raise exception 'cuenta_no_encontrada';
  end;

  select p.email, p.role, coalesce(p.activo, true)
    into v_email, v_role, v_activo
  from profiles p where p.id = v_id;

  if not found                 then raise exception 'cuenta_no_encontrada'; end if;
  if v_role <> 'sub_admin'     then raise exception 'solo_sub_admin';       end if;
  if v_id = auth.uid()         then raise exception 'no_puedes_retirarte';  end if;
  if not v_activo              then raise exception 'cuenta_ya_retirada';   end if;

  -- Prefijo del precedente. Si ya hubo una retirada con ese mismo correo se
  -- desempata con la fecha, para no chocar contra los índices únicos de
  -- auth.users, profiles y users.
  v_nuevo := 'retirada+' || lower(v_email);
  if exists (select 1 from auth.users a where lower(a.email) = v_nuevo)
     or exists (select 1 from profiles p where lower(p.email) = v_nuevo)
     or exists (select 1 from users u where lower(u.email) = v_nuevo) then
    v_nuevo := 'retirada' || to_char(now(), 'YYYYMMDDHH24MISS') || '+' || lower(v_email);
  end if;

  -- 1. Autenticación: prohibida la entrada y cortada la sesión viva.
  update auth.users a
     set email             = v_nuevo,
         banned_until      = now() + interval '100 years',
         raw_app_meta_data = coalesce(a.raw_app_meta_data, '{}'::jsonb)
                             || jsonb_build_object('role', 'retirado'),
         updated_at        = now()
   where a.id = v_id;

  update auth.identities i
     set identity_data = coalesce(i.identity_data, '{}'::jsonb)
                         || jsonb_build_object('email', v_nuevo),
         updated_at    = now()
   where i.user_id = v_id;

  delete from auth.refresh_tokens r where r.user_id = v_id::text;
  delete from auth.sessions       s where s.user_id = v_id;

  -- 2. Permisos: se van con la cuenta.
  delete from sub_admin_access a where a.user_id = v_id;
  get diagnostics v_n = row_count;

  -- 3. Perfil y puerta heredada.
  update profiles p set activo = false, email = v_nuevo where p.id = v_id;
  update users    u set email  = v_nuevo where lower(u.email) = lower(v_email);

  return query
    select p.id::text, p.name, p.email, p.activo, v_n
    from profiles p where p.id = v_id;
end;
$function$;

revoke execute on function public.desactivar_cuenta(text) from anon;
grant  execute on function public.desactivar_cuenta(text) to authenticated;


/* ── Alta de vuelta ── */

create or replace function public.reactivar_cuenta(p_perfil_id text)
returns table(id text, name text, email text, activo boolean)
language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_id     uuid;
  v_email  text;
  v_orig   text;
  v_role   text;
  v_activo boolean;
begin
  if not es_admin() then raise exception 'solo_admin'; end if;

  begin
    v_id := p_perfil_id::uuid;
  exception when others then
    raise exception 'cuenta_no_encontrada';
  end;

  select p.email, p.role, coalesce(p.activo, true)
    into v_email, v_role, v_activo
  from profiles p where p.id = v_id;

  if not found             then raise exception 'cuenta_no_encontrada'; end if;
  if v_role <> 'sub_admin' then raise exception 'solo_sub_admin';       end if;
  if v_activo              then raise exception 'cuenta_ya_activa';     end if;

  v_orig := regexp_replace(lower(v_email), '^retirada[0-9]*\+', '');

  -- Si mientras tanto se dio de alta a alguien con ese correo, la vuelta no
  -- puede devolvérselo: se avisa en vez de dejar dos identidades peleándose.
  if v_orig <> lower(v_email) and (
       exists (select 1 from auth.users a where lower(a.email) = v_orig and a.id <> v_id)
    or exists (select 1 from profiles  p where lower(p.email) = v_orig and p.id <> v_id)
    or exists (select 1 from users     u where lower(u.email) = v_orig)
  ) then
    raise exception 'correo_ocupado';
  end if;

  update auth.users a
     set email             = v_orig,
         banned_until      = null,
         raw_app_meta_data = coalesce(a.raw_app_meta_data, '{}'::jsonb)
                             || jsonb_build_object('role', 'sub_admin'),
         updated_at        = now()
   where a.id = v_id;

  update auth.identities i
     set identity_data = coalesce(i.identity_data, '{}'::jsonb)
                         || jsonb_build_object('email', v_orig),
         updated_at    = now()
   where i.user_id = v_id;

  update profiles p set activo = true, email = v_orig where p.id = v_id;
  update users    u set email  = v_orig where lower(u.email) = lower(v_email);

  -- Los accesos NO vuelven solos: se conceden de nuevo desde la pantalla.
  return query
    select p.id::text, p.name, p.email, p.activo
    from profiles p where p.id = v_id;
end;
$function$;

revoke execute on function public.reactivar_cuenta(text) from anon;
grant  execute on function public.reactivar_cuenta(text) to authenticated;
