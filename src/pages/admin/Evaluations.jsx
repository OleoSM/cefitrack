import { useState, useEffect, useCallback } from 'react'
import { Plus, X, CheckCircle, Search, Trash2, AlertCircle } from 'lucide-react'
import {
  fetchEvaluations, fetchStudents, fetchGroups,
  saveEvaluation, deleteEvaluation,
} from '../../lib/supabaseData'
import { DataTable, DataTableRow, DataTableAvatar } from '../../components/ui/DataTable'
import ProgressiveList, { FilterBar } from '../../components/ui/ProgressiveList'
import ModalPortal from '../../components/ui/ModalPortal'

// Las cuatro categorías autorizadas por CEFIMAT (requisito EVA-01).
// Las anteriores (Examen Parcial, Proyecto, Examen Final, Quíz, Práctica) se retiran.
const tipos = ['Tarea','Actividad en clase','Examen digital','Examen de simulación']

const gradeColor = c =>
  c >= 8 ? { bg:'bg-emerald-500/15', text:'text-emerald-400', border:'border-emerald-500/30' }
         : c >= 6 ? { bg:'bg-blue-500/15', text:'text-blue-400', border:'border-blue-500/30' }
                  : { bg:'bg-red-500/15',   text:'text-red-400',  border:'border-red-500/30' }

/* ── Modal para agregar evaluación ─────────────────────────── */
function Modal({ students, onClose, onSaved }) {
  const [form, setForm] = useState({
    studentId:'', materia:'', tipo:tipos[0],
    calificacion:'', calMax:'10', periodo:'',
    fecha:new Date().toISOString().split('T')[0]
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState(null)
  const set = (k,v) => setForm(f => ({ ...f, [k]:v }))

  const handleSubmit = async e => {
    e.preventDefault()
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
          <button onClick={onClose} className="p-1.5 rounded-lg transition-colors"
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
              <AlertCircle size={13} className="mt-0.5 shrink-0 text-red-400"/>
              <span className="text-xs text-red-400">{error}</span>
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
  { key:'acciones',label:'',              className:'w-10' },
]

export default function Evaluations() {
  const [showModal, setShowModal] = useState(false)
  const [query, setQuery]         = useState('')
  const [groupFilter, setGroup]   = useState('all')
  const [typeFilter, setType]     = useState('all')

  const [evaluations, setEvaluations] = useState([])
  const [students, setStudents]       = useState([])
  const [groups, setGroups]           = useState([])
  const [loading, setLoading]         = useState(true)
  const [loadError, setLoadError]     = useState(null)

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

  const handleDelete = async id => {
    setEvaluations(prev => prev.filter(e => e.id !== id))
    try { await deleteEvaluation(id) } catch { load() }
  }

  const filtered = evaluations.filter(e => {
    const s = students.find(st => st.id === e.studentId)
    if (!s) return false
    const q = query.toLowerCase()
    return (s.name.toLowerCase().includes(q) || e.materia.toLowerCase().includes(q))
      && (groupFilter === 'all' || s.groupId === groupFilter)
      && (typeFilter  === 'all' || e.tipo === typeFilter)
  })

  return (
    <div className="space-y-4">
      {showModal && (
        <Modal students={students} onClose={() => setShowModal(false)} onSaved={load}/>
      )}

      {/* Toolbar */}
      <FilterBar
        activos={[groupFilter, typeFilter].filter(v => v !== 'all').length + (query ? 1 : 0)}
        acciones={
          <button onClick={() => setShowModal(true)} disabled={students.length === 0} className="btn-primary">
            <Plus size={14}/> <span className="hidden sm:inline">Agregar evaluación</span>
          </button>
        }>
        <>
          <div className="relative flex-1 min-w-[160px]">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2"
              style={{ color:'var(--t4)' }}/>
            <input value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Buscar alumno o materia…" className="input-field pl-9"/>
          </div>

          {[
            { label:'Grupo', value:groupFilter, setter:setGroup,
              opts:[{v:'all',l:'Todos los grupos'}, ...groups.map(g=>({v:g.id,l:g.name}))] },
            { label:'Tipo', value:typeFilter, setter:setType,
              opts:[{v:'all',l:'Todos los tipos'}, ...tipos.map(t=>({v:t,l:t}))] },
          ].map(({ label, value, setter, opts }) => (
            <div key={label}>
              <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5"
                style={{ color:'var(--t3)' }}>{label}</label>
              <select value={value} onChange={e => setter(e.target.value)} className="input-field text-sm">
                {opts.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
            </div>
          ))}

        </>
      </FilterBar>

      <p className="text-[11px] px-1" style={{ color:'var(--t3)' }}>
        {loading ? 'Cargando…' : `${filtered.length} evaluaciones`}
      </p>

      {loadError && (
        <div className="card p-4 flex items-center gap-2">
          <AlertCircle size={14} className="text-red-400"/>
          <span className="text-xs text-red-400">{loadError}</span>
        </div>
      )}

      {/* Tabla */}
      <DataTable columns={COLUMNS} isEmpty={!loading && filtered.length === 0}
        emptyText={evaluations.length === 0
          ? 'Aún no hay calificaciones capturadas. Usa “Agregar evaluación” para registrar la primera.'
          : 'No hay evaluaciones para los filtros seleccionados.'}>
        <ProgressiveList items={filtered} emptyLabel="Ninguna evaluación coincide con el filtro.">
        {e => {
          const s  = students.find(st => st.id === e.studentId)
          const base10 = e.calMax ? (e.calificacion / e.calMax) * 10 : e.calificacion
          const gc = gradeColor(base10)
          return (
            <DataTableRow key={e.id} cells={[
              {
                className: 'flex-grow min-w-[180px]',
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
                    {e.tipo}
                  </span>
                ),
              },
              {
                className: 'w-28',
                content: (
                  <span className={`inline-flex items-center justify-center min-w-10 h-7 px-1.5 rounded-lg text-sm font-bold border ${gc.bg} ${gc.text} ${gc.border}`}>
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
                className: 'w-10',
                content: (
                  <button onClick={() => handleDelete(e.id)} title="Eliminar evaluación"
                    className="p-1.5 rounded-lg transition-colors"
                    style={{ color:'var(--t4)' }}
                    onMouseEnter={ev => ev.currentTarget.style.color='rgb(248,113,113)'}
                    onMouseLeave={ev => ev.currentTarget.style.color='var(--t4)'}>
                    <Trash2 size={13}/>
                  </button>
                ),
              },
            ]}/>
          )
        }}
        </ProgressiveList>
      </DataTable>
    </div>
  )
}
