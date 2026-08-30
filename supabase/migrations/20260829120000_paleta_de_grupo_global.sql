-- El color de un grupo es del GRUPO, no del navegador de quien lo mira.
-- Vivía en localStorage, así que cada administrador veía una combinación
-- distinta y ninguno entendía por qué: lo que uno cambiaba no existía para el
-- resto. Pasa a la base, que es donde ya vive todo lo demás del grupo.
alter table public.groups add column if not exists paleta text;

create or replace function public.set_paleta_grupo(p_group_id text, p_paleta text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.es_admin() and not public.puede_ver_grupo(p_group_id) then
    raise exception 'forbidden';
  end if;
  update public.groups set paleta = nullif(trim(p_paleta), '') where id = p_group_id;
  if not found then raise exception 'group_not_found'; end if;
end $$;

revoke execute on function public.set_paleta_grupo(text, text) from public, anon;
grant  execute on function public.set_paleta_grupo(text, text) to authenticated;
