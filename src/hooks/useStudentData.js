// Datos reales del alumno logueado (student + group + asistencia) desde Supabase.
// Sustituye a getStudentById/getGroupById de mockData en el portal del alumno.
import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { fetchStudentById, fetchGroupById, fetchStudentAttendance } from '../lib/supabaseData'

export function useStudentData({ withAttendance = false } = {}) {
  const { currentUser } = useAuth()
  const studentId = currentUser?.studentId
  const [student, setStudent] = useState(null)
  const [group, setGroup] = useState(null)
  const [attendance, setAttendance] = useState([])
  const [loading, setLoading] = useState(!!studentId)

  useEffect(() => {
    if (!studentId) { setLoading(false); return }
    let alive = true
    setLoading(true)
    fetchStudentById(studentId)
      .then(async s => {
        if (!alive) return
        setStudent(s)
        const [g, att] = await Promise.all([
          fetchGroupById(s?.groupId),
          withAttendance ? fetchStudentAttendance(studentId, s?.groupId) : Promise.resolve([]),
        ])
        if (!alive) return
        setGroup(g)
        setAttendance(att)
      })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [studentId, withAttendance])

  return { student, setStudent, group, attendance, loading }
}
