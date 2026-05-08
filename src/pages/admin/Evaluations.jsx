import { useState } from 'react'
import { Plus, X, CheckCircle, Search, ChevronDown } from 'lucide-react'
import { evaluations, students, groups } from '../../data/mockData'

const tipos = ['Examen Parcial','Tarea','Proyecto','Examen Final','Quíz','Práctica']

function Modal({ onClose, onAdd }) {
  const [form, setForm] = useState({ studentId:'', materia:'', tipo:tipos[0], calificacion:'', fecha:new Date().toISOString().split('T')[0] })
  const [saved, setSaved] = useState(false)

  const set = (k,v) => setForm(f => ({ ...f, [k]:v }))

  const handleSubmit = async e => {
    e.preventDefault()
    setSaved(true)
    await new Promise(r=>setTimeout(r,600))
    onAdd(form)
    onClose()
  }

  const grpStudents = form.studentId === '' ? [] : null

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-900">Agregar Evaluación</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
            <X size={16}/>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Alumno *</label>
            <select required value={form.studentId} onChange={e=>set('studentId',e.target.value)} className="input-field">
              <option value="">Seleccionar alumno</option>
              {students.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Materia *</label>
            <input required value={form.materia} onChange={e=>set('materia',e.target.value)} placeholder="Ej. Álgebra" className="input-field"/>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Tipo</label>
              <select value={form.tipo} onChange={e=>set('tipo',e.target.value)} className="input-field">
                {tipos.map(t=><option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Calificación * <span className="text-slate-400 font-normal">(0–10)</span></label>
              <input required type="number" min="0" max="10" step="0.1"
                value={form.calificacion} onChange={e=>set('calificacion',e.target.value)}
                placeholder="8.5" className="input-field"/>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Fecha</label>
            <input type="date" value={form.fecha} onChange={e=>set('fecha',e.target.value)} className="input-field"/>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Cancelar</button>
            <button type="submit" disabled={saved} className="btn-primary flex-1 justify-center">
              {saved ? <><CheckCircle size={15}/>Guardando…</> : <><Plus size={15}/>Agregar</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Evaluations() {
  const [showModal, setShowModal] = useState(false)
  const [query, setQuery]         = useState('')
  const [groupFilter, setGroup]   = useState('all')
  const [typeFilter, setType]     = useState('all')
  const [extra, setExtra]         = useState([])

  const all = [...evaluations, ...extra]

  const filtered = all.filter(e => {
    const s = students.find(st=>st.id===e.studentId)
    if (!s) return false
    const matchQ = s.name.toLowerCase().includes(query.toLowerCase()) || e.materia.toLowerCase().includes(query.toLowerCase())
    const matchG = groupFilter === 'all' || s.groupId === groupFilter
    const matchT = typeFilter === 'all' || e.tipo === typeFilter
    return matchQ && matchG && matchT
  }).slice(0,60)

  const handleAdd = form => {
    setExtra(prev => [...prev, {
      id:`new-${Date.now()}`, studentId:form.studentId, materia:form.materia,
      tipo:form.tipo, calificacion:parseFloat(form.calificacion)||0, calMax:10, fecha:form.fecha, periodo:'Actual'
    }])
  }

  return (
    <div className="max-w-6xl space-y-4">
      {showModal && <Modal onClose={()=>setShowModal(false)} onAdd={handleAdd}/>}

      {/* Toolbar */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
          <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar alumno o materia…" className="input-field pl-9"/>
        </div>
        <select value={groupFilter} onChange={e=>setGroup(e.target.value)} className="input-field text-sm w-auto">
          <option value="all">Todos los grupos</option>
          {groups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <select value={typeFilter} onChange={e=>setType(e.target.value)} className="input-field text-sm w-auto">
          <option value="all">Todos los tipos</option>
          {tipos.map(t=><option key={t}>{t}</option>)}
        </select>
        <button onClick={()=>setShowModal(true)} className="btn-primary">
          <Plus size={15}/>Agregar evaluación
        </button>
      </div>

      <p className="text-xs text-slate-400">{filtered.length} evaluaciones mostradas (máx. 60)</p>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="table-header">Alumno</th>
              <th className="table-header">Materia</th>
              <th className="table-header">Tipo</th>
              <th className="table-header">Calificación</th>
              <th className="table-header">Periodo</th>
              <th className="table-header">Fecha</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filtered.map(e => {
              const s = students.find(st=>st.id===e.studentId)
              const color = e.calificacion>=8?'text-emerald-600 bg-emerald-50':e.calificacion>=6?'text-blue-600 bg-blue-50':'text-red-600 bg-red-50'
              return (
                <tr key={e.id} className="hover:bg-slate-50/50">
                  <td className="table-cell">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-navy-100 flex items-center justify-center text-navy-800 text-[10px] font-bold">
                        {s?.name.split(' ').slice(0,2).map(n=>n[0]).join('')}
                      </div>
                      <span className="text-sm font-medium text-slate-800">{s?.name}</span>
                    </div>
                  </td>
                  <td className="table-cell font-medium text-slate-700">{e.materia}</td>
                  <td className="table-cell"><span className="badge bg-slate-100 text-slate-600">{e.tipo}</span></td>
                  <td className="table-cell">
                    <span className={`inline-flex items-center justify-center w-10 h-7 rounded-lg text-sm font-bold ${color}`}>
                      {e.calificacion}
                    </span>
                  </td>
                  <td className="table-cell text-slate-500 text-xs">{e.periodo}</td>
                  <td className="table-cell text-slate-500 text-xs">{e.fecha}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
