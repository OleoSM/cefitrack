-- Color de letra de la tarjeta de un grupo. Con algunos fondos el blanco fijo
-- no se leía bien; ahora se elige (null = automático por contraste).
alter table public.groups add column if not exists tinta text;
do $$ begin
  alter table public.groups add constraint groups_tinta_check
    check (tinta is null or tinta in ('blanco','hueso','amarillo','celeste','negro','grafito'));
exception when duplicate_object then null; end $$;

create or replace function public.set_tinta_grupo(p_group_id text, p_tinta text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.es_admin() and not public.puede_ver_grupo(p_group_id) then raise exception 'forbidden'; end if;
  update public.groups set tinta = nullif(nullif(trim(p_tinta), ''), 'auto') where id = p_group_id;
  if not found then raise exception 'group_not_found'; end if;
end $$;
revoke execute on function public.set_tinta_grupo(text, text) from public, anon;
grant execute on function public.set_tinta_grupo(text, text) to authenticated;
