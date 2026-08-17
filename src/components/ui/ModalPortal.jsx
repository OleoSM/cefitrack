import { useEffect } from 'react'
import { createPortal } from 'react-dom'

/**
 * Envoltura estándar de modales.
 *
 * Va por portal a document.body a propósito: el contenedor de página de
 * AdminLayout lleva `animate-page-in`, cuyo keyframe final deja un
 * `transform: translateY(0)` aplicado (fill-mode both). Un transform distinto
 * de none convierte a ese div en bloque contenedor de sus hijos `fixed`, así
 * que el modal se centraría respecto al contenido de la página (y aparecería
 * desplazado hacia abajo al hacer scroll) en vez de respecto a la ventana.
 */
export default function ModalPortal({
  onClose, children, maxWidth = 'max-w-md', scrollable = false,
}) {
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKey)
    // se bloquea el scroll de fondo mientras el modal está abierto
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
      style={{ background:'rgba(0,0,0,.65)', backdropFilter:'blur(6px)' }}
      onClick={onClose}>
      <div role="dialog" aria-modal="true"
        className={`w-full min-w-0 ${maxWidth} max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain rounded-2xl animate-scale-in ${scrollable ? 'overflow-y-auto' : ''}`}
        style={{
          background:'var(--panel-bg)',
          border: '1px solid var(--card-border)',
          boxShadow:'0 32px 80px rgba(0,0,0,.70)',
        }}
        onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>,
    document.body,
  )
}
