import { useState } from 'react'

/**
 * NeonCheckbox — checkbox animado con efecto neon.
 * Props:
 *   label        — texto/nodo al lado del checkbox
 *   checked      — controlado (optional)
 *   defaultChecked — no controlado (optional)
 *   onChange     — callback
 *   color        — color neon en CSS (default '#00ffaa')
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
  const [internal, setInternal] = useState(defaultChecked)
  const isControlled = controlledChecked !== undefined
  const isChecked    = isControlled ? controlledChecked : internal

  const handle = e => {
    if (!isControlled) setInternal(e.target.checked)
    onChange?.(e)
  }

  const dark   = color  // usamos el mismo color para todo
  const glow   = color + '33'  // 20% alpha para el blur

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
            background:  isChecked ? `${color}18` : 'rgba(0,0,0,.60)',
            border:      `2px solid ${isChecked ? color : color + '55'}`,
            boxShadow:   isChecked ? `0 0 10px ${glow}, inset 0 0 6px ${glow}` : 'none',
          }}>

          {/* Check SVG */}
          <svg
            viewBox="0 0 24 24"
            className="absolute inset-[2px] w-[calc(100%-4px)] h-[calc(100%-4px)] transition-all duration-300"
            style={{
              fill:            'none',
              stroke:          color,
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
            style={{ background: color, opacity: isChecked ? 0.18 : 0 }}
          />

          {/* Partículas — solo visibles al activar */}
          {isChecked && [...Array(8)].map((_, i) => {
            const angle  = (i / 8) * 360
            const dist   = 14 + (i % 2) * 6
            const dx     = Math.cos((angle * Math.PI) / 180) * dist
            const dy     = Math.sin((angle * Math.PI) / 180) * dist
            return (
              <span
                key={i}
                className="absolute w-1 h-1 rounded-full pointer-events-none neon-particle"
                style={{
                  background:  color,
                  boxShadow:   `0 0 4px ${color}`,
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
        {isChecked && [...Array(2)].map((_, i) => (
          <div
            key={i}
            className="absolute -inset-2 rounded-full border pointer-events-none neon-ring"
            style={{
              borderColor:      color,
              animationDelay:  `${i * 0.12}s`,
            }}
          />
        ))}
      </div>

      {/* ── Label ── */}
      {label && (
        <span
          className="text-sm font-semibold transition-colors duration-200"
          style={{ color: isChecked ? color : 'rgba(255,255,255,.55)' }}>
          {label}
        </span>
      )}
    </label>
  )
}
