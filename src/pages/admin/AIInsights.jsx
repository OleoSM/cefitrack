import { useNavigate } from 'react-router-dom'
import { BrainCircuit, AlertTriangle, CheckCircle, ArrowRight, Zap } from 'lucide-react'
import { aiInsights, getStudentById, students, statusConfig } from '../../data/mockData'
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts'

const riskColor = {
  crítico: { bg:'bg-red-50 border-red-200',    icon:'text-red-500',   badge:'bg-red-100 text-red-700',   bar:'bg-red-500'    },
  alto:    { bg:'bg-amber-50 border-amber-200', icon:'text-amber-500', badge:'bg-amber-100 text-amber-700', bar:'bg-amber-500' },
  medio:   { bg:'bg-blue-50 border-blue-200',   icon:'text-blue-500',  badge:'bg-blue-100 text-blue-700',  bar:'bg-blue-500'  },
}

const excellent = students.filter(s => s.status === 'excellent')
const goodStudents = students.filter(s => s.status === 'good')

export default function AIInsights() {
  const navigate = useNavigate()
  const atRisk = aiInsights

  return (
    <div className="max-w-5xl space-y-6">
      {/* Summary banner */}
      <div className="rounded-2xl bg-gradient-to-r from-navy-900 to-navy-700 p-6 text-white flex items-center gap-5">
        <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center flex-shrink-0">
          <BrainCircuit size={28} className="text-gold-300"/>
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-bold">Análisis Inteligente de Rendimiento</h2>
          <p className="text-navy-300 text-sm mt-0.5">
            El sistema IA analizó el rendimiento de <strong className="text-white">{students.length} alumnos</strong> y detectó patrones de riesgo académico.
          </p>
        </div>
        <div className="flex gap-4 flex-shrink-0">
          <div className="text-center px-4 py-2 rounded-xl bg-white/10">
            <p className="text-2xl font-bold text-red-300">{atRisk.filter(a=>a.riesgo==='crítico').length}</p>
            <p className="text-[11px] text-navy-300">Críticos</p>
          </div>
          <div className="text-center px-4 py-2 rounded-xl bg-white/10">
            <p className="text-2xl font-bold text-amber-300">{atRisk.filter(a=>a.riesgo==='alto').length}</p>
            <p className="text-[11px] text-navy-300">En riesgo alto</p>
          </div>
          <div className="text-center px-4 py-2 rounded-xl bg-white/10">
            <p className="text-2xl font-bold text-emerald-300">{excellent.length}</p>
            <p className="text-[11px] text-navy-300">Excelentes</p>
          </div>
        </div>
      </div>

      {/* At-risk students */}
      <div>
        <h2 className="section-title flex items-center gap-2 mb-4">
          <AlertTriangle size={17} className="text-red-500"/> Alumnos con Alertas
        </h2>
        <div className="space-y-4">
          {atRisk.map(insight => {
            const s   = getStudentById(insight.studentId)
            const rc  = riskColor[insight.riesgo]
            return (
              <div key={insight.studentId} className={`card p-5 border ${rc.bg}`}>
                <div className="flex items-start gap-4">
                  <div className="w-11 h-11 rounded-xl bg-navy-100 flex items-center justify-center text-navy-800 font-bold text-sm flex-shrink-0">
                    {s?.name.split(' ').slice(0,2).map(n=>n[0]).join('')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-slate-900">{s?.name}</h3>
                      <span className={`badge ${rc.badge} uppercase text-[10px] font-bold`}>
                        {insight.riesgo}
                      </span>
                    </div>

                    {/* Deficiencies */}
                    <div className="mt-3 space-y-2">
                      {insight.deficiencias.map(d => (
                        <div key={d.materia}>
                          <div className="flex items-center justify-between text-xs mb-0.5">
                            <span className="font-medium text-slate-700">{d.materia}</span>
                            <span className="font-bold text-slate-600">{d.nivel}%</span>
                          </div>
                          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${rc.bar}`} style={{ width:`${d.nivel}%` }}/>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">{d.problema}</p>
                        </div>
                      ))}
                    </div>

                    {/* Pattern */}
                    <div className="mt-3 bg-white/70 rounded-lg px-3 py-2 border border-white">
                      <p className="text-xs font-semibold text-slate-500 mb-0.5 flex items-center gap-1">
                        <Zap size={11}/> Patrón detectado
                      </p>
                      <p className="text-xs text-slate-700">{insight.patron}</p>
                    </div>

                    {/* Recommendations */}
                    <div className="mt-3">
                      <p className="text-[11px] font-semibold text-slate-500 mb-1.5">Recomendaciones:</p>
                      <div className="flex flex-wrap gap-2">
                        {insight.recomendaciones.map((r,i) => (
                          <span key={i} className="badge bg-white border border-slate-200 text-slate-700 text-[11px]">
                            {r}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <button onClick={() => navigate(`/admin/alumnos/${s.id}`)}
                    className="btn-secondary text-xs py-1.5 flex-shrink-0">
                    Ver perfil <ArrowRight size={13}/>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Excellent students */}
      <div>
        <h2 className="section-title flex items-center gap-2 mb-4">
          <CheckCircle size={17} className="text-emerald-500"/> Alumnos Destacados
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {excellent.map(s => (
            <button key={s.id} onClick={() => navigate(`/admin/alumnos/${s.id}`)}
              className="card p-4 text-left hover:shadow-card-md transition-all hover:-translate-y-0.5 group">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-800 text-sm font-bold">
                  {s.name.split(' ').slice(0,2).map(n=>n[0]).join('')}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-800 truncate">{s.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-lg font-bold text-emerald-600">{s.avgGrade}</span>
                    <span className="text-xs text-slate-400">· {s.attendanceRate}% asist.</span>
                  </div>
                </div>
                <ArrowRight size={15} className="text-slate-300 group-hover:text-slate-500 transition-colors"/>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* General recommendations */}
      <div className="card p-5">
        <h2 className="section-title mb-4 flex items-center gap-2"><BrainCircuit size={17} className="text-navy-700"/> Recomendaciones Generales del Ciclo</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { title:'Refuerzo de Geometría', desc:'3 alumnos muestran deficiencias persistentes. Considerar taller adicional los viernes.', color:'amber' },
            { title:'Mejorar Asistencia',    desc:'La asistencia baja los lunes correlaciona con calificaciones más bajas en exámenes semanales.', color:'red' },
            { title:'Tutoría entre Pares',   desc:'Emparejar alumnos de excelente desempeño con alumnos en riesgo puede elevar el grupo.', color:'emerald' },
            { title:'Revisión de Evaluaciones', desc:'El tipo "Examen Final" tiene el mayor índice de reprobación. Revisar método de preparación.', color:'blue' },
          ].map(r => {
            const colors = {
              amber:   'bg-amber-50 border-amber-200 text-amber-800',
              red:     'bg-red-50 border-red-200 text-red-800',
              emerald: 'bg-emerald-50 border-emerald-200 text-emerald-800',
              blue:    'bg-blue-50 border-blue-200 text-blue-800',
            }
            return (
              <div key={r.title} className={`rounded-xl border p-4 ${colors[r.color]}`}>
                <p className="font-semibold text-sm mb-1">{r.title}</p>
                <p className="text-xs opacity-80 leading-relaxed">{r.desc}</p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
