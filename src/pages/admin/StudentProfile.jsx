import { useState } from 'react'
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
  getStudentById, getGroupById, getEvalsByStudent, getAttendByStudent,
  getReportsByStudent, getInsightByStudent, studentRadar, studentGradeTrend,
  statusConfig, attendanceColors, getSimulacrosByStudent,
} from '../../data/mockData'
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
  const col = value >= 8 ? '#34d399' : value >= 6 ? '#60a5fa' : '#f87171'

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
      style={{ background:'rgba(255,255,255,.10)', border:'1.5px solid rgba(255,255,255,.35)', color:'white', padding:'2px 4px' }}
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

const PIE_COLORS = ['#10b981','#f59e0b','#ef4444','#3b82f6']

/* ── Shared primitives ─────────────────────────────────────────── */
const Sub  = ({ children, className='' }) => (
  <p className={`text-[10px] font-bold uppercase tracking-widest mb-1.5 ${className}`}
    style={{ color:'rgba(255,255,255,.32)' }}>{children}</p>
)
const Val  = ({ children, className='' }) => (
  <p className={`text-sm font-semibold truncate ${className}`}
    style={{ color:'rgba(255,255,255,.80)' }}>{children}</p>
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

  const s       = getStudentById(studentId)
  const grp     = getGroupById(s?.groupId)
  const evals   = getEvalsByStudent(studentId)
  const att     = getAttendByStudent(studentId)
  const rpts    = getReportsByStudent(studentId)
  const insight = getInsightByStudent(studentId)
  const radar   = studentRadar[studentId]
  const trend   = studentGradeTrend[studentId]

  if (!s) return (
    <p className="text-sm p-6" style={{ color:'rgba(255,255,255,.40)' }}>Alumno no encontrado.</p>
  )

  const cfg   = statusConfig[s.status]
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

  const gradeColor = g => g >= 8 ? '#34d399' : g >= 7 ? '#60a5fa' : '#f87171'
  const attRateColor = r => r >= 85 ? '#34d399' : r >= 75 ? '#fbbf24' : '#f87171'

  /* Reporte de aprovechamiento hasta el momento — para el tutor */
  const handleExportReport = () => exportStudentReport({
    student: s,
    group: grp,
    evals: evals.map(e => ({ ...e, calificacion: evalOverrides[e.id] ?? e.calificacion })),
    attendance: att,
    sims: getSimulacrosByStudent(s.id),
  })

  return (
    <div className="max-w-5xl space-y-4">

      {/* ── Back ──────────────────────────────────────────────────── */}
      <button onClick={() => navigate('/admin/alumnos')}
        className="flex items-center gap-1.5 text-sm font-medium transition-colors"
        style={{ color:'rgba(255,255,255,.40)' }}
        onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,.85)'}
        onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,.40)'}>
        <ArrowLeft size={15}/> Regresar a Alumnos
      </button>

      {/* ── Profile header ────────────────────────────────────────── */}
      <div className="card p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row gap-5">

          {/* Avatar */}
          <div className="w-18 h-18 w-[72px] h-[72px] rounded-2xl flex items-center justify-center text-xl font-bold flex-shrink-0"
            style={{ background:`${accent}28`, color: accent, border:`2px solid ${accent}55`, boxShadow:`0 0 20px ${accent}22` }}>
            {s.name.split(' ').slice(0, 2).map(n => n[0]).join('')}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-3 flex-wrap">
              <div>
                <h1 className="text-xl font-bold tracking-tight" style={{ color:'rgba(255,255,255,.92)' }}>
                  {s.name}
                </h1>
                <p className="text-sm mt-0.5" style={{ color:'rgba(255,255,255,.45)' }}>
                  {grp?.name} — {grp?.subject}
                </p>
              </div>
              <span className={`badge ${cfg.bg} ${cfg.color} border ${cfg.border} mt-0.5`}>
                <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`}/>{cfg.label}
              </span>
            </div>
            <div className="flex flex-wrap gap-4 mt-3 text-sm" style={{ color:'rgba(255,255,255,.42)' }}>
              <span className="flex items-center gap-1.5"><Mail size={13}/>{s.email}</span>
            </div>

            {/* Quick stats */}
            <div className="flex flex-wrap gap-3 mt-4 pt-4"
              style={{ borderTop:'1px solid rgba(255,255,255,.07)' }}>
              {[
                { label:'Promedio',   value: s.avgGrade,                        color: gradeColor(s.avgGrade)      },
                { label:'Asistencia', value: `${s.attendanceRate}%`,             color: attRateColor(s.attendanceRate) },
                { label:'Tareas',     value: `${s.assignmentsDone}/${s.assignmentsTotal}`, color:'#60a5fa'          },
                { label:'Ranking',    value: `#${s.rank}`,                       color:'#fbbf24'                   },
              ].map(({ label, value, color }) => (
                <div key={label} className="text-center px-4 py-2.5 rounded-xl"
                  style={{ background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.08)' }}>
                  <p className="text-lg font-bold leading-none" style={{ color }}>{value}</p>
                  <p className="text-[11px] mt-1" style={{ color:'rgba(255,255,255,.38)' }}>{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Contact card */}
          <div className="rounded-xl p-4 flex-shrink-0 min-w-[200px]"
            style={{ background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.09)' }}>
            <Sub>Contacto del tutor</Sub>
            <Val className="mb-2">{s.tutor.name}</Val>
            <div className="flex items-center gap-1.5 text-xs" style={{ color:'rgba(255,255,255,.42)' }}>
              <Mail size={11}/>{s.tutor.email}
            </div>
            <div className="flex items-center gap-1.5 mt-1.5 text-xs" style={{ color:'rgba(255,255,255,.42)' }}>
              <Phone size={11}/>{s.tutor.phone}
            </div>
            <button onClick={handleExportReport}
              className="w-full flex items-center justify-center gap-1.5 mt-3 py-2 rounded-lg text-xs font-bold transition-all active:scale-95"
              style={{ background:'rgba(16,185,129,.12)', border:'1px solid rgba(16,185,129,.25)', color:'#10b981' }}
              onMouseEnter={e => e.currentTarget.style.background='rgba(16,185,129,.22)'}
              onMouseLeave={e => e.currentTarget.style.background='rgba(16,185,129,.12)'}
              title="Descarga el aprovechamiento del alumno hasta el momento para compartirlo con el tutor">
              <Download size={12}/> Reporte de avance
            </button>
          </div>
        </div>
      </div>

      {/* ── Tabs ──────────────────────────────────────────────────── */}
      <div className="flex gap-1 rounded-xl p-1 w-fit overflow-x-auto"
        style={{ background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.08)' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap"
            style={tab === t.id
              ? { background:'white', color:'black', boxShadow:'0 2px 8px rgba(0,0,0,.35)' }
              : { color:'rgba(255,255,255,.45)' }}
            onMouseEnter={e => { if (tab !== t.id) e.currentTarget.style.color='rgba(255,255,255,.75)' }}
            onMouseLeave={e => { if (tab !== t.id) e.currentTarget.style.color='rgba(255,255,255,.45)' }}>
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
                  <PolarGrid stroke="rgba(255,255,255,.08)"/>
                  <PolarAngleAxis dataKey="comp" tick={{ fontSize:10, fill:'rgba(255,255,255,.40)' }}/>
                  <PolarRadiusAxis angle={90} domain={[0,10]} tick={{ fontSize:9, fill:'rgba(255,255,255,.22)' }}/>
                  <Radar name="Alumno" dataKey="valor" stroke={accent} fill={accent} fillOpacity={0.12} strokeWidth={2}/>
                </RadarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-sm"
                style={{ color:'rgba(255,255,255,.28)' }}>Sin datos de radar</div>
            )}
          </div>

          <div className="card p-5 xl:col-span-2">
            <h3 className="section-title mb-4">Evolución de Calificaciones</h3>
            {trend ? (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={trend} margin={{ top:5, right:10, bottom:0, left:-20 }}>
                  <defs>
                    {['#3b82f6','#10b981','#f59e0b'].map((c, i) => (
                      <linearGradient key={i} id={`g${i}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={c} stopOpacity={0.15}/>
                        <stop offset="95%" stopColor={c} stopOpacity={0}/>
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.06)"/>
                  <XAxis dataKey="mes" tick={{ fontSize:11, fill:'rgba(255,255,255,.35)' }} axisLine={false} tickLine={false}/>
                  <YAxis domain={[4,10]} tick={{ fontSize:11, fill:'rgba(255,255,255,.35)' }} axisLine={false} tickLine={false}/>
                  <Tooltip wrapperStyle={{ outline:'none' }} cursor={{ stroke:'rgba(255,255,255,.10)', strokeWidth:1 }}
                    contentStyle={{ fontSize:11, borderRadius:10, background:'rgba(10,10,20,.92)', border:'1px solid rgba(255,255,255,.12)', color:'rgba(255,255,255,.80)' }}/>
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize:11, color:'rgba(255,255,255,.50)' }}/>
                  {Object.keys(trend[0]).filter(k => k !== 'mes').map((k, i) => (
                    <Area key={k} type="monotone" dataKey={k} name={k}
                      stroke={['#3b82f6','#10b981','#f59e0b'][i]}
                      fill={`url(#g${i})`} strokeWidth={2}/>
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-sm"
                style={{ color:'rgba(255,255,255,.28)' }}>Sin datos de tendencia</div>
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
                <Tooltip contentStyle={{ fontSize:11, borderRadius:10, background:'rgba(10,10,20,.92)', border:'1px solid rgba(255,255,255,.12)', color:'rgba(255,255,255,.80)' }}/>
              </PieChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-2 gap-1.5 mt-2">
              {attPie.map((d, i) => (
                <div key={d.name} className="flex items-center gap-1.5 text-xs">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: PIE_COLORS[i] }}/>
                  <span style={{ color:'rgba(255,255,255,.50)' }}>
                    {d.name}: <strong style={{ color:'rgba(255,255,255,.80)' }}>{d.value}</strong>
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
              style={{ borderBottom:'1px solid rgba(255,255,255,.07)', background:'rgba(255,255,255,.03)' }}>
              <h3 className="section-title">Historial de Evaluaciones</h3>
              <span className="flex items-center gap-1.5 text-xs" style={{ color:'rgba(255,255,255,.32)' }}>
                <Pencil size={11}/> Click en calificación para editar
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom:'1px solid rgba(255,255,255,.07)' }}>
                    {['Materia','Tipo','Calificación','Periodo','Fecha'].map(h => (
                      <th key={h} className="table-header">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {effectiveEvals.map(e => (
                    <tr key={e.id}
                      style={{ borderBottom:'1px solid rgba(255,255,255,.04)' }}
                      onMouseEnter={ev => ev.currentTarget.style.background='rgba(255,255,255,.03)'}
                      onMouseLeave={ev => ev.currentTarget.style.background='transparent'}>
                      <td className="table-cell font-medium" style={{ color:'rgba(255,255,255,.85)' }}>
                        {e.materia}
                      </td>
                      <td className="table-cell">
                        <span className="badge text-[11px] px-2 py-0.5"
                          style={{ background:'rgba(255,255,255,.07)', color:'rgba(255,255,255,.60)', border:'1px solid rgba(255,255,255,.10)' }}>
                          {e.tipo}
                        </span>
                      </td>
                      <td className="table-cell">
                        <div className="flex items-center gap-1.5">
                          <EditableGrade evalId={e.id} value={e.calificacion} onSave={saveOverride}/>
                          <span className="text-xs" style={{ color:'rgba(255,255,255,.28)' }}>/{e.calMax}</span>
                          {evalOverrides[e.id] !== undefined && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold"
                              style={{ background:'rgba(251,191,36,.15)', color:'#fbbf24' }}>
                              editado
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="table-cell" style={{ color:'rgba(255,255,255,.45)' }}>{e.periodo}</td>
                      <td className="table-cell text-xs" style={{ color:'rgba(255,255,255,.40)' }}>{e.fecha}</td>
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
              style={{ borderBottom:'1px solid rgba(255,255,255,.07)', background:'rgba(255,255,255,.03)' }}>
              <h3 className="section-title">Registro de Asistencias (Abril 2026)</h3>
            </div>
            <div className="divide-y max-h-96 overflow-y-auto"
              style={{ '--tw-divide-opacity':1, borderColor:'rgba(255,255,255,.05)' }}>
              {att.map(a => {
                const c = attendanceColors[a.status]
                return (
                  <div key={a.id}
                    className="flex items-center justify-between px-5 py-2.5 transition-colors"
                    onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,.03)'}
                    onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                    <div className="flex items-center gap-3">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${c.bg}`}>
                        <span className={`w-2 h-2 rounded-full ${c.dot}`}/>
                      </div>
                      <span className="text-sm" style={{ color:'rgba(255,255,255,.72)' }}>
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
            <div className="card p-10 text-center" style={{ color:'rgba(255,255,255,.35)' }}>
              <FileText size={36} className="mx-auto mb-2 opacity-30"/>
              <p>Sin reportes generados aún.</p>
            </div>
          )}
          {rpts.map(r => (
            <div key={r.id} className="card p-5 space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{ background:'rgba(255,255,255,.07)', border:'1px solid rgba(255,255,255,.10)' }}>
                    <FileText size={16} style={{ color:'rgba(255,255,255,.55)' }}/>
                  </div>
                  <div>
                    <h3 className="font-bold text-sm" style={{ color:'rgba(255,255,255,.90)' }}>
                      Reporte — {r.mes}
                    </h3>
                    <p className="text-xs" style={{ color:'rgba(255,255,255,.38)' }}>
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
                  { label:'Tareas',     value: `${r.tareasEntregadas}/${r.tareasTotal}`, color:'#60a5fa' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="rounded-xl p-3 text-center"
                    style={{ background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.07)' }}>
                    <p className="text-xl font-bold" style={{ color }}>{value}</p>
                    <p className="text-xs mt-0.5" style={{ color:'rgba(255,255,255,.38)' }}>{label}</p>
                  </div>
                ))}
              </div>

              {/* Strengths / areas */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5"
                    style={{ color:'#34d399' }}>
                    <CheckCircle size={12}/> Fortalezas
                  </p>
                  <ul className="space-y-1.5">
                    {r.fortalezas.map((f, i) => (
                      <li key={i} className="text-sm flex items-start gap-2"
                        style={{ color:'rgba(255,255,255,.68)' }}>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 flex-shrink-0"/>
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5"
                    style={{ color:'#fbbf24' }}>
                    <AlertTriangle size={12}/> Áreas de mejora
                  </p>
                  <ul className="space-y-1.5">
                    {r.areas.map((a, i) => (
                      <li key={i} className="text-sm flex items-start gap-2"
                        style={{ color:'rgba(255,255,255,.68)' }}>
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 flex-shrink-0"/>
                        {a}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Comment */}
              <div className="pt-3" style={{ borderTop:'1px solid rgba(255,255,255,.07)' }}>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5"
                  style={{ color:'rgba(255,255,255,.30)' }}>
                  Comentario del docente
                </p>
                <p className="text-sm leading-relaxed italic" style={{ color:'rgba(255,255,255,.60)' }}>
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
                    style={{ color: insight.riesgo === 'crítico' ? '#f87171' : '#fbbf24' }}/>
                  <div>
                    <h3 className="font-bold text-sm" style={{ color:'rgba(255,255,255,.90)' }}>
                      Análisis de Rendimiento — IA
                    </h3>
                    <span className="text-xs font-semibold uppercase"
                      style={{ color: insight.riesgo === 'crítico' ? '#f87171' : '#fbbf24' }}>
                      Nivel de riesgo: {insight.riesgo}
                    </span>
                  </div>
                </div>
                <p className="text-sm leading-relaxed p-3 rounded-xl font-mono"
                  style={{ background:'rgba(255,255,255,.05)', color:'rgba(255,255,255,.68)', border:'1px solid rgba(255,255,255,.07)' }}>
                  {insight.patron}
                </p>
              </div>

              <div className="card p-5">
                <h3 className="section-title mb-4">Deficiencias Detectadas</h3>
                <div className="space-y-4">
                  {insight.deficiencias.map(d => (
                    <div key={d.materia}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-semibold" style={{ color:'rgba(255,255,255,.85)' }}>
                          {d.materia}
                        </span>
                        <span className="text-sm font-bold"
                          style={{ color: d.nivel < 40 ? '#f87171' : d.nivel < 60 ? '#fbbf24' : '#60a5fa' }}>
                          {d.nivel}%
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full overflow-hidden"
                        style={{ background:'rgba(255,255,255,.08)' }}>
                        <div className="h-full rounded-full transition-all"
                          style={{
                            width:`${d.nivel}%`,
                            background: d.nivel < 40 ? '#ef4444' : d.nivel < 60 ? '#f59e0b' : '#3b82f6',
                          }}/>
                      </div>
                      <p className="text-xs mt-1" style={{ color:'rgba(255,255,255,.42)' }}>{d.problema}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card p-5">
                <h3 className="section-title mb-3 flex items-center gap-2">
                  <CheckCircle size={15} style={{ color:'#34d399' }}/> Recomendaciones IA
                </h3>
                <ul className="space-y-2">
                  {insight.recomendaciones.map((rec, i) => (
                    <li key={i} className="flex items-start gap-2.5 px-4 py-2.5 rounded-xl"
                      style={{ background:'rgba(16,185,129,.08)', border:'1px solid rgba(16,185,129,.20)' }}>
                      <span className="font-bold text-sm flex-shrink-0" style={{ color:'#34d399' }}>
                        {i + 1}.
                      </span>
                      <span className="text-sm" style={{ color:'rgba(255,255,255,.72)' }}>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          ) : (
            <div className="card p-10 text-center">
              <BrainCircuit size={36} className="mx-auto mb-3" style={{ color:'#34d399' }}/>
              <h3 className="font-bold text-sm mb-1" style={{ color:'rgba(255,255,255,.85)' }}>
                Sin alertas de IA
              </h3>
              <p className="text-sm" style={{ color:'rgba(255,255,255,.45)' }}>
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
                style={{ background:'rgba(255,255,255,.09)', border:'1px solid rgba(255,255,255,.12)' }}>
                <QrCode size={15} className="text-white"/>
              </div>
              <span className="font-bold text-sm" style={{ color:'rgba(255,255,255,.80)' }}>
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
              <p className="text-lg font-bold" style={{ color:'rgba(255,255,255,.92)' }}>{s.name}</p>
              <p className="text-sm mt-0.5" style={{ color:'rgba(255,255,255,.42)' }}>
                {grp?.name} — {grp?.subject}
              </p>
              <code className="text-[11px] font-mono block mt-2" style={{ color:'rgba(255,255,255,.22)' }}>
                EDUTRACK:{s.id}
              </code>
            </div>
          </div>

          <div className="card p-4 w-full"
            style={{ background:'rgba(255,255,255,.04)' }}>
            <p className="text-xs text-center leading-relaxed" style={{ color:'rgba(255,255,255,.45)' }}>
              El alumno puede mostrar este código desde su portal en{' '}
              <span className="font-semibold" style={{ color:'rgba(255,255,255,.70)' }}>Mi Código QR</span>.
              Usa el escáner en{' '}
              <span className="font-semibold" style={{ color:'rgba(255,255,255,.70)' }}>Pasar Lista</span>{' '}
              para registrar su asistencia.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
