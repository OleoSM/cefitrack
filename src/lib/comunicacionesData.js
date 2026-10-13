import { supabase } from './supabaseClient'

export async function fetchNotificaciones() {
  const { data, error } = await supabase.from('notifications').select('*')
    .order('created_at', { ascending: false }).limit(40)
  if (error) throw error
  return data ?? []
}

export async function marcarLeida(id) {
  const { error } = await supabase.from('notifications')
    .update({ read_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}

export async function marcarTodasLeidas(ids) {
  if (!ids?.length) return
  const { error } = await supabase.from('notifications')
    .update({ read_at: new Date().toISOString() }).in('id', ids)
  if (error) throw error
}

export async function guardarBorradorCorreo({ subject, body, studentIds, includeStudent, includeTutor }) {
  // `status: 'pending'` hasta que la Edge Function lo marque enviado o fallido.
  const { data, error } = await supabase.from('email_drafts').insert({
    subject, body, student_ids: studentIds,
    include_student: includeStudent, include_tutor: includeTutor,
    status: 'pending',
  }).select().single()
  if (error) throw error
  return data
}

/* ── Envío real por Resend (Edge Function `enviar-correo`) ── */
const MENSAJES_ENVIO = {
  falta_api_key: 'El envío por correo aún no está activado: falta guardar la API key de Resend en Supabase (secreto RESEND_API_KEY).',
  sin_sesion: 'Tu sesión caducó. Vuelve a entrar.',
  sin_permiso: 'No tienes permiso para enviar correos.',
  borrador_no_encontrado: 'No se encontró el mensaje a enviar.',
  ya_enviado: 'Este mensaje ya se había enviado.',
  no_se_leyeron_alumnos: 'No se pudieron leer los destinatarios.',
}

/** Envía por correo un borrador ya guardado. Devuelve { ok, enviados, fallidos, omitidos, cupo, message? }. */
export async function enviarCorreo(draftId) {
  const { data, error } = await supabase.functions.invoke('enviar-correo', { body: { draftId } })
  if (error) {
    let clave = ''
    try { clave = (await error.context?.json())?.error ?? '' } catch { /* sin cuerpo */ }
    return { ok: false, message: MENSAJES_ENVIO[clave] ?? 'No se pudo enviar el correo. Inténtalo de nuevo.' }
  }
  return data
}

/** { enviados, limite } del día (hora de México). */
export async function fetchCupoCorreos() {
  const { data, error } = await supabase.rpc('cupo_correos_hoy')
  if (error) throw error
  const fila = Array.isArray(data) ? data[0] : data
  return { enviados: fila?.enviados ?? 0, limite: fila?.limite ?? 100 }
}

/** Últimos envíos (la RLS decide: admin todos; sub-admin los suyos). */
export async function fetchEnviosRecientes(limite = 30) {
  const { data, error } = await supabase.from('email_envios')
    .select('id, destinatario, tipo, estado, motivo, created_at, student_id, email_drafts(subject)')
    .order('created_at', { ascending: false }).limit(limite)
  if (error) throw error
  return (data ?? []).map(e => ({
    id: e.id, destinatario: e.destinatario, tipo: e.tipo, estado: e.estado, motivo: e.motivo,
    fecha: e.created_at, studentId: e.student_id, asunto: e.email_drafts?.subject ?? '',
  }))
}

export async function crearNotificaciones({ students, title, body, eventType = 'manual' }) {
  const { data: { user } } = await supabase.auth.getUser()
  const rows = students.map(s => ({
    recipient_student_id: s.id, title, body, event_type: eventType, created_by: user.id,
  }))
  const { error } = await supabase.from('notifications').insert(rows)
  if (error) throw error
}

