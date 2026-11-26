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
    fotoPath: r.foto_path ?? null,
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
    // La inscripción va aparte del curso: se cobra una vez y no forma parte
    // de las mensualidades, así que sumarla al plan descuadraba el saldo.
    inscripcion: num(r.inscripcion),
    inscripcionPagada: num(r.inscripcion_pagada) ?? 0,
    // Día del mes en que vence cada mensualidad (opcional). Sin él no hay
    // "vencidas": no se puede atrasar quien no tiene fecha límite.
    diaLimite: r.dia_limite ?? null,
  }))
}

/**
 * Ids de los alumnos que todavía no han pagado nada (ni curso ni inscripción).
 *
 * El alta ya no exige pago, así que la lista de Alumnos los marca. No existen
 * becas (regla del centro): todo plan tiene total > 0. La política de `pagos`
 * solo deja leer a quien tiene el apartado Pagos: quien no lo tiene recibiría
 * a todos como "sin pagos", por eso la pantalla solo lo pide en ese caso.
 */
export async function fetchAlumnosSinPagos() {
  const { data, error } = await supabase
    .from('v_pagos_resumen')
    .select('student_id, pagado, inscripcion_pagada')
  if (error) throw error
  return new Set(data
    .filter(r => (num(r.pagado) ?? 0) + (num(r.inscripcion_pagada) ?? 0) <= 0)
    .map(r => r.student_id))
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
    esInscripcion: !!p.es_inscripcion,
    // Quién recibió el dinero, escrito a mano al cobrar. `createdBy` es la
    // CUENTA abierta, que en un mostrador compartido no es la misma persona.
    registradoPor: p.registrado_por,
    createdBy: p.created_by,
    createdByName: creatorNames[p.created_by] ?? 'Administrador',
    // Un pago anulado NO se oculta: sigue en el historial, tachado, con motivo.
    // No suma al avance ni cubre meses.
    anulado: !!p.anulado_at,
    anuladoAt: p.anulado_at,
    motivoAnulacion: p.motivo_anulacion,
  }))
}

/**
 * Movimientos de un lote de alumnos, sin pasar por sus planes.
 *
 * La hoja de calificaciones necesita saber si el alumno ya pagó los exámenes
 * adicionales, y allí sólo se tienen ids de alumno. Pedir antes el plan de cada
 * uno sería un viaje de más para un dato que la política de `pagos` ya deja
 * leer directamente.
 */
export async function fetchPagosDeAlumnos(studentIds) {
  const ids = (studentIds ?? []).filter(Boolean)
  if (ids.length === 0) return []
  const { data, error } = await supabase
    .from('pagos')
    .select('student_id, monto, concepto, fecha, es_inscripcion')
    .in('student_id', ids)
    .is('anulado_at', null)
  if (error) throw error
  return data.map(p => ({
    studentId: p.student_id,
    monto: num(p.monto),
    concepto: p.concepto ?? '',
    fecha: p.fecha,
    esInscripcion: !!p.es_inscripcion,
  }))
}

/**
 * ¿Cubrió el alumno los exámenes adicionales (5 digitales + 1 general)?
 *
 * Se reconoce por el CONCEPTO del movimiento, que es texto libre: quien cobra
 * escribe "examen general", "exámenes digitales", "5 digitales"… Cualquier
 * concepto que hable de exámenes cuenta. Es una heurística deliberada: obligar
 * a un concepto exacto haría que un cobro real no se reflejara por una tilde.
 */
export const PAGO_EXAMENES_RE = /ex[áa]men|exam\b|digitales|simulacro/i

export function estadoPagoExamenes(pagosDelAlumno = []) {
  const relevantes = pagosDelAlumno.filter(p => PAGO_EXAMENES_RE.test(p.concepto))
  if (!relevantes.length) return { pagado: false, monto: 0, conceptos: [] }
  return {
    pagado: true,
    monto: relevantes.reduce((a, p) => a + (p.monto ?? 0), 0),
    conceptos: relevantes.map(p => p.concepto),
  }
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
  falta_quien_registra: 'Escribe tu nombre en «Registro»: debe constar quién recibió el pago.',
  pago_mayor_al_total: 'Con este pago se rebasaría el total del curso. Revisa el importe: puede pagar más de una mensualidad, pero no más del total.',
  pago_ya_anulado: 'Este pago ya está anulado.',
}

function traducir(error) {
  const raw = error?.message ?? ''
  const clave = Object.keys(MENSAJES).find(k => raw.includes(k))
  if (clave) return MENSAJES[clave]
  if (raw.includes('planes_pago_un_activo_por_alumno')) {
    return 'Este alumno ya tiene un plan activo. Edita el que existe o desactívalo primero.'
  }
  if (raw.includes('total_check') || raw.includes('monto_check')) {
    return 'El importe debe ser mayor que cero. No hay becas: todo plan tiene un total.'
  }
  return 'No se pudo guardar. Revisa los datos e inténtalo de nuevo.'
}

/** Alta o edición del plan de un alumno. `id` null → alta. */
export async function guardarPlan({
  id = null, studentId, total, modalidad = 'mensualidades',
  mensualidades = 1, inicio = null, concepto = 'Curso', notas = null, activo = true,
  inscripcion = null, diaLimite = null,
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
  /* El importe de inscripción se guarda aparte: `guardar_plan_pago` es una RPC
     compartida y ampliar su firma obligaría a tocar a todos sus llamadores. */
  if (data?.id ?? id) {
    const { error: e2 } = await supabase.rpc('set_inscripcion_plan', {
      p_plan_id: data?.id ?? id,
      p_inscripcion: inscripcion,
    })
    if (e2) return { ok: false, message: traducir(e2) }
    const { error: e3 } = await supabase.rpc('set_dia_limite_plan', {
      p_plan_id: data?.id ?? id,
      p_dia: diaLimite ? Number(diaLimite) : null,
    })
    if (e3) return { ok: false, message: traducir(e3) }
  }
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
  registradoPor = null, esInscripcion = false,
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
    p_registrado_por: registradoPor,
    p_es_inscripcion: esInscripcion,
  })
  if (error) return { ok: false, message: traducir(error) }
  return { ok: true, pago: data }
}

