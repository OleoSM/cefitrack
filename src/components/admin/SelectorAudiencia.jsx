import { Users, GraduationCap, UserRound } from 'lucide-react'
import { AUDIENCIAS } from '../../lib/avisosData'

const ICONO = { ambos: Users, alumnos: GraduationCap, tutores: UserRound }

/**
 * ¿A quién le llega el correo? Alumnos y tutores · Solo alumnos · Solo tutores.
 * `conteo` (opcional): { conAlumno, conTutor, total } para mostrar cuántos
 * tienen correo en cada caso.
 */
export default function SelectorAudiencia({ valor, onChange, conteo, disabled, vertical = false }) {
  const cifra = id => !conteo ? null
    : id === 'ambos' ? conteo.conAlumno + conteo.conTutor
    : id === 'alumnos' ? conteo.conAlumno : conteo.conTutor
  return (
    <div role="radiogroup" aria-label="Destinatarios del correo" className={`grid grid-cols-1 gap-2 ${vertical ? '' : 'sm:grid-cols-3'}`}>
      {AUDIENCIAS.map(a => {
        const activo = valor === a.id
        const Icono = ICONO[a.id]
        const n = cifra(a.id)
        return (
          <button key={a.id} type="button" role="radio" aria-checked={activo} disabled={disabled}
            onClick={() => onChange(a.id)} data-sin-zoom
            className="flex items-center gap-2 rounded-xl px-3 min-h-11 text-left text-sm font-semibold transition-colors disabled:opacity-50"
            style={activo
              ? { background: 'var(--accent)', color: 'var(--accent-contrast)', border: '1px solid var(--accent)' }
              : { background: 'var(--soft-bg)', color: 'var(--t1)', border: '1px solid var(--card-border)' }}>
            <Icono size={16} className="flex-shrink-0"/>
            <span className="flex-1 min-w-0">{a.label}</span>
            {n !== null && <span className="text-[11px] font-bold tabular-nums opacity-80">{n} ✉</span>}
          </button>
        )
      })}
    </div>
  )
}
