import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { createPortal } from 'react-dom'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import LoadingPage from '../LoadingPage'
import { useAuth } from '../../context/AuthContext'
import {
  LayoutDashboard, CalendarCheck, Users, BookOpen,
  Upload, LogOut, ClipboardList, Trophy, Wallet,
  Bell, Menu, X, ChevronRight, ChevronDown, ScrollText, TableProperties, SlidersHorizontal,
  Mail, CheckCircle2, FileText, AlertTriangle, FileCheck, ShieldCheck, ArrowLeft, Search, RefreshCw,
} from 'lucide-react'
import clsx from 'clsx'
import { fetchNotificaciones, marcarLeida, marcarTodasLeidas } from '../../lib/comunicacionesData'
import { supabase } from '../../lib/supabaseClient'
import { AdminThemeProvider, useAdminTheme } from '../../context/AdminThemeContext'

/* Once entradas planas mezclaban entidades, tareas, análisis y administración
   al mismo nivel: había que leer la lista entera para orientarse. Agrupadas en
   cuatro bloques con encabezado, cada una se busca en el bloque que le toca. */
const SECCIONES = [
  { titulo: null, items: [
    { to:'/admin',              label:'Dashboard',              icon:LayoutDashboard, exact:true },
  ]},
  { titulo: 'Operación académica', sectionIcon:BookOpen, items: [
    { to:'/admin/grupos',       label:'Grupos',                 icon:BookOpen },
    { to:'/admin/alumnos',      label:'Alumnos',                icon:Users },
    { to:'/admin/registrar',    label:'Calificaciones',         icon:TableProperties },
    { to:'/admin/asistencias',  label:'Pasar Lista',            icon:CalendarCheck },
    { to:'/admin/evaluaciones', label:'Exámenes',                icon:ClipboardList },
  ]},
  { titulo: 'Administración', sectionIcon:ShieldCheck, items: [
    { to:'/admin/pagos',        label:'Pagos',                  icon:Wallet, adminOnly:true },
    { to:'/admin/correos',      label:'Enviar correos',         icon:Mail, adminOnly:true },
    { to:'/admin/terminos',     label:'T&C / Firmas',           icon:ScrollText },
    { to:'/admin/configuracion',label:'Configuración',          icon:SlidersHorizontal },
    { to:'/admin/configuracion/acceso', label:'Acceso y Disposición', icon:ShieldCheck, adminOnly:true },
  ]},
  { titulo: 'Resultados', sectionIcon:Trophy, items: [
    { to:'/admin/rankings',     label:'Rankings',               icon:Trophy },
  ]},
]

const nav = SECCIONES.flatMap(s => s.items)

const bottomNav = ['/admin','/admin/grupos','/admin/alumnos','/admin/rankings']
  .map(to => nav.find(item => item.to === to))

const ORIGINAL_BG = '#08080f'

