-- Tres huecos del control de pagos:
--   1. No constaba QUIÉN cobró. `created_by` guarda la cuenta que estaba
--      abierta, que no siempre es la persona que recibió el dinero (mostrador
--      compartido), así que se pide el nombre a mano.
--   2. La inscripción se mezclaba con las mensualidades y descuadraba el saldo
--      del curso. Se marca aparte y no cuenta contra el total del plan.
--   3. Las notas del alumno no se veían al cobrar.

alter table public.pagos
  add column if not exists registrado_por text,
  add column if not exists es_inscripcion boolean not null default false;

alter table public.planes_pago
  add column if not exists inscripcion numeric(10,2);

create or replace function public.registrar_pago_v2(
  p_id uuid, p_plan_id uuid, p_monto numeric, p_metodo text, p_fecha date default null,
  p_periodo date default null, p_cubre_total boolean default false, p_concepto text default 'Pago de curso',
  p_referencia text default null, p_nota text default null,
  p_registrado_por text default null, p_es_inscripcion boolean default false
) returns public.pagos language plpgsql security definer set search_path=public as $$
declare v_row public.pagos; v_student text; v_quien text;
begin
  if not public.es_admin() then raise exception 'solo_admin_puede_gestionar_pagos'; end if;
  select student_id into v_student from public.planes_pago where id=p_plan_id;
  if v_student is null then raise exception 'plan_not_found'; end if;
  v_quien := nullif(trim(p_registrado_por),'');
  if v_quien is null then raise exception 'falta_quien_registra'; end if;
  if coalesce(p_es_inscripcion,false) then
    p_periodo := null; p_cubre_total := false;
  end if;
  if p_id is null then
    insert into public.pagos(plan_id,student_id,monto,metodo,fecha,periodo,cubre_total,concepto,
                             referencia,nota,registrado_por,es_inscripcion,created_by)
    values(p_plan_id,v_student,p_monto,p_metodo,coalesce(p_fecha,current_date),
      case when p_cubre_total then null else date_trunc('month',p_periodo)::date end,
      coalesce(p_cubre_total,false),
      coalesce(nullif(trim(p_concepto),''), case when coalesce(p_es_inscripcion,false) then 'Inscripción' else 'Pago de curso' end),
      p_referencia,p_nota,v_quien,coalesce(p_es_inscripcion,false),(select auth.uid()))
    returning * into v_row;
  else
    update public.pagos set monto=p_monto,metodo=p_metodo,fecha=coalesce(p_fecha,current_date),
      periodo=case when p_cubre_total then null else date_trunc('month',p_periodo)::date end,
      cubre_total=coalesce(p_cubre_total,false),
      concepto=coalesce(nullif(trim(p_concepto),''),'Pago de curso'),
      referencia=p_referencia,nota=p_nota,registrado_por=v_quien,
      es_inscripcion=coalesce(p_es_inscripcion,false)
     where id=p_id returning * into v_row;
  end if;
  return v_row;
end $$;
revoke execute on function public.registrar_pago_v2(uuid,uuid,numeric,text,date,date,boolean,text,text,text,text,boolean) from public,anon;
grant execute on function public.registrar_pago_v2(uuid,uuid,numeric,text,date,date,boolean,text,text,text,text,boolean) to authenticated;

-- El resumen separa inscripción de curso: sumarlas daba un saldo que no
-- correspondía a las mensualidades que quedan por cobrar. Las columnas nuevas
-- van al final porque una vista no admite insertarlas en medio.
drop view if exists public.v_pagos_resumen;
create view public.v_pagos_resumen as
 SELECT s.id AS student_id,
    s.name AS student_name,
    s.email AS student_email,
    s.group_id,
    g.name AS group_name,
    g.sucursal,
    g.institucion,
    s.avatar,
    s.pago_estado,
    p.id AS plan_id,
    p.concepto,
    p.total,
    p.modalidad,
    p.mensualidades,
    p.inicio,
    p.notas,
    COALESCE(m.pagado, 0::numeric) AS pagado,
        CASE
            WHEN p.total IS NULL THEN NULL::numeric
            ELSE p.total - COALESCE(m.pagado, 0::numeric)
        END AS saldo,
        CASE
            WHEN p.total IS NULL THEN NULL::numeric
            ELSE LEAST(100::numeric, round(COALESCE(m.pagado, 0::numeric) / p.total * 100::numeric, 1))
        END AS porcentaje,
    COALESCE(m.movimientos, 0::bigint) AS movimientos,
    m.ultimo_pago,
    COALESCE(m.liquidado_de_contado, false) AS liquidado_de_contado,
    p.inscripcion,
    COALESCE(m.inscripcion_pagada, 0::numeric) AS inscripcion_pagada
   FROM students s
     LEFT JOIN groups g ON g.id = s.group_id
     LEFT JOIN planes_pago p ON p.student_id = s.id AND p.activo
     LEFT JOIN LATERAL ( SELECT sum(pg.monto) filter (where not pg.es_inscripcion) AS pagado,
            sum(pg.monto) filter (where pg.es_inscripcion) AS inscripcion_pagada,
            count(*) AS movimientos,
            max(pg.fecha) AS ultimo_pago,
            bool_or(pg.cubre_total) AS liquidado_de_contado
           FROM pagos pg
          WHERE pg.plan_id = p.id) m ON true;

grant select on public.v_pagos_resumen to authenticated;
