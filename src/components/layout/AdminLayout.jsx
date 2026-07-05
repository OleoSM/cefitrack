import { useState, Suspense } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import LoadingPage from '../LoadingPage'
import { useAuth } from '../../context/AuthContext'
import {
  LayoutDashboard, CalendarCheck, Users, BookOpen,
  BrainCircuit, Upload, LogOut, GraduationCap, ClipboardList, Trophy,
  Bell, Menu, X, ChevronRight, ScrollText, TableProperties, SlidersHorizontal, Palette
} from 'lucide-react'
import clsx from 'clsx'

const nav = [
  { to:'/admin',              label:'Tablero',         icon:LayoutDashboard, exact:true },
  { to:'/admin/asistencias',  label:'Pasar Lista',     icon:CalendarCheck },
  { to:'/admin/grupos',       label:'Grupos',          icon:BookOpen },
  { to:'/admin/alumnos',      label:'Alumnos',         icon:Users },
  { to:'/admin/evaluaciones', label:'Evaluaciones',    icon:ClipboardList },
  { to:'/admin/rankings',     label:'Rankings',        icon:Trophy },
  { to:'/admin/ia',           label:'Análisis IA',     icon:BrainCircuit },
  { to:'/admin/importar',     label:'Importar',        icon:Upload },
  { to:'/admin/terminos',     label:'T&C / Firmas',    icon:ScrollText },
  { to:'/admin/registrar',    label:'Registrar',       icon:TableProperties },
  { to:'/admin/configuracion',label:'Configuración',   icon:SlidersHorizontal },
]

const ORIGINAL_BG = '#08080f'
const SIGA_BG      = 'linear-gradient(135deg, #0a1428 0%, #122343 55%, #1e3a6e 100%)'
const SIGA_THEME_KEY = 'siga_admin_theme'

