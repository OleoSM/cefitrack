import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Warp } from '@paper-design/shaders-react'
import { Settings2, Check } from 'lucide-react'
import {
  useGroupColors,
  GRADIENT_PALETTES,
  SOLID_PALETTES,
  MATE_PALETTES,
  SHADER_CONFIG,
} from '../../hooks/useGroupColors'
import { logoInstitucion, estiloLogo } from '../../lib/instituciones'

/* ── Picker portal — fuera del overflow:hidden de la tarjeta ── */
function ColorPicker({ anchorRef, groupId, activeId, onSelect, onClose }) {
  const { isLight } = useGroupColors()
  const pickerRef = useRef(null)
  const [pos, setPos] = useState({ top:0, left:0 })

  /* Posicionar bajo el botón */
  useEffect(() => {
    if (!anchorRef.current) return
    const r = anchorRef.current.getBoundingClientRect()
    const scrollY = window.scrollY || document.documentElement.scrollTop
    setPos({
      top:  r.bottom + scrollY + 8,
      left: Math.max(8, r.right - 280),
    })
  }, [anchorRef])

  /* Cerrar al hacer clic fuera */
  useEffect(() => {
    const handler = e => {
      if (
        pickerRef.current && !pickerRef.current.contains(e.target) &&
        anchorRef.current && !anchorRef.current.contains(e.target)
      ) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [anchorRef, onClose])

  return createPortal(
    <div
      ref={pickerRef}
      style={{
        position:   'absolute',
        top:        pos.top,
        left:       pos.left,
        width:      280,
        zIndex:     9999,
        background: 'var(--panel-bg)',
        backdropFilter: 'blur(28px)',
        WebkitBackdropFilter: 'blur(28px)',
        border:     '1px solid var(--card-border)',
        borderRadius: 20,
        boxShadow:  '0 24px 64px rgba(0,0,0,.28), 0 4px 16px rgba(0,0,0,.14)',
        padding:    16,
      }}>

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-bold" style={{ color:'var(--t1)' }}>
          Apariencia del grupo
        </p>
        <button onClick={onClose}
          className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold transition-colors"
          style={{ color:'var(--t3)', background:'var(--soft-bg)' }}
          onMouseEnter={e => e.currentTarget.style.color='var(--t1)'}
          onMouseLeave={e => e.currentTarget.style.color='var(--t3)'}>
          ✕
        </button>
      </div>

      {/* ── Degradados ── */}
      <p className="text-[9px] font-bold uppercase tracking-widest mb-2"
        style={{ color:'var(--t3)' }}>
        Degradados
      </p>
      <div className="grid grid-cols-5 gap-1.5 mb-4">
        {GRADIENT_PALETTES.map(p => (
          <button
            key={p.id}
            onClick={() => { onSelect(p.id); onClose() }}
            title={p.name}
            className="relative group flex flex-col items-center gap-1">
            {/* Swatch 2×2 */}
            <div
              className={`w-11 h-11 rounded-xl overflow-hidden transition-all duration-150 ${
                activeId === p.id
                  ? 'ring-2 ring-white ring-offset-2 ring-offset-[color:var(--card-bg)] scale-105'
                  : 'opacity-65 hover:opacity-100 hover:scale-105'
              }`}
              style={{ display:'grid', gridTemplateColumns:'1fr 1fr' }}>
              {p.colors.map((c, i) => <div key={i} style={{ background:c }} />)}
            </div>
            {activeId === p.id && (
              <span className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-white flex items-center justify-center">
                <Check size={9} className="text-black" strokeWidth={3}/>
              </span>
            )}
            <span className="text-[8px] font-medium leading-none"
              style={{ color: activeId === p.id ? 'var(--t1)' : 'var(--t3)' }}>
              {p.name}
            </span>
          </button>
        ))}
      </div>

      {/* Divider */}
      <div className="my-3 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      {/* ── Colores sólidos ── */}
      <p className="text-[9px] font-bold uppercase tracking-widest mb-2"
        style={{ color:'var(--t3)' }}>
        Colores sólidos
      </p>
      <div className="grid grid-cols-6 gap-1.5">
        {SOLID_PALETTES.map(p => (
          <button
            key={p.id}
            onClick={() => { onSelect(p.id); onClose() }}
            title={p.name}
            className="relative group flex flex-col items-center gap-1">
            <div
              className={`w-9 h-9 rounded-full transition-all duration-150 ${
                activeId === p.id
                  ? 'ring-2 ring-white ring-offset-2 ring-offset-[color:var(--card-bg)] scale-110'
                  : 'opacity-70 hover:opacity-100 hover:scale-110'
              }`}
              style={{ background: p.accent }} />
            {activeId === p.id && (
              <span className="absolute top-0 right-0 w-3.5 h-3.5 rounded-full bg-white flex items-center justify-center">
                <Check size={8} className="text-black" strokeWidth={3.5}/>
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Mate ── */}
      <div className="my-3 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      <p className="text-[9px] font-bold uppercase tracking-widest mb-2"
        style={{ color:'var(--t3)' }}>
        Mate {isLight && <span style={{ color:'var(--accent)' }}>· recomendados</span>}
      </p>
      <div className="grid grid-cols-6 gap-1.5">
        {MATE_PALETTES.map(p => (
          <button
            key={p.id}
            onClick={() => { onSelect(p.id); onClose() }}
            title={p.name}
            className="relative group flex flex-col items-center gap-1">
            <div
              className={`w-9 h-9 rounded-full transition-all duration-150 ${
                activeId === p.id
                  ? 'ring-2 ring-white ring-offset-2 ring-offset-[color:var(--card-bg)] scale-110'
                  : 'opacity-70 hover:opacity-100 hover:scale-110'
              }`}
              style={{ background: isLight ? p.light.accent : p.accent }} />
            {activeId === p.id && (
              <span className="absolute top-0 right-0 w-3.5 h-3.5 rounded-full bg-white flex items-center justify-center">
                <Check size={8} className="text-black" strokeWidth={3.5}/>
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Footer hint */}
      <p className="mt-3 text-[9px] text-center" style={{ color:'var(--t4)' }}>
        El color se guarda automáticamente
      </p>
    </div>,
    document.body
  )
}

/* ── GroupShaderCard ───────────────────────────────────────── */
export default function GroupShaderCard({
  group,
  onClick,
  children,
  footer,
  showPicker = true,
  className = '',
}) {
  const { getColors, getAccent, getSurface, isLight, getPaletteId, getPalette, setGroupPalette } = useGroupColors()
  const [open, setOpen] = useState(false)
  const btnRef = useRef(null)

  const palette   = getPalette(group.id)
  const colors    = getColors(group.id)
  const accent    = getAccent(group.id)
  const surface   = getSurface(group.id)
  const activeId  = getPaletteId(group.id)
  const letter    = group.name.split(' ')[1] ?? group.name[0]
  /* La inicial es el respaldo: si el grupo tiene institución, manda su escudo.
     Una "V" no dice nada; el escudo identifica el grupo de un vistazo. */
  const logo      = logoInstitucion(group.institucion)

  return (
    /* Sin overflow-hidden en el root — lo ponemos solo en el shader layer */
    <div className={`relative rounded-2xl ${className}`}
      style={{
        border: `1px solid ${isLight ? surface : 'var(--card-border)'}`,
        boxShadow: 'var(--card-shadow)',
        overflow: 'hidden',
        /* En claro la tarjeta se pinta ENTERA del color del grupo, igual que
           en oscuro se pinta entera con el shader. Con el color de fondo, la
           escala de texto tiene que invertirse: se redefinen las variables en
           este ámbito y todo lo anidado —cabecera, métricas, pie— las hereda
           sin tener que saber nada del tema. */
        ...(isLight ? {
          '--t1': '#ffffff',
          '--t2': 'rgba(255,255,255,.82)',
          '--t3': 'rgba(255,255,255,.62)',
          '--t4': 'rgba(255,255,255,.45)',
          '--divider': 'rgba(255,255,255,.20)',
          '--card-border': 'rgba(255,255,255,.24)',
          '--soft-bg': 'rgba(255,255,255,.12)',
          '--card-bg': 'rgba(255,255,255,.10)',
        } : {}),
      }}>

      {/* ── Fondo ───────────────────────────────────────────────
          En identidad clara no se usa el shader: sobre página blanca el velo
          negro que necesita convertía la tarjeta en un bloque oscuro.

          Tampoco se usa un tinte que degrada a blanco: eso era lo que se veía
          "transparente". El fondo es la superficie normal de tarjeta, opaca, y
          el color del grupo se afirma en una franja lateral sólida. */}
      <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
        {isLight ? (
          <div className="absolute inset-0" style={{ background: surface }} />
        ) : palette.type === 'gradient' ? (
          <>
            <Warp style={{ width:'100%', height:'100%' }} colors={colors} {...SHADER_CONFIG} />
            <div className="absolute inset-0" style={{ background:'rgba(0,0,0,.72)' }} />
          </>
        ) : (
          /* Sólido: fondo + glow sutil del color de acento */
          <div className="absolute inset-0" style={{
            background: `linear-gradient(135deg, ${palette.bg} 0%, #08080f 100%)`,
          }}>
            <div className="absolute inset-0" style={{
              background: `radial-gradient(ellipse 70% 70% at 80% 50%, ${accent}18 0%, transparent 70%)`,
            }} />
          </div>
        )}
      </div>

      {/* ── Contenido ──────────────────────────────────────── */}
      <div className="relative z-10 flex flex-col">

        {/* Header */}
        <div
          role={onClick ? 'button' : undefined}
          tabIndex={onClick ? 0 : undefined}
          onClick={onClick}
          onKeyDown={onClick ? e => e.key === 'Enter' && onClick() : undefined}
          className={`flex items-center gap-3 sm:gap-4 p-3 sm:p-5 ${onClick ? 'cursor-pointer select-none' : ''}`}>

          {/* Franja de acento. En claro ya la dibuja el fondo a todo lo alto. */}
          {!isLight && (
            <div className="w-1 self-stretch rounded-full flex-shrink-0"
              style={{ background: accent }} />
          )}

          {/* Avatar: escudo de la institución, o la inicial si no tiene */}
          <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center text-white font-bold text-base sm:text-lg flex-shrink-0"
            style={{
              // Con escudo no hay recuadro: se pinta en silueta blanca sobre el
              // color del grupo. El fondo blanco de antes se recortaba contra
              // la tarjeta y se veía como un parche.
              background: logo ? 'transparent' : (isLight ? 'rgba(255,255,255,.18)' : accent),
              border: (!logo && isLight) ? '1px solid rgba(255,255,255,.35)' : 'none',
              boxShadow: (logo || isLight) ? 'none' : `0 0 20px ${accent}50` }}>
            {logo
              ? <img src={logo.src} alt={logo.alt} style={estiloLogo(true)}
                  className="w-full h-full object-contain"/>
              : letter}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0 overflow-hidden">{children}</div>

          {/* Controls — stopPropagation para no disparar onClick del header */}
          <div className="flex items-center gap-1.5 flex-shrink-0"
            onClick={e => e.stopPropagation()}
            onKeyDown={e => e.stopPropagation()}>

            {showPicker && (
              <button
                ref={btnRef}
                onClick={e => { e.stopPropagation(); setOpen(o => !o) }}
                aria-label="Cambiar apariencia del grupo"
                title="Cambiar apariencia"
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200"
                style={{
                  background: open ? 'var(--soft-bg)' : 'var(--soft-bg)',
                  border:     `1px solid ${open ? 'var(--card-border)' : 'var(--card-border)'}`,
                  color:      open ? 'var(--t1)' : 'var(--t2)',
                }}
                onMouseEnter={e => { e.currentTarget.style.background='var(--soft-bg)'; e.currentTarget.style.color='var(--t1)' }}
                onMouseLeave={e => { if (!open) { e.currentTarget.style.background='var(--soft-bg)'; e.currentTarget.style.color='var(--t2)' } }}>
                <Settings2 size={14} />
              </button>
            )}

            {onClick && (
              <button type="button" onClick={onClick} aria-label="Ver grupo"
                className="w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-200"
                style={{ background:'var(--soft-bg)', color:'var(--t2)' }}
                onMouseEnter={e => { e.currentTarget.style.background='var(--soft-bg)'; e.currentTarget.style.color='var(--t1)' }}
                onMouseLeave={e => { e.currentTarget.style.background='var(--soft-bg)'; e.currentTarget.style.color='var(--t2)' }}>
                <span className="font-bold text-sm">→</span>
              </button>
            )}
          </div>
        </div>

        {footer && (
          <div className="px-3 sm:px-5 pb-3 sm:pb-5">{footer}</div>
        )}
      </div>

      {/* Picker renderizado en document.body via portal */}
      {open && (
        <ColorPicker
          anchorRef={btnRef}
          groupId={group.id}
          activeId={activeId}
          onSelect={pid => setGroupPalette(group.id, pid)}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  )
}
