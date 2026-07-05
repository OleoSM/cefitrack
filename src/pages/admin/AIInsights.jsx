import { useNavigate } from 'react-router-dom'
import { BrainCircuit, AlertTriangle, CheckCircle, ArrowRight, Zap } from 'lucide-react'
import { aiInsights, getStudentById, students, statusConfig } from '../../data/mockData'
import { GlowCard } from '../../components/ui/GlowCard'

/* Mapa de riesgo → colores semánticos (texto siempre legible) */
const RISK = {
  crítico: {
    glowColor: 'red',
    accent:    '#f87171',
    badgeBg:   'rgba(239,68,68,.15)',
    badgeBdr:  'rgba(239,68,68,.30)',
    badgeTxt:  '#f87171',
    barColor:  '#f87171',
    icon:      <AlertTriangle size={14} className="text-red-400" />,
  },
  alto: {
    glowColor: 'amber',
    accent:    '#fbbf24',
    badgeBg:   'rgba(245,158,11,.15)',
    badgeBdr:  'rgba(245,158,11,.30)',
    badgeTxt:  '#fbbf24',
    barColor:  '#fbbf24',
    icon:      <AlertTriangle size={14} className="text-amber-400" />,
  },
  medio: {
    glowColor: 'blue',
    accent:    '#60a5fa',
    badgeBg:   'rgba(59,130,246,.15)',
    badgeBdr:  'rgba(59,130,246,.30)',
    badgeTxt:  '#60a5fa',
    barColor:  '#60a5fa',
    icon:      <AlertTriangle size={14} className="text-blue-400" />,
  },
}

const RECS = [
  { title:'Refuerzo de Geometría',   desc:'3 alumnos muestran deficiencias persistentes. Considerar taller adicional los viernes.',   color:'amber'   },
  { title:'Mejorar Asistencia',       desc:'La asistencia baja los lunes correlaciona con calificaciones más bajas en exámenes.',        color:'red'     },
  { title:'Tutoría entre Pares',      desc:'Emparejar alumnos de excelente desempeño con alumnos en riesgo puede elevar al grupo.',      color:'emerald' },
  { title:'Revisión de Evaluaciones', desc:'El "Examen Final" tiene el mayor índice de reprobación. Revisar método de preparación.',    color:'blue'    },
]

const excellent   = students.filter(s => s.status === 'excellent')