const pageTitles = {
  '/admin':              'Tablero General',
  '/admin/asistencias':  'Pasar Lista',
  '/admin/grupos':       'Grupos',
  '/admin/alumnos':      'Alumnos',
  '/admin/evaluaciones': 'Evaluaciones',
  '/admin/rankings':     'Rankings',
  '/admin/ia':           'Análisis con IA',
  '/admin/importar':     'Importar Alumnos',
  '/admin/terminos':     'T&C y Firmas',
  '/admin/registrar':    'Registrar Grupo',
  '/admin/configuracion':'Configuración',
}

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sigaTheme, setSigaTheme] = useState(() => localStorage.getItem(SIGA_THEME_KEY) === '1')
  const { currentUser, logout } = useAuth()
  const navigate    = useNavigate()
  const { pathname } = useLocation()

  const handleLogout = () => { logout(); navigate('/login') }
  const closeSidebar  = () => setSidebarOpen(false)
  const toggleSigaTheme = () => {
    setSigaTheme(v => {
      localStorage.setItem(SIGA_THEME_KEY, v ? '0' : '1')
      return !v
    })
  }

  const pageTitle = Object.entries(pageTitles)
    .sort((a, b) => b[0].length - a[0].length)
    .find(([k]) => pathname.startsWith(k))?.[1] ?? 'SIGA CEFIMAT'

  const initials = currentUser?.name.split(' ').slice(0, 2).map(n => n[0]).join('') ?? 'PS'

  return (
    <div className="flex h-screen overflow-hidden transition-[background] duration-500"
      style={{ background: sigaTheme ? SIGA_BG : ORIGINAL_BG }}>

      {/* ── Mobile overlay ───────────────────────────────────── */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={closeSidebar} />
      )}

      {/* ── Sidebar ──────────────────────────────────────────── */}
      <aside className={clsx(
        'fixed inset-y-0 left-0 z-50 w-64 flex flex-col transition-transform duration-300 ease-in-out',
        'lg:static lg:translate-x-0 lg:z-auto lg:flex-shrink-0',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      )}
        style={{
          background: 'rgba(5,5,10,.82)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderRight: '1px solid rgba(255,255,255,.07)',
        }}>

        {/* Subtle noise texture */}
        <div className="absolute inset-0 opacity-[0.025] pointer-events-none"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }} />

        {/* Logo area */}
        <div className="relative px-5 py-4 flex items-center gap-3">
          <div className="relative flex-shrink-0">
            <img src="/logo.jpeg" alt="SIGA CEFIMAT"
              className="w-9 h-9 rounded-full object-cover"
              style={{ border:'1px solid rgba(255,255,255,.18)', boxShadow:'0 0 12px rgba(161,28,51,.25)' }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-sm leading-none tracking-tight">SIGA <span className="text-crimson-400">CEFIMAT</span></p>
            <p className="text-[10px] mt-0.5 font-medium" style={{ color:'rgba(255,255,255,.28)' }}>Gestión Académica</p>
          </div>
          <button onClick={closeSidebar} aria-label="Cerrar menú"
            className="lg:hidden p-1 rounded-lg transition-colors"
            style={{ color:'rgba(255,255,255,.35)' }}
            onMouseEnter={e => { e.currentTarget.style.color='rgba(255,255,255,.80)'; e.currentTarget.style.background='rgba(255,255,255,.07)' }}
            onMouseLeave={e => { e.currentTarget.style.color='rgba(255,255,255,.35)'; e.currentTarget.style.background='transparent' }}>
            <X size={17} />
          </button>
        </div>

        {/* Divider */}
        <div className="mx-5 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

        {/* Nav */}
        <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto" aria-label="Navegación principal">
          <p className="text-[10px] font-bold uppercase tracking-widest px-3 mb-2.5"
            style={{ color:'rgba(255,255,255,.22)' }}>
            Gestión
          </p>
          {nav.map(({ to, label, icon: Icon, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              onClick={closeSidebar}
              className={({ isActive }) => clsx(
                'nav-item group relative',
                isActive
                  ? 'text-white'
                  : 'text-slate-400 hover:text-white'
              )}
            >
              {({ isActive }) => (
                <>
                  {/* Active background */}
                  {isActive && (
                    <span className="absolute inset-0 rounded-xl pointer-events-none"
                      style={{ background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.1)' }} />
                  )}
                  {/* Crimson left bar (marca SIGA) */}
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-crimson-500 rounded-r-full" />
                  )}
                  <Icon size={17} className="flex-shrink-0 relative z-10" />
                  <span className="flex-1 text-sm font-medium relative z-10">{label}</span>
                  <ChevronRight size={13}
                    className={clsx(
                      'relative z-10 transition-all duration-200',
                      isActive ? 'opacity-60 text-crimson-400' : 'opacity-0 group-hover:opacity-30'
                    )} />
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Divider */}
        <div className="mx-5 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

        {/* User footer */}
        <div className="relative px-3 py-3">
          <div className="flex items-center gap-3 px-2 py-2 rounded-xl transition-colors"
            onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,.05)'}
            onMouseLeave={e => e.currentTarget.style.background='transparent'}>
            <div className="relative flex-shrink-0">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold"
                style={{ background:'rgba(255,255,255,.15)', border:'1px solid rgba(255,255,255,.18)' }}>
                {initials}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full transition-colors duration-500"
                style={{ border: `2px solid ${sigaTheme ? '#0a1428' : ORIGINAL_BG}` }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-semibold truncate leading-none">{currentUser?.name}</p>
              <p className="text-[10px] mt-0.5 font-medium" style={{ color:'rgba(255,255,255,.28)' }}>Docente · Admin</p>
            </div>
            <button onClick={handleLogout} title="Cerrar sesión" aria-label="Cerrar sesión"
              className="p-1.5 rounded-lg transition-colors"
              style={{ color:'rgba(255,255,255,.30)' }}
              onMouseEnter={e => { e.currentTarget.style.color='rgba(248,113,113,.9)'; e.currentTarget.style.background='rgba(239,68,68,.10)' }}
              onMouseLeave={e => { e.currentTarget.style.color='rgba(255,255,255,.30)'; e.currentTarget.style.background='transparent' }}>
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main area ────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Topbar */}
        <header className="flex-shrink-0 px-4 sm:px-6 h-14 flex items-center justify-between gap-3 flex-shrink-0"
          style={{
            background: 'rgba(8,8,15,.80)',
            backdropFilter: 'blur(12px)',
            borderBottom: '1px solid rgba(255,255,255,.07)',
          }}>

          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => setSidebarOpen(true)} aria-label="Abrir menú"
              className="lg:hidden p-2 rounded-xl transition-colors active:scale-95"
              style={{ color: 'rgba(255,255,255,.55)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.07)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <Menu size={19} />
            </button>
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[11px] font-medium hidden sm:block" style={{ color: 'rgba(255,255,255,.30)' }}>SIGA CEFIMAT</span>
              <ChevronRight size={12} className="hidden sm:block flex-shrink-0" style={{ color: 'rgba(255,255,255,.20)' }} />
              <h1 className="text-sm font-bold truncate" style={{ color: 'rgba(255,255,255,.85)' }}>{pageTitle}</h1>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Apagador: tema SIGA (navy/carmesí) vs. tema original */}
            <button onClick={toggleSigaTheme} role="switch" aria-checked={sigaTheme}
              title={sigaTheme ? 'Tema SIGA activado — clic para volver al original' : 'Activar tema SIGA'}
              className="flex items-center gap-2 pl-2.5 pr-1 py-1 rounded-full transition-colors active:scale-95"
              style={{
                background: sigaTheme ? 'rgba(161,28,51,.14)' : 'rgba(255,255,255,.06)',
                border: `1px solid ${sigaTheme ? 'rgba(161,28,51,.35)' : 'rgba(255,255,255,.12)'}`,
              }}>
              <Palette size={13} className="hidden sm:block" style={{ color: sigaTheme ? '#e0829a' : 'rgba(255,255,255,.40)' }} />
              <span className="text-[11px] font-bold hidden sm:block" style={{ color: sigaTheme ? '#e0829a' : 'rgba(255,255,255,.40)' }}>
                SIGA
              </span>
              <span className="relative inline-flex w-8 h-[18px] rounded-full transition-colors duration-200"
                style={{ background: sigaTheme ? 'linear-gradient(90deg, #1e3a6e, #a11c33)' : 'rgba(255,255,255,.13)' }}>
                <span className="absolute top-[2px] left-[2px] w-[14px] h-[14px] rounded-full bg-white transition-transform duration-200"
                  style={{ transform: sigaTheme ? 'translateX(16px)' : 'translateX(0)' }} />
              </span>
            </button>

            <button aria-label="Notificaciones"
              className="relative p-2 rounded-xl transition-colors active:scale-95"
              style={{ color: 'rgba(255,255,255,.40)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.07)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <Bell size={17} />
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-400 rounded-full" aria-hidden />
            </button>

            <div className="flex items-center gap-2.5 pl-2" style={{ borderLeft: '1px solid rgba(255,255,255,.08)' }}>
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold"
                style={{ background: 'rgba(255,255,255,.12)', border: '1px solid rgba(255,255,255,.15)' }}>
                {initials}
              </div>
              <span className="text-sm font-semibold hidden md:block" style={{ color: 'rgba(255,255,255,.70)' }}>
                {currentUser?.name.split(' ').slice(0, 2).join(' ')}
              </span>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-5 lg:p-6 pb-6">
          <Suspense fallback={<LoadingPage />}>
            <div key={pathname} className="animate-page-in">
              <Outlet />
            </div>
          </Suspense>
        </main>
      </div>
    </div>
  )
}
