-- Reordenar materias y columnas de la hoja de Calificaciones arrastrando.
-- p_orden: [{ "materia": "Matemáticas", "columnas": ["uuid", "uuid", ...] }, ...]
-- en el orden deseado. Asigna materia_orden = posición de la materia (1..n) y
-- orden = posición de la columna dentro de su materia (0..m).
-- Guardia: admin o personal del grupo. Toda columna debe pertenecer al grupo.
create or replace function public.reordenar_registro(p_group_id text, p_orden jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  m jsonb; c text; i int := 0; j int;
begin
  if not public.puede_ver_grupo(p_group_id) then raise exception 'forbidden'; end if;
  if jsonb_typeof(p_orden) <> 'array' then raise exception 'orden_invalido'; end if;

  -- Ninguna columna ajena al grupo.
  if exists (
    select 1 from jsonb_array_elements(p_orden) mm, jsonb_array_elements_text(mm->'columnas') col
    where not exists (select 1 from registro_columnas rc where rc.id = col::uuid and rc.group_id = p_group_id)
  ) then raise exception 'columna_ajena'; end if;

  for m in select * from jsonb_array_elements(p_orden) loop
    i := i + 1; j := 0;
    for c in select * from jsonb_array_elements_text(m->'columnas') loop
      update registro_columnas set materia_orden = i, orden = j
       where id = c::uuid and group_id = p_group_id;
      j := j + 1;
    end loop;
  end loop;
end $$;
revoke execute on function public.reordenar_registro(text, jsonb) from public, anon;
grant  execute on function public.reordenar_registro(text, jsonb) to authenticated;
