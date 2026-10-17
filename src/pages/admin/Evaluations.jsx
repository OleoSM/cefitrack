import { useState, useEffect, useCallback } from 'react'
import { Plus, X, CheckCircle, Trash2, AlertCircle, ClipboardCheck, MonitorCheck, GraduationCap, FileCheck2 } from 'lucide-react'
import {
  fetchEvaluations, fetchStudents, fetchGroups,
  saveEvaluation, deleteEvaluation,
} from '../../lib/supabaseData'
import { DataTable, DataTableRow, DataTableAvatar, SkeletonRows } from '../../components/ui/DataTable'
import KpiCard, { KpiGrid } from '../../components/ui/KpiCard'
import ConfirmDialog from '../../components/admin/ConfirmDialog'
import { todayISO } from '../../lib/fecha'
import ProgressiveList from '../../components/ui/ProgressiveList'
import ModalPortal from '../../components/ui/ModalPortal'
import { useSucursales } from '../../hooks/useSucursales'
import BarraFiltros from '../../components/ui/BarraFiltros'
import { useSucursalActiva, TODAS } from '../../hooks/useSucursalActiva'

// Las cuatro categorías autorizadas por CEFIMAT (requisito EVA-01).
// Las anteriores (Examen Parcial, Proyecto, Examen Final, Quíz, Práctica) se retiran.
/* `alias`: los tipos con que llega cada examen. Los de esta pantalla vienen
   con el nombre largo; los de la hoja de Calificaciones, con el `tipo` de su
   columna (simulacro, digital, general y examen, el del bloque Guía → Examen →
   Análisis). Esta pantalla muestra SOLO exámenes: tareas y actividades viven
   en la hoja. */
const EXAMENES = [
  { tipo:'Simulacro base', total:6, icon:ClipboardCheck, desc:'Seis aplicaciones presenciales programadas', alias:['simulacro base', 'simulacro'] },
  { tipo:'Simulacro digital', total:5, icon:MonitorCheck, desc:'Cinco aplicaciones en plataforma', alias:['simulacro digital', 'digital'] },
  { tipo:'Examen general', total:1, icon:GraduationCap, desc:'Una evaluación integral final', alias:['examen general', 'general'] },
  { tipo:'Examen', total:null, icon:FileCheck2, desc:'Exámenes del bloque Guía → Examen → Análisis', alias:['examen'] },
]
const tipos = EXAMENES.slice(0, 3).map(x => x.tipo)   // los que se capturan desde esta pantalla
/** Categoría de examen de una calificación, o null si no es examen. */
const categoriaDe = tipo => EXAMENES.find(x => x.alias.includes(String(tipo ?? '').trim().toLowerCase()))?.tipo ?? null

const gradeColor = c =>
  c >= 8 ? { bg:'bg-emerald-500/15', text:'text-emerald-400', border:'border-emerald-500/30' }
         : c >= 6 ? { bg:'bg-blue-500/15', text:'text-blue-400', border:'border-blue-500/30' }
                  : { bg:'bg-red-500/15',   text:'text-red-400',  border:'border-red-500/30' }

