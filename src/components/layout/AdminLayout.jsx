import { useState, useEffect, Suspense } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import LoadingPage from '../LoadingPage'
import { useAuth } from '../../context/AuthContext'
import {
  LayoutDashboard, CalendarCheck, Users, BookOpen,
  BrainCircuit, Upload, LogOut, ClipboardList, Trophy,
  Bell, Menu, X, ChevronRight, ScrollText, TableProperties, SlidersHorizontal,
  Mail, CheckCircle2, FileText, AlertTriangle, FileCheck, ShieldCheck,
} from 'lucide-react'
import clsx from 'clsx'
import { recentActivity } from '../../data/mockData'
import { AdminThemeProvider, useAdminTheme } from '../../context/AdminThemeContext'

const nav = [
  { to:'/admin',              label:'Dashboard',              icon:LayoutDashboard, exact:true },
  { to:'/admin/grupos',       label:'Grupos',                 icon:BookOpen },
  { to:'/admin/alumnos',      label:'Alumnos',                icon:Users },
  { to:'/admin/evaluaciones', label:'Evaluaciones',           icon:ClipboardList },
  { to:'/admin/registrar',    label:'Registrar Calificaciones',icon:TableProperties },
  { to:'/admin/asistencias',  label:'Pasar Lista',            icon:CalendarCheck },
  { to:'/admin/ia',           label:'Análisis IA',            icon:BrainCircuit },
  { to:'/admin/rankings',     label:'Rankings',               icon:Trophy },
  { to:'/admin/terminos',     label:'T&C / Firmas',           icon:ScrollText },
  { to:'/admin/configuracion',label:'Configuración',          icon:SlidersHorizontal },
  { to:'/admin/configuracion/acceso', label:'Acceso y Disposición', icon:ShieldCheck, adminOnly:true },
]

const bottomNav = [nav[0], nav[1], nav[2], nav[6]]

const ORIGINAL_BG = '#08080f'

const pageTitles = {
  '/admin':              'Dashboard General',
  '/admin/grupos':       'Grupos',
  '/admin/alumnos':      'Alumnos',
  '/admin/evaluaciones': 'Evaluaciones',
  '/admin/registrar':    'Registrar Calificaciones',
  '/admin/asistencias':  'Pasar Lista',
  '/admin/ia':           'Análisis con IA',
  '/admin/rankings':     'Rankings',
  '/admin/terminos':     'T&C y Firmas',
  '/admin/configuracion':'Configuración',
  '/admin/configuracion/acceso':'Acceso y Disposición',
}

const activityIcon = {
  mail: Mail, 'check-circle': CheckCircle2, 'file-text': FileText,
  'alert-triangle': AlertTriangle, 'file-check': FileCheck, upload: Upload,
}
// Tokens: el panel se ve en las tres identidades.
const activityColor = {
  correo:'var(--info)', asistencia:'var(--good)', evaluacion:'var(--accent)',
  alerta:'var(--bad)', reporte:'var(--warn)', importacion:'var(--t2)',
}

