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
