import { Search, X } from 'lucide-react'

/**
 * Búsqueda de grupo, igual en todas las vistas.
 *
 * Cada pantalla tenía su propia forma de llegar a un grupo —un desplegable
 * aquí, botones allá, nada en varias— y con 28 grupos repartidos en cinco
 * sedes eso significaba recorrer una lista larga en cada una. La barra es la
 * misma en todas y hace lo mismo: se escribe, se ven las coincidencias, se
 * elige una.
 *
 * `grupos` ya viene acotado por la sucursal activa: aquí sólo se filtra por
 * nombre. `seleccionado` es el id del grupo elegido, o null.
 */
export const filtrarGrupos = (grupos, texto) => {
  const q = texto.trim().toLocaleLowerCase('es-MX')
  if (!q) return grupos
  return grupos.filter(g =>
    (g.name ?? '').toLocaleLowerCase('es-MX').includes(q)
    || (g.subject ?? '').toLocaleLowerCase('es-MX').includes(q))
}

const MAX = 8

export default function BuscadorGrupo({
  grupos = [], query, onQuery, seleccionado = null, onSeleccionar,
  nombreDe, placeholder = 'Buscar grupo…', className = '',
}) {
  const escribiendo = !!query.trim()
  const coincidencias = escribiendo ? filtrarGrupos(grupos, query) : []
  const elegido = seleccionado ? grupos.find(g => g.id === seleccionado) : null

  return (
    <div className={`relative min-w-0 ${className}`}>
      <label className="relative block min-w-0">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ color:'var(--t3)' }}/>
        <input
          value={query}
          onChange={e => onQuery(e.target.value)}
          placeholder={elegido ? elegido.name : placeholder}
          aria-label={placeholder}
          className="input-field w-full min-h-11 pl-8 pr-8 text-xs"/>
        {(escribiendo || elegido) && (
          <button type="button" aria-label="Quitar el filtro de grupo"
            onClick={() => { onQuery(''); onSeleccionar?.(null) }}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-md flex items-center justify-center"
            style={{ color:'var(--t3)' }}>
            <X size={13}/>
          </button>
        )}
      </label>

      {/* Las coincidencias van por encima del contenido, no empujándolo: si la
          lista abriera hueco, la página daría un salto con cada tecla. */}
      {escribiendo && (
        <div className="absolute left-0 right-0 top-full mt-1 z-30 rounded-xl overflow-hidden"
          style={{ background:'var(--panel-bg)', border:'1px solid var(--card-border)',
                   boxShadow:'0 16px 40px rgba(0,0,0,.35)' }}>
          {coincidencias.length === 0 ? (
            <p className="px-3 py-2.5 text-xs" style={{ color:'var(--t3)' }}>
              Ningún grupo coincide con “{query.trim()}”.
            </p>
          ) : (
            <>
              {coincidencias.slice(0, MAX).map((g, i) => (
                <button key={g.id} type="button"
                  onClick={() => { onSeleccionar?.(g.id); onQuery('') }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left transition-colors"
                  style={{ borderTop: i === 0 ? 'none' : '1px solid var(--divider)' }}
                  onMouseEnter={e => e.currentTarget.style.background='var(--soft-bg)'}
                  onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                  <span className="text-xs font-semibold truncate" style={{ color:'var(--t1)' }}>{g.name}</span>
                  <span className="text-[10px] truncate ml-auto flex-shrink-0" style={{ color:'var(--t3)' }}>
                    {[g.subject, g.sucursal && nombreDe ? nombreDe(g.sucursal) : null].filter(Boolean).join(' · ')}
                  </span>
                </button>
              ))}
              {coincidencias.length > MAX && (
                <p className="px-3 py-1.5 text-[10px]"
                  style={{ color:'var(--t3)', borderTop:'1px solid var(--divider)' }}>
                  y {coincidencias.length - MAX} más — afina la búsqueda
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
