/**
 * DataTable — SIGA CEFIMAT dark-glass table primitive.
 * Replaces all <table> usages. Pattern inspired by member-list component.
 *
 * Usage:
 *   <DataTable
 *     columns={[{ key, label, className? }]}
 *     rows={data}
 *     renderRow={(item) => <DataTableRow key={item.id} cells={[...]} />}
 *     emptyIcon={<Icon/>}
 *     emptyText="Sin resultados"
 *   />
 */
import { forwardRef } from 'react'

/* ── Root wrapper ──────────────────────────────────────────── */
export const DataTable = forwardRef(function DataTable(
  { columns, children, emptyIcon, emptyText, isEmpty = false, className = '' },
  ref
) {
  return (
    <div ref={ref}
      className={`w-full overflow-hidden rounded-2xl ${className}`}
      style={{ background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.08)' }}>

      {/* Sticky header */}
      <div className="flex items-center px-5 py-2.5 sticky top-0 z-10 overflow-x-auto"
        style={{
          background: 'rgba(5,5,10,.70)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(255,255,255,.07)',
        }}>
        {columns.map(col => (
          <div key={col.key}
            className={`text-[10px] font-bold uppercase tracking-widest select-none flex-shrink-0 ${col.className ?? ''}`}
            style={{ color:'rgba(255,255,255,.40)' }}>
            {col.label}
          </div>
        ))}
      </div>

      {/* Rows */}
      {isEmpty ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3"
          style={{ color:'rgba(255,255,255,.25)' }}>
          {emptyIcon && <div className="opacity-40">{emptyIcon}</div>}
          <p className="text-sm">{emptyText ?? 'Sin resultados'}</p>
        </div>
      ) : (
        <div className="w-full overflow-x-auto">
          {children}
        </div>
      )}
    </div>
  )
})

/* ── Single row ────────────────────────────────────────────── */
export function DataTableRow({ cells = [], onClick, className = '', style: rowStyle = {} }) {
  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? e => e.key === 'Enter' && onClick() : undefined}
      className={`flex items-center px-5 py-3 transition-all duration-200 cursor-default ${onClick ? 'cursor-pointer' : ''} ${className}`}
      style={{ borderBottom:'1px solid rgba(255,255,255,.05)', ...rowStyle }}
      onMouseEnter={e => { e.currentTarget.style.filter = 'brightness(1.3)' }}
      onMouseLeave={e => { e.currentTarget.style.filter = '' }}>
      {cells.map((cell, i) => (
        <div key={i} className={`flex-shrink-0 ${cell.className ?? ''}`}>
          {cell.content}
        </div>
      ))}
    </div>
  )
}

/* ── Avatar cell helper (member-list pattern) ──────────────── */
export function DataTableAvatar({ initials, statusColor, name, sub, accentColor }) {
  return (
    <div className="flex items-center gap-2.5 overflow-hidden">
      {/* Avatar with status dot */}
      <div className="relative flex-shrink-0">
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold transition-all duration-300"
          style={accentColor
            ? { background:`${accentColor}30`, color: accentColor, border:`1px solid ${accentColor}60`, boxShadow:`0 0 10px ${accentColor}30` }
            : { background:'rgba(255,255,255,.10)', color:'rgba(255,255,255,.70)', border:'1px solid rgba(255,255,255,.10)' }
          }>
          {initials}
        </div>
        {statusColor && (
          <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2"
            style={{ background: statusColor, borderColor:'#08080f' }} />
        )}
      </div>
      {/* Name + sub */}
      <div className="min-w-0">
        <p className="text-sm font-semibold truncate" style={{ color:'rgba(255,255,255,.90)' }}>{name}</p>
        {sub && <p className="text-[11px] truncate" style={{ color:'rgba(255,255,255,.40)' }}>{sub}</p>}
      </div>
    </div>
  )
}

/* ── Badge cell helper ─────────────────────────────────────── */
export function DataTableBadge({ label, dot, bg, color, border }) {
  return (
    <span className={`badge ${bg} ${color} border ${border}`}>
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />}
      {label}
    </span>
  )
}

/* ── Progress bar cell helper ──────────────────────────────── */
export function DataTableBar({ value, max = 100, color, label }) {
  const pct = Math.min(100, (value / max) * 100)
  return (
    <div className="flex items-center gap-2">
      <div className="w-14 h-1.5 rounded-full overflow-hidden flex-shrink-0"
        style={{ background:'rgba(255,255,255,.10)' }}>
        <div className="h-full rounded-full transition-all" style={{ width:`${pct}%`, background: color }} />
      </div>
      <span className="text-xs font-semibold flex-shrink-0" style={{ color:'rgba(255,255,255,.65)' }}>
        {label}
      </span>
    </div>
  )
}
