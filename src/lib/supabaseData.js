import { supabase } from './supabaseClient'

/**
 * Inicio de sesión con Supabase Auth.
 *
 * Sustituye a la RPC `login_user`, que devolvía el usuario pero no dejaba
 * rastro: la base no sabía quién estaba llamando y toda política de acceso era
 * decorativa. Ahora la sesión la emite Supabase con un JWT firmado, `auth.uid()`
 * identifica al llamador y el rol viaja dentro del token, de modo que las
 * políticas RLS pueden leerlo sin consultar tablas —evitando la recursión— y
 * sin que el cliente pueda falsificarlo.
 *
 * Las contraseñas son las mismas: los hashes bcrypt se copiaron tal cual.
 */
export async function loginConAuth(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  })
  if (error) {
    const msg = (error.message ?? '').toLowerCase()
    if (msg.includes('invalid login')) {
      return { ok: false, message: 'Correo o contraseña incorrectos.' }
    }
    return { ok: false, message: 'No se pudo conectar con el servidor.' }
  }

  const { data: perfil, error: e2 } = await supabase
    .from('profiles').select('*').eq('id', data.user.id).maybeSingle()

  if (e2 || !perfil) {
    await supabase.auth.signOut()
    return { ok: false, message: 'Tu cuenta no tiene un perfil asociado. Avisa a coordinación.' }
  }
  if (perfil.activo === false) {
    await supabase.auth.signOut()
    return { ok: false, message: 'Esta cuenta está desactivada.' }
  }

  return {
    ok: true,
    user: {
      id: perfil.id, name: perfil.name, email: perfil.email,
      role: perfil.role, studentId: perfil.student_id,
    },
  }
}

/** Sesión vigente según Supabase, para restaurarla al recargar. */
export async function sesionActual() {
  const { data } = await supabase.auth.getSession()
  if (!data?.session) return null
  const { data: perfil } = await supabase
    .from('profiles').select('*').eq('id', data.session.user.id).maybeSingle()
  if (!perfil || perfil.activo === false) return null
  return {
    id: perfil.id, name: perfil.name, email: perfil.email,
    role: perfil.role, studentId: perfil.student_id,
  }
}

export async function cerrarSesion() {
  await supabase.auth.signOut()
}

/* Login anterior, contra la tabla `users`. Se conserva mientras el interruptor
   de AuthContext permita volver atrás; se retira cuando la migración se dé por
   asentada. */
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
    institucion: g.institucion,
  }))
}

// null se conserva como null (alumno sin datos aún) en vez de convertirse en 0,
// que se leería como "0% de asistencia" o "promedio 0".
const num = v => (v === null || v === undefined ? null : Number(v))

export async function fetchStudents() {
  // Se trae también la ruta del avatar: el panel muestra la imagen que el
  // alumno eligió, y resolverla en el cliente obligaría a mantener una copia
  // del catálogo allí.
  const { data, error } = await supabase.from('students')
    .select('*, avatar_catalogo(src)').order('name')
  if (error) throw error
  return data.map(s => ({
    id: s.id,
    name: s.name,
    email: s.email,
    groupId: s.group_id,
    tutor: { name: s.tutor_name, email: s.tutor_email, phone: s.tutor_phone },
    attendanceRate: num(s.attendance_rate),
    avgGrade: num(s.avg_grade),
    assignmentsDone: s.assignments_done,
    assignmentsTotal: s.assignments_total,
    rank: s.rank,
    status: s.status,
    termsStatus: s.terms_status,
    signedAt: s.signed_at,
    waAdded: s.wa_added,
    sucursal: s.sucursal,
    pagoEstado: s.pago_estado,
    garantia: s.garantia,
    firmaGarantia: s.firma_garantia,
    examenGeneral: s.examen_general,
    avatar: s.avatar,
    avatarSrc: s.avatar_catalogo?.src ?? null,
  }))
}

