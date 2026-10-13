// Configuración global de la plataforma.
// La fuente de verdad es la tabla `configuracion` (una sola fila; la lee
// cualquier usuario con sesión y solo la escribe un admin). Antes vivía en el
// localStorage de quien la guardaba, así que cada navegador calculaba el
// promedio con pesos distintos.
//
// `loadSettings()` sigue siendo síncrona —la usan cálculos puros como
// promedioPonderado—: lee una copia local que `syncSettings()` refresca desde
// la BD al iniciar sesión.
import { supabase } from './supabaseClient'

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
  // Fechas propias del calendario del alumno (los festivos oficiales se
  // calculan en lib/feriados.js): [{ fecha, titulo, tipo }]
  calendario: [],
  // Correo (Resend): remitente y tope diario. Capa gratis = 100/día; al pasar
  // a la de pago solo se sube el límite y se pone el remitente del dominio.
  correoRemitente: 'SIGA CEFIMAT <onboarding@resend.dev>',
  correoLimite: 100,
  // Asistente con IA: tope de gasto mensual en US$ (Claude Haiku).
  asistenteLimiteUsd: 2,
}

function normalizar(saved) {
  if (!saved) return { ...DEFAULT_SETTINGS }
  return {
    ...DEFAULT_SETTINGS,
    ...saved,
    pesos: { ...DEFAULT_SETTINGS.pesos, ...saved.pesos },
    notif: { ...DEFAULT_SETTINGS.notif, ...saved.notif },
    calendario: Array.isArray(saved.calendario) ? saved.calendario : [],
  }
}

/** Evento que avisa a las vistas montadas de que la configuración cambió. */
export const EVENTO_SETTINGS = 'siga:settings'

function guardarCopia(settings) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)) } catch { /* modo privado */ }
  // syncSettings() corre sin esperar al iniciar sesión: una vista que ya
  // calculó con la copia vieja debe enterarse y recalcular.
  try { window.dispatchEvent(new CustomEvent(EVENTO_SETTINGS, { detail: settings })) } catch { /* SSR */ }
}

/** Copia local de la configuración global (síncrona). */
export function loadSettings() {
  try {
    return normalizar(JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null'))
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

const desdeFila = fila => normalizar({
  platformName:  fila.platform_name,
  pesos:         fila.pesos,
  toleranciaMin: fila.tolerancia_min,
  notif:         fila.notif,
  calendario:    fila.calendario,
  correoRemitente: fila.correo_remitente,
  correoLimite:    fila.correo_limite_diario,
  asistenteLimiteUsd: fila.asistente_limite_usd == null ? 2 : Number(fila.asistente_limite_usd),
})

/** Trae la configuración global de la BD y refresca la copia local. */
export async function syncSettings() {
  const { data, error } = await supabase
    .from('configuracion')
    .select('platform_name, pesos, tolerancia_min, notif, calendario, correo_remitente, correo_limite_diario, asistente_limite_usd')
    .maybeSingle()
  if (error || !data) return loadSettings()
  const settings = desdeFila(data)
  guardarCopia(settings)
  return settings
}

/**
 * Guarda la configuración global (solo admin; RLS lo impone en la BD).
 * Devuelve { ok, message? }. La copia local solo se actualiza si la BD aceptó.
 */
export async function saveSettings(settings) {
  const s = normalizar(settings)
  const { data, error } = await supabase
    .from('configuracion')
    .update({
      platform_name:  s.platformName,
      pesos:          s.pesos,
      tolerancia_min: s.toleranciaMin,
      notif:          s.notif,
      calendario:     s.calendario,
      correo_remitente:     s.correoRemitente,
      correo_limite_diario: s.correoLimite,
      asistente_limite_usd: s.asistenteLimiteUsd,
      updated_at:     new Date().toISOString(),
    })
    .eq('id', true)
    .select('platform_name, pesos, tolerancia_min, notif, calendario, correo_remitente, correo_limite_diario, asistente_limite_usd')
  if (error) {
    const msg = error.message?.includes('pesos_suman_100')
      ? 'Los pesos deben sumar 100.'
      : 'No se pudo guardar la configuración.'
    return { ok: false, message: msg }
  }
  // Sin filas devueltas = RLS rechazó la escritura (no es admin).
  if (!data?.length) return { ok: false, message: 'Solo un administrador puede cambiar la configuración.' }
  guardarCopia(desdeFila(data[0]))
  return { ok: true }
}

/* Score compuesto 0-10 para el lugar en el grupo:
   exámenes (promedio) + tareas (entregadas/total) + asistencia (%) según pesos. */
export function calcularScore(student, pesos = DEFAULT_SETTINGS.pesos) {
  // avgGrade/attendanceRate son null mientras el alumno no tenga datos.
  const ex = student.avgGrade ?? 0
  const ta = student.assignmentsTotal > 0
    ? (student.assignmentsDone / student.assignmentsTotal) * 10
    : 0
  const as = (student.attendanceRate ?? 0) / 10
  const total = (pesos.examenes + pesos.tareas + pesos.asistencia) || 100
  return +(((ex * pesos.examenes) + (ta * pesos.tareas) + (as * pesos.asistencia)) / total).toFixed(2)
}
