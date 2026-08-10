// Datos reales del alumno logueado (student + group + asistencia + calificaciones)
// desde Supabase. Sustituye a getStudentById/getGroupById de mockData en el portal.
import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  fetchStudentById, fetchGroupById, fetchStudentAttendance, fetchEvaluationsByStudent,
} from '../lib/supabaseData'
import { supabase } from '../lib/supabaseClient'

// En StrictMode React monta, limpia y vuelve a montar los efectos. La baja de
// un canal Realtime es asíncrona, así que reutilizar inmediatamente el mismo
// topic puede devolver todavía el canal ya suscrito y `.on()` lanza error.
const realtimeInstance = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`

export function useStudentData({ withAttendance = false, withEvaluations = false } = {}) {
  const { currentUser } = useAuth()
  const studentId = currentUser?.studentId
  const [student, setStudent] = useState(null)
  const [group, setGroup] = useState(null)
  const [attendance, setAttendance] = useState([])
  const [evaluations, setEvaluations] = useState([])
  const [loading, setLoading] = useState(!!studentId)

  useEffect(() => {
    if (!studentId) { setLoading(false); return }
    let alive = true
    setLoading(true)
    fetchStudentById(studentId)
      .then(async s => {
        if (!alive) return
        setStudent(s)
        const [g, att, evs] = await Promise.all([
          fetchGroupById(s?.groupId),
          withAttendance ? fetchStudentAttendance(studentId, s?.groupId) : Promise.resolve([]),
          withEvaluations ? fetchEvaluationsByStudent(studentId) : Promise.resolve([]),
        ])
        if (!alive) return
        setGroup(g)
        setAttendance(att)
        setEvaluations(evs)
      })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [studentId, withAttendance, withEvaluations])

  // El expediente (tutor, teléfono, grupo, sucursal, firma y avatar) también
  // puede cambiar desde administración mientras el alumno tiene abierto el
  // portal. Se vuelve a leer la fila completa para no mezclar datos antiguos.
  useEffect(() => {
    if (!studentId) return
    let alive = true
    let timer
    const refreshProfile = () => {
      clearTimeout(timer)
      timer = setTimeout(async () => {
        try {
          const freshStudent = await fetchStudentById(studentId)
          const freshGroup = await fetchGroupById(freshStudent?.groupId)
          if (!alive) return
          setStudent(freshStudent)
          setGroup(freshGroup)
        } catch { /* conserva el último expediente completo válido */ }
      }, 150)
    }

    const channel = supabase.channel(`expediente-alumno-${studentId}-${realtimeInstance()}`)
      .on('postgres_changes', {
        event:'UPDATE', schema:'public', table:'students', filter:`id=eq.${studentId}`,
      }, refreshProfile)
      .on('postgres_changes', {
        event:'UPDATE', schema:'public', table:'groups',
      }, refreshProfile)
      .subscribe()

    return () => {
      alive = false
      clearTimeout(timer)
      supabase.removeChannel(channel)
    }
  }, [studentId])

  useEffect(() => {
    const groupId = student?.groupId
    if (!studentId || !groupId || (!withAttendance && !withEvaluations)) return
    let alive = true
    let timer

    const refresh = () => {
      clearTimeout(timer)
      timer = setTimeout(async () => {
        try {
          const [att, evs] = await Promise.all([
            withAttendance ? fetchStudentAttendance(studentId, groupId) : Promise.resolve(null),
            withEvaluations ? fetchEvaluationsByStudent(studentId) : Promise.resolve(null),
          ])
          if (!alive) return
          if (att) setAttendance(att)
          if (evs) setEvaluations(evs)
        } catch { /* conserva los últimos datos válidos y espera el siguiente evento */ }
      }, 200)
    }

    let channel = supabase.channel(`portal-alumno-${studentId}-${realtimeInstance()}`)
    if (withEvaluations) {
      channel = channel.on('postgres_changes', {
        event:'*', schema:'public', table:'evaluations', filter:`student_id=eq.${studentId}`,
      }, refresh)
    }
    if (withAttendance) {
      channel = channel
        .on('postgres_changes', { event:'*', schema:'public', table:'attendance_records' }, refresh)
        .on('postgres_changes', {
          event:'*', schema:'public', table:'attendance_sessions', filter:`group_id=eq.${groupId}`,
        }, refresh)
    }
    channel.subscribe()

    // Respaldo para ausencias: por RLS un alumno puede no recibir el registro
    // de otro compañero que convierte una sesión vacía en una lista capturada.
    const interval = withAttendance ? setInterval(refresh, 30000) : null
    return () => {
      alive = false
      clearTimeout(timer)
      if (interval) clearInterval(interval)
      supabase.removeChannel(channel)
    }
  }, [studentId, student?.groupId, withAttendance, withEvaluations])

  return { student, setStudent, group, attendance, evaluations, loading }
}
