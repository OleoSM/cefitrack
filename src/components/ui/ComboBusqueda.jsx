import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Search, X } from 'lucide-react'

/**
 * Caja de búsqueda con lista flotante — el mismo comportamiento en todas las
 * pantallas:
 *   · al tocarla se despliegan las primeras 5 opciones;
 *   · al escribir se muestran solo las coincidencias;
 *   · al bajar con el scroll aparecen 5 más;
 *   · tocar una opción la acepta y cierra; salir de la caja también cierra.
 *
 * La lista va en un portal con `position: fixed`, anclada a la caja: dentro de
 * tarjetas o paneles con `overflow: hidden` se recortaba. Lleva `data-flotante`
 * para que el panel de filtros no la tome como un toque "fuera".
 *
 * `opciones`: [{ id, label, sub? }]. Se filtran aquí por label y sub.
 */
const PASO = 5
const ALTO_MAX = 260
const normal = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('es-MX')

export default function ComboBusqueda({
  value, onChange, opciones = [], onElegir, placeholder = 'Buscar…', className = '', vacio = 'Sin coincidencias.',
}) {
  const [abierto, setAbierto] = useState(false)
  const [cuantos, setCuantos] = useState(PASO)
  const [pos, setPos] = useState(null)
  const caja = useRef(null)
  const lista = useRef(null)
  const cierre = useRef(null)

  const q = normal(value).trim()
  const coincidencias = q ? opciones.filter(o => normal(`${o.label} ${o.sub ?? ''}`).includes(q)) : opciones

  useEffect(() => { setCuantos(PASO); if (lista.current) lista.current.scrollTop = 0 }, [value])
  useEffect(() => () => clearTimeout(cierre.current), [])

  // En el teléfono el toque sobre una opción quita el foco ANTES del clic: el
  // cierre espera un instante para que la elección se acepte.
  const cerrarLuego = () => { clearTimeout(cierre.current); cierre.current = setTimeout(() => setAbierto(false), 200) }
  const abrir = () => { clearTimeout(cierre.current); setAbierto(true) }

  const colocar = useCallback(() => {
    const r = caja.current?.getBoundingClientRect()
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

  const elegir = o => {
    clearTimeout(cierre.current)
    setAbierto(false)
    caja.current?.querySelector('input')?.blur()
    onElegir?.(o.id, o)
  }

  return (
    <div ref={caja} className={`relative min-w-0 ${className}`}>
      <label className="relative block min-w-0">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color:'var(--t3)' }}/>
        <input value={value} role="combobox" aria-expanded={abierto} autoComplete="off"
          onChange={e => { onChange(e.target.value); abrir() }}
          onFocus={abrir} onClick={abrir} onBlur={cerrarLuego}
          onKeyDown={e => {
            if (e.key === 'Escape') { setAbierto(false); e.currentTarget.blur() }
            if (e.key === 'Enter' && coincidencias[0]) { e.preventDefault(); elegir(coincidencias[0]) }
          }}
          placeholder={placeholder} aria-label={placeholder}
          className="input-field w-full min-h-11 pl-8 pr-8 text-xs"/>
        {value && (
          <button type="button" aria-label="Borrar búsqueda" onMouseDown={e => e.preventDefault()} onClick={() => onChange('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-md flex items-center justify-center" style={{ color:'var(--t3)' }}>
            <X size={13}/>
          </button>
        )}
      </label>

      {abierto && pos && createPortal(
        <div data-flotante onMouseDown={e => e.preventDefault()}
          style={{ position:'fixed', left:pos.left, width:Math.max(pos.width, 240), top:pos.top, bottom:pos.bottom,
                   zIndex:10000, background:'var(--panel-bg)', border:'1px solid var(--card-border)', borderRadius:12,
                   overflow:'hidden', boxShadow:'0 16px 40px rgba(0,0,0,.35)', backdropFilter:'blur(20px)' }}>
          {coincidencias.length === 0 ? (
            <p className="px-3 py-2.5 text-xs" style={{ color:'var(--t3)' }}>{q ? `Ninguna coincidencia para “${value.trim()}”.` : vacio}</p>
          ) : (
            <>
              <div ref={lista} onScroll={alBajar} role="listbox" className="overflow-y-auto overscroll-contain" style={{ maxHeight: ALTO_MAX }}>
                {coincidencias.slice(0, cuantos).map((o, i) => (
                  <button key={o.id} type="button" role="option"
                    onMouseDown={e => e.preventDefault()} onPointerDown={() => clearTimeout(cierre.current)}
                    onClick={() => elegir(o)}
                    className="w-full flex items-center gap-2 px-3 min-h-11 text-left transition-colors"
                    style={{ borderTop: i === 0 ? 'none' : '1px solid var(--divider)' }}
                    onMouseEnter={e => e.currentTarget.style.background='var(--soft-bg)'}
                    onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                    <span className="text-xs font-semibold truncate" style={{ color:'var(--t1)' }}>{o.label}</span>
                    {o.sub && <span className="text-[10px] truncate ml-auto flex-shrink-0" style={{ color:'var(--t3)' }}>{o.sub}</span>}
                  </button>
                ))}
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
