import { supabase } from './supabaseClient'
import { todayISO } from './fecha'

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
    .from('profiles').select('id,name,email,role,student_id,activo').eq('id', data.user.id).maybeSingle()

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
    .from('profiles').select('id,name,email,role,student_id,activo').eq('id', data.session.user.id).maybeSingle()
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
    curso: g.curso ?? (g.institucion === 'ecoems' ? 'ecoems' : 'universidad'),
    instituciones: g.instituciones ?? (['unam','uam','ipn'].includes(g.institucion) ? [g.institucion] : []),
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
    personalEmail: s.personal_email,
    whatsapp: s.whatsapp,
    groupId: s.group_id,
    tutor: { name: s.tutor_name, email: s.tutor_email, phone: s.tutor_phone, whatsapp: s.tutor_whatsapp },
    universidadArea: s.universidad_area,
    garantiaEstado: s.garantia_estado,
    garantiaAceptada: s.garantia_aceptada,
    garantiaFirmaAlumno: s.garantia_firma_alumno,
    garantiaFirmaTutor: s.garantia_firma_tutor,
    accesoEstado: s.acceso_estado,
    attendanceRate: num(s.attendance_rate),
    avgGrade: num(s.avg_grade),
    assignmentsDone: s.assignments_done,
    assignmentsTotal: s.assignments_total,
    rank: s.rank,
    status: s.status,
    termsStatus: s.terms_status,
    signedAt: s.signed_at,
    signatureDataUrl: s.signature_data_url,
    waAdded: s.wa_added,
    sucursal: s.sucursal,
    pagoEstado: s.pago_estado,
    garantia: s.garantia,
    firmaGarantia: s.firma_garantia,
    examenGeneral: s.examen_general,
    avatar: s.avatar,
    avatarSrc: s.avatar_catalogo?.src ?? null,
    fotoPath: s.foto_path ?? null,
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
    personalEmail: data.personal_email,
    whatsapp: data.whatsapp,
    groupId: data.group_id,
    tutor: { name: data.tutor_name, email: data.tutor_email, phone: data.tutor_phone, whatsapp: data.tutor_whatsapp },
    universidadArea: data.universidad_area,
    garantiaEstado: data.garantia_estado,
    garantiaAceptada: data.garantia_aceptada,
    garantiaFirmaAlumno: data.garantia_firma_alumno,
    garantiaFirmaTutor: data.garantia_firma_tutor,
    accesoEstado: data.acceso_estado,
    attendanceRate: num(data.attendance_rate),
    avgGrade: num(data.avg_grade),
    assignmentsDone: data.assignments_done,
    assignmentsTotal: data.assignments_total,
    rank: data.rank,
    status: data.status,
    termsStatus: data.terms_status,
    signedAt: data.signed_at,
    signatureDataUrl: data.signature_data_url,
    waAdded: data.wa_added,
    sucursal: data.sucursal,
    pagoEstado: data.pago_estado,
    garantia: data.garantia,
    firmaGarantia: data.firma_garantia,
    examenGeneral: data.examen_general,
    avatar: data.avatar,
    avatarSrc: data.avatar_catalogo?.src ?? null,
    fotoPath: data.foto_path ?? null,
  }
}

export async function fetchGroupById(id) {
  if (!id) return null
  const { data, error } = await supabase.from('groups').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data
    ? { id: data.id, name: data.name, subject: data.subject, schedule: data.schedule, room: data.room, color: data.color, sucursal: data.sucursal, institucion: data.institucion, curso:data.curso, instituciones:data.instituciones ?? [] }
    : null
}

export async function signTerms(studentId, signatureDataUrl) {
  const { data, error } = await supabase.rpc('sign_terms', {
    p_student_id: studentId,
    p_signature_data_url: signatureDataUrl,
  })
  if (error) throw error
  const row = data?.[0]
  return row ? {
    termsStatus: row.terms_status,
    signedAt: row.signed_at,
    signatureDataUrl: row.signature_data_url,
  } : null
}

