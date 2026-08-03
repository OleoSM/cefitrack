import { useState, useEffect } from 'react'
import { X, KeyRound, RefreshCw, AlertCircle, Copy, Check, Eye, EyeOff } from 'lucide-react'
import { resetStudentPassword, fetchCredencialesAlumno } from '../../lib/supabaseData'
import { generarPassword } from '../../lib/credentials'
import ModalPortal from '../ui/ModalPortal'

/**
 * Credenciales de un alumno: primero muestra las vigentes, y sólo si hace falta
 * permite cambiarlas.
 *
 * Antes esta ventana generaba una contraseña al azar nada más abrirse, de modo
 * que consultar la de alguien obligaba a cambiársela. Ahora cambiarla es una
 * acción aparte, y la nueva la escribe quien la asigna: el botón de generar es
 * una sugerencia, no una imposición.
 */
export default function ResetPasswordModal({ student, onClose, onDone }) {
  const [cred, setCred]       = useState(null)     // { email, password } vigentes
  const [cargando, setCarg]   = useState(true)
  const [verClave, setVer]    = useState(false)
  const [copiado, setCopiado] = useState(false)

  const [cambiando, setCambiando] = useState(false)
  const [password, setPassword]   = useState('')
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState(null)

  useEffect(() => {
    let vivo = true
    fetchCredencialesAlumno(student.id)
      .then(c => { if (vivo) setCred(c) })
      .catch(() => { if (vivo) setError('No se pudieron consultar las credenciales.') })
      .finally(() => { if (vivo) setCarg(false) })
    return () => { vivo = false }
  }, [student.id])

  const correo = cred?.email ?? student.email

  const copiar = () => {
    navigator.clipboard?.writeText(
      `Acceso a SIGA CEFIMAT\n\nCorreo: ${correo}\nContraseña: ${cred?.password ?? ''}\n\n` +
      `Entra en ${window.location.origin}/login con ese correo.`
    )
    setCopiado(true)
    setTimeout(() => setCopiado(false), 1800)
  }

  const handleSubmit = async e => {
    e.preventDefault()
    setSaving(true); setError(null)
    const res = await resetStudentPassword(student.id, password)
    setSaving(false)
    if (!res.ok) { setError(res.message); return }
    onDone({ nombre: student.name, usuario: res.email ?? correo, password })
    onClose()
  }

  return (
    <ModalPortal onClose={onClose} maxWidth="max-w-md">
      <div className="flex items-center justify-between px-5 py-3.5"
        style={{ borderBottom: '1px solid var(--card-border)' }}>
        <div className="flex items-center gap-2">
          <KeyRound size={15} style={{ color:'var(--warn)' }}/>
          <h2 className="text-sm font-bold" style={{ color: 'var(--t1)' }}>
            Credenciales de {student.name}
          </h2>
        </div>
        <button onClick={onClose} className="p-1 rounded-lg" style={{ color: 'var(--t3)' }}>
          <X size={14}/>
        </button>
      </div>

      <div className="p-5 space-y-4">
        {cargando && (
          <p className="text-sm" style={{ color:'var(--t3)' }}>Consultando…</p>
        )}

        {!cargando && (
          <>
            {/* ── Lo vigente ─────────────────────────────────── */}
            <div className="rounded-xl p-3.5 space-y-2.5"
              style={{ background:'var(--card-bg)', border:'1px solid var(--card-border)' }}>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest"
                  style={{ color:'var(--t3)' }}>Correo — con este se entra</p>
                <p className="text-sm font-mono font-bold mt-0.5 break-all"
                  style={{ color:'var(--t1)' }}>{correo}</p>
              </div>

              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest"
                  style={{ color:'var(--t3)' }}>Contraseña actual</p>
                {cred?.password ? (
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-sm font-mono font-bold break-all" style={{ color:'var(--warn)' }}>
                      {verClave ? cred.password : '•'.repeat(cred.password.length)}
                    </p>
                    <button onClick={() => setVer(v => !v)} className="p-1 rounded"
                      title={verClave ? 'Ocultar' : 'Mostrar'} style={{ color:'var(--t3)' }}>
                      {verClave ? <EyeOff size={13}/> : <Eye size={13}/>}
                    </button>
                  </div>
                ) : (
                  /* Las cuentas anteriores a este cambio sólo tienen el hash,
                     que no se puede revertir: hay que asignar una nueva. */
                  <p className="text-xs mt-0.5" style={{ color:'var(--t3)' }}>
                    No consultable. Se guardó antes de que se registraran, así que
                    la única forma de dar acceso es asignar una nueva.
                  </p>
                )}
              </div>

              {cred?.password && (
                <button onClick={copiar} className="btn-secondary text-xs py-1.5 w-full justify-center">
                  {copiado ? <><Check size={12}/> Copiado</> : <><Copy size={12}/> Copiar para enviar</>}
                </button>
              )}
            </div>

            {/* ── Cambiarla, sólo si se pide ─────────────────── */}
            {!cambiando ? (
              <button onClick={() => { setCambiando(true); setPassword(generarPassword()) }}
                className="btn-secondary w-full justify-center text-xs py-2">
                <RefreshCw size={13}/> Asignar una contraseña nueva
              </button>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5"
                    style={{ color: 'var(--t3)' }}>Nueva contraseña</label>
                  <div className="flex gap-2">
                    <input required value={password} onChange={e => setPassword(e.target.value)}
                      className="input-field flex-1 font-mono" autoFocus/>
                    <button type="button" onClick={() => setPassword(generarPassword())}
                      className="btn-secondary px-3" title="Sugerir otra">
                      <RefreshCw size={14}/>
                    </button>
                  </div>
                  <p className="text-[11px] mt-1.5" style={{ color:'var(--t3)' }}>
                    Puedes escribir la que quieras; el botón sólo sugiere una.
                  </p>
                </div>

                <div className="flex gap-3">
                  <button type="button" onClick={() => setCambiando(false)}
                    className="btn-secondary flex-1 justify-center">Cancelar</button>
                  <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
                    {saving ? 'Aplicando…' : 'Asignar'}
                  </button>
                </div>
              </form>
            )}
          </>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-lg px-3 py-2"
            style={{ background:'var(--bad-soft)', border:'1px solid var(--bad-line)' }}>
            <AlertCircle size={13} className="mt-0.5 shrink-0" style={{ color:'var(--bad)' }}/>
            <span className="text-xs" style={{ color:'var(--bad)' }}>{error}</span>
          </div>
        )}
      </div>
    </ModalPortal>
  )
}
