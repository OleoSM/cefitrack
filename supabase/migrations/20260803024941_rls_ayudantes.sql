-- Ayudantes de las políticas RLS.
--
-- Todos leen del token, nunca de `profiles`: una política sobre `profiles` que
-- consultara `profiles` entraría en recursión infinita. El rol se siembra
-- dentro del JWT en la migración de auth precisamente para esto.
--
-- STABLE y no VOLATILE: el planificador puede evaluarlos una vez por consulta
-- en lugar de una vez por fila, que en una tabla de calificaciones es la
-- diferencia entre una comprobación y decenas de miles.

/** Id del alumno asociado a la sesión, o null si quien llama no es alumno. */
create or replace function public.mi_student_id()
returns text
language sql stable security definer set search_path = public
as $$
  select student_id from profiles where id = auth.uid();
$$;

/**
 * Grupos que un sub-admin tiene concedidos, ya resueltos: una fila por grupo.
 * Un permiso puede darse sobre una sucursal entera —y entonces alcanza a todos
 * sus grupos— o sobre un grupo suelto.
 */
create or replace function public.mis_grupos()
returns table (group_id text)
language sql stable security definer set search_path = public
as $$
  select g.id
  from groups g
  join sub_admin_access a on a.user_id = auth.uid()
  where a.sucursal = g.sucursal
    and (a.group_id is null or a.group_id = g.id);
$$;

/** ¿Quien llama puede ver este grupo? Admin ve todo; sub-admin, lo concedido. */
create or replace function public.puede_ver_grupo(p_group_id text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select es_admin()
      or (auth_role() = 'sub_admin'
          and exists (select 1 from mis_grupos() m where m.group_id = p_group_id));
$$;

grant execute on function public.mi_student_id()       to authenticated;
grant execute on function public.mis_grupos()          to authenticated;
grant execute on function public.puede_ver_grupo(text) to authenticated;
