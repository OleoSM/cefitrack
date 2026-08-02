-- ============================================================================
-- FASE A (1/3): Autenticación real con Supabase Auth + tabla de perfiles.
--
-- Antes: la app llamaba `login_user` con la anon key y guardaba la sesión en
-- localStorage. Ninguna RPC sabía quién llamaba, así que cualquier permiso era
-- decorativo. Ahora la identidad la gestiona Supabase Auth (JWT firmado) y el
-- rol viaja dentro del token en `app_metadata.role`, de modo que las políticas
-- RLS pueden leerlo sin consultar tablas (evita recursión en las policies y
-- no es falsificable desde el cliente).
--
-- `public.users` se sustituye por `public.profiles`, con id = auth.users.id.
-- Se conservan los ids de texto de `students` para no romper las llaves
-- foráneas de evaluaciones y asistencias.
-- ============================================================================

-- ─── Perfiles ────────────────────────────────────────────────────────────────
create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text not null,
  email       text not null unique,
  role        text not null check (role in ('admin','sub_admin','student')),
  student_id  text references students(id) on delete cascade,
  activo      boolean not null default true,   -- checkbox de acceso a la plataforma
  created_at  timestamptz not null default now(),
  -- un alumno siempre va ligado a su ficha; el personal nunca
  constraint perfil_alumno_coherente check (
    (role = 'student' and student_id is not null) or
    (role <> 'student' and student_id is null)
  )
);

create index if not exists profiles_student_idx on profiles (student_id);
create index if not exists profiles_role_idx on profiles (role);

alter table profiles enable row level security;

-- ─── Helpers de identidad ────────────────────────────────────────────────────
-- Leen del JWT, no de tablas: usarlos dentro de policies no provoca recursión.

create or replace function public.auth_role()
returns text language sql stable as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '')
$$;

create or replace function public.es_admin()
returns boolean language sql stable as $$
  select public.auth_role() = 'admin'
$$;

create or replace function public.es_personal()
returns boolean language sql stable as $$
  select public.auth_role() in ('admin','sub_admin')
$$;

-- Ficha de alumno del usuario autenticado (null si es personal).
create or replace function public.auth_student_id()
returns text language sql stable security definer set search_path = public as $$
  select p.student_id from profiles p where p.id = auth.uid()
$$;

-- Sucursales visibles para el usuario: admin ve todas (null = sin restricción).
create or replace function public.auth_sucursales()
returns text[] language sql stable security definer set search_path = public as $$
  select case
    when public.es_admin() then null
    else coalesce(array_agg(distinct a.sucursal), '{}')
  end
  from sub_admin_access a
  where a.user_id = auth.uid()::text
$$;

-- ¿El usuario puede operar sobre esta sucursal?
create or replace function public.puede_sucursal(p_sucursal text)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when public.es_admin() then true
    when public.auth_role() = 'sub_admin' then
      exists (select 1 from sub_admin_access a
              where a.user_id = auth.uid()::text
                and (a.sucursal = p_sucursal or a.sucursal is null))
    else false
  end
$$;

-- ─── Alta de usuarios con cuenta de acceso ───────────────────────────────────
-- CEFIMAT siempre genera usuario y contraseña, así que el alta vive en el
-- servidor. Crear filas en auth.users requiere inicializar las columnas de
-- token en cadena vacía: GoTrue las lee en tipos no nulables y falla con NULL.
create or replace function public.crear_usuario_auth(
  p_email text, p_password text, p_role text, p_name text, p_student_id text default null
)
returns uuid
language plpgsql security definer set search_path = public, auth, extensions as $$
declare v_id uuid := gen_random_uuid();
begin
  if p_role not in ('admin','sub_admin','student') then
    raise exception 'rol_invalido';
  end if;
  if exists (select 1 from auth.users u where lower(u.email) = lower(p_email)) then
    raise exception 'email_ya_existe';
  end if;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token
  ) values (
    '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
    lower(p_email), extensions.crypt(p_password, extensions.gen_salt('bf')), now(),
    jsonb_build_object('provider','email','providers',jsonb_build_array('email'),'role',p_role),
    jsonb_build_object('name', p_name), now(), now(),
    '', '', '', '', '', '', '', ''
  );

  insert into auth.identities (provider_id, user_id, identity_data, provider,
                               last_sign_in_at, created_at, updated_at)
  values (v_id::text, v_id,
          jsonb_build_object('sub', v_id::text, 'email', lower(p_email),
                             'email_verified', true, 'phone_verified', false),
          'email', now(), now(), now());

  insert into profiles (id, name, email, role, student_id)
  values (v_id, p_name, lower(p_email), p_role, p_student_id);

  return v_id;
end;
$$;

-- Versión pública: solo un admin autenticado puede crear cuentas.
create or replace function public.admin_crear_usuario(
  p_email text, p_password text, p_role text, p_name text, p_student_id text default null
)
returns uuid
language plpgsql security definer set search_path = public as $$
begin
  if not public.es_admin() then
    raise exception 'no_autorizado';
  end if;
  return public.crear_usuario_auth(p_email, p_password, p_role, p_name, p_student_id);
end;
$$;

-- Cambio de contraseña (siempre lo asigna CEFIMAT, nunca el alumno).
create or replace function public.admin_asignar_password(p_user_id uuid, p_password text)
returns void
language plpgsql security definer set search_path = public, auth, extensions as $$
begin
  if not public.es_admin() then
    raise exception 'no_autorizado';
  end if;
  update auth.users
  set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')),
      updated_at = now()
  where id = p_user_id;
  if not found then raise exception 'usuario_no_encontrado'; end if;
end;
$$;

-- Activar/desactivar el acceso de un alumno a la plataforma (checkbox).
create or replace function public.admin_set_activo(p_user_id uuid, p_activo boolean)
returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if not public.es_admin() then
    raise exception 'no_autorizado';
  end if;
  update profiles set activo = p_activo where id = p_user_id;
  if not found then raise exception 'perfil_no_encontrado'; end if;
  -- banear en auth impide incluso obtener token, no solo ocultar la UI
  update auth.users
  set banned_until = case when p_activo then null else 'infinity'::timestamptz end
  where id = p_user_id;
end;
$$;

-- ─── Políticas de profiles ───────────────────────────────────────────────────
drop policy if exists "perfiles lectura" on profiles;
create policy "perfiles lectura" on profiles for select
  using (public.es_personal() or id = auth.uid());

-- La escritura pasa solo por las RPCs SECURITY DEFINER de arriba.

-- ─── Permisos ────────────────────────────────────────────────────────────────
revoke all on function public.crear_usuario_auth(text,text,text,text,text) from public, anon, authenticated;

revoke all on function public.admin_crear_usuario(text,text,text,text,text) from public;
revoke all on function public.admin_asignar_password(uuid,text) from public;
revoke all on function public.admin_set_activo(uuid,boolean) from public;
revoke execute on function public.admin_crear_usuario(text,text,text,text,text) from anon;
revoke execute on function public.admin_asignar_password(uuid,text) from anon;
revoke execute on function public.admin_set_activo(uuid,boolean) from anon;

grant execute on function public.admin_crear_usuario(text,text,text,text,text) to authenticated;
grant execute on function public.admin_asignar_password(uuid,text) to authenticated;
grant execute on function public.admin_set_activo(uuid,boolean) to authenticated;
grant execute on function public.auth_role(), public.es_admin(), public.es_personal(),
                       public.auth_student_id(), public.puede_sucursal(text) to authenticated;
