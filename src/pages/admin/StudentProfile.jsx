import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { ArrowLeft, Mail, Phone, BookOpen, Calendar, TrendingUp, BrainCircuit, FileText, Download, CheckCircle, AlertTriangle, QrCode } from 'lucide-react'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, ResponsiveContainer, Legend
} from 'recharts'
import {
  getStudentById, getGroupById, getEvalsByStudent, getAttendByStudent,
  getReportsByStudent, getInsightByStudent, studentRadar, studentGradeTrend,
  statusConfig, attendanceColors
} from '../../data/mockData'
import clsx from 'clsx'

const TABS = [
  { id:'resumen',      label:'Resumen',      icon:TrendingUp },
  { id:'evaluaciones', label:'Evaluaciones', icon:BookOpen },
  { id:'asistencias',  label:'Asistencias',  icon:Calendar },
  { id:'reportes',     label:'Reportes',     icon:FileText },
  { id:'ia',           label:'Análisis IA',  icon:BrainCircuit },
  { id:'qr',           label:'Código QR',    icon:QrCode },
]

const PIE_COLORS = ['#10b981','#f59e0b','#ef4444','#3b82f6']

export default function StudentProfile() {
  const { studentId } = useParams()
  const navigate = useNavigate()
  const [tab, setTab] = useState('resumen')

  const s      = getStudentById(studentId)
  const grp    = getGroupById(s?.groupId)
  const evals  = getEvalsByStudent(studentId)
  const att    = getAttendByStudent(studentId)
  const rpts   = getReportsByStudent(studentId)
  const insight= getInsightByStudent(studentId)
  const radar  = studentRadar[studentId]
  const trend  = studentGradeTrend[studentId]

  if (!s) return <div className="p-6 text-slate-500">Alumno no encontrado.</div>

  const cfg = statusConfig[s.status]

  const attCounts = {
    presente:    att.filter(a=>a.status==='presente').length,
    tardanza:    att.filter(a=>a.status==='tardanza').length,
    ausente:     att.filter(a=>a.status==='ausente').length,
    justificado: att.filter(a=>a.status==='justificado').length,
  }
  const attPie = Object.entries(attCounts).map(([k,v]) => ({ name: attendanceColors[k].label, value:v }))

  return (
    <div className="max-w-5xl space-y-4">
      {/* Back */}
      <button onClick={()=>navigate('/admin/alumnos')} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors">
        <ArrowLeft size={15}/> Regresar a Alumnos
      </button>

      {/* Profile header */}
      <div className="card p-6">
        <div className="flex flex-col sm:flex-row gap-5">
          <div className="w-20 h-20 rounded-2xl bg-navy-900 flex items-center justify-center text-white text-2xl font-bold flex-shrink-0">
            {s.name.split(' ').slice(0,2).map(n=>n[0]).join('')}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-3 flex-wrap">
              <div>
                <h1 className="text-xl font-bold text-slate-900">{s.name}</h1>
                <p className="text-slate-500 text-sm mt-0.5">{grp?.name} — {grp?.subject}</p>
              </div>
              <span className={`badge ${cfg.bg} ${cfg.color} border ${cfg.border} mt-1`}>
                <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`}/>{cfg.label}
              </span>
            </div>
            <div className="flex flex-wrap gap-4 mt-3 text-sm text-slate-500">
              <span className="flex items-center gap-1.5"><Mail size={13}/>{s.email}</span>
            </div>

            {/* Quick stats */}
            <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-slate-100">
              {[
                { label:'Promedio', value:s.avgGrade, color: s.avgGrade>=8?'text-emerald-600':s.avgGrade>=7?'text-blue-600':'text-red-600' },
                { label:'Asistencia', value:`${s.attendanceRate}%`, color:s.attendanceRate>=85?'text-emerald-600':s.attendanceRate>=75?'text-amber-600':'text-red-600' },
                { label:'Tareas', value:`${s.assignmentsDone}/${s.assignmentsTotal}`, color:'text-blue-600' },
                { label:'Ranking', value:`#${s.rank}`, color:'text-gold-600' },
              ].map(({ label, value, color }) => (
                <div key={label} className="text-center px-4 py-2 rounded-xl bg-slate-50">
                  <p className={`text-lg font-bold ${color}`}>{value}</p>
                  <p className="text-[11px] text-slate-500">{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Tutor info */}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 flex-shrink-0 min-w-52">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Tutor / Padre</p>
            <p className="text-sm font-semibold text-slate-800">{s.tutor.name}</p>
            <div className="flex items-center gap-1.5 mt-1.5 text-xs text-slate-500">
              <Mail size={11}/>{s.tutor.email}
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-500">
              <Phone size={11}/>{s.tutor.phone}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white rounded-xl p-1.5 shadow-card border border-slate-100 w-fit">
        {TABS.map(t => (
          <button key={t.id} onClick={()=>setTab(t.id)}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all',
              tab===t.id ? 'bg-navy-900 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            )}>
            <t.icon size={14}/>{t.label}
          </button>
        ))}
      </div>

      {/* ── Resumen ───────────────────────────────────────────── */}
      {tab === 'resumen' && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="card p-5">
            <h3 className="section-title mb-4">Competencias</h3>
            {radar ? (
              <ResponsiveContainer width="100%" height={220}>
                <RadarChart data={radar}>
                  <PolarGrid stroke="#e2e8f0" />
                  <PolarAngleAxis dataKey="comp" tick={{ fontSize:10, fill:'#94a3b8' }} />
                  <PolarRadiusAxis angle={90} domain={[0,10]} tick={{ fontSize:9, fill:'#cbd5e1' }} />
                  <Radar name="Alumno" dataKey="valor" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} strokeWidth={2}/>
                </RadarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-slate-400 text-sm">Sin datos de radar</div>
            )}
          </div>

          <div className="card p-5 xl:col-span-2">
            <h3 className="section-title mb-4">Evolución de Calificaciones</h3>
            {trend ? (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={trend} margin={{ top:5, right:10, bottom:0, left:-20 }}>
                  <defs>
                    {['#3b82f6','#10b981','#f59e0b'].map((c,i)=>(
                      <linearGradient key={i} id={`g${i}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={c} stopOpacity={0.15}/>
                        <stop offset="95%" stopColor={c} stopOpacity={0}/>
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                  <XAxis dataKey="mes" tick={{ fontSize:11, fill:'#94a3b8' }} axisLine={false} tickLine={false}/>
                  <YAxis domain={[4,10]} tick={{ fontSize:11, fill:'#94a3b8' }} axisLine={false} tickLine={false}/>
                  <Tooltip contentStyle={{ fontSize:11, borderRadius:8 }}/>
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize:11 }}/>
                  {Object.keys(trend[0]).filter(k=>k!=='mes').map((k,i)=>(
                    <Area key={k} type="monotone" dataKey={k} name={k} stroke={['#3b82f6','#10b981','#f59e0b'][i]} fill={`url(#g${i})`} strokeWidth={2}/>
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-slate-400 text-sm">Sin datos de tendencia</div>
            )}
          </div>

          <div className="card p-5">
            <h3 className="section-title mb-4">Asistencia General</h3>
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={attPie} cx="50%" cy="50%" innerRadius={40} outerRadius={65} dataKey="value" stroke="none">
                  {attPie.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]}/>)}
                </Pie>
                <Tooltip contentStyle={{ fontSize:11, borderRadius:8 }}/>
              </PieChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-2 gap-1.5 mt-2">
              {attPie.map((d,i)=>(
                <div key={d.name} className="flex items-center gap-1.5 text-xs">
                  <span className="w-2 h-2 rounded-full" style={{ background:PIE_COLORS[i] }}/>
                  <span className="text-slate-600">{d.name}: <strong>{d.value}</strong></span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Evaluaciones ─────────────────────────────────────── */}
      {tab === 'evaluaciones' && (
        <div className="card overflow-hidden">
          <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
            <h3 className="section-title">Historial de Evaluaciones</h3>
          </div>
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="table-header">Materia</th>
                <th className="table-header">Tipo</th>
                <th className="table-header">Calificación</th>
                <th className="table-header">Periodo</th>
                <th className="table-header">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {evals.map(e => {
                const color = e.calificacion>=8?'text-emerald-600':e.calificacion>=6?'text-blue-600':'text-red-600'
                return (
                  <tr key={e.id} className="hover:bg-slate-50/50">
                    <td className="table-cell font-medium text-slate-800">{e.materia}</td>
                    <td className="table-cell"><span className="badge bg-slate-100 text-slate-600">{e.tipo}</span></td>
                    <td className="table-cell">
                      <span className={`font-bold text-lg ${color}`}>{e.calificacion}</span>
                      <span className="text-slate-400 text-xs">/{e.calMax}</span>
                    </td>
                    <td className="table-cell text-slate-500">{e.periodo}</td>
                    <td className="table-cell text-slate-500 text-xs">{e.fecha}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Asistencias ──────────────────────────────────────── */}
      {tab === 'asistencias' && (
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-3">
            {Object.entries(attCounts).map(([k,v])=>{
              const c = attendanceColors[k]
              return (
                <div key={k} className={`stat-card ${c.bg} border ${c.text}`}>
                  <p className="text-2xl font-bold">{v}</p>
                  <p className="text-xs font-medium mt-0.5">{c.label}</p>
                </div>
              )
            })}
          </div>
          <div className="card overflow-hidden">
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
              <h3 className="section-title">Registro de Asistencias (Abril 2026)</h3>
            </div>
            <div className="divide-y divide-slate-50 max-h-96 overflow-y-auto">
              {att.map(a=>{
                const c = attendanceColors[a.status]
                return (
                  <div key={a.id} className="flex items-center justify-between px-5 py-2.5 hover:bg-slate-50">
                    <div className="flex items-center gap-3">
                      <div className={`w-7 h-7 rounded-lg ${c.bg} flex items-center justify-center`}>
                        <span className={`w-2 h-2 rounded-full ${attendanceColors[a.status].dot}`}/>
                      </div>
                      <span className="text-sm text-slate-700">{new Date(a.date+'T12:00').toLocaleDateString('es-MX',{ weekday:'short', day:'numeric', month:'short' })}</span>
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
      )}

      {/* ── Reportes ─────────────────────────────────────────── */}
      {tab === 'reportes' && (
        <div className="space-y-4">
          {rpts.length === 0 && (
            <div className="card p-10 text-center text-slate-400">
              <FileText size={36} className="mx-auto mb-2 opacity-30"/>
              <p>Sin reportes generados aún.</p>
            </div>
          )}
          {rpts.map(r => (
            <div key={r.id} className="card p-6">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-navy-100 flex items-center justify-center">
                      <FileText size={15} className="text-navy-700"/>
                    </div>
                    <h3 className="font-bold text-slate-900">Reporte — {r.mes}</h3>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">Generado por {r.generadoPor}</p>
                </div>
                <button className="btn-secondary text-xs py-1.5"><Download size={13}/>Descargar</button>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-3">
                {[
                  { label:'Promedio', value:r.promedio, color:r.promedio>=8?'text-emerald-600':'text-amber-600' },
                  { label:'Asistencia', value:`${r.asistencia}%`, color:r.asistencia>=85?'text-emerald-600':'text-amber-600' },
                  { label:'Tareas', value:`${r.tareasEntregadas}/${r.tareasTotal}`, color:'text-blue-600' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-slate-50 rounded-xl p-3 text-center">
                    <p className={`text-xl font-bold ${color}`}>{value}</p>
                    <p className="text-xs text-slate-500">{label}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <CheckCircle size={12}/> Fortalezas
                  </p>
                  <ul className="space-y-1">
                    {r.fortalezas.map((f,i)=>(
                      <li key={i} className="text-sm text-slate-700 flex items-start gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0"/>
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <AlertTriangle size={12}/> Áreas de mejora
                  </p>
                  <ul className="space-y-1">
                    {r.areas.map((a,i)=>(
                      <li key={i} className="text-sm text-slate-700 flex items-start gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 flex-shrink-0"/>
                        {a}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-xs font-semibold text-slate-500 mb-1.5">Comentario del docente</p>
                <p className="text-sm text-slate-700 leading-relaxed italic">"{r.comentario}"</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── IA ───────────────────────────────────────────────── */}
      {tab === 'ia' && (
        <div className="space-y-4">
          {insight ? (
            <>
              <div className={`card p-5 border-l-4 ${insight.riesgo==='crítico'?'border-red-500':'border-amber-500'}`}>
                <div className="flex items-center gap-3 mb-3">
                  <BrainCircuit size={20} className={insight.riesgo==='crítico'?'text-red-500':'text-amber-500'}/>
                  <div>
                    <h3 className="font-bold text-slate-900">Análisis de Rendimiento — IA</h3>
                    <span className={`text-xs font-semibold uppercase ${insight.riesgo==='crítico'?'text-red-600':'text-amber-600'}`}>
                      Nivel de riesgo: {insight.riesgo}
                    </span>
                  </div>
                </div>
                <p className="text-sm text-slate-700 bg-slate-50 rounded-lg p-3 font-mono leading-relaxed">
                  {insight.patron}
                </p>
              </div>

              <div className="card p-5">
                <h3 className="section-title mb-4">Deficiencias Detectadas</h3>
                <div className="space-y-4">
                  {insight.deficiencias.map(d => (
                    <div key={d.materia}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-semibold text-slate-800">{d.materia}</span>
                        <span className={`text-sm font-bold ${d.nivel<40?'text-red-600':d.nivel<60?'text-amber-600':'text-blue-600'}`}>
                          {d.nivel}%
                        </span>
                      </div>
                      <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all"
                          style={{ width:`${d.nivel}%`, background:d.nivel<40?'#ef4444':d.nivel<60?'#f59e0b':'#3b82f6' }}/>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">{d.problema}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card p-5">
                <h3 className="section-title mb-3 flex items-center gap-2">
                  <CheckCircle size={16} className="text-emerald-500"/> Recomendaciones IA
                </h3>
                <ul className="space-y-2">
                  {insight.recomendaciones.map((r,i)=>(
                    <li key={i} className="flex items-start gap-2.5 bg-emerald-50 border border-emerald-100 rounded-lg px-4 py-2.5">
                      <span className="text-emerald-600 font-bold text-sm flex-shrink-0">{i+1}.</span>
                      <span className="text-sm text-emerald-800">{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          ) : (
            <div className="card p-10 text-center">
              <BrainCircuit size={36} className="mx-auto mb-3 text-emerald-500"/>
              <h3 className="font-semibold text-slate-800 mb-1">Sin alertas de IA</h3>
              <p className="text-sm text-slate-500">Este alumno tiene un rendimiento dentro de los parámetros esperados.</p>
            </div>
          )}
        </div>
      )}

      {/* ── QR ───────────────────────────────────────────────── */}
      {tab === 'qr' && (
        <div className="flex flex-col items-center gap-5 py-4 max-w-sm mx-auto">
          <div className="card p-8 w-full flex flex-col items-center">
            <div className="flex items-center gap-2 mb-6 self-start">
              <div className="w-8 h-8 rounded-lg bg-navy-900 flex items-center justify-center">
                <QrCode size={15} className="text-white"/>
              </div>
              <span className="font-bold text-navy-900 text-sm">Código QR de asistencia</span>
            </div>

            <div className="p-5 bg-white rounded-2xl border-2 border-slate-100 shadow-inner">
              <QRCodeSVG
                value={`EDUTRACK:${s.id}`}
                size={240}
                level="H"
                fgColor="#0f2b5b"
                bgColor="#ffffff"
              />
            </div>

            <div className="mt-5 text-center">
              <p className="text-lg font-bold text-slate-900">{s.name}</p>
              <p className="text-slate-500 text-sm mt-1">{grp?.name} — {grp?.subject}</p>
              <code className="text-xs text-slate-300 mt-2 block font-mono tracking-widest">
                EDUTRACK:{s.id}
              </code>
            </div>
          </div>

          <div className="card p-4 w-full text-center">
            <p className="text-xs text-slate-500 leading-relaxed">
              El alumno puede mostrar este mismo código desde su vista personal en
              <span className="font-semibold text-navy-800"> Mi Código QR</span>.
              Usa el escáner en <span className="font-semibold text-navy-800">Pasar Lista → Modo QR</span> para registrar su asistencia.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
