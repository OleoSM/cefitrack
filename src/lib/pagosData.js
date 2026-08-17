import { supabase } from './supabaseClient'

/**
 * Acceso a datos del módulo de Pagos.
 *
 * Vive aparte de `supabaseData.js` porque es una superficie nueva y completa:
 * planes, movimientos y el resumen agregado. Mezclarlo allí habría hecho crecer
 * un archivo que ya toca todas las pantallas.
 *
 * Reglas del proyecto que se respetan aquí:
 *   · La LECTURA va contra la vista/tablas y la filtran las políticas RLS. No
 *     hace falta pasar el rol ni la sucursal: la base ya sabe quién pregunta.
 *   · La ESCRITURA pasa entera por RPC SECURITY DEFINER. No hay un solo
 *     insert/update/delete directo, y las tablas ni siquiera tienen política
 *     que lo permitiera.
 * Ver supabase/migrations/20260808120000_pagos_y_planes.sql.
 */

/* ── Catálogo de formas de pago ──────────────────────────────────────────────
   Un único sitio donde vive la lista. La base tiene el mismo CHECK; si alguna
   vez se añade una forma más, se cambia en los dos y no en quince JSX. */
export const METODOS = ['tarjeta_credito', 'tarjeta_debito', 'efectivo', 'transferencia']

export const METODO_LABEL = {
  tarjeta_credito: 'Tarjeta de crédito',
  tarjeta_debito: 'Tarjeta de débito',
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
}

/* Etiqueta corta para las insignias de la tabla, donde el nombre completo no
   cabe en la columna de formas. */
export const METODO_LABEL_CORTO = {
  tarjeta_credito: 'Crédito',
  tarjeta_debito: 'Débito',
  efectivo: 'Efectivo',
  transferencia: 'Transfer.',
}

/* Colores identificadores de cada forma de pago: sólidos y opacos, pensados
   para llevar texto blanco encima. Nada de alfa — ver la regla de color al
   inicio de index.css. */
/* Crédito y débito comparten el azul a propósito: ambas son cobro con tarjeta
   y conviene que se lean como una familia frente al efectivo o la
   transferencia. Se distinguen por icono y etiqueta, no por tono. Inventar un
   segundo azul aquí habría exigido un token nuevo en las tres identidades
   (regla 5 de la cabecera de index.css) para separar dos cosas que en realidad
   son parientes. */
export const METODO_COLOR = {
  tarjeta_credito: 'var(--info-solid)',
  tarjeta_debito: 'var(--info-solid)',
  efectivo: 'var(--good-solid)',
  transferencia: 'var(--warn-solid)',
}

const num = v => (v === null || v === undefined ? null : Number(v))

/* ── Lectura ─────────────────────────────────────────────────────────────── */

/**
 * Un renglón por alumno con su plan vigente y lo cobrado hasta hoy.
 *
 * Incluye a los alumnos SIN plan (total null): son justamente a los que hay que
 * darles uno de alta, así que ocultarlos dejaría la pantalla incapaz de
 * arrancar.
 */
export async function fetchResumenPagos() {
  /* El catálogo de avatares va en una consulta aparte porque la vista no puede
     embeberlo: PostgREST necesita una clave foránea entre las dos relaciones y
     una vista no la tiene. Son 34 filas y el panel entero muestra ya el avatar
     del alumno, así que se resuelve aquí en vez de dejar sólo iniciales. */
  const [{ data, error }, { data: avatares }] = await Promise.all([
    supabase.from('v_pagos_resumen').select('*').order('student_name'),
    supabase.from('avatar_catalogo').select('id, src'),
  ])
  if (error) throw error
  const src = Object.fromEntries((avatares ?? []).map(a => [a.id, a.src]))
  return data.map(r => ({
    studentId: r.student_id,
    studentName: r.student_name,
    studentEmail: r.student_email,
    groupId: r.group_id,
    groupName: r.group_name,
    sucursal: r.sucursal,
    institucion: r.institucion,
    avatar: r.avatar,
    avatarSrc: r.avatar ? (src[r.avatar] ?? null) : null,
    // Nota libre de la hoja Registrar. Se muestra tal cual, sólo informativa:
    // el porcentaje real sale de los importes, no de esta etiqueta.
    pagoEstado: r.pago_estado,
    planId: r.plan_id,
    concepto: r.concepto,
    total: num(r.total),
    modalidad: r.modalidad,
    mensualidades: r.mensualidades,
    inicio: r.inicio,
    notas: r.notas,
    pagado: num(r.pagado) ?? 0,
    saldo: num(r.saldo),
    porcentaje: num(r.porcentaje),
    movimientos: r.movimientos ?? 0,
    ultimoPago: r.ultimo_pago,
    liquidadoDeContado: !!r.liquidado_de_contado,
  }))
}

