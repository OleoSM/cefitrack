import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import {
  ArrowLeft, Mail, Phone, BookOpen, Calendar, TrendingUp,
  BrainCircuit, FileText, Download, CheckCircle, AlertTriangle, QrCode,
  GraduationCap, Pencil,
} from 'lucide-react'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, ResponsiveContainer, Legend,
} from 'recharts'
import {
  getReportsByStudent, getInsightByStudent, studentRadar, studentGradeTrend,
  getStatusConfig, attendanceColors, getAttendanceColor, getSimulacrosByStudent,
} from '../../data/mockData'
import {
  fetchStudentById, fetchGroupById, fetchEvaluationsByStudent, fetchStudentAttendance,
} from '../../lib/supabaseData'
import { exportStudentReport, exportMonthlyReport } from '../../lib/exportReports'
import { useGroupColors } from '../../hooks/useGroupColors'
import { useRef } from 'react'
import clsx from 'clsx'

/* ── Inline editable grade cell ─────────────────────────────── */
const EVAL_KEY = sid => `edutrack_eval_${sid}`

function EditableGrade({ evalId, value, onSave }) {
  const [editing, setEditing] = useState(false)
  const [draft,   setDraft]   = useState('')
  const ref = useRef(null)
  const col = value >= 8 ? 'var(--good)' : value >= 6 ? 'var(--info)' : 'var(--bad)'

  const start = () => { setDraft(String(value)); setEditing(true); setTimeout(() => ref.current?.select(), 20) }
  const commit = () => {
    setEditing(false)
    const n = parseFloat(draft)
    if (!isNaN(n) && n >= 0 && n <= 10) onSave(evalId, +n.toFixed(1))
  }
  if (editing) return (
    <input ref={ref} value={draft} onChange={e => setDraft(e.target.value)}
      onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
      className="font-bold text-lg w-16 text-center rounded-lg outline-none"
      style={{ background:'var(--soft-bg)', border:'1.5px solid var(--card-border)', color:'var(--t1)', padding:'2px 4px' }}
    />
  )
  return (
    <button onClick={start} title="Click para editar"
      className="flex items-center gap-1.5 group transition-opacity"
      style={{ color: col }}>
      <span className="font-bold text-lg">{value}</span>
      <Pencil size={10} className="opacity-0 group-hover:opacity-60 transition-opacity"/>
    </button>
  )
}

const TABS = [
  { id:'resumen',      label:'Resumen',      icon:TrendingUp  },
  { id:'evaluaciones', label:'Evaluaciones', icon:BookOpen    },
  { id:'asistencias',  label:'Asistencias',  icon:Calendar    },
  { id:'reportes',     label:'Reportes',     icon:FileText    },
  { id:'ia',           label:'Análisis IA',  icon:BrainCircuit },
  { id:'qr',           label:'Código QR',    icon:QrCode      },
]

const PIE_COLORS = ['var(--good)','var(--warn)','var(--bad)','var(--info)']

/* ── Shared primitives ─────────────────────────────────────────── */
const Sub  = ({ children, className='' }) => (
  <p className={`text-[10px] font-bold uppercase tracking-widest mb-1.5 ${className}`}
    style={{ color:'var(--t3)' }}>{children}</p>
)
const Val  = ({ children, className='' }) => (
  <p className={`text-sm font-semibold truncate ${className}`}
    style={{ color:'var(--t1)' }}>{children}</p>
)