export async function fetchStudentById(id) {
  if (!id) return null
  const { data, error } = await supabase.from('students')
    .select('*, avatar_catalogo(src)').eq('id', id).maybeSingle()
  if (error) throw error
  if (!data) return null
  return {
    id: data.id,
    name: data.name,
    email: data.email,
    groupId: data.group_id,
    tutor: { name: data.tutor_name, email: data.tutor_email, phone: data.tutor_phone },
    attendanceRate: num(data.attendance_rate),
    avgGrade: num(data.avg_grade),
    assignmentsDone: data.assignments_done,
    assignmentsTotal: data.assignments_total,
    rank: data.rank,
    status: data.status,
    termsStatus: data.terms_status,
    signedAt: data.signed_at,
    waAdded: data.wa_added,
    sucursal: data.sucursal,
    pagoEstado: data.pago_estado,
    garantia: data.garantia,
    firmaGarantia: data.firma_garantia,
    examenGeneral: data.examen_general,
    avatar: data.avatar,
    avatarSrc: data.avatar_catalogo?.src ?? null,
  }
}

export async function fetchGroupById(id) {
  if (!id) return null
  const { data, error } = await supabase.from('groups').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data
    ? { id: data.id, name: data.name, subject: data.subject, schedule: data.schedule, room: data.room, color: data.color, sucursal: data.sucursal, institucion: data.institucion }
    : null
}

export async function signTerms(studentId) {
  const { data, error } = await supabase.rpc('sign_terms', { p_student_id: studentId })
  if (error) throw error
  const row = data?.[0]
  return row ? { termsStatus: row.terms_status, signedAt: row.signed_at } : null
}

