-- Reglas de negocio de pagos (decididas el 2026-11-20):
--   · Un pago "borrado" NO desaparece: queda anulado en el historial, con
--     quién, cuándo y por qué. Toda edición deja también su rastro.
--   · No se puede pagar más que el total del curso (sí más que una mensualidad).
--   · No hay becas: el total de un plan siempre es > 0 (ya lo exige el CHECK
--     planes_pago_total_check).
--   · Fecha límite de pago OPCIONAL por plan (día del mes) para poder hablar de
--     mensualidades vencidas.

-- ── Anulación ────────────────────────────────────────────────────────────────
alter table public.pagos
  add column if not exists anulado_at timestamptz,
  add column if not exists anulado_por uuid,
  add column if not exists motivo_anulacion text;

-- ── Bitácora de cambios: cada edición o anulación guarda la fila anterior ──
create table if not exists public.pagos_historial (
  id          uuid primary key default gen_random_uuid(),
  pago_id     uuid not null,
  student_id  text not null,
  accion      text not null check (accion in ('edicion', 'anulacion')),
  antes       jsonb not null,
  hecho_por   uuid,
  hecho_at    timestamptz not null default now()
);
create index if not exists pagos_historial_pago_idx on public.pagos_historial (pago_id);
alter table public.pagos_historial enable row level security;

-- Solo lectura para quien puede ver los pagos de ese alumno; nadie escribe
-- directo (lo hace el trigger como definer).
drop policy if exists pagos_historial_select on public.pagos_historial;
create policy pagos_historial_select on public.pagos_historial
  for select to authenticated
  using (public.es_admin() or (public.tiene_apartado('pagos') and public.puede_gestionar_alumno(student_id)));

create or replace function public.trg_pagos_historial()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  insert into pagos_historial (pago_id, student_id, accion, antes, hecho_por)
  values (old.id, old.student_id,
          case when old.anulado_at is null and new.anulado_at is not null then 'anulacion' else 'edicion' end,
          to_jsonb(old), auth.uid());
  return new;
end;
$$;

drop trigger if exists pagos_historial_upd on public.pagos;
create trigger pagos_historial_upd
  before update on public.pagos
  for each row execute function public.trg_pagos_historial();

-- Un pago ya no se borra físicamente desde la app: se anula.
create or replace function public.borrar_pago(p_id uuid, p_motivo text default null)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_student text; v_anulado timestamptz;
begin
  select student_id, anulado_at into v_student, v_anulado from pagos where id = p_id;
  if v_student is null then raise exception 'pago_not_found'; end if;
  perform exigir_pagos_alumno(v_student);
  if v_anulado is not null then raise exception 'pago_ya_anulado'; end if;
  update pagos
     set anulado_at = now(), anulado_por = auth.uid(),
         motivo_anulacion = nullif(trim(p_motivo), '')
   where id = p_id;
end;
$$;
-- La firma vieja (solo p_id) la resuelve el default de p_motivo.
drop function if exists public.borrar_pago(uuid);
revoke all on function public.borrar_pago(uuid, text) from public, anon;
grant execute on function public.borrar_pago(uuid, text) to authenticated;

