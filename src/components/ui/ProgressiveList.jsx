import { useEffect, useState } from 'react'
import { ChevronDown, SlidersHorizontal, X } from 'lucide-react'
import { usePageSize, useBreakpoint } from '../../hooks/useBreakpoint'

/**
 * Renderiza el arranque de una lista y deja el resto detrás de un botón.
 *
 * Regla del proyecto: no volcar el conjunto completo de golpe. En un teléfono
 * eso obliga a recorrer decenas de filas antes de poder siquiera filtrar, y en
 * pantallas grandes sigue siendo scroll que nadie pidió.
 *
 * `items` ya viene filtrado y ordenado; aquí sólo se decide cuántos se montan.
 */
export default function ProgressiveList({
  items, children, sizes, className = '', emptyLabel = 'Sin resultados.',
  as: Wrapper = 'div', colSpan,
}) {
  const paso = usePageSize(sizes)
  const [visibles, setVisibles] = useState(paso)

  // Al cambiar el filtro (u orden) la lista se acorta sola: si no, tras abrir
  // "mostrar más" un filtro nuevo aparecería ya expandido sin haberlo pedido.
  useEffect(() => { setVisibles(paso) }, [paso, items.length])

  // Dentro de una tabla el envoltorio es `tbody` y el botón tiene que ir en su
  // propia fila: un <div> o un <button> suelto ahí sería HTML inválido y el
  // navegador lo sacaría de la tabla al reparar el árbol.
  const enTabla = Wrapper === 'tbody'

  if (items.length === 0) {
    const vacio = (
      <p className="text-sm py-8 text-center" style={{ color:'var(--t3)' }}>{emptyLabel}</p>
    )
    return enTabla
      ? <tbody><tr><td colSpan={colSpan ?? 99}>{vacio}</td></tr></tbody>
      : vacio
  }

  const mostrados = items.slice(0, visibles)
  const restantes = items.length - mostrados.length

  const boton = restantes > 0 && (
    <button onClick={() => setVisibles(v => v + paso)}
      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-colors"
      style={{ background:'var(--soft-bg)', border:'1px solid var(--card-border)', color:'var(--t2)' }}
      onMouseEnter={e => e.currentTarget.style.background='var(--divider)'}
      onMouseLeave={e => e.currentTarget.style.background='var(--soft-bg)'}>
      <ChevronDown size={15}/>
      Mostrar {Math.min(paso, restantes)} más
      <span style={{ color:'var(--t3)' }}>({restantes} restantes)</span>
    </button>
  )

  if (enTabla) return (
    <tbody className={className}>
      {mostrados.map(children)}
      {boton && <tr><td colSpan={colSpan ?? 99} className="p-2">{boton}</td></tr>}
    </tbody>
  )

  return (
    <>
      <Wrapper className={className}>{mostrados.map(children)}</Wrapper>
      {boton}
    </>
  )
}

/**
 * Barra de filtros que en móvil arranca plegada tras un botón.
 *
 * Los filtros son justo lo que hay que ofrecer *antes* que los datos, así que
 * no se ocultan: se compactan. El contador avisa cuántos están activos para
 * que nadie se pregunte por qué la lista salió corta.
 */
export function FilterBar({ activos = 0, children, acciones = null }) {
  const { isMobile } = useBreakpoint()
  const [abierto, setAbierto] = useState(false)
  const plegable = isMobile

  return (
    <div data-filter-bar className="card p-3 sm:p-4 min-w-0 max-w-full">
      {plegable && (
        <div className="flex items-center gap-2">
          <button onClick={() => setAbierto(a => !a)}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-colors"
            style={{ background:'var(--soft-bg)', border:'1px solid var(--card-border)', color:'var(--t2)' }}>
            {abierto ? <X size={15}/> : <SlidersHorizontal size={15}/>}
            {abierto ? 'Cerrar filtros' : 'Filtros'}
            {activos > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                style={{ background:'var(--accent)', color:'#fff' }}>{activos}</span>
            )}
          </button>
          {acciones}
        </div>
      )}

      {(!plegable || abierto) && (
        <div className={`flex flex-wrap gap-3 items-end min-w-0 ${plegable ? 'mt-3' : ''}`}>
          {children}
          {!plegable && acciones}
        </div>
      )}
    </div>
  )
}
