// Listas de asistencia por grupo + fecha, persistidas en Supabase
// (attendance_sessions + attendance_records). Reemplaza a attendanceHistory.js
// (localStorage). El cronómetro de tolerancia guarda marcas de tiempo reales
// (startedAt / pausedAt / pausedAccumMs) para que el tiempo transcurrido cuente
// aunque se cierre la pestaña o se retome la lista otro día.

import { supabase } from './supabaseClient'

export { todayISO } from './fecha'

/**
 * Segundos restantes de tolerancia, calculados sobre tiempo real transcurrido
 * (no un simple contador que se congela al salir de la página).
 */
export function remainingSeconds({ tolMin, startedAt, pausedAt, pausedAccumMs = 0 }) {
  if (tolMin == null || !startedAt) return null
  const now = pausedAt ?? Date.now()
  const elapsedMs = now - startedAt - pausedAccumMs
  return Math.max(0, tolMin * 60 - Math.floor(elapsedMs / 1000))
}

const labelFromTimestamp = ts =>
  ts ? new Date(ts).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : '—'

function rowToSession(row) {
  return {
    groupId: row.group_id,
    date: row.session_date,
    tolMin: row.tol_min,
    startedAt: row.started_at_ms != null ? Number(row.started_at_ms) : null,
    pausedAt: row.paused_at_ms != null ? Number(row.paused_at_ms) : null,
    pausedAccumMs: row.paused_accum_ms != null ? Number(row.paused_accum_ms) : 0,
    finished: !!row.finished,
    records: (row.attendance_records ?? []).map(r => ({
      studentId: r.student_id,
      time: r.arrival_label || labelFromTimestamp(r.scanned_at),
      retardo: r.status === 'tardanza',
    })),
  }
}

/** Sesión de un grupo+fecha con sus registros, o null si no existe. */
export async function loadSessionDb(groupId, date) {
  const { data, error } = await supabase
    .from('attendance_sessions')
    .select('*, attendance_records(student_id, status, arrival_label, scanned_at)')
    .eq('group_id', groupId)
    .eq('session_date', date)
    .maybeSingle()
  if (error) throw error
  return data ? rowToSession(data) : null
}

/** Todas las sesiones guardadas (con registros), más reciente primero. */
export async function fetchSessionIndex() {
  const { data, error } = await supabase
    .from('attendance_sessions')
    .select('*, attendance_records(student_id, status, arrival_label, scanned_at)')
    .order('session_date', { ascending: false })
  if (error) throw error
  return data.map(rowToSession)
}

/**
 * Guarda los CAMBIOS de la lista de un grupo+fecha (no la reemplaza):
 * `upserts` [{ studentId, time, retardo }] se agregan o actualizan y
 * `removes` [studentId] se quitan. Así dos dispositivos sobre la misma lista
 * no se pisan, y los registros que esta pantalla no conoce no se borran.
 */
export async function saveSessionDb(groupId, date, { tolMin, startedAt, pausedAt, pausedAccumMs, finished }, { upserts = [], removes = [] } = {}) {
  const { error } = await supabase.rpc('merge_attendance_list', {
    p_group_id: groupId,
    p_date: date,
    p_tol_min: tolMin ?? null,
    p_started_at_ms: startedAt ?? null,
    p_paused_at_ms: pausedAt ?? null,
    p_paused_accum_ms: pausedAccumMs ?? 0,
    p_finished: !!finished,
    p_upserts: upserts.map(r => ({
      student_id: r.studentId,
      status: r.retardo ? 'tardanza' : 'presente',
      time: r.time,
    })),
    p_removes: removes,
  })
  if (error) throw error
}

/**
 * Diferencias entre lo que hay en pantalla (`records`) y lo último que se
 * sabe guardado en la base (`servidor`: Map studentId → { time, retardo }).
 */
export function diffLista(records, servidor) {
  const actuales = new Map(records.map(r => [r.studentId, r]))
  const upserts = records.filter(r => {
    const s = servidor.get(r.studentId)
    return !s || s.time !== r.time || !!s.retardo !== !!r.retardo
  })
  const removes = [...servidor.keys()].filter(id => !actuales.has(id))
  return { upserts, removes }
}

/** Mensaje legible para los errores de las listas. */
export function mensajeErrorLista(err, porDefecto) {
  const m = err?.message ?? ''
  if (m.includes('solo_admin_borra_terminadas')) return 'Solo un administrador puede eliminar una lista terminada.'
  if (m.includes('forbidden')) return 'No tienes acceso a este grupo.'
  return porDefecto
}

/**
 * Crea (o renueva el token de) la sesión QR del día para un grupo.
 * Devuelve { id, token, expiresAt } — el token va embebido en el QR del salón.
 */
export async function createQrSession(groupId, date, ttlMinutes = 5) {
  const { data, error } = await supabase.rpc('create_attendance_session', {
    p_group_id: groupId,
    p_session_date: date,
    p_ttl_minutes: ttlMinutes,
  })
  if (error) throw error
  const row = data?.[0]
  return row ? { id: row.id, token: row.token, expiresAt: row.expires_at } : null
}

export async function deleteSessionDb(groupId, date) {
  const { error } = await supabase.rpc('delete_attendance_list', {
    p_group_id: groupId,
    p_date: date,
  })
  if (error) throw error
}