-- ── Tope: lo pagado del curso nunca supera el total del plan ───────────────
create or replace function public.registrar_pago_v2(p_id uuid, p_plan_id uuid, p_monto numeric, p_metodo text, p_fecha date DEFAULT NULL::date, p_periodo date DEFAULT NULL::date, p_cubre_total boolean DEFAULT false, p_concepto text DEFAULT 'Pago de curso'::text, p_referencia text DEFAULT NULL::text, p_nota text DEFAULT NULL::text, p_registrado_por text DEFAULT NULL::text, p_es_inscripcion boolean DEFAULT false)
 RETURNS pagos
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_row public.pagos; v_student text; v_quien text; v_total numeric; v_otros numeric;
begin
  select student_id, total into v_student, v_total from public.planes_pago where id = p_plan_id;
  if v_student is null then raise exception 'plan_not_found'; end if;
  perform public.exigir_pagos_alumno(v_student);
  if p_id is not null and not exists (select 1 from public.pagos x where x.id = p_id and x.student_id = v_student) then
    raise exception 'pago_not_found';
  end if;
  if p_id is not null and exists (select 1 from public.pagos x where x.id = p_id and x.anulado_at is not null) then
    raise exception 'pago_ya_anulado';
  end if;
  v_quien := nullif(trim(p_registrado_por),'');
  if v_quien is null then raise exception 'falta_quien_registra'; end if;
  if coalesce(p_es_inscripcion,false) then p_periodo := null; p_cubre_total := false; end if;

  -- Regla: no se paga más que el total del curso (la inscripción va aparte).
  if not coalesce(p_es_inscripcion,false) then
    select coalesce(sum(monto), 0) into v_otros
      from public.pagos
     where plan_id = p_plan_id and not es_inscripcion and anulado_at is null
       and (p_id is null or id <> p_id);
    if v_otros + coalesce(p_monto, 0) > v_total + 0.009 then
      raise exception 'pago_mayor_al_total';
    end if;
  end if;

  if p_id is null then
    insert into public.pagos(plan_id,student_id,monto,metodo,fecha,periodo,cubre_total,concepto,
                             referencia,nota,registrado_por,es_inscripcion,created_by)
    values(p_plan_id,v_student,p_monto,p_metodo,coalesce(p_fecha,(now() at time zone 'America/Mexico_City')::date),
      case when p_cubre_total then null else date_trunc('month',p_periodo)::date end,
      coalesce(p_cubre_total,false),
      coalesce(nullif(trim(p_concepto),''), case when coalesce(p_es_inscripcion,false) then 'Inscripción' else 'Pago de curso' end),
      p_referencia,p_nota,v_quien,coalesce(p_es_inscripcion,false),(select auth.uid()))
    returning * into v_row;
  else
    update public.pagos set monto=p_monto,metodo=p_metodo,fecha=coalesce(p_fecha,(now() at time zone 'America/Mexico_City')::date),
      periodo=case when p_cubre_total then null else date_trunc('month',p_periodo)::date end,
      cubre_total=coalesce(p_cubre_total,false),
      concepto=coalesce(nullif(trim(p_concepto),''),'Pago de curso'),
      referencia=p_referencia,nota=p_nota,registrado_por=v_quien,
      es_inscripcion=coalesce(p_es_inscripcion,false)
     where id=p_id returning * into v_row;
  end if;
  return v_row;
end $function$;

-- ── Fecha límite opcional ───────────────────────────────────────────────────
alter table public.planes_pago
  add column if not exists dia_limite smallint
  check (dia_limite is null or dia_limite between 1 and 31);

create or replace function public.set_dia_limite_plan(p_plan_id uuid, p_dia smallint)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_student text;
begin
  select student_id into v_student from public.planes_pago where id = p_plan_id;
  if v_student is null then raise exception 'plan_not_found'; end if;
  perform public.exigir_pagos_alumno(v_student);
  update public.planes_pago set dia_limite = p_dia where id = p_plan_id;
end;
$$;
revoke all on function public.set_dia_limite_plan(uuid, smallint) from public, anon;
grant execute on function public.set_dia_limite_plan(uuid, smallint) to authenticated;

-- ── Vista resumen: los anulados no suman ──────────────────────────────────
create or replace view public.v_pagos_resumen
with (security_invoker = true)
as
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
    COALESCE(m.inscripcion_pagada, 0::numeric) AS inscripcion_pagada,
    p.dia_limite
   FROM students s
     LEFT JOIN groups g ON g.id = s.group_id
     LEFT JOIN planes_pago p ON p.student_id = s.id AND p.activo
     LEFT JOIN LATERAL ( SELECT sum(pg.monto) FILTER (WHERE NOT pg.es_inscripcion) AS pagado,
            sum(pg.monto) FILTER (WHERE pg.es_inscripcion) AS inscripcion_pagada,
            count(*) AS movimientos,
            max(pg.fecha) AS ultimo_pago,
            bool_or(pg.cubre_total) AS liquidado_de_contado
           FROM pagos pg
          WHERE pg.plan_id = p.id AND pg.anulado_at IS NULL) m ON true;
