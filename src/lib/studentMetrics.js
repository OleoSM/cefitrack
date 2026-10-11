// Pipeline oficial de métricas del alumno, conectado a los datos registrados
// (evaluaciones + asistencias + tareas). El promedio ponderado usa los pesos
// de Configuración (por defecto: Exámenes 70% · Tareas 20% · Asistencia 10%)
// y el lugar en el grupo es el orden de ese promedio.
//
// Todas las funciones son puras: reciben los datos ya cargados desde Supabase
// (evaluaciones y registros de asistencia) en vez de leerlos de mockData.
import { loadSettings } from './settings'

export const esExamen = tipo => /examen/i.test(tipo)
export const esTarea  = tipo => /tarea/i.test(tipo)

/** Normaliza una evaluación a escala 10 para poder promediar distintas escalas. */
export const calificacionBase10 = e =>
  e.calMax && e.calMax !== 10 ? (e.calificacion / e.calMax) * 10 : e.calificacion

/* Promedio de evaluaciones tipo examen (si no hay, usa todas) */
export function promedioExamenes(evs) {
  const exams = evs.filter(e => esExamen(e.tipo))
  const pool = exams.length ? exams : evs
  if (!pool.length) return 0
  return +(pool.reduce((sum, e) => sum + calificacionBase10(e), 0) / pool.length).toFixed(2)
}

/* Asistencia real del alumno: 3 retardos = 1 inasistencia. Ya no hay estado
   "justificado" —el centro sólo distingue tardanza de inasistencia—, así que
   toda sesión registrada cuenta. */
export function statsAsistencia(records = []) {
  const counts = { presente: 0, tardanza: 0, ausente: 0 }
  records.forEach(r => {
    const estado = r.status === 'presente' || r.status === 'tardanza' ? r.status : 'ausente'
    counts[estado] += 1
  })
  const tardanzasConvertidas = Math.floor(counts.tardanza / 3)
  const tardanzasRestantes   = counts.tardanza % 3
  const ausentesEfectivos    = counts.ausente + tardanzasConvertidas
  const contabiles           = records.length
  // Sin sesiones capturadas devolvía 100 %, y la tarjeta mostraba "100 % de
  // asistencia · 0 presentes". No hay dato, no hay porcentaje.
  const pct = contabiles > 0
    ? Math.round(((contabiles - ausentesEfectivos) / contabiles) * 100)
    : null
  return { records, counts, total: records.length, pct, tardanzasConvertidas, tardanzasRestantes }
}

/* Promedio ponderado oficial + desglose para mostrar al alumno/tutor */
export function promedioPonderado(student, { evals = [], attendance = [] } = {}, pesos = loadSettings().pesos) {
  const exProm = promedioExamenes(evals)
  const hayTareas = student.assignmentsTotal > 0
  const tareas10 = hayTareas
    ? +((student.assignmentsDone / student.assignmentsTotal) * 10).toFixed(2)
    : null

  const asis   = statsAsistencia(attendance)
  const asis10 = asis.pct === null ? null : +(asis.pct / 10).toFixed(2)

  /* Un componente sin datos se excluye y su peso se reparte entre los demás.
     Antes contaba como 0: a un alumno al que nadie le asignó tareas todavía
     se le hundía el promedio por algo que no depende de él. */
  const partes = [
    { valor: evals.length ? exProm : null, peso: pesos.examenes },
    { valor: tareas10,                     peso: pesos.tareas },
    { valor: asis10,                       peso: pesos.asistencia },
  ].filter(p => p.valor !== null)

  const totalPesos = partes.reduce((sum, p) => sum + p.peso, 0)
  const promedio = totalPesos > 0
    ? +(partes.reduce((sum, p) => sum + p.valor * p.peso, 0) / totalPesos).toFixed(1)
    : null

  return {
    promedio,
    pesos,
    // `parcial` avisa a la vista de que el promedio no incluye todo el criterio.
    parcial: partes.length < 3,
    desglose: {
      examenes:   { valor: evals.length ? exProm : null, peso: pesos.examenes },
      tareas:     { valor: tareas10, peso: pesos.tareas, done: student.assignmentsDone, total: student.assignmentsTotal },
      asistencia: { valor: asis10,   peso: pesos.asistencia, pct: asis.pct },
    },
  }
}

