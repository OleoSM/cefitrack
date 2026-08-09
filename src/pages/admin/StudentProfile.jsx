import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import {
  ArrowLeft, Mail, Phone, BookOpen, Calendar, TrendingUp,
  FileText, Download, CheckCircle, AlertTriangle, QrCode,
  GraduationCap, Pencil,
} from 'lucide-react'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, ResponsiveContainer, Legend,
} from 'recharts'
import {
  getReportsByStudent, studentRadar, studentGradeTrend,
  getStatusConfig, attendanceColors, getAttendanceColor, getSimulacrosByStudent,
} from '../../data/mockData'
import {
  fetchStudentById, fetchGroupById, fetchEvaluationsByStudent, fetchStudentAttendance,
} from '../../lib/supabaseData'
import { exportStudentReport, exportMonthlyReport } from '../../lib/exportReports'
import ProgressiveList from '../../components/ui/ProgressiveList'
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

/* ── Iconos de estado de asistencia ────────────────────────────────
   Set generado por Codex bajo la gramática de lucide-react que usa el resto
   de la app: rejilla de 24, sin relleno, trazo de 2 y extremos redondeados.
   La idea de sistema es un calendario común —la sesión, el día de clase—
   con un símbolo breve dentro que dice qué pasó en ella: palomita, reloj,
   aspa y documento validado. Al compartir base se leen como familia y no
   como cuatro iconos sueltos. Heredan el color por `currentColor`, así que
   sobre el relleno mate salen en blanco sin pasarles ningún color. */
const HOJA_CALENDARIO = 'M7 3v2m10-2v2M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2M3 9h18'

