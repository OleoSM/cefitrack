import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  Settings, LogOut, Palette, Check, Accessibility, Type, Waves, ChevronRight,
} from 'lucide-react'
import { useAdminTheme } from '../../context/AdminThemeContext'

/**
 * Menú de cuenta: el icono y el nombre de arriba a la derecha lo abren.
 *
 * Es el sitio donde todo el mundo busca «lo mío» —la identidad visual, el
 * tamaño de letra, cerrar sesión—. Antes eran un rótulo inerte y esos ajustes
 * vivían enterrados en Configuración, así que nadie los encontraba.
 *
 * Va por portal a `document.body`: el área principal del panel lleva
 * `overflow-hidden` y recortaría el desplegable a media altura, que es
 * exactamente lo que le pasaba al panel de notificaciones.
 */
const IDENTIDADES = [
  { id:'default', label:'SIGA',  color:'#0a0a14', barra:'var(--warn)' },
  { id:'ipn',     label:'IPN',   color:'#881126', barra:'#ffffff' },
  { id:'unam',    label:'UNAM',  color:'#003366', barra:'#CC9933' },
]

function Opcion({ icon: Icon, titulo, descripcion, activo, onClick }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={activo}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors"
      style={{ background: activo ? 'var(--soft-bg)' : 'transparent' }}
      onMouseEnter={e => { if (!activo) e.currentTarget.style.background = 'var(--soft-bg)' }}
      onMouseLeave={e => { if (!activo) e.currentTarget.style.background = 'transparent' }}>
      <span className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
        style={activo
          ? { background:'var(--accent)', color:'var(--accent-contrast)' }
          : { background:'var(--card-bg)', color:'var(--t3)', border:'1px solid var(--card-border)' }}>
        <Icon size={15}/>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-bold" style={{ color:'var(--t1)' }}>{titulo}</span>
        <span className="block text-[10px] leading-tight" style={{ color:'var(--t3)' }}>{descripcion}</span>
      </span>
      <span className="w-9 h-5 rounded-full flex-shrink-0 relative transition-colors"
        style={{ background: activo ? 'var(--accent)' : 'var(--card-border)' }}>
        <span className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all"
          style={{ left: activo ? 18 : 2 }}/>
      </span>
    </button>
  )
}

