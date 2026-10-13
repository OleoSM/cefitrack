import { useEffect, useState } from 'react'
import { KeyRound, X, Eye, EyeOff, Copy, Check, Pencil, Wand2, AlertTriangle, ShieldAlert } from 'lucide-react'
import ModalPortal from '../ui/ModalPortal'
import { SkeletonBlock } from '../ui/DataTable'
import {
  fetchCredencialesAlumno, fetchCredencialesPerfil, adminActualizarAcceso,
} from '../../lib/supabaseData'
import { generarPassword } from '../../lib/credentials'

/**
 * Ver y editar el acceso (usuario = correo, y contraseña) de una cuenta desde
 * Acceso y Disposición. Pasos: ver → editar → confirmar → listo.
 * Las credenciales las consulta y las cambia el servidor, que solo se lo
 * permite a un administrador (y nunca sobre OTRO administrador).
 *
 * `cuenta`: { id, name, email, role } — para alumnos `id` es el id de alumno.
 * `esPropia`: es la cuenta de quien está viendo (un admin puede editarse).
 */
export default function AccesoCuentaModal({ cuenta, esPropia = false, onClose, onGuardado }) {
  const [paso, setPaso] = useState('ver')        // ver | editar | confirmar | listo
  const [cred, setCred] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [mostrar, setMostrar] = useState(false)
  const [copiado, setCopiado] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [guardando, setGuardando] = useState(false)

  const editable = cuenta.role !== 'admin' || esPropia
  const rol = cuenta.role === 'student' ? 'alumno' : cuenta.role === 'sub_admin' ? 'sub-admin' : 'administrador'

  useEffect(() => {
    let vivo = true
    const pedir = cuenta.role === 'student' ? fetchCredencialesAlumno(cuenta.id) : fetchCredencialesPerfil(cuenta.id)
    pedir.then(c => { if (vivo) { setCred(c); setEmail(c?.email ?? cuenta.email ?? '') } })
      .catch(() => { if (vivo) setError('No se pudieron consultar las credenciales.') })
      .finally(() => { if (vivo) setCargando(false) })
    return () => { vivo = false }
  }, [cuenta.id, cuenta.role, cuenta.email])

  const correoActual = cred?.email ?? cuenta.email
  const cambiaCorreo = email.trim().toLowerCase() !== (correoActual ?? '').toLowerCase()
  const cambiaClave = password !== ''

  const copiar = (correo, clave) => {
    navigator.clipboard?.writeText(`Acceso a SIGA CEFIMAT\nCorreo: ${correo}\nContraseña: ${clave ?? ''}`)
    setCopiado(true); setTimeout(() => setCopiado(false), 1800)
  }

  const revisar = () => {
    setError('')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) { setError('Ese correo no es válido.'); return }
    if (cambiaClave && password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres.'); return }
    if (!cambiaCorreo && !cambiaClave) { setError('No cambiaste nada.'); return }
    setPaso('confirmar')
  }

  const guardar = async () => {
    setGuardando(true); setError('')
    const res = await adminActualizarAcceso({
      cuenta: cuenta.id, email: cambiaCorreo ? email.trim().toLowerCase() : '', password: cambiaClave ? password : '',
    })
    setGuardando(false)
    if (!res.ok) { setError(res.message); setPaso('editar'); return }
    setCred({ email: res.email, password: cambiaClave ? password : cred?.password })
    setPassword(''); setMostrar(true); setPaso('listo')
    onGuardado?.()
  }

  const Campo = ({ etiqueta, valor, secreto }) => (
    <div className="rounded-xl px-3 py-2.5" style={{ background:'var(--soft-bg)', border:'1px solid var(--card-border)' }}>
      <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color:'var(--t3)' }}>{etiqueta}</p>
      <div className="flex items-center justify-between gap-2 mt-0.5">
        <p className="text-sm font-mono font-bold break-all" style={{ color:'var(--t1)' }}>
          {secreto ? (valor ? (mostrar ? valor : '••••••••') : 'No registrada (se cambió fuera del panel)') : valor}
        </p>
        {secreto && valor && (
          <button type="button" onClick={() => setMostrar(m => !m)} aria-label={mostrar ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            className="w-9 h-9 flex items-center justify-center rounded-lg flex-shrink-0" style={{ color:'var(--t2)' }}>
            {mostrar ? <EyeOff size={15}/> : <Eye size={15}/>}
          </button>
        )}
      </div>
    </div>
  )

  return (
    <ModalPortal maxWidth="max-w-md" onClose={() => !guardando && onClose()}>
      <div className="flex items-center justify-between gap-3 px-5 py-3.5" style={{ borderBottom:'1px solid var(--divider)' }}>
        <h2 className="flex items-center gap-2 text-sm font-bold min-w-0" style={{ color:'var(--t1)' }}>
          <KeyRound size={15} style={{ color:'var(--accent)' }}/>
          <span className="truncate">Acceso de {cuenta.name}</span>
        </h2>
        <button type="button" onClick={onClose} disabled={guardando} aria-label="Cerrar" className="w-11 h-11 flex items-center justify-center rounded-lg" style={{ color:'var(--t3)' }}><X size={15}/></button>
      </div>

      <div className="p-5 space-y-3">
        {cargando ? <SkeletonBlock className="h-28"/> : (
          <>
            {/* ── Ver ── */}
            {paso === 'ver' && (
              <>
                <Campo etiqueta="Usuario (correo con el que entra)" valor={correoActual}/>
                <Campo etiqueta="Contraseña" valor={cred?.password} secreto/>
                {error && <p role="alert" className="text-xs" style={{ color:'var(--bad)' }}>{error}</p>}
                <div className="grid sm:grid-cols-2 gap-2">
                  <button type="button" onClick={() => copiar(correoActual, cred?.password)} className="btn-secondary justify-center min-h-11">
                    {copiado ? <><Check size={14}/> Copiado</> : <><Copy size={14}/> Copiar</>}
                  </button>
                  {editable ? (
                    <button type="button" onClick={() => { setError(''); setPaso('editar') }} className="btn-primary justify-center min-h-11">
                      <Pencil size={14}/> Editar acceso
                    </button>
                  ) : (
                    <p className="flex items-center gap-1.5 text-[11px]" style={{ color:'var(--t3)' }}>
                      <ShieldAlert size={14} className="flex-shrink-0"/> El acceso de otro administrador no se puede editar.
                    </p>
                  )}
                </div>
              </>
            )}

            {/* ── Editar ── */}
            {paso === 'editar' && (
              <>
                <label className="block">
                  <span className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color:'var(--t3)' }}>Usuario (correo)</span>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="off"
                    className="input-field w-full min-h-11"/>
                </label>
                <label className="block">
                  <span className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color:'var(--t3)' }}>Nueva contraseña (vacía = no cambiarla)</span>
                  <div className="flex gap-2">
                    <input type={mostrar ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                      autoComplete="new-password" placeholder="Mínimo 6 caracteres" className="input-field flex-1 min-h-11 font-mono"/>
                    <button type="button" onClick={() => setMostrar(m => !m)} aria-label={mostrar ? 'Ocultar' : 'Mostrar'}
                      className="w-11 min-h-11 flex items-center justify-center rounded-xl flex-shrink-0"
                      style={{ background:'var(--soft-bg)', border:'1px solid var(--card-border)', color:'var(--t2)' }}>
                      {mostrar ? <EyeOff size={15}/> : <Eye size={15}/>}
                    </button>
                  </div>
                  <button type="button" onClick={() => { setPassword(generarPassword()); setMostrar(true) }}
                    className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold min-h-9 px-2 rounded-lg" style={{ color:'var(--accent)' }}>
                    <Wand2 size={13}/> Generar una contraseña segura
                  </button>
                </label>
                {error && <p role="alert" className="text-xs font-semibold" style={{ color:'var(--bad)' }}>{error}</p>}
                <div className="flex gap-3">
                  <button type="button" onClick={() => { setPaso('ver'); setPassword(''); setEmail(correoActual ?? ''); setError('') }} className="btn-secondary flex-1 justify-center min-h-11">Cancelar</button>
                  <button type="button" onClick={revisar} className="btn-primary flex-1 justify-center min-h-11">Continuar</button>
                </div>
              </>
            )}

            {/* ── Confirmar ── */}
            {paso === 'confirmar' && (
              <>
                <div className="flex gap-3 p-3 rounded-xl" style={{ background:'var(--warn-soft)', border:'1px solid var(--warn-line)' }}>
                  <AlertTriangle size={18} className="flex-shrink-0 mt-0.5" style={{ color:'var(--warn)' }}/>
                  <div className="text-sm" style={{ color:'var(--t2)' }}>
                    <p className="font-bold" style={{ color:'var(--t1)' }}>¿Cambiar el acceso de este {rol}?</p>
                    <ul className="mt-1.5 space-y-1 text-xs">
                      {cambiaCorreo && <li>· Entrará con <b>{email.trim().toLowerCase()}</b> (antes {correoActual}).</li>}
                      {cambiaClave && <li>· Su contraseña cambia; la anterior deja de servir.</li>}
                      {!esPropia && <li>· Si tenía una sesión abierta, se cerrará y tendrá que entrar de nuevo.</li>}
                    </ul>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setPaso('editar')} disabled={guardando} className="btn-secondary flex-1 justify-center min-h-11">Volver</button>
                  <button type="button" onClick={guardar} disabled={guardando} className="btn-primary flex-1 justify-center min-h-11">
                    {guardando ? 'Guardando…' : 'Sí, cambiar acceso'}
                  </button>
                </div>
              </>
            )}

            {/* ── Listo ── */}
            {paso === 'listo' && (
              <>
                <div className="flex items-center gap-2 p-3 rounded-xl text-sm font-semibold" style={{ background:'var(--good-soft)', border:'1px solid var(--good-line)', color:'var(--good)' }}>
                  <Check size={16}/> Acceso actualizado. Entrégale los datos nuevos:
                </div>
                <Campo etiqueta="Usuario (correo)" valor={cred?.email}/>
                <Campo etiqueta="Contraseña" valor={cred?.password} secreto/>
                <div className="grid sm:grid-cols-2 gap-2">
                  <button type="button" onClick={() => copiar(cred?.email, cred?.password)} className="btn-secondary justify-center min-h-11">
                    {copiado ? <><Check size={14}/> Copiado</> : <><Copy size={14}/> Copiar</>}
                  </button>
                  <button type="button" onClick={onClose} className="btn-primary justify-center min-h-11">Listo</button>
                </div>
              </>
            )}
          </>
        )}
        <p className="text-[11px]" style={{ color:'var(--t3)' }}>Solo los administradores ven estos datos. No los compartas por canales públicos.</p>
      </div>
    </ModalPortal>
  )
}
