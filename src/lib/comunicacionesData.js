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

export async function guardarBorradorCorreo({ subject, body, studentIds, includeStudent, includeTutor }) {
  const { data, error } = await supabase.from('email_drafts').insert({
    subject, body, student_ids: studentIds,
    include_student: includeStudent, include_tutor: includeTutor,
    status: 'pending',
  }).select().single()
  if (error) throw error
  return data
}

export async function crearNotificaciones({ students, title, body, eventType = 'manual' }) {
  const { data: { user } } = await supabase.auth.getUser()
  const rows = students.map(s => ({
    recipient_student_id: s.id, title, body, event_type: eventType, created_by: user.id,
  }))
  const { error } = await supabase.from('notifications').insert(rows)
  if (error) throw error
}

