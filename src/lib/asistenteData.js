import { supabase } from './supabaseClient'

const MENSAJES = {
  falta_api_key: 'El asistente aún no está activado: falta guardar la API key de Anthropic en Supabase (secreto ANTHROPIC_API_KEY).',
  limite_alcanzado: 'Se alcanzó el tope de gasto del asistente de este mes. Vuelve a estar disponible el día 1, o un admin puede subir el tope en Configuración.',
  solo_admin: 'El asistente es solo para administradores.',
  sin_permiso: 'No tienes acceso al asistente de IA. Solicítalo a un administrador.',
  sin_sesion: 'Tu sesión caducó. Vuelve a entrar.',
  api_key_invalida: 'La API key de Anthropic no es válida. Revisa el secreto ANTHROPIC_API_KEY en Supabase.',
  sin_saldo: 'La cuenta de Anthropic se quedó sin saldo. Recárgala en console.anthropic.com.',
  error_modelo: 'El servicio de IA no respondió. Inténtalo en un momento.',
  sin_pregunta: 'Escribe una pregunta.',
}

/** mensajes: [{ role:'user'|'assistant', content }]. Devuelve { ok, respuesta?, gasto?, message? }. */
export async function preguntarAsistente(mensajes) {
  const { data, error } = await supabase.functions.invoke('asistente', { body: { mensajes } })
  if (error) {
    let cuerpo = {}
    try { cuerpo = await error.context?.json() } catch { /* sin cuerpo */ }
    return { ok: false, message: MENSAJES[cuerpo?.error] ?? 'No se pudo consultar al asistente.', gasto: cuerpo?.gasto }
  }
  return data
}

/** { usado, limite, consultas } del mes (US$). */
export async function fetchGastoAsistente() {
  const { data, error } = await supabase.rpc('gasto_asistente_mes')
  if (error) throw error
  const f = Array.isArray(data) ? data[0] : data
  return { usado: Number(f?.usado ?? 0), limite: Number(f?.limite ?? 2), consultas: f?.consultas ?? 0 }
}
