// Configuración global de la plataforma (persistida en localStorage)
// v2: la ponderación oficial del promedio cambió a 70/20/10
const SETTINGS_KEY = 'edutrack_settings_v2'

export const DEFAULT_SETTINGS = {
  platformName: 'SIGA CEFIMAT',
  // Ponderación del promedio y lugar en el grupo (deben sumar 100)
  pesos: { examenes: 70, tareas: 20, asistencia: 10 },
  // Minutos de tolerancia por defecto al pasar lista
  toleranciaMin: 15,
  // Notificaciones por correo (envío simulado hasta conectar backend)
  notif: { nuevoExamen: true, resultadoPublicado: true, ausencia: true },
}

export function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null')
    if (!saved) return { ...DEFAULT_SETTINGS }
    return {
      ...DEFAULT_SETTINGS,
      ...saved,
      pesos: { ...DEFAULT_SETTINGS.pesos, ...saved.pesos },
      notif: { ...DEFAULT_SETTINGS.notif, ...saved.notif },
    }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}

/* Score compuesto 0-10 para el lugar en el grupo:
   exámenes (promedio) + tareas (entregadas/total) + asistencia (%) según pesos. */
export function calcularScore(student, pesos = DEFAULT_SETTINGS.pesos) {
  const ex = student.avgGrade
  const ta = student.assignmentsTotal > 0
    ? (student.assignmentsDone / student.assignmentsTotal) * 10
    : 0
  const as = student.attendanceRate / 10
  const total = (pesos.examenes + pesos.tareas + pesos.asistencia) || 100
  return +(((ex * pesos.examenes) + (ta * pesos.tareas) + (as * pesos.asistencia)) / total).toFixed(2)
}
