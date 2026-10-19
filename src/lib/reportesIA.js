/*
 * Reportes con IA de un alumno o de un grupo (Edge Function `asistente`,
 * modo reporte). Cada reporte generado queda guardado en `reportes_ia`: se
 * muestra el último y se puede volver a los anteriores sin pagar de nuevo.
 * Solo admins y sub-admins con el apartado "ia".
 */
import { supabase } from './supabaseClient'

const MENSAJES = {
  falta_api_key: 'El asistente aún no está activado: falta guardar la API key de Anthropic en Supabase (secreto ANTHROPIC_API_KEY).',
  limite_alcanzado: 'Se alcanzó el tope de gasto de IA de este mes. Un admin puede subirlo en Configuración.',
  sin_permiso: 'No tienes acceso al asistente de IA. Solicítalo a un administrador.',
  sin_sesion: 'Tu sesión caducó. Vuelve a entrar.',
  api_key_invalida: 'La API key de Anthropic no es válida. Revisa el secreto ANTHROPIC_API_KEY en Supabase.',
  sin_saldo: 'La cuenta de Anthropic se quedó sin saldo. Recárgala en console.anthropic.com.',
  no_encontrado: 'No se encontraron datos de este alumno o grupo (o no está en tus grupos).',
  error_modelo: 'El servicio de IA no respondió. Inténtalo en un momento.',
  no_se_guardo: 'El reporte se generó pero no se pudo guardar. Inténtalo de nuevo.',
}

/** Genera un reporte nuevo. Devuelve { ok, reporte?, gasto?, message? }. */
export async function generarReporte(tipo, id) {
  const { data, error } = await supabase.functions.invoke('asistente', { body: { accion: 'reporte', tipo, id } })
  if (error) {
    let cuerpo = {}
    try { cuerpo = await error.context?.json() } catch { /* sin cuerpo */ }
    return { ok: false, message: MENSAJES[cuerpo?.error] ?? 'No se pudo generar el reporte.' }
  }
  return data
}

/** Reportes guardados (más reciente primero). */
export async function fetchReportes(tipo, id, limite = 10) {
  let q = supabase.from('reportes_ia').select('id, tipo, contenido, metricas, modelo, costo_usd, created_at, creado_por')
    .eq('tipo', tipo).order('created_at', { ascending: false }).limit(limite)
  q = tipo === 'alumno' ? q.eq('student_id', id) : q.eq('group_id', id)
  const { data, error } = await q
  if (error) throw error
  return data ?? []
}

export const NIVELES = {
  sobresaliente: { label: 'Sobresaliente', color: 'var(--good)', fondo: 'var(--good-soft)' },
  bueno:         { label: 'Bueno',         color: 'var(--info)', fondo: 'var(--info-soft)' },
  en_desarrollo: { label: 'En desarrollo', color: 'var(--warn)', fondo: 'var(--warn-soft)' },
  en_riesgo:     { label: 'En riesgo',     color: 'var(--bad)',  fondo: 'var(--bad-soft)' },
}
