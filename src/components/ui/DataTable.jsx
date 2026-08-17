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
import { useAdminTheme } from '../../context/AdminThemeContext'

/**
 * Las columnas de ancho fijo no deben encogerse, pero la columna flexible SÍ:
 * con `flex-shrink-0` en todas, un nombre largo ensanchaba su celda y empujaba
 * el resto de columnas, así que cada fila alineaba distinto. La flexible lleva
 * `min-w-0` para poder encoger y truncar.
 */
const cellClass = (cn = '') =>
  `${/\bflex-grow\b|\bgrow\b/.test(cn) ? 'min-w-0' : 'flex-shrink-0'} ${cn}`

/* ── Root wrapper ──────────────────────────────────────────── */
export const DataTable = forwardRef(function DataTable(
  { columns, children, emptyIcon, emptyText, isEmpty = false, className = '' },
  ref
) {
  return (
    <div ref={ref}
      data-datatable
      className={`w-full max-w-full min-w-0 overflow-hidden rounded-2xl ${className}`}
      style={{
        background:'var(--card-bg)',
        border:'1px solid var(--card-border)',
        boxShadow:'var(--card-shadow)',
      }}>

      {/*
        Un único contenedor de scroll horizontal para encabezado y filas.
        Antes cada uno tenía el suyo, así que al desplazar la tabla las filas
        se movían y el encabezado no: las columnas quedaban desalineadas.
      */}
      <div className="w-full overflow-x-auto overscroll-x-contain">
        {/*
          Solo `min-w-full`: con `w-max` el ancho se calculaba sobre el contenido
          máximo, así que la columna flexible se estiraba al nombre completo y
          desbordaba. Así ocupa el contenedor y la columna flexible trunca; si
          aun con las columnas ocultas por breakpoint no cabe, el scroll
          horizontal del padre mueve encabezado y filas a la vez.
        */}
        <div className="min-w-full text-[clamp(0.62rem,2.2vw,0.875rem)]">

          {/* Encabezado.
              `gap`: las celdas iban pegadas una junto a otra, sin separación
              ninguna. En escritorio sobra ancho y no se nota; en un teléfono
              el contenido de una columna acaba rozando el de la siguiente
              —el caso reportado: la barra de avance y su porcentaje contra la
              columna vecina—. Se separa menos en móvil que en escritorio,
              porque ahí cada píxel cuenta para que las columnas quepan. */}
          <div className="flex items-center gap-1 md:gap-3 px-2.5 md:px-5 py-2 md:py-2.5 sticky top-0 z-10"
            style={{
              background: 'var(--header-bg)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              borderBottom: '1px solid var(--divider)',
            }}>
            {columns.map(col => (
              <div key={col.key}
                className={`text-[9px] sm:text-[11px] font-bold uppercase tracking-normal sm:tracking-wider select-none items-center ${cellClass(col.className)}`}
                style={{ color:'var(--t2)' }}>
                {col.label}
              </div>
            ))}
          </div>

          {/* Filas */}
          {!isEmpty && children}

        </div>
      </div>

      {/* El estado vacío va fuera del contenedor con ancho mínimo: si no,
          una tabla sin datos mostraría barra de scroll en móvil. */}
      {isEmpty && (
        <div className="flex flex-col items-center justify-center py-16 gap-3 px-5 text-center"
          style={{ color:'var(--t3)' }}>
          {emptyIcon && <div className="opacity-40">{emptyIcon}</div>}
          <p className="text-sm">{emptyText ?? 'Sin resultados'}</p>
        </div>
      )}
    </div>
  )
})

