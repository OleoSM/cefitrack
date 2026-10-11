import { useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import ModalPortal from '../ui/ModalPortal'

/** Estilo de botón de peligro. Mientras no exista `.btn-danger` en index.css
    se aplica en línea, con los mismos tokens en todas las pantallas. */
export const DANGER_BTN_STYLE = {
  background:'var(--bad-soft)', border:'1px solid var(--bad-line)', color:'var(--bad)',
}

/** Confirmación para acciones destructivas (borrar grupo, borrar alumno…).
 *  `onConfirm` puede devolver `{ ok:false, message }` o lanzar: en ambos casos
 *  el error se muestra y el diálogo sigue abierto. */
export default function ConfirmDialog({
  title, message, detail, confirmLabel = 'Eliminar', busyLabel = 'Eliminando…', onConfirm, onClose,
}) {
  const [busy, setBusy]   = useState(false)
  const [error, setError] = useState(null)

  const handle = async () => {
    setBusy(true); setError(null)
    try {
      const res = await onConfirm()
      if (res && res.ok === false) { setError(res.message || 'No se pudo completar la acción.'); return }
      onClose()
    } catch (err) {
      setError(err?.message || 'No se pudo completar la acción.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <ModalPortal onClose={busy ? undefined : onClose} maxWidth="max-w-sm">
        <div className="flex items-center justify-between px-5 py-3.5"
          style={{ borderBottom: '1px solid var(--divider)' }}>
          <div className="flex items-center gap-2">
            <AlertTriangle size={15} style={{ color:'var(--bad)' }}/>
            <h2 className="text-sm font-bold" style={{ color: 'var(--t1)' }}>{title}</h2>
          </div>
          <button onClick={onClose} disabled={busy} aria-label="Cerrar"
            className="w-11 h-11 flex items-center justify-center rounded-lg disabled:opacity-40"
            style={{ color: 'var(--t3)' }}>
            <X size={15}/>
          </button>
        </div>

        <div className="p-5 space-y-3">
          <p className="text-sm" style={{ color: 'var(--t2)' }}>{message}</p>
          {detail && <p className="text-xs" style={{ color: 'var(--t3)' }}>{detail}</p>}

          {error && (
            <div role="alert" className="rounded-lg px-3 py-2"
              style={{ background:'var(--bad-soft)', border:'1px solid var(--bad-line)' }}>
              <span className="text-xs" style={{ color:'var(--bad)' }}>{error}</span>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button onClick={onClose} disabled={busy} className="btn-secondary flex-1 justify-center disabled:opacity-40">Cancelar</button>
            <button onClick={handle} disabled={busy}
              className="flex-1 justify-center flex items-center gap-2 text-sm font-bold px-3 py-2.5 rounded-xl transition-all active:scale-95 disabled:opacity-40"
              style={DANGER_BTN_STYLE}>
              {busy ? busyLabel : confirmLabel}
            </button>
          </div>
        </div>
    </ModalPortal>
  )
}
