import { BrainCircuit, CheckCircle, AlertTriangle, TrendingUp, Star, Zap } from 'lucide-react'
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts'
import { getInsightByStudent, studentRadar, statusConfig } from '../../data/mockData'
import { useStudentData } from '../../hooks/useStudentData'

export default function AIReport() {
  const { student: s } = useStudentData()
  const insight = getInsightByStudent(s?.id)
  const radar = studentRadar[s?.id]

  if (!s) return null

  const cfg = statusConfig[s.status]
  const isGood = s.status === 'excellent' || s.status === 'good'

  return (
    <div className="max-w-4xl space-y-5">
      {/* Header */}
      <div className={`rounded-2xl p-4 sm:p-6 text-white ${isGood ? 'bg-gradient-to-r from-emerald-700 to-emerald-500' : 'bg-gradient-to-r from-navy-900 to-red-800'}`}>
        <div className="flex items-start sm:items-center gap-3 sm:gap-4">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white/15 flex items-center justify-center flex-shrink-0">
            <BrainCircuit size={24}/>
          </div>
          <div className="min-w-0">
            <p className="text-white/70 text-xs sm:text-sm">Reporte IA personalizado para</p>
            <h1 className="text-lg sm:text-xl font-bold truncate">{s.name}</h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-xs sm:text-sm opacity-80">Estado académico:</span>
              <span className="badge bg-white/20 text-white border border-white/30">
                <span className="w-1.5 h-1.5 rounded-full bg-white"/>{cfg.label}
              </span>
            </div>
          </div>
        </div>
      </div>

      {isGood ? (
        <>
          <div className="card p-4 sm:p-6" style={{ borderLeft:'3px solid #34d399' }}>
            <div className="flex items-start gap-3 mb-4">
              <Star size={18} className="text-emerald-400 flex-shrink-0 mt-0.5"/>
              <div>
                <h2 className="font-bold text-sm sm:text-base" style={{ color:'rgba(255,255,255,.88)' }}>Análisis de Rendimiento — IA</h2>
                <p className="text-xs sm:text-sm mt-0.5" style={{ color:'rgba(255,255,255,.40)' }}>Generado con base en tu historial del ciclo escolar 2025-B</p>
              </div>
            </div>
            <div className="rounded-xl p-3 sm:p-4" style={{ background:'rgba(52,211,153,.10)', border:'1px solid rgba(52,211,153,.22)' }}>
              <p className="text-xs sm:text-sm text-emerald-300 leading-relaxed">
                Tu desempeño académico es <strong>sobresaliente</strong>. Mantienes un promedio de{' '}
                <strong>{s.avgGrade}</strong> con una asistencia del <strong>{s.attendanceRate}%</strong>.
                Has entregado <strong>{s.assignmentsDone} de {s.assignmentsTotal}</strong> tareas asignadas.
                El sistema detecta un patrón de aprendizaje consistente y responsable.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {/* Strengths */}
            <div className="card p-4 sm:p-5">
              <h3 className="section-title flex items-center gap-2 mb-4">
                <CheckCircle size={15} className="text-emerald-400"/> Fortalezas detectadas
              </h3>
              <ul className="space-y-3">
                {[
                  'Alto nivel de comprensión conceptual en todas las materias.',
                  'Asistencia constante: uno de los más altos del grupo.',
                  'Entrega puntual de tareas y proyectos.',
                  'Participación activa en clase genera refuerzo del aprendizaje.',
                ].map((f,i)=>(
                  <li key={i} className="flex items-start gap-2.5">
                    <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-emerald-400 text-[10px] font-bold">{i+1}</span>
                    </div>
                    <p className="text-xs sm:text-sm" style={{ color:'rgba(255,255,255,.65)' }}>{f}</p>
                  </li>
                ))}
              </ul>
            </div>

            {/* Radar */}
            {radar && (
              <div className="card p-4 sm:p-5">
                <h3 className="section-title mb-4">Mapa de Competencias</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <RadarChart data={radar}>
                    <PolarGrid stroke="rgba(255,255,255,.10)"/>
                    <PolarAngleAxis dataKey="comp" tick={{ fontSize:10, fill:'rgba(255,255,255,.40)' }}/>
                    <PolarRadiusAxis angle={90} domain={[0,10]} tick={{ fontSize:9, fill:'rgba(255,255,255,.25)' }}/>
                    <Radar name={s.name} dataKey="valor"
                      stroke="#34d399" fill="#34d399" fillOpacity={0.15} strokeWidth={2}/>
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Goals */}
          <div className="card p-4 sm:p-5">
            <h3 className="section-title flex items-center gap-2 mb-4">
              <TrendingUp size={15} className="text-blue-400"/> Objetivos para el siguiente periodo
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { goal:'Mantener promedio ≥ 9.0',  progress:92,                                       color:'#34d399' },
                { goal:'Asistencia al 100%',        progress:s.attendanceRate,                        color:'#60a5fa' },
                { goal:'Tareas al día (20/20)',      progress:(s.assignmentsDone/s.assignmentsTotal)*100, color:'#fbbf24' },
              ].map(({ goal, progress, color }) => (
                <div key={goal} className="rounded-xl p-3 sm:p-4"
                  style={{ background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.08)' }}>
                  <p className="text-xs font-semibold mb-2" style={{ color:'rgba(255,255,255,.65)' }}>{goal}</p>
                  <div className="h-2 rounded-full overflow-hidden mb-1" style={{ background:'rgba(255,255,255,.10)' }}>
                    <div className="h-full rounded-full" style={{ width:`${Math.min(100,progress)}%`, background:color }}/>
                  </div>
                  <p className="text-xs text-right font-bold" style={{ color:'rgba(255,255,255,.50)' }}>{Math.round(progress)}%</p>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="card p-4 sm:p-6" style={{ borderLeft:'3px solid rgba(248,113,113,1)' }}>
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle size={18} className="text-red-400 flex-shrink-0 mt-0.5"/>
              <div>
                <h2 className="font-bold text-sm sm:text-base" style={{ color:'rgba(255,255,255,.88)' }}>Análisis de Rendimiento — IA</h2>
                <p className="text-xs sm:text-sm mt-0.5" style={{ color:'rgba(255,255,255,.40)' }}>El sistema detectó áreas de atención que necesitan mejora inmediata.</p>
              </div>
            </div>
            {insight && (
              <div className="rounded-xl p-3 sm:p-4" style={{ background:'rgba(239,68,68,.10)', border:'1px solid rgba(239,68,68,.22)' }}>
                <p className="text-xs sm:text-sm text-red-300 leading-relaxed"><strong>Patrón detectado: </strong>{insight.patron}</p>
              </div>
            )}
          </div>

          {insight && (
            <>
              <div className="card p-4 sm:p-5">
                <h3 className="section-title mb-4">Áreas con Mayor Deficiencia</h3>
                <div className="space-y-4">
                  {insight.deficiencias.map(d=>(
                    <div key={d.materia}>
                      <div className="flex justify-between mb-1">
                        <span className="text-xs sm:text-sm font-semibold" style={{ color:'rgba(255,255,255,.78)' }}>{d.materia}</span>
                        <span className="text-xs sm:text-sm font-bold text-red-400">{d.nivel}%</span>
                      </div>
                      <div className="h-2.5 rounded-full overflow-hidden" style={{ background:'rgba(255,255,255,.10)' }}>
                        <div className="h-full rounded-full bg-red-400" style={{ width:`${d.nivel}%` }}/>
                      </div>
                      <p className="text-[11px] mt-1" style={{ color:'rgba(255,255,255,.38)' }}>{d.problema}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card p-4 sm:p-5">
                <h3 className="section-title mb-4 flex items-center gap-2">
                  <Zap size={15} className="text-amber-400"/> Plan de Acción Recomendado
                </h3>
                <div className="space-y-2">
                  {insight.recomendaciones.map((r,i)=>(
                    <div key={i} className="flex items-start gap-3 rounded-xl px-3 sm:px-4 py-3"
                      style={{ background:'rgba(245,158,11,.10)', border:'1px solid rgba(245,158,11,.22)' }}>
                      <div className="w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center text-black text-xs font-bold flex-shrink-0">{i+1}</div>
                      <p className="text-xs sm:text-sm text-amber-300">{r}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Situación actual — 1 col mobile, 3 cols sm+ */}
          <div className="card p-4 sm:p-5">
            <h3 className="section-title mb-4">Tu Situación Actual</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { label:'Promedio',   value:s.avgGrade,          target:7.0,                         color:s.avgGrade>=7?'#34d399':'#f87171' },
                { label:'Asistencia', value:s.attendanceRate,    target:80,                           color:s.attendanceRate>=80?'#34d399':'#f87171', suffix:'%' },
                { label:'Tareas',     value:s.assignmentsDone,   target:s.assignmentsTotal,           color:s.assignmentsDone>=s.assignmentsTotal*0.8?'#34d399':'#f87171' },
              ].map(({ label, value, target, color, suffix }) => (
                <div key={label} className="text-center rounded-xl p-4"
                  style={{ background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.08)' }}>
                  <p className="text-xl sm:text-2xl font-bold" style={{ color }}>{value}{suffix||''}</p>
                  <p className="text-xs mt-1" style={{ color:'rgba(255,255,255,.45)' }}>{label}</p>
                  <p className="text-[10px] mt-0.5" style={{ color:'rgba(255,255,255,.28)' }}>Meta: {target}{suffix||''}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <p className="text-xs text-center" style={{ color:'rgba(255,255,255,.28)' }}>
        Este reporte es generado por el sistema de IA de SIGA CEFIMAT y tiene fines de orientación académica.
        Para información adicional, contacta a tu docente.
      </p>
    </div>
  )
}
