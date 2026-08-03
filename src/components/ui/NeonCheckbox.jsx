import { useState } from 'react'
import { useAdminTheme } from '../../context/AdminThemeContext'

/**
 * NeonCheckbox — checkbox animado con efecto neon.
 * Props:
 *   label        — texto/nodo al lado del checkbox
 *   checked      — controlado (optional)
 *   defaultChecked — no controlado (optional)
 *   onChange     — callback
 *   color        — color neón para el tema oscuro (default '#00ffaa').
 *                  En identidad clara se ignora: se usa el acento del tema y
 *                  se suprime todo el efecto de resplandor.
 *   className    — clases extra al label wrapper
 */
export function NeonCheckbox({
  label,
  className = '',
  checked: controlledChecked,
  defaultChecked = false,
  onChange,
  color = '#00ffaa',
  ...props
}) {
  const { t } = useAdminTheme()
  const claro = !!t?.light

  const [internal, setInternal] = useState(defaultChecked)
  const isControlled = controlledChecked !== undefined
  const isChecked    = isControlled ? controlledChecked : internal

  const handle = e => {
    if (!isControlled) setInternal(e.target.checked)
    onChange?.(e)
  }

  // En identidad clara el efecto neón entero queda fuera: el color por defecto
  // (#00ffaa), el resplandor, el blur y las partículas. Se sirve el acento del
  // tema, sin brillo. Ver la regla de color al inicio de index.css.
  const tono   = claro ? (t.accent ?? '#881126') : color
  const glow   = tono + '33'

  return (
    <label
      className={`relative inline-flex items-center gap-2.5 cursor-pointer select-none group ${className}`}>
      <input
        type="checkbox"
        className="hidden"
        checked={isChecked}
        onChange={handle}
        {...props}
      />

      {/* ── Caja ── */}
      <div className="relative w-[22px] h-[22px] flex-shrink-0">

        {/* Marco */}
        <div
          className="absolute inset-0 rounded-md transition-all duration-300"
          style={{
            background:  isChecked ? `${tono}18` : (claro ? 'var(--card-bg)' : 'rgba(0,0,0,.60)'),
            border:      `2px solid ${isChecked ? tono : (claro ? 'var(--card-border)' : tono + '55')}`,
            boxShadow:   isChecked && !claro ? `0 0 10px ${glow}, inset 0 0 6px ${glow}` : 'none',
          }}>

          {/* Check SVG */}
          <svg
            viewBox="0 0 24 24"
            className="absolute inset-[2px] w-[calc(100%-4px)] h-[calc(100%-4px)] transition-all duration-300"
            style={{
              fill:            'none',
              stroke:          tono,
              strokeWidth:     3,
              strokeLinecap:   'round',
              strokeLinejoin:  'round',
              strokeDasharray: 40,
              strokeDashoffset: isChecked ? 0 : 40,
              transform:       isChecked ? 'scale(1.1)' : 'scale(1)',
              opacity:         isChecked ? 1 : 0,
              transition:      'stroke-dashoffset 0.35s cubic-bezier(0.16,1,0.3,1), transform 0.35s, opacity 0.2s',
            }}>
            <path d="M3,12.5l7,7L21,5" />
          </svg>

          {/* Glow blur */}
          <div
            className="absolute -inset-1 rounded-lg blur-md transition-opacity duration-300 pointer-events-none"
            style={{ background: tono, opacity: isChecked && !claro ? 0.18 : 0 }}
          />

          {/* Partículas — solo visibles al activar */}
          {isChecked && !claro && [...Array(8)].map((_, i) => {
            const angle  = (i / 8) * 360
            const dist   = 14 + (i % 2) * 6
            const dx     = Math.cos((angle * Math.PI) / 180) * dist
            const dy     = Math.sin((angle * Math.PI) / 180) * dist
            return (
              <span
                key={i}
                className="absolute w-1 h-1 rounded-full pointer-events-none neon-particle"
                style={{
                  background:  tono,
                  boxShadow:   `0 0 4px ${tono}`,
                  top:  '50%',
                  left: '50%',
                  '--dx': `${dx}px`,
                  '--dy': `${dy}px`,
                  animationDelay: `${i * 0.02}s`,
                }}
              />
            )
          })}
        </div>

        {/* Anillos de pulso */}
        {isChecked && !claro && [...Array(2)].map((_, i) => (
          <div
            key={i}
            className="absolute -inset-2 rounded-full border pointer-events-none neon-ring"
            style={{
              borderColor:      tono,
              animationDelay:  `${i * 0.12}s`,
            }}
          />
        ))}
      </div>

      {/* ── Label ── */}
      {label && (
        <span
          className="text-sm font-semibold transition-colors duration-200"
          style={{ color: isChecked ? tono : 'var(--t2)' }}>
          {label}
        </span>
      )}
    </label>
  )
}
