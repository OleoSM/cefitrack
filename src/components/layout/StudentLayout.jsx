import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { LayoutDashboard, BookOpen, CalendarCheck, BrainCircuit, QrCode, LogOut, Menu, X, ChevronRight, ScrollText, Settings } from 'lucide-react'
import { useStudentData } from '../../hooks/useStudentData'
import { rutaAvatar } from '../../lib/avatares'
import { useState, useEffect, Suspense } from 'react'
import clsx from 'clsx'
import LoadingPage from '../LoadingPage'
import { StudentThemeProvider, useStudentTheme } from '../../context/StudentThemeContext'

const nav = [
  { to:'/student',                label:'Mi Panel',       icon:LayoutDashboard, exact:true },
  { to:'/student/calificaciones', label:'Calificaciones', icon:BookOpen },
  { to:'/student/asistencias',    label:'Asistencias',    icon:CalendarCheck },
  { to:'/student/reporte-ia',     label:'Reporte IA',     icon:BrainCircuit },
  { to:'/student/mi-qr',          label:'Mi QR',          icon:QrCode },
  { to:'/student/terminos',       label:'T&C / Firma',    icon:ScrollText, badge:'terms' },
  { to:'/student/configuracion',  label:'Configuración',  icon:Settings },
]

const GRID_OVERLAY = {
  backgroundImage: 'linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)',
  backgroundSize: '32px 32px',
}

