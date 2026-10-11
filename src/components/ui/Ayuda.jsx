import { useState, useRef, useEffect, useCallback, useId } from 'react'
import { createPortal } from 'react-dom'
import { HelpCircle, X } from 'lucide-react'
import ModalPortal from './ModalPortal'

/**
 * Ayuda contextual de SIGA. Dos piezas, para que en TODA la app explicar algo
 * se vea y se use igual:
 *
 *  · <Pista texto="…">…</Pista> — globo al pasar el ratón, al enfocar con
 *    teclado o al tocar en el teléfono. Para "¿qué es este número?".
 *  · <BotonAyuda titulo="…">contenido</BotonAyuda> — el "?" de la esquina
 *    superior derecha de una sección. Al pasar el ratón dice "Acerca de…";
 *    al pulsarlo abre una ventana con la explicación completa.
 *
 * El globo va por portal a <body> y se sitúa con coordenadas de ventana: las
 * tarjetas llevan overflow-hidden y lo recortarían.
 */

const GLOBO = {
  background: 'var(--tooltip-bg)',
  border: '1px solid var(--tooltip-border)',
  color: 'var(--tooltip-text)',
  boxShadow: '0 12px 32px rgba(0,0,0,.28)',
}

function useGlobo() {
  const ancla = useRef(null)
  const [pos, setPos] = useState(null)
  const mostrar = useCallback(() => {
    const r = ancla.current?.getBoundingClientRect()
    if (!r) return
    const arriba = r.top > 96   // si no cabe arriba, debajo
    setPos({
      left: Math.min(Math.max(12, r.left + r.width / 2), window.innerWidth - 12),
      top: arriba ? r.top - 8 : r.bottom + 8,
      arriba,
    })
  }, [])
  const ocultar = useCallback(() => setPos(null), [])
  useEffect(() => {
    if (!pos) return undefined
    const cerrar = () => setPos(null)
    window.addEventListener('scroll', cerrar, true)
    window.addEventListener('resize', cerrar)
    return () => { window.removeEventListener('scroll', cerrar, true); window.removeEventListener('resize', cerrar) }
  }, [pos])
  return { ancla, pos, mostrar, ocultar }
}

function Globo({ pos, id, children }) {
  if (!pos) return null
  return createPortal(
    <div id={id} role="tooltip"
      className="fixed z-[10002] max-w-[min(18rem,calc(100vw-24px))] px-3 py-2 rounded-xl text-xs leading-snug pointer-events-none animate-scale-in"
      style={{
        ...GLOBO, left: pos.left, top: pos.top,
        transform: `translate(-50%, ${pos.arriba ? '-100%' : '0'})`,
      }}>
      {children}
    </div>,
    document.body,
  )
}

/**
 * Globo explicativo sobre cualquier elemento. Envuelve en un span enfocable
 * y con cursor de ayuda, para que se note que "aquí hay algo que leer".
 * `subrayado` añade un punteado bajo el texto (para cifras y etiquetas).
 */
export function Pista({ texto, children, subrayado = false, className = '', as: Tag = 'span' }) {
  const { ancla, pos, mostrar, ocultar } = useGlobo()
  const id = useId()
  if (!texto) return children
  return (
    <>
      <Tag ref={ancla} tabIndex={0} aria-describedby={pos ? id : undefined}
        className={`cursor-help outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] rounded ${subrayado ? 'underline decoration-dotted underline-offset-4' : ''} ${className}`}
        onMouseEnter={mostrar} onMouseLeave={ocultar}
        onFocus={mostrar} onBlur={ocultar}
        // En táctil no hay hover: un toque lo muestra y otro lo oculta. No se
        // propaga: dentro de una tarjeta pulsable, leer la ayuda no debe navegar.
        onClick={e => { e.stopPropagation(); pos ? ocultar() : mostrar() }}>
        {children}
      </Tag>
      <Globo pos={pos} id={id}>{texto}</Globo>
    </>
  )
}

/**
 * El "?" de ayuda. Va en la esquina superior derecha de la sección que
 * explica. `titulo` es el nombre de la sección ("Acerca de {titulo}").
 * `children` es la explicación: qué muestra, cómo se calcula, qué hacer.
 */
export function BotonAyuda({ titulo, children, className = '' }) {
  const [abierto, setAbierto] = useState(false)
  const { ancla, pos, mostrar, ocultar } = useGlobo()
  const id = useId()
  return (
    <>
      <button ref={ancla} type="button"
        onClick={() => { ocultar(); setAbierto(true) }}
        onMouseEnter={mostrar} onMouseLeave={ocultar} onFocus={mostrar} onBlur={ocultar}
        aria-label={`Acerca de ${titulo}`} aria-describedby={pos ? id : undefined}
        className={`w-9 h-9 min-w-9 rounded-full inline-flex items-center justify-center flex-shrink-0 ${className}`}
        style={{ background: 'var(--soft-bg)', border: '1px solid var(--card-border)', color: 'var(--t2)' }}>
        <HelpCircle size={17} strokeWidth={2}/>
      </button>
      <Globo pos={pos} id={id}>Acerca de {titulo}</Globo>
      {abierto && (
        <ModalPortal onClose={() => setAbierto(false)} maxWidth="max-w-md">
          <div className="flex items-center justify-between gap-3 px-5 py-3.5" style={{ borderBottom: '1px solid var(--divider)' }}>
            <h2 className="flex items-center gap-2 text-sm font-bold" style={{ color: 'var(--t1)' }}>
              <HelpCircle size={16} style={{ color: 'var(--accent)' }}/> Acerca de {titulo}
            </h2>
            <button type="button" onClick={() => setAbierto(false)} aria-label="Cerrar"
              className="w-11 h-11 flex items-center justify-center rounded-lg" style={{ color: 'var(--t3)' }}>
              <X size={15}/>
            </button>
          </div>
          <div className="p-5 space-y-3 text-sm leading-relaxed" style={{ color: 'var(--t2)' }}>
            {children}
          </div>
          <div className="px-5 pb-5">
            <button type="button" onClick={() => setAbierto(false)} className="btn-primary w-full justify-center">Entendido</button>
          </div>
        </ModalPortal>
      )}
    </>
  )
}

/**
 * Cabecera de sección con su "?" a la derecha: el patrón que piden todas las
 * tarjetas ("qué es esto" siempre en el mismo sitio).
 */
export function CabeceraSeccion({ titulo, subtitulo, icono: Icono, ayuda, acciones, className = '' }) {
  return (
    <div className={`flex items-start justify-between gap-3 ${className}`}>
      <div className="min-w-0">
        <h2 className="section-title flex items-center gap-2">
          {Icono && <Icono size={16}/>}{titulo}
        </h2>
        {subtitulo && <p className="text-xs mt-1" style={{ color: 'var(--t3)' }}>{subtitulo}</p>}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {acciones}
        {ayuda && <BotonAyuda titulo={titulo}>{ayuda}</BotonAyuda>}
      </div>
    </div>
  )
}
