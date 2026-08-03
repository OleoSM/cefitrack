import { useNavigate } from 'react-router-dom'
import { BrainCircuit, AlertTriangle, CheckCircle, ArrowRight, Zap } from 'lucide-react'
import { aiInsights, getStudentById, students, statusConfig } from '../../data/mockData'
import { GlowCard } from '../../components/ui/GlowCard'

/* Mapa de riesgo → colores semánticos (texto siempre legible) */
const RISK = {
  crítico: {
    glowColor: 'red',
    accent:    'var(--bad)',
    badgeBg:   'var(--bad-soft)',
    badgeBdr:  'var(--bad-line)',
    badgeTxt:  'var(--bad)',
    barColor:  'var(--bad)',
    icon:      <AlertTriangle size={14} className="text-red-400" />,
  },
  alto: {
    glowColor: 'amber',
    accent:    'var(--warn)',
    badgeBg:   'var(--warn-soft)',
    badgeBdr:  'var(--warn-line)',
    badgeTxt:  'var(--warn)',
    barColor:  'var(--warn)',
    icon:      <AlertTriangle size={14} className="text-amber-400" />,
  },
  medio: {
    glowColor: 'blue',
    accent:    'var(--info)',
    badgeBg:   'var(--info-soft)',
    badgeBdr:  'var(--info-line)',
    badgeTxt:  'var(--info)',
    barColor:  'var(--info)',
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
    <div className="space-y-8">

      {/* ── Banner resumen ──────────────────────────────────── */}
      <GlowCard color="blue" className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-5">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background:'var(--soft-bg)', border:'1px solid var(--card-border)' }}>
          <BrainCircuit size={24} className="text-blue-300"/>
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-bold" style={{ color:'var(--t1)' }}>
            Análisis Inteligente de Rendimiento
          </h2>
          <p className="text-sm mt-0.5" style={{ color:'var(--t2)' }}>
            Se analizaron <span style={{ color:'var(--t1)', fontWeight:600 }}>{students.length} alumnos</span> y se detectaron patrones de riesgo académico.
          </p>
        </div>
        <div className="grid grid-cols-3 sm:flex gap-2 sm:gap-3 w-full sm:w-auto">
          {[
            { val: atRisk.filter(a=>a.riesgo==='crítico').length, label:'Críticos',   color:'var(--bad)' },
            { val: atRisk.filter(a=>a.riesgo==='alto').length,    label:'Riesgo alto', color:'var(--warn)' },
            { val: excellent.length,                               label:'Excelentes', color:'var(--good)' },
          ].map(({ val, label, color }) => (
            <div key={label} className="text-center px-3 py-2 rounded-xl"
              style={{ background:'var(--soft-bg)', border:'1px solid var(--card-border)' }}>
              <p className="text-xl font-bold" style={{ color }}>{val}</p>
              <p className="text-[10px] font-medium mt-0.5" style={{ color:'var(--t3)' }}>{label}</p>
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
                      <h3 className="font-bold text-sm" style={{ color:'var(--t1)' }}>
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
                            <span className="text-xs font-semibold" style={{ color:'var(--t1)' }}>
                              {d.materia}
                            </span>
                            <span className="text-xs font-bold" style={{ color: rc.accent }}>
                              {d.nivel}%
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full overflow-hidden" style={{ background:'var(--soft-bg)' }}>
                            <div className="h-full rounded-full transition-all"
                              style={{ width:`${d.nivel}%`, background: rc.barColor }} />
                          </div>
                          <p className="text-[11px] mt-0.5" style={{ color:'var(--t3)' }}>
                            {d.problema}
                          </p>
                        </div>
                      ))}
                    </div>

                    {/* Patrón */}
                    <div className="mt-3 rounded-xl px-3 py-2.5"
                      style={{ background:'var(--soft-bg)', border:'1px solid var(--card-border)' }}>
                      <p className="text-[10px] font-bold uppercase tracking-widest mb-1 flex items-center gap-1.5"
                        style={{ color:'var(--t3)' }}>
                        <Zap size={10}/> Patrón detectado
                      </p>
                      <p className="text-xs leading-relaxed" style={{ color:'var(--t2)' }}>
                        {insight.patron}
                      </p>
                    </div>

                    {/* Recomendaciones */}
                    <div className="mt-3">
                      <p className="text-[10px] font-bold uppercase tracking-widest mb-2"
                        style={{ color:'var(--t3)' }}>
                        Recomendaciones
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {insight.recomendaciones.map((r, i) => (
                          <span key={i} className="text-[11px] font-medium px-2.5 py-1 rounded-full"
                            style={{ background:'var(--soft-bg)', border:'1px solid var(--card-border)', color:'var(--t2)' }}>
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
                  style={{ background:'var(--good-soft)', color:'var(--good)', border:'1px solid var(--good-line)' }}>
                  {s.name.split(' ').slice(0,2).map(n=>n[0]).join('')}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate" style={{ color:'var(--t1)' }}>{s.name}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-base font-bold text-emerald-400">{s.avgGrade}</span>
                    <span className="text-[11px]" style={{ color:'var(--t3)' }}>· {s.attendanceRate}% asist.</span>
                  </div>
                </div>
                <ArrowRight size={14} style={{ color:'var(--t4)' }}/>
              </div>
            </GlowCard>
          ))}
        </div>
      </section>

      {/* ── Recomendaciones generales ───────────────────────── */}
      <section>
        <h2 className="section-title flex items-center gap-2 mb-4">
          <BrainCircuit size={15} style={{ color:'var(--t2)' }}/> Recomendaciones del Ciclo
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {RECS.map(r => (
            <GlowCard key={r.title} color={r.color}>
              <p className="text-sm font-bold mb-1.5" style={{ color:'var(--t1)' }}>{r.title}</p>
              <p className="text-xs leading-relaxed" style={{ color:'var(--t2)' }}>{r.desc}</p>
            </GlowCard>
          ))}
        </div>
      </section>

    </div>
  )
}
