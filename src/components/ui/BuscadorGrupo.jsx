import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Search, X, Check } from 'lucide-react'

/**
 * Búsqueda de grupo, igual en todas las vistas (filtros de todas las
 * pantallas, Subir material…).
 *
 * Una barra: al tocarla se despliegan los primeros 5 grupos; al escribir se
 * muestran las coincidencias; al bajar con el scroll aparecen 5 más; al salir
 * de la barra (o elegir) se cierra.
 *
 * La lista se pinta en un portal sobre `document.body`, anclada a la barra con
 * `position: fixed`. Antes iba dentro del contenedor y cualquier padre con
 * `overflow: hidden` (tarjetas, el panel de filtros, los popups) la recortaba.
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

const PASO = 5
const ALTO_MAX = 260

export default function BuscadorGrupo({
  grupos = [], query, onQuery, seleccionado = null, onSeleccionar,
  nombreDe, placeholder = 'Buscar grupo…', className = '', autoFocus = false,
}) {
  const [abierto, setAbierto] = useState(false)
  const [cuantos, setCuantos] = useState(PASO)
  const [pos, setPos] = useState(null)   // { left, width, top?, bottom? }
  const barra = useRef(null)
  const lista = useRef(null)
  const cierre = useRef(null)
  /* Salir de la barra cierra la lista, pero con un instante de margen: en el
     teléfono el toque sobre una opción quita el foco ANTES de contar como
     clic, y sin el margen la lista desaparecía sin aceptar la elección. */
  const cerrarLuego = () => { clearTimeout(cierre.current); cierre.current = setTimeout(() => setAbierto(false), 200) }
  const abrir = () => { clearTimeout(cierre.current); setAbierto(true) }
  useEffect(() => () => clearTimeout(cierre.current), [])

  const coincidencias = filtrarGrupos(grupos, query)
  const elegido = seleccionado ? grupos.find(g => g.id === seleccionado) : null

  // Cada búsqueda vuelve a empezar por los primeros 5.
  useEffect(() => { setCuantos(PASO); if (lista.current) lista.current.scrollTop = 0 }, [query])

  /* Posición junto a la barra; si abajo no cabe, se abre hacia arriba. Se
     recalcula al hacer scroll en cualquier contenedor o al cambiar el tamaño. */
  const colocar = useCallback(() => {
    const r = barra.current?.getBoundingClientRect()
    if (!r) return
    const abajo = window.innerHeight - r.bottom
    setPos(abajo < ALTO_MAX + 16 && r.top > abajo
      ? { left: r.left, width: r.width, bottom: window.innerHeight - r.top + 4 }
      : { left: r.left, width: r.width, top: r.bottom + 4 })
  }, [])
  useLayoutEffect(() => {
    if (!abierto) return undefined
    colocar()
    window.addEventListener('scroll', colocar, true)
    window.addEventListener('resize', colocar)
    return () => { window.removeEventListener('scroll', colocar, true); window.removeEventListener('resize', colocar) }
  }, [abierto, colocar])

  const alBajar = e => {
    const el = e.currentTarget
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 24 && cuantos < coincidencias.length) setCuantos(c => c + PASO)
  }

  // Elegir acepta el grupo y cierra la lista en el acto.
  const elegir = g => {
    clearTimeout(cierre.current)
    onSeleccionar?.(g.id); onQuery(''); setAbierto(false)
    barra.current?.querySelector('input')?.blur()
  }

  return (
    <div ref={barra} className={`relative min-w-0 ${className}`}>
      <label className="relative block min-w-0">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ color:'var(--t3)' }}/>
        <input
          value={query}
          onChange={e => { onQuery(e.target.value); abrir() }}
          onFocus={abrir}
          onClick={abrir}
          onBlur={cerrarLuego}
          onKeyDown={e => {
            if (e.key === 'Escape') { setAbierto(false); e.currentTarget.blur() }
            if (e.key === 'Enter' && coincidencias[0]) { e.preventDefault(); elegir(coincidencias[0]) }
          }}
          placeholder={elegido ? elegido.name : placeholder}
          aria-label={placeholder}
          aria-expanded={abierto}
          role="combobox"
          autoComplete="off"
          autoFocus={autoFocus}
          className="input-field w-full min-h-11 pl-8 pr-8 text-xs"/>
        {(query.trim() || elegido) && (
          <button type="button" aria-label="Quitar el filtro de grupo"
            onMouseDown={e => e.preventDefault()}
            onClick={() => { onQuery(''); onSeleccionar?.(null) }}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-md flex items-center justify-center"
            style={{ color:'var(--t3)' }}>
            <X size={13}/>
          </button>
        )}
      </label>

      {abierto && pos && createPortal(
        <div data-flotante onMouseDown={e => e.preventDefault()}
          style={{ position:'fixed', left:pos.left, width:Math.max(pos.width, 220), top:pos.top, bottom:pos.bottom,
                   zIndex:10000, background:'var(--panel-bg)', border:'1px solid var(--card-border)',
                   borderRadius:12, overflow:'hidden', boxShadow:'0 16px 40px rgba(0,0,0,.35)', backdropFilter:'blur(20px)' }}>
          {coincidencias.length === 0 ? (
            <p className="px-3 py-2.5 text-xs" style={{ color:'var(--t3)' }}>
              {query.trim() ? `Ningún grupo coincide con “${query.trim()}”.` : 'No hay grupos.'}
            </p>
          ) : (
            <>
              <div ref={lista} onScroll={alBajar} role="listbox" className="overflow-y-auto overscroll-contain"
                style={{ maxHeight: ALTO_MAX }}>
                {coincidencias.slice(0, cuantos).map((g, i) => {
                  const activo = g.id === seleccionado
                  return (
                    <button key={g.id} type="button" role="option" aria-selected={activo}
                      onMouseDown={e => e.preventDefault()}
                      onPointerDown={() => clearTimeout(cierre.current)}
                      onClick={() => elegir(g)}
                      className="w-full flex items-center gap-2 px-3 min-h-11 text-left transition-colors"
                      style={{ borderTop: i === 0 ? 'none' : '1px solid var(--divider)',
                        background: activo ? 'var(--soft-bg)' : 'transparent' }}
                      onMouseEnter={e => e.currentTarget.style.background='var(--soft-bg)'}
                      onMouseLeave={e => e.currentTarget.style.background= activo ? 'var(--soft-bg)' : 'transparent'}>
                      <span className="w-4 flex-shrink-0" style={{ color:'var(--accent)' }}>{activo && <Check size={13}/>}</span>
                      <span className="text-xs font-semibold truncate" style={{ color:'var(--t1)' }}>{g.name}</span>
                      <span className="text-[10px] truncate ml-auto flex-shrink-0" style={{ color:'var(--t3)' }}>
                        {[g.subject, g.sucursal && nombreDe ? nombreDe(g.sucursal) : null].filter(Boolean).join(' · ')}
                      </span>
                    </button>
                  )
                })}
              </div>
              <p className="px-3 py-1.5 text-[10px]" style={{ color:'var(--t3)', borderTop:'1px solid var(--divider)' }}>
                {Math.min(cuantos, coincidencias.length)} de {coincidencias.length}
                {cuantos < coincidencias.length ? ' · baja para ver más o escribe para buscar' : ''}
              </p>
            </>
          )}
        </div>,
        document.body,
      )}
    </div>
  )
}
