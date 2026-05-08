import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { LayoutDashboard, BookOpen, CalendarCheck, BrainCircuit, QrCode, LogOut, GraduationCap } from 'lucide-react'
import { getStudentById, groups } from '../../data/mockData'
import clsx from 'clsx'

const nav = [
  { to:'/student',               label:'Mi Panel',        icon:LayoutDashboard, exact:true },
  { to:'/student/calificaciones',label:'Calificaciones',  icon:BookOpen },
  { to:'/student/asistencias',   label:'Asistencias',     icon:CalendarCheck },
  { to:'/student/reporte-ia',    label:'Reporte IA',      icon:BrainCircuit },
  { to:'/student/mi-qr',         label:'Mi Código QR',    icon:QrCode },
]

export default function StudentLayout() {
  const { currentUser, logout } = useAuth()
  const navigate = useNavigate()
  const student = getStudentById(currentUser?.studentId)
  const grp = groups.find(g => g.id === student?.groupId)
  const initials = student?.name.split(' ').slice(0,2).map(n=>n[0]).join('') ?? 'AL'

  const handleLogout = () => { logout(); navigate('/login') }

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-60 flex-shrink-0 bg-navy-900 flex flex-col">
        <div className="px-5 py-5 border-b border-navy-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gold-500 flex items-center justify-center">
              <GraduationCap size={20} className="text-white" />
            </div>
            <div>
              <p className="text-white font-bold text-base leading-none">EduTrack</p>
              <p className="text-navy-400 text-[10px] mt-0.5">Vista Alumno</p>
            </div>
          </div>
        </div>

        {student && (
          <div className="mx-3 mt-3 p-3 rounded-lg bg-navy-800">
            <p className="text-navy-400 text-[10px] uppercase font-semibold tracking-wider mb-1">Alumno</p>
            <p className="text-white text-sm font-semibold leading-tight">{student.name}</p>
            <p className="text-navy-400 text-xs mt-0.5">{grp?.name} — {grp?.subject}</p>
          </div>
        )}

        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {nav.map(({ to, label, icon: Icon, exact }) => (
            <NavLink key={to} to={to} end={exact}
              className={({ isActive }) => clsx(
                'nav-item',
                isActive
                  ? 'bg-navy-800 text-white border-l-2 border-gold-400 pl-[10px]'
                  : 'text-navy-300 hover:bg-navy-800 hover:text-white border-l-2 border-transparent pl-[10px]'
              )}
            >
              <Icon size={17} />
              <span className="text-sm">{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="px-3 py-3 border-t border-navy-800">
          <div className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-navy-800 transition-colors">
            <div className="w-8 h-8 rounded-full bg-gold-500 flex items-center justify-center text-white text-xs font-bold">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-semibold truncate">{student?.name ?? currentUser?.name}</p>
              <p className="text-navy-400 text-[10px]">Solo lectura</p>
            </div>
            <button onClick={handleLogout} className="text-navy-400 hover:text-red-400 transition-colors p-1">
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>

      {/* Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="bg-white border-b border-slate-200 px-6 h-14 flex items-center">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            Vista de alumno — solo lectura
          </span>
        </header>
        <main className="flex-1 overflow-y-auto p-6">
          <div className="animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
