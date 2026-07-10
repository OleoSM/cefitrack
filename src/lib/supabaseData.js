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
  }))
}
