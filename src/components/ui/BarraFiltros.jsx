import { useState, useRef, useEffect } from 'react'
import { SlidersHorizontal, X, Search, Check } from 'lucide-react'
import BuscadorGrupo from './BuscadorGrupo'

/**
 * Barra de filtros de una sola entrada.
 *
 * Antes cada filtro era un desplegable suelto en la barra: cuatro controles
 * compitiendo por el ancho, sin rótulo que dijera qué filtraba cada uno, y en
 * pantalla chica uno debajo de otro ocupando la altura entera antes de llegar
 * a los datos.
 *
 * Aquí sólo hay un botón —«Filtros», con el número de los que están puestos—.
 * Lo que SÍ se ve siempre son las fichas de los filtros activos: se lee de un
 * vistazo por qué la lista salió como salió, y cada una se quita por separado
 * sin abrir el panel. Los desplegables viven dentro, rotulados y en rejilla.
 *
 * `filtros`: [{ id, label, value, onChange, options, porDefecto }]
 *   Un filtro cuenta como activo cuando su valor difiere de `porDefecto`.
 *   Con `tipo:'grupo'` el control deja de ser un desplegable y pasa a ser el
 *   buscador de grupos —hacen falta `grupos`, `query`, `onQuery`—: una lista
 *   de veintiocho entradas no se recorre, se busca.
 * `acciones`: se quedan en la fila de arriba, a la derecha. Son botones de la
 *   pantalla (dar de alta, cambiar vista), no filtros, y esconderlos tras
 *   «Filtros» los haría desaparecer.
 * `children`: controles propios de la pantalla que van DENTRO del panel.
 * `busqueda`: { value, onChange, placeholder, coincidencias, onElegir } — opcional.
 *   `coincidencias` son [{ id, label, sub }] y se listan MIENTRAS se escribe:
 *   el contador «12 grupo(s)» decía cuántos había pero no cuáles, así que
 *   había que abrir el desplegable de grupo para verlos. `onElegir` recibe el
 *   id y es quien decide qué hacer, incluido vaciar la búsqueda: hacerlo aquí
 *   disparaba el `onChange` del consumidor, que reponía el filtro a su valor
 *   por defecto y deshacía la elección recién hecha.
 * `resumen`: texto corto a la derecha (p. ej. «12 resultado(s)»).
 */
