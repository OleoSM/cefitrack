import { useState } from 'react'
import { Users } from 'lucide-react'

/**
 * Los alumnos de un grupo, como fichas apiladas.
 *
 * Cada una se levanta y crece al pasar por encima —con el nombre en un globo—
 * y abre el perfil al pulsarla. Vive aquí y no dentro de una pantalla porque
 * las tarjetas de grupo son la misma cosa en Grupos, en Calificaciones y en
 * Pasar Lista: en Calificaciones eran iniciales grises apiladas, sin foto, sin
 * nombre y sin poder abrir a nadie.
 *
 * `accent` es el color del grupo: se lo queda quien todavía no ha elegido
 * avatar, en vez del gris plano que no distinguía a nadie.
 */
const VISIBLES = 6

export default function StudentDock({ students = [], onOpenStudent, accent }) {
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? students : students.slice(0, VISIBLES)

  if (!students.length) {
    return <span className="text-[10px]" style={{ color:'var(--t3)' }}>Sin alumnos</span>
  }

  return (
    <div className="flex items-center gap-2 min-w-0"
      onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
      <div className={`flex items-center ${expanded ? 'flex-wrap gap-1.5' : '-space-x-2'} min-w-0 py-2`}>
        {visible.map(student => (
          <button key={student.id} type="button"
            onClick={() => onOpenStudent?.(student.id)}
            aria-label={`Abrir perfil de ${student.name}`}
            className="group/avatar relative w-9 h-9 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0 z-0 hover:z-20 focus-visible:z-20 transition-[transform,margin] duration-200 ease-out hover:scale-[1.45] hover:-translate-y-2 hover:mx-2 focus-visible:scale-[1.45] focus-visible:-translate-y-2 focus-visible:mx-2 focus-visible:outline-none"
            style={{
              background: accent ? `${accent}30` : 'var(--soft-bg)',
              border: '2px solid var(--card-bg)',
              color: accent || 'var(--t1)',
              boxShadow: '0 4px 12px rgba(0,0,0,.2)',
            }}>
            {student.avatarSrc
              ? <img src={student.avatarSrc} alt="" loading="lazy"
                  className="w-full h-full rounded-full object-cover"/>
              : (student.name ?? '?').split(' ').map(n => n[0]).join('').slice(0, 2)}
            <span className="pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2 translate-y-1 opacity-0 group-hover/avatar:translate-y-0 group-hover/avatar:opacity-100 group-focus-visible/avatar:translate-y-0 group-focus-visible/avatar:opacity-100 transition-all duration-200 ease-out whitespace-nowrap rounded-lg px-2 py-1 text-[9px] font-bold"
              style={{ background:'var(--panel-bg)', color:'var(--t1)',
                       border:'1px solid var(--card-border)', boxShadow:'0 8px 24px rgba(0,0,0,.28)' }}>
              {student.name}
            </span>
          </button>
        ))}
      </div>

      {students.length > VISIBLES && (
        <button type="button" onClick={() => setExpanded(v => !v)}
          className="min-h-10 flex-shrink-0 rounded-xl px-2.5 inline-flex items-center gap-1.5 text-[10px] font-bold transition-colors"
          style={{ background:'var(--soft-bg)', color:'var(--t2)', border:'1px solid var(--card-border)' }}>
          <Users size={14}/>
          <span className="hidden md:inline">{expanded ? 'Mostrar menos' : 'Desplegar todos'}</span>
          <span>{expanded ? '−' : `+${students.length - VISIBLES}`}</span>
        </button>
      )}
    </div>
  )
}