/**
 * Lugar en el grupo = orden por promedio ponderado.
 * `members` son los alumnos del grupo; `evalsByStudent` y `attendanceByStudent`
 * son mapas id → arreglo, tal como los devuelve fetchGroupMetrics().
 */
export function rankingGrupo(members = [], evalsByStudent = {}, attendanceByStudent = {}, pesos = loadSettings().pesos) {
  return members
    .map(x => ({
      id: x.id,
      name: x.name,
      promedio: promedioPonderado(
        x,
        { evals: evalsByStudent[x.id] ?? [], attendance: attendanceByStudent[x.id] ?? [] },
        pesos,
      ).promedio,
    }))
    // Sin promedio no hay nada que ordenar: restar null da NaN y el orden se
    // vuelve arbitrario. Quien todavía no tiene datos queda fuera del ranking.
    .filter(x => x.promedio !== null)
    .sort((a, b) => b.promedio - a.promedio)
}

/* Serie mensual por materia para la gráfica de evolución (conectada a evaluaciones) */
export function evolucionPorMateria(evs = []) {
  const materias = [...new Set(evs.map(e => e.materia))]
  const buckets = {}
  evs.forEach(e => {
    const mes = e.fecha.slice(0, 7)                    // '2025-09'
    if (!buckets[mes]) buckets[mes] = {}
    if (!buckets[mes][e.materia]) buckets[mes][e.materia] = []
    buckets[mes][e.materia].push(calificacionBase10(e))
  })
  const data = Object.keys(buckets).sort().map(mes => {
    const row = {
      mes: new Date(mes + '-15T12:00').toLocaleDateString('es-MX', { month: 'short' }).replace('.', ''),
    }
    materias.forEach(m => {
      const vals = buckets[mes][m]
      if (vals?.length) row[m] = +(vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(1)
    })
    return row
  })
  return { data, materias }
}

/* ═════════════════════════════════════════════════════════════════════════
   COLOR DE LOS DATOS DEL ALUMNO — una sola fuente para todas las pantallas.
   Antes cada pantalla tenía sus propios umbrales y hex: la misma calificación
   salía azul en el panel y roja en Calificaciones, y la misma materia cambiaba
   de color al pasar de una pantalla a otra.
   ═════════════════════════════════════════════════════════════════════════ */

/** Tono semántico de una calificación en escala 10 (≥8 bien, ≥6 regular). */
export const tonoCalificacion = g =>
  g === null || g === undefined || Number.isNaN(g) ? 'neutral'
    : g >= 8 ? 'good' : g >= 6 ? 'info' : 'bad'

/** Color (token CSS) de una calificación. */
export const colorCalificacion = g => {
  const tono = tonoCalificacion(g)
  return tono === 'neutral' ? 'var(--t4)' : `var(--${tono})`
}

/** Tono semántico de un % de asistencia. El 90 % es el mínimo de la garantía. */
export const tonoAsistencia = pct =>
  pct === null || pct === undefined || Number.isNaN(pct) ? 'neutral'
    : pct >= 90 ? 'good' : pct >= 75 ? 'warn' : 'bad'

/** Color (token CSS) de un % de asistencia. */
export const colorAsistencia = pct => {
  const tono = tonoAsistencia(pct)
  return tono === 'neutral' ? 'var(--t4)' : `var(--${tono})`
}

/* Paleta sólida institucional de materias (registro de #4d0b1d). `claro` es
   para IPN/UNAM; `oscuro` es el mismo matiz más luminoso, porque sobre el
   fondo casi negro los tonos profundos se funden con la página. Ambos llevan
   texto blanco encima con contraste suficiente. */
const PALETA_MATERIA = {
  claro:  ['#12345A', '#17502D', '#633515', '#48245F', '#064B60', '#78182B', '#075348', '#5E1948'],
  oscuro: ['#2C6BA8', '#2A7D49', '#9A5A26', '#7447A0', '#1F7F99', '#A8344A', '#1C8070', '#93306F'],
}

/** Color estable de una materia: depende sólo de su nombre (hash), no del
    orden en que llegan los datos, así que es el mismo en todas las pantallas. */
export function colorMateria(nombre = '', light = true) {
  const paleta = light ? PALETA_MATERIA.claro : PALETA_MATERIA.oscuro
  const clave = String(nombre ?? '').trim().toLowerCase()
  let h = 0
  for (let i = 0; i < clave.length; i++) h = (h * 31 + clave.charCodeAt(i)) >>> 0
  return paleta[h % paleta.length]
}
