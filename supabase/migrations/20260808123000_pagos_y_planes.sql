-- Control de pagos: qué debe cada alumno, cuánto lleva pagado y con qué medio.
--
-- Hasta ahora lo único que había era `students.pago_estado`, una columna de
-- texto libre que la hoja de Registrar usa como nota ('Liquidado', 'Al
-- corriente'…). Esa columna NO se toca aquí y sigue siendo de esa hoja. No se
-- usa tampoco como dato de arranque, por dos razones:
--   1. En producción está vacía —39 de 40 alumnos en null y el restante con
--      cadena vacía—, así que no hay ningún estado que heredar.
--   2. Aunque tuviera valores, es una etiqueta sin importes. El requisito es un
--      PORCENTAJE sobre el total del curso, y un porcentaje exige dinero, no
--      adjetivos. Derivar '60 %' de la palabra 'Al corriente' sería inventarlo.
-- La pantalla la muestra como insignia informativa junto al porcentaje real,
-- para que coordinación vea si la nota vieja y los números concuerdan.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- POR QUÉ DOS TABLAS Y NO UNA
--
-- Un único registro por alumno con "total" y "pagado" no permite responder con
-- qué se pagó ni cuándo, que es justo lo que se pide. Se separan:
--   · `planes_pago` — el CONTRATO: cuánto cuesta el curso y en cuántas
--     mensualidades se pactó. Cambia rara vez.
--   · `pagos`       — los MOVIMIENTOS: cada entrega de dinero, con su medio
--     (tarjeta / efectivo / transferencia) y su fecha. Crece con el tiempo.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- CÓMO ENTRA EL PAGO DE CONTADO SIN TRUCOS
--
-- El porcentaje se calcula SIEMPRE como sum(pagos.monto) / planes_pago.total,
-- nunca contando meses cubiertos. Esa es la decisión que hace que el contado
-- entre solo: un movimiento de 12 000 sobre un plan de 12 000 da 100 % sin
-- necesidad de fabricar diez filas mensuales ficticias.
--
-- Para eso `pagos.periodo` es NULLABLE: un pago NO está obligado a pertenecer a
-- un mes. Se usa así:
--   · periodo con fecha  → mensualidad de ese mes (se normaliza al día 1).
--   · periodo null       → liquidación de contado o abono suelto.
-- Y `cubre_total` marca explícitamente el movimiento que liquida el plan de una
-- vez, para que la vista mes a mes pueda pintar todos los meses como cubiertos
-- por ese pago en lugar de dejarlos en blanco con el alumno al 100 %. Es un
-- dato descriptivo: el porcentaje no depende de él, sólo la presentación.

-- ─── PLANES ──────────────────────────────────────────────────────────────────
create table if not exists public.planes_pago (
  id            uuid primary key default gen_random_uuid(),
  student_id    text not null references public.students(id) on delete cascade,
  concepto      text not null default 'Curso',
  total         numeric(12,2) not null check (total > 0),
  -- 'contado' es una sola exhibición; 'mensualidades', un calendario.
  modalidad     text not null default 'mensualidades'
                check (modalidad in ('contado','mensualidades')),
  mensualidades integer not null default 1 check (mensualidades between 1 and 36),
  -- Primer mes del calendario. El resto se deriva sumando meses: guardar una
  -- fila por mes vacío sería inventar deuda que nadie ha registrado.
  inicio        date not null default date_trunc('month', current_date)::date,
  notas         text,
  activo        boolean not null default true,
  created_at    timestamptz not null default now(),
  created_by    uuid,
  constraint contado_es_una_exhibicion
    check (modalidad <> 'contado' or mensualidades = 1)
);

-- Un alumno puede acumular planes de cursos pasados, pero sólo uno vigente: si
-- hubiera dos activos, "el porcentaje del alumno" dejaría de tener respuesta.
create unique index if not exists planes_pago_un_activo_por_alumno
  on public.planes_pago (student_id) where activo;

create index if not exists planes_pago_student_idx on public.planes_pago (student_id);

-- ─── MOVIMIENTOS ─────────────────────────────────────────────────────────────
create table if not exists public.pagos (
  id           uuid primary key default gen_random_uuid(),
  plan_id      uuid not null references public.planes_pago(id) on delete cascade,
  -- Denormalizado a propósito: las políticas RLS y los índices lo consultan en
  -- cada fila, y sin él cada comprobación pagaría un join contra planes_pago.
  -- Nunca llega del cliente: las RPC lo derivan del plan, así que no puede
  -- desincronizarse.
  student_id   text not null references public.students(id) on delete cascade,
  monto        numeric(12,2) not null check (monto > 0),
  metodo       text not null check (metodo in ('tarjeta','efectivo','transferencia')),
  fecha        date not null default current_date,
  -- Mes que cubre el movimiento, normalizado al día 1. Null = contado o abono
  -- que no se asigna a ningún mes concreto. Ver la nota de arriba.
  periodo      date,
  cubre_total  boolean not null default false,
  referencia   text,   -- folio de terminal o de transferencia
  nota         text,
  created_at   timestamptz not null default now(),
  created_by   uuid,
  constraint periodo_dia_uno check (periodo is null or periodo = date_trunc('month', periodo)::date),
  -- Un pago que liquida el total no pertenece a un mes: si lo hiciera, el
  -- calendario mostraría once meses sin pagar y un alumno al 100 %.
  constraint contado_sin_mes check (not cubre_total or periodo is null)
);

create index if not exists pagos_plan_idx    on public.pagos (plan_id);
create index if not exists pagos_student_idx on public.pagos (student_id);
create index if not exists pagos_periodo_idx on public.pagos (plan_id, periodo);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
-- Mismo criterio que el resto de las tablas (ver 20260803025006): el admin ve
-- todo, el sub-admin sólo sus grupos concedidos, el alumno únicamente lo suyo,
-- y quien no ha iniciado sesión, nada.
--
-- La lectura del sub-admin se concede aunque la PANTALLA de pagos sea sólo para
-- administradores. Son dos cosas distintas: la política describe qué datos le
-- corresponden a cada rol, y dejarle un agujero aquí sería incoherente con
-- alumnos, calificaciones y asistencia. Quién ve la pantalla lo decide la
-- interfaz; quién puede ESCRIBIR lo deciden las RPC de más abajo, y ahí sí se
-- exige admin.
--
-- No hay políticas de INSERT/UPDATE/DELETE a propósito: con RLS activo y sin
-- política, esas operaciones quedan denegadas, que es lo que se busca. Toda
-- escritura pasa por las RPC SECURITY DEFINER.

alter table public.planes_pago enable row level security;
drop policy if exists "leer planes de pago" on public.planes_pago;
create policy "leer planes de pago" on public.planes_pago
for select to authenticated
using (
  es_admin()
  or student_id = mi_student_id()
  or exists (select 1 from public.students s
             where s.id = planes_pago.student_id and puede_ver_grupo(s.group_id))
);

alter table public.pagos enable row level security;
drop policy if exists "leer pagos" on public.pagos;
create policy "leer pagos" on public.pagos
for select to authenticated
using (
  es_admin()
  or student_id = mi_student_id()
  or exists (select 1 from public.students s
             where s.id = pagos.student_id and puede_ver_grupo(s.group_id))
);

-- ─── VISTA DE RESUMEN ────────────────────────────────────────────────────────
-- security_invoker = true: la vista se ejecuta con los permisos de QUIEN LA
-- CONSULTA, así que hereda las políticas de students, groups, planes_pago y
-- pagos en lugar de saltárselas. Sin esa opción una vista es SECURITY DEFINER
-- de hecho y habría abierto por la puerta de atrás todo lo que las políticas
-- acababan de cerrar.
--
-- Arranca en `students` con LEFT JOIN al plan: un alumno sin plan tiene que
-- aparecer en la lista —es precisamente al que hay que darle uno de alta—, no
-- desaparecer de ella.
create or replace view public.v_pagos_resumen
with (security_invoker = true) as
select
  s.id                                   as student_id,
  s.name                                 as student_name,
  s.email                                as student_email,
  s.group_id,
  g.name                                 as group_name,
  g.sucursal,
  g.institucion,
  s.avatar,
  s.pago_estado,                         -- nota libre de la hoja Registrar, informativa
  p.id                                   as plan_id,
  p.concepto,
  p.total,
  p.modalidad,
  p.mensualidades,
  p.inicio,
  p.notas,
  coalesce(m.pagado, 0)                  as pagado,
  case when p.total is null then null
       else p.total - coalesce(m.pagado, 0) end as saldo,
  -- Se capa al 100 %: un sobrepago no debe pintar una barra al 130 %. El
  -- excedente sigue siendo visible en `saldo`, que se vuelve negativo.
  case when p.total is null then null
       else least(100, round(coalesce(m.pagado, 0) / p.total * 100, 1)) end as porcentaje,
  coalesce(m.movimientos, 0)             as movimientos,
  m.ultimo_pago,
  coalesce(m.liquidado_de_contado, false) as liquidado_de_contado
from public.students s
left join public.groups g on g.id = s.group_id
left join public.planes_pago p on p.student_id = s.id and p.activo
left join lateral (
  select sum(pg.monto)                   as pagado,
         count(*)                        as movimientos,
         max(pg.fecha)                   as ultimo_pago,
         bool_or(pg.cubre_total)         as liquidado_de_contado
  from public.pagos pg
  where pg.plan_id = p.id
) m on true;

grant select on public.v_pagos_resumen to authenticated;

-- ─── ESCRITURA: RPC SECURITY DEFINER ─────────────────────────────────────────
-- La comprobación de rol va DENTRO de la función y no en una política porque
-- nadie escribe en estas tablas directamente: así hay un único punto donde se
-- decide quién puede mover dinero. Se exige admin: los pagos son competencia de
-- coordinación, no del sub-admin que sólo lleva sus grupos.
create or replace function public.exigir_admin_pagos()
returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not es_admin() then
    raise exception 'solo_admin_puede_gestionar_pagos';
  end if;
end;
$$;

/** Alta o edición del plan de un alumno. p_id null → inserta. */
create or replace function public.guardar_plan_pago(
  p_id uuid,
  p_student_id text,
  p_total numeric,
  p_modalidad text default 'mensualidades',
  p_mensualidades integer default 1,
  p_inicio date default null,
  p_concepto text default 'Curso',
  p_notas text default null,
  p_activo boolean default true
)
returns public.planes_pago
language plpgsql security definer set search_path = public as $$
declare v_row planes_pago;
        v_inicio date := coalesce(date_trunc('month', p_inicio)::date,
                                  date_trunc('month', current_date)::date);
        v_meses integer := case when p_modalidad = 'contado' then 1
                                else greatest(1, coalesce(p_mensualidades, 1)) end;
begin
  perform exigir_admin_pagos();

  if not exists (select 1 from students s where s.id = p_student_id) then
    raise exception 'student_not_found';
  end if;

  if p_id is null then
    insert into planes_pago (student_id, concepto, total, modalidad, mensualidades,
                             inicio, notas, activo, created_by)
    values (p_student_id, coalesce(nullif(p_concepto,''), 'Curso'), p_total,
            p_modalidad, v_meses, v_inicio, p_notas, coalesce(p_activo, true), auth.uid())
    returning * into v_row;
  else
    update planes_pago
    set concepto = coalesce(nullif(p_concepto,''), 'Curso'),
        total = p_total, modalidad = p_modalidad, mensualidades = v_meses,
        inicio = v_inicio, notas = p_notas, activo = coalesce(p_activo, true)
    where id = p_id
    returning * into v_row;
    if v_row.id is null then raise exception 'plan_not_found'; end if;
  end if;

  return v_row;
end;
$$;

/**
 * Alta o edición de un movimiento. p_id null → inserta.
 *
 * `student_id` no es parámetro: se deriva del plan. Si lo mandara el cliente
 * podría apuntar un pago al alumno equivocado y las políticas RLS pasarían a
 * describir una realidad falsa.
 */
create or replace function public.registrar_pago(
  p_id uuid,
  p_plan_id uuid,
  p_monto numeric,
  p_metodo text,
  p_fecha date default null,
  p_periodo date default null,
  p_cubre_total boolean default false,
  p_referencia text default null,
  p_nota text default null
)
returns public.pagos
language plpgsql security definer set search_path = public as $$
declare v_row pagos;
        v_student text;
        -- Un pago de contado no cuelga de ningún mes: se ignora el periodo que
        -- venga en lugar de rechazar la llamada por una casilla marcada.
        v_periodo date := case when coalesce(p_cubre_total, false) then null
                               else date_trunc('month', p_periodo)::date end;
begin
  perform exigir_admin_pagos();

  select student_id into v_student from planes_pago where id = p_plan_id;
  if v_student is null then raise exception 'plan_not_found'; end if;

  if p_id is null then
    insert into pagos (plan_id, student_id, monto, metodo, fecha, periodo,
                       cubre_total, referencia, nota, created_by)
    values (p_plan_id, v_student, p_monto, p_metodo, coalesce(p_fecha, current_date),
            v_periodo, coalesce(p_cubre_total, false), p_referencia, p_nota, auth.uid())
    returning * into v_row;
  else
    update pagos
    set plan_id = p_plan_id, student_id = v_student, monto = p_monto, metodo = p_metodo,
        fecha = coalesce(p_fecha, current_date), periodo = v_periodo,
        cubre_total = coalesce(p_cubre_total, false),
        referencia = p_referencia, nota = p_nota
    where id = p_id
    returning * into v_row;
    if v_row.id is null then raise exception 'pago_not_found'; end if;
  end if;

  return v_row;
end;
$$;

create or replace function public.borrar_pago(p_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  perform exigir_admin_pagos();
  delete from pagos where id = p_id;
  if not found then raise exception 'pago_not_found'; end if;
end;
$$;

-- Un plan con movimientos NO se borra: eso destruiría el historial de dinero
-- cobrado. Para retirarlo de la vista se marca inactivo con guardar_plan_pago.
create or replace function public.borrar_plan_pago(p_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  perform exigir_admin_pagos();
  if exists (select 1 from pagos where plan_id = p_id) then
    raise exception 'plan_con_pagos';
  end if;
  delete from planes_pago where id = p_id;
  if not found then raise exception 'plan_not_found'; end if;
end;
$$;

-- ─── PERMISOS ────────────────────────────────────────────────────────────────
-- `exigir_admin_pagos` no es API: sólo la usan las RPC de aquí.
--
-- Hay que revocar a `public` Y a `anon`/`authenticated`, en ese orden y por
-- separado. Postgres concede EXECUTE al pseudo-rol `public` en toda función
-- nueva, y `anon` hereda de él: revocar sólo a `anon` deja la función expuesta
-- por la puerta de atrás en /rest/v1/rpc. El linter de Supabase lo detectó en
-- la primera versión de esta migración —"Public Can Execute SECURITY DEFINER
-- Function"— y por eso queda escrito aquí. Ver también 20260728161500, donde
-- se explica el caso simétrico.
revoke execute on function public.exigir_admin_pagos() from public, anon, authenticated;

revoke execute on function public.guardar_plan_pago(uuid, text, numeric, text, integer, date, text, text, boolean) from public, anon, authenticated;
revoke execute on function public.registrar_pago(uuid, uuid, numeric, text, date, date, boolean, text, text) from public, anon, authenticated;
revoke execute on function public.borrar_pago(uuid) from public, anon, authenticated;
revoke execute on function public.borrar_plan_pago(uuid) from public, anon, authenticated;

-- Sólo `authenticated`: sin sesión no hay rol en el token y `es_admin()` sería
-- falso de todos modos, pero no se le ofrece siquiera la puerta a `anon`.
grant execute on function public.guardar_plan_pago(uuid, text, numeric, text, integer, date, text, text, boolean) to authenticated;
grant execute on function public.registrar_pago(uuid, uuid, numeric, text, date, date, boolean, text, text) to authenticated;
grant execute on function public.borrar_pago(uuid) to authenticated;
grant execute on function public.borrar_plan_pago(uuid) to authenticated;

comment on table public.planes_pago is 'Contrato de pago de un alumno: total del curso y calendario pactado. Sólo uno activo por alumno.';
comment on table public.pagos is 'Movimientos de pago. periodo null = contado o abono sin mes asignado; el porcentaje se calcula por importes, no por meses.';
comment on view public.v_pagos_resumen is 'Un renglón por alumno con su plan activo, lo pagado, el saldo y el porcentaje. security_invoker: hereda las políticas RLS de quien consulta.';