function LayoutInner() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const { currentUser, logout } = useAuth()
  const { appearance, t } = useAdminTheme()
  const navigate    = useNavigate()
  const { pathname } = useLocation()

  const handleLogout = () => { logout(); navigate('/login') }
  const closeSidebar  = () => setSidebarOpen(false)

  // Solo se aplica la identidad institucional si el admin eligió IPN/UNAM;
  // 'default' conserva exactamente el look original de SIGA (crimson/navy).
  const identity = appearance !== 'default' ? t : null
  const accent    = identity?.accent    ?? '#b23348'
  const accentSoft= identity?.accent    ?? '#c95f72'

  const pageTitle = Object.entries(pageTitles)
    .sort((a, b) => b[0].length - a[0].length)
    .find(([k]) => pathname.startsWith(k))?.[1] ?? 'SIGA CEFIMAT'

  const initials = currentUser?.name.split(' ').slice(0, 2).map(n => n[0]).join('') ?? 'PS'

  // Los tokens de la identidad activa se publican como variables CSS para todo
  // el subárbol: así cualquier página o componente anidado hereda los colores
  // correctos sin recibir el tema por props.
  //
  // Además se replican en <html>: los modales y el selector de paleta se
  // renderizan por portal a document.body, fuera de este contenedor, y
  // heredarían las variables oscuras de :root. Sin esto, en IPN/UNAM todo
  // lo portado sale con panel oscuro sobre página blanca.
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
    // Sombra con presencia: la anterior era tan tenue que las tarjetas se
    // perdían contra el fondo blanco y parecían flotar sin definición.
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

  return (
    <div className="flex h-screen overflow-hidden transition-[background] duration-500"
      data-theme={appearance}
      data-theme-light={t.light ? '' : undefined}
      style={{
        background: identity ? identity.mainBg : ORIGINAL_BG,
        backgroundImage: identity?.mainBgImage,
        ...themeVars,
      }}>

      {/* ── Mobile overlay (fondo difuminado, se ve tras el sidebar) ── */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-md lg:hidden"
          onClick={closeSidebar} />
      )}

      {/* ── Sidebar ──────────────────────────────────────────── */}
      <aside className={clsx(
        'fixed inset-y-0 left-0 z-50 w-[86vw] max-w-[320px] flex flex-col transition-transform duration-300 ease-in-out',
        'lg:static lg:w-64 lg:max-w-none lg:translate-x-0 lg:z-auto lg:flex-shrink-0',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      )}
        style={{
          background: identity ? identity.sideBg : 'rgba(5,5,10,.82)',
          backdropFilter: identity?.light ? 'none' : 'blur(24px)',
          WebkitBackdropFilter: identity?.light ? 'none' : 'blur(24px)',
          borderRight: `1px solid ${identity ? identity.sideBorder : 'rgba(255,255,255,.07)'}`,
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
            <p className="font-bold text-sm leading-none tracking-tight" style={{ color: t.sideT1 }}>
              SIGA <span style={{ color: accentSoft }}>CEFIMAT</span>
            </p>
            <p className="text-[10px] mt-0.5 font-medium" style={{ color: t.sideT3 }}>Gestión Académica</p>
          </div>
          <button onClick={closeSidebar} aria-label="Cerrar menú"
            className="lg:hidden p-1 rounded-lg transition-colors"
            style={{ color: t.sideT2 }}
            onMouseEnter={e => { e.currentTarget.style.color='var(--t2)'; e.currentTarget.style.background='rgba(255,255,255,.07)' }}
            onMouseLeave={e => { e.currentTarget.style.color='var(--t3)'; e.currentTarget.style.background='transparent' }}>
            <X size={17} />
          </button>
        </div>

        {/* Divider */}
        <div className="mx-5 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

        {/* Nav */}
        <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto" aria-label="Navegación principal">
          <p className="text-[10px] font-bold uppercase tracking-widest px-3 mb-2.5"
            style={{ color: t.sideT3 }}>
            Gestión
          </p>
          {nav.filter(n => !n.adminOnly || currentUser?.role === 'admin').map(({ to, label, icon: Icon, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              onClick={closeSidebar}
              className={({ isActive }) => clsx(
                'nav-item group relative',
                !identity && (isActive ? 'text-white' : 'text-slate-400 hover:text-white')
              )}
              style={({ isActive }) => identity
                ? { color: isActive ? t.sideT1 : t.sideT2 }
                : undefined}
            >
              {({ isActive }) => (
                <>
                  {/* Active background */}
                  {isActive && (
                    <span className="absolute inset-0 rounded-xl pointer-events-none"
                      style={identity
                        ? { background: `${accent}14`, border: `1px solid ${accent}33` }
                        : { background: 'var(--card-border)', border: '1px solid rgba(255,255,255,.1)' }} />
                  )}
                  {/* Left accent bar (marca institucional) */}
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full"
                      style={{ background: accent }} />
                  )}
                  <Icon size={17} className="flex-shrink-0 relative z-10" />
                  <span className="flex-1 text-sm font-medium relative z-10">{label}</span>
                  <ChevronRight size={13}
                    className={clsx(
                      'relative z-10 transition-all duration-200',
                      isActive ? 'opacity-60' : 'opacity-0 group-hover:opacity-30'
                    )}
                    style={{ color: isActive ? accentSoft : undefined }} />
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
            onMouseEnter={e => e.currentTarget.style.background='var(--card-bg)'}
            onMouseLeave={e => e.currentTarget.style.background='transparent'}>
            <div className="relative flex-shrink-0">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold"
                style={{
                  background: `${t.sideT1}22`,
                  border: `1px solid ${t.sideT1}33`,
                  color: t.sideT1,
                }}>
                {initials}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full"
                style={{ border: `2px solid ${identity ? identity.sideBg : ORIGINAL_BG}` }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate leading-none" style={{ color: t.sideT1 }}>{currentUser?.name}</p>
              <p className="text-[10px] mt-0.5 font-medium" style={{ color: t.sideT3 }}>Docente · Admin</p>
            </div>
            <button onClick={handleLogout} title="Cerrar sesión" aria-label="Cerrar sesión"
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: t.sideT3 }}
              onMouseEnter={e => { e.currentTarget.style.color='rgba(248,113,113,.9)'; e.currentTarget.style.background='rgba(239,68,68,.10)' }}
              onMouseLeave={e => { e.currentTarget.style.color='var(--t3)'; e.currentTarget.style.background='transparent' }}>
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
            background: identity ? identity.topBg : 'rgba(8,8,15,.80)',
            backdropFilter: identity?.light ? 'none' : 'blur(12px)',
            borderBottom: `1px solid ${identity ? identity.sideBorder : 'rgba(255,255,255,.07)'}`,
          }}>

          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => setSidebarOpen(true)} aria-label="Abrir menú"
              className="lg:hidden p-2 rounded-xl transition-colors active:scale-95"
              style={{ color: t.sideT2 }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.07)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <Menu size={19} />
            </button>
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[11px] font-medium hidden sm:block" style={{ color: t.sideT3 }}>SIGA CEFIMAT</span>
              <ChevronRight size={12} className="hidden sm:block flex-shrink-0" style={{ color: t.sideT3 }} />
              <h1 className="text-sm font-bold truncate" style={{ color: t.sideT1 }}>{pageTitle}</h1>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="relative">
              <button aria-label="Notificaciones" onClick={() => setNotifOpen(v => !v)}
                className="relative p-2 rounded-xl transition-colors active:scale-95"
                style={{ color: t.sideT3, background: notifOpen ? 'rgba(255,255,255,.07)' : 'transparent' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.07)'}
                onMouseLeave={e => e.currentTarget.style.background = notifOpen ? 'rgba(255,255,255,.07)' : 'transparent'}>
                <Bell size={17} />
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-400 rounded-full" aria-hidden />
              </button>

              {notifOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)} />
                  <div className="absolute right-0 top-full mt-2 w-80 max-w-[85vw] rounded-2xl z-50 overflow-hidden animate-scale-in"
                    style={{ background:'var(--panel-bg)', border:'1px solid rgba(255,255,255,.12)', boxShadow:'0 24px 72px rgba(0,0,0,.60)' }}>
                    <div className="px-4 py-3" style={{ borderBottom:'1px solid rgba(255,255,255,.08)' }}>
                      <p className="text-sm font-bold" style={{ color:'var(--t1)' }}>Notificaciones</p>
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {recentActivity.map(a => {
                        const Icon = activityIcon[a.icon] ?? Bell
                        const color = activityColor[a.tipo] ?? 'var(--t2)'
                        return (
                          <div key={a.id} className="flex items-start gap-3 px-4 py-3 transition-colors"
                            style={{ borderBottom:'1px solid rgba(255,255,255,.05)' }}
                            onMouseEnter={e => e.currentTarget.style.background='var(--card-bg)'}
                            onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                              style={{ background:`${color}1f`, border:`1px solid ${color}44` }}>
                              <Icon size={13} style={{ color }} />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-medium leading-snug" style={{ color:'var(--t2)' }}>{a.texto}</p>
                              <p className="text-[10px] mt-0.5" style={{ color:'var(--t3)' }}>{a.hora}</p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center gap-2.5 pl-2" style={{ borderLeft: `1px solid ${identity ? identity.sideBorder : 'var(--card-border)'}` }}>
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold"
                style={{
                  background: identity ? `${identity.t1}1f` : 'var(--t4)',
                  border: `1px solid ${t.sideT1}26`,
                  color: t.sideT1,
                }}>
                {initials}
              </div>
              <span className="text-sm font-semibold hidden md:block" style={{ color: t.sideT2 }}>
                {currentUser?.name.split(' ').slice(0, 2).join(' ')}
              </span>
            </div>
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

        {/* Bottom nav mobile (accesos rápidos + botón "Más" para el resto) */}
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 flex"
          style={{
            background: identity ? identity.bottomBg : 'rgba(5,5,10,.90)',
            backdropFilter: identity?.light ? 'none' : 'blur(16px)',
            WebkitBackdropFilter: identity?.light ? 'none' : 'blur(16px)',
            borderTop: `1px solid ${identity ? identity.sideBorder : 'var(--card-border)'}`,
          }}>
          {bottomNav.map(({ to, label, icon: Icon, exact }) => (
            <NavLink key={to} to={to} end={exact}
              className="flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 transition-colors text-[10px] font-medium relative">
              {({ isActive }) => (
                <>
                  <Icon size={20} strokeWidth={isActive ? 2.5 : 1.8}
                    style={{ color: isActive ? (identity?.t1 ?? 'white') : (identity?.t3 ?? '#94a3b8') }} />
                  <span style={{ color: isActive ? (identity?.t1 ?? 'var(--t1)') : (identity?.t3 ?? '#94a3b8') }}>{label}</span>
                  {isActive && <span className="absolute bottom-0 w-6 h-0.5 rounded-t-full" style={{ background: accent }} />}
                </>
              )}
            </NavLink>
          ))}
          <button onClick={() => setSidebarOpen(true)} aria-label="Más opciones"
            className="flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 transition-colors text-[10px] font-medium active:scale-95"
            style={{ color: identity?.t3 ?? '#94a3b8' }}>
            <Menu size={20} strokeWidth={1.8} />
            <span>Más</span>
          </button>
        </nav>
      </div>
    </div>
  )
}

export default function AdminLayout() {
  return (
    <AdminThemeProvider>
      <LayoutInner />
    </AdminThemeProvider>
  )
}
