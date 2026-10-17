/*
 * Avisos por correo sobre algo concreto: una actividad nueva en la hoja, un
 * material nuevo o un material que está por borrarse. Se usan desde el popup
 * que sale al crear una actividad o subir un material, y desde la pestaña
 * "Notificaciones" de Enviar correos.
 *
 * Cada aviso entrega la notificación dentro de SIGA y manda el correo por la
 * Edge Function `enviar-correo` (Resend), igual que un mensaje libre.
 */
import { supabase } from './supabaseClient'
import { crearNotificaciones, guardarBorradorCorreo, enviarCorreo } from './comunicacionesData'

export const AUDIENCIAS = [
  { id: 'ambos',   label: 'Alumnos y tutores', alumno: true,  tutor: true },
  { id: 'alumnos', label: 'Solo alumnos',      alumno: true,  tutor: false },
  { id: 'tutores', label: 'Solo tutores',      alumno: false, tutor: true },
]
export const audienciaDe = id => AUDIENCIAS.find(a => a.id === id) ?? AUDIENCIAS[0]

/** Cuántos correos saldrían para esos alumnos y esa audiencia. */
export function correosPrevistos(alumnos, audiencia) {
  const a = audienciaDe(audiencia)
  const conAlumno = alumnos.filter(s => s.personalEmail).length
  const conTutor = alumnos.filter(s => s.tutor?.email).length
  return { total: (a.alumno ? conAlumno : 0) + (a.tutor ? conTutor : 0), conAlumno, conTutor }
}

const fechaLarga = f => new Date(f).toLocaleString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
// Cómo se nombra cada tipo de columna de la hoja (y su género, para "nuevo/nueva").
const TIPO_TEXTO = {
  tarea: ['tarea', 'a'], actividad: ['actividad', 'a'], general: ['actividad', 'a'],
  digital: ['actividad digital', 'a'], simulacro: ['simulacro', 'o'], examen: ['examen', 'o'],
}
export const textoTipo = tipo => TIPO_TEXTO[tipo] ?? ['actividad', 'a']
const nuevo = tipo => { const [t, g] = textoTipo(tipo); return `${g === 'a' ? 'nueva' : 'nuevo'} ${t}` }
const mayus = s => s.charAt(0).toUpperCase() + s.slice(1)

/* ── Plantillas (el admin las puede editar en el popup antes de enviar) ── */
export function plantillaActividad({ nombre, materia: mat, tipo = 'actividad', grupo: gr, descripcion }) {
  // "Exámenes" no es una materia que valga la pena repetir; "grupo Grupo X" tampoco.
  const materia = mat === 'Exámenes' ? '' : mat
  const grupo = /^grupo\b/i.test(gr ?? '') ? gr.replace(/^grupo\s*/i, '') : gr
  return {
    asunto: `${mayus(nuevo(tipo))}: ${nombre}${materia ? ` (${materia})` : ''}`,
    mensaje: `Te avisamos que se publicó ${textoTipo(tipo)[1] === 'a' ? 'una' : 'un'} ${nuevo(tipo)} en ${materia ? `${materia}, ` : ''}grupo ${grupo}: «${nombre}».`
      + (descripcion ? `\n\n${descripcion}` : '')
      + `\n\nEntra a SIGA para ver los detalles y tus calificaciones.`,
  }
}

export function plantillaMaterialNuevo({ titulo, expiraEn, actividad, visibleDesde }) {
  const programado = visibleDesde && new Date(visibleDesde) > new Date()
  return {
    asunto: `Nuevo material disponible: ${titulo}`,
    mensaje: `${programado ? `A partir del ${fechaLarga(visibleDesde)} estará disponible` : 'Ya está disponible'} en SIGA el material «${titulo}»${actividad ? ` de la actividad ${actividad}` : ''}.`
      + `\n\nPuedes consultarlo y descargarlo hasta el ${fechaLarga(expiraEn)}. Después se borra automáticamente.`
      + `\n\nLo encuentras en SIGA, en la sección "Materiales".`,
  }
}

export function plantillaMaterialVence({ titulo, expiraEn }) {
  return {
    asunto: `Último aviso: «${titulo}» se borra pronto`,
    mensaje: `El material «${titulo}» estará disponible en SIGA solo hasta el ${fechaLarga(expiraEn)}.`
      + `\n\nSi lo necesitas, descárgalo antes de esa fecha desde la sección "Materiales".`,
  }
}

/**
 * Envía un aviso: borrador → notificación en SIGA → correo. Si viene `tipo` y
 * `refId`, queda registrado para no volver a sugerirlo.
 * Devuelve { ok, enviados, omitidos, fallidos, message }.
 */
export async function enviarAviso({ alumnos, asunto, mensaje, audiencia = 'ambos', tipo = null, refId = null, groupId = null }) {
  if (!alumnos?.length) return { ok: false, message: 'No hay alumnos a quienes avisar.' }
  if (!asunto?.trim() || !mensaje?.trim()) return { ok: false, message: 'Escribe el asunto y el mensaje.' }
  const a = audienciaDe(audiencia)
  const draft = await guardarBorradorCorreo({
    subject: asunto.trim(), body: mensaje.trim(), studentIds: alumnos.map(s => s.id),
    includeStudent: a.alumno, includeTutor: a.tutor,
  })
  await crearNotificaciones({ students: alumnos, title: asunto.trim(), body: mensaje.trim() })
  const r = await enviarCorreo(draft.id)
  if (tipo && refId) {
    await supabase.from('avisos_enviados').insert({ tipo, ref_id: String(refId), group_id: groupId, draft_id: draft.id, audiencia })
  }
  return r?.ok ? r : { ok: false, message: r?.message ?? 'No se pudo enviar el correo.' }
}