/** Revierte la firma de términos de un alumno (Gestión de T&C). */
export async function resetTerms(studentId) {
  const { data, error } = await supabase.rpc('reset_terms', { p_student_id: studentId })
  if (error) throw error
  const row = data?.[0]
  return row ? { termsStatus: row.terms_status, signedAt: row.signed_at } : null
}

/**
 * Una sesión sin ningún registro y sin terminar es una lista que se abrió y
 * nunca se guardó, no una clase a la que faltó el grupo entero: se descarta.
 * Una lista TERMINADA sin registros sí cuenta: ese día faltaron todos.
 * (Las selects que la usan deben incluir `finished`.)
 */
const sesionCapturada = s => s.finished === true || (s.attendance_records ?? []).length > 0

/**
 * Historial de asistencia del alumno: una entrada por sesión capturada de su
 * grupo (ausente si el docente pasó lista y no lo marcó).
 *
 * Se resuelve en el servidor (RPC asistencia_alumno) porque, por RLS, el
 * alumno solo ve SUS registros: desde el cliente las sesiones a las que faltó
 * llegaban vacías, se descartaban y su asistencia salía siempre 100 %.
 */
export async function fetchStudentAttendance(studentId, groupId) {
  if (!studentId || !groupId) return []
  const { data, error } = await supabase.rpc('asistencia_alumno', { p_student_id: studentId })
  if (error) throw error
  return (data ?? []).map(r => ({
    date: r.session_date, status: r.status, time: r.arrival_label ?? null, studentId,
  }))
}

/**
 * Tasa de asistencia real calculada desde las sesiones y registros de la BD.
 * Devuelve { byStudent, byGroup } con porcentajes 0–100, o null cuando el
 * grupo todavía no tiene sesiones (para no mostrar un 0% engañoso).
 */
export async function fetchAttendanceStats(students) {
  const { data, error } = await supabase
    .from('attendance_sessions')
    .select('group_id, finished, attendance_records(student_id, status)')
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

  /* RPC metricas_grupo: por RLS un alumno solo lee su propia fila, así que
     desde el cliente su "lugar en el grupo" salía siempre #1 de 1. El servidor
     devuelve el grupo completo; a un alumno, con los compañeros anonimizados
     (`anon-N`, sin nombre). El personal recibe los ids reales. */
  const { data, error } = await supabase.rpc('metricas_grupo', { p_group_id: groupId })
  if (error) throw error
  const filas = data ?? []

  // Nombres: solo para ids reales que el usuario puede leer (personal; el
  // alumno, el suyo). Los anónimos se quedan sin nombre.
  const realIds = filas.map(f => f.member_id).filter(id => !id.startsWith('anon-'))
  const { data: sts, error: e2 } = realIds.length
    ? await supabase.from('students').select('id, name').in('id', realIds)
    : { data: [] }
  if (e2) throw e2
  const nombre = Object.fromEntries((sts ?? []).map(s => [s.id, s.name]))

  const evalsByStudent = {}
  const attendanceByStudent = {}
  const members = filas.map(f => {
    evalsByStudent[f.member_id] = (f.evaluaciones ?? []).map(mapEvaluation)
    attendanceByStudent[f.member_id] = (f.asistencia ?? []).map(a => ({
      date: a.session_date, status: a.status, time: a.arrival_label ?? null, studentId: f.member_id,
    }))
    return {
      id: f.member_id,
      name: nombre[f.member_id] ?? null,
      groupId,
      assignmentsDone: f.assignments_done,
      assignmentsTotal: f.assignments_total,
    }
  })

  return { members, evalsByStudent, attendanceByStudent }
}

/**
 * Conteo de asistencia de las sesiones de hoy, por estatus.
 * `esperados` son los alumnos de los grupos con sesión hoy: quien no tiene
 * registro cuenta como ausente.
 */