export default function AIInsights() {
  const navigate = useNavigate()
  const atRisk   = aiInsights

  return (
    <div className="max-w-5xl space-y-8">

      {/* ── Banner resumen ──────────────────────────────────── */}
      <GlowCard color="blue" className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-5">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background:'rgba(255,255,255,.08)', border:'1px solid rgba(255,255,255,.12)' }}>
          <BrainCircuit size={24} className="text-blue-300"/>
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-bold" style={{ color:'rgba(255,255,255,.90)' }}>
            Análisis Inteligente de Rendimiento
          </h2>
          <p className="text-sm mt-0.5" style={{ color:'rgba(255,255,255,.50)' }}>
            Se analizaron <span style={{ color:'rgba(255,255,255,.85)', fontWeight:600 }}>{students.length} alumnos</span> y se detectaron patrones de riesgo académico.
          </p>
        </div>
        <div className="grid grid-cols-3 sm:flex gap-2 sm:gap-3 w-full sm:w-auto">
          {[
            { val: atRisk.filter(a=>a.riesgo==='crítico').length, label:'Críticos',   color:'#f87171' },
            { val: atRisk.filter(a=>a.riesgo==='alto').length,    label:'Riesgo alto', color:'#fbbf24' },
            { val: excellent.length,                               label:'Excelentes', color:'#34d399' },
          ].map(({ val, label, color }) => (
            <div key={label} className="text-center px-3 py-2 rounded-xl"
              style={{ background:'rgba(255,255,255,.07)', border:'1px solid rgba(255,255,255,.08)' }}>
              <p className="text-xl font-bold" style={{ color }}>{val}</p>
              <p className="text-[10px] font-medium mt-0.5" style={{ color:'rgba(255,255,255,.40)' }}>{label}</p>
            </div>
          ))}
        </div>
      </GlowCard>

      {/* ── Alumnos con alertas ─────────────────────────────── */}
      <section>
        <h2 className="section-title flex items-center gap-2 mb-4">
          <AlertTriangle size={15} className="text-red-400"/> Alumnos con Alertas
        </h2>
        <div className="space-y-4">
          {atRisk.map(insight => {
            const s  = getStudentById(insight.studentId)
            const rc = RISK[insight.riesgo] ?? RISK.medio

            return (
              <GlowCard key={insight.studentId} color={rc.glowColor}>
                <div className="flex items-start gap-4">

                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0"
                    style={{ background:`${rc.accent}20`, color: rc.accent, border:`1px solid ${rc.accent}40` }}>
                    {s?.name.split(' ').slice(0,2).map(n=>n[0]).join('')}
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Nombre + badge */}
                    <div className="flex items-center gap-2 flex-wrap mb-3">
                      <h3 className="font-bold text-sm" style={{ color:'rgba(255,255,255,.90)' }}>
                        {s?.name}
                      </h3>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase"
                        style={{ background: rc.badgeBg, color: rc.badgeTxt, border:`1px solid ${rc.badgeBdr}` }}>
                        {rc.icon} {insight.riesgo}
                      </span>
                    </div>

                    {/* Deficiencias */}
                    <div className="space-y-2.5">
                      {insight.deficiencias.map(d => (
                        <div key={d.materia}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-semibold" style={{ color:'rgba(255,255,255,.75)' }}>
                              {d.materia}
                            </span>
                            <span className="text-xs font-bold" style={{ color: rc.accent }}>
                              {d.nivel}%
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full overflow-hidden" style={{ background:'rgba(255,255,255,.10)' }}>
                            <div className="h-full rounded-full transition-all"
                              style={{ width:`${d.nivel}%`, background: rc.barColor }} />
                          </div>
                          <p className="text-[11px] mt-0.5" style={{ color:'rgba(255,255,255,.40)' }}>
                            {d.problema}
                          </p>
                        </div>
                      ))}
                    </div>

                    {/* Patrón */}
                    <div className="mt-3 rounded-xl px-3 py-2.5"
                      style={{ background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.07)' }}>
                      <p className="text-[10px] font-bold uppercase tracking-widest mb-1 flex items-center gap-1.5"
                        style={{ color:'rgba(255,255,255,.35)' }}>
                        <Zap size={10}/> Patrón detectado
                      </p>
                      <p className="text-xs leading-relaxed" style={{ color:'rgba(255,255,255,.65)' }}>
                        {insight.patron}
                      </p>
                    </div>

                    {/* Recomendaciones */}
                    <div className="mt-3">
                      <p className="text-[10px] font-bold uppercase tracking-widest mb-2"
                        style={{ color:'rgba(255,255,255,.30)' }}>
                        Recomendaciones
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {insight.recomendaciones.map((r, i) => (
                          <span key={i} className="text-[11px] font-medium px-2.5 py-1 rounded-full"
                            style={{ background:'rgba(255,255,255,.07)', border:'1px solid rgba(255,255,255,.10)', color:'rgba(255,255,255,.65)' }}>
                            {r}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Acción */}
                  <button onClick={() => navigate(`/admin/alumnos/${s.id}`)}
                    className="btn-secondary text-xs py-1.5 flex-shrink-0">
                    Ver perfil <ArrowRight size={12}/>
                  </button>
                </div>
              </GlowCard>
            )
          })}
        </div>
      </section>

      {/* ── Alumnos destacados ──────────────────────────────── */}
      <section>
        <h2 className="section-title flex items-center gap-2 mb-4">
          <CheckCircle size={15} className="text-emerald-400"/> Alumnos Destacados
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {excellent.map(s => (
            <GlowCard key={s.id} color="emerald"
              className="cursor-pointer hover:-translate-y-0.5 transition-transform duration-200 group"
              onClick={() => navigate(`/admin/alumnos/${s.id}`)}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0"
                  style={{ background:'rgba(52,211,153,.15)', color:'#34d399', border:'1px solid rgba(52,211,153,.25)' }}>
                  {s.name.split(' ').slice(0,2).map(n=>n[0]).join('')}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate" style={{ color:'rgba(255,255,255,.88)' }}>{s.name}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-base font-bold text-emerald-400">{s.avgGrade}</span>
                    <span className="text-[11px]" style={{ color:'rgba(255,255,255,.32)' }}>· {s.attendanceRate}% asist.</span>
                  </div>
                </div>
                <ArrowRight size={14} style={{ color:'rgba(255,255,255,.20)' }}/>
              </div>
            </GlowCard>
          ))}
        </div>
      </section>

      {/* ── Recomendaciones generales ───────────────────────── */}
      <section>
        <h2 className="section-title flex items-center gap-2 mb-4">
          <BrainCircuit size={15} style={{ color:'rgba(255,255,255,.50)' }}/> Recomendaciones del Ciclo
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {RECS.map(r => (
            <GlowCard key={r.title} color={r.color}>
              <p className="text-sm font-bold mb-1.5" style={{ color:'rgba(255,255,255,.88)' }}>{r.title}</p>
              <p className="text-xs leading-relaxed" style={{ color:'rgba(255,255,255,.50)' }}>{r.desc}</p>
            </GlowCard>
          ))}
        </div>
      </section>

    </div>
  )
}