const IconoEstado = ({ children, size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true">
    <path d={HOJA_CALENDARIO}/>
    {children}
  </svg>
)

const ICONOS_ASISTENCIA = {
  /* Palomita: la sesión se cumplió */
  presente: (
    <IconoEstado><path d="m8 15 2.5 2.5L16 12"/></IconoEstado>
  ),
  /* Reloj: llegó, pero tarde */
  tardanza: (
    <IconoEstado><circle cx="12" cy="15.5" r="4"/><path d="M12 13.5v2.25l1.5 1"/></IconoEstado>
  ),
  /* Aspa: la sesión no se cubrió */
  ausente: (
    <IconoEstado>
      <line x1="9" y1="12.5" x2="15" y2="18.5"/>
      <line x1="15" y1="12.5" x2="9" y2="18.5"/>
    </IconoEstado>
  ),
  /* Documento validado: la falta va respaldada por un justificante */
  justificado: (
    <IconoEstado>
      <path d="M8.5 12h5l2 2v5.5h-7zM13.5 12v2h2"/>
      <path d="m10 16 1.25 1.25 2.5-2.5"/>
    </IconoEstado>
  ),
}

/* Relleno mate de cada estado. Es un token, nunca un color literal: cada
   identidad (default / IPN / UNAM) publica el suyo, y los tres están
   calibrados para llevar texto blanco encima. */
const RELLENO_ASISTENCIA = {
  presente:    'var(--good-solid)',
  tardanza:    'var(--warn-solid)',
  ausente:     'var(--bad-solid)',
  justificado: 'var(--info-solid)',
}

export default function StudentProfile() {
  const { studentId } = useParams()
  const navigate = useNavigate()
  const { getAccent } = useGroupColors()
  const [tab, setTab] = useState('resumen')

  /* ── Tira de pestañas deslizable ──────────────────────────────
     Con el tabindex móvil del patrón WAI-ARIA el tabulador entra una sola
     vez a la tira y son las flechas las que mueven entre pestañas: hay que
     implementarlas o el teclado se queda sin poder cambiar de sección. */
  const tabsRef = useRef(null)

  const irAPestana = id => {
    setTab(id)
    // El navegador desplazaría el carril por su cuenta al enfocar; lo hace
    // el efecto de abajo, que además respeta el margen de la píldora.
    tabsRef.current?.querySelector(`[data-tab="${id}"]`)?.focus({ preventScroll:true })
  }

  const onTabKeyDown = e => {
    const ids = TABS.map(t => t.id)
    const i = ids.indexOf(tab)
    const salto = { ArrowRight: 1, ArrowLeft: -1 }[e.key]
    if (salto !== undefined) {
      e.preventDefault()
      irAPestana(ids[(i + salto + ids.length) % ids.length])
    } else if (e.key === 'Home') {
      e.preventDefault(); irAPestana(ids[0])
    } else if (e.key === 'End') {
      e.preventDefault(); irAPestana(ids[ids.length - 1])
    }
  }

  /* Trae la pestaña activa al carril cuando queda fuera de vista. Mueve sólo
     el scroll del contenedor —no `scrollIntoView`— para que la página nunca
     dé un salto vertical al cambiar de sección en móvil. */
  useEffect(() => {
    const carril = tabsRef.current
    const activa = carril?.querySelector(`[data-tab="${tab}"]`)
    if (!carril || !activa) return
    const c = carril.getBoundingClientRect()
    const a = activa.getBoundingClientRect()
    const aire = 8
    if (a.left < c.left + aire) {
      carril.scrollBy({ left: a.left - c.left - aire, behavior:'smooth' })
    } else if (a.right > c.right - aire) {
      carril.scrollBy({ left: a.right - c.right + aire, behavior:'smooth' })
    }
  }, [tab])

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

  // Los simulacros siguen siendo simulados; no hay tabla todavía.
  const rpts    = getReportsByStudent(studentId)
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

          {/* Avatar: el que el alumno eligió en su portal, o sus iniciales
              sobre el color del grupo si aún no ha elegido ninguno. */}
          {s.avatarSrc ? (
            <img src={s.avatarSrc} alt=""
              className="w-[72px] h-[72px] rounded-2xl object-cover flex-shrink-0"
              style={{ border:'1px solid var(--card-border)' }}/>
          ) : (
            <div className="w-[72px] h-[72px] rounded-2xl flex items-center justify-center text-xl font-bold flex-shrink-0"
              /* Fondo pleno con inicial blanca. Antes era el acento al 16 % de
                 alfa con un glow de color: sobre página blanca el bloque casi
                 no existía y la inicial quedaba flotando. */
              style={{ background: accent, color:'#ffffff', boxShadow:'0 1px 3px rgba(15,23,42,.22)' }}>
              {s.name.split(' ').slice(0, 2).map(n => n[0]).join('')}
            </div>
          )}

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
            <div className="flex flex-wrap gap-4 mt-3 text-sm min-w-0" style={{ color:'var(--t3)' }}>
              {/* Un correo institucional largo no parte por sí solo y en 411 px
                  se salía de la tarjeta, donde `.card` lo recortaba. */}
              <span className="flex items-center gap-1.5 min-w-0 max-w-full">
                <Mail size={13} className="flex-shrink-0"/>
                <span className="truncate">{s.email}</span>
              </span>
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

      {/* ── Tabs ──────────────────────────────────────────────────────
          La píldora se ajusta al contenido a partir de `sm`, donde las seis
          pestañas caben; por debajo ocupa el ancho disponible y desliza. El
          `w-fit` a secas hacía crecer el contenedor hasta el ancho de sus
          botones, así que en móvil se desbordaba de la página en vez de
          desplazarse por dentro, y `max-w-full` es lo que devuelve el carril
          en tablets estrechas. `shrink-0` en cada botón evita que el flex los
          comprima y parta las etiquetas en dos líneas. */}
      <div ref={tabsRef} role="tablist" aria-label="Secciones del alumno"
        className="flex gap-1 rounded-xl p-1 w-full max-w-full sm:w-fit
                   scroll-carril snap-x scroll-px-1 scroll-smooth motion-reduce:scroll-auto"
        style={{ background:'var(--soft-bg)', border:'1px solid var(--card-border)' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            data-tab={t.id} id={`pestana-${t.id}`} aria-controls="panel-alumno"
            role="tab" aria-selected={tab === t.id} tabIndex={tab === t.id ? 0 : -1}
            onKeyDown={onTabKeyDown}
            className="flex shrink-0 snap-start items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap"
            style={tab === t.id
              ? { background:'white', color:'black', boxShadow:'0 2px 8px rgba(0,0,0,.35)' }
              : { color:'var(--t2)' }}
            onMouseEnter={e => { if (tab !== t.id) e.currentTarget.style.color='var(--t1)' }}
            onMouseLeave={e => { if (tab !== t.id) e.currentTarget.style.color='var(--t2)' }}>
            <t.icon size={14}/>{t.label}
          </button>
        ))}
      </div>

      {/* Un solo panel para las seis secciones: como sólo se pinta la activa,
          basta con que se anuncie etiquetado por la pestaña en curso. */}
      {/* `min-w-0`: el panel es hijo de un contenedor en flujo normal, pero sus
          nietos (rejillas y tablas) sí necesitan poder encoger. Sin esto una
          tabla ancha empujaba el ancho del panel y aparecía la barra horizontal
          de la página entera en vez de la del propio bloque. */}
      <div id="panel-alumno" role="tabpanel" aria-labelledby={`pestana-${tab}`} className="min-w-0">

      {/* ══════════════════════════════════════════════════════════
          TAB: RESUMEN
      ══════════════════════════════════════════════════════════ */}
      {tab === 'resumen' && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 min-w-0">

          {/* `min-w-0` en cada tarjeta con gráfica: Recharts mide el hueco y
              escribe un ancho en píxeles en el <svg>, así que la aportación de
              contenido mínimo de la celda se queda anclada al ancho anterior y
              la rejilla no vuelve a encoger al girar el teléfono. */}
          <div className="card p-5 min-w-0">
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

          <div className="card p-5 min-w-0 xl:col-span-2">
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

          <div className="card p-5 min-w-0">
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
                <div key={d.name} className="flex items-center gap-1.5 text-xs min-w-0">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: PIE_COLORS[i] }}/>
                  <span className="truncate" style={{ color:'var(--t2)' }}>
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
            {/* La pista de edición y el título sumaban ~370 px en una caja de
                339: sin `flex-wrap` el texto se salía y `.card` lo recortaba a
                media frase. En teléfono la pista sobra —ahí no hay ratón que
                pueda "hacer clic"— así que se retira por clase. */}
            <div className="px-4 sm:px-5 py-3 flex items-center justify-between gap-2 flex-wrap"
              style={{ borderBottom:'1px solid var(--divider)', background:'var(--soft-bg)' }}>
              <h3 className="section-title">Historial de Evaluaciones</h3>
              <span className="hidden sm:flex items-center gap-1.5 text-xs" style={{ color:'var(--t3)' }}>
                <Pencil size={11}/> Click en calificación para editar
              </span>
            </div>
            {/* El barrido horizontal sobre la tabla disparaba el gesto de
                "atrás" del navegador al llegar al borde. */}
            <div className="overflow-x-auto" style={{ overscrollBehaviorX:'contain' }}>
              {/* Tres niveles de ancho. En teléfono la tabla cabe entera —sin
                  Periodo ni Fecha, que se pliegan bajo la materia— y no hace
                  falta desplazarla; de `sm` en adelante se le da un mínimo
                  cómodo para que las columnas no se aplasten. */}
              <table className="w-full min-w-0 sm:min-w-[480px] lg:min-w-[560px]">
                <thead>
                  <tr style={{ borderBottom:'1px solid var(--divider)' }}>
                    <th className="table-header px-3 sm:px-4">Materia</th>
                    <th className="table-header px-3 sm:px-4">Tipo</th>
                    <th className="table-header px-3 sm:px-4">
                      <span className="sm:hidden">Calif.</span>
                      <span className="hidden sm:inline">Calificación</span>
                    </th>
                    <th className="table-header hidden sm:table-cell">Periodo</th>
                    <th className="table-header hidden sm:table-cell">Fecha</th>
                  </tr>
                </thead>
                {/* Regla de despliegue: no se vuelca el historial completo de
                    golpe. Además, así la tabla tiene por fin estado vacío —
                    antes un alumno sin evaluaciones mostraba una cabecera
                    suelta sobre nada. */}
                <ProgressiveList as="tbody" colSpan={5} items={effectiveEvals}
                  sizes={{ mobile: 5, tablet: 10, desktop: 20 }}
                  emptyLabel="Este alumno todavía no tiene evaluaciones capturadas.">
                  {e => (
                    <tr key={e.id}
                      style={{ borderBottom:'1px solid var(--divider)' }}
                      onMouseEnter={ev => ev.currentTarget.style.background='var(--soft-bg)'}
                      onMouseLeave={ev => ev.currentTarget.style.background='transparent'}>
                      <td className="table-cell px-3 sm:px-4 font-medium" style={{ color:'var(--t1)' }}>
                        {e.materia}
                        {/* Fecha y periodo no desaparecen en teléfono: bajan
                            aquí como línea secundaria, que es donde se leen sin
                            robarle ancho a la calificación. */}
                        <span className="block sm:hidden text-[11px] font-normal mt-0.5"
                          style={{ color:'var(--t3)' }}>
                          {e.fecha}{e.periodo ? ` · ${e.periodo}` : ''}
                        </span>
                      </td>
                      <td className="table-cell px-3 sm:px-4">
                        <span className="badge text-[11px] px-2 py-0.5 whitespace-nowrap"
                          style={{ background:'var(--soft-bg)', color:'var(--t2)', border:'1px solid var(--card-border)' }}>
                          {e.tipo}
                        </span>
                      </td>
                      <td className="table-cell px-3 sm:px-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
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
                      <td className="table-cell hidden sm:table-cell" style={{ color:'var(--t2)' }}>{e.periodo}</td>
                      <td className="table-cell hidden sm:table-cell text-xs" style={{ color:'var(--t3)' }}>{e.fecha}</td>
                    </tr>
                  )}
                </ProgressiveList>
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
          {/* Conteo por estado. Relleno mate —color pleno y opaco del token,
              sin alfa ni degradado— con el texto y el icono en blanco. Antes
              usaba las clases neón de `attendanceColors`, que en IPN y UNAM
              (página blanca) se veían fuera de registro. Ojo: ese mapa sigue
              alimentando la lista de sesiones de abajo y otras pantallas, por
              eso se deja intacto y aquí sólo se toma la etiqueta. */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Object.entries(attCounts).map(([k, v]) => (
              <div key={k}
                className="rounded-2xl p-5 transition-transform duration-300 hover:-translate-y-1"
                style={{
                  background: RELLENO_ASISTENCIA[k],
                  color:'#ffffff',
                  boxShadow:'0 1px 3px rgba(15,23,42,.22)',
                }}>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-2xl font-bold leading-none">{v}</p>
                  <span style={{ opacity:.9 }}>{ICONOS_ASISTENCIA[k]}</span>
                </div>
                <p className="text-xs font-medium mt-1.5" style={{ opacity:.85 }}>
                  {attendanceColors[k].label}
                </p>
              </div>
            ))}
          </div>

          <div className="card overflow-hidden">
            <div className="px-5 py-3"
              style={{ borderBottom:'1px solid var(--divider)', background:'var(--soft-bg)' }}>
              <h3 className="section-title">Registro de Asistencias (Abril 2026)</h3>
            </div>
            <div className="max-h-96 overflow-y-auto p-2 sm:p-0">
              <ProgressiveList className="divide-y" items={att}
                sizes={{ mobile: 8, tablet: 14, desktop: 24 }}
                emptyLabel="Todavía no hay sesiones registradas para este alumno.">
              {a => {
                const c = getAttendanceColor(a.status)
                return (
                  <div key={a.id}
                    className="flex items-center justify-between gap-2 px-4 sm:px-5 py-2.5 transition-colors"
                    onMouseEnter={e => e.currentTarget.style.background='var(--soft-bg)'}
                    onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                    {/* La fecha cede el ancho y la etiqueta de estado no: al
                        revés, "Justificado" se partía en dos líneas y la fila
                        crecía al doble de alto. */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${c.bg}`}>
                        <span className={`w-2 h-2 rounded-full ${c.dot}`}/>
                      </div>
                      <span className="text-sm truncate" style={{ color:'var(--t1)' }}>
                        {new Date(a.date + 'T12:00').toLocaleDateString('es-MX', {
                          weekday:'short', day:'numeric', month:'short',
                        })}
                      </span>
                    </div>
                    <span className={`badge flex-shrink-0 whitespace-nowrap ${c.bg} ${c.text} border ${c.border}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`}/>{c.label}
                    </span>
                  </div>
                )
              }}
              </ProgressiveList>
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
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background:'var(--soft-bg)', border:'1px solid var(--card-border)' }}>
                    <FileText size={16} style={{ color:'var(--t2)' }}/>
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-sm truncate" style={{ color:'var(--t1)' }}>
                      Reporte — {r.mes}
                    </h3>
                    <p className="text-xs truncate" style={{ color:'var(--t3)' }}>
                      Generado por {r.generadoPor}
                    </p>
                  </div>
                </div>
                <button onClick={() => exportMonthlyReport(s, r)}
                  className="btn-secondary text-xs py-1.5 flex-shrink-0 whitespace-nowrap">
                  <Download size={13}/>Descargar
                </button>
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
    </div>
  )
}
