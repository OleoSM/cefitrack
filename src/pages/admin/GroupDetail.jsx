import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Users, Clock, MapPin, TrendingUp, AlertTriangle } from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts'
import { getGroupById, getStudentsByGroup, monthlyTrend, statusConfig } from '../../data/mockData'
import clsx from 'clsx'

const grpTrendKey = { g1:'grupoA', g2:'grupoB', g3:'grupoC' }
const grpColor    = { g1:'#3b82f6', g2:'#10b981', g3:'#f59e0b' }

export default function GroupDetail() {
  const { groupId } = useParams()
  const navigate = useNavigate()
  const grp = getGroupById(groupId)
  const grpStudents = getStudentsByGroup(groupId)

  if (!grp) return <div className="text-slate-500 p-6">Grupo no encontrado.</div>

  const trendKey = grpTrendKey[groupId]
  const color    = grpColor[groupId]

  const sorted = [...grpStudents].sort((a,b) => b.avgGrade - a.avgGrade)

  return (
    <div className="max-w-5xl space-y-5">
      {/* Back + header */}
      <div>
        <button onClick={() => navigate('/admin/grupos')} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-3 transition-colors">
          <ArrowLeft size={15}/> Regresar a Grupos
        </button>

        <div className="card p-5">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-xl flex items-center justify-center text-white text-2xl font-bold"
              style={{ background: color }}>
              {grp.name.split(' ')[1]}
            </div>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-slate-900">{grp.name} — {grp.subject}</h1>
              <div className="flex flex-wrap gap-4 mt-2 text-sm text-slate-500">
                <span className="flex items-center gap-1.5"><Clock size={13}/>{grp.schedule}</span>
                <span className="flex items-center gap-1.5"><MapPin size={13}/>{grp.room}</span>
                <span className="flex items-center gap-1.5"><Users size={13}/>{grp.studentCount} alumnos</span>
              </div>
            </div>
            <div className="flex gap-3 flex-shrink-0">
              <div className="text-center px-4 py-2 rounded-xl bg-slate-50 border border-slate-200">
                <p className="text-xl font-bold text-slate-800">{grp.avgGrade}</p>
                <p className="text-[11px] text-slate-500">Promedio</p>
              </div>
              <div className="text-center px-4 py-2 rounded-xl bg-slate-50 border border-slate-200">
                <p className="text-xl font-bold text-slate-800">{grp.attendanceRate}%</p>
                <p className="text-[11px] text-slate-500">Asistencia</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Trend chart */}
      <div className="card p-5">
        <h2 className="section-title mb-4">Evolución del Promedio</h2>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={monthlyTrend} margin={{ top:5, right:10, bottom:0, left:-15 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="mes" tick={{ fontSize:11, fill:'#94a3b8' }} axisLine={false} tickLine={false} />
            <YAxis domain={[6,10]} tick={{ fontSize:11, fill:'#94a3b8' }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ fontSize:12, borderRadius:8 }} />
            <Line type="monotone" dataKey={trendKey} name={grp.name} stroke={color} strokeWidth={2.5}
              dot={{ r:4, fill:color }} activeDot={{ r:5 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Students table */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
          <h2 className="section-title">Alumnos del Grupo</h2>
          <button onClick={() => navigate('/admin/asistencias')} className="btn-primary text-xs py-1.5">
            Pasar lista
          </button>
        </div>
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="table-header">#</th>
              <th className="table-header">Alumno</th>
              <th className="table-header">Asistencia</th>
              <th className="table-header">Promedio</th>
              <th className="table-header">Tareas</th>
              <th className="table-header">Estado</th>
              <th className="table-header"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {sorted.map((s, i) => {
              const cfg = statusConfig[s.status]
              const attColor = s.attendanceRate >= 90 ? 'text-emerald-600' : s.attendanceRate >= 75 ? 'text-amber-600' : 'text-red-600'
              const gradeColor = s.avgGrade >= 8.5 ? 'text-emerald-600' : s.avgGrade >= 7 ? 'text-blue-600' : 'text-red-600'
              return (
                <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="table-cell text-slate-400 font-mono text-xs">{i+1}</td>
                  <td className="table-cell">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-navy-100 flex items-center justify-center text-navy-800 text-xs font-bold flex-shrink-0">
                        {s.name.split(' ').slice(0,2).map(n=>n[0]).join('')}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800 text-sm">{s.name}</p>
                        <p className="text-[11px] text-slate-400">{s.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="table-cell">
                    <span className={`font-bold ${attColor}`}>{s.attendanceRate}%</span>
                  </td>
                  <td className="table-cell">
                    <span className={`font-bold text-base ${gradeColor}`}>{s.avgGrade}</span>
                  </td>
                  <td className="table-cell">
                    <span className="text-slate-700">{s.assignmentsDone}/{s.assignmentsTotal}</span>
                  </td>
                  <td className="table-cell">
                    <span className={`badge ${cfg.bg} ${cfg.color} border ${cfg.border}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`}/>
                      {cfg.label}
                    </span>
                  </td>
                  <td className="table-cell">
                    <button onClick={() => navigate(`/admin/alumnos/${s.id}`)}
                      className="text-xs text-navy-700 font-medium hover:underline">Ver perfil</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