/* ── Modal para agregar evaluación ─────────────────────────── */
function Modal({ students, onClose, onSaved }) {
  const [form, setForm] = useState({
    studentId:'', materia:'', tipo:tipos[0],
    calificacion:'', calMax:'10', periodo:'',
    fecha:todayISO()
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState(null)
  const set = (k,v) => setForm(f => ({ ...f, [k]:v }))

  const handleSubmit = async e => {
    e.preventDefault()
    const cal = parseFloat(form.calificacion)
    const max = parseFloat(form.calMax) || 10
    if (!Number.isFinite(cal) || cal < 0 || cal > max) {
      setError(`La calificación debe estar entre 0 y ${max}.`); return
    }
    setSaving(true)
    setError(null)
    const res = await saveEvaluation({
      studentId:   form.studentId,
      materia:     form.materia,
      tipo:        form.tipo,
      calificacion: parseFloat(form.calificacion),
      calMax:      parseFloat(form.calMax) || 10,
      fecha:       form.fecha,
      periodo:     form.periodo || null,
    })
    setSaving(false)
    if (!res.ok) { setError(res.message); return }
    onSaved()
    onClose()
  }

  return (
    <ModalPortal onClose={onClose} scrollable>
        <div className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom:'1px solid var(--divider)' }}>
          <h2 className="text-sm font-bold" style={{ color:'var(--t1)' }}>Agregar Evaluación</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar"
            className="w-11 h-11 flex items-center justify-center rounded-lg transition-colors"
            style={{ color:'var(--t3)' }}
            onMouseEnter={e => e.currentTarget.style.color='var(--t1)'}
            onMouseLeave={e => e.currentTarget.style.color='var(--t3)'}>
            <X size={15}/>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {[
            { label:'Alumno', key:'studentId', type:'select',
              opts: students.map(s => ({ v:s.id, l:s.name })), required:true },
            { label:'Materia', key:'materia', type:'text', placeholder:'Ej. Álgebra', required:true },
          ].map(f => (
            <div key={f.key}>
              <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5"
                style={{ color:'var(--t3)' }}>{f.label}</label>
              {f.type === 'select' ? (
                <select required={f.required} value={form[f.key]} onChange={e=>set(f.key,e.target.value)} className="input-field">
                  <option value="">Seleccionar…</option>
                  {f.opts?.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                </select>
              ) : (
                <input required={f.required} value={form[f.key]} onChange={e=>set(f.key,e.target.value)}
                  placeholder={f.placeholder} className="input-field"/>
              )}
            </div>
          ))}

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5"
              style={{ color:'var(--t3)' }}>Tipo</label>
            <select value={form.tipo} onChange={e=>set('tipo',e.target.value)} className="input-field">
              {tipos.map(t=><option key={t}>{t}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5"
                style={{ color:'var(--t3)' }}>Calificación</label>
              <input required type="number" min="0" step="0.1"
                value={form.calificacion} onChange={e=>set('calificacion',e.target.value)}
                placeholder="8.5" className="input-field"/>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5"
                style={{ color:'var(--t3)' }}>Sobre (máximo)</label>
              <input required type="number" min="1" step="0.1"
                value={form.calMax} onChange={e=>set('calMax',e.target.value)}
                placeholder="10" className="input-field"/>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5"
                style={{ color:'var(--t3)' }}>Fecha</label>
              <input type="date" value={form.fecha} onChange={e=>set('fecha',e.target.value)} className="input-field"/>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5"
                style={{ color:'var(--t3)' }}>Periodo</label>
              <input value={form.periodo} onChange={e=>set('periodo',e.target.value)}
                placeholder="Ej. Jul–Ago" className="input-field"/>
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg px-3 py-2"
              style={{ background:'var(--bad-soft)', border:'1px solid var(--bad-line)' }}>
              <AlertCircle size={13} className="mt-0.5 shrink-0" style={{ color:'var(--bad)' }}/>
              <span className="text-xs" style={{ color:'var(--bad)' }}>{error}</span>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Cancelar</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
              {saving ? <><CheckCircle size={14}/>Guardando…</> : <><Plus size={14}/>Agregar</>}
            </button>
          </div>
        </form>
    </ModalPortal>
  )
}

/* ── Columnas ── */
const COLUMNS = [
  { key:'alumno',  label:'Alumno',       className:'flex-grow min-w-[120px] sm:min-w-[180px]' },
  { key:'materia', label:'Materia',       className:'w-36 hidden sm:flex' },
  { key:'tipo',    label:'Tipo',          className:'w-36 hidden md:flex' },
  { key:'cal',     label:'Calificación',  className:'w-20 sm:w-28' },
  { key:'periodo', label:'Periodo',       className:'w-28 hidden lg:flex' },
  { key:'fecha',   label:'Fecha',         className:'w-24 hidden lg:flex' },
  { key:'acciones',label:'',              className:'w-10 flex justify-end' },
]

export default function Evaluations() {
  const [showModal, setShowModal] = useState(false)
  const [query, setQuery]         = useState('')
  const { sucursal: sucursalFilter, setSucursal, opcionesConTodas } = useSucursalActiva()
  const [groupFilter, setGroup]   = useState('all')
  const [buscaGrupo, setBuscaGrupo] = useState('')
  const [typeFilter, setType]     = useState('all')

  const [evaluations, setEvaluations] = useState([])
  const [students, setStudents]       = useState([])
  const [groups, setGroups]           = useState([])
  const [loading, setLoading]         = useState(true)
  const [loadError, setLoadError]     = useState(null)
  const [deleteFor, setDeleteFor]     = useState(null)
  const { sucursales, nombreDe } = useSucursales()

  const load = useCallback(async () => {
    try {
      const [evs, sts, grs] = await Promise.all([fetchEvaluations(), fetchStudents(), fetchGroups()])
      setEvaluations(evs)
      setStudents(sts)
      setGroups(grs)
      setLoadError(null)
    } catch {
      setLoadError('No se pudieron cargar las evaluaciones.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const groupsInSucursal = sucursalFilter === TODAS
    ? groups
    : groups.filter(g => g.sucursal === sucursalFilter)

  useEffect(() => {
    if (groupFilter !== 'all' && !groupsInSucursal.some(g => g.id === groupFilter)) setGroup('all')
  }, [sucursalFilter, groupFilter, groupsInSucursal])

  /* Se borra tras confirmar y sólo se quita de la lista si la BD aceptó: el
     borrado optimista sin confirmación hacía desaparecer filas por un clic
     accidental. */
  const handleDelete = async id => {
    await deleteEvaluation(id)
    setEvaluations(prev => prev.filter(e => e.id !== id))
  }

  // Solo exámenes; cada uno con su categoría ya resuelta.
  const examenes = evaluations.map(e => ({ ...e, categoria: categoriaDe(e.tipo) })).filter(e => e.categoria)
  const filtered = examenes.filter(e => {
    const s = students.find(st => st.id === e.studentId)
    if (!s) return false
    const group = groups.find(g => g.id === s.groupId)
    const q = query.toLowerCase()
    return (s.name.toLowerCase().includes(q) || e.materia.toLowerCase().includes(q))
      && (groupFilter === 'all' || s.groupId === groupFilter)
      && (sucursalFilter === TODAS || group?.sucursal === sucursalFilter)
      && (typeFilter  === 'all' || e.categoria === typeFilter)
  })

  return (
    <div className="w-full space-y-5">
      <div>
        <h1 className="page-title">Exámenes</h1>
        <p className="text-sm mt-1" style={{ color:'var(--t3)' }}>
          Simulacros y examen general capturados por alumno.
        </p>
      </div>

      {showModal && (
        <Modal students={students} onClose={() => setShowModal(false)} onSaved={load}/>
      )}
      {deleteFor && (
        <ConfirmDialog
          title="Eliminar evaluación"
          message={`Se eliminará la calificación de ${deleteFor.materia} (${deleteFor.tipo}).`}
          detail="Esta acción no se puede deshacer."
          onConfirm={() => handleDelete(deleteFor.id)}
          onClose={() => setDeleteFor(null)}
        />
      )}

      <KpiGrid cols={4}>
        {EXAMENES.map(({ tipo, total, icon, desc }) => {
          const capturados = examenes.filter(e => e.categoria === tipo).length
          const activo = typeFilter === tipo
          return (
            <KpiCard key={tipo} variant="surface" icon={icon} tone={activo ? 'info' : 'neutral'}
              label={tipo} value={total ?? capturados} sub={`${desc} · ${capturados} registros`}
              onClick={() => setType(activo ? 'all' : tipo)}
              className={activo ? 'ring-2 ring-[var(--accent)]' : ''}/>
          )
        })}
      </KpiGrid>

      {/* Toolbar */}
      <BarraFiltros
        filtros={[
          { id:'sucursal', label:'Sucursal', value:sucursalFilter, onChange:setSucursal,
            porDefecto:sucursalFilter, options:opcionesConTodas },
          { id:'grupo', label:'Grupo', tipo:'grupo', value:groupFilter, onChange:setGroup,
            porDefecto:'all', grupos:groupsInSucursal, query:buscaGrupo, onQuery:setBuscaGrupo,
            nombreDe },
          { id:'tipo', label:'Tipo', value:typeFilter, onChange:setType, porDefecto:'all',
            options:[{ value:'all', label:'Todos los exámenes' }, ...EXAMENES.map(x => ({ value:x.tipo, label:x.tipo }))] },
        ]}
        busqueda={{ value: query, onChange: setQuery, placeholder:'Buscar alumno o materia…',
          coincidencias: students.map(s => ({ id: s.id, label: s.name, sub: groups.find(g => g.id === s.groupId)?.name ?? '' })) }}
        resumen={loading ? 'Cargando…' : `${filtered.length} examen(es)`}
        acciones={
          <button onClick={() => setShowModal(true)} disabled={loading || students.length === 0}
            className="btn-primary flex-shrink-0">
            <Plus size={14}/> <span className="hidden sm:inline">Agregar evaluación</span>
          </button>
        }/>

      {loadError && (
        <div role="alert" className="card p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between"
          style={{ background:'var(--bad-soft)', borderColor:'var(--bad-line)' }}>
          <span className="text-sm flex items-center gap-2" style={{ color:'var(--bad)' }}>
            <AlertCircle size={14}/>{loadError}
          </span>
          <button onClick={() => { setLoading(true); load() }} className="btn-secondary min-h-11 justify-center">Reintentar</button>
        </div>
      )}

      {/* Tabla */}
      <DataTable columns={COLUMNS} isEmpty={!loading && !loadError && filtered.length === 0}
        emptyText={examenes.length === 0
          ? 'Aún no hay calificaciones de exámenes. Captúralas en la hoja de Calificaciones o con “Agregar evaluación”.'
          : 'No hay exámenes para los filtros seleccionados.'}>
        {loading ? <SkeletonRows/> : (
        <ProgressiveList items={filtered} sizes={{ mobile: 5, tablet: 5, desktop: 5 }} emptyLabel="Ninguna evaluación coincide con el filtro.">
        {e => {
          const s  = students.find(st => st.id === e.studentId)
          const base10 = e.calMax ? (e.calificacion / e.calMax) * 10 : e.calificacion
          const gc = gradeColor(base10)
          return (
            <DataTableRow key={e.id} cells={[
              {
                className: 'flex-grow min-w-[120px] sm:min-w-[180px]',
                content: <DataTableAvatar
                  initials={s?.name.split(' ').slice(0,2).map(n=>n[0]).join('') ?? '?'}
                  avatarSrc={s?.avatarSrc}
                  name={s?.name ?? '—'}
                  sub={groups.find(g => g.id === s?.groupId)?.name}
                />,
              },
              {
                className: 'w-36 hidden sm:flex',
                content: <span className="text-sm font-medium truncate" style={{ color:'var(--t1)' }}>{e.materia}</span>,
              },
              {
                className: 'w-36 hidden md:flex',
                content: (
                  <span className="badge" style={{ background:'var(--soft-bg)', color:'var(--t2)' }}>
                    {e.categoria}
                  </span>
                ),
              },
              {
                className: 'w-20 sm:w-28',
                content: (
                  <span className={`inline-flex items-center justify-center min-w-8 sm:min-w-10 h-6 sm:h-7 px-1 sm:px-1.5 rounded-lg text-xs sm:text-sm font-bold border ${gc.bg} ${gc.text} ${gc.border}`}>
                    {e.calMax === 10 ? e.calificacion : `${e.calificacion}/${e.calMax}`}
                  </span>
                ),
              },
              {
                className: 'w-28 hidden lg:flex',
                content: <span className="text-xs" style={{ color:'var(--t3)' }}>{e.periodo ?? '—'}</span>,
              },
              {
                className: 'w-24 hidden lg:flex',
                content: <span className="text-xs font-mono" style={{ color:'var(--t3)' }}>{e.fecha}</span>,
              },
              {
                className: 'w-10 flex justify-end',
                content: (
                  <button onClick={() => setDeleteFor(e)} title="Eliminar evaluación" aria-label="Eliminar evaluación"
                    className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center transition-colors"
                    style={{ color:'var(--t2)', background:'var(--soft-bg)', border:'1px solid var(--card-border)' }}
                    onMouseEnter={ev => ev.currentTarget.style.color='var(--bad)'}
                    onMouseLeave={ev => ev.currentTarget.style.color='var(--t2)'}>
                    <Trash2 size={14}/>
                  </button>
                ),
              },
            ]}/>
          )
        }}
        </ProgressiveList>
        )}
      </DataTable>
    </div>
  )
}
