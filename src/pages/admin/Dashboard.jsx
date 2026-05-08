import { useNavigate } from 'react-router-dom'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import {
  Users, TrendingUp, CalendarCheck, ClipboardList,
  AlertTriangle, CheckCircle, ArrowUpRight, ArrowRight
} from 'lucide-react'
import {
  students, groups, monthlyTrend, subjectPerformance,
  recentActivity, statusConfig
} from '../../data/mockData'

const COLORS = ['#10b981','#f59e0b','#ef4444','#3b82f6']
const AREA_COLORS = ['#3b82f6','#10b981','#f59e0b']

const attendancePie = [
  { name:'Presentes',    value:87 },
  { name:'Tardanzas',    value:7  },
  { name:'Ausentes',     value:4  },
  { name:'Justificados', value:2  },
]

function StatCard({ icon: Icon, label, value, sub, color, onClick }) {
  return (
    <button onClick={onClick}
      className="stat-card text-left hover:shadow-card-md transition-all hover:-translate-y-0.5 w-full group">
      <div className="flex items-start justify-between">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${color}`}>
          <Icon size={22} className="text-white" />
        </div>
        <ArrowUpRight size={16} className="text-slate-300 group-hover:text-slate-500 transition-colors mt-1" />
      </div>
      <p className="text-3xl font-bold text-slate-800 mt-3">{value}</p>
      <p className="text-sm font-medium text-slate-600 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </button>
  )
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-card-md p-3 text-xs">
      <p className="font-semibold text-slate-700 mb-2">{label}</p>
      {payload.map(p => (
        <div key={p.dataKey} className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-slate-600">{p.name}:</span>
          <span className="font-bold text-slate-800">{p.value}</span>
        </div>
      ))}
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const atRisk     = students.filter(s => s.status === 'critical' || s.status === 'at-risk')
  const top5       = [...students].sort((a,b) => b.avgGrade - a.avgGrade).slice(0,5)
  const presentHoy = students.filter(s => s.attendanceRate >= 80).length

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard icon={Users}         label="Total Alumnos"    value={students.length} sub={`${groups.length} grupos activos`} color="bg-navy-900" onClick={()=>navigate('/admin/alumnos')} />
        <StatCard icon={CalendarCheck} label="Asistencia Hoy"   value={`${presentHoy}/${students.length}`} sub="Datos estimados" color="bg-emerald-600" onClick={()=>navigate('/admin/asistencias')} />
        <StatCard icon={TrendingUp}    label="Promedio General"  value="8.1" sub="↑ +0.3 vs mes anterior" color="bg-blue-600" onClick={()=>navigate('/admin/rankings')} />
        <StatCard icon={ClipboardList} label="Alumnos en Riesgo" value={atRisk.length} sub="Requieren atención" color="bg-red-500" onClick={()=>navigate('/admin/ia')} />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Area chart */}
        <div className="card xl:col-span-2 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="section-title">Evolución del Promedio</h2>
              <p className="text-xs text-slate-400 mt-0.5">Promedio mensual por grupo (Sep – Feb)</p>
            </div>
            <button onClick={()=>navigate('/admin/grupos')} className="text-xs text-navy-700 font-medium hover:underline flex items-center gap-1">
              Ver grupos <ArrowRight size={12}/>
            </button>
          </div>
          <ResponsiveContainer width="100%" height={230}>
            <AreaChart data={monthlyTrend} margin={{ top:5, right:10, bottom:0, left:-15 }}>
              <defs>
                {['blue','green','amber'].map((c, i) => (
                  <linearGradient key={c} id={`grad${c}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={AREA_COLORS[i]} stopOpacity={0.15}/>
                    <stop offset="95%" stopColor={AREA_COLORS[i]} stopOpacity={0}/>
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="mes" tick={{ fontSize:11, fill:'#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis domain={[6,10]} tick={{ fontSize:11, fill:'#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize:11, paddingTop:8 }} />
              <Area type="monotone" dataKey="grupoA" name="Grupo A" stroke={AREA_COLORS[0]} fill={`url(#gradblue)`}  strokeWidth={2.5} dot={{ r:3, fill:AREA_COLORS[0] }} />
              <Area type="monotone" dataKey="grupoB" name="Grupo B" stroke={AREA_COLORS[1]} fill={`url(#gradgreen)`} strokeWidth={2.5} dot={{ r:3, fill:AREA_COLORS[1] }} />
              <Area type="monotone" dataKey="grupoC" name="Grupo C" stroke={AREA_COLORS[2]} fill={`url(#gradamber)`} strokeWidth={2.5} dot={{ r:3, fill:AREA_COLORS[2] }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Pie chart */}
        <div className="card p-5">
          <div className="mb-4">
            <h2 className="section-title">Asistencia Hoy</h2>
            <p className="text-xs text-slate-400 mt-0.5">Distribución del grupo completo</p>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={attendancePie} cx="50%" cy="50%" innerRadius={45} outerRadius={70}
                dataKey="value" stroke="none">
                {attendancePie.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
              </Pie>
              <Tooltip formatter={(v) => [`${v}%`]} contentStyle={{ fontSize:11, borderRadius:8 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-2 mt-2">
            {attendancePie.map((d, i) => (
              <div key={d.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background:COLORS[i] }} />
                  <span className="text-xs text-slate-600">{d.name}</span>
                </div>
                <span className="text-xs font-bold text-slate-800">{d.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Charts row 2 + activity */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Bar chart */}
        <div className="card xl:col-span-2 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="section-title">Rendimiento por Materia</h2>
              <p className="text-xs text-slate-400 mt-0.5">Promedio del ciclo escolar</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={subjectPerformance} margin={{ top:5, right:10, bottom:20, left:-15 }} barSize={14} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="materia" tick={{ fontSize:10, fill:'#94a3b8' }} angle={-30} textAnchor="end" axisLine={false} tickLine={false} />
              <YAxis domain={[0,10]} tick={{ fontSize:11, fill:'#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize:11, paddingTop:8 }} />
              <Bar dataKey="promedio" name="Promedio" fill="#3b82f6" radius={[4,4,0,0]} />
              <Bar dataKey="aprobados" name="Aprobados" fill="#10b981" radius={[4,4,0,0]} />
              <Bar dataKey="reprobados" name="Reprobados" fill="#f43f5e" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Recent activity */}
        <div className="card p-5">
          <h2 className="section-title mb-4">Actividad Reciente</h2>
          <div className="space-y-3">
            {recentActivity.map(a => (
              <div key={a.id} className="flex gap-3">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                  a.tipo==='alerta' ? 'bg-red-100' : a.tipo==='importacion' ? 'bg-purple-100' : 'bg-blue-100'
                }`}>
                  {a.tipo==='alerta'
                    ? <AlertTriangle size={13} className="text-red-600"/>
                    : <CheckCircle size={13} className="text-blue-600"/>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-700 font-medium leading-snug">{a.texto}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{a.hora}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top students + At risk */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Top 5 */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title">Top 5 Alumnos</h2>
            <button onClick={()=>navigate('/admin/rankings')} className="text-xs text-navy-700 font-medium hover:underline flex items-center gap-1">
              Ver todos <ArrowRight size={12}/>
            </button>
          </div>
          <div className="space-y-2">
            {top5.map((s, i) => (
              <button key={s.id} onClick={()=>navigate(`/admin/alumnos/${s.id}`)}
                className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-50 transition-colors text-left">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                  i===0?'bg-gold-500 text-white':i===1?'bg-slate-300 text-slate-700':i===2?'bg-amber-700 text-white':'bg-slate-100 text-slate-600'
                }`}>{i+1}</div>
                <div className="w-8 h-8 rounded-full bg-navy-100 flex items-center justify-center text-navy-800 text-xs font-bold flex-shrink-0">
                  {s.name.split(' ').slice(0,2).map(n=>n[0]).join('')}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{s.name}</p>
                  <p className="text-[11px] text-slate-400">{s.groupId.toUpperCase()}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-slate-800">{s.avgGrade}</p>
                  <p className="text-[10px] text-slate-400">{s.attendanceRate}% asist.</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* At risk */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title flex items-center gap-2">
              <AlertTriangle size={16} className="text-red-500" />
              Alumnos en Riesgo
            </h2>
            <button onClick={()=>navigate('/admin/ia')} className="text-xs text-navy-700 font-medium hover:underline flex items-center gap-1">
              Ver análisis IA <ArrowRight size={12}/>
            </button>
          </div>
          <div className="space-y-2">
            {atRisk.map(s => {
              const cfg = statusConfig[s.status]
              return (
                <button key={s.id} onClick={()=>navigate(`/admin/alumnos/${s.id}`)}
                  className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-50 transition-colors text-left border border-slate-100">
                  <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-700 text-xs font-bold flex-shrink-0">
                    {s.name.split(' ').slice(0,2).map(n=>n[0]).join('')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{s.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[10px] font-semibold ${cfg.color}`}>{cfg.label}</span>
                      <span className="text-[10px] text-slate-400">·  Asist. {s.attendanceRate}%</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-red-600">{s.avgGrade}</p>
                    <p className="text-[10px] text-slate-400">promedio</p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
