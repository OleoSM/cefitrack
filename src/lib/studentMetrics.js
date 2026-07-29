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

/* Asistencia real del alumno (3 retardos = 1 inasistencia; justificados no cuentan). */
export function statsAsistencia(records = []) {
  const counts = { presente: 0, tardanza: 0, ausente: 0, justificado: 0 }
  records.forEach(r => { counts[r.status] = (counts[r.status] || 0) + 1 })
  const tardanzasConvertidas = Math.floor(counts.tardanza / 3)
  const tardanzasRestantes   = counts.tardanza % 3
  const ausentesEfectivos    = counts.ausente + tardanzasConvertidas
  const contabiles           = records.length - counts.justificado
  const pct = contabiles > 0
    ? Math.round(((contabiles - ausentesEfectivos) / contabiles) * 100)
    : 100
  return { records, counts, total: records.length, pct, tardanzasConvertidas, tardanzasRestantes }
}

/* Promedio ponderado oficial + desglose para mostrar al alumno/tutor */
export function promedioPonderado(student, { evals = [], attendance = [] } = {}, pesos = loadSettings().pesos) {
  const exProm   = promedioExamenes(evals)
  const tareas10 = student.assignmentsTotal > 0
    ? +((student.assignmentsDone / student.assignmentsTotal) * 10).toFixed(2)
    : 0
  const asis   = statsAsistencia(attendance)
  const asis10 = +(asis.pct / 10).toFixed(2)
  const totalPesos = (pesos.examenes + pesos.tareas + pesos.asistencia) || 100
  const promedio = +(((exProm * pesos.examenes) + (tareas10 * pesos.tareas) + (asis10 * pesos.asistencia)) / totalPesos).toFixed(1)
  return {
    promedio,
    pesos,
    desglose: {
      examenes:   { valor: exProm,   peso: pesos.examenes },
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
