import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Warp } from '@paper-design/shaders-react'
import { Settings2, Check } from 'lucide-react'
import {
  useGroupColors,
  GRADIENT_PALETTES,
  SOLID_PALETTES,
  SHADER_CONFIG,
} from '../../hooks/useGroupColors'

/* ── Picker portal — fuera del overflow:hidden de la tarjeta ── */
function ColorPicker({ anchorRef, groupId, activeId, onSelect, onClose }) {
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
        background: 'rgba(8,8,15,.96)',
        backdropFilter: 'blur(28px)',
        WebkitBackdropFilter: 'blur(28px)',
        border:     '1px solid rgba(255,255,255,.12)',
        borderRadius: 20,
        boxShadow:  '0 24px 64px rgba(0,0,0,.80), 0 4px 16px rgba(0,0,0,.40)',
        padding:    16,
      }}>

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-bold" style={{ color:'rgba(255,255,255,.70)' }}>
          Apariencia del grupo
        </p>
        <button onClick={onClose}
          className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold transition-colors"
          style={{ color:'rgba(255,255,255,.35)', background:'rgba(255,255,255,.07)' }}
          onMouseEnter={e => e.currentTarget.style.color='white'}
          onMouseLeave={e => e.currentTarget.style.color='rgba(255,255,255,.35)'}>
          ✕
        </button>
      </div>

      {/* ── Degradados ── */}
      <p className="text-[9px] font-bold uppercase tracking-widest mb-2"
        style={{ color:'rgba(255,255,255,.28)' }}>
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
                  ? 'ring-2 ring-white ring-offset-2 ring-offset-[#08080f] scale-105'
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
              style={{ color: activeId === p.id ? 'rgba(255,255,255,.80)' : 'rgba(255,255,255,.30)' }}>
              {p.name}
            </span>
          </button>
        ))}
      </div>

      {/* Divider */}
      <div className="my-3 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      {/* ── Colores sólidos ── */}
      <p className="text-[9px] font-bold uppercase tracking-widest mb-2"
        style={{ color:'rgba(255,255,255,.28)' }}>
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
                  ? 'ring-2 ring-white ring-offset-2 ring-offset-[#08080f] scale-110'
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

      {/* Footer hint */}
      <p className="mt-3 text-[9px] text-center" style={{ color:'rgba(255,255,255,.20)' }}>
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
  const { getColors, getAccent, getPaletteId, getPalette, setGroupPalette } = useGroupColors()
  const [open, setOpen] = useState(false)
  const btnRef = useRef(null)

  const palette   = getPalette(group.id)
  const colors    = getColors(group.id)
  const accent    = getAccent(group.id)
  const activeId  = getPaletteId(group.id)
  const letter    = group.name.split(' ')[1] ?? group.name[0]

  return (
    /* Sin overflow-hidden en el root — lo ponemos solo en el shader layer */
    <div className={`relative rounded-2xl ${className}`}
      style={{ border:'1px solid rgba(255,255,255,.12)' }}>

      {/* ── Shader background (clipeado propio) ─────────────── */}
      <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
        {palette.type === 'gradient' ? (
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
          className={`flex items-center gap-3 sm:gap-4 p-4 sm:p-5 ${onClick ? 'cursor-pointer select-none' : ''}`}>

          {/* Accent bar */}
          <div className="w-1 self-stretch rounded-full flex-shrink-0"
            style={{ background: accent }} />

          {/* Avatar */}
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
            style={{ background: accent, boxShadow:`0 0 20px ${accent}50` }}>
            {letter}
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
                  background: open ? 'rgba(255,255,255,.18)' : 'rgba(255,255,255,.08)',
                  border:     `1px solid ${open ? 'rgba(255,255,255,.22)' : 'rgba(255,255,255,.12)'}`,
                  color:      open ? 'white' : 'rgba(255,255,255,.55)',
                }}
                onMouseEnter={e => { e.currentTarget.style.background='rgba(255,255,255,.16)'; e.currentTarget.style.color='white' }}
                onMouseLeave={e => { if (!open) { e.currentTarget.style.background='rgba(255,255,255,.08)'; e.currentTarget.style.color='rgba(255,255,255,.55)' } }}>
                <Settings2 size={14} />
              </button>
            )}

            {onClick && (
              <button type="button" onClick={onClick} aria-label="Ver grupo"
                className="w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-200"
                style={{ background:'rgba(255,255,255,.08)', color:'rgba(255,255,255,.45)' }}
                onMouseEnter={e => { e.currentTarget.style.background='rgba(255,255,255,.16)'; e.currentTarget.style.color='white' }}
                onMouseLeave={e => { e.currentTarget.style.background='rgba(255,255,255,.08)'; e.currentTarget.style.color='rgba(255,255,255,.45)' }}>
                <span className="font-bold text-sm">→</span>
              </button>
            )}
          </div>
        </div>

        {footer && (
          <div className="px-4 sm:px-5 pb-4 sm:pb-5">{footer}</div>
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