export default function MenuPerfil({ usuario, onIrAConfiguracion, onCerrarSesion, iniciales, tema }) {
  const [abierto, setAbierto] = useState(false)
  const [pos, setPos] = useState(null)
  const botonRef = useRef(null)
  const menuRef = useRef(null)
  const { appearance, setAppearance, movimiento, setMovimiento, texto, setTexto } = useAdminTheme()

  const situar = useCallback(() => {
    const r = botonRef.current?.getBoundingClientRect()
    if (r) setPos({ top: r.bottom + 8, right: Math.max(12, window.innerWidth - r.right) })
  }, [])

  useEffect(() => {
    if (!abierto) return undefined
    situar()
    const fuera = e => {
      if (botonRef.current?.contains(e.target) || menuRef.current?.contains(e.target)) return
      setAbierto(false)
    }
    const escape = e => { if (e.key === 'Escape') setAbierto(false) }
    document.addEventListener('pointerdown', fuera)
    document.addEventListener('keydown', escape)
    window.addEventListener('resize', situar)
    window.addEventListener('scroll', situar, true)
    return () => {
      document.removeEventListener('pointerdown', fuera)
      document.removeEventListener('keydown', escape)
      window.removeEventListener('resize', situar)
      window.removeEventListener('scroll', situar, true)
    }
  }, [abierto, situar])

  const rol = usuario?.role === 'admin' ? 'Administrador'
    : usuario?.role === 'sub_admin' ? 'Sub-administrador' : 'Alumno'

  return (
    <>
      <button ref={botonRef} type="button"
        onClick={() => { situar(); setAbierto(a => !a) }}
        aria-expanded={abierto} aria-haspopup="menu"
        title="Mi cuenta" aria-label="Mi cuenta"
        className="flex items-center gap-2.5 pl-2 pr-2 py-1 rounded-xl transition-colors"
        style={{ borderLeft:`1px solid ${tema.borde}`, background: abierto ? 'rgba(255,255,255,.07)' : 'transparent' }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.07)'}
        onMouseLeave={e => e.currentTarget.style.background = abierto ? 'rgba(255,255,255,.07)' : 'transparent'}>
        <span className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0"
          style={{ background: tema.avatarBg, border:`1px solid ${tema.avatarBorde}`, color: tema.texto }}>
          {iniciales}
        </span>
        <span className="text-sm font-semibold hidden md:block" style={{ color: tema.textoSuave }}>
          {usuario?.name?.split(' ').slice(0, 2).join(' ')}
        </span>
      </button>

      {abierto && pos && createPortal(
        <div ref={menuRef} role="menu"
          className="fixed w-72 max-w-[calc(100vw-24px)] rounded-2xl z-[10001] overflow-hidden animate-scale-in"
          style={{ top: pos.top, right: pos.right, background:'var(--panel-bg)',
                   border:'1px solid var(--card-border)', boxShadow:'0 24px 72px rgba(0,0,0,.45)' }}>

          {/* Quién eres */}
          <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom:'1px solid var(--divider)' }}>
            <span className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-black flex-shrink-0"
              style={{ background:'var(--accent)', color:'var(--accent-contrast)' }}>
              {iniciales}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold truncate" style={{ color:'var(--t1)' }}>{usuario?.name}</p>
              <p className="text-[11px] truncate" style={{ color:'var(--t3)' }}>{rol}</p>
            </div>
          </div>

          <div className="p-2">
            <button type="button" onClick={() => { setAbierto(false); onIrAConfiguracion() }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors"
              onMouseEnter={e => e.currentTarget.style.background = 'var(--soft-bg)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <span className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background:'var(--card-bg)', color:'var(--t2)', border:'1px solid var(--card-border)' }}>
                <Settings size={15}/>
              </span>
              <span className="text-xs font-bold flex-1" style={{ color:'var(--t1)' }}>Mi configuración</span>
              <ChevronRight size={14} style={{ color:'var(--t3)' }}/>
            </button>
          </div>

          {/* Identidad */}
          <div className="px-4 pb-2" style={{ borderTop:'1px solid var(--divider)' }}>
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest pt-3 pb-2"
              style={{ color:'var(--t3)' }}>
              <Palette size={11}/> Identidad
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              {IDENTIDADES.map(i => {
                const activa = appearance === i.id
                return (
                  <button key={i.id} type="button" onClick={() => setAppearance(i.id)}
                    aria-pressed={activa}
                    className="rounded-xl overflow-hidden transition-all active:scale-95"
                    style={{ border: activa ? '2px solid var(--accent)' : '1px solid var(--card-border)' }}>
                    <span className="block h-7 relative" style={{ background: i.color }}>
                      <span className="absolute left-1.5 top-2 w-5 h-0.5 rounded-full" style={{ background: i.barra }}/>
                      <span className="absolute left-1.5 top-3.5 w-3.5 h-0.5 rounded-full bg-white/30"/>
                    </span>
                    <span className="flex items-center justify-center gap-1 py-1 text-[10px] font-bold"
                      style={{ background:'var(--card-bg)', color:'var(--t2)' }}>
                      {i.label}{activa && <Check size={9} style={{ color:'var(--accent)' }}/>}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Accesibilidad */}
          <div className="px-2 pb-2 pt-1">
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-2 pt-2 pb-1"
              style={{ color:'var(--t3)' }}>
              <Accessibility size={11}/> Accesibilidad
            </p>
            <Opcion icon={Waves} titulo="Reducir movimiento"
              descripcion="Detiene el fondo animado de los grupos y las transiciones."
              activo={movimiento === 'reducido'}
              onClick={() => setMovimiento(movimiento === 'reducido' ? 'normal' : 'reducido')}/>
            <Opcion icon={Type} titulo="Texto más grande"
              descripcion="Agranda toda la interfaz un 12 %."
              activo={texto === 'grande'}
              onClick={() => setTexto(texto === 'grande' ? 'normal' : 'grande')}/>
          </div>

          <div className="p-2" style={{ borderTop:'1px solid var(--divider)' }}>
            <button type="button" onClick={() => { setAbierto(false); onCerrarSesion() }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors"
              style={{ color:'#fca5a5' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,.10)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <span className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background:'rgba(239,68,68,.10)', border:'1px solid rgba(248,113,113,.24)' }}>
                <LogOut size={15}/>
              </span>
              <span className="text-xs font-bold">Cerrar sesión</span>
            </button>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
