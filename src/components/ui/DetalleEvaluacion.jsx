import { useEffect, useRef, useState } from 'react'
import { X, Pencil, Check, TableProperties, CalendarDays, Tag, Layers, Info, FileDown } from 'lucide-react'
import ModalPortal from './ModalPortal'
import { iconoMateria } from './SigaMateriaIcons'
import { fetchColumnaRegistro } from '../../lib/supabaseData'
import { fetchMaterialesDeColumna, urlMaterial, tiempoHasta } from '../../lib/materialesData'
import { colorMateria, colorCalificacion, calificacionBase10 } from '../../lib/studentMetrics'
import { tintaSobre } from '../../lib/color'

/**
 * Detalle de UNA calificación: qué asignación es, cómo se calificó y de dónde
 * viene. Lo abren las listas de evaluaciones del perfil del alumno (admin) y
 * del portal del alumno.
 *
 * `evaluacion`: objeto de mapEvaluation (calificación en su escala original).
 * `onGuardar(nueva)`: si viene, se puede editar (admin); devuelve { ok, message }.
 * `onAbrirHoja()`: si viene, botón para ir a la hoja de Calificaciones.
 * `light`: identidad clara (para el color de materia).
 * `accion`: { label, icon, onClick } — botón extra (p. ej. "ver toda la materia").
 */
