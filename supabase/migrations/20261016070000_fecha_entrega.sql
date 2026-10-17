-- Fecha de entrega (opcional) de una columna de la hoja: con ella se manda el
-- recordatorio por correo 2 días antes y aparece en "Próximo a vencer".
alter table public.registro_columnas add column if not exists fecha_entrega date;

create or replace function public.set_fecha_entrega(p_columna_id uuid, p_fecha date) returns void
language plpgsql security definer set search_path = public as $$
declare v_grupo text;
begin
  select group_id into v_grupo from registro_columnas where id = p_columna_id;
  if v_grupo is null then raise exception 'columna_no_encontrada'; end if;
  if not (public.es_admin() or public.puede_ver_grupo(v_grupo)) then raise exception 'forbidden'; end if;
  update registro_columnas set fecha_entrega = p_fecha where id = p_columna_id;
end $$;
revoke execute on function public.set_fecha_entrega(uuid, date) from public, anon;
grant execute on function public.set_fecha_entrega(uuid, date) to authenticated;
