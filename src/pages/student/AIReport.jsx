import { useAuth } from '../../context/AuthContext'
import { BrainCircuit, CheckCircle, AlertTriangle, TrendingUp, Star, Zap, BookOpen } from 'lucide-react'
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts'
import { getStudentById, getInsightByStudent, studentRadar, statusConfig } from '../../data/mockData'

export default function AIReport() {
  const { currentUser } = useAuth()
  const s = getStudentById(currentUser?.studentId)
  const insight = getInsightByStudent(s?.id)
  const radar = studentRadar[s?.id]

  if (!s) return <div className="text-slate-500">Perfil no disponible.</div>

  const cfg = statusConfig[s.status]
  const isGood = s.status === 'excellent' || s.status === 'good'

  return (
    <div className="max-w-4xl space-y-5">
      {/* Header */}
      <div className={`rounded-2xl p-6 text-white ${isGood ? 'bg-gradient-to-r from-emerald-700 to-emerald-500' : 'bg-gradient-to-r from-navy-900 to-red-800'}`}>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center flex-shrink-0">
            <BrainCircuit size={28}/>
          </div>
          <div>
            <p className="text-white/70 text-sm">Reporte IA personalizado para</p>
            <h1 className="text-xl font-bold">{s.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm opacity-80">Estado académico:</span>
              <span className={`badge bg-white/20 text-white border border-white/30`}>
                <span className="w-1.5 h-1.5 rounded-full bg-white"/>{cfg.label}
              </span>
            </div>
          </div>
        </div>
      </div>

      {isGood ? (
        /* ── Good/Excellent student report ──────────────────── */
        <>
          <div className="card p-6 border-l-4 border-l-emerald-500">
            <div className="flex items-start gap-3 mb-4">
              <Star size={20} className="text-emerald-500 flex-shrink-0 mt-0.5"/>
              <div>
                <h2 className="font-bold text-slate-900 text-base">Análisis de Rendimiento — IA</h2>
                <p className="text-slate-500 text-sm mt-0.5">Generado con base en tu historial del ciclo escolar 2025-B</p>
              </div>
            </div>

            <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-200">
              <p className="text-sm text-emerald-800 leading-relaxed">
                Tu desempeño académico es <strong>sobresaliente</strong>. Mantienes un promedio de{' '}
                <strong>{s.avgGrade}</strong> con una asistencia del <strong>{s.attendanceRate}%</strong>.
                Has entregado <strong>{s.assignmentsDone} de {s.assignmentsTotal}</strong> tareas asignadas.
                El sistema detecta un patrón de aprendizaje consistente y responsable.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {/* Strengths */}
            <div className="card p-5">
              <h3 className="section-title flex items-center gap-2 mb-4">
                <CheckCircle size={16} className="text-emerald-500"/> Fortalezas detectadas
              </h3>
              <ul className="space-y-3">
                {[
                  'Alto nivel de comprensión conceptual en todas las materias.',
                  'Asistencia constante: uno de los más altos del grupo.',
                  'Entrega puntual de tareas y proyectos.',
                  'Participación activa en clase genera refuerzo del aprendizaje.',
                ].map((f,i)=>(
                  <li key={i} className="flex items-start gap-2.5">
                    <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-emerald-600 text-[10px] font-bold">{i+1}</span>
                    </div>
                    <p className="text-sm text-slate-700">{f}</p>
                  </li>
                ))}
              </ul>
            </div>

            {/* Radar */}
            {radar && (
              <div className="card p-5">
                <h3 className="section-title mb-4">Mapa de Competencias</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <RadarChart data={radar}>
                    <PolarGrid stroke="#e2e8f0"/>
                    <PolarAngleAxis dataKey="comp" tick={{ fontSize:10, fill:'#94a3b8' }}/>
                    <PolarRadiusAxis angle={90} domain={[0,10]} tick={{ fontSize:9, fill:'#cbd5e1' }}/>
                    <Radar name={s.name} dataKey="valor"
                      stroke="#10b981" fill="#10b981" fillOpacity={0.2} strokeWidth={2}/>
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Goals */}
          <div className="card p-5">
            <h3 className="section-title flex items-center gap-2 mb-4">
              <TrendingUp size={16} className="text-blue-500"/> Objetivos para el siguiente periodo
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { goal:'Mantener promedio ≥ 9.0',  progress:92, color:'#10b981' },
                { goal:'Asistencia al 100%',        progress:s.attendanceRate, color:'#3b82f6' },
                { goal:'Tareas al día (20/20)',      progress:(s.assignmentsDone/s.assignmentsTotal)*100, color:'#f59e0b' },
              ].map(({ goal, progress, color }) => (
                <div key={goal} className="bg-slate-50 rounded-xl p-4">
                  <p className="text-xs font-semibold text-slate-700 mb-2">{goal}</p>
                  <div className="h-2 bg-slate-200 rounded-full overflow-hidden mb-1">
                    <div className="h-full rounded-full" style={{ width:`${Math.min(100,progress)}%`, background:color }}/>
                  </div>
                  <p className="text-xs text-slate-500 text-right font-bold">{Math.round(progress)}%</p>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        /* ── At-risk student report ────────────────────────── */
        <>
          <div className="card p-6 border-l-4 border-l-red-500">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle size={20} className="text-red-500 flex-shrink-0 mt-0.5"/>
              <div>
                <h2 className="font-bold text-slate-900 text-base">Análisis de Rendimiento — IA</h2>
                <p className="text-slate-500 text-sm mt-0.5">El sistema detectó áreas de atención que necesitan mejora inmediata.</p>
              </div>
            </div>

            {insight && (
              <div className="bg-red-50 rounded-xl p-4 border border-red-200">
                <p className="text-sm text-red-800 leading-relaxed"><strong>Patrón detectado: </strong>{insight.patron}</p>
              </div>
            )}
          </div>

          {insight && (
            <>
              <div className="card p-5">
                <h3 className="section-title mb-4">Áreas con Mayor Deficiencia</h3>
                <div className="space-y-4">
                  {insight.deficiencias.map(d=>(
                    <div key={d.materia}>
                      <div className="flex justify-between mb-1"><span className="text-sm font-semibold text-slate-800">{d.materia}</span>
                        <span className="text-sm font-bold text-red-600">{d.nivel}%</span></div>
                      <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-red-500" style={{ width:`${d.nivel}%` }}/>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">{d.problema}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card p-5">
                <h3 className="section-title mb-4 flex items-center gap-2">
                  <Zap size={16} className="text-amber-500"/> Plan de Acción Recomendado
                </h3>
                <div className="space-y-2">
                  {insight.recomendaciones.map((r,i)=>(
                    <div key={i} className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                      <div className="w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">{i+1}</div>
                      <p className="text-sm text-amber-900">{r}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          <div className="card p-5">
            <h3 className="section-title mb-4">Tu Situación Actual</h3>
            <div className="grid grid-cols-3 gap-4">
              {[
                { label:'Promedio', value:s.avgGrade, target:7.0, color:s.avgGrade>=7?'#10b981':'#ef4444' },
                { label:'Asistencia', value:s.attendanceRate, target:80, color:s.attendanceRate>=80?'#10b981':'#ef4444', suffix:'%' },
                { label:'Tareas', value:s.assignmentsDone, target:s.assignmentsTotal, color:s.assignmentsDone>=s.assignmentsTotal*0.8?'#10b981':'#ef4444' },
              ].map(({ label, value, target, color, suffix }) => (
                <div key={label} className="text-center bg-slate-50 rounded-xl p-4">
                  <p className="text-2xl font-bold" style={{ color }}>{value}{suffix||''}</p>
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Meta: {target}{suffix||''}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Note */}
      <p className="text-xs text-center text-slate-400">
        Este reporte es generado por el sistema de IA de EduTrack y tiene fines de orientación académica.
        Para información adicional, contacta a tu docente.
      </p>
    </div>
  )
}
