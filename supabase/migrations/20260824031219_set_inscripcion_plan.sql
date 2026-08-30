create or replace function public.set_inscripcion_plan(p_plan_id uuid, p_inscripcion numeric)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.es_admin() then raise exception 'solo_admin_puede_gestionar_pagos'; end if;
  update public.planes_pago
     set inscripcion = case when coalesce(p_inscripcion,0) > 0 then p_inscripcion else null end
   where id = p_plan_id;
end $$;
revoke execute on function public.set_inscripcion_plan(uuid,numeric) from public, anon;
grant execute on function public.set_inscripcion_plan(uuid,numeric) to authenticated;
