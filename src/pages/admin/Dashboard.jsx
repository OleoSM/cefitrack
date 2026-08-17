import { useState, useMemo, useEffect } from 'react'
import AvatarAlumno from '../../components/ui/AvatarAlumno'
import { useNavigate } from 'react-router-dom'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import {
  Users, TrendingUp, CalendarCheck, ClipboardList,
  AlertTriangle, CheckCircle, ArrowRight, Filter, Star, Search, RefreshCw
} from 'lucide-react'
import {
  fetchGroups, fetchStudents, fetchEvaluations,
  fetchAttendanceStats, fetchAsistenciaHoy,
} from '../../lib/supabaseData'
import { calificacionBase10 } from '../../lib/studentMetrics'
import { useAuth } from '../../context/AuthContext'
import KpiCard from '../../components/ui/KpiCard'
import { useGroupColors } from '../../hooks/useGroupColors'
import { useSucursales } from '../../hooks/useSucursales'

function FilterSelect({ value, onChange, options, style }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      className="text-xs font-semibold rounded-xl py-2 px-3 outline-none min-h-11"
      style={{ background: 'var(--soft-bg)', border: '1px solid var(--card-border)', color: 'var(--t1)', ...style }}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

// Por nombre, no por posición: al filtrar categorías vacías los índices se
// recorrían y, por ejemplo, "Ausentes" acababa pintado de verde.
const COLOR_ASISTENCIA = { Presentes:'var(--good)', Tardanzas:'var(--warn)', Ausentes:'var(--bad)' }
// Las series son por grupo: se usa el acento del propio grupo, que ya trae
// variante pastel en identidad clara. Una lista fija dejaba neones sueltos.

const MES_CORTO = m =>
  new Date(m + '-15T12:00').toLocaleDateString('es-MX', { month:'short' }).replace('.', '')

/** Evolución mensual del promedio, una serie por grupo, desde evaluaciones reales. */
function construirTendencia(evaluations, students, grupos) {
  const grupoDe = Object.fromEntries(students.map(s => [s.id, s.groupId]))
  const buckets = {}                                  // mes -> grupoId -> [notas]
  for (const e of evaluations) {
    const gid = grupoDe[e.studentId]
    if (!gid) continue
    const mes = e.fecha.slice(0, 7)
    ;((buckets[mes] ??= {})[gid] ??= []).push(calificacionBase10(e))
  }
  const data = Object.keys(buckets).sort().map(mes => {
    const fila = { mes: MES_CORTO(mes) }
    for (const g of grupos) {
      const v = buckets[mes][g.id]
      if (v?.length) fila[g.id] = +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(1)
    }
    return fila
  })
  return data
}

/* ── Tops del tablero ───────────────────────────────────────────────
   Ambas listas salen de datos REALES: la asistencia se recalcula sobre las
   sesiones capturadas (fetchAttendanceStats, misma cuenta que el perfil del
   alumno) y el promedio sobre las evaluaciones registradas. Las columnas
   students.attendance_rate y students.avg_grade quedaron obsoletas —vienen en
   null— y students.status es una etiqueta sembrada, no un cálculo. */
const UMBRAL_ASISTENCIA = 80   // % de asistencia mínimo esperado
const UMBRAL_PROMEDIO   = 7    // calificación mínima esperada

/** Promedio real por alumno a partir de sus evaluaciones, normalizadas a base 10. */
function promediosPorAlumno(evaluations) {
  const acc = {}
  for (const e of evaluations) {
    const a = (acc[e.studentId] ??= { suma: 0, n: 0 })
    a.suma += calificacionBase10(e)
    a.n += 1
  }
  return Object.fromEntries(
    Object.entries(acc).map(([id, a]) => [id, +(a.suma / a.n).toFixed(1)])
  )
}

/**
 * Índice de riesgo = cuánto le falta al alumno para llegar a los umbrales.
 * La brecha de promedio se multiplica por 10 para que ambas escalas (0–100 de
 * asistencia y 0–10 de calificación) pesen lo mismo. Sin dato no hay brecha:
 * a nadie se le acusa de riesgo por información que aún no existe.
 */
function calcularRiesgo({ asist, prom }) {
  const brechaAsist = asist === null ? 0 : Math.max(0, UMBRAL_ASISTENCIA - asist)
  const brechaProm  = prom  === null ? 0 : Math.max(0, UMBRAL_PROMEDIO - prom) * 10
  const motivos = []
  if (brechaAsist > 0) motivos.push(`Asistencia ${asist}%`)
  if (brechaProm  > 0) motivos.push(`Promedio ${prom}`)
  return { riesgo: brechaAsist + brechaProm, motivos }
}

/** Rendimiento por materia a partir de las evaluaciones capturadas. */
function construirRendimiento(evaluations) {
  const porMateria = {}
  for (const e of evaluations) {
    const n = calificacionBase10(e)
    const m = (porMateria[e.materia] ??= { materia: e.materia, notas: [], aprobados: 0, reprobados: 0 })
    m.notas.push(n)
    if (n >= 6) m.aprobados += 1; else m.reprobados += 1
  }
  return Object.values(porMateria).map(m => ({
    materia: m.materia,
    promedio: +(m.notas.reduce((a, b) => a + b, 0) / m.notas.length).toFixed(1),
    aprobados: m.aprobados,
    reprobados: m.reprobados,
  }))
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl p-3 text-xs" style={{
      background: 'var(--tooltip-bg)',
      border: '1px solid var(--tooltip-border)',
      backdropFilter: 'blur(12px)',
    }}>
      <p className="font-semibold mb-2" style={{ color: 'var(--t2)' }}>{label}</p>
      {payload.map(p => (
        <div key={p.dataKey} className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span style={{ color: 'var(--t3)' }}>{p.name}:</span>
          <span className="font-bold" style={{ color: 'var(--t1)' }}>{p.value}</span>
        </div>
      ))}
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { currentUser, allowedSucursales, canAccess } = useAuth()
  const { getAccent } = useGroupColors()
  const { sucursales: catalogoSucursales, nombreDe } = useSucursales()
  const isAdmin = currentUser?.role === 'admin'

  const [groups, setGroups]           = useState([])
  const [students, setStudents]       = useState([])
  const [evaluations, setEvaluations] = useState([])
  const [attByStudent, setAttByStudent] = useState({})
  const [hoy, setHoy]                 = useState(null)
  const [loading, setLoading]         = useState(true)
  const [loadError, setLoadError]     = useState('')
  const [reloadKey, setReloadKey]     = useState(0)

  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true); setLoadError('')
      try {
        const [gs, sts, evs] = await Promise.all([fetchGroups(), fetchStudents(), fetchEvaluations()])
        const [stats, asisHoy] = await Promise.all([
          fetchAttendanceStats(sts), fetchAsistenciaHoy(sts),
        ])
        if (!alive) return
        setGroups(gs); setStudents(sts); setEvaluations(evs)
        setAttByStudent(stats.byStudent); setHoy(asisHoy)
      } catch (error) {
        if (alive) setLoadError(error?.message || 'No fue posible cargar el resumen.')
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [reloadKey])

  const visibleGroups = useMemo(
    () => isAdmin ? groups : groups.filter(g => canAccess(g.sucursal, g.id)),
    [isAdmin, canAccess, groups]
  )
  const sucursalOptions = catalogoSucursales
    .filter(s => isAdmin || allowedSucursales.includes(s.id))
    .map(s => s.id)

  const [sucursal, setSucursal] = useState('todas')
  const [grupoId, setGrupoId]   = useState('todos')
  const [curso, setCurso]       = useState('todos')
  const [trendGroupId, setTrendGroupId] = useState('')
  const [groupQuery, setGroupQuery] = useState('')
  const [analysisView, setAnalysisView] = useState('tendencia')
  const [rankingView, setRankingView] = useState('promedio')
  const [subjectName, setSubjectName] = useState('')

  const groupsInSucursalBase = sucursal === 'todas'
    ? visibleGroups
    : visibleGroups.filter(g => g.sucursal === sucursal)
  const groupsInSucursal = curso === 'todos' ? groupsInSucursalBase : groupsInSucursalBase.filter(g=>g.curso===curso)
  const queriedGroups = groupsInSucursal.filter(g => g.name.toLocaleLowerCase('es-MX').includes(groupQuery.trim().toLocaleLowerCase('es-MX')))

  const handleSucursalChange = (val) => {
    setSucursal(val)
    setGrupoId('todos')
  }

  const selectedGroups = grupoId === 'todos'
    ? queriedGroups
    : groupsInSucursal.filter(g => g.id === grupoId)
  const selectedGroupIds = new Set(selectedGroups.map(g => g.id))

  const filteredStudents = students.filter(s => selectedGroupIds.has(s.groupId))
  const evalsFiltradas   = evaluations.filter(e => filteredStudents.some(s => s.id === e.studentId))

  // Promedio real por alumno: se calcula una vez sobre todas las evaluaciones
  // y después se filtra, para no rehacerlo con cada cambio de grupo.
  const promedioReal = useMemo(() => promediosPorAlumno(evaluations), [evaluations])

  const conMetricas = filteredStudents.map(s => ({
    ...s,
    prom:  promedioReal[s.id] ?? null,
    asist: attByStudent[s.id] ?? null,
  }))

  // Top mejor promedio: empate resuelto por asistencia real, que es
  // justamente lo que distingue a dos alumnos con la misma calificación.
  const topPromedio = conMetricas
    .filter(s => s.prom !== null)
    .sort((a, b) => b.prom - a.prom || (b.asist ?? -1) - (a.asist ?? -1))
    .slice(0, 5)

  const enRiesgo = conMetricas
    .map(s => ({ ...s, ...calcularRiesgo(s) }))
    .filter(s => s.riesgo > 0)
    .sort((a, b) => b.riesgo - a.riesgo)
  const topRiesgo = enRiesgo.slice(0, 5)

  const notas = conMetricas.map(s => s.prom).filter(Number.isFinite)
  const promedioNum = notas.length ? notas.reduce((a, b) => a + b, 0) / notas.length : null
  const promedioGeneral = promedioNum === null ? '—' : promedioNum.toFixed(1)

  useEffect(() => {
    if (selectedGroups.length === 1) {
      setTrendGroupId(selectedGroups[0].id)
      return
    }
    if (!selectedGroups.some(g => g.id === trendGroupId)) setTrendGroupId('')
  }, [selectedGroups, trendGroupId])

  // La gráfica nunca dibuja todos los grupos: con catálogos grandes las
  // series se vuelven indistinguibles. El filtro general acota el catálogo y
  // este selector permite estudiar un grupo a la vez.
  const trendGroups = useMemo(
    () => selectedGroups.filter(g => g.id === trendGroupId),
    [selectedGroups, trendGroupId]
  )
  const monthlyTrend       = useMemo(() => construirTendencia(evalsFiltradas, students, trendGroups),
                                     [evalsFiltradas, students, trendGroups])
  const subjectPerformance = useMemo(() => construirRendimiento(evalsFiltradas), [evalsFiltradas])
  useEffect(() => {
    if (!subjectPerformance.some(m => m.materia === subjectName)) setSubjectName(subjectPerformance[0]?.materia ?? '')
  }, [subjectPerformance, subjectName])
  const visibleSubjectPerformance = subjectPerformance.filter(m => m.materia === subjectName)

  // Asistencia de hoy: sin sesión registrada no se inventan porcentajes.
  const attendancePie = useMemo(() => {
    if (!hoy?.haySesion) return []
    const total = hoy.counts.presente + hoy.counts.tardanza + hoy.counts.ausente
    if (!total) return []
    const pct = v => Math.round((v / total) * 100)
    return [
      { name:'Presentes', value: pct(hoy.counts.presente) },
      { name:'Tardanzas', value: pct(hoy.counts.tardanza) },
      { name:'Ausentes',  value: pct(hoy.counts.ausente)  },
    ].filter(d => d.value > 0)
  }, [hoy])

  const presentHoy = hoy?.counts.presente ?? 0
  const esperadosHoy = hoy?.esperados ?? 0

  return (
    <div className="space-y-6">
      {loadError && (
        <div role="alert" className="card p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between" style={{borderColor:'var(--bad-line)',background:'var(--bad-soft)'}}>
          <div><p className="text-sm font-bold" style={{color:'var(--bad)'}}>No se pudo cargar el dashboard</p><p className="text-xs" style={{color:'var(--t2)'}}>{loadError}</p></div>
          <button className="btn-secondary min-h-11 inline-flex items-center justify-center gap-2" onClick={()=>setReloadKey(k=>k+1)}><RefreshCw size={15}/>Reintentar</button>
        </div>
      )}
      {/* Filtro sucursal / grupo */}
      <div className="filter-toolbar">
        <Filter size={14} style={{ color: 'var(--t3)' }} />
        <FilterSelect value={sucursal} onChange={handleSucursalChange}
          options={[{ value:'todas', label: isAdmin ? 'Todas las sucursales' : 'Mis sucursales' }, ...sucursalOptions.map(s => ({ value:s, label:nombreDe(s) }))]} />
        <FilterSelect value={curso} onChange={v=>{setCurso(v);setGrupoId('todos')}} options={[
          {value:'todos',label:'Todos los cursos'},{value:'ecoems',label:'ECOEMS'},{value:'universidad',label:'Universidad'},
        ]}/>
        <FilterSelect value={grupoId} onChange={setGrupoId}
          options={[{ value:'todos', label:'Todos los grupos' }, ...queriedGroups.map(g => ({ value:g.id, label:g.name }))]} />
        <label className="relative flex-1 min-w-[180px]" data-filter-bar>
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{color:'var(--t3)'}}/>
          <input value={groupQuery} onChange={e=>{setGroupQuery(e.target.value);setGrupoId('todos')}} placeholder="Buscar grupo por nombre"
            className="input-field w-full min-h-11 pl-9 pr-3 text-xs" aria-label="Buscar grupo por nombre"/>
        </label>
        <span className="text-[11px] whitespace-nowrap" style={{color:'var(--t3)'}}>{queriedGroups.length} resultado(s)</span>
      </div>

      {loading && <p className="card p-4 text-sm" role="status" style={{color:'var(--t2)'}}>Cargando indicadores…</p>}

      {!loading && !loadError && <>

      {/* Stats — el pill traduce el dato a un juicio rápido en vez de repetirlo */}
      <div data-kpi-grid className="grid grid-cols-2 sm:grid-cols-2 xl:grid-cols-4 gap-2.5 sm:gap-4">
        <KpiCard icon={Users} label="Total Alumnos" tone="neutral"
          value={filteredStudents.length}
          sub={`${selectedGroups.length} grupo(s) activo(s)`}
          onClick={() => navigate('/admin/alumnos')} />

        <KpiCard icon={CalendarCheck} label="Asistencia Hoy" tone="good"
          value={hoy?.haySesion ? `${presentHoy}/${esperadosHoy}` : '—'}
          sub={hoy?.haySesion ? 'Sesiones de hoy' : 'Sin lista pasada hoy'}
          pill={hoy?.haySesion
            ? { icon: CheckCircle, text: `${Math.round((presentHoy / Math.max(esperadosHoy, 1)) * 100)}% presente` }
            : null}
          onClick={() => navigate('/admin/asistencias')} />

        <KpiCard icon={TrendingUp} label="Promedio por sucursal" tone="info"
          value={sucursal === 'todas' ? '—' : promedioGeneral}
          sub={sucursal === 'todas' ? 'Selecciona una sucursal' : notas.length ? `${notas.length} alumno(s) con calificación` : 'Sin calificaciones aún'}
          pill={notas.length
            ? { icon: Star, text: promedioNum >= 8.5 ? '¡Muy bien!' : promedioNum >= 7 ? 'Aceptable' : 'Requiere atención' }
            : null}
          onClick={() => navigate('/admin/rankings')} />

        <KpiCard icon={ClipboardList} label="Alumnos en Riesgo" tone="bad"
          value={enRiesgo.length}
          sub={enRiesgo.length
            ? `Asistencia < ${UMBRAL_ASISTENCIA}% o promedio < ${UMBRAL_PROMEDIO}`
            : 'Ninguno por ahora'}
          pill={enRiesgo.length ? { icon: AlertTriangle, text: 'Dar seguimiento' } : null}
          onClick={() => navigate('/admin/alumnos')} />
      </div>

      <section className="space-y-3" aria-labelledby="analisis-title">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div><h2 id="analisis-title" className="section-title">Análisis académico</h2><p className="text-xs" style={{color:'var(--t3)'}}>Consulta una visualización a la vez.</p></div>
          <div className="filter-toolbar sm:w-auto" role="tablist" aria-label="Vista de análisis">
            {[['tendencia','Evolución'],['asistencia','Asistencia'],['materias','Materias'],['actividad','Actividad']].map(([id,label])=><button key={id} role="tab" aria-selected={analysisView===id} onClick={()=>setAnalysisView(id)} className="min-h-11 px-3 rounded-xl text-xs font-bold" style={{background:analysisView===id?'var(--accent)':'var(--soft-bg)',color:analysisView===id?'var(--accent-contrast)':'var(--t2)',border:'1px solid var(--card-border)'}}>{label}</button>)}
          </div>
        </div>

      {/* Una sola vista analítica a la vez */}
      <div className="grid grid-cols-1 gap-4">
        {/* Area chart */}
        {analysisView === 'tendencia' && <div className="card p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
            <div className="min-w-0">
              <h2 className="section-title">Evolución del Promedio</h2>
              <p className="text-xs text-slate-400 mt-0.5">Promedio mensual del grupo seleccionado</p>
            </div>
            <label className="flex flex-col gap-1 sm:items-end min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color:'var(--t3)' }}>Grupo de la gráfica</span>
              <FilterSelect value={trendGroupId} onChange={setTrendGroupId}
                options={[
                  { value:'', label: selectedGroups.length ? 'Elige un grupo' : 'Sin grupos disponibles' },
                  ...selectedGroups.map(g => ({ value:g.id, label:g.name })),
                ]}
                style={{ width:'min(100%, 230px)' }} />
            </label>
          </div>
          {!trendGroupId ? (
            <div className="flex flex-col items-center justify-center py-14 text-center gap-2">
              <Filter size={20} style={{ color:'var(--t4)' }}/>
              <p className="text-sm" style={{ color:'var(--t2)' }}>Selecciona un grupo para consultar su evolución.</p>
              <p className="text-[11px]" style={{ color:'var(--t3)' }}>Se muestra uno a la vez para mantener la gráfica legible.</p>
            </div>
          ) : monthlyTrend.length === 0 ? (
            <p className="text-sm py-16 text-center" style={{ color: 'var(--t3)' }}>
              Aún no hay calificaciones capturadas para graficar.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={230}>
              <AreaChart data={monthlyTrend} margin={{ top:5, right:10, bottom:0, left:-15 }}>
                <defs>
                  {trendGroups.map(g => (
                    <linearGradient key={g.id} id={`grad-${g.id}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={getAccent(g.id)} stopOpacity={0.18}/>
                      <stop offset="95%" stopColor={getAccent(g.id)} stopOpacity={0}/>
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--grid)" />
                <XAxis dataKey="mes" tick={{ fontSize:11, fill: 'var(--axis)' }} axisLine={false} tickLine={false} />
                <YAxis domain={[0,10]} tick={{ fontSize:11, fill: 'var(--axis)' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} wrapperStyle={{ outline:'none' }} cursor={{ stroke: 'var(--grid)', strokeWidth:1 }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize:11, paddingTop:8, color: 'var(--t2)' }} />
                {trendGroups.map(g => (
                  <Area key={g.id} type="monotone" dataKey={g.id} name={g.name}
                    stroke={getAccent(g.id)} fill={`url(#grad-${g.id})`}
                    strokeWidth={2.5} connectNulls
                    dot={{ r:3, fill:getAccent(g.id) }}
                    activeDot={{ r:4, fill:getAccent(g.id), stroke:'none' }} />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>}

        {/* Pie chart */}
        {analysisView === 'asistencia' && <div className="card p-4 sm:p-5">
          <div className="mb-4">
            <h2 className="section-title">Asistencia Hoy</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {hoy?.haySesion ? 'Sesiones registradas hoy' : 'Sin lista pasada hoy'}
            </p>
          </div>
          {attendancePie.length === 0 ? (
            <p className="text-sm py-12 text-center" style={{ color: 'var(--t3)' }}>
              Todavía no se pasa lista hoy.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={attendancePie} cx="50%" cy="50%" innerRadius={45} outerRadius={70}
                  dataKey="value" stroke="none" minAngle={2} isAnimationActive={false}>
                  {attendancePie.map(d => <Cell key={d.name} fill={COLOR_ASISTENCIA[d.name]} />)}
                </Pie>
                <Tooltip formatter={(v) => [`${v}%`]} wrapperStyle={{ outline:'none' }} contentStyle={{ fontSize:11, borderRadius:10, background:'var(--tooltip-bg)', border: '1px solid var(--tooltip-border)', color: 'var(--tooltip-text)' }} />
              </PieChart>
            </ResponsiveContainer>
          )}
          <div className="space-y-2 mt-2">
            {attendancePie.map((d, i) => (
              <div key={d.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background:COLOR_ASISTENCIA[d.name] }} />
                  <span className="text-xs" style={{ color: 'var(--t2)' }}>{d.name}</span>
                </div>
                <span className="text-xs font-bold" style={{ color: 'var(--t2)' }}>{d.value}%</span>
              </div>
            ))}
          </div>
        </div>}
      </div>

      <div className="grid grid-cols-1 gap-4">
        {/* Bar chart */}
        {analysisView === 'materias' && <div className="card p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="section-title">Rendimiento por Materia</h2>
              <p className="text-xs text-slate-400 mt-0.5">Promedio del ciclo escolar</p>
            </div>
            <FilterSelect value={subjectName} onChange={setSubjectName} options={subjectPerformance.length ? subjectPerformance.map(m=>({value:m.materia,label:m.materia})) : [{value:'',label:'Sin materias'}]} style={{width:'min(100%,230px)'}}/>
          </div>
          {subjectPerformance.length === 0 ? (
            <p className="text-sm py-16 text-center" style={{ color: 'var(--t3)' }}>
              Sin evaluaciones capturadas todavía.
            </p>
          ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={visibleSubjectPerformance} margin={{ top:5, right:10, bottom:5, left:-15 }} barSize={24} barGap={6}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--grid)" vertical={false} />
              {/* Etiqueta horizontal y recortada: rotada a -30° se desbordaba
                  del contenedor con nombres largos o con una sola materia. */}
              <XAxis dataKey="materia" tick={{ fontSize:10, fill:'var(--axis)' }}
                interval={0} textAnchor="middle" axisLine={false} tickLine={false}
                tickFormatter={v => (v.length > 14 ? `${v.slice(0, 13)}…` : v)} />
              <YAxis domain={[0,10]} tick={{ fontSize:11, fill: 'var(--axis)' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} wrapperStyle={{ outline:'none' }} cursor={{ fill: 'var(--axis)' }} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize:11, paddingTop:8, color: 'var(--t2)' }} />
              <Bar dataKey="promedio"   name="Promedio"   fill="var(--info)" radius={[4,4,0,0]} />
              <Bar dataKey="aprobados"  name="Aprobados"  fill="var(--good)" radius={[4,4,0,0]} />
              <Bar dataKey="reprobados" name="Reprobados" fill="var(--bad)" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
          )}
        </div>}

        {/* Recent activity */}
        {analysisView === 'actividad' && <div className="card p-4 sm:p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title">Actividad Reciente</h2>
            <span className="badge bg-amber-500/15 text-amber-400 border border-amber-500/30 text-[10px]">
              En progreso
            </span>
          </div>
          {/* Requiere la bitácora de auditoría (altas, bajas, cambios). Antes se
              mostraban entradas de ejemplo, que daban una falsa sensación de registro. */}
          <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
            <ClipboardList size={22} style={{ color: 'var(--t4)' }}/>
            <p className="text-xs" style={{ color: 'var(--t3)' }}>
              La bitácora de actividad aún no está conectada.
            </p>
            <p className="text-[10px]" style={{ color: 'var(--t4)' }}>
              Registrará altas, bajas, asistencias, evaluaciones y cambios administrativos.
            </p>
          </div>
        </div>}
      </div>
      </section>

      {/* Tops: mejor promedio y riesgo — ambos sobre asistencia y evaluaciones reales */}
      <section className="space-y-3" aria-labelledby="seguimiento-title">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div><h2 id="seguimiento-title" className="section-title">Seguimiento de alumnos</h2><p className="text-xs" style={{color:'var(--t3)'}}>Alterna entre desempeño y riesgo.</p></div>
          <div className="filter-toolbar sm:w-auto" role="tablist" aria-label="Vista de seguimiento">
            {[['promedio','Mejor promedio'],['riesgo','En riesgo']].map(([id,label])=><button key={id} role="tab" aria-selected={rankingView===id} onClick={()=>setRankingView(id)} className="min-h-11 px-3 rounded-xl text-xs font-bold" style={{background:rankingView===id?'var(--accent)':'var(--soft-bg)',color:rankingView===id?'var(--accent-contrast)':'var(--t2)',border:'1px solid var(--card-border)'}}>{label}</button>)}
          </div>
        </div>
      <div className="grid grid-cols-1 gap-4">
        {/* Mejor promedio */}
        {rankingView === 'promedio' && <div className="card p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="min-w-0">
              <h2 className="section-title flex items-center gap-2">
                <Star size={16} style={{ color: 'var(--warn)' }} />
                Top 5 · Mejor Promedio
              </h2>
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--t3)' }}>
                Promedio de evaluaciones capturadas · desempate por asistencia
              </p>
            </div>
            <button onClick={()=>navigate('/admin/rankings')} className="text-xs font-medium hover:underline flex items-center gap-1 flex-shrink-0 min-h-11 px-2" style={{ color: 'var(--t3)' }}>
              Ver todos <ArrowRight size={12}/>
            </button>
          </div>
          {topPromedio.length === 0 ? (
            <p className="text-sm py-10 text-center" style={{ color: 'var(--t3)' }}>
              Aún no hay calificaciones capturadas para rankear.
            </p>
          ) : (
          <div className="space-y-2">
            {topPromedio.map((s, i) => (
              <button key={s.id} onClick={()=>navigate(`/admin/alumnos/${s.id}`)}
                className="w-full grid grid-cols-[auto_minmax(0,1fr)_56px] sm:grid-cols-[auto_auto_minmax(0,1fr)_72px] items-center gap-2 sm:gap-3 p-2 sm:p-2.5 rounded-xl transition-colors text-left"
                style={{ border:'1px solid var(--divider)', background:'var(--soft-bg)' }}
                onMouseEnter={e=>e.currentTarget.style.borderColor='var(--accent)'}
                onMouseLeave={e=>e.currentTarget.style.borderColor='var(--divider)'}>
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={i === 0
                    ? { background: 'var(--warn)', color: '#fff' }
                    : { background: 'var(--soft-bg)', color: 'var(--t2)' }}>{i+1}</div>
                <span className="hidden sm:block"><AvatarAlumno student={s} size={32}/></span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: 'var(--t1)' }}>{s.name}</p>
                  <p className="text-[11px] truncate" style={{ color: 'var(--t3)' }}>{groups.find(g=>g.id===s.groupId)?.name ?? '—'}</p>
                </div>
                <div className="text-center min-w-0 rounded-xl px-1 sm:px-2 py-1.5"
                  style={{background:'var(--good-soft)',border:'1px solid var(--good-line)'}}>
                  <p className="text-base font-black" style={{ color: 'var(--good)' }}>{s.prom}</p>
                  <p className="text-[10px]" style={{ color: 'var(--t3)' }}>
                    {s.asist === null ? 'sin asist.' : `${s.asist}% asist.`}
                  </p>
                </div>
              </button>
            ))}
          </div>
          )}
        </div>}

        {/* En riesgo */}
        {rankingView === 'riesgo' && <div className="card p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="min-w-0">
              <h2 className="section-title flex items-center gap-2">
                <AlertTriangle size={16} style={{ color: 'var(--bad)' }} />
                Top 5 · Alumnos en Riesgo
              </h2>
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--t3)' }}>
                Asistencia real por debajo de {UMBRAL_ASISTENCIA}% o promedio menor a {UMBRAL_PROMEDIO}
              </p>
            </div>
            <button onClick={()=>navigate('/admin/alumnos')} className="text-xs font-medium hover:underline flex items-center gap-1 flex-shrink-0 min-h-11 px-2" style={{ color: 'var(--t3)' }}>
              Ver alumnos <ArrowRight size={12}/>
            </button>
          </div>
          {topRiesgo.length === 0 ? (
            <p className="text-sm py-10 text-center" style={{ color: 'var(--t3)' }}>
              Ningún alumno por debajo de los umbrales con los datos registrados.
            </p>
          ) : (
          <div className="space-y-2">
            {topRiesgo.map(s => (
              <button key={s.id} onClick={()=>navigate(`/admin/alumnos/${s.id}`)}
                className="w-full grid grid-cols-[auto_minmax(0,1fr)_56px] sm:grid-cols-[auto_minmax(0,1fr)_72px] items-center gap-2 sm:gap-3 p-2 sm:p-2.5 rounded-xl transition-colors text-left"
                style={{ border:'1px solid var(--bad-line)', background:'var(--bad-soft)' }}>
                <AvatarAlumno student={s} size={32}
                  style={{ background: 'var(--bad-soft)', color: 'var(--bad)', border: '1px solid var(--bad-line)' }}/>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: 'var(--t1)' }}>{s.name}</p>
                  <p className="text-[10px] truncate" style={{ color: 'var(--t3)' }}>
                    {s.motivos.join(' · ')}
                  </p>
                </div>
                <div className="text-center min-w-0 rounded-xl px-1 sm:px-2 py-1.5"
                  style={{background:'var(--card-bg)',border:'1px solid var(--bad-line)'}}>
                  <p className="text-sm font-bold" style={{ color: 'var(--bad)' }}>
                    {s.asist === null ? '—' : `${s.asist}%`}
                  </p>
                  <p className="text-[10px]" style={{ color: 'var(--t3)' }}>asistencia</p>
                </div>
              </button>
            ))}
          </div>
          )}
          {enRiesgo.length > topRiesgo.length && (
            <p className="text-[11px] mt-3 text-center" style={{ color: 'var(--t3)' }}>
              y {enRiesgo.length - topRiesgo.length} alumno(s) más por debajo de los umbrales
            </p>
          )}
        </div>}
      </div>
      </section>
      </>}
    </div>
  )
}