/**
 * Movimientos de los planes indicados.
 *
 * Se piden por lote y no de uno en uno: la pantalla necesita saber con qué
 * medio pagó cada alumno para poder filtrar por forma de pago, y una consulta
 * por fila serían decenas de viajes al abrir la página.
 */
export async function fetchPagos(planIds) {
  const ids = (planIds ?? []).filter(Boolean)
  if (ids.length === 0) return []
  const { data, error } = await supabase
    .from('pagos')
    .select('*')
    .in('plan_id', ids)
    .order('fecha', { ascending: false })
  if (error) throw error
  const creators = [...new Set(data.map(p=>p.created_by).filter(Boolean))]
  const { data: perfiles } = creators.length
    ? await supabase.from('profiles').select('id,name').in('id',creators)
    : { data:[] }
  const creatorNames = Object.fromEntries((perfiles ?? []).map(p=>[p.id,p.name]))
  return data.map(p => ({
    id: p.id,
    planId: p.plan_id,
    studentId: p.student_id,
    monto: num(p.monto),
    metodo: p.metodo,
    fecha: p.fecha,
    periodo: p.periodo,       // null = contado o abono sin mes asignado
    cubreTotal: !!p.cubre_total,
    referencia: p.referencia,
    nota: p.nota,
    concepto: p.concepto ?? 'Pago de curso',
    createdBy: p.created_by,
    createdByName: creatorNames[p.created_by] ?? 'Administrador',
  }))
}

/* ── Escritura (RPC) ─────────────────────────────────────────────────────── */

/* Los errores de la base llegan como códigos ('plan_con_pagos'), que no se le
   enseñan a nadie. Se traducen aquí para que las pantallas no repitan el mapa. */
const MENSAJES = {
  solo_admin_puede_gestionar_pagos: 'Sólo un administrador puede registrar o modificar pagos.',
  student_not_found: 'El alumno ya no existe.',
  plan_not_found: 'El plan de pago ya no existe.',
  pago_not_found: 'El movimiento ya no existe.',
  plan_con_pagos: 'Este plan tiene pagos registrados: desactívalo en lugar de borrarlo.',
}

function traducir(error) {
  const raw = error?.message ?? ''
  const clave = Object.keys(MENSAJES).find(k => raw.includes(k))
  if (clave) return MENSAJES[clave]
  if (raw.includes('planes_pago_un_activo_por_alumno')) {
    return 'Este alumno ya tiene un plan activo. Edita el que existe o desactívalo primero.'
  }
  if (raw.includes('total_check') || raw.includes('monto_check')) {
    return 'El importe debe ser mayor que cero.'
  }
  return 'No se pudo guardar. Revisa los datos e inténtalo de nuevo.'
}

/** Alta o edición del plan de un alumno. `id` null → alta. */
export async function guardarPlan({
  id = null, studentId, total, modalidad = 'mensualidades',
  mensualidades = 1, inicio = null, concepto = 'Curso', notas = null, activo = true,
}) {
  const { data, error } = await supabase.rpc('guardar_plan_pago', {
    p_id: id,
    p_student_id: studentId,
    p_total: total,
    p_modalidad: modalidad,
    p_mensualidades: mensualidades,
    p_inicio: inicio,
    p_concepto: concepto,
    p_notas: notas,
    p_activo: activo,
  })
  if (error) return { ok: false, message: traducir(error) }
  return { ok: true, plan: data }
}

/**
 * Alta o edición de un movimiento.
 *
 * `studentId` no se manda: la RPC lo deriva del plan. Si lo eligiera el cliente
 * podría apuntar un pago al alumno equivocado.
 *
 * `cubreTotal` es el pago de contado: un solo movimiento que liquida el plan.
 * En ese caso `periodo` se ignora, porque una liquidación no pertenece a un mes.
 */
