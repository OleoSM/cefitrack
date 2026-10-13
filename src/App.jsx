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
const Groups         = lazy(() => import('./pages/admin/Groups'))
const GroupDetail    = lazy(() => import('./pages/admin/GroupDetail'))
const Students       = lazy(() => import('./pages/admin/Students'))
const StudentProfile = lazy(() => import('./pages/admin/StudentProfile'))
const Evaluations    = lazy(() => import('./pages/admin/Evaluations'))
const Rankings       = lazy(() => import('./pages/admin/Rankings'))

/* ── Student pages (lazy) ────────────────────────────────── */
const StudentDashboard = lazy(() => import('./pages/student/Dashboard'))
const MyGrades         = lazy(() => import('./pages/student/MyGrades'))
const MyAttendance     = lazy(() => import('./pages/student/MyAttendance'))
const MyQR             = lazy(() => import('./pages/student/MyQR'))
const MisMateriales    = lazy(() => import('./pages/student/MisMateriales'))
const Materiales       = lazy(() => import('./pages/admin/Materiales'))
const Terms            = lazy(() => import('./pages/student/Terms'))
const StudentSettings  = lazy(() => import('./pages/student/Settings'))
const TermsManager     = lazy(() => import('./pages/admin/TermsManager'))
const Registrar        = lazy(() => import('./pages/admin/Registrar'))
const Settings         = lazy(() => import('./pages/admin/Settings'))
const AccesoDisposicion = lazy(() => import('./pages/admin/AccesoDisposicion'))
const Pagos            = lazy(() => import('./pages/admin/Pagos'))
const EnviarCorreos    = lazy(() => import('./pages/admin/EnviarCorreos'))

const ADMIN_ROLES = ['admin', 'sub_admin']

/* ── Route guards ────────────────────────────────────────── */
function ProtectedAdmin({ children }) {
  const { currentUser } = useAuth()
  if (!currentUser) return <Navigate to="/login" replace />
  if (!ADMIN_ROLES.includes(currentUser.role)) return <Navigate to="/student" replace />
  return children
}

/* Apartados que un admin abre o cierra a cada sub-admin. Entrar por URL a uno
   cerrado devuelve al Dashboard, que avisa de por qué. */
function Apartado({ clave, children }) {
  const { puedeVer } = useAuth()
  return puedeVer(clave) ? children : <Navigate to="/admin" replace state={{ apartadoBloqueado: clave }} />
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
      <BrowserRouter future={{ v7_startTransition:true, v7_relativeSplatPath:true }}>
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
              <Route path="asistencias"           element={<Apartado clave="asistencias"><Attendance /></Apartado>} />
              <Route path="grupos"                element={<Apartado clave="grupos"><Groups /></Apartado>} />
              <Route path="grupos/:groupId"       element={<Apartado clave="grupos"><GroupDetail /></Apartado>} />
              <Route path="alumnos"               element={<Apartado clave="alumnos"><Students /></Apartado>} />
              <Route path="alumnos/:studentId"    element={<Apartado clave="alumnos"><StudentProfile /></Apartado>} />
              <Route path="evaluaciones"          element={<Apartado clave="evaluaciones"><Evaluations /></Apartado>} />
              <Route path="materiales"            element={<Apartado clave="materiales"><Materiales /></Apartado>} />
              <Route path="rankings"              element={<Apartado clave="rankings"><Rankings /></Apartado>} />
              <Route path="terminos"              element={<Apartado clave="terminos"><TermsManager /></Apartado>} />
              <Route path="registrar"             element={<Apartado clave="calificaciones"><Registrar /></Apartado>} />
              <Route path="pagos"                 element={<Apartado clave="pagos"><Pagos /></Apartado>} />
              <Route path="correos"               element={<Apartado clave="correos"><EnviarCorreos /></Apartado>} />
              <Route path="configuracion"         element={<Apartado clave="configuracion"><Settings /></Apartado>} />
              <Route path="configuracion/acceso"  element={<AccesoDisposicion />} />
            </Route>

            {/* ── Alumno ─────────────────────────────────────── */}
            <Route path="/student" element={
              <ProtectedStudent><StudentLayout /></ProtectedStudent>
            }>
              <Route index                          element={<StudentDashboard />} />
              <Route path="calificaciones"          element={<MyGrades />} />
              <Route path="asistencias"             element={<MyAttendance />} />
              <Route path="mi-qr"                   element={<MyQR />} />
              <Route path="materiales"              element={<MisMateriales />} />
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
