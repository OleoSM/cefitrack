import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, ResponsiveContainer,
} from 'recharts'
import {
  BookOpen, CalendarCheck, BrainCircuit, ArrowRight, Target, Zap, Trophy, Info,
} from 'lucide-react'
import { getLastSimulacro, getTargetSchool, getSimulacrosByStudent, attendanceColors } from '../../data/mockData'
import { logoInstitucion, tipoDesdeNombre, estiloLogo } from '../../lib/instituciones'
import { useStudentData } from '../../hooks/useStudentData'
import { promedioPonderado, rankingGrupo, statsAsistencia, esExamen, esTarea, evolucionPorMateria } from '../../lib/studentMetrics'
import { fetchGroupMetrics } from '../../lib/supabaseData'
import { useStudentTheme, esColorClaro } from '../../context/StudentThemeContext'
import Dropdown from '../../components/ui/Dropdown'

const PIE_COLORS = ['#10b981', '#f59e0b', '#ef4444', '#3b82f6']
const MATERIA_COLORS = ['#60a5fa', '#34d399', '#f59e0b', '#a78bfa', '#f472b6', '#22d3ee']

/* Popup de desglose al hacer hover/tap (fondo oscuro siempre, exento del tema claro via .kw) */
function HoverInfo({ trigger, children }) {
  const [open, setOpen] = useState(false)
  const [shift, setShift] = useState(0)
  const popRef = useRef(null)

  /* Reposiciona el popup si se sale del viewport (tarjetas pegadas a los bordes) */
  useLayoutEffect(() => {
    if (!open) { setShift(0); return }
    const el = popRef.current
    if (!el) return
    const pad = 12
    const r = el.getBoundingClientRect()
    let dx = 0
    if (r.right > window.innerWidth - pad) dx = window.innerWidth - pad - r.right
    if (r.left + dx < pad) dx = pad - r.left
    setShift(dx)
  }, [open])

  return (
    <div className="relative cursor-help"
      onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}
      onClick={() => setOpen(o => !o)}>
      {trigger}
      {open && (
        <div ref={popRef} className="absolute z-40 top-full mt-2 left-1/2 w-64 max-w-[calc(100vw-24px)]"
          style={{ transform: `translateX(calc(-50% + ${shift}px))` }}>
          <div className="kw rounded-xl p-3.5 text-left animate-fade-in"
            style={{ background: '#0f1020', border: '1px solid rgba(255,255,255,.14)', boxShadow: '0 18px 48px rgba(0,0,0,.55)' }}>
            {children}
          </div>
        </div>
      )}
    </div>
  )
}

