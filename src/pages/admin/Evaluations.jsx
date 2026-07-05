import { useState } from 'react'
import { Plus, X, CheckCircle, Search } from 'lucide-react'
import { evaluations, students, groups } from '../../data/mockData'
import { DataTable, DataTableRow, DataTableAvatar } from '../../components/ui/DataTable'

const tipos = ['Examen Parcial','Tarea','Proyecto','Examen Final','Quíz','Práctica']

const gradeColor = c =>
  c >= 8 ? { bg:'bg-emerald-500/15', text:'text-emerald-400', border:'border-emerald-500/30' }
         : c >= 6 ? { bg:'bg-blue-500/15', text:'text-blue-400', border:'border-blue-500/30' }
                  : { bg:'bg-red-500/15',   text:'text-red-400',  border:'border-red-500/30' }

/* ── Modal para agregar evaluación ─────────────────────────── */
function Modal({ onClose, onAdd }) {
  const [form, setForm] = useState({
    studentId:'', materia:'', tipo:tipos[0],
    calificacion:'', fecha:new Date().toISOString().split('T')[0]
  })
  const [saved, setSaved] = useState(false)
  const set = (k,v) => setForm(f => ({ ...f, [k]:v }))

  const handleSubmit = async e => {
    e.preventDefault()
    setSaved(true)
    await new Promise(r => setTimeout(r, 600))
    onAdd(form)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background:'rgba(0,0,0,.65)', backdropFilter:'blur(6px)' }}
      onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl"
        style={{ background:'rgba(8,8,15,.96)', border:'1px solid rgba(255,255,255,.12)', boxShadow:'0 32px 80px rgba(0,0,0,.70)' }}
        onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom:'1px solid rgba(255,255,255,.08)' }}>
          <h2 className="text-sm font-bold" style={{ color:'rgba(255,255,255,.85)' }}>Agregar Evaluación</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg transition-colors"
            style={{ color:'rgba(255,255,255,.40)' }}
            onMouseEnter={e => e.currentTarget.style.color='white'}
            onMouseLeave={e => e.currentTarget.style.color='rgba(255,255,255,.40)'}>
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
                style={{ color:'rgba(255,255,255,.35)' }}>{f.label}</label>
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5"
                style={{ color:'rgba(255,255,255,.35)' }}>Tipo</label>
              <select value={form.tipo} onChange={e=>set('tipo',e.target.value)} className="input-field">
                {tipos.map(t=><option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5"
                style={{ color:'rgba(255,255,255,.35)' }}>Calificación (0–10)</label>
              <input required type="number" min="0" max="10" step="0.1"
                value={form.calificacion} onChange={e=>set('calificacion',e.target.value)}
                placeholder="8.5" className="input-field"/>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5"
              style={{ color:'rgba(255,255,255,.35)' }}>Fecha</label>
            <input type="date" value={form.fecha} onChange={e=>set('fecha',e.target.value)} className="input-field"/>
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Cancelar</button>
            <button type="submit" disabled={saved} className="btn-primary flex-1 justify-center">
              {saved ? <><CheckCircle size={14}/>Guardando…</> : <><Plus size={14}/>Agregar</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ── Columnas ── */
const COLUMNS = [
  { key:'alumno',  label:'Alumno',       className:'flex-grow min-w-[180px]' },
  { key:'materia', label:'Materia',       className:'w-36 hidden sm:flex' },
  { key:'tipo',    label:'Tipo',          className:'w-36 hidden md:flex' },
  { key:'cal',     label:'Calificación',  className:'w-28' },
  { key:'periodo', label:'Periodo',       className:'w-28 hidden lg:flex' },
  { key:'fecha',   label:'Fecha',         className:'w-24 hidden lg:flex' },
]

export default function Evaluations() {
  const [showModal, setShowModal] = useState(false)
  const [query, setQuery]         = useState('')
  const [groupFilter, setGroup]   = useState('all')
  const [typeFilter, setType]     = useState('all')
  const [extra, setExtra]         = useState([])

  const all = [...evaluations, ...extra]

  const filtered = all.filter(e => {
    const s = students.find(st => st.id === e.studentId)
    if (!s) return false
    const q = query.toLowerCase()
    return (s.name.toLowerCase().includes(q) || e.materia.toLowerCase().includes(q))
      && (groupFilter === 'all' || s.groupId === groupFilter)
      && (typeFilter  === 'all' || e.tipo === typeFilter)
  }).slice(0, 60)

  const handleAdd = form => setExtra(prev => [...prev, {
    id:`new-${Date.now()}`, studentId:form.studentId, materia:form.materia,
    tipo:form.tipo, calificacion:parseFloat(form.calificacion)||0, calMax:10,
    fecha:form.fecha, periodo:'Actual'
  }])

  return (
    <div className="max-w-6xl space-y-4">
      {showModal && <Modal onClose={() => setShowModal(false)} onAdd={handleAdd}/>}

      {/* Toolbar */}
      <div className="card p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="relative flex-1 min-w-[160px]">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2"
              style={{ color:'rgba(255,255,255,.25)' }}/>
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
                style={{ color:'rgba(255,255,255,.30)' }}>{label}</label>
              <select value={value} onChange={e => setter(e.target.value)} className="input-field text-sm">
                {opts.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
            </div>
          ))}

          <button onClick={() => setShowModal(true)} className="btn-primary">
            <Plus size={14}/> Agregar evaluación
          </button>
        </div>

        <p className="text-[11px] mt-3" style={{ color:'rgba(255,255,255,.28)' }}>
          {filtered.length} evaluaciones mostradas (máx. 60)
        </p>
      </div>

      {/* Tabla */}
      <DataTable columns={COLUMNS} isEmpty={filtered.length === 0}
        emptyText="No hay evaluaciones para los filtros seleccionados.">
        {filtered.map(e => {
          const s  = students.find(st => st.id === e.studentId)
          const gc = gradeColor(e.calificacion)
          return (
            <DataTableRow key={e.id} cells={[
              {
                className: 'flex-grow min-w-[180px]',
                content: <DataTableAvatar
                  initials={s?.name.split(' ').slice(0,2).map(n=>n[0]).join('') ?? '?'}
                  name={s?.name ?? '—'}
                  sub={groups.find(g => g.id === s?.groupId)?.name}
                />,
              },
              {
                className: 'w-36 hidden sm:flex',
                content: <span className="text-sm font-medium truncate" style={{ color:'rgba(255,255,255,.72)' }}>{e.materia}</span>,
              },
              {
                className: 'w-36 hidden md:flex',
                content: (
                  <span className="badge" style={{ background:'rgba(255,255,255,.08)', color:'rgba(255,255,255,.55)' }}>
                    {e.tipo}
                  </span>
                ),
              },
              {
                className: 'w-28',
                content: (
                  <span className={`inline-flex items-center justify-center w-10 h-7 rounded-lg text-sm font-bold border ${gc.bg} ${gc.text} ${gc.border}`}>
                    {e.calificacion}
                  </span>
                ),
              },
              {
                className: 'w-28 hidden lg:flex',
                content: <span className="text-xs" style={{ color:'rgba(255,255,255,.40)' }}>{e.periodo}</span>,
              },
              {
                className: 'w-24 hidden lg:flex',
                content: <span className="text-xs font-mono" style={{ color:'rgba(255,255,255,.40)' }}>{e.fecha}</span>,
              },
            ]}/>
          )
        })}
      </DataTable>
    </div>
  )
}