export async function fetchAsistenciaHoy(students) {
  const hoy = todayISO()
  // Acotado a los alumnos recibidos (los filtros del tablero): solo sus
  // grupos y solo sus registros. Una sola consulta para todos los grupos.
  const grupos = [...new Set(students.map(s => s.groupId).filter(Boolean))]
  const delFiltro = new Set(students.map(s => s.id))
  if (!grupos.length) return { counts: { presente: 0, tardanza: 0, ausente: 0 }, esperados: 0, haySesion: false }
  const { data, error } = await supabase
    .from('attendance_sessions')
    .select('group_id, session_date, finished, attendance_records(student_id, status)')
    .eq('session_date', hoy)
    .in('group_id', grupos)
  if (error) throw error

  const counts = { presente: 0, tardanza: 0, ausente: 0 }
  // Sólo cuentan las listas ya capturadas: una abierta sin guardar marcaría
  // ausente a todo el grupo en el tablero del día.
  const sesiones = data.filter(sesionCapturada)
  const gruposConSesion = new Set(sesiones.map(s => s.group_id))
  const registrados = new Set()

  for (const s of sesiones) {
    for (const r of s.attendance_records) {
      if (!delFiltro.has(r.student_id)) continue
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
  // Columna de la hoja de Calificaciones de la que sale (si se capturó ahí):
  // permite abrir el detalle de la asignación ("Tarea 3", bloque, máximo).
  columnaId: e.columna_id ?? null,
})

/** Nombres de varias asignaciones de la hoja en una sola consulta: { id: nombre }. */
export async function fetchNombresColumnas(ids = []) {
  const unicos = [...new Set(ids.filter(Boolean))]
  if (!unicos.length) return {}
  const { data, error } = await supabase.from('registro_columnas').select('id, nombre').in('id', unicos)
  if (error) throw error
  return Object.fromEntries((data ?? []).map(c => [c.id, c.nombre]))
}

/**
 * Asignación de la hoja de Calificaciones a la que pertenece una evaluación.
 * RLS: la leen el admin, el personal del grupo y los alumnos de ese grupo.
 */
export async function fetchColumnaRegistro(columnaId) {
  if (!columnaId) return null
  const { data, error } = await supabase
    .from('registro_columnas')
    .select('id, group_id, nombre, materia, tipo, bloque, cal_max')
    .eq('id', columnaId)
    .maybeSingle()
  if (error) throw error
  return data ? {
    id: data.id, groupId: data.group_id, nombre: data.nombre, materia: data.materia,
    tipo: data.tipo, bloque: data.bloque, calMax: data.cal_max != null ? Number(data.cal_max) : null,
  } : null
}

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
    p_fecha: fecha ?? todayISO(),
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

export async function createGroup({ name, subject, schedule = null, room = null, color = '#3b82f6', sucursal = null, institucion = null, curso = 'ecoems', instituciones = [] }) {
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
  if (row?.id) await supabase.rpc('actualizar_clasificacion_grupo', { p_group_id:row.id, p_curso:curso, p_instituciones:instituciones })
  return { ok: true, group: row ? { ...row, id: row.id } : null }
}

export async function updateGroup({ id, name, subject, schedule = null, room = null, color = null, sucursal = null, institucion = null, curso = 'ecoems', instituciones = [] }) {
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
  const { error: classificationError } = await supabase.rpc('actualizar_clasificacion_grupo', { p_group_id:id, p_curso:curso, p_instituciones:instituciones })
  if (classificationError) return { ok:false, message:'No se pudo guardar el curso e instituciones.' }
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

/* El alta de alumnos va SIEMPRE con su primer pago: altaAlumnoConPago (abajo). */
const MENSAJES_ALTA_ALUMNO = {
  sin_permiso_altas: 'No tienes permiso para dar de alta alumnos. Pídeselo a un administrador.',
  forbidden: 'No puedes dar de alta alumnos en ese grupo.',
  email_already_exists: 'Ese correo ya está registrado.',
  group_not_found: 'El grupo seleccionado no existe.',
  falta_total: 'Escribe el total del curso.',
  falta_primer_pago: 'Registra el primer importe: es obligatorio para dar de alta.',
  pago_mayor_al_total: 'El primer pago no puede ser mayor que el total del curso.',
  falta_metodo: 'Elige la forma de pago.',
  modalidad_invalida: 'Elige contado o mensualidades.',
}

/**
 * Alta obligatoria con pago: crea el alumno, su plan de pago y el primer
 * importe en UNA operación (si algo falla no queda nada a medias).
 * `pago`: { total, modalidad, mensualidades, inicio, concepto, monto, metodo, esInscripcion, referencia }
 */
export async function altaAlumnoConPago({ name, email, groupId, password, tutor = {}, sucursal = null, personalEmail = null, whatsapp = null, universidadArea = null, pago }) {
  const { data, error } = await supabase.rpc('alta_alumno_con_pago', {
    p_name: name, p_email: email, p_group_id: groupId, p_password: password,
    p_tutor_name: tutor.name ?? null, p_tutor_email: tutor.email ?? null, p_tutor_phone: tutor.phone ?? null,
    p_sucursal: sucursal,
    p_total: pago.total, p_modalidad: pago.modalidad, p_mensualidades: pago.mensualidades,
    p_inicio: pago.inicio || null, p_concepto: pago.concepto || 'Curso',
    p_monto: pago.monto, p_metodo: pago.metodo, p_es_inscripcion: !!pago.esInscripcion, p_referencia: pago.referencia || null,
  })
  if (error) {
    const clave = Object.keys(MENSAJES_ALTA_ALUMNO).find(k => (error.message ?? '').includes(k))
    return { ok: false, message: clave ? MENSAJES_ALTA_ALUMNO[clave] : 'No se pudo dar de alta al alumno.' }
  }
  const row = data?.[0]
  if (row?.id) await supabase.rpc('actualizar_contacto_alumno', { p_student_id: row.id, p_personal_email: personalEmail, p_whatsapp: whatsapp, p_tutor_whatsapp: tutor.whatsapp, p_universidad_area: universidadArea })
  return { ok: true, student: row ? { id: row.id, name: row.name, email: row.email, groupId: row.group_id, planId: row.plan_id } : null }
}

/** ¿Puedo dar de alta / baja alumnos? ¿Puedo cambiar ese permiso a otros? */
export async function fetchPermisosAltas() {
  const [a, d] = await Promise.all([supabase.rpc('puede_dar_altas'), supabase.rpc('es_dueno')])
  return { puedeDarAltas: a.data === true, esDueno: d.data === true }
}

/** Lista del permiso de altas por persona (la ven los admins; solo algunos la editan). */
export async function fetchListaPermisoAltas() {
  const { data, error } = await supabase.rpc('list_permiso_altas')
  if (error) throw error
  return (data ?? []).map(r => ({ userId: r.user_id, nombre: r.nombre, email: r.email, rol: r.rol, puede: r.puede, esDueno: r.es_dueno, personalizado: r.personalizado }))
}

export async function setPermisoAltas(userId, puede) {
  const { error } = await supabase.rpc('set_permiso_altas', { p_user: userId, p_puede: puede })
  if (!error) return { ok: true }
  const msg = error.message ?? ''
  return { ok: false, message: msg.includes('solo_duenos') ? 'No tienes permiso para cambiar esto.'
    : msg.includes('dueno_no_editable') ? 'Este permiso no se puede modificar.' : 'No se pudo guardar el permiso.' }
}

export async function updateStudent({ id, name, email, groupId, tutor = {}, sucursal = null, personalEmail = null, whatsapp = null, universidadArea = null }) {
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
  const { error: contactError } = await supabase.rpc('actualizar_contacto_alumno', { p_student_id:id, p_personal_email:personalEmail, p_whatsapp:whatsapp, p_tutor_whatsapp:tutor.whatsapp, p_universidad_area:universidadArea })
  if (contactError) return { ok:false, message:'Se guardó el alumno, pero no sus datos de contacto.' }
  return { ok: true }
}

export async function deleteStudent(id) {
  const { error } = await supabase.rpc('delete_student', { p_id: id })
  if (!error) return { ok: true }
  const msg = error.message ?? ''
  if (msg.includes('sin_permiso_altas'))
    return { ok: false, message: 'No tienes permiso para dar de baja alumnos. Pídeselo a un administrador.' }
  if (msg.includes('forbidden'))
    return { ok: false, message: 'No puedes eliminar a un alumno que no es de tus grupos.' }
  return { ok: false, message: 'No se pudo eliminar al alumno. Inténtalo de nuevo; si sigue fallando, avísanos.' }
}

/**
 * Datos de contacto y área, sin tocar el resto del alumno.
 *
 * La hoja de calificaciones necesita cambiar SÓLO el área desde un desplegable
 * de celda; pasar por `updateStudent` obligaría a reenviar nombre, correo y
 * grupo, y cualquier valor obsoleto en memoria pisaría el dato bueno.
 */
export async function actualizarContactoAlumno({ id, personalEmail = null, whatsapp = null, tutorWhatsapp = null, universidadArea = null }) {
  const { error } = await supabase.rpc('actualizar_contacto_alumno', {
    p_student_id: id,
    p_personal_email: personalEmail,
    p_whatsapp: whatsapp,
    p_tutor_whatsapp: tutorWhatsapp,
    p_universidad_area: universidadArea,
  })
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

/* ── Apartados del panel por sub-admin ─────────────────────────────────────
   Qué secciones ve cada sub-admin. Lo decide un admin; Pagos y Correos se
   bloquean también en el servidor. */
const MENSAJES_APARTADOS = {
  solo_admin:          'Solo un administrador puede decidir los apartados.',
  solo_sub_admin:      'Los apartados solo se eligen para sub-admins: un administrador ve todo.',
  apartado_invalido:   'Uno de los apartados no existe.',
  cuenta_no_encontrada:'No se encontró la cuenta.',
}

/** Apartados que puede abrir quien tiene la sesión (admin: todos). */
export async function fetchMisApartados() {
  const { data, error } = await supabase.rpc('mis_apartados')
  if (error) throw error
  return data ?? []
}

/** { [userId]: { apartados, personalizado } } de todos los sub-admins (solo admin). */
export async function fetchApartadosPersonal() {
  const { data, error } = await supabase.rpc('list_apartados_personal')
  if (error) throw error
  return Object.fromEntries((data ?? []).map(r => [r.user_id, { apartados: r.apartados ?? [], personalizado: r.personalizado }]))
}

export async function setApartadosPersonal(userId, apartados) {
  const { data, error } = await supabase.rpc('admin_set_apartados', { p_user: userId, p_apartados: apartados })
  if (error) {
    const clave = Object.keys(MENSAJES_APARTADOS).find(k => (error.message ?? '').includes(k))
    throw new Error(clave ? MENSAJES_APARTADOS[clave] : 'No se pudieron guardar los apartados.')
  }
  return data ?? []
}

/** Alta de admin o sub-admin (este con sus apartados) en un solo paso. */
export async function crearPersonal({ name, email, password, role, apartados }) {
  const { data, error } = await supabase.rpc('crear_personal', {
    p_name: name, p_email: email, p_password: password, p_role: role,
    p_apartados: role === 'sub_admin' ? apartados : null,
  })
  if (error) {
    const msg = error.message ?? ''
    const clave = Object.keys(MENSAJES_ALTA).find(k => msg.includes(k))
    if (clave) return { ok: false, message: MENSAJES_ALTA[clave] }
    if (msg.includes('contrasena_corta')) return { ok: false, message: 'La contraseña debe tener al menos 6 caracteres.' }
    if (msg.includes('nombre_vacio')) return { ok: false, message: 'Escribe el nombre de la persona.' }
    return { ok: false, message: 'No se pudo crear la cuenta.' }
  }
  const row = data?.[0]
  if (!row) return { ok: false, message: 'No se pudo crear la cuenta.' }
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
    calMax: Number(c.cal_max), orden: c.orden, bloque:c.bloque, esFija:!!c.es_fija,
    // Formato: calificacion (número 0..calMax) | check (hecho/no) | valor (libre u opciones).
    formato: c.formato ?? 'calificacion', cuenta: c.cuenta_en_promedio !== false,
    opciones: Array.isArray(c.opciones) ? c.opciones : null, descripcion: c.descripcion ?? '',
    // Prerrequisito (otra columna del grupo) y si cuenta para la garantía.
    requisitoId: c.requisito_id ?? null,
    requisitoMin: c.requisito_min == null ? null : Number(c.requisito_min),
    cuentaGarantia: c.cuenta_garantia !== false,
    // Fecha de entrega (opcional): recordatorio por correo 2 días antes.
    fechaEntrega: c.fecha_entrega ?? null,
  }))
}

