import { useState } from 'react'
import { X, KeyRound, RefreshCw, AlertCircle } from 'lucide-react'
import { resetStudentPassword } from '../../lib/supabaseData'
import { generarPassword } from '../../lib/credentials'
import ModalPortal from '../ui/ModalPortal'

/** Restablece la contraseña de un alumno (la anterior no es recuperable). */
export default function ResetPasswordModal({ student, onClose, onDone }) {
  const [password, setPassword] = useState(generarPassword())
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState(null)

  const handleSubmit = async e => {
    e.preventDefault()
    setSaving(true); setError(null)
    const res = await resetStudentPassword(student.id, password)
    setSaving(false)
    if (!res.ok) { setError(res.message); return }
    onDone({ nombre: student.name, usuario: student.email, password })
    onClose()
  }

  return (
    <ModalPortal onClose={onClose} maxWidth="max-w-sm">
        <div className="flex items-center justify-between px-5 py-3.5"
          style={{ borderBottom: '1px solid var(--card-border)' }}>
          <div className="flex items-center gap-2">
            <KeyRound size={15} style={{ color:'var(--warn)' }}/>
            <h2 className="text-sm font-bold" style={{ color: 'var(--t1)' }}>Restablecer contraseña</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg" style={{ color: 'var(--t3)' }}>
            <X size={14}/>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          <p className="text-sm" style={{ color: 'var(--t2)' }}>
            Se asignará una contraseña nueva a <span className="font-semibold" style={{ color: 'var(--t1)' }}>{student.name}</span>.
          </p>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5"
              style={{ color: 'var(--t3)' }}>Nueva contraseña</label>
            <div className="flex gap-2">
              <input required value={password} onChange={e => setPassword(e.target.value)}
                className="input-field flex-1 font-mono"/>
              <button type="button" onClick={() => setPassword(generarPassword())} className="btn-secondary px-3">
                <RefreshCw size={14}/>
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg px-3 py-2"
              style={{ background:'var(--bad-soft)', border:'1px solid var(--bad-line)' }}>
              <AlertCircle size={13} className="mt-0.5 shrink-0 text-red-400"/>
              <span className="text-xs text-red-400">{error}</span>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Cancelar</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
              {saving ? 'Aplicando…' : 'Restablecer'}
            </button>
          </div>
        </form>
    </ModalPortal>
  )
}