export async function registrarPago({
  id = null, planId, monto, metodo, fecha = null,
  periodo = null, cubreTotal = false, concepto = 'Pago de curso', referencia = null, nota = null,
}) {
  const { data, error } = await supabase.rpc('registrar_pago_v2', {
    p_id: id,
    p_plan_id: planId,
    p_monto: monto,
    p_metodo: metodo,
    p_fecha: fecha,
    p_periodo: cubreTotal ? null : periodo,
    p_cubre_total: cubreTotal,
    p_concepto: concepto,
    p_referencia: referencia,
    p_nota: nota,
  })
  if (error) return { ok: false, message: traducir(error) }
  return { ok: true, pago: data }
}

export async function borrarPago(id) {
  const { error } = await supabase.rpc('borrar_pago', { p_id: id })
  if (error) return { ok: false, message: traducir(error) }
  return { ok: true }
}

export async function borrarPlan(id) {
  const { error } = await supabase.rpc('borrar_plan_pago', { p_id: id })
  if (error) return { ok: false, message: traducir(error) }
  return { ok: true }
}

/* ── Derivados de presentación ───────────────────────────────────────────── */

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
               'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

/** 'YYYY-MM-DD' → 'Mar 2026'. Se parte la cadena en vez de usar `new Date`
 *  porque `new Date('2026-03-01')` se interpreta en UTC y en México retrocede
 *  al mes anterior. */
export function etiquetaMes(iso) {
  if (!iso) return '—'
  const [a, m] = iso.split('-')
  return `${MESES[Number(m) - 1]} ${a}`
}

export function claveMes(iso) {
  return iso ? iso.slice(0, 7) + '-01' : null
}

/** Suma `n` meses a un 'YYYY-MM-01', sin pasar por Date. */
export function sumarMeses(iso, n) {
  const [a, m] = iso.split('-').map(Number)
  const total = (a * 12 + (m - 1)) + n
  const anio = Math.floor(total / 12)
  const mes = (total % 12) + 1
  return `${anio}-${String(mes).padStart(2, '0')}-01`
}

export const mxn = v =>
  (v ?? 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0 })

/**
 * Calendario mes a mes de un plan.
 *
 * Se genera aquí y no se guarda en la base: una fila por mes vacío sería deuda
 * inventada que nadie registró, y cambiar las mensualidades pactadas obligaría
 * a reescribirlas todas.
 *
 * El pago de contado NO se reparte entre los meses: se marca el plan entero
 * como liquidado y cada mes lo refleja. Repartir 12 000 entre seis meses
 * fabricaría seis movimientos que nunca ocurrieron.
 */
export function calendarioPlan(fila, pagosDelPlan) {
  if (!fila?.planId || !fila.inicio) return []
  const contado = pagosDelPlan.some(p => p.cubreTotal)
  const esperadoPorMes = fila.total / Math.max(1, fila.mensualidades)

  return Array.from({ length: fila.mensualidades }, (_, i) => {
    const mes = sumarMeses(fila.inicio, i)
    const delMes = pagosDelPlan.filter(p => p.periodo === mes)
    const pagado = delMes.reduce((s, p) => s + p.monto, 0)
    return {
      mes,
      etiqueta: etiquetaMes(mes),
      esperado: esperadoPorMes,
      pagado,
      pagos: delMes,
      // Un plan liquidado de contado cubre todos sus meses aunque no haya un
      // movimiento con ese `periodo`.
      cubierto: contado || pagado >= esperadoPorMes - 0.01,
      porContado: contado && delMes.length === 0,
    }
  })
}

/** Movimientos que no cuelgan de ningún mes del calendario: contado y abonos
 *  sueltos. Cuentan igual para el porcentaje, así que tienen que verse. */
export function pagosSinMes(fila, pagosDelPlan) {
  if (!fila?.planId) return []
  const meses = new Set(calendarioPlan(fila, pagosDelPlan).map(m => m.mes))
  return pagosDelPlan.filter(p => p.periodo === null || !meses.has(p.periodo))
}

/** Estado de cobranza de un alumno, derivado de los importes. */
export function estadoDe(fila) {
  if (!fila.planId) return 'sin-plan'
  if (fila.porcentaje >= 100) return 'liquidado'
  if (fila.pagado <= 0) return 'sin-pagos'
  return 'parcial'
}

export const ESTADO_LABEL = {
  'sin-plan': 'Sin plan',
  'sin-pagos': 'Sin pagos',
  parcial: 'Pago parcial',
  liquidado: 'Liquidado',
}

export const ESTADO_COLOR = {
  'sin-plan': 'var(--t3)',
  'sin-pagos': 'var(--bad)',
  parcial: 'var(--warn)',
  liquidado: 'var(--good)',
}
