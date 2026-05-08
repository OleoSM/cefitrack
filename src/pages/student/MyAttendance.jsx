import { useAuth } from '../../context/AuthContext'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { getStudentById, getAttendByStudent, attendanceColors } from '../../data/mockData'

const PIE_COLORS = ['#10b981','#f59e0b','#ef4444','#3b82f6']

export default function MyAttendance() {
  const { currentUser } = useAuth()
  const s = getStudentById(currentUser?.studentId)
  const att = getAttendByStudent(s?.id)

  if (!s) return <div className="text-slate-500">Perfil no disponible.</div>

  const counts = {
    presente:    att.filter(a=>a.status==='presente').length,
    tardanza:    att.filter(a=>a.status==='tardanza').length,
    ausente:     att.filter(a=>a.status==='ausente').length,
    justificado: att.filter(a=>a.status==='justificado').length,
  }
  const total = att.length
  const pie = Object.entries(counts).map(([k,v]) => ({ name:attendanceColors[k].label, value:v }))
  const attColor = s.attendanceRate>=85?'text-emerald-600':s.attendanceRate>=75?'text-amber-600':'text-red-600'

  const byWeek = att.reduce((acc, a) => {
    const d = new Date(a.date+'T12:00')
    const week = `Semana ${Math.ceil(d.getDate()/7)}`
    if (!acc[week]) acc[week] = []
    acc[week].push(a)
    return acc
  }, {})

  return (
    <div className="max-w-4xl space-y-5">
      <div>
        <h1 className="page-title">Mis Asistencias</h1>
        <p className="text-slate-500 text-sm mt-1">Registro de asistencias de Abril 2026.</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {Object.entries(counts).map(([k,v],i) => {
          const c = attendanceColors[k]
          return (
            <div key={k} className={`stat-card border ${c.bg.replace('bg-','border-').replace('-100','-200')}`}>
              <div className="flex items-center justify-between">
                <span className={`w-3 h-3 rounded-full ${c.dot}`}/>
                <span className={`text-xs font-semibold ${c.text}`}>{total>0?((v/total)*100).toFixed(0):0}%</span>
              </div>
              <p className={`text-3xl font-bold mt-2 ${c.text}`}>{v}</p>
              <p className={`text-sm font-medium mt-0.5 ${c.text}`}>{c.label}</p>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Pie */}
        <div className="card p-5">
          <h2 className="section-title mb-3">Distribución</h2>
          <div className="relative flex justify-center">
            <ResponsiveContainer width={180} height={180}>
              <PieChart>
                <Pie data={pie} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" stroke="none">
                  {pie.map((_,i)=><Cell key={i} fill={PIE_COLORS[i]}/>)}
                </Pie>
                <Tooltip contentStyle={{ fontSize:11, borderRadius:8 }}/>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-3xl font-bold ${attColor}`}>{s.attendanceRate}%</span>
              <span className="text-[10px] text-slate-500">total</span>
            </div>
          </div>
          <div className="space-y-1.5 mt-3">
            {pie.map((d,i)=>(
              <div key={d.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ background:PIE_COLORS[i] }}/>
                  <span className="text-slate-600">{d.name}</span>
                </div>
                <span className="font-bold text-slate-700">{d.value} clases</span>
              </div>
            ))}
          </div>
        </div>

        {/* Calendar grid */}
        <div className="card p-5 xl:col-span-2">
          <h2 className="section-title mb-4">Registro por Semana — Abril 2026</h2>
          <div className="space-y-4">
            {Object.entries(byWeek).map(([week, records]) => (
              <div key={week}>
                <p className="text-xs font-semibold text-slate-500 mb-2">{week}</p>
                <div className="flex flex-wrap gap-1.5">
                  {records.map(r => {
                    const c = attendanceColors[r.status]
                    const d = new Date(r.date+'T12:00')
                    return (
                      <div key={r.id} title={`${d.toLocaleDateString('es-MX',{weekday:'long',day:'numeric'})} — ${c.label}`}
                        className={`w-10 h-10 rounded-lg ${c.bg} ${c.text} flex flex-col items-center justify-center cursor-default group relative`}>
                        <span className="text-[10px] font-semibold uppercase">
                          {d.toLocaleDateString('es-MX',{weekday:'short'}).slice(0,2)}
                        </span>
                        <span className="text-xs font-bold">{d.getDate()}</span>
                        <div className={`w-1.5 h-1.5 rounded-full ${c.dot} mt-0.5`}/>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-slate-100">
            {Object.entries(attendanceColors).map(([k,v]) => (
              <div key={k} className="flex items-center gap-1.5 text-xs text-slate-600">
                <span className={`w-2.5 h-2.5 rounded-full ${v.dot}`}/>
                {v.label}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Full list */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
          <h2 className="section-title">Registro Completo</h2>
        </div>
        <div className="divide-y divide-slate-50 max-h-96 overflow-y-auto">
          {att.map(a => {
            const c = attendanceColors[a.status]
            const d = new Date(a.date+'T12:00')
            return (
              <div key={a.id} className="flex items-center justify-between px-5 py-2.5 hover:bg-slate-50">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg ${c.bg} flex items-center justify-center flex-shrink-0`}>
                    <span className="text-[10px] font-bold uppercase" style={{ color:c.text.replace('text-','') }}>
                      {d.toLocaleDateString('es-MX',{weekday:'short'}).slice(0,2)}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm text-slate-800 font-medium capitalize">
                      {d.toLocaleDateString('es-MX',{ weekday:'long', day:'numeric', month:'long' })}
                    </p>
                  </div>
                </div>
                <span className={`badge ${c.bg} ${c.text} border`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`}/>{c.label}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
