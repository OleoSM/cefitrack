// Definición ÚNICA de "alumno en riesgo" (regla del centro, 2026-11-20):
// un alumno está en riesgo si acumula faltas, no entrega tareas o sale mal en
// los exámenes. Basta con una de las tres. Toda pantalla que hable de riesgo
// (Tablero, Grupos, Detalle de grupo, Rankings) usa esta función.
//
// Sin dato no hay riesgo: a nadie se le marca por información que aún no
// existe (alumno recién inscrito, grupo sin listas, tareas sin asignar).

import { promedioExamenes, statsAsistencia } from './studentMetrics'

export const UMBRALES_RIESGO = {
  asistencia: 80,   // % de asistencia efectiva (3 retardos = 1 falta)
  examenes:   7,    // promedio de exámenes, base 10
  tareas:     70,   // % de tareas entregadas
}

/** Texto corto de la regla, para subtítulos y ayudas. */
export const REGLA_RIESGO_TEXTO =
  `Asistencia menor a ${UMBRALES_RIESGO.asistencia} %, promedio de exámenes menor a ${UMBRALES_RIESGO.examenes} o menos del ${UMBRALES_RIESGO.tareas} % de tareas entregadas`

/**
 * @returns {{ enRiesgo: boolean, puntos: number, motivos: string[] }}
 *   `puntos` mide qué tan lejos está de los umbrales (para ordenar).
 */
export function evaluarRiesgo({ asist = null, examenes = null, tareasHechas = null, tareasTotal = null } = {}) {
  const U = UMBRALES_RIESGO
  const motivos = []
  let puntos = 0
  if (Number.isFinite(asist) && asist < U.asistencia) {
    motivos.push(`Asistencia ${asist} %`)
    puntos += U.asistencia - asist
  }
  if (Number.isFinite(examenes) && examenes < U.examenes) {
    motivos.push(`Exámenes ${(+examenes).toFixed(1)}`)
    puntos += (U.examenes - examenes) * 10
  }
  if (tareasTotal > 0 && Number.isFinite(tareasHechas)) {
    const pct = Math.round((tareasHechas / tareasTotal) * 100)
    if (pct < U.tareas) {
      motivos.push(`Tareas ${tareasHechas}/${tareasTotal}`)
      puntos += U.tareas - pct
    }
  }
  return { enRiesgo: motivos.length > 0, puntos, motivos }
}

/** Riesgo a partir de las métricas de grupo (evaluaciones y asistencia del alumno). */
export function riesgoDeAlumno(alumno, { evals = [], attendance = [] } = {}) {
  return evaluarRiesgo({
    asist: statsAsistencia(attendance).pct,
    examenes: evals.length ? promedioExamenes(evals) : null,
    tareasHechas: alumno?.assignmentsDone ?? null,
    tareasTotal: alumno?.assignmentsTotal ?? null,
  })
}

/** Promedio de exámenes por alumno a partir de una lista plana de evaluaciones. */
export function examenesPorAlumno(evaluations = []) {
  const por = {}
  for (const e of evaluations) (por[e.studentId] ??= []).push(e)
  return Object.fromEntries(Object.entries(por).map(([id, evs]) => [id, promedioExamenes(evs)]))
}
