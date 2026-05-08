import { useState } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  LayoutDashboard, CalendarCheck, Users, BookOpen,
  BrainCircuit, Upload, LogOut, GraduationCap, ClipboardList, Trophy,
  ChevronRight, Bell, Menu, X
} from 'lucide-react'
import clsx from 'clsx'

const nav = [
  { to:'/admin',              label:'Tablero',         icon:LayoutDashboard, exact:true },
  { to:'/admin/asistencias',  label:'Pasar Lista',     icon:CalendarCheck },
  { to:'/admin/grupos',       label:'Grupos',          icon:BookOpen },
  { to:'/admin/alumnos',      label:'Alumnos',         icon:Users },
  { to:'/admin/evaluaciones', label:'Evaluaciones',    icon:ClipboardList },
  { to:'/admin/rankings',     label:'Rankings',        icon:Trophy },
  { to:'/admin/ia',           label:'Análisis con IA', icon:BrainCircuit },
  { to:'/admin/importar',     label:'Importar',        icon:Upload },
]

const pageTitles = {
  '/admin':              'Tablero General',
  '/admin/asistencias':  'Pasar Lista',
  '/admin/grupos':       'Grupos',
  '/admin/alumnos':      'Alumnos',
  '/admin/evaluaciones': 'Evaluaciones',
  '/admin/rankings':     'Rankings',
  '/admin/ia':           'Análisis con IA',
  '/admin/importar':     'Importar Alumnos',
}

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { currentUser, logout } = useAuth()
  const navigate  = useNavigate()
  const { pathname } = useLocation()

  const handleLogout = () => { logout(); navigate('/login') }
  const closeSidebar  = () => setSidebarOpen(false)

  const pageTitle = Object.entries(pageTitles)
    .sort((a, b) => b[0].length - a[0].length)
    .find(([k]) => pathname.startsWith(k))?.[1] ?? 'EduTrack'

  const initials = currentUser?.name.split(' ').slice(0, 2).map(n => n[0]).join('') ?? 'PS'

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden">

      {/* ── Mobile overlay backdrop ──────────────────────────── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* ── Sidebar ──────────────────────────────────────────── */}
      <aside className={clsx(
        'fixed inset-y-0 left-0 z-50 w-64 bg-navy-900 flex flex-col transition-transform duration-300 ease-in-out',
        'lg:static lg:translate-x-0 lg:z-auto lg:flex-shrink-0',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        {/* Logo + mobile close button */}
        <div className="px-5 py-5 border-b border-navy-800 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gold-500 flex items-center justify-center flex-shrink-0">
            <GraduationCap size={20} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-lg leading-none">EduTrack</p>
            <p className="text-navy-300 text-xs mt-0.5">Plataforma Educativa</p>
          </div>
          <button
            onClick={closeSidebar}
            className="lg:hidden text-navy-400 hover:text-white transition-colors p-1 rounded"
          >
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          <p className="text-navy-400 text-[10px] font-semibold uppercase tracking-widest px-3 mb-2">Gestión</p>
          {nav.map(({ to, label, icon: Icon, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              onClick={closeSidebar}
              className={({ isActive }) => clsx(
                'nav-item group',
                isActive
                  ? 'bg-navy-800 text-white border-l-2 border-gold-400 pl-[10px]'
                  : 'text-navy-300 hover:bg-navy-800 hover:text-white border-l-2 border-transparent pl-[10px]'
              )}
            >
              <Icon size={17} className="flex-shrink-0" />
              <span className="flex-1 text-sm">{label}</span>
              <ChevronRight size={14} className="opacity-0 group-hover:opacity-40 transition-opacity" />
            </NavLink>
          ))}
        </nav>

        {/* User footer */}
        <div className="px-3 py-3 border-t border-navy-800">
          <div className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-navy-800 transition-colors">
            <div className="w-8 h-8 rounded-full bg-gold-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-semibold truncate">{currentUser?.name}</p>
              <p className="text-navy-400 text-[10px] truncate">Docente</p>
            </div>
            <button onClick={handleLogout} title="Cerrar sesión"
              className="text-navy-400 hover:text-red-400 transition-colors p-1 rounded">
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main area ────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Topbar */}
        <header className="bg-white border-b border-slate-200 px-4 sm:px-6 h-14 flex items-center justify-between flex-shrink-0 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {/* Hamburger — mobile only */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-600 flex-shrink-0"
            >
              <Menu size={20} />
            </button>
            <h1 className="text-sm sm:text-base font-semibold text-slate-800 truncate">{pageTitle}</h1>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <button className="relative p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-500">
              <Bell size={18} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
            </button>
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <div className="w-7 h-7 rounded-full bg-navy-900 flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0">
                {initials}
              </div>
              <span className="font-medium hidden md:inline">{currentUser?.name.split(' ').slice(0, 2).join(' ')}</span>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-5 lg:p-6">
          <div className="animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