/** Fecha de entrega de una columna (null la quita). */
export async function setFechaEntrega(columnaId, fecha) {
  const { error } = await supabase.rpc('set_fecha_entrega', { p_columna_id: columnaId, p_fecha: fecha || null })
  if (error) return { ok: false, message: 'No se pudo guardar la fecha de entrega.' }
  return { ok: true }
}

const MENSAJES_REQUISITO = {
  requisito_propio: 'Una columna no puede ser requisito de sí misma.',
  requisito_ajeno:  'El requisito debe ser una columna de este mismo grupo.',
  requisito_ciclo:  'Ese requisito haría un círculo (A pide B y B pide A).',
  requisito_min_invalido: 'El mínimo no puede ser negativo.',
  forbidden:        'No tienes permiso sobre este grupo.',
}

/** Prerrequisito y "cuenta para la garantía" de una columna. */
export async function configurarRequisitoColumna({ id, requisitoId = null, requisitoMin = null, cuentaGarantia = true }) {
  const { error } = await supabase.rpc('configurar_requisito_columna', {
    p_columna_id: id, p_requisito_id: requisitoId, p_requisito_min: requisitoMin, p_cuenta_garantia: cuentaGarantia,
  })
  if (error) {
    const clave = Object.keys(MENSAJES_REQUISITO).find(k => (error.message ?? '').includes(k))
    return { ok: false, message: clave ? MENSAJES_REQUISITO[clave] : 'No se pudo guardar el requisito.' }
  }
  return { ok: true }
}

