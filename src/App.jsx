import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'

import Login from './pages/Login'
import AdminLayout from './components/layout/AdminLayout'
import StudentLayout from './components/layout/StudentLayout'

import Dashboard      from './pages/admin/Dashboard'
import Attendance     from './pages/admin/Attendance'
import QRScanner      from './pages/admin/QRScanner'
import SessionQR      from './pages/admin/SessionQR'
import Groups         from './pages/admin/Groups'
import GroupDetail    from './pages/admin/GroupDetail'
import Students       from './pages/admin/Students'
import StudentProfile from './pages/admin/StudentProfile'
import Evaluations    from './pages/admin/Evaluations'
import Rankings       from './pages/admin/Rankings'
import AIInsights     from './pages/admin/AIInsights'
import ImportStudents from './pages/admin/ImportStudents'

import StudentDashboard from './pages/student/Dashboard'
import MyGrades         from './pages/student/MyGrades'
import MyAttendance     from './pages/student/MyAttendance'
import AIReport         from './pages/student/AIReport'
import MyQR             from './pages/student/MyQR'
import ScanQR           from './pages/student/ScanQR'

function ProtectedAdmin({ children }) {
  const { currentUser } = useAuth()
  if (!currentUser) return <Navigate to="/login" replace />
  if (currentUser.role !== 'admin') return <Navigate to="/student" replace />
  return children
}

function ProtectedStudent({ children }) {
  const { currentUser } = useAuth()
  if (!currentUser) return <Navigate to="/login" replace />
  if (currentUser.role === 'admin') return <Navigate to="/admin" replace />
  return children
}

function RootRedirect() {
  const { currentUser } = useAuth()
  if (!currentUser) return <Navigate to="/login" replace />
  return currentUser.role === 'admin'
    ? <Navigate to="/admin" replace />
    : <Navigate to="/student" replace />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<RootRedirect />} />

          {/* ── Admin ──────────────────────────────────────── */}
          <Route path="/admin" element={
            <ProtectedAdmin><AdminLayout /></ProtectedAdmin>
          }>
            <Route index element={<Dashboard />} />
            <Route path="asistencias"          element={<Attendance />} />
            <Route path="asistencias/qr"       element={<QRScanner />} />
            <Route path="asistencias/qr-sesion" element={<SessionQR />} />
            <Route path="grupos"             element={<Groups />} />
            <Route path="grupos/:groupId"    element={<GroupDetail />} />
            <Route path="alumnos"            element={<Students />} />
            <Route path="alumnos/:studentId" element={<StudentProfile />} />
            <Route path="evaluaciones"       element={<Evaluations />} />
            <Route path="rankings"           element={<Rankings />} />
            <Route path="ia"                 element={<AIInsights />} />
            <Route path="importar"           element={<ImportStudents />} />
          </Route>

          {/* ── Alumno / Tutor (misma vista) ────────────────── */}
          <Route path="/student" element={
            <ProtectedStudent><StudentLayout /></ProtectedStudent>
          }>
            <Route index element={<StudentDashboard />} />
            <Route path="calificaciones" element={<MyGrades />} />
            <Route path="asistencias"   element={<MyAttendance />} />
            <Route path="reporte-ia"    element={<AIReport />} />
            <Route path="mi-qr"         element={<MyQR />} />
            <Route path="escanear-qr"   element={<ScanQR />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