const pageTitles = {
  '/admin':              'Dashboard General',
  '/admin/grupos':       'Grupos',
  '/admin/alumnos':      'Alumnos',
  '/admin/evaluaciones': 'Exámenes',
  '/admin/registrar':    'Calificaciones',
  '/admin/asistencias':  'Pasar Lista',
  '/admin/rankings':     'Rankings',
  '/admin/pagos':        'Control de pagos',
  '/admin/correos':      'Enviar correos',
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

/* `event_type` lo escribe la base de datos al disparar la notificación. Cada
   tipo lleva su icono y su color para que el panel se lea de un vistazo sin
   tener que leer el texto de cada fila. */
const NOTIF_ICONO = {
  documento_entregado:'upload', documento_validado:'file-check',
  documento_rechazado:'alert-triangle', garantia_entregada:'file-text',
  garantia_validada:'file-check', terminos_firmados:'check-circle',
  acceso_activado:'check-circle', pago_registrado:'file-text',
  calificacion:'file-text', inasistencia:'alert-triangle', manual:'mail',
}
const NOTIF_COLOR = {
  documento_entregado:'var(--info)', documento_validado:'var(--good)',
  documento_rechazado:'var(--bad)', garantia_entregada:'var(--info)',
  garantia_validada:'var(--good)', terminos_firmados:'var(--good)',
  acceso_activado:'var(--good)', pago_registrado:'var(--warn)',
  calificacion:'var(--accent)', inasistencia:'var(--bad)', manual:'var(--info)',
}

function LayoutInner() {
  const { pathname } = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [notifQuery, setNotifQuery] = useState('')
  const [notifOnlyUnread, setNotifOnlyUnread] = useState(false)
  const [notifLimit, setNotifLimit] = useState(8)
  const [notifLoading, setNotifLoading] = useState(true)
  const [notifError, setNotifError] = useState('')
  const [openSections, setOpenSections] = useState(() => ({
    'Operación académica': pathname.startsWith('/admin/grupos') || pathname.startsWith('/admin/alumnos') || pathname.startsWith('/admin/registrar') || pathname.startsWith('/admin/asistencias') || pathname.startsWith('/admin/evaluaciones'),
    'Administración': pathname.startsWith('/admin/pagos') || pathname.startsWith('/admin/correos') || pathname.startsWith('/admin/terminos') || pathname.startsWith('/admin/configuracion'),
    'Resultados': pathname.startsWith('/admin/rankings'),
  }))
  const notifRef = useRef(null)
  const notifBtnRef = useRef(null)
  const notifPanelRef = useRef(null)
  /* El panel viaja por portal: el area principal lleva `overflow-hidden`, que
     recortaba el desplegable `absolute` del header —se veia cortado o por
     detras del contenido. Fijo y anclado al boton, ya nada puede taparlo. */
  const [notifPos, setNotifPos] = useState(null)

  const loadNotifications = useCallback(() => {
    setNotifLoading(true); setNotifError('')
    return fetchNotificaciones()
      .then(setNotifications)
      .catch(error => setNotifError(error?.message || 'No fue posible cargar las notificaciones.'))
      .finally(() => setNotifLoading(false))
  }, [])

  useEffect(() => {
    loadNotifications()
    /* Tiempo real: cada INSERT entra sin recargar la lista entera, para que la
       notificacion aparezca en el acto y no tras un viaje de ida y vuelta. */
    const channel = supabase.channel('admin-notifications')
      .on('postgres_changes', { event:'INSERT', schema:'public', table:'notifications' },
        payload => setNotifications(prev =>
          prev.some(n => n.id === payload.new.id) ? prev : [payload.new, ...prev].slice(0, 40)))
      .on('postgres_changes', { event:'UPDATE', schema:'public', table:'notifications' },
        payload => setNotifications(prev => prev.map(n => n.id === payload.new.id ? payload.new : n)))
      .on('postgres_changes', { event:'DELETE', schema:'public', table:'notifications' },
        payload => setNotifications(prev => prev.filter(n => n.id !== payload.old.id)))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [loadNotifications])

  const noLeidas = notifications.filter(n => !n.read_at).length

  /* La posicion se recalcula al abrir y mientras el panel esta abierto: si la
     ventana cambia de tamano o se hace scroll, el panel debe seguir al boton. */
  const situarPanel = useCallback(() => {
    const r = notifBtnRef.current?.getBoundingClientRect()
    if (r) setNotifPos({ top: r.bottom + 8, right: Math.max(12, window.innerWidth - r.right) })
  }, [])

  useEffect(() => {
    if (!notifOpen) return
    situarPanel()
    window.addEventListener('resize', situarPanel)
    window.addEventListener('scroll', situarPanel, true)
    return () => {
      window.removeEventListener('resize', situarPanel)
      window.removeEventListener('scroll', situarPanel, true)
    }
  }, [notifOpen, situarPanel])

  const abrirNotificaciones = () => {
    situarPanel()
    setNotifOpen(v => !v)
  }

  /* Marcar como leida es optimista: el panel no debe quedarse esperando a la
     BD para apagar el punto rojo. Si la escritura falla, el realtime devuelve
     la fila a su estado real. */
  const leerNotificacion = (n) => {
    if (n.read_at) return
    setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x))
    marcarLeida(n.id).catch(() => loadNotifications())
  }

  const leerTodas = () => {
    const ids = notifications.filter(n => !n.read_at).map(n => n.id)
    if (!ids.length) return
    const ahora = new Date().toISOString()
    setNotifications(prev => prev.map(n => n.read_at ? n : { ...n, read_at: ahora }))
    marcarTodasLeidas(ids).catch(() => loadNotifications())
  }

  const filteredNotifications = notifications.filter(n => {
    if (notifOnlyUnread && n.read_at) return false
    const q = notifQuery.trim().toLocaleLowerCase('es-MX')
    return !q || `${n.title ?? ''} ${n.body ?? ''}`.toLocaleLowerCase('es-MX').includes(q)
  })

  /* Cierre del panel de notificaciones sin cubrir la pantalla con un telón
     invisible: se escucha el puntero en `document` y se comprueba si cayó
     fuera. `pointerdown` cubre ratón y dedo con un solo escucha. */
  useEffect(() => {
    if (!notifOpen) return
    const fuera  = e => {
      if (notifRef.current?.contains(e.target)) return
      if (notifPanelRef.current?.contains(e.target)) return
      setNotifOpen(false)
    }
    const escape = e => { if (e.key === 'Escape') setNotifOpen(false) }
    document.addEventListener('pointerdown', fuera)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', fuera)
      document.removeEventListener('keydown', escape)
    }
  }, [notifOpen])
  const { currentUser, logout } = useAuth()
  const { appearance, t } = useAdminTheme()
  const navigate    = useNavigate()

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
  const parentRoute = /^\/admin\/grupos\/[^/]+/.test(pathname) ? '/admin/grupos'
    : /^\/admin\/alumnos\/[^/]+/.test(pathname) ? '/admin/alumnos'
    : null

  const initials = currentUser?.name.split(' ').slice(0, 2).map(n => n[0]).join('') ?? 'PS'
  const userRoleLabel = currentUser?.role === 'admin' ? 'Administrador' : 'Subadministrador'
  const avatarBorder = appearance === 'default' ? '#ffffff' : '#000000'
  const toggleSection = titulo => setOpenSections(current => ({ ...current, [titulo]: !current[titulo] }))

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
    '--accent-contrast': appearance === 'default' ? '#3B2A08' : '#ffffff',
    '--panel-bg': t.panelBg, '--header-bg': t.headerBg,
    '--good': t.good, '--info': t.info, '--warn': t.warn, '--bad': t.bad,
    '--good-soft': t.goodSoft, '--info-soft': t.infoSoft,
    '--warn-soft': t.warnSoft, '--bad-soft': t.badSoft,
    '--good-line': t.goodLine, '--info-line': t.infoLine,
    '--warn-line': t.warnLine, '--bad-line': t.badLine,
    // Relleno mate: color pleno y opaco, siempre con texto blanco encima.
    '--good-solid': t.goodSolid, '--info-solid': t.infoSolid,
    '--warn-solid': t.warnSolid, '--bad-solid': t.badSolid,
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
            className="lg:hidden min-w-11 min-h-11 flex items-center justify-center rounded-lg transition-colors"
            style={{ color: t.sideT2 }}
            onMouseEnter={e => { e.currentTarget.style.color='var(--t2)'; e.currentTarget.style.background='rgba(255,255,255,.07)' }}
            onMouseLeave={e => { e.currentTarget.style.color='var(--t3)'; e.currentTarget.style.background='transparent' }}>
            <X size={17} />
          </button>
        </div>

        {/* Divider */}
        <div className="mx-5 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

        {/* Nav */}
        <nav className="flex-1 px-3 py-3 overflow-y-auto" aria-label="Navegación principal">
          {SECCIONES.map(({ titulo, sectionIcon: SectionIcon, items }) => {
          const visibles = items.filter(n => !n.adminOnly || currentUser?.role === 'admin')
          if (visibles.length === 0) return null
          return (
          <div key={titulo ?? 'inicio'} className="space-y-0.5 mb-1">
          {titulo && (
            <button type="button" onClick={() => toggleSection(titulo)}
              aria-expanded={!!openSections[titulo]} aria-controls={`admin-nav-${titulo.replace(/\s+/g, '-').toLowerCase()}`}
              className="mt-2 min-h-11 w-full px-3 rounded-xl flex items-center justify-between gap-2 text-left transition-colors"
              style={{ color:t.sideT2, background:openSections[titulo] ? `${t.sideT1}0D` : 'transparent' }}>
              <span className="flex min-w-0 items-center gap-2">
                <SectionIcon size={15} className="flex-shrink-0" aria-hidden="true" />
                <span className="truncate text-[10px] font-bold uppercase tracking-widest">{titulo}</span>
              </span>
              <ChevronDown size={15} className={clsx('flex-shrink-0 transition-transform duration-200', openSections[titulo] && 'rotate-180')} />
            </button>
          )}
          <div id={titulo ? `admin-nav-${titulo.replace(/\s+/g, '-').toLowerCase()}` : undefined}
            hidden={!!titulo && !openSections[titulo]} className="space-y-0.5">
          {visibles.map(({ to, label, icon: Icon, exact }) => (
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
          </div>
          </div>
          )})}
        </nav>

        {/* User footer */}
        <div className="relative mt-1 px-3 py-3"
          style={{
            borderTop: `1px solid ${identity ? identity.sideBorder : 'rgba(255,255,255,.18)'}`,
            background: identity ? `${t.sideT1}0A` : 'rgba(255,255,255,.035)',
          }}>
          <div
            className="flex items-center gap-3 px-1 py-1 rounded-xl transition-colors"
            onMouseEnter={e => {
              e.currentTarget.style.background = identity
                ? 'rgba(255,255,255,.10)'
                : 'var(--card-bg)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent'
            }}>
            <div className="relative flex-shrink-0">
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-extrabold"
                style={{
                  background: `${t.sideT1}22`,
                  border: `2px solid ${avatarBorder}`,
                  boxShadow: `0 0 0 3px ${appearance === 'default' ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.12)'}`,
                  color: t.sideT1,
                }}>
                {initials}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full"
                style={{ border: `2px solid ${identity ? identity.sideBg : ORIGINAL_BG}` }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate leading-tight" style={{ color: t.sideT1 }} title={currentUser?.name}>{currentUser?.name}</p>
              <p className="text-[10px] mt-1 font-bold uppercase tracking-[0.08em]" style={{ color: t.sideT2 }}>{userRoleLabel}</p>
              <p className="text-[10px] mt-0.5 font-medium" style={{ color: t.sideT3 }}>Personal académico</p>
            </div>
            <button onClick={handleLogout} title="Cerrar sesión" aria-label="Cerrar sesión"
              className="min-w-11 min-h-11 flex items-center justify-center rounded-xl transition-colors"
              style={{ color: '#fca5a5', background:'rgba(239,68,68,.10)', border:'1px solid rgba(248,113,113,.24)' }}
              onMouseEnter={e => { e.currentTarget.style.color='rgba(248,113,113,.9)'; e.currentTarget.style.background='rgba(239,68,68,.10)' }}
              onMouseLeave={e => { e.currentTarget.style.color='#fca5a5'; e.currentTarget.style.background='rgba(239,68,68,.10)' }}>
              <LogOut size={17} />
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
              className="lg:hidden min-w-11 min-h-11 flex items-center justify-center rounded-xl transition-colors active:scale-95"
              style={{ color: t.sideT2 }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.07)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <Menu size={19} />
            </button>
            <div className="flex items-center gap-2 min-w-0">
              {parentRoute && (
                <button onClick={() => navigate(parentRoute)} aria-label="Regresar"
                  className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-all hover:scale-105 active:scale-95"
                  style={{ color:t.sideT1, background:'rgba(255,255,255,.10)', border:'1px solid rgba(255,255,255,.16)' }}>
                  <ArrowLeft size={19}/>
                </button>
              )}
              <span className="text-[11px] font-medium hidden sm:block" style={{ color: t.sideT3 }}>SIGA CEFIMAT</span>
              <ChevronRight size={12} className="hidden sm:block flex-shrink-0" style={{ color: t.sideT3 }} />
              <h1 className="text-sm font-bold truncate" style={{ color: t.sideT1 }}>{pageTitle}</h1>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="relative" ref={notifRef}>
              <button ref={notifBtnRef} aria-label="Notificaciones" aria-expanded={notifOpen} onClick={abrirNotificaciones}
                className="relative min-w-11 min-h-11 flex items-center justify-center rounded-xl transition-colors active:scale-95"
                style={{ color: t.sideT3, background: notifOpen ? 'rgba(255,255,255,.07)' : 'transparent' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.07)'}
                onMouseLeave={e => e.currentTarget.style.background = notifOpen ? 'rgba(255,255,255,.07)' : 'transparent'}>
                <Bell size={17} />
                {noLeidas > 0 && (
                  <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center text-[9px] font-black"
                    style={{ background:'#ef4444', color:'#fff' }} aria-hidden>
                    {noLeidas > 9 ? '9+' : noLeidas}
                  </span>
                )}
              </button>

              {/* Portal a `document.body`. Antes el panel era `absolute` dentro
                  del header, y el area principal (`overflow-hidden`) lo
                  recortaba: se veia cortado a media altura o por detras del
                  contenido de la pagina. Fijo y anclado al boton, ningun
                  contenedor puede recortarlo ni pintarse encima. */}
              {notifOpen && notifPos && createPortal(
                <div ref={notifPanelRef}
                  className="fixed w-80 max-w-[calc(100vw-24px)] rounded-2xl z-[10001] overflow-hidden animate-scale-in"
                  style={{ top: notifPos.top, right: notifPos.right, background:'var(--panel-bg)', border:'1px solid var(--card-border)', boxShadow:'0 24px 72px rgba(0,0,0,.45)' }}>
                  <div className="px-4 py-3 space-y-3" style={{ borderBottom:'1px solid var(--divider)' }}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-bold" style={{ color:'var(--t1)' }}>Notificaciones</p>
                      <div className="flex items-center gap-1">
                        <button onClick={loadNotifications} title="Actualizar" aria-label="Actualizar"
                          className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ color:'var(--t3)' }}>
                          <RefreshCw size={13}/>
                        </button>
                        <button onClick={() => setNotifOpen(false)} title="Cerrar" aria-label="Cerrar"
                          className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ color:'var(--t3)' }}>
                          <X size={14}/>
                        </button>
                      </div>
                    </div>
                    <label className="relative block">
                      <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{color:'var(--t3)'}}/>
                      <input value={notifQuery} onChange={e=>{setNotifQuery(e.target.value);setNotifLimit(8)}} placeholder="Buscar notificación" className="input-field w-full min-h-11 pl-9 pr-3 text-xs"/>
                    </label>
                    <div className="flex items-center justify-between gap-2">
                      <button onClick={()=>setNotifOnlyUnread(v=>!v)} className="min-h-9 px-3 rounded-xl text-xs font-bold" style={{background:notifOnlyUnread?'var(--accent)':'var(--soft-bg)',color:notifOnlyUnread?'var(--accent-contrast)':'var(--t2)',border:'1px solid var(--card-border)'}}>No leídas ({noLeidas})</button>
                      {noLeidas > 0 && (
                        <button onClick={leerTodas} className="text-[11px] font-bold" style={{ color:'var(--accent)' }}>
                          Marcar todas
                        </button>
                      )}
                    </div>
                  </div>
                  {/* `overscroll-contain`: al llegar al final de la lista, el
                      gesto no sigue arrastrando la página de detrás. */}
                  <div className="overflow-y-auto overscroll-contain" style={{maxHeight:'min(22rem, calc(100dvh - 12rem))'}}>
                    {notifLoading && <p className="p-5 text-xs" style={{color:'var(--t3)'}}>Cargando notificaciones…</p>}
                    {notifError && <div role="alert" className="p-4 text-xs" style={{color:'var(--bad)'}}><p>{notifError}</p><button className="mt-2 min-h-11 px-3 rounded-xl inline-flex items-center gap-2" onClick={loadNotifications} style={{border:'1px solid var(--bad-line)'}}><RefreshCw size={13}/>Reintentar</button></div>}
                    {!notifLoading && !notifError && filteredNotifications.length === 0 && <p className="p-5 text-xs" style={{color:'var(--t3)'}}>{notifications.length ? 'No hay coincidencias.' : 'Sin notificaciones todavía.'}</p>}
                    {!notifLoading && !notifError && filteredNotifications.slice(0, notifLimit).map(a => {
                      const Icon = activityIcon[NOTIF_ICONO[a.event_type]] ?? Bell
                      const color = NOTIF_COLOR[a.event_type] ?? 'var(--info)'
                      const leida = !!a.read_at
                      return (
                        <button key={a.id} type="button" onClick={() => leerNotificacion(a)}
                          className="w-full text-left flex items-start gap-3 px-4 py-3 transition-colors"
                          style={{ borderBottom:'1px solid var(--divider)', background: leida ? 'transparent' : 'var(--soft-bg)' }}>
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                            style={{ background:'var(--info-soft)', border:'1px solid var(--info-line)' }}>
                            <Icon size={13} style={{ color }} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold leading-snug" style={{ color:'var(--t1)' }}>{a.title}</p>
                            <p className="text-xs leading-snug" style={{ color:'var(--t2)' }}>{a.body}</p>
                            <p className="text-[10px] mt-0.5" style={{ color:'var(--t3)' }}>{new Date(a.created_at).toLocaleString('es-MX')}</p>
                          </div>
                          {!leida && <span className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5" style={{ background:'var(--accent)' }} aria-label="No leída"/>}
                        </button>
                      )
                    })}
                    {filteredNotifications.length > notifLimit && <button className="w-full min-h-11 text-xs font-bold" onClick={()=>setNotifLimit(n=>n+8)} style={{color:'var(--accent)',borderTop:'1px solid var(--divider)'}}>Cargar 8 más</button>}
                  </div>
                </div>,
                document.body,
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
            paddingBottom: 'env(safe-area-inset-bottom)',
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