/** Añade un bloque Guía de estudio → Examen → Análisis de resultados. */
export async function agregarBloqueExamen(groupId) {
  const { data, error } = await supabase.rpc('agregar_bloque_examen', { p_group_id: groupId })
  if (error) throw error
  return data
}

/** Orden de los bloques de la hoja (también los fijos) o null si nunca se movió. */
export async function fetchOrdenBloques(groupId) {
  const { data, error } = await supabase.from('registro_orden_bloques').select('orden').eq('group_id', groupId).maybeSingle()
  if (error) throw error
  return data?.orden ?? null
}

export async function guardarOrdenBloques(groupId, orden) {
  const { error } = await supabase.rpc('guardar_orden_bloques', { p_group_id: groupId, p_orden: orden })
  if (error) throw error
}

const MENSAJES_COLUMNA = {
  nombre_vacio:        'Escribe un nombre para la columna.',
  nombre_repetido:     'Ya hay otra columna con ese nombre en esta materia.',
  cal_max_invalido:    'La calificación máxima debe ser mayor que 0.',
  opciones_invalidas:  'Revisa las opciones (máximo 20).',
  columna_fija:        'Esta columna es parte de la plantilla y no se puede modificar.',
  forbidden:           'No tienes permiso para modificar columnas de este grupo.',
}

