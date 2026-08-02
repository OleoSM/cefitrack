import { useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import ModalPortal from '../ui/ModalPortal'

/** Confirmación para acciones destructivas (borrar grupo, borrar alumno…). */
export default function ConfirmDialog({
  title, message, detail, confirmLabel = 'Eliminar', onConfirm, onClose,
}) {
  const [busy, setBusy]   = useState(false)
  const [error, setError] = useState(null)

  const handle = async () => {
    setBusy(true); setError(null)
    const res = await onConfirm()
    setBusy(false)
    if (res && res.ok === false) { setError(res.message); return }
    onClose()
  }

  return (
    <ModalPortal onClose={onClose} maxWidth="max-w-sm">
        <div className="flex items-center justify-between px-5 py-3.5"
          style={{ borderBottom: '1px solid var(--card-border)' }}>
          <div className="flex items-center gap-2">
            <AlertTriangle size={15} className="text-red-400"/>
            <h2 className="text-sm font-bold" style={{ color: 'var(--t1)' }}>{title}</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg" style={{ color: 'var(--t3)' }}>
            <X size={14}/>
          </button>
        </div>

        <div className="p-5 space-y-3">
          <p className="text-sm" style={{ color: 'var(--t2)' }}>{message}</p>
          {detail && <p className="text-xs" style={{ color: 'var(--t3)' }}>{detail}</p>}

          {error && (
            <div className="rounded-lg px-3 py-2"
              style={{ background:'var(--bad-soft)', border:'1px solid var(--bad-line)' }}>
              <span className="text-xs text-red-400">{error}</span>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancelar</button>
            <button onClick={handle} disabled={busy}
              className="flex-1 justify-center flex items-center gap-2 text-xs font-bold px-3 py-2.5 rounded-xl transition-all active:scale-95"
              style={{ background:'var(--bad-soft)', border:'1px solid var(--bad-line)', color:'var(--bad)' }}>
              {busy ? 'Eliminando…' : confirmLabel}
            </button>
          </div>
        </div>
    </ModalPortal>
  )
}
