import { KeyRound, X, Copy, Check } from 'lucide-react'
import { useState } from 'react'
import ModalPortal from '../ui/ModalPortal'

/**
 * Muestra las credenciales recién generadas. Es la única oportunidad de verlas:
 * la contraseña se guarda con bcrypt, que es unidireccional, y no hay forma de
 * recuperarla después — sólo de generar otra.
 *
 * El correo que llega aquí es el que confirma la base tras crear o restablecer
 * la cuenta, no el que la pantalla tenga en memoria: son el mismo dato en el
 * caso normal, pero si difirieran el bueno es el de la base, porque es contra
 * el que se valida el inicio de sesión.
 */
export default function CredentialsPanel({ cred, onClose }) {
  const [copied, setCopied] = useState(false)

  const copy = () => {
    navigator.clipboard?.writeText(`Usuario: ${cred.usuario}\nContraseña: ${cred.password}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  return (
    <ModalPortal onClose={onClose} maxWidth="max-w-xl">
    <div className="p-4 sm:p-5" style={{ borderColor:'var(--warn-line)' }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <KeyRound size={14} style={{ color:'var(--warn)' }}/>
          <span className="text-sm font-bold" style={{ color: 'var(--t1)' }}>
            Credenciales de {cred.nombre}
          </span>
        </div>
        <button onClick={onClose} aria-label="Cerrar credenciales" className="w-11 h-11 flex items-center justify-center rounded-lg" style={{ color: 'var(--t3)' }}>
          <X size={14}/>
        </button>
      </div>

      <div className="mt-3 grid sm:grid-cols-2 gap-3">
        {[
          { label:'Correo — con este se entra', value: cred.usuario, mono:true },
          { label:'Contraseña', value: cred.password, mono:true, destacar:true },
        ].map(f => (
          <div key={f.label} className="rounded-xl px-3 py-2"
            style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--t3)' }}>
              {f.label}
            </p>
            <p className={`text-sm mt-0.5 break-all ${f.mono ? 'font-mono font-bold' : ''}`}
              style={{ color: f.destacar ? 'var(--warn)' : 'var(--t1)' }}>
              {f.value}
            </p>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-3">
        <p className="text-[11px]" style={{ color: 'var(--t3)' }}>
          Anótalas ahora: la contraseña se guarda cifrada y no podrá consultarse
          después, sólo generarse de nuevo. Se entra con el correo, no con el nombre.
        </p>
        <button onClick={copy} className="btn-secondary min-h-11 text-xs py-1.5 flex-shrink-0">
          {copied ? <><Check size={12}/> Copiado</> : <><Copy size={12}/> Copiar</>}
        </button>
      </div>
    </div>
    </ModalPortal>
  )
}