/* ── Single row ────────────────────────────────────────────── */
export function DataTableRow({ cells = [], onClick, className = '', style: rowStyle = {} }) {
  const { t } = useAdminTheme()
  // brightness() aclara la fila hasta el blanco sobre fondo claro; ahí el
  // realce se hace con el fondo suave del tema.
  const claro = !!t?.light
  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? e => e.key === 'Enter' && onClick() : undefined}
      data-fila=""
      className={`flex items-center gap-1 md:gap-3 px-2.5 md:px-5 py-2 md:py-2.5 min-h-[44px] md:min-h-[46px] transition-colors duration-150 cursor-default ${onClick ? 'cursor-pointer' : ''} ${className}`}
      style={{ borderBottom:'1px solid var(--divider)', background:'color-mix(in srgb, var(--card-bg) 96%, var(--soft-bg))', ...rowStyle }}
      /* `filter: brightness()` está prohibido por la regla de color: sobre
         fondo claro aclara la fila hasta el blanco. El realce es el fondo
         suave del tema, que funciona igual en las tres identidades. */
      onMouseEnter={e => { e.currentTarget.style.background = 'var(--soft-bg)' }}
      onMouseLeave={e => { e.currentTarget.style.background = '' }}>
      {cells.map((cell, i) => (
        <div key={i} data-table-cell className={`${cellClass(cell.className)} [&_svg]:max-w-[14px] [&_svg]:max-h-[14px] sm:[&_svg]:max-w-none sm:[&_svg]:max-h-none`}>
          {cell.content}
        </div>
      ))}
    </div>
  )
}

/* ── Avatar cell helper (member-list pattern) ──────────────── */
export function DataTableAvatar({ initials, statusColor, name, sub, accentColor, avatarSrc }) {
  return (
    <div className="flex items-center gap-1.5 sm:gap-2.5 overflow-hidden min-w-0">
      {/* Avatar con punto de estado. Si el alumno eligió una imagen se muestra
          ésa: es como se reconoce a sí mismo en su portal, y verla aquí ayuda
          a asociar rápido a la persona. Las iniciales quedan de respaldo. */}
      <div className="relative flex-shrink-0">
        {avatarSrc ? (
          <img src={avatarSrc} alt="" loading="lazy"
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover"
            style={{ border:'1px solid var(--card-border)' }}/>
        ) : (
        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-[9px] sm:text-[11px] font-bold transition-all duration-300"
          style={accentColor
            ? { background:`${accentColor}30`, color: accentColor, border:`1px solid ${accentColor}60`, boxShadow:`0 0 10px ${accentColor}30` }
            : { background:'var(--soft-bg)', color:'var(--t1)', border:'1px solid var(--card-border)' }
          }>
          {initials}
        </div>
        )}
        {statusColor && (
          <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2"
            style={{ background: statusColor, borderColor:'var(--card-bg)' }} />
        )}
      </div>
      {/* Name + sub */}
      <div className="min-w-0">
        <p className="text-xs sm:text-sm font-semibold truncate" style={{ color:'var(--t1)' }}>{name}</p>
        {sub && <p className="text-[9px] sm:text-[11px] truncate" style={{ color:'var(--t3)' }}>{sub}</p>}
      </div>
    </div>
  )
}

/* ── Badge cell helper ─────────────────────────────────────── */
export function DataTableBadge({ label, dot, bg, color, border }) {
  return (
    <span className={`badge text-[9px] sm:text-xs px-1.5 sm:px-2 ${bg} ${color} border ${border}`}>
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />}
      {label}
    </span>
  )
}

/* ── Progress bar cell helper ──────────────────────────────── */
export function DataTableBar({ value, max = 100, color, label }) {
  const pct = Math.min(100, (value / max) * 100)
  return (
    /* La barra encoge en móvil: con 56 px fijos, más el hueco y el
       porcentaje, el contenido llenaba casi por completo su columna de
       112 px y el número quedaba rozando la columna de al lado. */
    <div className="flex items-center gap-1.5 sm:gap-2">
      <div className="w-10 sm:w-14 h-1.5 rounded-full overflow-hidden flex-shrink-0"
        style={{ background:'var(--soft-bg)' }}>
        <div className="h-full rounded-full transition-all" style={{ width:`${pct}%`, background: color }} />
      </div>
      <span className="text-[10px] sm:text-xs font-semibold flex-shrink-0" style={{ color:'var(--t2)' }}>
        {label}
      </span>
    </div>
  )
}