export default function StudentProfile() {
  const { studentId } = useParams()
  const navigate = useNavigate()
  const { getAccent } = useGroupColors()
  const [tab, setTab] = useState('resumen')

  /* ── Grade overrides (editable by admin, read by student) ───── */
  const [evalOverrides, setEvalOverrides] = useState(() => {
    try { return JSON.parse(localStorage.getItem(EVAL_KEY(studentId)) || '{}') } catch { return {} }
  })
  const saveOverride = (evalId, newVal) => {
    const updated = { ...evalOverrides, [evalId]: newVal }
    setEvalOverrides(updated)
    localStorage.setItem(EVAL_KEY(studentId), JSON.stringify(updated))
  }

  /* Alumno, grupo, calificaciones y asistencia vienen de la BD.
     Antes se leían de mockData, cuyos ids s1–s20 chocaban con los reales:
     un alumno existente mostraba el perfil de otra persona, y los ids
     superiores a s20 daban "Alumno no encontrado". */
  const [s, setS]         = useState(null)
  const [grp, setGrp]     = useState(null)
  const [evals, setEvals] = useState([])
  const [att, setAtt]     = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let vivo = true
    setCargando(true)
    ;(async () => {
      try {
        const alumno = await fetchStudentById(studentId)
        if (!vivo) return
        setS(alumno)
        if (alumno) {
          const [g, ev, as] = await Promise.all([
            fetchGroupById(alumno.groupId),
            fetchEvaluationsByStudent(studentId),
            fetchStudentAttendance(studentId, alumno.groupId),
          ])
          if (!vivo) return
          setGrp(g); setEvals(ev); setAtt(as)
        }
      } catch { /* se muestra el estado vacío */ }
      finally { if (vivo) setCargando(false) }
    })()
    return () => { vivo = false }
  }, [studentId])

  // Simulacros e insights siguen siendo simulados; no hay tablas todavía.
  const rpts    = getReportsByStudent(studentId)
  const insight = getInsightByStudent(studentId)
  const radar   = studentRadar[studentId]
  const trend   = studentGradeTrend[studentId]

  if (cargando) return (
    <p className="text-sm p-6" style={{ color:'var(--t3)' }}>Cargando alumno…</p>
  )
  if (!s) return (
    <p className="text-sm p-6" style={{ color:'var(--t3)' }}>Alumno no encontrado.</p>
  )

  const cfg   = getStatusConfig(s.status)
  const accent = getAccent(s.groupId)

  const attCounts = {
    presente:    att.filter(a => a.status === 'presente').length,
    tardanza:    att.filter(a => a.status === 'tardanza').length,
    ausente:     att.filter(a => a.status === 'ausente').length,
    justificado: att.filter(a => a.status === 'justificado').length,
  }
  const attPie = Object.entries(attCounts).map(([k, v]) => ({
    name: attendanceColors[k].label, value: v,
  }))

  // Porcentaje real: presentes + tardanzas sobre las sesiones del grupo.
  const asistenciaPct = att.length
    ? Math.round(((attCounts.presente + attCounts.tardanza) / att.length) * 100)
    : null

  const gradeColor = g => g >= 8 ? 'var(--good)' : g >= 7 ? 'var(--info)' : 'var(--bad)'
  const attRateColor = r => r >= 85 ? 'var(--good)' : r >= 75 ? 'var(--warn)' : 'var(--bad)'

  /* Reporte de aprovechamiento hasta el momento — para el tutor */
  const handleExportReport = () => exportStudentReport({
    student: s,
    group: grp,
    evals: evals.map(e => ({ ...e, calificacion: evalOverrides[e.id] ?? e.calificacion })),
    attendance: att,
    sims: getSimulacrosByStudent(s.id),
  })

  return (
    <div className="space-y-4">

      {/* ── Back ──────────────────────────────────────────────────── */}
      <button onClick={() => navigate('/admin/alumnos')}
        className="flex items-center gap-1.5 text-sm font-medium transition-colors"
        style={{ color:'var(--t3)' }}
        onMouseEnter={e => e.currentTarget.style.color = 'var(--t1)'}
        onMouseLeave={e => e.currentTarget.style.color = 'var(--t3)'}>
        <ArrowLeft size={15}/> Regresar a Alumnos
      </button>

      {/* ── Profile header ────────────────────────────────────────── */}
      <div className="card p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row gap-5">

          {/* Avatar */}
          <div className="w-18 h-18 w-[72px] h-[72px] rounded-2xl flex items-center justify-center text-xl font-bold flex-shrink-0"
            /* Fondo pleno con inicial blanca. Antes era el acento al 16 % de
               alfa con un glow de color: sobre página blanca el bloque casi no
               existía y la inicial quedaba flotando. */
            style={{ background: accent, color:'#ffffff', boxShadow:'0 1px 3px rgba(15,23,42,.22)' }}>
            {s.name.split(' ').slice(0, 2).map(n => n[0]).join('')}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-3 flex-wrap">
              <div>
                <h1 className="text-xl font-bold tracking-tight" style={{ color:'var(--t1)' }}>
                  {s.name}
                </h1>
                <p className="text-sm mt-0.5" style={{ color:'var(--t2)' }}>
                  {grp?.name} — {grp?.subject}
                </p>
              </div>
              <span className={`badge ${cfg.bg} ${cfg.color} border ${cfg.border} mt-0.5`}>
                <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`}/>{cfg.label}
              </span>
            </div>
            <div className="flex flex-wrap gap-4 mt-3 text-sm" style={{ color:'var(--t3)' }}>
              <span className="flex items-center gap-1.5"><Mail size={13}/>{s.email}</span>
            </div>

            {/* Quick stats */}
            <div className="flex flex-wrap gap-3 mt-4 pt-4"
              style={{ borderTop:'1px solid var(--divider)' }}>
              {[
                { label:'Promedio',   value: s.avgGrade ?? '—',
                  color: s.avgGrade == null ? 'var(--t3)' : gradeColor(s.avgGrade) },
                // La asistencia se calcula de las sesiones reales ya cargadas;
                // students.attendance_rate quedó obsoleto y venía en null.
                { label:'Asistencia',
                  value: asistenciaPct === null ? '—' : `${asistenciaPct}%`,
                  color: asistenciaPct === null ? 'var(--t3)' : attRateColor(asistenciaPct) },
                { label:'Tareas',
                  value: s.assignmentsTotal ? `${s.assignmentsDone}/${s.assignmentsTotal}` : '—',
                  color: s.assignmentsTotal ? 'var(--info)' : 'var(--t3)' },
                { label:'Ranking',
                  value: s.rank ? `#${s.rank}` : '—',
                  color: s.rank ? 'var(--warn)' : 'var(--t3)' },
              ].map(({ label, value, color }) => (
                <div key={label} className="text-center px-4 py-2.5 rounded-xl"
                  style={{ background:'var(--soft-bg)', border:'1px solid var(--card-border)' }}>
                  <p className="text-lg font-bold leading-none" style={{ color }}>{value}</p>
                  <p className="text-[11px] mt-1" style={{ color:'var(--t3)' }}>{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Contact card */}
          <div className="rounded-xl p-4 flex-shrink-0 min-w-[200px]"
            style={{ background:'var(--card-bg)', border:'1px solid var(--card-border)' }}>
            <Sub>Contacto del tutor</Sub>
            {/* Los alumnos dados de alta sin tutor dejaban los iconos huérfanos:
                cada dato se muestra sólo si existe. */}
            <Val className="mb-2">{s.tutor?.name || 'Sin tutor registrado'}</Val>
            {s.tutor?.email && (
              <div className="flex items-center gap-1.5 text-xs" style={{ color:'var(--t3)' }}>
                <Mail size={11}/>{s.tutor.email}
              </div>
            )}
            {s.tutor?.phone && (
              <div className="flex items-center gap-1.5 mt-1.5 text-xs" style={{ color:'var(--t3)' }}>
                <Phone size={11}/>{s.tutor.phone}
              </div>
            )}
            <button onClick={handleExportReport}
              className="w-full flex items-center justify-center gap-1.5 mt-3 py-2 rounded-lg text-xs font-bold transition-all active:scale-95"
              style={{ background:'var(--good-soft)', border:'1px solid var(--good-line)', color:'var(--good)' }}
              onMouseEnter={e => e.currentTarget.style.background='var(--good-line)'}
              onMouseLeave={e => e.currentTarget.style.background='var(--good-soft)'}
              title="Descarga el aprovechamiento del alumno hasta el momento para compartirlo con el tutor">
              <Download size={12}/> Reporte de avance
            </button>
          </div>
        </div>
      </div>

      {/* ── Tabs ──────────────────────────────────────────────────── */}
      <div className="flex gap-1 rounded-xl p-1 w-fit overflow-x-auto"
        style={{ background:'var(--soft-bg)', border:'1px solid var(--card-border)' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap"
            style={tab === t.id
              ? { background:'white', color:'black', boxShadow:'0 2px 8px rgba(0,0,0,.35)' }
              : { color:'var(--t2)' }}
            onMouseEnter={e => { if (tab !== t.id) e.currentTarget.style.color='var(--t1)' }}
            onMouseLeave={e => { if (tab !== t.id) e.currentTarget.style.color='var(--t2)' }}>
            <t.icon size={14}/>{t.label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════
          TAB: RESUMEN
      ══════════════════════════════════════════════════════════ */}
      {tab === 'resumen' && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

          <div className="card p-5">
            <h3 className="section-title mb-4">Competencias</h3>
            {radar ? (
              <ResponsiveContainer width="100%" height={220}>
                <RadarChart data={radar}>
                  <PolarGrid stroke="var(--grid)"/>
                  <PolarAngleAxis dataKey="comp" tick={{ fontSize:10, fill:'var(--axis)' }}/>
                  <PolarRadiusAxis angle={90} domain={[0,10]} tick={{ fontSize:9, fill:'var(--axis)' }}/>
                  <Radar name="Alumno" dataKey="valor" stroke={accent} fill={accent} fillOpacity={0.12} strokeWidth={2}/>
                </RadarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-sm"
                style={{ color:'var(--t3)' }}>Sin datos de radar</div>
            )}
          </div>

          <div className="card p-5 xl:col-span-2">
            <h3 className="section-title mb-4">Evolución de Calificaciones</h3>
            {trend ? (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={trend} margin={{ top:5, right:10, bottom:0, left:-20 }}>
                  <defs>
                    {['var(--info)','var(--good)','var(--warn)'].map((c, i) => (
                      <linearGradient key={i} id={`g${i}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={c} stopOpacity={0.15}/>
                        <stop offset="95%" stopColor={c} stopOpacity={0}/>
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--grid)"/>
                  <XAxis dataKey="mes" tick={{ fontSize:11, fill:'var(--axis)' }} axisLine={false} tickLine={false}/>
                  <YAxis domain={[4,10]} tick={{ fontSize:11, fill:'var(--axis)' }} axisLine={false} tickLine={false}/>
                  <Tooltip wrapperStyle={{ outline:'none' }} cursor={{ stroke:'var(--grid)', strokeWidth:1 }}
                    contentStyle={{ fontSize:11, borderRadius:10, background:'var(--tooltip-bg)', border:'1px solid var(--tooltip-border)', color:'var(--tooltip-text)' }}/>
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize:11, color:'var(--t2)' }}/>
                  {Object.keys(trend[0]).filter(k => k !== 'mes').map((k, i) => (
                    <Area key={k} type="monotone" dataKey={k} name={k}
                      stroke={['var(--info)','var(--good)','var(--warn)'][i]}
                      fill={`url(#g${i})`} strokeWidth={2}/>
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-sm"
                style={{ color:'var(--t3)' }}>Sin datos de tendencia</div>
            )}
          </div>

          <div className="card p-5">
            <h3 className="section-title mb-4">Asistencia General</h3>
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={attPie} cx="50%" cy="50%" innerRadius={40} outerRadius={65}
                  dataKey="value" stroke="none">
                  {attPie.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]}/>)}
                </Pie>
                <Tooltip contentStyle={{ fontSize:11, borderRadius:10, background:'var(--tooltip-bg)', border:'1px solid var(--tooltip-border)', color:'var(--tooltip-text)' }}/>
              </PieChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-2 gap-1.5 mt-2">
              {attPie.map((d, i) => (
                <div key={d.name} className="flex items-center gap-1.5 text-xs">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: PIE_COLORS[i] }}/>
                  <span style={{ color:'var(--t2)' }}>
                    {d.name}: <strong style={{ color:'var(--t1)' }}>{d.value}</strong>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          TAB: EVALUACIONES
      ══════════════════════════════════════════════════════════ */}
      {tab === 'evaluaciones' && (() => {
        const effectiveEvals = evals.map(e => ({
          ...e,
          calificacion: evalOverrides[e.id] !== undefined ? evalOverrides[e.id] : e.calificacion,
        }))
        return (
          <div className="card overflow-hidden">
            <div className="px-5 py-3 flex items-center justify-between flex-shrink-0"
              style={{ borderBottom:'1px solid var(--divider)', background:'var(--soft-bg)' }}>
              <h3 className="section-title">Historial de Evaluaciones</h3>
              <span className="flex items-center gap-1.5 text-xs" style={{ color:'var(--t3)' }}>
                <Pencil size={11}/> Click en calificación para editar
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom:'1px solid var(--divider)' }}>
                    {['Materia','Tipo','Calificación','Periodo','Fecha'].map(h => (
                      <th key={h} className="table-header">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {effectiveEvals.map(e => (
                    <tr key={e.id}
                      style={{ borderBottom:'1px solid var(--divider)' }}
                      onMouseEnter={ev => ev.currentTarget.style.background='var(--soft-bg)'}
                      onMouseLeave={ev => ev.currentTarget.style.background='transparent'}>
                      <td className="table-cell font-medium" style={{ color:'var(--t1)' }}>
                        {e.materia}
                      </td>
                      <td className="table-cell">
                        <span className="badge text-[11px] px-2 py-0.5"
                          style={{ background:'var(--soft-bg)', color:'var(--t2)', border:'1px solid var(--card-border)' }}>
                          {e.tipo}
                        </span>
                      </td>
                      <td className="table-cell">
                        <div className="flex items-center gap-1.5">
                          <EditableGrade evalId={e.id} value={e.calificacion} onSave={saveOverride}/>
                          <span className="text-xs" style={{ color:'var(--t3)' }}>/{e.calMax}</span>
                          {evalOverrides[e.id] !== undefined && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold"
                              style={{ background:'var(--warn-soft)', color:'var(--warn)' }}>
                              editado
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="table-cell" style={{ color:'var(--t2)' }}>{e.periodo}</td>
                      <td className="table-cell text-xs" style={{ color:'var(--t3)' }}>{e.fecha}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      })()}

      {/* ══════════════════════════════════════════════════════════
          TAB: ASISTENCIAS
      ══════════════════════════════════════════════════════════ */}
      {tab === 'asistencias' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Object.entries(attCounts).map(([k, v]) => {
              const c = attendanceColors[k]
              return (
                <div key={k} className={`stat-card ${c.bg} border ${c.border}`}>
                  <p className={`text-2xl font-bold ${c.text}`}>{v}</p>
                  <p className={`text-xs font-medium mt-0.5 ${c.text}`} style={{ opacity:.75 }}>{c.label}</p>
                </div>
              )
            })}
          </div>

          <div className="card overflow-hidden">
            <div className="px-5 py-3"
              style={{ borderBottom:'1px solid var(--divider)', background:'var(--soft-bg)' }}>
              <h3 className="section-title">Registro de Asistencias (Abril 2026)</h3>
            </div>
            <div className="divide-y max-h-96 overflow-y-auto"
              style={{ '--tw-divide-opacity':1, borderColor:'var(--divider)' }}>
              {att.map(a => {
                const c = getAttendanceColor(a.status)
                return (
                  <div key={a.id}
                    className="flex items-center justify-between px-5 py-2.5 transition-colors"
                    onMouseEnter={e => e.currentTarget.style.background='var(--soft-bg)'}
                    onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                    <div className="flex items-center gap-3">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${c.bg}`}>
                        <span className={`w-2 h-2 rounded-full ${c.dot}`}/>
                      </div>
                      <span className="text-sm" style={{ color:'var(--t1)' }}>
                        {new Date(a.date + 'T12:00').toLocaleDateString('es-MX', {
                          weekday:'short', day:'numeric', month:'short',
                        })}
                      </span>
                    </div>
                    <span className={`badge ${c.bg} ${c.text} border ${c.border}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`}/>{c.label}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          TAB: REPORTES
      ══════════════════════════════════════════════════════════ */}
      {tab === 'reportes' && (
        <div className="space-y-4">
          {rpts.length === 0 && (
            <div className="card p-10 text-center" style={{ color:'var(--t3)' }}>
              <FileText size={36} className="mx-auto mb-2 opacity-30"/>
              <p>Sin reportes generados aún.</p>
            </div>
          )}
          {rpts.map(r => (
            <div key={r.id} className="card p-5 space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{ background:'var(--soft-bg)', border:'1px solid var(--card-border)' }}>
                    <FileText size={16} style={{ color:'var(--t2)' }}/>
                  </div>
                  <div>
                    <h3 className="font-bold text-sm" style={{ color:'var(--t1)' }}>
                      Reporte — {r.mes}
                    </h3>
                    <p className="text-xs" style={{ color:'var(--t3)' }}>
                      Generado por {r.generadoPor}
                    </p>
                  </div>
                </div>
                <button onClick={() => exportMonthlyReport(s, r)} className="btn-secondary text-xs py-1.5"><Download size={13}/>Descargar</button>
              </div>

              {/* Mini stats */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label:'Promedio',   value: r.promedio,                            color: gradeColor(r.promedio) },
                  { label:'Asistencia', value: `${r.asistencia}%`,                    color: attRateColor(r.asistencia) },
                  { label:'Tareas',     value: `${r.tareasEntregadas}/${r.tareasTotal}`, color:'var(--info)' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="rounded-xl p-3 text-center"
                    style={{ background:'var(--soft-bg)', border:'1px solid var(--card-border)' }}>
                    <p className="text-xl font-bold" style={{ color }}>{value}</p>
                    <p className="text-xs mt-0.5" style={{ color:'var(--t3)' }}>{label}</p>
                  </div>
                ))}
              </div>

              {/* Strengths / areas */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5"
                    style={{ color:'var(--good)' }}>
                    <CheckCircle size={12}/> Fortalezas
                  </p>
                  <ul className="space-y-1.5">
                    {r.fortalezas.map((f, i) => (
                      <li key={i} className="text-sm flex items-start gap-2"
                        style={{ color:'var(--t2)' }}>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 flex-shrink-0"/>
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5"
                    style={{ color:'var(--warn)' }}>
                    <AlertTriangle size={12}/> Áreas de mejora
                  </p>
                  <ul className="space-y-1.5">
                    {r.areas.map((a, i) => (
                      <li key={i} className="text-sm flex items-start gap-2"
                        style={{ color:'var(--t2)' }}>
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 flex-shrink-0"/>
                        {a}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Comment */}
              <div className="pt-3" style={{ borderTop:'1px solid var(--divider)' }}>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5"
                  style={{ color:'var(--t3)' }}>
                  Comentario del docente
                </p>
                <p className="text-sm leading-relaxed italic" style={{ color:'var(--t2)' }}>
                  "{r.comentario}"
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          TAB: ANÁLISIS IA
      ══════════════════════════════════════════════════════════ */}
      {tab === 'ia' && (
        <div className="space-y-4">
          {insight ? (
            <>
              <div className={clsx(
                'card p-5',
                insight.riesgo === 'crítico' ? 'border-l-4 border-red-500' : 'border-l-4 border-amber-500'
              )}>
                <div className="flex items-center gap-3 mb-3">
                  <BrainCircuit size={20}
                    style={{ color: insight.riesgo === 'crítico' ? 'var(--bad)' : 'var(--warn)' }}/>
                  <div>
                    <h3 className="font-bold text-sm" style={{ color:'var(--t1)' }}>
                      Análisis de Rendimiento — IA
                    </h3>
                    <span className="text-xs font-semibold uppercase"
                      style={{ color: insight.riesgo === 'crítico' ? 'var(--bad)' : 'var(--warn)' }}>
                      Nivel de riesgo: {insight.riesgo}
                    </span>
                  </div>
                </div>
                <p className="text-sm leading-relaxed p-3 rounded-xl font-mono"
                  style={{ background:'var(--soft-bg)', color:'var(--t2)', border:'1px solid var(--card-border)' }}>
                  {insight.patron}
                </p>
              </div>

              <div className="card p-5">
                <h3 className="section-title mb-4">Deficiencias Detectadas</h3>
                <div className="space-y-4">
                  {insight.deficiencias.map(d => (
                    <div key={d.materia}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-semibold" style={{ color:'var(--t1)' }}>
                          {d.materia}
                        </span>
                        <span className="text-sm font-bold"
                          style={{ color: d.nivel < 40 ? 'var(--bad)' : d.nivel < 60 ? 'var(--warn)' : 'var(--info)' }}>
                          {d.nivel}%
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full overflow-hidden"
                        style={{ background:'var(--soft-bg)' }}>
                        <div className="h-full rounded-full transition-all"
                          style={{
                            width:`${d.nivel}%`,
                            background: d.nivel < 40 ? 'var(--bad)' : d.nivel < 60 ? 'var(--warn)' : 'var(--info)',
                          }}/>
                      </div>
                      <p className="text-xs mt-1" style={{ color:'var(--t3)' }}>{d.problema}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card p-5">
                <h3 className="section-title mb-3 flex items-center gap-2">
                  <CheckCircle size={15} style={{ color:'var(--good)' }}/> Recomendaciones IA
                </h3>
                <ul className="space-y-2">
                  {insight.recomendaciones.map((rec, i) => (
                    <li key={i} className="flex items-start gap-2.5 px-4 py-2.5 rounded-xl"
                      style={{ background:'var(--good-soft)', border:'1px solid var(--good-soft)' }}>
                      <span className="font-bold text-sm flex-shrink-0" style={{ color:'var(--good)' }}>
                        {i + 1}.
                      </span>
                      <span className="text-sm" style={{ color:'var(--t1)' }}>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          ) : (
            <div className="card p-10 text-center">
              <BrainCircuit size={36} className="mx-auto mb-3" style={{ color:'var(--good)' }}/>
              <h3 className="font-bold text-sm mb-1" style={{ color:'var(--t1)' }}>
                Sin alertas de IA
              </h3>
              <p className="text-sm" style={{ color:'var(--t2)' }}>
                Este alumno tiene un rendimiento dentro de los parámetros esperados.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          TAB: CÓDIGO QR
      ══════════════════════════════════════════════════════════ */}
      {tab === 'qr' && (
        <div className="flex flex-col items-center gap-5 py-4 max-w-sm mx-auto">
          <div className="card p-6 w-full flex flex-col items-center">
            <div className="flex items-center gap-2 mb-5 self-start">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background:'var(--soft-bg)', border:'1px solid var(--card-border)' }}>
                <QrCode size={15} className="text-white"/>
              </div>
              <span className="font-bold text-sm" style={{ color:'var(--t1)' }}>
                Código QR de asistencia
              </span>
            </div>

            <div className="p-4 rounded-2xl" style={{ background:'#ffffff', boxShadow:'0 4px 24px rgba(0,0,0,.35)' }}>
              <QRCodeSVG
                value={`EDUTRACK:${s.id}`}
                size={230}
                level="H"
                fgColor="#0f172a"
                bgColor="#ffffff"
              />
            </div>

            <div className="mt-5 text-center">
              <p className="text-lg font-bold" style={{ color:'var(--t1)' }}>{s.name}</p>
              <p className="text-sm mt-0.5" style={{ color:'var(--t3)' }}>
                {grp?.name} — {grp?.subject}
              </p>
              <code className="text-[11px] font-mono block mt-2" style={{ color:'var(--t4)' }}>
                EDUTRACK:{s.id}
              </code>
            </div>
          </div>

          <div className="card p-4 w-full"
            style={{ background:'var(--soft-bg)' }}>
            <p className="text-xs text-center leading-relaxed" style={{ color:'var(--t2)' }}>
              El alumno puede mostrar este código desde su portal en{' '}
              <span className="font-semibold" style={{ color:'var(--t1)' }}>Mi Código QR</span>.
              Usa el escáner en{' '}
              <span className="font-semibold" style={{ color:'var(--t1)' }}>Pasar Lista</span>{' '}
              para registrar su asistencia.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
