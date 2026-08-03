-- FASE A (2/3): sub_admin_access deja de apuntar a la tabla `users` (que se
-- retirará) y pasa a referenciar `profiles`, cuyo id es el de auth.users.
--
-- La migración de datos que remapeó los user_id viejos a los nuevos uuid se
-- ejecutó una sola vez junto con el alta de cuentas en Supabase Auth; no se
-- versiona aquí porque incluía contraseñas generadas.

alter table sub_admin_access drop constraint if exists sub_admin_access_user_id_fkey;

-- Idempotente: si la columna ya es uuid, no hace nada.
do $$
begin
  if (select data_type from information_schema.columns
      where table_schema='public' and table_name='sub_admin_access' and column_name='user_id') = 'text' then
    alter table sub_admin_access alter column user_id type uuid using user_id::uuid;
  end if;
end $$;

alter table sub_admin_access
  add constraint sub_admin_access_user_id_fkey
  foreign key (user_id) references profiles(id) on delete cascade;

-- puede_sucursal() comparaba auth.uid()::text; ahora la columna es uuid.
create or replace function public.puede_sucursal(p_sucursal text)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when public.es_admin() then true
    when public.auth_role() = 'sub_admin' then
      exists (select 1 from sub_admin_access a
              where a.user_id = auth.uid()
                and (a.sucursal = p_sucursal or a.sucursal is null))
    else false
  end
$$;
