import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'

import Login        from './pages/Login'
import AdminLayout  from './components/layout/AdminLayout'
import StudentLayout from './components/layout/StudentLayout'
import LoadingPage  from './components/LoadingPage'

/* ── Admin pages (lazy) ──────────────────────────────────── */
const Dashboard      = lazy(() => import('./pages/admin/Dashboard'))
const Attendance     = lazy(() => import('./pages/admin/Attendance'))
const QRScanner      = lazy(() => import('./pages/admin/QRScanner'))
const SessionQR      = lazy(() => import('./pages/admin/SessionQR'))
const Groups         = lazy(() => import('./pages/admin/Groups'))
const GroupDetail    = lazy(() => import('./pages/admin/GroupDetail'))
const Students       = lazy(() => import('./pages/admin/Students'))
const StudentProfile = lazy(() => import('./pages/admin/StudentProfile'))
const Evaluations    = lazy(() => import('./pages/admin/Evaluations'))
const Rankings       = lazy(() => import('./pages/admin/Rankings'))
const AIInsights     = lazy(() => import('./pages/admin/AIInsights'))
const ImportStudents = lazy(() => import('./pages/admin/ImportStudents'))

/* ── Student pages (lazy) ────────────────────────────────── */
const StudentDashboard = lazy(() => import('./pages/student/Dashboard'))
const MyGrades         = lazy(() => import('./pages/student/MyGrades'))
const MyAttendance     = lazy(() => import('./pages/student/MyAttendance'))
const AIReport         = lazy(() => import('./pages/student/AIReport'))
const MyQR             = lazy(() => import('./pages/student/MyQR'))
const ScanQR           = lazy(() => import('./pages/student/ScanQR'))
const Terms            = lazy(() => import('./pages/student/Terms'))
const StudentSettings  = lazy(() => import('./pages/student/Settings'))
const TermsManager     = lazy(() => import('./pages/admin/TermsManager'))
const Registrar        = lazy(() => import('./pages/admin/Registrar'))
const Settings         = lazy(() => import('./pages/admin/Settings'))
const AccesoDisposicion = lazy(() => import('./pages/admin/AccesoDisposicion'))

const ADMIN_ROLES = ['admin', 'sub_admin']

/* ── Route guards ────────────────────────────────────────── */
function ProtectedAdmin({ children }) {
  const { currentUser } = useAuth()
  if (!currentUser) return <Navigate to="/login" replace />
  if (!ADMIN_ROLES.includes(currentUser.role)) return <Navigate to="/student" replace />
  return children
}

function ProtectedStudent({ children }) {
  const { currentUser } = useAuth()
  if (!currentUser) return <Navigate to="/login" replace />
  if (ADMIN_ROLES.includes(currentUser.role)) return <Navigate to="/admin" replace />
  return children
}

function RootRedirect() {
  const { currentUser } = useAuth()
  if (!currentUser) return <Navigate to="/login" replace />
  return ADMIN_ROLES.includes(currentUser.role)
    ? <Navigate to="/admin" replace />
    : <Navigate to="/student" replace />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={
          <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
            <LoadingPage />
          </div>
        }>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<RootRedirect />} />

            {/* ── Admin ──────────────────────────────────────── */}
            <Route path="/admin" element={
              <ProtectedAdmin><AdminLayout /></ProtectedAdmin>
            }>
              <Route index                        element={<Dashboard />} />
              <Route path="asistencias"           element={<Attendance />} />
              <Route path="asistencias/qr"        element={<QRScanner />} />
              <Route path="asistencias/qr-sesion" element={<SessionQR />} />
              <Route path="grupos"                element={<Groups />} />
              <Route path="grupos/:groupId"       element={<GroupDetail />} />
              <Route path="alumnos"               element={<Students />} />
              <Route path="alumnos/:studentId"    element={<StudentProfile />} />
              <Route path="evaluaciones"          element={<Evaluations />} />
              <Route path="rankings"              element={<Rankings />} />
              <Route path="ia"                    element={<AIInsights />} />
              <Route path="importar"              element={<ImportStudents />} />
              <Route path="terminos"              element={<TermsManager />} />
              <Route path="registrar"             element={<Registrar />} />
              <Route path="configuracion"         element={<Settings />} />
              <Route path="configuracion/acceso"  element={<AccesoDisposicion />} />
            </Route>

            {/* ── Alumno ─────────────────────────────────────── */}
            <Route path="/student" element={
              <ProtectedStudent><StudentLayout /></ProtectedStudent>
            }>
              <Route index                          element={<StudentDashboard />} />
              <Route path="calificaciones"          element={<MyGrades />} />
              <Route path="asistencias"             element={<MyAttendance />} />
              <Route path="reporte-ia"              element={<AIReport />} />
              <Route path="mi-qr"                   element={<MyQR />} />
              <Route path="escanear-qr"             element={<ScanQR />} />
              <Route path="terminos"               element={<Terms />} />
              <Route path="configuracion"          element={<StudentSettings />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  )
}