function LayoutInner() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { pathname } = useLocation()
  const { currentUser, logout } = useAuth()
  const navigate = useNavigate()
  const { appearance, t } = useStudentTheme()
  const { student, group: grp } = useStudentData()
  const initials = student?.name.split(' ').slice(0, 2).map(n => n[0]).join('') ?? 'AL'

  const handleLogout = () => { logout(); navigate('/login') }
  const closeSidebar  = () => setSidebarOpen(false)

  /* El portal usaba var(--t1), var(--card-border)… sin publicarlas nunca: sólo
     ponía data-stheme. Esas variables caían a los valores de :root, que son los
     del tema OSCURO, así que en IPN y UNAM el texto salía claro sobre página
     blanca. Se publican igual que en AdminLayout, y también en <html> para que
     los modales renderizados por portal las hereden.

     Se emite además `data-theme-light`, el mismo atributo que usa el panel de
     administración: así los overrides de index.css (badges, tablas, paleta
     pastel) valen para las dos mitades de la aplicación en vez de sólo una. */
  const themeVars = {
    '--t1': t.t1, '--t2': t.t2, '--t3': t.t3, '--t4': t.t4,
    '--card-bg': t.cardBg, '--card-border': t.cardBorder,
    '--soft-bg': t.softBg, '--divider': t.divider,
    '--grid': t.grid, '--axis': t.axis,
    '--tooltip-bg': t.tooltipBg, '--tooltip-border': t.tooltipBorder, '--tooltip-text': t.tooltipText,
    '--accent': t.accent,
    '--panel-bg': t.panelBg, '--header-bg': t.headerBg,
    '--good': t.good, '--info': t.info, '--warn': t.warn, '--bad': t.bad,
    '--good-soft': t.goodSoft, '--info-soft': t.infoSoft,
    '--warn-soft': t.warnSoft, '--bad-soft': t.badSoft,
    '--good-line': t.goodLine, '--info-line': t.infoLine,
    '--warn-line': t.warnLine, '--bad-line': t.badLine,
    '--card-shadow': t.light
      ? '0 1px 2px rgba(15,23,42,.06), 0 4px 12px rgba(15,23,42,.08)'
      : 'none',
  }

  useEffect(() => {
    const root = document.documentElement
    Object.entries(themeVars).forEach(([k, v]) => root.style.setProperty(k, v))
    if (t.light) root.setAttribute('data-theme-light', '')
    else root.removeAttribute('data-theme-light')
    return () => {
      Object.keys(themeVars).forEach(k => root.style.removeProperty(k))
      root.removeAttribute('data-theme-light')
    }
  }, [appearance, t])

  // El sidebar siempre tiene fondo de color (oscuro/guinda/azul) → texto blanco
  const sideStyle = {
    background: t.sideBg,
    backdropFilter: t.light ? 'none' : 'blur(24px)',
    WebkitBackdropFilter: t.light ? 'none' : 'blur(24px)',
    borderRight: `1px solid ${t.sideBorder}`,
  }

  return (
    <div className="flex h-screen overflow-hidden transition-[background] duration-500"
      data-stheme={appearance}
      data-theme={appearance}
      {...(t.light ? { 'data-stheme-light': '', 'data-theme-light': '' } : {})}
      style={{ background: t.mainBg, backgroundImage: t.mainBgImage, ...themeVars }}>

      {/* Mobile overlay (fondo difuminado, se ve tras el sidebar) */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-md lg:hidden" onClick={closeSidebar} />
      )}

      {/* Sidebar */}
      <aside className={clsx(
        'fixed inset-y-0 left-0 z-50 w-[86vw] max-w-[300px] flex flex-col transition-transform duration-300 ease-in-out',
        'lg:static lg:w-60 lg:max-w-none lg:translate-x-0 lg:z-auto lg:flex-shrink-0',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      )} style={sideStyle}>

        {/* Grid decoration */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={GRID_OVERLAY} />

        {/* Logo + close */}
        <div className="relative px-5 py-5 flex items-center gap-3">
          <img src="/logo.jpeg" alt="SIGA CEFIMAT"
            className="w-9 h-9 rounded-full object-cover flex-shrink-0"
            style={{ border:'1px solid rgba(255,255,255,.25)', boxShadow: t.light ? '0 2px 10px rgba(0,0,0,.25)' : '0 0 12px rgba(161,28,51,.25)' }} />
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-base leading-none tracking-tight">
              SIGA <span style={{ color: appearance === 'unam' ? '#CC9933' : appearance === 'ipn' ? '#f3c9d1' : '#c95f72' }}>CEFIMAT</span>
            </p>
            <p className="text-[10px] mt-0.5 font-medium" style={{ color: t.sideT3 }}>Vista Alumno</p>
          </div>
          <button onClick={closeSidebar} aria-label="Cerrar menú"
            className="lg:hidden p-1 rounded-lg transition-colors text-white/40 hover:text-white/80">
            <X size={17} />
          </button>
        </div>

        {/* Student info card */}
        {student && (
          <div className="relative mx-3 mb-1 p-3 rounded-xl"
            style={{ background: 'rgba(255,255,255,.10)', border: '1px solid rgba(255,255,255,.12)' }}>
            <p className="text-[9px] font-bold uppercase tracking-widest mb-1 text-white/40">Alumno</p>
            <p className="text-white text-sm font-semibold leading-tight">{student.name}</p>
            <p className="text-xs mt-0.5 text-white/50">{grp?.name} — {grp?.subject}</p>
          </div>
        )}

        {/* Divider */}
        <div className="relative mx-5 my-3 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />

        {/* Nav */}
        <nav className="relative flex-1 px-3 py-1 space-y-0.5 overflow-y-auto">
          {nav.map(({ to, label, icon: Icon, exact, badge }) => {
            const showPending = badge === 'terms' && student?.termsStatus !== 'firmado'
            return (
              <NavLink key={to} to={to} end={exact} onClick={closeSidebar}
                className="nav-item group relative"
                style={({ isActive }) => ({ color: isActive ? 'white' : t.sideT2 })}>
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <span className="absolute inset-0 rounded-xl pointer-events-none"
                        style={{ background: 'rgba(255,255,255,.14)', border: '1px solid rgba(255,255,255,.14)' }} />
                    )}
                    {isActive && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full"
                        style={{ background: t.navActive }} />
                    )}
                    <Icon size={17} className="flex-shrink-0 relative z-10" />
                    <span className="flex-1 text-sm font-medium relative z-10">{label}</span>
                    {showPending && (
                      <span className="relative z-10 w-2 h-2 rounded-full bg-amber-400 flex-shrink-0 animate-pulse"/>
                    )}
                    {!showPending && (
                      <ChevronRight size={13}
                        className={clsx('relative z-10 transition-all duration-200',
                          isActive ? 'opacity-60' : 'opacity-0 group-hover:opacity-25')}
                        style={{ color: isActive ? t.navActive : undefined }} />
                    )}
                  </>
                )}
              </NavLink>
            )
          })}
        </nav>

        {/* Divider */}
        <div className="relative mx-5 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />

        {/* User footer */}
        <div className="relative px-3 py-4">
          <div className="flex items-center gap-3 px-2 py-2.5 rounded-xl transition-colors group hover:bg-white/5">
            <div className="relative flex-shrink-0">
              {/* El avatar elegido sustituye a las iniciales; si no hay, se
                  mantienen como respaldo. */}
              {rutaAvatar(student?.avatar) ? (
                <img src={rutaAvatar(student.avatar)} alt=""
                  className="w-8 h-8 rounded-full object-cover"
                  style={{ border: '2px solid rgba(255,255,255,.25)' }}/>
              ) : (
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                  style={{ background: t.light ? 'rgba(255,255,255,.30)' : '#f59e0b', border: '2px solid rgba(255,255,255,.25)' }}>
                  {initials}
                </div>
              )}
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full"
                style={{ border: `2px solid ${t.light ? t.sideBg : '#0d1630'}` }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-semibold truncate leading-none">{student?.name ?? currentUser?.name}</p>
              <p className="text-[10px] mt-0.5 font-medium text-white/40">Solo lectura</p>
            </div>
            <button onClick={handleLogout} title="Cerrar sesión" aria-label="Cerrar sesión"
              className="p-1.5 rounded-lg transition-colors text-white/40 hover:text-red-300 hover:bg-red-500/15">
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Topbar */}
        <header className="flex-shrink-0 px-4 sm:px-6 h-14 flex items-center justify-between gap-3 transition-[background] duration-500"
          style={{
            background: t.topBg,
            backdropFilter: t.light ? 'none' : 'blur(12px)',
            borderBottom: `1px solid ${t.light ? 'rgba(255,255,255,.18)' : 'rgba(255,255,255,.07)'}`,
          }}>
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => setSidebarOpen(true)} aria-label="Abrir menú"
              className="lg:hidden p-2 rounded-xl transition-colors active:scale-95 text-white/60 hover:bg-white/10">
              <Menu size={19} />
            </button>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold truncate text-white/70"
              style={{ background: 'rgba(255,255,255,.10)', border: '1px solid rgba(255,255,255,.14)' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
              <span className="truncate hidden sm:inline">Vista de alumno — solo lectura</span>
              <span className="truncate sm:hidden">Solo lectura</span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold"
              style={{ background: 'rgba(255,255,255,.16)', border: '1px solid rgba(255,255,255,.20)' }}>
              {initials}
            </div>
            <button onClick={handleLogout} className="p-1.5 rounded-xl transition-colors text-white/45 hover:text-red-300">
              <LogOut size={16} />
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-5 lg:p-6 pb-24 lg:pb-6">
          <Suspense fallback={<LoadingPage />}>
            <div key={pathname} className="animate-page-in">
              <Outlet />
            </div>
          </Suspense>
        </main>

        {/* Bottom nav mobile (sin Configuración: vive en el menú lateral) */}
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 flex transition-[background] duration-500"
          style={{ background: t.bottomBg, backdropFilter: t.light ? 'none' : 'blur(16px)', borderTop: `1px solid ${t.light ? 'rgba(255,255,255,.18)' : 'rgba(255,255,255,.07)'}` }}>
          {nav.filter(n => n.to !== '/student/configuracion').map(({ to, label, icon: Icon, exact }) => (
            <NavLink key={to} to={to} end={exact}
              className="flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 transition-colors text-[10px] font-medium relative">
              {({ isActive }) => (
                <>
                  <Icon size={20} strokeWidth={isActive ? 2.5 : 1.8}
                    className={isActive ? 'text-white' : 'text-white/40'} />
                  <span className={isActive ? 'text-white/90' : 'text-white/40'}>{label}</span>
                  {isActive && <span className="absolute bottom-0 w-6 h-0.5 rounded-t-full" style={{ background: t.navActive }} />}
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}

export default function StudentLayout() {
  return (
    <StudentThemeProvider>
      <LayoutInner />
    </StudentThemeProvider>
  )
}
