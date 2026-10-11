import { BotonAyuda, CabeceraSeccion } from '../../components/ui/Ayuda'
import { useEffect, useMemo, useRef, useState } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { attendanceColors, getAttendanceColor } from '../../data/mockData'
import { statsAsistencia, colorAsistencia } from '../../lib/studentMetrics'
import { todayISO } from '../../lib/fecha'
import { useStudentData } from '../../hooks/useStudentData'
import ProgressiveList from '../../components/ui/ProgressiveList'
import KpiCard, { KpiGrid } from '../../components/ui/KpiCard'
import { IconAsistencia, IconRetardos, IconFaltas } from '../../components/ui/SigaKpiIcons'
import { useStudentTheme } from '../../context/StudentThemeContext'
import { CheckCircle2, Clock, XCircle, Calendar, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react'
import { estadoPerfil } from './EstadoPagina'

const DOW = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

/* Un estado de asistencia = un tono semántico, en TODAS las piezas de esta
   pantalla (indicadores, gráfica, semana, historial y leyenda). Antes cada
   pieza tenía su propio hex y la misma "tardanza" salía en tres tonos. */
const TONO_ESTADO = { presente: 'good', tardanza: 'warn', ausente: 'bad' }
const ICONO_ESTADO = { presente: IconAsistencia, tardanza: IconRetardos, ausente: IconFaltas }
const tonoDe = status => TONO_ESTADO[status] ?? 'neutral'
const solidoDe = status => TONO_ESTADO[status] ? `var(--${TONO_ESTADO[status]}-solid)` : 'var(--neutral-solid)'

/** Distintivo de estado: relleno pleno del tono con texto blanco (regla 2-bis). */
function EstadoBadge({ status }) {
  const c = getAttendanceColor(status)
  return (
    <span className="badge flex-shrink-0 text-white" style={{ background: solidoDe(status) }}>
      <span className="w-1.5 h-1.5 rounded-full bg-white" aria-hidden="true"/>{c.label}
    </span>
  )
}

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
    presente:    { label: 'Asistencia registrada hoy', icon: CheckCircle2, ring: 'var(--good-line)', glow: 'var(--good-soft)', color: 'var(--good)' },
    tardanza:    { label: 'Registrado hoy con retardo', icon: Clock,       ring: 'var(--warn-line)', glow: 'var(--warn-soft)', color: 'var(--warn)' },
    ausente:     { label: 'Sin registro de entrada hoy', icon: XCircle,    ring: 'var(--bad-line)',  glow: 'var(--bad-soft)',  color: 'var(--bad)' },
    pendiente:   { label: 'Aún sin registro hoy',      icon: Clock,        ring: 'var(--card-border)', glow: 'var(--soft-bg)', color: 'var(--t3)' },
  }
  const st = (record && statusMap[record.status]) || statusMap.pendiente
  const Icon = st.icon

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-3 sm:gap-4 p-4 sm:p-6">
        <div className="relative flex-shrink-0">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: st.glow, border: `1px solid ${st.ring}` }}>
            <Icon size={26} style={{ color: st.color }}/>
          </div>
          {record?.status === 'presente' && (
            <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60" style={{ background: 'var(--good)' }}/>
              <span className="relative inline-flex rounded-full h-3 w-3" style={{ background: 'var(--good)' }}/>
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
          <span className="text-xs font-bold" style={{ color: tardanzasRestantes === 2 ? 'var(--bad)' : tardanzasRestantes > 0 ? 'var(--warn)' : 'var(--t4)' }}>
            {tardanzasRestantes} / 3
            {tardanzasConvertidas > 0 && (
              <span className="ml-2 font-normal" style={{ color: 'var(--bad)' }}>
                → {tardanzasConvertidas} inasistencia{tardanzasConvertidas > 1 ? 's' : ''}
              </span>
            )}
          </span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: t.softBg }}>
          <div className="h-full rounded-full transition-all duration-500"
            style={{ width: `${(tardanzasRestantes / 3) * 100}%`, background: tardanzasRestantes === 2 ? 'var(--bad)' : 'var(--warn)' }}/>
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
        className="w-full sm:w-auto min-h-11 flex items-center justify-center sm:justify-start gap-2 text-xs font-semibold px-3 rounded-xl transition-all active:scale-95"
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
              aria-label="Mes anterior"
              className="min-w-11 min-h-11 flex items-center justify-center rounded-lg transition-colors" style={{ color: t.t3 }}
              onMouseEnter={e => e.currentTarget.style.background = t.softBg}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <ChevronLeft size={15}/>
            </button>
            <span className="text-xs font-bold capitalize" style={{ color: t.t1 }}>
              {viewMonth.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}
            </span>
            <button onClick={() => setViewMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
              aria-label="Mes siguiente"
              className="min-w-11 min-h-11 flex items-center justify-center rounded-lg transition-colors" style={{ color: t.t3 }}
              onMouseEnter={e => e.currentTarget.style.background = t.softBg}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <ChevronRight size={15}/>
            </button>
          </div>

          {/* Encabezado días */}
          <div className="grid grid-cols-7 mb-1">
            {DOW.map(d => (
              <span key={d} className="text-center text-[10px] font-bold uppercase" style={{ color: t.t4 }}>{d.slice(0, 2)}</span>
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
                  className="relative h-10 rounded-lg text-[11px] font-semibold transition-colors tabular-nums"
                  style={{
                    color: inSelWeek ? 'var(--accent-contrast)' : inMonth ? t.t2 : t.t4,
                    background: inSelWeek ? 'var(--accent)' : 'transparent',
                  }}
                  onMouseEnter={e => { if (!inSelWeek) e.currentTarget.style.background = t.softBg }}
                  onMouseLeave={e => { if (!inSelWeek) e.currentTarget.style.background = 'transparent' }}>
                  {d.getDate()}
                  {hasRecord && (
                    <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                      style={{ background: inSelWeek ? 'var(--accent-contrast)' : 'var(--good)' }}/>
                  )}
                </button>
              )
            })}
          </div>

          <button onClick={() => { onSelect(mondayOf(new Date())); setOpen(false) }}
            className="w-full mt-2 min-h-11 rounded-lg text-[11px] font-bold transition-colors"
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

  const { student: s, attendance, loading, error } = useStudentData({ withAttendance: true })
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

  const estado = estadoPerfil({ loading, student: s, error })
  if (estado) return estado
  if (!stats) return null

  const { records: att, counts, pct, tardanzasConvertidas, tardanzasRestantes } = stats
  const byDate = new Map(att.map(a => [a.date, a]))
  const sortedAtt = [...att].sort((a, b) => b.date.localeCompare(a.date))

  /* Hoy conectado al registro real del día actual */
  const todayRecord = byDate.get(todayISO()) ?? null
  const lastRecord  = sortedAtt[0]

  // Solo categorías > 0: con todos los valores en cero Recharts dibuja arcos NaN (SVG corrupto)
  const pieAll = Object.entries(counts).map(([k, v]) => ({ key: k, name: attendanceColors[k].label, value: v }))
  const COLOR_ESTADO = { presente: t.good, tardanza: t.warn, ausente: t.bad }
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

  const kpis = Object.entries(counts)

  return (
    <div className="w-full space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="page-title">Mis Asistencias</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--t3)' }}>Cada clase en la que tu docente pasó lista.</p>
        </div>
        <BotonAyuda titulo="Mis asistencias">
          <p>Aquí ves cada clase en la que tu docente pasó lista y si llegaste <b style={{ color: 'var(--good)' }}>a tiempo</b>, con <b style={{ color: 'var(--warn)' }}>retardo</b> o <b style={{ color: 'var(--bad)' }}>faltaste</b>.</p>
          <p><b>Cómo se calcula tu porcentaje:</b> cada 3 retardos cuentan como 1 falta. Para conservar la garantía del curso necesitas al menos 90 %.</p>
          <p><b>Calendario:</b> usa las flechas para cambiar de mes y toca una semana para ver su detalle.</p>
          <p>Si ves un error, avísale a tu docente: solo él puede corregir el pase de lista.</p>
        </BotonAyuda>
      </div>

      {/* Indicadores (primero): uno por estado, con su icono y su tono */}
      <KpiGrid cols={Math.min(4, Math.max(2, kpis.length))}>
        {kpis.map(([k, v]) => (
          <KpiCard key={k} icon={ICONO_ESTADO[k] ?? IconAsistencia} value={v}
            label={attendanceColors[k]?.label ?? k} tone={tonoDe(k)}
            sub={`${stats.total > 0 ? ((v / stats.total) * 100).toFixed(0) : 0}% del total`}/>
        ))}
      </KpiGrid>

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
                    {pie.map(d => <Cell key={d.key} fill={COLOR_ESTADO[d.key]}/>)}
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
              <span className="text-2xl sm:text-3xl font-bold tabular-nums" style={{ color: hasRecords ? colorAsistencia(pct) : 'var(--t4)' }}>
                {hasRecords ? `${pct}%` : '—'}
              </span>
              <span className="text-[10px]" style={{ color: t.t3 }}>{hasRecords ? 'real' : 'sin registros'}</span>
            </div>
          </div>
          <div className="space-y-1.5 mt-3">
            {pieAll.map(d => (
              <div key={d.key} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ background: COLOR_ESTADO[d.key] }}/>
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
              const isWeekend = i >= 5
              return (
                <div key={i} className="flex flex-col items-center">
                  <span className="text-[10px] font-bold uppercase mb-1.5" style={{ color: t.t4 }}>{DOW[i]}</span>
                  <div
                    title={rec ? `${getAttendanceColor(rec.status).label}${rec.time ? ' — ' + rec.time : ''}` : isWeekend ? 'Fin de semana' : 'Sin registro'}
                    className={`w-full aspect-square max-w-[52px] rounded-xl flex flex-col items-center justify-center ${rec ? 'text-white' : ''}`}
                    style={rec ? { background: solidoDe(rec.status) } : { border: '1.5px dashed var(--card-border)', color: 'var(--t4)' }}>
                    <span className="text-sm font-bold tabular-nums">{d.getDate()}</span>
                    {rec ? <div className="w-1.5 h-1.5 rounded-full mt-0.5 bg-white"/> : <span className="text-[8px] mt-0.5">—</span>}
                  </div>
                  {rec?.time && <span className="text-[8.5px] mt-1 tabular-nums" style={{ color: t.t4 }}>{rec.time}</span>}
                </div>
              )
            })}
          </div>

          <div className="flex flex-wrap gap-3 mt-4 pt-4" style={{ borderTop: `1px solid ${t.divider}` }}>
            {/* `sinRegistro` es sólo el respaldo del helper, no un estado que
                el docente capture: fuera de la leyenda. */}
            {Object.entries(attendanceColors).filter(([k]) => TONO_ESTADO[k]).map(([k, v]) => (
              <div key={k} className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--t3)' }}>
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: solidoDe(k) }}/>{v.label}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Registro completo por mes y semana */}
      <div className="card p-3 sm:p-4 space-y-3">
        <CabeceraSeccion titulo="Registro completo"
          subtitulo="Cada clase con pase de lista, agrupada por mes y semana."
          ayuda={<>
            <p>Todas las clases en las que tu docente pasó lista, de la más reciente a la más antigua, agrupadas por mes y por semana.</p>
            <p>La etiqueta de color dice cómo te registraron: <b style={{ color: 'var(--good)' }}>presente</b>, <b style={{ color: 'var(--warn)' }}>retardo</b> o <b style={{ color: 'var(--bad)' }}>falta</b>. La hora es la de tu llegada.</p>
            <p>Usa los filtros para ver solo un tipo de registro.</p>
          </>}/>
        {/* Mismos filtros en chips con contador que las listas de evaluaciones. */}
        <div className="flex gap-1.5 overflow-x-auto scroll-carril sm:flex-wrap">
          {[
            { value: 'todos',    label: 'Todos',     n: att.length },
            { value: 'presente', label: 'Presentes', n: counts.presente, tono: 'good' },
            { value: 'tardanza', label: 'Retardos',  n: counts.tardanza, tono: 'warn' },
            { value: 'ausente',  label: 'Faltas',    n: counts.ausente,  tono: 'bad' },
          ].map(o => {
            const activo = filterStatus === o.value
            return (
              <button key={o.value} type="button" aria-pressed={activo} onClick={() => setFilterStatus(o.value)}
                className="flex-shrink-0 min-h-9 inline-flex items-center gap-1.5 px-3 rounded-full text-xs font-semibold"
                style={activo
                  ? { background: 'var(--accent)', color: 'var(--accent-contrast)', border: '1px solid var(--accent)' }
                  : { background: 'var(--card-bg)', color: 'var(--t2)', border: '1px solid var(--card-border)' }}>
                {o.tono && <span className="w-2 h-2 rounded-full" style={{ background: `var(--${o.tono}-solid)` }}/>}
                {o.label}
                <span className="text-[10px] font-bold px-1.5 rounded-full tabular-nums"
                  style={activo ? { background: 'var(--accent-contrast)', color: 'var(--accent)' } : { background: 'var(--soft-bg)', color: 'var(--t3)' }}>
                  {o.n}
                </span>
              </button>
            )
          })}
        </div>

        {/* Sin caja con scroll propio: dentro del scroll de la página atrapaba
            el gesto en el teléfono. Se pagina por mes, que es el agrupamiento
            natural del historial: con el curso avanzado son decenas de días y
            en teléfono no cabe volcarlos todos. */}
        <div className="space-y-4">
          <ProgressiveList className="space-y-3"
            items={Object.entries(grouped).sort((a, b) => b[0].localeCompare(a[0]))}
            sizes={{ mobile: 1, tablet: 2, desktop: 3 }}
            emptyLabel={filterStatus === 'todos'
              ? 'Todavía no hay asistencias registradas.'
              : 'Sin registros para este filtro.'}>
          {([mKey, month]) => {
            const regs = Object.values(month.weeks).flatMap(w => w.records)
            const nMes = { presente: 0, tardanza: 0, ausente: 0 }
            regs.forEach(r => { if (nMes[r.status] !== undefined) nMes[r.status]++ })
            return (
            <section key={mKey} className="space-y-1.5 min-w-0">
              {/* Encabezado del grupo: mes + cuántas clases y cómo fueron. */}
              <div className="flex items-center gap-2 pt-1 flex-wrap">
                <h3 className="text-sm font-bold capitalize" style={{ color: 'var(--t1)' }}>{month.label}</h3>
                <span className="text-[10px] font-bold px-1.5 py-px rounded-full" style={{ background: 'var(--soft-bg)', color: 'var(--t3)', border: '1px solid var(--card-border)' }}>
                  {regs.length} clase{regs.length !== 1 ? 's' : ''}
                </span>
                <span className="ml-auto flex items-center gap-2 text-[11px] font-semibold tabular-nums">
                  <span style={{ color: 'var(--good)' }} title="Presentes">✓ {nMes.presente}</span>
                  <span style={{ color: 'var(--warn)' }} title="Retardos">◷ {nMes.tardanza}</span>
                  <span style={{ color: 'var(--bad)' }} title="Faltas">✕ {nMes.ausente}</span>
                </span>
              </div>
              {Object.entries(month.weeks).sort((a, b) => b[0].localeCompare(a[0])).map(([wKey, week]) => (
                <div key={wKey} className="space-y-1.5">
                  <p className="pt-1 text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--t3)' }}>
                    {week.label}
                  </p>
                  {week.records.map(a => {
                    const d = new Date(a.date + 'T12:00')
                    return (
                      <div key={a.date} className="flex items-center gap-3 p-2.5 rounded-xl"
                        style={{ border: '1px solid var(--divider)' }}>
                        <div className="w-10 h-10 rounded-xl flex flex-col items-center justify-center flex-shrink-0 text-white leading-none"
                          style={{ background: solidoDe(a.status) }}>
                          <span className="text-[9px] font-bold uppercase">{d.toLocaleDateString('es-MX', { weekday: 'short' }).replace('.', '')}</span>
                          <span className="text-sm font-bold tabular-nums mt-0.5">{d.getDate()}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5 min-w-0">
                            <EstadoBadge status={a.status}/>
                            <span className="text-sm font-semibold capitalize truncate" style={{ color: 'var(--t1)' }}>
                              {d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}
                            </span>
                          </span>
                          <span className="block text-[11px] mt-0.5" style={{ color: 'var(--t3)' }}>
                            {a.time ? `Llegada: ${a.time}` : a.status === 'ausente' ? 'Sin registro de llegada' : 'Hora no registrada'}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ))}
            </section>
            )
          }}
          </ProgressiveList>
        </div>
      </div>
    </div>
  )
}