export default function DetalleEvaluacion({ evaluacion: e, grupo, light = false, onClose, onGuardar, onAbrirHoja, accion }) {
  const [columna, setColumna] = useState(null)
  const [editando, setEditando] = useState(false)
  const [borrador, setBorrador] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [guardado, setGuardado] = useState(false)
  const [materiales, setMateriales] = useState([])   // solucionarios de esta actividad
  const inputRef = useRef(null)

  useEffect(() => {
    let vivo = true
    if (e.columnaId) fetchColumnaRegistro(e.columnaId).then(c => { if (vivo) setColumna(c) }).catch(() => {})
    // La RLS ya filtra: el alumno solo recibe los que están en su ventana de tiempo.
    if (e.columnaId) fetchMaterialesDeColumna(e.columnaId).then(m => { if (vivo) setMateriales(m) }).catch(() => {})
    return () => { vivo = false }
  }, [e.columnaId])

  const max = Number(e.calMax) || 10
  const base10 = +calificacionBase10(e).toFixed(1)
  const color = colorMateria(e.materia, light)
  const Icono = iconoMateria(e.materia)
  const tipo = e.tipo ? e.tipo.charAt(0).toUpperCase() + e.tipo.slice(1) : 'Evaluación'
  const titulo = columna?.nombre || tipo
  const fechaLarga = e.fecha
    ? new Date(e.fecha + 'T12:00').toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : '—'

  const empezar = () => { setError(''); setGuardado(false); setBorrador(String(e.calificacion)); setEditando(true); setTimeout(() => inputRef.current?.select(), 30) }
  const guardar = async () => {
    const n = parseFloat(String(borrador).replace(',', '.'))
    if (Number.isNaN(n) || n < 0 || n > max) { setError(`Escribe un número entre 0 y ${max}.`); return }
    const nueva = +n.toFixed(1)
    if (nueva === e.calificacion) { setEditando(false); return }
    setGuardando(true)
    const res = await onGuardar(nueva)
    setGuardando(false)
    if (!res?.ok) { setError(res?.message || 'No se pudo guardar.'); return }
    setEditando(false); setGuardado(true)
  }

  const Dato = ({ icon: Ico, etiqueta, children }) => (
    <div className="rounded-xl p-3 min-w-0" style={{ background: 'var(--soft-bg)', border: '1px solid var(--card-border)' }}>
      <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--t3)' }}>
        <Ico size={12}/> {etiqueta}
      </p>
      <p className="text-sm font-semibold mt-1 break-words" style={{ color: 'var(--t1)' }}>{children}</p>
    </div>
  )

  return (
    <ModalPortal onClose={onClose} maxWidth="max-w-md">
      {/* Cabecera: materia + asignación */}
      <div className="flex items-start gap-3 px-5 pt-5 pb-4" style={{ borderBottom: '1px solid var(--divider)' }}>
        <span className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: color, color: tintaSobre(color) }}>
          <Icono size={24}/>
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--t3)' }}>{e.materia}</p>
          <h2 className="text-lg font-bold leading-tight break-words" style={{ color: 'var(--t1)' }}>{titulo}</h2>
          {columna?.nombre && <p className="text-xs mt-0.5" style={{ color: 'var(--t3)' }}>{tipo}</p>}
        </div>
        <button type="button" onClick={onClose} aria-label="Cerrar" className="w-11 h-11 -mr-2 -mt-2 flex items-center justify-center rounded-lg flex-shrink-0" style={{ color: 'var(--t3)' }}>
          <X size={16}/>
        </button>
      </div>

      <div className="p-5 space-y-4">
        {/* Calificación */}
        <div className="flex items-center gap-4 p-4 rounded-2xl" style={{ background: 'var(--soft-bg)', border: '1px solid var(--card-border)' }}>
          <div className="text-center flex-shrink-0">
            <p className="text-4xl font-bold tabular-nums leading-none" style={{ color: colorCalificacion(base10) }}>{base10}</p>
            <p className="text-[11px] mt-1" style={{ color: 'var(--t3)' }}>de 10</p>
          </div>
          <div className="min-w-0 text-sm" style={{ color: 'var(--t2)' }}>
            {max !== 10
              ? <>Sacó <b style={{ color: 'var(--t1)' }}>{e.calificacion}</b> de <b style={{ color: 'var(--t1)' }}>{max}</b>; en escala de 10 equivale a {base10}.</>
              : <>Calificación sobre 10.</>}
            <p className="text-xs mt-1" style={{ color: 'var(--t3)' }}>
              {base10 >= 8 ? 'Buen resultado.' : base10 >= 6 ? 'Aprobatoria; hay margen de mejora.' : 'Reprobatoria: conviene repasar este tema.'}
            </p>
          </div>
        </div>

        {guardado && (
          <div className="flex items-center gap-2 p-3 rounded-xl text-sm font-semibold" style={{ background: 'var(--good-soft)', border: '1px solid var(--good-line)', color: 'var(--good)' }}>
            <Check size={16}/> Calificación actualizada. El promedio se recalculó.
          </div>
        )}

        {/* Edición (solo admin) */}
        {onGuardar && (editando ? (
          <div className="space-y-2">
            <label className="block text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--t3)' }} htmlFor="nueva-cal">
              Nueva calificación (sobre {max})
            </label>
            <div className="flex gap-2">
              <input id="nueva-cal" ref={inputRef} value={borrador} inputMode="decimal" disabled={guardando}
                onChange={ev => setBorrador(ev.target.value)}
                onKeyDown={ev => { if (ev.key === 'Enter') guardar(); if (ev.key === 'Escape') setEditando(false) }}
                aria-invalid={!!error} className="input-field flex-1 text-center font-bold text-lg"/>
              <button type="button" onClick={guardar} disabled={guardando} className="btn-primary min-h-11">
                {guardando ? 'Guardando…' : 'Guardar'}
              </button>
              <button type="button" onClick={() => setEditando(false)} disabled={guardando} className="btn-secondary min-h-11">Cancelar</button>
            </div>
            {error && <p role="alert" className="text-xs" style={{ color: 'var(--bad)' }}>{error}</p>}
          </div>
        ) : (
          <button type="button" onClick={empezar} className="btn-secondary w-full justify-center min-h-11">
            <Pencil size={14}/> Corregir esta calificación
          </button>
        ))}

        {/* Datos de la asignación */}
        <div className="grid grid-cols-2 gap-2">
          <Dato icon={Tag} etiqueta="Tipo">{tipo}</Dato>
          <Dato icon={CalendarDays} etiqueta="Fecha"><span className="capitalize">{fechaLarga}</span></Dato>
          <Dato icon={Layers} etiqueta="Periodo">{e.periodo || '—'}</Dato>
          <Dato icon={Layers} etiqueta="Bloque">{columna?.bloque || '—'}</Dato>
        </div>

        <p className="flex items-start gap-2 text-xs" style={{ color: 'var(--t3)' }}>
          <Info size={14} className="flex-shrink-0 mt-px"/>
          {e.columnaId
            ? <>Capturada en la hoja de Calificaciones{grupo ? <> del grupo <b>{grupo}</b></> : null}.</>
            : <>Registrada directamente, sin columna en la hoja de Calificaciones.</>}
        </p>

        {materiales.length > 0 && (
          <div className="rounded-xl p-3 space-y-2" style={{ background: 'var(--info-soft)', border: '1px solid var(--info-line)' }}>
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--info)' }}>Material de esta actividad</p>
            {materiales.map(m => (
              <button key={m.id} type="button"
                onClick={async () => { try { window.open(await urlMaterial(m), '_blank', 'noopener') } catch { /* sin acceso */ } }}
                className="w-full flex items-center gap-2 text-left min-h-11 px-2 rounded-lg" style={{ color: 'var(--t1)' }}>
                <FileDown size={16} className="flex-shrink-0" style={{ color: 'var(--info)' }}/>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold truncate">{m.titulo}</span>
                  <span className="block text-[11px]" style={{ color: 'var(--t3)' }}>Disponible {tiempoHasta(m.expiraEn) === 'ya' ? 'hasta hoy' : `; se borra ${tiempoHasta(m.expiraEn)}`}</span>
                </span>
              </button>
            ))}
          </div>
        )}

        {onAbrirHoja && e.columnaId && (
          <button type="button" onClick={onAbrirHoja} className="btn-primary w-full justify-center min-h-11">
            <TableProperties size={15}/> Ir a esta asignación en la hoja de Calificaciones
          </button>
        )}

        {accion && (
          <button type="button" onClick={accion.onClick} className="btn-secondary w-full justify-center min-h-11">
            {accion.icon && <accion.icon size={15}/>} {accion.label}
          </button>
        )}
      </div>
    </ModalPortal>
  )
}
