// Listas de asistencia por grupo + fecha, persistidas en Supabase
// (attendance_sessions + attendance_records). Reemplaza a attendanceHistory.js
// (localStorage). El cronómetro de tolerancia guarda marcas de tiempo reales
// (startedAt / pausedAt / pausedAccumMs) para que el tiempo transcurrido cuente
// aunque se cierre la pestaña o se retome la lista otro día.

import { supabase } from './supabaseClient'

export const todayISO = () => new Date().toISOString().split('T')[0]

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
 * Guarda (upsert) la lista completa de un grupo+fecha.
 * `records`: [{ studentId, time, retardo }]
 */
export async function saveSessionDb(groupId, date, { tolMin, startedAt, pausedAt, pausedAccumMs, finished }, records) {
  const { error } = await supabase.rpc('upsert_attendance_list', {
    p_group_id: groupId,
    p_date: date,
    p_tol_min: tolMin ?? null,
    p_started_at_ms: startedAt ?? null,
    p_paused_at_ms: pausedAt ?? null,
    p_paused_accum_ms: pausedAccumMs ?? 0,
    p_finished: !!finished,
    p_records: records.map(r => ({
      student_id: r.studentId,
      status: r.retardo ? 'tardanza' : 'presente',
      time: r.time,
    })),
  })
  if (error) throw error
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