/**
 * Configura una columna de la hoja: nombre, tipo, formato (calificacion |
 * check | valor), máximo, si cuenta para el promedio, opciones y descripción.
 * Devuelve { ok } o { ok:false, message, conValores?, fueraDeRango? }.
 * `conValores`: cambiar el formato borraría N valores ya capturados; se
 * vuelve a llamar con limpiar=true tras confirmarlo.
 */
export async function configurarColumnaRegistro({ id, nombre, tipo, calMax, formato, cuenta, opciones, descripcion, limpiar = false }) {
  const { error } = await supabase.rpc('configurar_columna_registro', {
    p_columna_id: id, p_nombre: nombre, p_tipo: tipo, p_cal_max: calMax,
    p_formato: formato, p_cuenta: cuenta, p_opciones: opciones?.length ? opciones : null,
    p_descripcion: descripcion ?? null, p_limpiar: limpiar,
  })
  if (!error) return { ok: true }
  const msg = error.message ?? ''
  const conValores = msg.match(/tiene_valores:(\d+)/)
  if (conValores) return { ok: false, conValores: Number(conValores[1]), message: '' }
  const fuera = msg.match(/valores_fuera_de_rango:([\d.]+)/)
  if (fuera) return { ok: false, message: `Hay calificaciones de hasta ${Number(fuera[1])}: el máximo no puede ser menor.` }
  const clave = Object.keys(MENSAJES_COLUMNA).find(k => msg.includes(k))
  return { ok: false, message: clave ? MENSAJES_COLUMNA[clave] : 'No se pudo guardar la configuración de la columna.' }
}

