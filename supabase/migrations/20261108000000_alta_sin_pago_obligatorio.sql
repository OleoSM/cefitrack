-- Alta de alumnos sin pago obligatorio (pedido de CEFIMAT, 2026-11-08):
--  · El plan y el primer importe pasan a ser opcionales. Sin total no se crea
--    plan; con total pero sin importe se crea el plan y ningún movimiento.
--  · Si se registra importe, se valida igual que antes (forma de pago y que no
--    pase del total). Sigue siendo todo o nada.
--  · La cuenta de acceso se crea igual que siempre (create_student →
--    sincronizar_acceso): el alumno entra aunque no haya pagado nada.
--  · Misma firma: no cambian los permisos de ejecución.

create or replace function public.alta_alumno_con_pago(
  p_name text, p_email text, p_group_id text, p_password text,
  p_tutor_name text, p_tutor_email text, p_tutor_phone text, p_sucursal text,
  p_total numeric, p_modalidad text, p_mensualidades integer, p_inicio date, p_concepto text,
  p_monto numeric, p_metodo text, p_es_inscripcion boolean default false, p_referencia text default null)
returns table(id text, name text, email text, group_id text, plan_id uuid, pago_id uuid)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare v_alumno record; v_plan uuid; v_pago uuid; v_quien text;
        v_con_plan boolean := p_total is not null;
        v_con_pago boolean := coalesce(p_monto, 0) > 0;
        v_meses integer := case when p_modalidad = 'contado' then 1 else greatest(1, coalesce(p_mensualidades, 1)) end;
        v_inicio date := coalesce(date_trunc('month', p_inicio)::date, date_trunc('month', current_date)::date);
begin
  if v_con_plan then
    if p_total < 0 then raise exception 'falta_total'; end if;
    if p_modalidad not in ('contado', 'mensualidades') then raise exception 'modalidad_invalida'; end if;
  end if;
  if coalesce(p_monto, 0) < 0 then raise exception 'monto_invalido'; end if;
  if v_con_pago then
    -- Un importe necesita un plan del que colgar.
    if not v_con_plan then raise exception 'falta_total'; end if;
    if not coalesce(p_es_inscripcion, false) and p_total > 0 and p_monto > p_total then raise exception 'pago_mayor_al_total'; end if;
    if nullif(trim(coalesce(p_metodo, '')), '') is null then raise exception 'falta_metodo'; end if;
  end if;

  select * into v_alumno from public.create_student(p_name, p_email, p_group_id, p_password,
    p_tutor_name, p_tutor_email, p_tutor_phone, p_sucursal);

  if v_con_plan then
    insert into planes_pago (student_id, concepto, total, modalidad, mensualidades, inicio, activo, created_by)
    values (v_alumno.id, coalesce(nullif(trim(p_concepto), ''), 'Curso'), p_total, p_modalidad, v_meses, v_inicio, true, auth.uid())
    returning planes_pago.id into v_plan;
  end if;

  if v_con_pago then
    select coalesce(nullif(p.name, ''), p.email) into v_quien from profiles p where p.id = auth.uid();
    insert into pagos (plan_id, student_id, monto, metodo, fecha, periodo, cubre_total, concepto, referencia,
                       registrado_por, es_inscripcion, created_by)
    values (v_plan, v_alumno.id, p_monto, p_metodo, (now() at time zone 'America/Mexico_City')::date,
            case when coalesce(p_es_inscripcion, false) or (p_modalidad = 'contado' and p_monto >= p_total) then null else v_inicio end,
            not coalesce(p_es_inscripcion, false) and p_modalidad = 'contado' and p_monto >= p_total,
            case when coalesce(p_es_inscripcion, false) then 'Inscripción' else 'Primer pago' end,
            p_referencia, coalesce(v_quien, 'SIGA'), coalesce(p_es_inscripcion, false), auth.uid())
    returning pagos.id into v_pago;
  end if;

  return query select v_alumno.id, v_alumno.name, v_alumno.email, v_alumno.group_id, v_plan, v_pago;
end $$;
