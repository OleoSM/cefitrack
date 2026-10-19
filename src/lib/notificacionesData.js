/*
 * Apartado "Notificaciones" del admin: todo lo que se ha avisado, lo que está
 * por vencer y el historial de correos, más los avisos automáticos
 * (recordatorios de 2 días y top mensual) que se disparan a mano o por tarea.
 */
import { supabase } from './supabaseClient'

export const TIPO_AVISO = {
  actividad:              'Actividad nueva',
  material_nuevo:         'Material nuevo',
  material_vence:         'Material por vencer',
  recordatorio_actividad: 'Recordatorio de entrega',
  top_mensual:            'Top mensual',
}

/** Avisos enviados o descartados, con el asunto y cuántos correos salieron. */
export async function fetchAvisosEnviados(limite = 300) {
  const { data, error } = await supabase.from('avisos_enviados')
    .select('id, tipo, ref_id, group_id, draft_id, audiencia, descartado, created_at, email_drafts(subject)')
    .order('created_at', { ascending: false }).limit(limite)
  if (error) throw error
  const drafts = [...new Set((data ?? []).map(a => a.draft_id).filter(Boolean))]
  const conteo = {}
  if (drafts.length) {
    const { data: envios } = await supabase.from('email_envios').select('draft_id, estado').in('draft_id', drafts)
    for (const e of envios ?? []) {
      const c = conteo[e.draft_id] ??= { enviado: 0, omitido: 0, fallido: 0 }
      c[e.estado] = (c[e.estado] ?? 0) + 1
    }
  }
  return (data ?? []).map(a => ({
    id: a.id, tipo: a.tipo, refId: a.ref_id, groupId: a.group_id, audiencia: a.audiencia,
    descartado: a.descartado, fecha: a.created_at, asunto: a.email_drafts?.subject ?? '',
    correos: conteo[a.draft_id] ?? { enviado: 0, omitido: 0, fallido: 0 },
  }))
}

/** Actividades con fecha de entrega y materiales que vencen en los próximos `dias`. */
export async function fetchProximosAVencer(dias = 7) {
  const hoy = new Date(); const fin = new Date(hoy.getTime() + dias * 864e5)
  const dia = d => d.toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })
  const [{ data: cols }, { data: mats }, { data: avisos }, { data: grupos }] = await Promise.all([
    supabase.from('registro_columnas').select('id, group_id, materia, nombre, tipo, fecha_entrega')
      .gte('fecha_entrega', dia(hoy)).lte('fecha_entrega', dia(fin)).order('fecha_entrega'),
    supabase.from('materiales').select('id, titulo, expira_en, grupos, sucursales, cursos')
      .gt('expira_en', hoy.toISOString()).lte('expira_en', fin.toISOString()).order('expira_en'),
    supabase.from('avisos_enviados').select('tipo, ref_id').in('tipo', ['recordatorio_actividad', 'material_vence']),
    supabase.from('groups').select('id, name'),
  ])
  const avisado = new Set((avisos ?? []).map(a => `${a.tipo}:${a.ref_id}`))
  const nombreGrupo = Object.fromEntries((grupos ?? []).map(g => [g.id, g.name]))
  return [
    ...(cols ?? []).map(c => ({ clave: `a:${c.id}`, tipo: 'actividad', titulo: c.nombre, detalle: `${c.materia} · ${nombreGrupo[c.group_id] ?? ''}`,
      fecha: `${c.fecha_entrega}T23:59:00`, avisado: avisado.has(`recordatorio_actividad:${c.id}`) })),
    ...(mats ?? []).map(m => ({ clave: `m:${m.id}`, tipo: 'material', titulo: m.titulo,
      detalle: [m.grupos?.length && `${m.grupos.length} grupo(s)`, m.sucursales?.length && `${m.sucursales.length} sucursal(es)`, m.cursos?.length && m.cursos.join(', ')].filter(Boolean).join(' · '),
      fecha: m.expira_en, avisado: avisado.has(`material_vence:${m.id}`) })),
  ].sort((a, b) => a.fecha.localeCompare(b.fecha))
}

/** Historial de correos (la RLS decide: admin todos; sub-admin los suyos). */
export async function fetchHistorialCorreos(limite = 300) {
  const { data, error } = await supabase.from('email_envios')
    .select('id, destinatario, tipo, estado, motivo, created_at, email_drafts(subject)')
    .order('created_at', { ascending: false }).limit(limite)
  if (error) throw error
  return (data ?? []).map(e => ({ id: e.id, destinatario: e.destinatario, tipo: e.tipo, estado: e.estado, motivo: e.motivo,
    fecha: e.created_at, asunto: e.email_drafts?.subject ?? '' }))
}

const MENSAJES_AUTO = {
  solo_admin: 'Solo un administrador puede disparar los avisos automáticos.',
  sin_sesion: 'Tu sesión caducó. Vuelve a entrar.',
  falta_api_key: 'Falta la API key de Resend en Supabase.',
  correos_deshabilitados: 'El envío de correos está desactivado. Un administrador puede activarlo en Configuración.',
}

/** accion: 'recordatorios' | 'top_mensual'. vistaPrevia=true no manda nada. */
export async function ejecutarAvisosAuto(accion, vistaPrevia) {
  const { data, error } = await supabase.functions.invoke('avisos-auto', { body: { accion, vistaPrevia } })
  if (error) {
    let cuerpo = {}
    try { cuerpo = await error.context?.json() } catch { /* sin cuerpo */ }
    return { ok: false, message: MENSAJES_AUTO[cuerpo?.error] ?? 'No se pudieron procesar los avisos.' }
  }
  return data
}
