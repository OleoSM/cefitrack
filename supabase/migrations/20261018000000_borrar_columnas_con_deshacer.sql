-- Borrar columnas de la hoja de Registrar, incluidas las de la plantilla base
-- (Tareas, Simulacros, Exámenes digitales, Examen general), que antes estaban
-- bloqueadas. La app pide confirmación y da 3 segundos para deshacer antes de
-- llamar a esta función. `asegurar_plantilla_base` solo corre al crear un
-- grupo, así que lo borrado no reaparece.
create or replace function public.borrar_columnas_registro(p_ids uuid[])
returns integer language plpgsql security definer set search_path to 'public' as $$
declare v_group text; n int;
begin
  if coalesce(array_length(p_ids, 1), 0) = 0 then return 0; end if;
  for v_group in select distinct group_id from public.registro_columnas where id = any(p_ids) loop
    if not public.es_admin() and not public.puede_ver_grupo(v_group) then raise exception 'forbidden'; end if;
  end loop;
  if v_group is null then raise exception 'column_not_found'; end if;
  delete from public.registro_columnas where id = any(p_ids);
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.borrar_columnas_registro(uuid[]) from public, anon;
grant execute on function public.borrar_columnas_registro(uuid[]) to authenticated;

create or replace function public.borrar_columna_registro(p_columna_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  perform public.borrar_columnas_registro(array[p_columna_id]);
end $$;
