import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, ResponsiveContainer
} from 'recharts'
import { BookOpen, CalendarCheck, FileText, BrainCircuit, TrendingUp, ArrowRight } from 'lucide-react'
import {
  getStudentById, getGroupById, getEvalsByStudent, getAttendByStudent,
  studentGradeTrend, attendanceColors
} from '../../data/mockData'

const PIE_COLORS = ['#10b981','#f59e0b','#ef4444','#3b82f6']

export default function StudentDashboard() {
  const { currentUser } = useAuth()
  const navigate = useNavigate()
  const s = getStudentById(currentUser?.studentId)
  const grp = getGroupById(s?.groupId)
  const evals = getEvalsByStudent(s?.id).slice(-5)
  const att = getAttendByStudent(s?.id)
  const trend = studentGradeTrend[s?.id]

  if (!s) return <div className="text-slate-500">Perfil no disponible.</div>

  const attCounts = {
    presente:    att.filter(a=>a.status==='presente').length,
    tardanza:    att.filter(a=>a.status==='tardanza').length,
    ausente:     att.filter(a=>a.status==='ausente').length,
    justificado: att.filter(a=>a.status==='justificado').length,
  }
  const attPie = Object.entries(attCounts).map(([k,v]) => ({ name: attendanceColors[k].label, value:v }))

  const gradeColor = s.avgGrade >= 8.5 ? 'text-emerald-600' : s.avgGrade >= 7 ? 'text-blue-600' : 'text-amber-600'
  const attColor   = s.attendanceRate >= 85 ? 'text-emerald-600' : s.attendanceRate >= 75 ? 'text-amber-600' : 'text-red-600'

  return (
    <div className="max-w-5xl space-y-5">
      {/* Welcome */}
      <div className="rounded-2xl bg-gradient-to-r from-navy-900 to-navy-700 p-6 text-white">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center text-xl font-bold flex-shrink-0">
            {s.name.split(' ').slice(0,2).map(n=>n[0]).join('')}
          </div>
          <div>
            <p className="text-navy-300 text-sm">Bienvenido de vuelta</p>
            <h1 className="text-xl font-bold">{s.name}</h1>
            <p className="text-navy-400 text-sm mt-0.5">{grp?.name} — {grp?.subject}</p>
          </div>
          <div className="ml-auto hidden sm:flex gap-3">
            <div className="text-center px-4 py-2 rounded-xl bg-white/10">
              <p className={`text-2xl font-bold ${gradeColor === 'text-emerald-600' ? 'text-emerald-300' : 'text-gold-300'}`}>{s.avgGrade}</p>
              <p className="text-[11px] text-navy-300">Promedio</p>
            </div>
            <div className="text-center px-4 py-2 rounded-xl bg-white/10">
              <p className="text-2xl font-bold text-gold-300">#1</p>
              <p className="text-[11px] text-navy-300">Lugar en grupo</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { icon:TrendingUp,  label:'Promedio General',   value:s.avgGrade,                    color:'bg-emerald-600', nav:'/student/calificaciones' },
          { icon:CalendarCheck,label:'Asistencia',        value:`${s.attendanceRate}%`,         color:'bg-blue-600',   nav:'/student/asistencias' },
          { icon:BookOpen,    label:'Tareas Entregadas',  value:`${s.assignmentsDone}/${s.assignmentsTotal}`, color:'bg-amber-500', nav:'/student/calificaciones' },
          { icon:BrainCircuit,label:'Reporte IA',         value:'Ver',                          color:'bg-purple-600', nav:'/student/reporte-ia' },
        ].map(({ icon:Icon, label, value, color, nav }) => (
          <button key={label} onClick={() => navigate(nav)}
            className="stat-card text-left hover:shadow-card-md transition-all hover:-translate-y-0.5 group w-full">
            <div className={`w-9 h-9 rounded-xl ${color} flex items-center justify-center mb-3`}>
              <Icon size={18} className="text-white"/>
            </div>
            <p className="text-2xl font-bold text-slate-800">{value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{label}</p>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Grade trend */}
        <div className="card p-5 xl:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title">Evolución de mis Calificaciones</h2>
            <button onClick={()=>navigate('/student/calificaciones')} className="text-xs text-navy-700 hover:underline flex items-center gap-1">
              Ver todas <ArrowRight size={12}/>
            </button>
          </div>
          {trend ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={trend} margin={{ top:5, right:5, bottom:0, left:-20 }}>
                <defs>
                  {['#3b82f6','#10b981','#f59e0b'].map((c,i)=>(
                    <linearGradient key={i} id={`sg${i}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={c} stopOpacity={0.15}/>
                      <stop offset="95%" stopColor={c} stopOpacity={0}/>
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                <XAxis dataKey="mes" tick={{ fontSize:11, fill:'#94a3b8' }} axisLine={false} tickLine={false}/>
                <YAxis domain={[4,10]} tick={{ fontSize:11, fill:'#94a3b8' }} axisLine={false} tickLine={false}/>
                <Tooltip contentStyle={{ fontSize:11, borderRadius:8 }}/>
                {Object.keys(trend[0]).filter(k=>k!=='mes').map((k,i)=>(
                  <Area key={k} type="monotone" dataKey={k} name={k} stroke={['#3b82f6','#10b981','#f59e0b'][i]} fill={`url(#sg${i})`} strokeWidth={2}/>
                ))}
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-slate-400 text-sm">Sin datos</div>
          )}
        </div>

        {/* Attendance pie */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="section-title">Mi Asistencia</h2>
            <button onClick={()=>navigate('/student/asistencias')} className="text-xs text-navy-700 hover:underline">Ver detalle</button>
          </div>
          <div className="flex items-center justify-center">
            <div className="relative">
              <ResponsiveContainer width={150} height={150}>
                <PieChart>
                  <Pie data={attPie} cx="50%" cy="50%" innerRadius={45} outerRadius={68} dataKey="value" stroke="none">
                    {attPie.map((_,i)=><Cell key={i} fill={PIE_COLORS[i]}/>)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-2xl font-bold ${attColor}`}>{s.attendanceRate}%</span>
                <span className="text-[10px] text-slate-500">asistencia</span>
              </div>
            </div>
          </div>
          <div className="space-y-1.5 mt-2">
            {attPie.map((d,i)=>(
              <div key={d.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ background:PIE_COLORS[i] }}/>
                  <span className="text-slate-600">{d.name}</span>
                </div>
                <span className="font-bold text-slate-700">{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent evals */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
          <h2 className="section-title">Últimas Evaluaciones</h2>
          <button onClick={()=>navigate('/student/calificaciones')} className="text-xs text-navy-700 hover:underline flex items-center gap-1">
            Ver todas <ArrowRight size={12}/>
          </button>
        </div>
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="table-header">Materia</th>
              <th className="table-header">Tipo</th>
              <th className="table-header">Calificación</th>
              <th className="table-header">Fecha</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {evals.map(e => {
              const c = e.calificacion>=8?'text-emerald-600':e.calificacion>=6?'text-blue-600':'text-red-600'
              return (
                <tr key={e.id} className="hover:bg-slate-50/50">
                  <td className="table-cell font-medium text-slate-800">{e.materia}</td>
                  <td className="table-cell"><span className="badge bg-slate-100 text-slate-600">{e.tipo}</span></td>
                  <td className="table-cell"><span className={`font-bold text-lg ${c}`}>{e.calificacion}</span></td>
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
