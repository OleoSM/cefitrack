// Histórico de listas de asistencia por grupo + fecha, persistido en localStorage.
// Cada sesión guarda su propio cronómetro de tolerancia con marcas de tiempo reales
// (startedAt / pausedAt / pausedAccumMs) para que el tiempo transcurrido cuente
// aunque se cierre la pestaña o se retome la lista otro día.

const PREFIX = 'edutrack_att_'
const sessionKey = (groupId, date) => `${PREFIX}${groupId}_${date}`
const indexKey   = groupId => `${PREFIX}index_${groupId}`

export const todayISO = () => new Date().toISOString().split('T')[0]

function loadIndex(groupId) {
  try { return JSON.parse(localStorage.getItem(indexKey(groupId)) || '[]') } catch { return [] }
}

export function loadSession(groupId, date) {
  try { return JSON.parse(localStorage.getItem(sessionKey(groupId, date)) || 'null') } catch { return null }
}

export function saveSession(groupId, date, data) {
  localStorage.setItem(sessionKey(groupId, date), JSON.stringify({ ...data, groupId, date }))
  const idx = new Set(loadIndex(groupId))
  idx.add(date)
  localStorage.setItem(indexKey(groupId), JSON.stringify([...idx]))
}

export function deleteSession(groupId, date) {
  localStorage.removeItem(sessionKey(groupId, date))
  localStorage.setItem(indexKey(groupId), JSON.stringify(loadIndex(groupId).filter(d => d !== date)))
}

/** Lista de sesiones guardadas para un grupo, más reciente primero. */
export function listSessions(groupId) {
  return loadIndex(groupId)
    .map(date => loadSession(groupId, date))
    .filter(Boolean)
    .sort((a, b) => b.date.localeCompare(a.date))
}

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