const MAX_COINCIDENCIAS = 8
export default function BarraFiltros({
  filtros = [], busqueda = null, resumen = null, acciones = null, children = null,
}) {
  const [abierto, setAbierto] = useState(false)
  const panelRef = useRef(null)
  const botonRef = useRef(null)

  const activos = filtros.filter(f => f.value !== f.porDefecto)
  const hayBusqueda = !!busqueda?.value?.trim()
  const total = activos.length + (hayBusqueda ? 1 : 0)

  /* El panel se cierra al tocar fuera. Sin telón invisible: en un teléfono ese
     rectángulo se traga los toques y la página parece congelada. */
  useEffect(() => {
    if (!abierto) return
    const fuera = e => {
      if (panelRef.current?.contains(e.target) || botonRef.current?.contains(e.target)) return
      setAbierto(false)
    }
    const escape = e => { if (e.key === 'Escape') setAbierto(false) }
    document.addEventListener('pointerdown', fuera)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', fuera)
      document.removeEventListener('keydown', escape)
    }
  }, [abierto])

  const limpiarTodo = () => {
    filtros.forEach(f => {
      if (f.value !== f.porDefecto) f.onChange(f.porDefecto)
      f.onQuery?.('')
    })
    if (hayBusqueda) busqueda.onChange('')
  }

  const etiquetaDe = f => f.tipo === 'grupo'
    ? (f.grupos?.find(g => g.id === f.value)?.name ?? f.value)
    : (f.options?.find(o => o.value === f.value)?.label ?? f.value)

  return (
    <div className="card p-2.5 sm:p-3 space-y-2 min-w-0">

      {/* Fila única: abrir filtros · buscar · cuántos hay */}
      <div className="flex items-center gap-2 min-w-0">
        <button ref={botonRef} type="button" onClick={() => setAbierto(a => !a)}
          aria-expanded={abierto} aria-controls="panel-filtros"
          className="flex items-center gap-1.5 flex-shrink-0 min-h-11 px-3 rounded-xl text-xs font-bold transition-colors active:scale-95"
          style={abierto || total > 0
            ? { background:'var(--accent)', color:'var(--accent-contrast)', border:'1px solid var(--accent)' }
            : { background:'var(--soft-bg)', color:'var(--t2)', border:'1px solid var(--card-border)' }}>
          <SlidersHorizontal size={14}/>
          <span>Filtros</span>
          {total > 0 && (
            <span className="min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center text-[10px] font-black"
              style={{ background:'var(--accent-contrast)', color:'var(--accent)' }}>{total}</span>
          )}
        </button>

        {busqueda && (
          <label className="relative flex-1 min-w-0">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color:'var(--t3)' }}/>
            <input value={busqueda.value} onChange={e => busqueda.onChange(e.target.value)}
              placeholder={busqueda.placeholder ?? 'Buscar…'} aria-label={busqueda.placeholder ?? 'Buscar'}
              className="input-field w-full min-h-11 pl-8 pr-2 text-xs"/>
          </label>
        )}

        {resumen && (
          <span className="text-[11px] flex-shrink-0 whitespace-nowrap tabular-nums" style={{ color:'var(--t3)' }}>
            {resumen}
          </span>
        )}

        {acciones}
      </div>

      {/* Coincidencias en vivo. Se listan sólo mientras hay algo escrito, así
          que no ocupan sitio cuando no se está buscando. */}
      {hayBusqueda && busqueda.coincidencias && (
        <div className="rounded-xl overflow-hidden" style={{ border:'1px solid var(--card-border)' }}>
          {busqueda.coincidencias.length === 0 ? (
            <p className="px-3 py-2.5 text-xs" style={{ color:'var(--t3)' }}>
              Ninguna coincidencia para “{busqueda.value.trim()}”.
            </p>
          ) : (
            <>
              {busqueda.coincidencias.slice(0, MAX_COINCIDENCIAS).map((c, i) => (
                <button key={c.id} type="button"
                  onClick={() => busqueda.onElegir?.(c.id)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left transition-colors"
                  style={{
                    background: 'transparent',
                    borderTop: i === 0 ? 'none' : '1px solid var(--divider)',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background='var(--soft-bg)'}
                  onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                  <span className="text-xs font-semibold truncate" style={{ color:'var(--t1)' }}>{c.label}</span>
                  {c.sub && (
                    <span className="text-[10px] truncate ml-auto flex-shrink-0" style={{ color:'var(--t3)' }}>{c.sub}</span>
                  )}
                </button>
              ))}
              {busqueda.coincidencias.length > MAX_COINCIDENCIAS && (
                <p className="px-3 py-1.5 text-[10px]" style={{ color:'var(--t3)', borderTop:'1px solid var(--divider)' }}>
                  y {busqueda.coincidencias.length - MAX_COINCIDENCIAS} más — afina la búsqueda
                </p>
              )}
            </>
          )}
        </div>
      )}

      {/* Fichas de lo que está puesto. Sólo aparecen si hay algo que mostrar,
          para que la barra no crezca cuando no filtra nada. */}
      {total > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {activos.map(f => (
            <button key={f.id} type="button" onClick={() => f.onChange(f.porDefecto)}
              title={`Quitar filtro de ${f.label.toLowerCase()}`}
              className="flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold transition-colors"
              style={{ background:'var(--soft-bg)', border:'1px solid var(--card-border)', color:'var(--t2)' }}>
              <span style={{ color:'var(--t3)' }}>{f.label}:</span>
              <span style={{ color:'var(--t1)' }}>{etiquetaDe(f)}</span>
              <X size={11} style={{ color:'var(--t3)' }}/>
            </button>
          ))}
          {hayBusqueda && (
            <button type="button" onClick={() => busqueda.onChange('')}
              title="Quitar la búsqueda"
              className="flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold"
              style={{ background:'var(--soft-bg)', border:'1px solid var(--card-border)', color:'var(--t2)' }}>
              <Search size={11} style={{ color:'var(--t3)' }}/>
              <span style={{ color:'var(--t1)' }}>“{busqueda.value.trim()}”</span>
              <X size={11} style={{ color:'var(--t3)' }}/>
            </button>
          )}
          <button type="button" onClick={limpiarTodo}
            className="px-2 py-1 rounded-full text-[11px] font-bold"
            style={{ color:'var(--accent)' }}>
            Limpiar
          </button>
        </div>
      )}

      {/* Panel: un filtro por celda, con su rótulo encima. En rejilla y no en
          fila para que el nombre del filtro quepa junto a su desplegable. */}
      {abierto && (
        <div ref={panelRef} id="panel-filtros"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-2.5"
          style={{ borderTop:'1px solid var(--divider)' }}>
          {filtros.map(f => (
            <div key={f.id} className="min-w-0">
              <label className="block text-[10px] font-bold uppercase tracking-widest mb-1"
                style={{ color:'var(--t3)' }} htmlFor={`filtro-${f.id}`}>
                {f.label}
              </label>
              {f.tipo === 'grupo' ? (
                <BuscadorGrupo grupos={f.grupos ?? []} query={f.query ?? ''} onQuery={f.onQuery}
                  seleccionado={f.value === f.porDefecto ? null : f.value}
                  onSeleccionar={id => f.onChange(id ?? f.porDefecto)}
                  nombreDe={f.nombreDe}/>
              ) : (
                <select id={`filtro-${f.id}`} value={f.value} onChange={e => f.onChange(e.target.value)}
                  className="input-field w-full min-h-11 text-xs font-semibold">
                  {f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              )}
            </div>
          ))}

          {children && <div className="sm:col-span-2 lg:col-span-3 min-w-0">{children}</div>}

          <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-1">
            <button type="button" onClick={() => setAbierto(false)}
              className="flex-1 min-h-11 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
              style={{ background:'var(--soft-bg)', border:'1px solid var(--card-border)', color:'var(--t2)' }}>
              <Check size={14}/> Listo
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
