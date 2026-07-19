import { supabase } from './supabaseClient'

export async function loginWithDb(email, password) {
  const { data, error } = await supabase.rpc('login_user', {
    p_email: email,
    p_password: password,
  })
  if (error) return { ok: false, message: 'No se pudo conectar con el servidor.' }
  const row = data?.[0]
  if (!row) return { ok: false, message: 'Correo o contraseña incorrectos.' }
  return {
    ok: true,
    user: { id: row.id, name: row.name, email: row.email, role: row.role, studentId: row.student_id },
  }
}

export async function fetchGroups() {
  const { data, error } = await supabase.from('groups').select('*').order('name')
  if (error) throw error
  return data.map(g => ({
    id: g.id,
    name: g.name,
    subject: g.subject,
    schedule: g.schedule,
    room: g.room,
    color: g.color,
    sucursal: g.sucursal,
  }))
}

export async function fetchStudents() {
  const { data, error } = await supabase.from('students').select('*').order('name')
  if (error) throw error
  return data.map(s => ({
    id: s.id,
    name: s.name,
    email: s.email,
    groupId: s.group_id,
    tutor: { name: s.tutor_name, email: s.tutor_email, phone: s.tutor_phone },
    attendanceRate: Number(s.attendance_rate),
    avgGrade: Number(s.avg_grade),
    assignmentsDone: s.assignments_done,
    assignmentsTotal: s.assignments_total,
    rank: s.rank,
    status: s.status,
    termsStatus: s.terms_status,
    signedAt: s.signed_at,
    waAdded: s.wa_added,
    sucursal: s.sucursal,
  }))
}

export async function fetchStudentById(id) {
  if (!id) return null
  const { data, error } = await supabase.from('students').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  if (!data) return null
  return {
    id: data.id,
    name: data.name,
    email: data.email,
    groupId: data.group_id,
    tutor: { name: data.tutor_name, email: data.tutor_email, phone: data.tutor_phone },
    attendanceRate: Number(data.attendance_rate),
    avgGrade: Number(data.avg_grade),
    assignmentsDone: data.assignments_done,
    assignmentsTotal: data.assignments_total,
    rank: data.rank,
    status: data.status,
    termsStatus: data.terms_status,
    signedAt: data.signed_at,
    waAdded: data.wa_added,
    sucursal: data.sucursal,
  }
}

export async function fetchGroupById(id) {
  if (!id) return null
  const { data, error } = await supabase.from('groups').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data
    ? { id: data.id, name: data.name, subject: data.subject, schedule: data.schedule, room: data.room, color: data.color, sucursal: data.sucursal }
    : null
}

export async function signTerms(studentId) {
  const { data, error } = await supabase.rpc('sign_terms', { p_student_id: studentId })
  if (error) throw error
  const row = data?.[0]
  return row ? { termsStatus: row.terms_status, signedAt: row.signed_at } : null
}

/** Registro de asistencia del alumno escaneando el QR de sesión del docente. */
export async function registerAttendance(token, studentId) {
  const { data, error } = await supabase.rpc('register_attendance', {
    p_token: token,
    p_student_id: studentId,
  })
  if (error) {
    const msg = error.message ?? ''
    if (msg.includes('invalid_or_expired_token'))
      return { ok: false, code: 'expired', message: 'El código QR ya no es válido. Pídele al docente el código actualizado.' }
    if (msg.includes('student_not_in_group'))
      return { ok: false, code: 'wrong_group', message: 'Este QR pertenece a otro grupo. Verifica con tu docente.' }
    return { ok: false, code: 'error', message: 'No se pudo registrar la asistencia. Intenta de nuevo.' }
  }
  const row = data?.[0]
  return { ok: true, status: row?.status ?? 'presente', scannedAt: row?.scanned_at }
}

/**
 * Historial de asistencia del alumno: una entrada por sesión de su grupo
 * (ausente si la sesión existe y no tiene registro).
 */
export async function fetchStudentAttendance(studentId, groupId) {
  if (!studentId || !groupId) return []
  const { data, error } = await supabase
    .from('attendance_sessions')
    .select('session_date, attendance_records(student_id, status, arrival_label)')
    .eq('group_id', groupId)
    .order('session_date', { ascending: true })
  if (error) throw error
  return data.map(s => {
    const rec = (s.attendance_records ?? []).find(r => r.student_id === studentId)
    return { date: s.session_date, status: rec ? rec.status : 'ausente', time: rec?.arrival_label ?? null, studentId }
  })
}

export async function fetchSubAdmins() {
  const { data, error } = await supabase.rpc('list_sub_admins')
  if (error) throw error
  return data
}

export async function createSubAdmin({ name, email, password }) {
  const { data, error } = await supabase.rpc('create_user_with_password', {
    p_name: name,
    p_email: email,
    p_password: password,
    p_role: 'sub_admin',
  })
  if (error) return { ok: false, message: 'No se pudo crear el sub-admin (¿correo ya registrado?).' }
  const row = data?.[0]
  if (!row) return { ok: false, message: 'No se pudo crear el sub-admin.' }
  return { ok: true, user: { id: row.id, name: row.name, email: row.email, role: row.role } }
}

export async function fetchSubAdminAccess(userId) {
  const { data, error } = await supabase.from('sub_admin_access').select('*').eq('user_id', userId)
  if (error) throw error
  return data.map(a => ({ id: a.id, sucursal: a.sucursal, groupId: a.group_id }))
}

export async function grantSubAdminAccess(userId, sucursal, groupId = null) {
  const { error } = await supabase.rpc('grant_sub_admin_access', {
    p_user_id: userId,
    p_sucursal: sucursal,
    p_group_id: groupId,
  })
  if (error) throw error
}

export async function revokeSubAdminAccess(id) {
  const { error } = await supabase.rpc('revoke_sub_admin_access', { p_id: id })
  if (error) throw error
}
