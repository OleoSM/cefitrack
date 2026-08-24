-- Supabase concede EXECUTE a anon/authenticated por defecto en cada función
-- nueva de `public`, y `revoke ... from public` no lo retira. Estas tres se
-- quedaron abiertas a la anon key, que viaja en el JS público.
--
-- `borrar_columna_registro` era además la peor: no comprobaba NADA, así que
-- cualquiera con la anon key podía borrar una columna de calificaciones —y con
-- ella todas las notas de ese grupo—. Ahora exige ser personal del grupo.
create or replace function public.borrar_columna_registro(p_columna_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_group text; v_fija boolean;
begin
  select group_id, es_fija into v_group, v_fija
    from public.registro_columnas where id = p_columna_id;
  if v_group is null then raise exception 'column_not_found'; end if;
  if not public.es_admin() and not public.puede_ver_grupo(v_group) then
    raise exception 'forbidden';
  end if;
  if v_fija then raise exception 'fixed_column'; end if;
  delete from public.registro_columnas where id = p_columna_id;
end $$;

revoke execute on function public.borrar_columna_registro(uuid) from public, anon;
grant  execute on function public.borrar_columna_registro(uuid) to authenticated;

revoke execute on function public.sign_terms(text, text) from public, anon;
grant  execute on function public.sign_terms(text, text) to authenticated;

revoke execute on function public.reset_terms(text) from public, anon;
grant  execute on function public.reset_terms(text) to authenticated;
