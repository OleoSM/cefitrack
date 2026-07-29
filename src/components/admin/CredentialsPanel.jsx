import { KeyRound, X, Copy, Check } from 'lucide-react'
import { useState } from 'react'

/**
 * Muestra las credenciales recién generadas. Es la única oportunidad de verlas:
 * en la BD se guardan cifradas.
 */
export default function CredentialsPanel({ cred, onClose }) {
  const [copied, setCopied] = useState(false)

  const copy = () => {
    navigator.clipboard?.writeText(`Usuario: ${cred.usuario}\nContraseña: ${cred.password}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  return (
    <div className="card p-4" style={{ borderColor:'rgba(251,191,36,.30)' }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <KeyRound size={14} style={{ color:'#fbbf24' }}/>
          <span className="text-sm font-bold" style={{ color:'rgba(255,255,255,.85)' }}>
            Credenciales de {cred.nombre}
          </span>
        </div>
        <button onClick={onClose} className="p-1 rounded-lg" style={{ color:'rgba(255,255,255,.35)' }}>
          <X size={14}/>
        </button>
      </div>

      <div className="mt-3 grid sm:grid-cols-2 gap-3">
        {[
          { label:'Usuario (correo)', value: cred.usuario },
          { label:'Contraseña', value: cred.password, mono:true },
        ].map(f => (
          <div key={f.label} className="rounded-xl px-3 py-2"
            style={{ background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.08)' }}>
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color:'rgba(255,255,255,.30)' }}>
              {f.label}
            </p>
            <p className={`text-sm mt-0.5 break-all ${f.mono ? 'font-mono font-bold' : ''}`}
              style={{ color: f.mono ? '#fbbf24' : 'rgba(255,255,255,.80)' }}>
              {f.value}
            </p>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3 mt-3">
        <p className="text-[11px]" style={{ color:'rgba(255,255,255,.38)' }}>
          Anótalas ahora: la contraseña se guarda cifrada y no podrá consultarse después.
        </p>
        <button onClick={copy} className="btn-secondary text-xs py-1.5 flex-shrink-0">
          {copied ? <><Check size={12}/> Copiado</> : <><Copy size={12}/> Copiar</>}
        </button>
      </div>
    </div>
  )
}
