import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Filter, ArrowRight, Users } from 'lucide-react'
import { students, groups, statusConfig } from '../../data/mockData'

export default function Students() {
  const navigate = useNavigate()
  const [query, setQuery]         = useState('')
  const [groupFilter, setGroup]   = useState('all')
  const [statusFilter, setStatus] = useState('all')
  const [sort, setSort]           = useState('name')

  const filtered = students
    .filter(s => {
      const matchQ = s.name.toLowerCase().includes(query.toLowerCase()) ||
                     s.email.toLowerCase().includes(query.toLowerCase())
      const matchG = groupFilter === 'all' || s.groupId === groupFilter
      const matchS = statusFilter === 'all' || s.status === statusFilter
      return matchQ && matchG && matchS
    })
    .sort((a,b) => {
      if (sort === 'grade')    return b.avgGrade - a.avgGrade
      if (sort === 'attend')   return b.attendanceRate - a.attendanceRate
      if (sort === 'rank')     return a.rank - b.rank
      return a.name.localeCompare(b.name)
    })

  return (
    <div className="max-w-6xl space-y-4">
      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-48">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
              <input value={query} onChange={e=>setQuery(e.target.value)}
                placeholder="Buscar alumno…" className="input-field pl-9" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-500 font-medium mb-1">Grupo</label>
            <select value={groupFilter} onChange={e=>setGroup(e.target.value)} className="input-field text-sm">
              <option value="all">Todos los grupos</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 font-medium mb-1">Estado</label>
            <select value={statusFilter} onChange={e=>setStatus(e.target.value)} className="input-field text-sm">
              <option value="all">Todos</option>
              {Object.entries(statusConfig).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 font-medium mb-1">Ordenar por</label>
            <select value={sort} onChange={e=>setSort(e.target.value)} className="input-field text-sm">
              <option value="name">Nombre A-Z</option>
              <option value="grade">Mayor promedio</option>
              <option value="attend">Mayor asistencia</option>
              <option value="rank">Ranking</option>
            </select>
          </div>
        </div>
        <p className="text-xs text-slate-400 mt-3 flex items-center gap-1.5">
          <Users size={12}/>
          {filtered.length} de {students.length} alumnos
        </p>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="table-header">Alumno</th>
              <th className="table-header">Grupo</th>
              <th className="table-header">Asistencia</th>
              <th className="table-header">Promedio</th>
              <th className="table-header">Tareas</th>
              <th className="table-header">Estado</th>
              <th className="table-header">Tutor</th>
              <th className="table-header"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filtered.map(s => {
              const cfg = statusConfig[s.status]
              const grp = groups.find(g => g.id === s.groupId)
              const attColor = s.attendanceRate >= 90 ? 'text-emerald-600' : s.attendanceRate >= 75 ? 'text-amber-600' : 'text-red-600'
              const gradeColor = s.avgGrade >= 8.5 ? 'text-emerald-600' : s.avgGrade >= 7 ? 'text-blue-600' : 'text-red-600'
              return (
                <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="table-cell">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-full bg-navy-100 flex items-center justify-center text-navy-800 text-xs font-bold flex-shrink-0">
                        {s.name.split(' ').slice(0,2).map(n=>n[0]).join('')}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800">{s.name}</p>
                        <p className="text-[11px] text-slate-400">{s.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="table-cell">
                    <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                      {grp?.name}
                    </span>
                  </td>
                  <td className="table-cell">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width:`${s.attendanceRate}%`, background: s.attendanceRate>=90?'#10b981':s.attendanceRate>=75?'#3b82f6':'#ef4444' }}/>
                      </div>
                      <span className={`text-xs font-bold ${attColor}`}>{s.attendanceRate}%</span>
                    </div>
                  </td>
                  <td className="table-cell">
                    <span className={`font-bold text-base ${gradeColor}`}>{s.avgGrade}</span>
                  </td>
                  <td className="table-cell">
                    <div className="flex items-center gap-1.5">
                      <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-blue-500" style={{ width:`${(s.assignmentsDone/s.assignmentsTotal)*100}%` }}/>
                      </div>
                      <span className="text-xs text-slate-600">{s.assignmentsDone}/{s.assignmentsTotal}</span>
                    </div>
                  </td>
                  <td className="table-cell">
                    <span className={`badge ${cfg.bg} ${cfg.color} border ${cfg.border}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`}/>
                      {cfg.label}
                    </span>
                  </td>
                  <td className="table-cell">
                    <div>
                      <p className="text-xs font-medium text-slate-700">{s.tutor.name}</p>
                      <p className="text-[11px] text-slate-400">{s.tutor.email}</p>
                    </div>
                  </td>
                  <td className="table-cell">
                    <button onClick={()=>navigate(`/admin/alumnos/${s.id}`)}
                      className="p-1.5 rounded-lg hover:bg-slate-200 transition-colors text-slate-500 hover:text-slate-700">
                      <ArrowRight size={15}/>
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            <Users size={32} className="mx-auto mb-2 opacity-30"/>
            <p>No se encontraron alumnos con ese criterio.</p>
          </div>
        )}
      </div>
    </div>
  )
}