/** Marca una sugerencia como descartada (no se envía nada). */
export async function descartarAviso({ tipo, refId, groupId = null }) {
  const { error } = await supabase.from('avisos_enviados')
    .insert({ tipo, ref_id: String(refId), group_id: groupId, audiencia: 'ambos', descartado: true })
  if (error) throw error
}

/** Descarta varias sugerencias de una vez. */
export async function descartarAvisos(sugerencias) {
  if (!sugerencias.length) return
  const { error } = await supabase.from('avisos_enviados').insert(sugerencias.map(s => (
    { tipo: s.tipo, ref_id: String(s.refId), group_id: s.groupId ?? null, audiencia: 'ambos', descartado: true })))
  if (error) throw error
}

/* Alumnos a quienes va dirigido un material, según su alcance. */
export function alumnosDeMaterial(material, students, groups) {
  const grupoDe = Object.fromEntries(groups.map(g => [g.id, g]))
  return students.filter(s => {
    const g = grupoDe[s.groupId]
    if (!g) return false
    return material.grupos.includes(g.id) || material.sucursales.includes(g.sucursal) || material.cursos.includes(g.curso)
  })
}

/**
 * Sugerencias para la pestaña Notificaciones:
 *  · actividades creadas en los últimos 7 días (grupos con alumnos),
 *  · materiales que se hicieron visibles en los últimos 7 días,
 *  · materiales que se borran en los próximos 3 días.
 * Omite lo ya avisado o descartado.
 */
export async function fetchSugerencias({ students, groups }) {
  const hace7 = new Date(Date.now() - 7 * 864e5).toISOString()
  const ahora = new Date().toISOString()
  const en3 = new Date(Date.now() + 3 * 864e5).toISOString()
  const [cols, mats, hechos] = await Promise.all([
    supabase.from('registro_columnas').select('id, group_id, materia, nombre, tipo, descripcion, es_fija, created_at')
      .gte('created_at', hace7).eq('es_fija', false).order('created_at', { ascending: false }),
    supabase.from('materiales').select('*').gt('expira_en', ahora),
    supabase.from('avisos_enviados').select('tipo, ref_id'),
  ])
  if (cols.error) throw cols.error
  const yaHecho = new Set((hechos.data ?? []).map(h => `${h.tipo}:${h.ref_id}`))
  const grupoDe = Object.fromEntries(groups.map(g => [g.id, g]))
  const alumnosDe = gid => students.filter(s => s.groupId === gid)
  const out = []

  for (const c of cols.data ?? []) {
    if (yaHecho.has(`actividad:${c.id}`)) continue
    // Guía y análisis del bloque de examen no se anuncian solos: se anuncia el examen.
    if (['guia', 'analisis'].includes(c.tipo)) continue
    const g = grupoDe[c.group_id]; const alumnos = alumnosDe(c.group_id)
    if (!g || !alumnos.length) continue
    out.push({
      clave: `actividad:${c.id}`, tipo: 'actividad', refId: c.id, groupId: g.id, fecha: c.created_at,
      categoria: c.tipo === 'examen' ? 'examen' : 'actividad', nombre: c.nombre, materia: c.materia,
      tipoTexto: mayus(textoTipo(c.tipo)[0]), groupIds: [g.id],
      titulo: `${mayus(nuevo(c.tipo))}: ${c.nombre}`,
      detalle: `${c.materia} · ${g.name} · ${alumnos.length} alumno(s)`, alumnos,
      ...plantillaActividad({ nombre: c.nombre, materia: c.materia, tipo: c.tipo, grupo: g.name, descripcion: c.descripcion }),
    })
  }

  for (const m of mats.data ?? []) {
    const mat = { ...m, grupos: m.grupos ?? [], sucursales: m.sucursales ?? [], cursos: m.cursos ?? [] }
    const alumnos = alumnosDeMaterial(mat, students, groups)
    if (!alumnos.length) continue
    const unGrupo = mat.grupos.length === 1 && !mat.sucursales.length && !mat.cursos.length ? mat.grupos[0] : null
    const comun = { nombre: m.titulo, groupIds: [...new Set(alumnos.map(a => a.groupId))] }
    if (m.expira_en <= en3 && m.visible_desde <= ahora && !yaHecho.has(`material_vence:${m.id}`)) {
      out.push({
        ...comun, categoria: 'vence',
        clave: `material_vence:${m.id}`, tipo: 'material_vence', refId: m.id, groupId: unGrupo, fecha: m.expira_en,
        titulo: `Por vencer: ${m.titulo}`, detalle: `Se borra el ${fechaLarga(m.expira_en)} · ${alumnos.length} alumno(s)`, alumnos,
        ...plantillaMaterialVence({ titulo: m.titulo, expiraEn: m.expira_en }),
      })
    } else if (m.visible_desde >= hace7 && m.visible_desde <= ahora && !yaHecho.has(`material_nuevo:${m.id}`)) {
      out.push({
        ...comun, categoria: 'material',
        clave: `material_nuevo:${m.id}`, tipo: 'material_nuevo', refId: m.id, groupId: unGrupo, fecha: m.visible_desde,
        titulo: `Material nuevo: ${m.titulo}`, detalle: `Disponible hasta el ${fechaLarga(m.expira_en)} · ${alumnos.length} alumno(s)`, alumnos,
        ...plantillaMaterialNuevo({ titulo: m.titulo, expiraEn: m.expira_en }),
      })
    }
  }
  return out.sort((a, b) => (a.tipo === 'material_vence' ? -1 : 0) - (b.tipo === 'material_vence' ? -1 : 0) || b.fecha.localeCompare(a.fecha))
}
