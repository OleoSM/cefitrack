import { useEffect, useMemo, useRef, useState } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { attendanceColors, getAttendanceColor } from '../../data/mockData'
import { statsAsistencia } from '../../lib/studentMetrics'
import { useStudentData } from '../../hooks/useStudentData'
import ProgressiveList from '../../components/ui/ProgressiveList'
import { useStudentTheme } from '../../context/StudentThemeContext'
import Dropdown from '../../components/ui/Dropdown'
import { CheckCircle2, Clock, XCircle, ShieldAlert, Calendar, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react'

const PIE_COLORS = ['#34d399', '#fbbf24', '#f87171', '#60a5fa']
const DOW = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

/* ── Helpers de fechas ── */
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const mondayOf = date => {
  const d = new Date(date)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  d.setHours(12, 0, 0, 0)
  return d
}
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }

/* ── Tarjeta de estado de HOY (conectada al registro del día actual) ── */
function TodayCard({ record, tardanzasRestantes, tardanzasConvertidas, lastRecord, t }) {
  const today = new Date()
  const dateStr = today.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  const statusMap = {
    presente:    { label: 'Asistencia registrada hoy', icon: CheckCircle2, ring: 'rgba(52,211,153,.25)', glow: 'rgba(52,211,153,.12)', color: '#34d399' },
    tardanza:    { label: 'Registrado hoy con retardo', icon: Clock,       ring: 'rgba(251,191,36,.25)', glow: 'rgba(251,191,36,.10)', color: '#fbbf24' },
    ausente:     { label: 'Sin registro de entrada hoy', icon: XCircle,    ring: 'rgba(248,113,113,.25)', glow: 'rgba(248,113,113,.08)', color: '#f87171' },
    justificado: { label: 'Ausencia justificada hoy',  icon: ShieldAlert,  ring: 'rgba(96,165,250,.25)', glow: 'rgba(96,165,250,.10)', color: '#60a5fa' },
    pendiente:   { label: 'Aún sin registro hoy',      icon: Clock,        ring: t.cardBorder,           glow: t.softBg,               color: t.t3 },
  }
  const st = record ? statusMap[record.status] : statusMap.pendiente
  const Icon = st.icon

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-4 p-5 sm:p-6">
        <div className="relative flex-shrink-0">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: st.glow, border: `1px solid ${st.ring}` }}>
            <Icon size={26} style={{ color: st.color }}/>
          </div>
          {record?.status === 'presente' && (
            <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60"/>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-400"/>
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-base sm:text-lg" style={{ color: t.t1 }}>{st.label}</p>
          <p className="text-xs sm:text-sm mt-0.5 capitalize" style={{ color: t.t3 }}>{dateStr}</p>
          {!record && lastRecord && (
            <p className="text-[11px] mt-1" style={{ color: t.t4 }}>
              Último registro: {new Date(lastRecord.date + 'T12:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })}
              {' — '}{getAttendanceColor(lastRecord.status).label.toLowerCase()}{lastRecord.time ? ` a las ${lastRecord.time}` : ''}
            </p>
          )}
        </div>
        {record?.time ? (
          <div className="flex-shrink-0 text-right">
            <p className="text-2xl sm:text-3xl font-bold tabular-nums" style={{ color: st.color }}>{record.time}</p>
            <p className="text-[10px] mt-0.5" style={{ color: t.t4 }}>hora de entrada</p>
          </div>
        ) : (
          <div className="flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold"
            style={{ background: t.softBg, color: t.t3, border: `1px solid ${t.cardBorder}` }}>
            {record ? 'Sin hora' : 'En espera'}
          </div>
        )}
      </div>

      {/* Contador de retardos */}
      <div className="px-5 sm:px-6 pb-4 pt-1">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5">
            <Clock size={12} style={{ color: t.t3 }}/>
            <span className="text-xs font-semibold" style={{ color: t.t3 }}>Retardos acumulados</span>
          </div>
          <span className="text-xs font-bold" style={{ color: tardanzasRestantes === 2 ? '#f87171' : tardanzasRestantes > 0 ? '#f59e0b' : t.t4 }}>
            {tardanzasRestantes} / 3
            {tardanzasConvertidas > 0 && (
              <span className="ml-2 font-normal" style={{ color: '#f87171' }}>
                → {tardanzasConvertidas} inasistencia{tardanzasConvertidas > 1 ? 's' : ''}
              </span>
            )}
          </span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: t.softBg }}>
          <div className="h-full rounded-full transition-all duration-500"
            style={{ width: `${(tardanzasRestantes / 3) * 100}%`, background: tardanzasRestantes === 2 ? 'linear-gradient(90deg,#fbbf24,#f87171)' : '#fbbf24' }}/>
        </div>
        <p className="text-[11px] mt-1.5" style={{ color: t.t4 }}>
          {tardanzasRestantes > 0
            ? `${3 - tardanzasRestantes} retardo${3 - tardanzasRestantes > 1 ? 's' : ''} más generan una inasistencia adicional`
            : 'Sin retardos pendientes'}
        </p>
      </div>
    </div>
  )
}

