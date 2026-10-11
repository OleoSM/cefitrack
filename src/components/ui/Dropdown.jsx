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
        aria-haspopup="listbox" aria-expanded={open}
        className="w-full sm:w-auto min-h-11 flex items-center gap-2 text-xs font-semibold px-3 rounded-xl transition-all active:scale-95 whitespace-nowrap"
        style={{
          background: t.ddBg, color: t.t2,
          border: `1px solid ${t.cardBorder}`,
          boxShadow: t.light ? '0 1px 3px rgba(15,23,42,.06)' : 'none',
        }}>
        {sel?.icon}
        <span className="truncate flex-1 text-left">{children ?? sel?.label ?? '—'}</span>
        <ChevronDown size={13} className="flex-shrink-0 transition-transform duration-200"
          style={{ transform: open ? 'rotate(180deg)' : 'none' }} />
      </button>

      {open && (
        <div role="listbox" className={`absolute z-50 mt-1.5 min-w-full max-w-[calc(100vw-2rem)] max-h-72 overflow-y-auto rounded-xl py-1 animate-fade-in ${align === 'right' ? 'right-0' : 'left-0'}`}
          style={{
            background: t.ddPanel,
            border: `1px solid ${t.cardBorder}`,
            boxShadow: '0 18px 48px rgba(0,0,0,.30)',
          }}>
          {options.map(o => {
            const active = o.value === value
            return (
              <button key={o.value} type="button" role="option" aria-selected={active}
                onClick={() => { onChange(o.value); setOpen(false) }}
                className="w-full min-h-11 flex items-center gap-2 px-3.5 text-xs font-medium text-left transition-colors whitespace-nowrap"
                style={{
                  color: active ? (t.light ? 'var(--accent)' : 'var(--t1)') : 'var(--t2)',
                  background: active ? 'var(--soft-bg)' : 'transparent',
                  fontWeight: active ? 700 : undefined,
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--soft-bg)' }}
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
