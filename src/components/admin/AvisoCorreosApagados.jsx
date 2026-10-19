import { Link } from 'react-router-dom'
import { MailX } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

/** Aviso de que el envío de correos está desactivado (interruptor de Configuración). */
export default function AvisoCorreosApagados({ className = '' }) {
  const { currentUser } = useAuth()
  const esAdmin = currentUser?.role === 'admin'
  return (
    <div role="status" className={`flex items-start gap-2.5 rounded-xl px-3.5 py-3 text-sm ${className}`}
      style={{ background: 'var(--warn-soft)', border: '1px solid var(--warn-line)', color: 'var(--t1)' }}>
      <MailX size={17} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--warn)' }}/>
      <div className="min-w-0">
        <p className="font-semibold">El envío de correos está desactivado.</p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--t2)' }}>
          No se enviará ningún correo hasta que un administrador lo active.
          {esAdmin && <> Puedes activarlo en <Link to="/admin/configuracion" className="underline font-semibold">Configuración</Link>.</>}
        </p>
      </div>
    </div>
  )
}