/** Guarda el orden de materias y columnas de la hoja.
 *  orden: [{ materia, columnas: [columnaId, ...] }, ...] en el orden deseado. */
export async function reordenarRegistro(groupId, orden) {
  const { error } = await supabase.rpc('reordenar_registro', { p_group_id: groupId, p_orden: orden })
  if (error) throw error
}

/** Calificaciones de la hoja: { [studentId]: { [columnaId]: calificacion } } */
export async function fetchCeldasRegistro(groupId) {
  if (!groupId) return {}
  const { data, error } = await supabase
    .from('registro_valores')
    .select('student_id, valor, columna_id, registro_columnas!inner(group_id)')
    .eq('registro_columnas.group_id', groupId)
  if (error) throw error
  const celdas = {}
  for (const e of data) {
    const numeric = Number(e.valor)
    ;(celdas[e.student_id] ??= {})[e.columna_id] = e.valor === 'NP' ? 'NP' : (Number.isNaN(numeric) ? e.valor : numeric)
  }
  return celdas
}

/** Escribe una celda. `calificacion` en null vacía la celda y borra la nota. */
export async function setCeldaRegistro(studentId, columnaId, calificacion) {
  const { error } = await supabase.rpc('set_valor_registro', {
    p_student_id: studentId,
    p_columna_id: columnaId,
    p_valor: calificacion === '' || calificacion === undefined ? null : String(calificacion),
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
    .select('session_date, finished, attendance_records(student_id, status)')
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
const MENSAJES_ACCESO = {
  solo_admin:           'Solo un administrador puede editar accesos.',
  no_editar_otro_admin: 'No se puede cambiar el acceso de otro administrador.',
  cuenta_retirada:      'La cuenta está retirada: reincorpórala primero.',
  cuenta_no_encontrada: 'No se encontró la cuenta.',
  correo_invalido:      'Ese correo no es válido.',
  correo_repetido:      'Ese correo ya lo usa otra cuenta.',
  contrasena_corta:     'La contraseña debe tener al menos 6 caracteres.',
  sin_cambios:          'No cambiaste nada.',
}

/**
 * Cambia el usuario (correo) y/o la contraseña de una cuenta (solo admin).
 * `cuenta`: id de perfil o id de alumno. Vacíos = sin cambio.
 * Cierra las sesiones abiertas de esa persona.
 */
export async function adminActualizarAcceso({ cuenta, email = '', password = '' }) {
  const { data, error } = await supabase.rpc('admin_actualizar_acceso', {
    p_cuenta: cuenta, p_email: email || null, p_password: password || null,
  })
  if (error) {
    const clave = Object.keys(MENSAJES_ACCESO).find(k => (error.message ?? '').includes(k))
    return { ok: false, message: clave ? MENSAJES_ACCESO[clave] : 'No se pudo guardar el acceso.' }
  }
  return { ok: true, email: data?.[0]?.email ?? email }
}

/** Credenciales vigentes de una cuenta de personal (sub-admin) por su id de
 *  perfil. La RPC solo las entrega al admin (o a la propia persona). */
export async function fetchCredencialesPerfil(perfilId) {
  const { data, error } = await supabase.rpc('ver_credenciales', { p_perfil_id: perfilId })
  if (error) throw error
  const row = data?.[0]
  return row ? { email: row.email, password: row.password } : null
}

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