/* ── Selector de semana con calendario completo ── */
function WeekPicker({ weekStart, onSelect, recordDates, t }) {
  const [open, setOpen] = useState(false)
  const [viewMonth, setViewMonth] = useState(() => new Date(weekStart.getFullYear(), weekStart.getMonth(), 1))
  const ref = useRef(null)

  useEffect(() => {
    const close = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const weekEnd = addDays(weekStart, 6)
  const label = `${weekStart.getDate()} ${weekStart.toLocaleDateString('es-MX', { month: 'short' }).replace('.', '')} – ${weekEnd.getDate()} ${weekEnd.toLocaleDateString('es-MX', { month: 'short' }).replace('.', '')}`

  // Grid del mes visible (empezando en lunes)
  const firstDay = new Date(viewMonth)
  const gridStart = mondayOf(firstDay)
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i))
  const selStart = iso(weekStart), selEnd = iso(weekEnd)

  return (
    /* En teléfono ocupa la fila entera: el rótulo "Semana del 3 – 9 mar" no
       cabe junto al título y quedaba partido a mitad de palabra. */
    <div ref={ref} className="relative w-full sm:w-auto">
      <button onClick={() => setOpen(o => !o)} aria-expanded={open}
        className="w-full sm:w-auto flex items-center justify-center sm:justify-start gap-2 text-xs font-semibold px-3 py-2 rounded-xl transition-all active:scale-95"
        style={{ background: t.ddBg, border: `1px solid ${t.cardBorder}`, color: t.t2 }}>
        <Calendar size={13} className="flex-shrink-0"/>
        <span className="truncate">Semana del {label}</span>
        <ChevronDown size={13} className="flex-shrink-0 transition-transform duration-200" style={{ transform: open ? 'rotate(180deg)' : 'none' }}/>
      </button>

      {open && (
        /* Hasta `sm` el calendario va EN FLUJO y a ancho completo: empuja la
           semana hacia abajo en vez de flotar. Flotando no se veía —la tarjeta
           que lo contiene recorta (`.card` lleva overflow:hidden) y en una sola
           columna mide menos que el propio calendario, así que en teléfono
           quedaba cortado por abajo; además, con el botón desplazado a su
           propia línea, `right-0` sacaba el panel de 288 px por el borde
           izquierdo de la pantalla. De `sm` en adelante sí flota anclado a la
           derecha, y la tarjeta lo deja salir con `overflow-visible`. */
        <div className="mt-1.5 w-full rounded-xl p-3 animate-fade-in
                        sm:absolute sm:z-50 sm:right-0 sm:w-72 sm:max-w-[calc(100vw-2.5rem)]"
          style={{ background: t.ddPanel, border: `1px solid ${t.cardBorder}`, boxShadow: '0 18px 48px rgba(0,0,0,.30)' }}>
          {/* Nav de mes */}
          <div className="flex items-center justify-between mb-2">
            <button onClick={() => setViewMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
              className="p-1.5 rounded-lg transition-colors" style={{ color: t.t3 }}
              onMouseEnter={e => e.currentTarget.style.background = t.softBg}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <ChevronLeft size={15}/>
            </button>
            <span className="text-xs font-bold capitalize" style={{ color: t.t1 }}>
              {viewMonth.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}
            </span>
            <button onClick={() => setViewMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
              className="p-1.5 rounded-lg transition-colors" style={{ color: t.t3 }}
              onMouseEnter={e => e.currentTarget.style.background = t.softBg}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <ChevronRight size={15}/>
            </button>
          </div>

          {/* Encabezado días */}
          <div className="grid grid-cols-7 mb-1">
            {DOW.map(d => (
              <span key={d} className="text-center text-[9px] font-bold uppercase" style={{ color: t.t4 }}>{d.slice(0, 2)}</span>
            ))}
          </div>

          {/* Días — clic en cualquier día selecciona su semana */}
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map(d => {
              const dISO = iso(d)
              const inMonth = d.getMonth() === viewMonth.getMonth()
              const inSelWeek = dISO >= selStart && dISO <= selEnd
              const hasRecord = recordDates.has(dISO)
              return (
                <button key={dISO} onClick={() => { onSelect(mondayOf(d)); setOpen(false) }}
                  className="relative h-8 rounded-lg text-[11px] font-semibold transition-colors tabular-nums"
                  style={{
                    color: inSelWeek ? '#fff' : inMonth ? t.t2 : t.t4,
                    background: inSelWeek ? t.accent : 'transparent',
                  }}
                  onMouseEnter={e => { if (!inSelWeek) e.currentTarget.style.background = t.softBg }}
                  onMouseLeave={e => { if (!inSelWeek) e.currentTarget.style.background = 'transparent' }}>
                  {d.getDate()}
                  {hasRecord && (
                    <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                      style={{ background: inSelWeek ? '#fff' : '#34d399' }}/>
                  )}
                </button>
              )
            })}
          </div>

          <button onClick={() => { onSelect(mondayOf(new Date())); setOpen(false) }}
            className="w-full mt-2 py-1.5 rounded-lg text-[11px] font-bold transition-colors"
            style={{ background: t.softBg, color: t.t2, border: `1px solid ${t.cardBorder}` }}>
            Ir a la semana actual
          </button>
        </div>
      )}
    </div>
  )
}

/* ── Página principal ── */
export default function MyAttendance() {
  const { t } = useStudentTheme()
  const [filterStatus, setFilterStatus] = useState('todos')

  const { student: s, attendance } = useStudentData({ withAttendance: true })
  const stats = useMemo(() => s ? statsAsistencia(attendance) : null, [s, attendance])

  const [weekStart, setWeekStart] = useState(() => {
    // Por defecto: la semana del registro más reciente (o la actual)
    return mondayOf(new Date())
  })

  useEffect(() => {
    if (stats?.records.length) {
      const latest = [...stats.records].sort((a, b) => b.date.localeCompare(a.date))[0]
      setWeekStart(mondayOf(new Date(latest.date + 'T12:00')))
    }
  }, [stats])

  if (!s || !stats) return <div style={{ color: t.t3 }}>Perfil no disponible.</div>

  const { records: att, counts, pct, tardanzasConvertidas, tardanzasRestantes } = stats
  const byDate = new Map(att.map(a => [a.date, a]))
  const sortedAtt = [...att].sort((a, b) => b.date.localeCompare(a.date))

  /* Hoy conectado al registro real del día actual */
  const todayRecord = byDate.get(iso(new Date())) ?? null
  const lastRecord  = sortedAtt[0]

  // Solo categorías > 0: con todos los valores en cero Recharts dibuja arcos NaN (SVG corrupto)
  const pieAll = Object.entries(counts).map(([k, v]) => ({ name: attendanceColors[k].label, value: v }))
  const pie = pieAll.filter(d => d.value > 0)
  const hasRecords = pie.length > 0

  /* Semana seleccionada: exactamente 7 días */
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  /* Registro completo agrupado: mes → semana → días */
  const filtered = filterStatus === 'todos' ? sortedAtt : sortedAtt.filter(a => a.status === filterStatus)
  const grouped = filtered.reduce((acc, a) => {
    const d = new Date(a.date + 'T12:00')
    const mKey = a.date.slice(0, 7)
    const wStart = mondayOf(d)
    const wKey = iso(wStart)
    if (!acc[mKey]) acc[mKey] = { label: d.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' }), weeks: {} }
    if (!acc[mKey].weeks[wKey]) {
      const wEnd = addDays(wStart, 6)
      acc[mKey].weeks[wKey] = {
        label: `Semana del ${wStart.getDate()} al ${wEnd.getDate()}`,
        records: [],
      }
    }
    acc[mKey].weeks[wKey].records.push(a)
    return acc
  }, {})

  const attColor = pct >= 90 ? '#34d399' : pct >= 75 ? '#f59e0b' : '#f87171'

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Mis Asistencias</h1>
        <p className="text-sm mt-1" style={{ color: t.t3 }}>Registro conectado al pase de lista de tu grupo.</p>
      </div>

      {/* KPI cards (primero) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Object.entries(counts).map(([k, v]) => {
          const c = attendanceColors[k]
          return (
            <div key={k} className={`stat-card border ${c.border}`}>
              <div className="flex items-center justify-between">
                <span className={`w-2.5 h-2.5 rounded-full ${c.dot}`}/>
                <span className={`text-xs font-semibold ${c.text}`}>
                  {stats.total > 0 ? ((v / stats.total) * 100).toFixed(0) : 0}%
                </span>
              </div>
              <p className={`text-2xl sm:text-3xl font-bold mt-2 tabular-nums ${c.text}`}>{v}</p>
              <p className={`text-xs sm:text-sm font-medium mt-0.5 ${c.text}`}>{c.label}</p>
            </div>
          )
        })}
      </div>

      {/* Estado de HOY */}
      <TodayCard record={todayRecord} lastRecord={lastRecord} t={t}
        tardanzasRestantes={tardanzasRestantes} tardanzasConvertidas={tardanzasConvertidas}/>

      {/* Distribución + semana */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Pie */}
        <div className="card p-4 sm:p-5">
          <h2 className="section-title mb-3">Distribución</h2>
          <div className="relative flex justify-center">
            {hasRecords ? (
              <ResponsiveContainer width={160} height={160}>
                <PieChart>
                  <Pie data={pie} cx="50%" cy="50%" innerRadius={45} outerRadius={72} dataKey="value" stroke="none">
                    {pie.map(d => (
                      <Cell key={d.name} fill={PIE_COLORS[pieAll.findIndex(x => x.name === d.name)]}/>
                    ))}
                  </Pie>
                  <Tooltip wrapperStyle={{ outline: 'none' }}
                    contentStyle={{ fontSize: 11, borderRadius: 10, background: t.tooltipBg, border: `1px solid ${t.tooltipBorder}`, color: t.tooltipText }}/>
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-[160px] h-[160px] flex items-center justify-center">
                <div className="w-[144px] h-[144px] rounded-full" style={{ border: `14px solid ${t.softBg}` }}/>
              </div>
            )}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl sm:text-3xl font-bold tabular-nums" style={{ color: hasRecords ? attColor : t.t4 }}>
                {hasRecords ? `${pct}%` : '—'}
              </span>
              <span className="text-[10px]" style={{ color: t.t3 }}>{hasRecords ? 'real' : 'sin registros'}</span>
            </div>
          </div>
          <div className="space-y-1.5 mt-3">
            {pieAll.map((d, i) => (
              <div key={d.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ background: PIE_COLORS[i] }}/>
                  <span style={{ color: t.t2 }}>{d.name}</span>
                </div>
                <span className="font-bold tabular-nums" style={{ color: t.t1 }}>{d.value}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 text-[11px]" style={{ borderTop: `1px solid ${t.divider}`, color: t.t4 }}>
            % real incluye {tardanzasConvertidas} inasistencia{tardanzasConvertidas !== 1 ? 's' : ''} por retardos (3→1)
          </div>
        </div>

        {/* Semana de 7 días con selector de calendario.
            `overflow-visible` anula el recorte de `.card`: el calendario del
            selector es más alto que esta tarjeta cuando la rejilla va a una
            sola columna, y sin esto se veía cortado a media rejilla. */}
        <div className="card overflow-visible p-4 sm:p-5 xl:col-span-2">
          <div className="flex items-center justify-between gap-2 sm:gap-3 flex-wrap mb-4">
            <h2 className="section-title">Registro por Semana</h2>
            <WeekPicker weekStart={weekStart} onSelect={setWeekStart}
              recordDates={new Set(att.map(a => a.date))} t={t}/>
          </div>

          <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
            {weekDays.map((d, i) => {
              const rec = byDate.get(iso(d))
              const c = rec ? getAttendanceColor(rec.status) : null
              const isWeekend = i >= 5
              return (
                <div key={i} className="flex flex-col items-center">
                  <span className="text-[9px] sm:text-[10px] font-bold uppercase mb-1.5" style={{ color: t.t4 }}>{DOW[i]}</span>
                  <div
                    title={rec ? `${getAttendanceColor(rec.status).label}${rec.time ? ' — ' + rec.time : ''}` : isWeekend ? 'Fin de semana' : 'Sin registro'}
                    className={`w-full aspect-square max-w-[52px] rounded-xl flex flex-col items-center justify-center ${rec ? `${c.bg} ${c.text}` : ''}`}
                    style={!rec ? { border: `1.5px dashed ${t.cardBorder}`, color: t.t4 } : {}}>
                    <span className="text-sm font-bold tabular-nums">{d.getDate()}</span>
                    {rec ? <div className={`w-1.5 h-1.5 rounded-full ${c.dot} mt-0.5`}/> : <span className="text-[8px] mt-0.5">—</span>}
                  </div>
                  {rec?.time && <span className="text-[8.5px] mt-1 tabular-nums" style={{ color: t.t4 }}>{rec.time}</span>}
                </div>
              )
            })}
          </div>

          <div className="flex flex-wrap gap-3 mt-4 pt-4" style={{ borderTop: `1px solid ${t.divider}` }}>
            {/* `sinRegistro` es sólo el respaldo del helper, no un estado que
                el docente capture: fuera de la leyenda. */}
            {Object.entries(attendanceColors).filter(([k]) => k !== 'sinRegistro').map(([k, v]) => (
              <div key={k} className="flex items-center gap-1.5 text-xs" style={{ color: t.t3 }}>
                <span className={`w-2.5 h-2.5 rounded-full ${v.dot}`}/>{v.label}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Registro completo por mes y semana */}
      <div>
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <h2 className="section-title">Registro Completo</h2>
          <Dropdown value={filterStatus} onChange={setFilterStatus} align="right"
            options={[
              { value: 'todos',       label: 'Todos' },
              { value: 'presente',    label: 'Presentes' },
              { value: 'tardanza',    label: 'Retardos' },
              { value: 'ausente',     label: 'Ausencias' },
              { value: 'justificado', label: 'Justificados' },
            ]}/>
        </div>

        <div className="max-h-[480px] overflow-y-auto space-y-4 pr-1">
          {Object.keys(grouped).length === 0 && (
            <div className="card p-8 text-center text-sm" style={{ color: t.t4 }}>Sin registros para este filtro.</div>
          )}
          {/* Se pagina por mes, que es el agrupamiento natural del historial:
              con el curso avanzado son decenas de días y en teléfono no cabe
              volcarlos todos. */}
          <ProgressiveList className="space-y-3"
            items={Object.entries(grouped).sort((a, b) => b[0].localeCompare(a[0]))}
            sizes={{ mobile: 1, tablet: 2, desktop: 3 }}
            emptyLabel="Todavía no hay asistencias registradas.">
          {([mKey, month]) => (
            <div key={mKey} className="card overflow-hidden">
              <div className="px-4 py-2.5 capitalize font-bold text-sm"
                style={{ background: t.softBg, borderBottom: `1px solid ${t.divider}`, color: t.t1 }}>
                {month.label}
              </div>
              {Object.entries(month.weeks).sort((a, b) => b[0].localeCompare(a[0])).map(([wKey, week]) => (
                <div key={wKey}>
                  <p className="px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-widest" style={{ color: t.t4 }}>
                    {week.label}
                  </p>
                  {week.records.map(a => {
                    const c = getAttendanceColor(a.status)
                    const d = new Date(a.date + 'T12:00')
                    return (
                      <div key={a.date} className="px-4 py-2.5 flex items-center gap-3"
                        style={{ borderBottom: `1px solid ${t.divider}` }}>
                        <div className={`w-8 h-8 rounded-lg ${c.bg} flex items-center justify-center flex-shrink-0`}>
                          <span className={`text-[10px] font-bold uppercase ${c.text}`}>
                            {d.toLocaleDateString('es-MX', { weekday: 'short' }).slice(0, 2)}
                          </span>
                        </div>
                        <p className="flex-1 text-xs sm:text-sm font-medium capitalize truncate" style={{ color: t.t2 }}>
                          {d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </p>
                        <span className="text-xs font-semibold tabular-nums hidden sm:block" style={{ color: t.t3 }}>
                          {a.time ?? '—'}
                        </span>
                        <span className={`badge ${c.bg} ${c.text} border ${c.border} flex-shrink-0`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`}/>{c.label}
                        </span>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          )}
          </ProgressiveList>
        </div>
      </div>
    </div>
  )
}
