import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { useStudentTheme } from '../../context/StudentThemeContext'

/**
 * Dropdown estilizado y theme-aware (reemplaza <select> nativos).
 * options: [{ value, label, icon? }]
 */
export default function Dropdown({ value, onChange, options, className = '', align = 'left', children }) {
  const { t } = useStudentTheme()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const close = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const sel = options.find(o => o.value === value)

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button type="button" onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-xl transition-all active:scale-95 whitespace-nowrap"
        style={{
          background: t.ddBg, color: t.t2,
          border: `1px solid ${t.cardBorder}`,
          boxShadow: t.light ? '0 1px 3px rgba(15,23,42,.06)' : 'none',
        }}>
        {sel?.icon}
        <span className="truncate">{children ?? sel?.label ?? '—'}</span>
        <ChevronDown size={13} className="flex-shrink-0 transition-transform duration-200"
          style={{ transform: open ? 'rotate(180deg)' : 'none' }} />
      </button>

      {open && (
        <div className={`absolute z-50 mt-1.5 min-w-full max-h-72 overflow-y-auto rounded-xl py-1 animate-fade-in ${align === 'right' ? 'right-0' : 'left-0'}`}
          style={{
            background: t.ddPanel,
            border: `1px solid ${t.cardBorder}`,
            boxShadow: '0 18px 48px rgba(0,0,0,.30)',
          }}>
          {options.map(o => {
            const active = o.value === value
            return (
              <button key={o.value} type="button"
                onClick={() => { onChange(o.value); setOpen(false) }}
                className="w-full flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-left transition-colors whitespace-nowrap"
                style={{
                  color: active ? (t.light ? t.accent : '#fff') : t.t2,
                  background: active ? (t.light ? `${t.accent}12` : 'rgba(255,255,255,.08)') : 'transparent',
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = t.light ? 'rgba(0,0,0,.04)' : 'rgba(255,255,255,.05)' }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}>
                {o.icon}
                <span className="flex-1">{o.label}</span>
                {active && <Check size={12} className="flex-shrink-0" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