export default function StudentDashboard() {
  const navigate = useNavigate()
  const { t, card } = useStudentTheme()
  const tarjetaClara = esColorClaro(card.grad)
  const tintaTarjeta = tarjetaClara ? '#0f172a' : '#ffffff'

  const { student: s, group: grp, attendance, evaluations } = useStudentData({
    withAttendance: true, withEvaluations: true,
  })

  const [ultimasFilter, setUltimasFilter] = useState('todas')
  const [hiddenMaterias, setHiddenMaterias] = useState([])
  const [groupMetrics, setGroupMetrics] = useState(null)

  // Datos del grupo completo: necesarios para calcular el lugar del alumno.
  useEffect(() => {
    if (!s?.groupId) return
    let alive = true
    fetchGroupMetrics(s.groupId)
      .then(m => { if (alive) setGroupMetrics(m) })
      .catch(() => {})
    return () => { alive = false }
  }, [s?.groupId])

  /* ── Pipeline oficial: promedio ponderado + lugar en el grupo ──
     (los simulacros siguen en mockData; calificaciones y asistencia son de BD) */
  const pipeline = useMemo(() => {
    if (!s) return null
    const pond    = promedioPonderado(s, { evals: evaluations, attendance })
    const ranking = groupMetrics
      ? rankingGrupo(groupMetrics.members, groupMetrics.evalsByStudent, groupMetrics.attendanceByStudent, pond.pesos)
      : []
    const myPos   = ranking.findIndex(x => x.id === s.id) + 1
    const asis    = statsAsistencia(attendance)
    const evo     = evolucionPorMateria(evaluations)
    return { pond, ranking, myPos, asis, evs: evaluations, evo }
  }, [s, attendance, evaluations, groupMetrics])

  if (!s || !pipeline) return null

  const { pond, ranking, myPos, asis, evs, evo } = pipeline
  const lastSim = getLastSimulacro(s.id)
  const targetSchool = getTargetSchool(s.id)
  const allSims = getSimulacrosByStudent(s.id)

  // Solo categorías con valor > 0: con todo en cero Recharts genera arcos NaN
  // (SVG corrupto, se ve como pantalla rota, especialmente en móvil).
  const attPieAll = Object.entries(asis.counts).map(([k, v]) => ({ name: attendanceColors[k].label, value: v }))
  const attPie = attPieAll.filter(d => d.value > 0)
  const hasAttendance = attPie.length > 0

  /* ── Últimas evaluaciones/exámenes/tareas ── */
  const ultimasOptions = [
    { value: 'todas',    label: 'Últimas evaluaciones' },
    { value: 'examenes', label: 'Últimos exámenes' },
    { value: 'tareas',   label: 'Últimas tareas' },
  ]
  const ultimas = [...evs]
    .filter(e => ultimasFilter === 'examenes' ? esExamen(e.tipo) : ultimasFilter === 'tareas' ? esTarea(e.tipo) : true)
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
    .slice(0, 5)

  const toggleMateria = m =>
    setHiddenMaterias(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m])

  const gradeColor = g => g >= 8.5 ? '#34d399' : g >= 7 ? '#60a5fa' : '#f59e0b'

  const { desglose, pesos } = pond

  return (
    <div className="space-y-5">

      {/* ══ Tarjeta de bienvenida (color personalizable en Configuración) ══ */}
      {/* La tinta se decide por la luminancia del color elegido: con los
          claros y con la rueda libre, el blanco de siempre sería ilegible. */}
      <div className="kw rounded-2xl p-5 sm:p-6"
        style={{
          background: card.grad,
          color: tintaTarjeta,
          border: `1px solid ${tarjetaClara ? 'rgba(15,23,42,.14)' : 'rgba(255,255,255,.10)'}`,
        }}>
        <div className="flex flex-wrap items-center gap-4">
          {s.avatarSrc ? (
            <img src={s.avatarSrc} alt=""
              className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl object-cover flex-shrink-0"
              style={{ background: tarjetaClara ? 'rgba(15,23,42,.08)' : 'rgba(255,255,255,.10)' }}/>
          ) : (
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center text-lg sm:text-xl font-bold flex-shrink-0"
              style={{ background: tarjetaClara ? 'rgba(15,23,42,.10)' : 'rgba(255,255,255,.10)' }}>
              {s.name.split(' ').slice(0, 2).map(n => n[0]).join('')}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm " style={{ opacity:.45 }}>Bienvenido de vuelta</p>
            <h1 className="text-lg sm:text-xl font-bold truncate">{s.name}</h1>
            <p className="text-xs sm:text-sm mt-0.5  truncate" style={{ opacity:.40 }}>{grp?.name} — {grp?.subject}</p>
          </div>

          <div className="flex gap-3 w-full sm:w-auto sm:ml-auto">
            {/* Promedio ponderado + tooltip de desglose */}
            <HoverInfo trigger={
              <div className="flex-1 sm:flex-none text-center px-4 py-2 rounded-xl min-w-[96px]" style={{ background: tarjetaClara ? 'rgba(15,23,42,.08)' : 'rgba(255,255,255,.10)' }}>
                <p className="text-2xl font-bold tabular-nums flex items-center justify-center gap-1">
                  {pond.promedio ?? '—'}
                  <Info size={11} className="" style={{ opacity:.40 }}/>
                </p>
                <p className="text-[11px] " style={{ opacity:.45 }}>Promedio</p>
              </div>
            }>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ opacity:.4 }}>
                ¿Cómo se calcula tu promedio?
              </p>
              {[
                { l: `Exámenes (${pesos.examenes}%)`,
                  v: desglose.examenes.valor === null ? 'Sin datos' : desglose.examenes.valor.toFixed(1) },
                { l: `Tareas (${pesos.tareas}%)`,
                  v: desglose.tareas.valor === null
                    ? 'Sin asignar'
                    : `${desglose.tareas.done}/${desglose.tareas.total} → ${desglose.tareas.valor.toFixed(1)}` },
                { l: `Asistencia (${pesos.asistencia}%)`,
                  v: desglose.asistencia.valor === null
                    ? 'Sin datos'
                    : `${desglose.asistencia.pct}% → ${desglose.asistencia.valor.toFixed(1)}` },
              ].map(row => (
                <div key={row.l} className="flex items-center justify-between py-1 text-xs">
                  <span style={{ opacity:.55 }}>{row.l}</span>
                  <span className="font-bold tabular-nums" style={{ opacity:.85 }}>{row.v}</span>
                </div>
              ))}
              <div className="flex items-center justify-between pt-2 mt-1 text-xs"
                style={{ borderTop: `1px solid ${tarjetaClara ? 'rgba(15,23,42,.14)' : 'rgba(255,255,255,.10)'}` }}>
                <span className="font-bold" style={{ opacity:.7 }}>Promedio ponderado</span>
                <span className="font-bold text-sm" style={{ color: 'var(--good)' }}>{pond.promedio ?? '—'}</span>
              </div>
            </HoverInfo>

            {/* Lugar en grupo + tooltip */}
            <HoverInfo trigger={
              <div className="flex-1 sm:flex-none text-center px-4 py-2 rounded-xl min-w-[96px]" style={{ background: tarjetaClara ? 'rgba(15,23,42,.08)' : 'rgba(255,255,255,.10)' }}>
                <p className="text-2xl font-bold tabular-nums text-amber-300 flex items-center justify-center gap-1">
                  #{myPos}
                  <Info size={11} className="" style={{ opacity:.40 }}/>
                </p>
                <p className="text-[11px] " style={{ opacity:.45 }}>Lugar en grupo</p>
              </div>
            }>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ opacity:.4 }}>
                Lugar en el grupo
              </p>
              <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,.60)' }}>
                Es el orden del grupo según el <strong style={{ opacity:.85 }}>promedio ponderado</strong>{' '}
                (Exámenes {pesos.examenes}% · Tareas {pesos.tareas}% · Asistencia {pesos.asistencia}%).
              </p>
              <p className="text-xs mt-2 font-semibold" style={{ color: '#fbbf24' }}>
                Estás en el lugar #{myPos} de {ranking.length} alumnos.
              </p>
              {myPos > 1 && pond.promedio !== null && (
                <p className="text-[11px] mt-1.5" style={{ color: 'rgba(255,255,255,.45)' }}>
                  El lugar #{myPos - 1} tiene promedio {ranking[myPos - 2].promedio} — te faltan{' '}
                  {(ranking[myPos - 2].promedio - pond.promedio).toFixed(1)} puntos.
                </p>
              )}
            </HoverInfo>
          </div>
        </div>
      </div>

      {/* ══ KPI cards ══ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          { icon: Zap,           label: 'Último Simulacro',  value: lastSim ? `${lastSim.aciertos}/${lastSim.total}` : '—',
            sub: lastSim?.folio, color: 'bg-emerald-600',
            go: () => document.getElementById('prediccion')?.scrollIntoView({ behavior: 'smooth' }) },
          { icon: CalendarCheck, label: 'Asistencia',
            value: asis.pct === null ? '—' : `${asis.pct}%`,
            sub: asis.pct === null ? 'Sin listas aún' : `${asis.counts.presente} presentes`,
            color: 'bg-blue-600', go: () => navigate('/student/asistencias') },
          { icon: BookOpen,      label: 'Tareas Entregadas',
            value: s.assignmentsTotal > 0 ? `${s.assignmentsDone ?? 0}/${s.assignmentsTotal}` : '—',
            sub: s.assignmentsTotal > 0
              ? `${Math.round(s.assignmentsDone / s.assignmentsTotal * 100)}% completado`
              : 'Sin tareas asignadas',
            color: 'bg-amber-500', go: () => navigate('/student/calificaciones') },
          { icon: BrainCircuit,  label: 'Reporte IA',        value: 'Ver',
            sub: 'Análisis personalizado', color: 'bg-purple-600', go: () => navigate('/student/reporte-ia') },
        ].map(({ icon: Icon, label, value, sub, color, go }) => (
          <button key={label} onClick={go}
            className="stat-card text-left transition-all group w-full flex flex-col">
            <div className="flex items-start justify-between w-full">
              <div className={`w-9 h-9 rounded-xl ${color} flex items-center justify-center mb-3`}>
                <Icon size={18} className="text-white"/>
              </div>
              {sub && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: t.softBg, color: t.t3, border: `1px solid ${t.cardBorder}` }}>
                  {sub}
                </span>
              )}
            </div>
            <p className="text-xl sm:text-2xl font-bold tabular-nums" style={{ color: t.t1 }}>{value}</p>
            <p className="text-xs mt-0.5" style={{ color: t.t3 }}>{label}</p>
            <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold transition-colors"
              style={{ color: t.light ? t.accent : 'rgba(255,255,255,.45)' }}>
              Ver más <ArrowRight size={11} className="transition-transform group-hover:translate-x-0.5"/>
            </span>
          </button>
        ))}
      </div>

      {/* ══ Predicción de escuela ══ */}
      {(lastSim || targetSchool) && (() => {
        const score   = lastSim?.aciertos ?? null
        const cutoff  = targetSchool?.corte ?? null
        const gap     = score !== null && cutoff !== null ? cutoff - score : null
        const reached = gap !== null && gap <= 0
        const pct     = score !== null && cutoff !== null ? Math.min(100, Math.round((score / cutoff) * 100)) : null
        const barColor = reached ? '#34d399' : pct >= 80 ? '#fbbf24' : '#60a5fa'
        return (
          <div id="prediccion" className="card p-5 relative overflow-hidden">
            <div className="relative flex flex-col sm:flex-row sm:items-center gap-4">
              {(() => {
                const logo = logoInstitucion(targetSchool?.tipo ?? tipoDesdeNombre(targetSchool?.nombre))
                return logo ? (
                  <div className="w-12 h-12 flex items-center justify-center flex-shrink-0">
                    {/* Sobre la tarjeta clara el escudo va con sus colores; en
                        el tema oscuro se pinta en blanco o se perdería. */}
                    <img src={logo.src} alt={logo.alt} style={estiloLogo(!t.light)}
                      className="max-w-full max-h-full object-contain"/>
                  </div>
                ) : (
                  <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
                    style={{ background: reached ? 'var(--good-soft)' : 'var(--info-soft)',
                             border: `1px solid ${reached ? 'var(--good-line)' : 'var(--info-line)'}` }}>
                    {reached ? <Trophy size={20} style={{ color:'var(--good)' }}/> : <Target size={20} style={{ color:'var(--info)' }}/>}
                  </div>
                )
              })()}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-xs font-bold uppercase tracking-wider" style={{ color: t.t3 }}>
                    Último Simulacro vs Objetivo
                  </p>
                  {allSims.length > 0 && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                      style={{ background: t.softBg, color: t.t3 }}>
                      {allSims.length} simulacro{allSims.length > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                {reached ? (
                  <p className="text-sm font-semibold mt-1" style={{ color:'var(--good)' }}>
                    ¡Alcanzaste el puntaje de corte de {targetSchool?.nombre}!
                  </p>
                ) : gap !== null ? (
                  <p className="text-sm font-semibold mt-1" style={{ color: t.t2 }}>
                    Te faltan <span style={{ color: t.light ? t.warn : '#fbbf24', fontWeight: 800 }}>{gap} aciertos</span> para{' '}
                    <span style={{ color: t.t1 }}>{targetSchool?.nombre}</span>
                  </p>
                ) : (
                  <p className="text-sm mt-1" style={{ color: t.t3 }}>Aún no hay simulacros registrados</p>
                )}
                {pct !== null && (
                  <div className="mt-3">
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: t.softBg }}>
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: barColor }}/>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[10px]" style={{ color: t.t4 }}>0 aciertos</span>
                      <span className="text-[10px]" style={{ color: t.t4 }}>Corte: {cutoff}</span>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3 sm:gap-4 flex-shrink-0">
                {score !== null && (
                  <div className="text-center">
                    <p className="text-3xl sm:text-4xl font-black tabular-nums" style={{ color: barColor, lineHeight: 1 }}>{score}</p>
                    <p className="text-[10px] mt-1 font-medium" style={{ color: t.t4 }}>tu puntaje</p>
                  </div>
                )}
                {score !== null && cutoff !== null && <div className="text-xl font-bold" style={{ color: t.t4 }}>/</div>}
                {cutoff !== null && (
                  <div className="text-center">
                    <p className="text-3xl sm:text-4xl font-black tabular-nums" style={{ color: t.t4, lineHeight: 1 }}>{cutoff}</p>
                    <p className="text-[10px] mt-1 font-medium" style={{ color: t.t4 }}>objetivo</p>
                  </div>
                )}
              </div>
            </div>
            {lastSim && (
              <p className="relative text-[11px] mt-3 pt-3" style={{ borderTop: `1px solid ${t.divider}`, color: t.t4 }}>
                <Zap size={10} className="inline mr-1 -mt-0.5" style={{ color: barColor }}/>
                {lastSim.folio ? `${lastSim.folio} · ` : ''}Simulacro del{' '}
                {new Date(lastSim.fecha + 'T12:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}
                {' · '}{lastSim.aciertos}/{lastSim.total} aciertos
              </p>
            )}
          </div>
        )
      })()}

      {/* ══ Evolución + Asistencia ══ */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Gráfica de líneas por materia (conectada a evaluaciones) */}
        <div className="card p-4 sm:p-5 xl:col-span-2">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-1.5">
            <h2 className="section-title">Evolución de mis Calificaciones</h2>
            <button onClick={() => navigate('/student/calificaciones')}
              className="text-xs font-bold hover:underline flex items-center gap-1"
              style={{ color: t.light ? t.accent : 'rgba(255,255,255,.45)' }}>
              Ver más <ArrowRight size={12}/>
            </button>
          </div>
          <p className="text-[11px] mb-3" style={{ color: t.t4 }}>
            Materias ponderadas en tu promedio — registradas por tu docente.
          </p>

          {/* Checkboxes para mostrar/ocultar materias */}
          <div className="flex flex-wrap gap-2 mb-4">
            {evo.materias.map((m, i) => {
              const hidden = hiddenMaterias.includes(m)
              const color = MATERIA_COLORS[i % MATERIA_COLORS.length]
              return (
                <button key={m} onClick={() => toggleMateria(m)}
                  className="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg transition-all active:scale-95"
                  style={{
                    /* Activo: color pleno con texto blanco. El 8 % de alfa
                       anterior no se distinguía del fondo y no se sabía qué
                       materia estaba encendida. */
                    background: hidden ? 'transparent' : color,
                    border: `1px solid ${hidden ? t.cardBorder : color}`,
                    color: hidden ? t.t4 : '#ffffff',
                    textDecoration: hidden ? 'line-through' : 'none',
                  }}>
                  <span className="w-3 h-3 rounded flex items-center justify-center flex-shrink-0"
                    style={{ background: hidden ? 'transparent' : color, border: `1.5px solid ${color}` }}>
                    {!hidden && (
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    )}
                  </span>
                  {m}
                </button>
              )
            })}
          </div>

          {evo.data.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={evo.data} margin={{ top: 5, right: 8, bottom: 0, left: -22 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={t.grid}/>
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: t.axis }} axisLine={false} tickLine={false}/>
                <YAxis domain={[4, 10]} tick={{ fontSize: 11, fill: t.axis }} axisLine={false} tickLine={false}/>
                <Tooltip wrapperStyle={{ outline: 'none' }}
                  cursor={{ stroke: t.grid, strokeWidth: 1 }}
                  contentStyle={{ fontSize: 11, borderRadius: 10, background: t.tooltipBg, border: `1px solid ${t.tooltipBorder}`, color: t.tooltipText }}/>
                {evo.materias.filter(m => !hiddenMaterias.includes(m)).map(m => {
                  const i = evo.materias.indexOf(m)
                  const color = MATERIA_COLORS[i % MATERIA_COLORS.length]
                  return (
                    <Line key={m} type="monotone" dataKey={m} name={m}
                      stroke={color} strokeWidth={2.5}
                      dot={{ r: 3, fill: color, strokeWidth: 0 }}
                      activeDot={{ r: 5 }}
                      connectNulls />
                  )
                })}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-sm" style={{ color: t.t4 }}>Sin datos</div>
          )}
        </div>

        {/* Asistencia pie */}
        <div className="card p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="section-title">Mi Asistencia</h2>
            <button onClick={() => navigate('/student/asistencias')}
              className="text-xs font-bold hover:underline flex items-center gap-1"
              style={{ color: t.light ? t.accent : 'rgba(255,255,255,.45)' }}>
              Ver más <ArrowRight size={12}/>
            </button>
          </div>
          <div className="flex items-center justify-center">
            <div className="relative">
              {hasAttendance ? (
                <ResponsiveContainer width={150} height={150}>
                  <PieChart>
                    <Pie data={attPie} cx="50%" cy="50%" innerRadius={45} outerRadius={68} dataKey="value" stroke="none">
                      {attPie.map((d, i) => (
                        <Cell key={d.name} fill={PIE_COLORS[attPieAll.findIndex(x => x.name === d.name)]}/>
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="w-[150px] h-[150px] flex items-center justify-center">
                  <div className="w-[136px] h-[136px] rounded-full"
                    style={{ border: `12px solid ${t.softBg}` }}/>
                </div>
              )}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold tabular-nums" style={{ color: hasAttendance ? gradeColor(asis.pct / 10) : t.t4 }}>
                  {hasAttendance ? `${asis.pct}%` : '—'}
                </span>
                <span className="text-[10px]" style={{ color: t.t3 }}>{hasAttendance ? 'asistencia' : 'sin registros'}</span>
              </div>
            </div>
          </div>
          <div className="space-y-1.5 mt-2">
            {attPieAll.map((d, i) => (
              <div key={d.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ background: PIE_COLORS[i] }}/>
                  <span style={{ color: t.t2 }}>{d.name}</span>
                </div>
                <span className="font-bold tabular-nums" style={{ color: t.t1 }}>{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ══ Últimas evaluaciones / exámenes / tareas (dropdown) ══ */}
      <div className="card overflow-hidden">
        <div className="px-4 sm:px-5 py-3 flex items-center justify-between gap-3 flex-wrap"
          style={{ borderBottom: `1px solid ${t.divider}`, background: t.softBg }}>
          <Dropdown value={ultimasFilter} onChange={setUltimasFilter} options={ultimasOptions}/>
          <button onClick={() => navigate('/student/calificaciones')}
            className="text-xs font-bold hover:underline flex items-center gap-1"
            style={{ color: t.light ? t.accent : 'rgba(255,255,255,.45)' }}>
            Ver más <ArrowRight size={12}/>
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px]">
            <thead style={{ borderBottom: `1px solid ${t.divider}`, background: t.softBg }}>
              <tr>
                <th className="table-header">Materia</th>
                <th className="table-header">Tipo</th>
                <th className="table-header">Calificación</th>
                <th className="table-header">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {ultimas.length === 0 && (
                <tr><td colSpan={4} className="table-cell text-center py-8" style={{ color: t.t4 }}>
                  Sin registros de este tipo.
                </td></tr>
              )}
              {ultimas.map(e => (
                <tr key={e.id} className="transition-colors" style={{ borderBottom: `1px solid ${t.divider}` }}>
                  <td className="table-cell font-medium" style={{ color: t.t1 }}>{e.materia}</td>
                  <td className="table-cell">
                    <span className="badge text-[11px]" style={{ background: t.softBg, color: t.t2, border: `1px solid ${t.cardBorder}` }}>{e.tipo}</span>
                  </td>
                  <td className="table-cell">
                    <span className="font-bold text-lg tabular-nums" style={{ color: gradeColor(e.calificacion) }}>{e.calificacion}</span>
                  </td>
                  <td className="table-cell text-xs" style={{ color: t.t3 }}>{e.fecha}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
