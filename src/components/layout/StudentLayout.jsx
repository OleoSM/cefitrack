import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { LayoutDashboard, BookOpen, CalendarCheck, BrainCircuit, QrCode, LogOut, GraduationCap, Menu, X } from 'lucide-react'
import { getStudentById, groups } from '../../data/mockData'
import { useState } from 'react'
import clsx from 'clsx'

const nav = [
  { to:'/student',                label:'Mi Panel',       icon:LayoutDashboard, exact:true },
  { to:'/student/calificaciones', label:'Calificaciones', icon:BookOpen },
  { to:'/student/asistencias',    label:'Asistencias',    icon:CalendarCheck },
  { to:'/student/reporte-ia',     label:'Reporte IA',     icon:BrainCircuit },
  { to:'/student/mi-qr',          label:'Mi QR',          icon:QrCode },
]

export default function StudentLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { currentUser, logout } = useAuth()
  const navigate = useNavigate()
  const student  = getStudentById(currentUser?.studentId)
  const grp      = groups.find(g => g.id === student?.groupId)
  const initials = student?.name.split(' ').slice(0, 2).map(n => n[0]).join('') ?? 'AL'

  const handleLogout = () => { logout(); navigate('/login') }
  const closeSidebar  = () => setSidebarOpen(false)

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden">

      {/* ── Mobile overlay ───────────────────────────────────── */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={closeSidebar} />
      )}

      {/* ── Sidebar (desktop always visible, mobile drawer) ──── */}
      <aside className={clsx(
        'fixed inset-y-0 left-0 z-50 w-60 bg-navy-900 flex flex-col transition-transform duration-300 ease-in-out',
        'lg:static lg:translate-x-0 lg:z-auto lg:flex-shrink-0',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        {/* Logo + close */}
        <div className="px-5 py-5 border-b border-navy-800 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gold-500 flex items-center justify-center flex-shrink-0">
            <GraduationCap size={20} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-base leading-none">EduTrack</p>
            <p className="text-navy-400 text-[10px] mt-0.5">Vista Alumno</p>
          </div>
          <button onClick={closeSidebar} className="lg:hidden text-navy-400 hover:text-white transition-colors p-1 rounded">
            <X size={18} />
          </button>
        </div>

        {student && (
          <div className="mx-3 mt-3 p-3 rounded-lg bg-navy-800">
            <p className="text-navy-400 text-[10px] uppercase font-semibold tracking-wider mb-1">Alumno</p>
            <p className="text-white text-sm font-semibold leading-tight">{student.name}</p>
            <p className="text-navy-400 text-xs mt-0.5">{grp?.name} — {grp?.subject}</p>
          </div>
        )}

        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {nav.map(({ to, label, icon: Icon, exact }) => (
            <NavLink key={to} to={to} end={exact} onClick={closeSidebar}
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
            <div className="w-8 h-8 rounded-full bg-gold-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
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

      {/* ── Main area ────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Top header */}
        <header className="bg-white border-b border-slate-200 px-4 sm:px-6 h-14 flex items-center justify-between gap-3 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {/* Hamburger — mobile only */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-600 flex-shrink-0"
            >
              <Menu size={20} />
            </button>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 truncate">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
              <span className="truncate hidden sm:inline">Vista de alumno — solo lectura</span>
              <span className="truncate sm:hidden">Solo lectura</span>
            </span>
          </div>

          {/* Avatar + logout on mobile */}
          <div className="flex items-center gap-2 lg:hidden">
            <div className="w-7 h-7 rounded-full bg-gold-500 flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0">
              {initials}
            </div>
            <button onClick={handleLogout} className="text-slate-400 hover:text-red-500 transition-colors p-1">
              <LogOut size={16} />
            </button>
          </div>
        </header>

        {/* Scrollable content — bottom padding for mobile bottom nav */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-5 lg:p-6 pb-20 lg:pb-6">
          <div className="animate-fade-in">
            <Outlet />
          </div>
        </main>

        {/* ── Bottom nav (mobile only) ─────────────────────── */}
        <nav className="lg:hidden fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 z-30 flex">
          {nav.map(({ to, label, icon: Icon, exact }) => (
            <NavLink key={to} to={to} end={exact}
              className={({ isActive }) => clsx(
                'flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors text-[10px] font-medium',
                isActive ? 'text-navy-900' : 'text-slate-400 hover:text-slate-600'
              )}
            >
              {({ isActive }) => (
                <>
                  <Icon size={20} strokeWidth={isActive ? 2.5 : 1.8} />
                  <span>{label}</span>
                  {isActive && <span className="absolute bottom-0 w-6 h-0.5 bg-gold-500 rounded-t-full" />}
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}