/** Anula un pago: deja de sumar, pero queda en el historial con su motivo. */
export async function borrarPago(id, motivo = null) {
  const { error } = await supabase.rpc('borrar_pago', { p_id: id, p_motivo: motivo })
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
export function calendarioPlan(fila, pagosDelPlan, hoy = hoyISO()) {
  if (!fila?.planId || !fila.inicio) return []
  const activos = pagosDelPlan.filter(p => !p.anulado && !p.esInscripcion)
  const contado = activos.some(p => p.cubreTotal)
  const esperadoPorMes = fila.total / Math.max(1, fila.mensualidades)

  const meses = Array.from({ length: fila.mensualidades }, (_, i) => {
    const mes = sumarMeses(fila.inicio, i)
    const delMes = activos.filter(p => p.periodo === mes)
    return { mes, delMes, pagado: delMes.reduce((s, p) => s + p.monto, 0) }
  })

  /* Los abonos sin mes (o de un mes fuera del plan) cuentan para el avance;
     para el calendario se aplican a los meses pendientes más antiguos. Antes
     el dinero entraba pero ningún mes se marcaba cubierto. */
  const claves = new Set(meses.map(m => m.mes))
  let bolsa = activos.filter(p => !p.cubreTotal && (p.periodo === null || !claves.has(p.periodo)))
    .reduce((s, p) => s + p.monto, 0)
  for (const m of meses) {
    const falta = Math.max(0, esperadoPorMes - m.pagado)
    const aplica = Math.min(falta, bolsa)
    m.aplicado = aplica
    bolsa -= aplica
  }

  return meses.map(m => {
    const cubierto = contado || m.pagado + m.aplicado >= esperadoPorMes - 0.01
    const limite = fechaLimite(m.mes, fila.diaLimite)
    return {
      mes: m.mes,
      etiqueta: etiquetaMes(m.mes),
      esperado: esperadoPorMes,
      pagado: m.pagado,
      abonosAplicados: m.aplicado,
      pagos: m.delMes,
      // Un plan liquidado de contado cubre todos sus meses aunque no haya un
      // movimiento con ese `periodo`.
      cubierto,
      porContado: contado && m.delMes.length === 0,
      limite,
      // Vencida solo si el plan tiene fecha límite, ya pasó y no está cubierta.
      vencida: !cubierto && !!limite && limite < hoy,
    }
  })
}

/** 'YYYY-MM-DD' de hoy en México. */
export function hoyISO() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })
}

/** Fecha límite de la mensualidad de `mes` ('YYYY-MM-01'): el día pactado,
 *  recortado al último día del mes (un 31 en febrero vence el 28/29). */
export function fechaLimite(mes, dia) {
  if (!dia || !mes) return null
  const [a, m] = mes.split('-').map(Number)
  const ultimo = new Date(a, m, 0).getDate()
  return `${a}-${String(m).padStart(2, '0')}-${String(Math.min(dia, ultimo)).padStart(2, '0')}`
}

/** Mensualidades vencidas (no cubiertas y con la fecha límite ya pasada). */
export function mensualidadesVencidas(fila, pagosDelPlan, hoy = hoyISO()) {
  return calendarioPlan(fila, pagosDelPlan, hoy).filter(m => m.vencida)
}

/** Movimientos que no cuelgan de ningún mes del calendario: contado y abonos
 *  sueltos. Cuentan igual para el porcentaje, así que tienen que verse. */
export function pagosSinMes(fila, pagosDelPlan) {
  if (!fila?.planId) return []
  const meses = new Set(calendarioPlan(fila, pagosDelPlan).map(m => m.mes))
  // Los anulados también se listan aquí (tachados): no se oculta nada.
  return pagosDelPlan.filter(p => p.anulado || p.periodo === null || !meses.has(p.periodo))
}

/** Estado de cobranza de un alumno, derivado de los importes.
 *  "Sin pagos" usa la misma cuenta que la bandera de Alumnos: ni curso ni
 *  inscripción. Con fecha límite, una mensualidad vencida lo vuelve "atrasado". */
export function estadoDe(fila, pagosDelPlan = null) {
  if (!fila.planId) return 'sin-plan'
  if (fila.porcentaje >= 100) return 'liquidado'
  if (fila.pagado <= 0 && (fila.inscripcionPagada ?? 0) <= 0) return 'sin-pagos'
  if (pagosDelPlan && fila.diaLimite && mensualidadesVencidas(fila, pagosDelPlan).length > 0) return 'atrasado'
  return 'parcial'
}

export const ESTADO_LABEL = {
  'sin-plan': 'Sin plan',
  'sin-pagos': 'Sin pagos',
  parcial: 'Pago parcial',
  atrasado: 'Atrasado',
  liquidado: 'Liquidado',
}

export const ESTADO_COLOR = {
  'sin-plan': 'var(--t3)',
  'sin-pagos': 'var(--bad)',
  parcial: 'var(--warn)',
  atrasado: 'var(--bad)',
  liquidado: 'var(--good)',
}
