import { useState } from 'react'
import { CalendarDays, Plus, Trash2 } from 'lucide-react'
import { feriadosOficiales, TIPOS_EVENTO, tonoEvento } from '../../lib/feriados'

/**
 * Fechas del calendario del alumno. Los festivos oficiales de México vienen
 * calculados (no se editan); aquí se añaden los propios de CEFIMAT: inicios y
 * fin de curso, suspensiones, eventos. Se guardan con el botón general de
 * Configuración.
 */
export default function EditorCalendario({ eventos = [], onChange, disabled }) {
  const [nuevo, setNuevo] = useState({ fecha: '', titulo: '', tipo: 'inicio' })
  const [verOficiales, setVerOficiales] = useState(false)
  const anio = new Date().getFullYear()
  const ordenados = [...eventos].sort((a, b) => a.fecha.localeCompare(b.fecha))
  const fmt = f => new Date(f + 'T12:00').toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })

  const agregar = () => {
    if (!nuevo.fecha || !nuevo.titulo.trim()) return
    onChange([...eventos, { ...nuevo, titulo: nuevo.titulo.trim() }])
    setNuevo(n => ({ ...n, fecha: '', titulo: '' }))
  }

  return (
    <div className="card p-5 space-y-3 lg:col-span-2">
      <h2 className="section-title flex items-center gap-2"><CalendarDays size={16}/> Calendario del alumno</h2>
      <p className="text-xs -mt-1" style={{ color: 'var(--t3)' }}>
        Los alumnos ven estas fechas en su calendario de asistencias. Los días festivos oficiales de México ya
        vienen incluidos; aquí añades los de CEFIMAT (inicio de curso, suspensiones, eventos).
      </p>

      {!disabled && (
        <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr_auto_auto] gap-2">
          <input type="date" value={nuevo.fecha} onChange={e => setNuevo(n => ({ ...n, fecha: e.target.value }))}
            aria-label="Fecha" className="input-field min-h-11"/>
          <input value={nuevo.titulo} onChange={e => setNuevo(n => ({ ...n, titulo: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && agregar()}
            placeholder="Ej. Inicio del curso ECOEMS" aria-label="Descripción" className="input-field min-h-11"/>
          <select value={nuevo.tipo} onChange={e => setNuevo(n => ({ ...n, tipo: e.target.value }))}
            aria-label="Tipo" className="input-field min-h-11">
            {TIPOS_EVENTO.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
          <button type="button" onClick={agregar} disabled={!nuevo.fecha || !nuevo.titulo.trim()}
            className="btn-secondary min-h-11 justify-center disabled:opacity-40"><Plus size={14}/> Añadir</button>
        </div>
      )}

      <ul className="space-y-1.5">
        {ordenados.map((ev, i) => (
          <li key={`${ev.fecha}-${ev.titulo}-${i}`} className="flex items-center gap-3 rounded-xl px-3 py-2"
            style={{ background: 'var(--card-bg)', border: '1px solid var(--divider)' }}>
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: `var(--${tonoEvento(ev.tipo)}-solid)` }}/>
            <span className="text-xs tabular-nums w-32 flex-shrink-0 capitalize" style={{ color: 'var(--t3)' }}>{fmt(ev.fecha)}</span>
            <span className="text-sm flex-1 min-w-0 truncate" style={{ color: 'var(--t1)' }}>{ev.titulo}</span>
            <span className="text-[10px] font-semibold hidden sm:inline" style={{ color: 'var(--t3)' }}>
              {TIPOS_EVENTO.find(t => t.id === ev.tipo)?.label}
            </span>
            {!disabled && (
              <button type="button" onClick={() => onChange(eventos.filter(x => x !== ev))}
                aria-label={`Quitar ${ev.titulo}`} className="w-9 h-9 flex items-center justify-center rounded-lg"
                style={{ color: 'var(--bad)' }}><Trash2 size={14}/></button>
            )}
          </li>
        ))}
        {ordenados.length === 0 && (
          <li className="text-xs" style={{ color: 'var(--t3)' }}>Aún no hay fechas propias.</li>
        )}
      </ul>

      <button type="button" onClick={() => setVerOficiales(v => !v)}
        className="text-xs font-semibold min-h-9" style={{ color: 'var(--accent)' }}>
        {verOficiales ? 'Ocultar' : 'Ver'} festivos oficiales de {anio}
      </button>
      {verOficiales && (
        <ul className="grid sm:grid-cols-2 gap-1 text-xs" style={{ color: 'var(--t2)' }}>
          {feriadosOficiales(anio).map(f => (
            <li key={f.fecha}><span className="tabular-nums capitalize" style={{ color: 'var(--t3)' }}>{fmt(f.fecha)}</span> · {f.titulo}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