/** Revierte la firma de términos de un alumno (Gestión de T&C). */
export async function resetTerms(studentId) {
  const { data, error } = await supabase.rpc('reset_terms', { p_student_id: studentId })
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
 * Una sesión sin ningún registro es una lista que se abrió y nunca se guardó,
 * no una clase a la que faltó el grupo entero. Contarla produciría ausencias
 * inventadas, así que se descarta antes de cualquier cálculo.
 */
const sesionCapturada = s => (s.attendance_records ?? []).length > 0

/**
 * Historial de asistencia del alumno: una entrada por sesión capturada de su
 * grupo (ausente si el docente pasó lista y no lo marcó).
 */
export async function fetchStudentAttendance(studentId, groupId) {
  if (!studentId || !groupId) return []
  const { data, error } = await supabase
    .from('attendance_sessions')
    .select('session_date, attendance_records(student_id, status, arrival_label)')
    .eq('group_id', groupId)
    .order('session_date', { ascending: true })
  if (error) throw error
  return data.filter(sesionCapturada).map(s => {
    const rec = s.attendance_records.find(r => r.student_id === studentId)
    return { date: s.session_date, status: rec ? rec.status : 'ausente', time: rec?.arrival_label ?? null, studentId }
  })
}

/**
 * Tasa de asistencia real calculada desde las sesiones y registros de la BD.
 * Devuelve { byStudent, byGroup } con porcentajes 0–100, o null cuando el
 * grupo todavía no tiene sesiones (para no mostrar un 0% engañoso).
 */
export async function fetchAttendanceStats(students) {
  const { data, error } = await supabase
    .from('attendance_sessions')
    .select('group_id, attendance_records(student_id, status)')
  if (error) throw error

  const sessionsByGroup = {}
  const attendedByStudent = {}
  for (const s of data.filter(sesionCapturada)) {
    sessionsByGroup[s.group_id] = (sessionsByGroup[s.group_id] ?? 0) + 1
    for (const r of s.attendance_records) {
      if (r.status === 'presente' || r.status === 'tardanza')
        attendedByStudent[r.student_id] = (attendedByStudent[r.student_id] ?? 0) + 1
    }
  }

  const byStudent = {}
  for (const st of students) {
    const total = sessionsByGroup[st.groupId] ?? 0
    byStudent[st.id] = total === 0 ? null : Math.round(((attendedByStudent[st.id] ?? 0) / total) * 100)
  }

  const byGroup = {}
  for (const gid of new Set(students.map(s => s.groupId))) {
    const rates = students.filter(s => s.groupId === gid).map(s => byStudent[s.id]).filter(r => r !== null)
    byGroup[gid] = rates.length === 0 ? null : Math.round(rates.reduce((a, b) => a + b, 0) / rates.length)
  }

  return { byStudent, byGroup }
}

/**
 * Datos de todo un grupo para calcular el ranking: alumnos, sus evaluaciones y
 * su historial de asistencia (una entrada por sesión, ausente si no hay registro).
 */
export async function fetchGroupMetrics(groupId) {
  if (!groupId) return { members: [], evalsByStudent: {}, attendanceByStudent: {} }

  const [{ data: sts, error: e1 }, { data: sessions, error: e2 }] = await Promise.all([
    supabase.from('students').select('*').eq('group_id', groupId),
    supabase.from('attendance_sessions')
      .select('session_date, attendance_records(student_id, status, arrival_label)')
      .eq('group_id', groupId)
      .order('session_date', { ascending: true }),
  ])
  if (e1) throw e1
  if (e2) throw e2

  const ids = sts.map(s => s.id)
  const { data: evs, error: e3 } = await supabase
    .from('evaluations').select('*').in('student_id', ids.length ? ids : ['__none__'])
  if (e3) throw e3

  const evalsByStudent = {}
  for (const e of evs) (evalsByStudent[e.student_id] ??= []).push(mapEvaluation(e))

  const sesiones = sessions.filter(sesionCapturada)
  const attendanceByStudent = {}
  for (const id of ids) {
    attendanceByStudent[id] = sesiones.map(s => {
      const rec = s.attendance_records.find(r => r.student_id === id)
      return { date: s.session_date, status: rec ? rec.status : 'ausente', time: rec?.arrival_label ?? null, studentId: id }
    })
  }

  const members = sts.map(s => ({
    id: s.id,
    name: s.name,
    groupId: s.group_id,
    assignmentsDone: s.assignments_done,
    assignmentsTotal: s.assignments_total,
  }))

  return { members, evalsByStudent, attendanceByStudent }
}

/**
 * Conteo de asistencia de las sesiones de hoy, por estatus.
 * `esperados` son los alumnos de los grupos con sesión hoy: quien no tiene
 * registro cuenta como ausente.
 */
export async function fetchAsistenciaHoy(students) {
  const hoy = new Date().toISOString().slice(0, 10)
  const { data, error } = await supabase
    .from('attendance_sessions')
    .select('group_id, session_date, attendance_records(student_id, status)')
    .eq('session_date', hoy)
  if (error) throw error

  const counts = { presente: 0, tardanza: 0, ausente: 0 }
  // Sólo cuentan las listas ya capturadas: una abierta sin guardar marcaría
  // ausente a todo el grupo en el tablero del día.
  const sesiones = data.filter(sesionCapturada)
  const gruposConSesion = new Set(sesiones.map(s => s.group_id))
  const registrados = new Set()

  for (const s of sesiones) {
    for (const r of s.attendance_records) {
      if (counts[r.status] !== undefined) counts[r.status] += 1
      registrados.add(r.student_id)
    }
  }
  const esperados = students.filter(s => gruposConSesion.has(s.groupId))
  counts.ausente += esperados.filter(s => !registrados.has(s.id)).length

  return { counts, esperados: esperados.length, haySesion: gruposConSesion.size > 0 }
}

/** Métricas derivadas por grupo: alumnos, promedio y asistencia reales. */
export function computeGroupStats(group, students, attendanceByGroup = {}) {
  const members = students.filter(s => s.groupId === group.id)
  const grades = members.map(s => s.avgGrade).filter(g => Number.isFinite(g))
  return {
    studentCount: members.length,
    avgGrade: grades.length ? +(grades.reduce((a, b) => a + b, 0) / grades.length).toFixed(1) : null,
    attendanceRate: attendanceByGroup[group.id] ?? null,
  }
}

/* ── Calificaciones ── */

const mapEvaluation = e => ({
  id: e.id,
  studentId: e.student_id,
  materia: e.materia,
  tipo: e.tipo,
  calificacion: Number(e.calificacion),
  calMax: Number(e.cal_max),
  fecha: e.fecha,
  periodo: e.periodo,
})

export async function fetchEvaluations() {
  const { data, error } = await supabase.from('evaluations').select('*').order('fecha', { ascending: false })
  if (error) throw error
  return data.map(mapEvaluation)
}

export async function fetchEvaluationsByStudent(studentId) {
  if (!studentId) return []
  const { data, error } = await supabase
    .from('evaluations')
    .select('*')
    .eq('student_id', studentId)
    .order('fecha', { ascending: false })
  if (error) throw error
  return data.map(mapEvaluation)
}

/** id null → alta; id presente → edición. */
export async function saveEvaluation({ id = null, studentId, materia, tipo, calificacion, calMax = 10, fecha, periodo = null }) {
  const { data, error } = await supabase.rpc('upsert_evaluation', {
    p_id: id,
    p_student_id: studentId,
    p_materia: materia,
    p_tipo: tipo,
    p_calificacion: calificacion,
    p_cal_max: calMax,
    p_fecha: fecha ?? new Date().toISOString().slice(0, 10),
    p_periodo: periodo,
  })
  if (error) {
    if ((error.message ?? '').includes('calificacion_no_excede_max'))
      return { ok: false, message: 'La calificación no puede ser mayor que el máximo.' }
    return { ok: false, message: 'No se pudo guardar la calificación.' }
  }
  const row = data?.[0]
  return { ok: true, evaluation: row ? mapEvaluation(row) : null }
}

/** Captura masiva: guarda toda la lista de un grupo en una sola llamada. */
export async function saveEvaluationsBulk(rows) {
  const { data, error } = await supabase.rpc('upsert_evaluations_bulk', { p_rows: rows })
  if (error) return { ok: false, message: 'No se pudieron guardar las calificaciones.' }
  return { ok: true, count: data ?? 0 }
}

export async function deleteEvaluation(id) {
  const { error } = await supabase.rpc('delete_evaluation', { p_id: id })
  if (error) throw error
}

/* ── Grupos (escritura) ── */

export async function createGroup({ name, subject, schedule = null, room = null, color = '#3b82f6', sucursal = null, institucion = null }) {
  const { data, error } = await supabase.rpc('create_group', {
    p_name: name,
    p_subject: subject,
    p_schedule: schedule,
    p_room: room,
    p_color: color,
    p_sucursal: sucursal,
    p_institucion: institucion,
  })
  if (error) return { ok: false, message: 'No se pudo crear el grupo.' }
  const row = data?.[0]
  return { ok: true, group: row ? { ...row, id: row.id } : null }
}

export async function updateGroup({ id, name, subject, schedule = null, room = null, color = null, sucursal = null, institucion = null }) {
  const { error } = await supabase.rpc('update_group', {
    p_id: id,
    p_name: name,
    p_subject: subject,
    p_schedule: schedule,
    p_room: room,
    p_color: color,
    p_sucursal: sucursal,
    p_institucion: institucion,
  })
  if (error) return { ok: false, message: 'No se pudo actualizar el grupo.' }
  return { ok: true }
}

export async function deleteGroup(id) {
  const { error } = await supabase.rpc('delete_group', { p_id: id })
  if (error) {
    if ((error.message ?? '').includes('group_has_students'))
      return { ok: false, message: 'El grupo tiene alumnos asignados. Muévelos o elimínalos primero.' }
    return { ok: false, message: 'No se pudo eliminar el grupo.' }
  }
  return { ok: true }
}

/* ── Alumnos (escritura) ── */

/** Crea el alumno y su cuenta de acceso. La contraseña se genera en el cliente. */
export async function createStudent({ name, email, groupId, password, tutor = {}, sucursal = null }) {
  const { data, error } = await supabase.rpc('create_student', {
    p_name: name,
    p_email: email,
    p_group_id: groupId,
    p_password: password,
    p_tutor_name: tutor.name ?? null,
    p_tutor_email: tutor.email ?? null,
    p_tutor_phone: tutor.phone ?? null,
    p_sucursal: sucursal,
  })
  if (error) {
    const msg = error.message ?? ''
    if (msg.includes('email_already_exists'))
      return { ok: false, message: `El correo ${email} ya está registrado.` }
    if (msg.includes('group_not_found'))
      return { ok: false, message: 'El grupo seleccionado no existe.' }
    return { ok: false, message: 'No se pudo crear el alumno.' }
  }
  const row = data?.[0]
  return { ok: true, student: row ? { id: row.id, name: row.name, email: row.email, groupId: row.group_id } : null }
}

export async function updateStudent({ id, name, email, groupId, tutor = {}, sucursal = null }) {
  const { error } = await supabase.rpc('update_student', {
    p_id: id,
    p_name: name,
    p_email: email,
    p_group_id: groupId,
    p_tutor_name: tutor.name ?? null,
    p_tutor_email: tutor.email ?? null,
    p_tutor_phone: tutor.phone ?? null,
    p_sucursal: sucursal,
  })
  if (error) return { ok: false, message: 'No se pudo actualizar el alumno.' }
  return { ok: true }
}

export async function deleteStudent(id) {
  const { error } = await supabase.rpc('delete_student', { p_id: id })
  if (error) throw error
}

/**
 * Restablece la contraseña de un alumno y devuelve el correo con el que entra.
 *
 * El correo lo dicta la base, no el cliente: al unificar el dominio a @siga.mx
 * el usuario de acceso cambió, y mostrar el que la pantalla tenía cargado en
 * memoria era justo lo que hacía que las credenciales entregadas no sirvieran.
 */
export async function resetStudentPassword(studentId, password) {
  const { data, error } = await supabase.rpc('reset_student_password', {
    p_student_id: studentId,
    p_password: password,
  })
  if (error) return { ok: false, message: 'No se pudo restablecer la contraseña.' }
  return { ok: true, email: data?.[0]?.email ?? null }
}

/**
 * Personal con acceso al panel: administradores y sub-administradores.
 * Antes se llamaba a `list_sub_admins`, que filtraba role='sub_admin' — los
 * administradores no aparecían nunca y la lista se veía incompleta sin avisar.
 */
export async function fetchStaff() {
  const { data, error } = await supabase.rpc('list_staff')
  if (error) throw error
  return data
}

/**
 * Todas las cuentas con acceso: personal y alumnos.
 * El personal sale de `profiles` —donde vive su identidad y a donde apunta la
 * tabla de permisos— y los alumnos de `students`, que es el padrón real y el
 * único sitio donde consta su grupo.
 *
 * Se llama a `list_cuentas_estado` y no a `list_cuentas` porque esta última
 * esconde a quien tiene `activo = false`. Una cuenta retirada que desaparece de
 * la lista se lee como un fallo del sistema: el administrador que acaba de dar
 * de baja a alguien necesita ver que quedó dado de baja, no que se esfumó.
 */
export async function fetchCuentas() {
  const { data, error } = await supabase.rpc('list_cuentas_estado')
  if (error) throw error
  return data.map(c => ({
    id: c.id, name: c.name, email: c.email, role: c.role,
    grupoId: c.grupo_id, grupoNombre: c.grupo_nombre, sucursal: c.sucursal,
    activo: c.activo !== false,
  }))
}

/* La base distingue los motivos del fallo; traducirlos todos a "¿correo ya
   registrado?" obligaba a adivinar. */
const MENSAJES_ALTA = {
  email_already_exists:        'Ese correo ya está registrado en otra cuenta.',
  solo_admin:                  'Solo un administrador puede crear cuentas de sub-admin.',
  role_not_allowed_from_client:'Ese rol no se puede crear desde el panel.',
}

export async function createSubAdmin({ name, email, password }) {
  const { data, error } = await supabase.rpc('create_user_with_password', {
    p_name: name,
    p_email: email,
    p_password: password,
    p_role: 'sub_admin',
  })
  if (error) {
    const clave = Object.keys(MENSAJES_ALTA).find(k => (error.message ?? '').includes(k))
    return { ok: false, message: clave ? MENSAJES_ALTA[clave] : 'No se pudo crear el sub-admin.' }
  }
  const row = data?.[0]
  if (!row) return { ok: false, message: 'No se pudo crear el sub-admin.' }
  return { ok: true, user: { id: row.id, name: row.name, email: row.email, role: row.role } }
}

/* ── Baja y reincorporación de sub-admins ──────────────────────────────────
   La cuenta se RETIRA, no se borra. Ver la migración
   20260808120000_baja_de_subadmins.sql para el razonamiento completo: borrar
   se llevaría por delante el historial de qué sucursales tuvo esa persona y
   dejaría viva su fila en la tabla heredada `users`, por la que
   `login_user` seguiría dejándola entrar.

   La retirada es una operación de la base, no del cliente: prohíbe la entrada
   en auth.users, corta la sesión abierta, libera el correo con el prefijo
   `retirada+` y borra sus accesos. */

const MENSAJES_BAJA = {
  solo_admin:          'Solo un administrador puede dar de baja una cuenta.',
  solo_sub_admin:      'Solo se pueden retirar cuentas de sub-admin.',
  no_puedes_retirarte: 'No puedes retirar tu propia cuenta.',
  cuenta_ya_retirada:  'Esa cuenta ya estaba retirada.',
  cuenta_ya_activa:    'Esa cuenta ya está activa.',
  cuenta_no_encontrada:'La cuenta ya no existe.',
  correo_ocupado:      'Su correo original lo ocupa ahora otra cuenta. Cámbialo antes de reincorporarla.',
}

const traducir = (error, porDefecto) => {
  const clave = Object.keys(MENSAJES_BAJA).find(k => (error.message ?? '').includes(k))
  return clave ? MENSAJES_BAJA[clave] : porDefecto
}

/** Retira la cuenta de un sub-admin. Devuelve cuántos accesos se le quitaron. */
export async function desactivarSubAdmin(perfilId) {
  const { data, error } = await supabase.rpc('desactivar_cuenta', { p_perfil_id: perfilId })
  if (error) return { ok: false, message: traducir(error, 'No se pudo retirar la cuenta.') }
  const row = data?.[0]
  return {
    ok: true,
    email: row?.email ?? null,
    accesosRetirados: row?.accesos_retirados ?? 0,
  }
}

/** Reincorpora una cuenta retirada. Los accesos NO vuelven: se conceden de nuevo. */
export async function reactivarSubAdmin(perfilId) {
  const { data, error } = await supabase.rpc('reactivar_cuenta', { p_perfil_id: perfilId })
  if (error) return { ok: false, message: traducir(error, 'No se pudo reincorporar la cuenta.') }
  const row = data?.[0]
  return { ok: true, email: row?.email ?? null }
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

/* ═══════════════════════════════════════════════════════════════════════════
   HOJA MAESTRA — Registrar Calificaciones
   Sus columnas y celdas viven en la BD, no en localStorage. Cada celda ES una
   fila de `evaluations`, así que escribir aquí actualiza el promedio del alumno
   y se ve al instante en su perfil, en Evaluaciones, en Rankings y en el portal
   del alumno — sin ningún proceso de sincronización que pueda desfasarse.
   ═══════════════════════════════════════════════════════════════════════════ */

/** Columnas de la hoja de un grupo, agrupadas por materia y en orden. */
export async function fetchColumnasRegistro(groupId) {
  if (!groupId) return []
  const { data, error } = await supabase
    .from('registro_columnas')
    .select('*')
    .eq('group_id', groupId)
    .order('materia_orden').order('orden')
  if (error) throw error
  return data.map(c => ({
    id: c.id, materia: c.materia, materiaOrden: c.materia_orden,
    materiaColor: c.materia_color, nombre: c.nombre, tipo: c.tipo,
    calMax: Number(c.cal_max), orden: c.orden,
  }))
}

/** Calificaciones de la hoja: { [studentId]: { [columnaId]: calificacion } } */
export async function fetchCeldasRegistro(groupId) {
  if (!groupId) return {}
  const { data, error } = await supabase
    .from('evaluations')
    .select('student_id, calificacion, columna_id, registro_columnas!inner(group_id)')
    .eq('registro_columnas.group_id', groupId)
  if (error) throw error
  const celdas = {}
  for (const e of data) {
    ;(celdas[e.student_id] ??= {})[e.columna_id] = Number(e.calificacion)
  }
  return celdas
}

/** Escribe una celda. `calificacion` en null vacía la celda y borra la nota. */
export async function setCeldaRegistro(studentId, columnaId, calificacion) {
  const { error } = await supabase.rpc('set_celda_registro', {
    p_student_id: studentId,
    p_columna_id: columnaId,
    p_calificacion: calificacion === '' || calificacion === undefined ? null : calificacion,
  })
  if (error) throw error
}

export async function crearColumnaRegistro({ groupId, materia, nombre, tipo = 'actividad', calMax = 10, color = null }) {
  const { data, error } = await supabase.rpc('crear_columna_registro', {
    p_group_id: groupId, p_materia: materia, p_nombre: nombre,
    p_tipo: tipo, p_cal_max: calMax, p_materia_color: color,
  })
  if (error) throw error
  return data
}

export async function borrarColumnaRegistro(columnaId) {
  const { error } = await supabase.rpc('borrar_columna_registro', { p_columna_id: columnaId })
  if (error) throw error
}

/** Pago, garantía y firmas: campos administrativos de la hoja. */
export async function setRegistroAdmin(studentId, campo, valor) {
  const { error } = await supabase.rpc('set_registro_admin', {
    p_student_id: studentId, p_campo: campo, p_valor: String(valor),
  })
  if (error) throw error
}

/**
 * Asistencia del grupo para la rejilla de la hoja, en solo lectura.
 * La captura vive en Pasar Lista: tener dos lugares donde marcar asistencia
 * garantizaba que tarde o temprano dijeran cosas distintas.
 * Devuelve { [studentId]: { [fecha]: 'presente' | 'tardanza' | ... } }.
 */
export async function fetchAsistenciaRegistro(groupId) {
  if (!groupId) return { porAlumno: {}, fechas: [] }
  const { data, error } = await supabase
    .from('attendance_sessions')
    .select('session_date, attendance_records(student_id, status)')
    .eq('group_id', groupId)
    .order('session_date')
  if (error) throw error

  const sesiones = data.filter(sesionCapturada)
  const porAlumno = {}
  for (const s of sesiones) {
    for (const r of s.attendance_records) {
      ;(porAlumno[r.student_id] ??= {})[s.session_date] = r.status
    }
  }
  return { porAlumno, fechas: sesiones.map(s => s.session_date) }
}

/** Avatar del alumno. El catálogo válido se valida también en la BD. */
export async function setStudentAvatar(studentId, avatar) {
  const { error } = await supabase.rpc('set_student_avatar', {
    p_student_id: studentId,
    p_avatar: avatar,
  })
  if (error) throw error
}

/**
 * Catálogo de avatares. Vive en la tabla `avatar_catalogo`, no en el código:
 * añadir uno es insertar una fila, y la validación del RPC mira esa misma
 * tabla, así que no hay una lista que mantener en dos sitios.
 */
export async function fetchAvatares() {
  const { data, error } = await supabase.rpc('list_avatares')
  if (error) throw error
  return data.map(a => ({
    id: a.id, nombre: a.nombre, categoria: a.categoria, src: a.src, orden: a.orden,
  }))
}

/**
 * Credenciales vigentes de un alumno: el correo con el que entra y su
 * contraseña actual.
 *
 * Quién puede verlas lo decide la base, no el cliente: el administrador ve las
 * de cualquiera, el sub-admin las de los alumnos de sus grupos, y el alumno
 * sólo la suya. Si no hay permiso, devuelve null en vez de un error, porque
 * tampoco debe revelarse si la cuenta existe.
 */
export async function fetchCredencialesAlumno(studentId) {
  const { data, error } = await supabase.rpc('ver_credenciales_alumno', {
    p_student_id: studentId,
  })
  if (error) throw error
  const row = data?.[0]
  return row ? { email: row.email, password: row.password } : null
}

/* ── Catálogo de sucursales y turnos ─────────────────────────────────────────
   Sustituyen a la lista 'CN1' | 'CN2' | 'CN3' que estaba escrita a mano en el
   código. Aquellos códigos mezclaban dos cosas: eran la sucursal, pero en la
   nomenclatura oficial CN-1..CN-4 son los HORARIOS de ECOEMS dentro de Neza 1.
   Ahora `groups.sucursal` y `students.sucursal` apuntan por clave foránea a
   `sucursales.id`, así que ya no vale inventarse un valor.

   Son catálogos pequeños y estables: cuatro plazas y veinticinco turnos. */
export async function fetchSucursales() {
  const { data, error } = await supabase
    .from('sucursales')
    .select('id, nombre, administracion')
    .eq('activa', true)
    .order('orden')
  if (error) throw error
  return data ?? []
}

export async function fetchTurnos() {
  const { data, error } = await supabase
    .from('turnos')
    .select('id, sucursal_id, codigo, nivel, dias, hora_inicio, hora_fin')
    .eq('activo', true)
    .order('sucursal_id')
    .order('orden')
  if (error) throw error
  return (data ?? []).map(t => ({
    id: t.id, sucursalId: t.sucursal_id, codigo: t.codigo,
    nivel: t.nivel, dias: t.dias,
    horario: `${t.hora_inicio.slice(0, 5)}–${t.hora_fin.slice(0, 5)}`,
  }))
}
