-- Avisos del revisor de seguridad tras la tanda del 2026-10-11:
-- la función de trigger no debe ser invocable por RPC, las funciones del
-- catálogo de apartados fijan search_path y pg_net sale del esquema public.
revoke execute on function public.trg_comprobante_solo_ecoems() from public, anon, authenticated;
alter function public.apartados_catalogo() set search_path = public;
alter function public.apartados_por_defecto() set search_path = public;
drop extension if exists pg_net;
create extension pg_net with schema extensions;
