import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Trophy, Medal } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell
} from 'recharts'
import { getStatusConfig } from '../../data/mockData'
import AvatarAlumno from '../../components/ui/AvatarAlumno'
import { fetchStudents, fetchGroups, fetchGroupMetrics } from '../../lib/supabaseData'
import { DataTable, DataTableRow, DataTableAvatar, SkeletonRows } from '../../components/ui/DataTable'
import ProgressiveList from '../../components/ui/ProgressiveList'
import { useConfiguracion } from '../../hooks/useConfiguracion'
import { promedioPonderado, promedioExamenes, statsAsistencia, colorCalificacion } from '../../lib/studentMetrics'
import { useSucursales } from '../../hooks/useSucursales'
import BarraFiltros from '../../components/ui/BarraFiltros'
import { useSucursalActiva, TODAS } from '../../hooks/useSucursalActiva'

/* Podio con rellenos sólidos de token: el oro y el bronce de la paleta
   `gold-*`/`amber-*` eran neón sin override y se veían fosforescentes en
   IPN/UNAM. 1.º = relleno de aviso (dorado mate), 2.º y 3.º = superficie. */
function MedalIcon({ pos }) {
  if (pos === 1) return <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background:'var(--warn-solid)', color:'#fff' }}><Trophy size={16}/></div>
  if (pos === 2) return <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background:'var(--neutral-solid)', color:'#fff' }}><Medal size={16}/></div>
  if (pos === 3) return <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background:'var(--bad-solid)', color:'#fff' }}><Medal size={14}/></div>
  return <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold" style={{ background:'var(--soft-bg)', color:'var(--t3)' }}>{pos}</div>
}

export default function Rankings() {
  const navigate = useNavigate()
  const { sucursal: sucursalFilter, setSucursal, opcionesConTodas } = useSucursalActiva()
  const [groupFilter, setGroup] = useState('all')
  const [buscaGrupo, setBuscaGrupo] = useState('')
  const { nombreDe } = useSucursales()
  const { pesos } = useConfiguracion()

  const [students, setStudents] = useState([])
  const [groups, setGroups]     = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(false)
  const [reload, setReload]     = useState(0)
  // id → { score, examenes, asisPct } calculado con el MISMO pipeline que ve
  // el alumno (promedioPonderado + pesos globales de `configuracion`).
  const [metricas, setMetricas] = useState({})
  const [calculando, setCalculando] = useState(false)

  useEffect(() => {
    let alive = true
    setLoading(true); setError(false)
    ;(async () => {
      try {
        const [sts, grs] = await Promise.all([fetchStudents(), fetchGroups()])
        if (!alive) return
        setStudents(sts)
        setGroups(grs)
      } catch { if (alive) setError(true) }
      finally { if (alive) setLoading(false) }
    })()
    return () => { alive = false }
  }, [reload])

  const groupsInSucursal = sucursalFilter === TODAS
    ? groups
    : groups.filter(g => g.sucursal === sucursalFilter)

  useEffect(() => {
    if (groupFilter !== 'all' && !groupsInSucursal.some(g => g.id === groupFilter)) setGroup('all')
  }, [sucursalFilter, groupFilter, groupsInSucursal])

  const gruposVisibles = groupFilter === 'all' ? groupsInSucursal.map(g => g.id) : [groupFilter]
  const claveGrupos = [...gruposVisibles].sort().join(',')

  /* Antes el score salía de calcularScore(avgGrade, attendanceRate): mezclaba
     tareas con exámenes, contaba la falta de datos como 0 y no aplicaba la
     regla de 3 retardos = 1 falta. Por eso el admin y el alumno veían lugares
     distintos. Ahora es el promedio ponderado oficial, grupo por grupo. */
  useEffect(() => {
    if (loading || !claveGrupos) { setMetricas({}); return }
    let alive = true
    setCalculando(true)
    Promise.all(claveGrupos.split(',').map(id => fetchGroupMetrics(id).catch(() => null)))
      .then(res => {
        if (!alive) return
        const out = {}
        for (const m of res) {
          if (!m) continue
          for (const x of m.members) {
            const evals = m.evalsByStudent[x.id] ?? []
            const attendance = m.attendanceByStudent[x.id] ?? []
            out[x.id] = {
              score: promedioPonderado(x, { evals, attendance }, pesos).promedio,
              examenes: evals.length ? promedioExamenes(evals) : null,
              asisPct: statsAsistencia(attendance).pct,
            }
          }
        }
        setMetricas(out)
      })
      .finally(() => { if (alive) setCalculando(false) })
    return () => { alive = false }
    // pesos viene de useConfiguracion: se recalcula cuando llega la de la BD
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claveGrupos, loading, pesos])

  const visibles = new Set(gruposVisibles)
  const enAlcance = students.filter(s => visibles.has(s.groupId))
  // Sin promedio no hay lugar: quien aún no tiene datos queda fuera del orden.
  const sorted = enAlcance
    .map(s => ({ ...s, ...metricas[s.id] }))
    .filter(s => s.score !== null && s.score !== undefined)
    .sort((a,b) => b.score - a.score)
  const sinDatos = enAlcance.length - sorted.length

  const chartData = sorted.slice(0,10).map(s => ({
    name: s.name.split(' ')[0],
    score: s.score,
  }))
  const cargandoTabla = loading || calculando

  const top3 = sorted.slice(0,3)

  return (
    <div className="w-full space-y-5">
      <div>
        <h1 className="page-title">Rankings</h1>
        <p className="text-sm mt-1" style={{ color:'var(--t3)' }}>
          Lugar de cada alumno según el score ponderado de exámenes, tareas y asistencia.
        </p>
      </div>
      {/* Podium top 3 */}
      <BarraFiltros
        filtros={[
          { id:'sucursal', label:'Sucursal', value:sucursalFilter, onChange:setSucursal,
            porDefecto:sucursalFilter, options:opcionesConTodas },
          { id:'grupo', label:'Grupo', tipo:'grupo', value:groupFilter, onChange:setGroup,
            porDefecto:'all', grupos:groupsInSucursal, query:buscaGrupo, onQuery:setBuscaGrupo,
            nombreDe },
        ]}
        resumen={`${sorted.length} alumno(s)${sinDatos > 0 ? ` · ${sinDatos} sin datos aún` : ''}`}/>

      {error && (
        <div role="alert" className="card p-5 flex items-center justify-between gap-3">
          <p className="text-sm" style={{ color:'var(--bad)' }}>No se pudieron cargar los alumnos.</p>
          <button type="button" className="btn-secondary" onClick={() => setReload(r => r + 1)}>Reintentar</button>
        </div>
      )}

      <div className="card p-5">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="section-title flex items-center gap-2"><Trophy size={16} style={{ color:'var(--warn)' }}/> Top 3 del Ciclo</h2>
            <p className="text-[11px] mt-1" style={{ color:'var(--t3)' }}>
              Ponderación: Exámenes {pesos.examenes}% · Tareas {pesos.tareas}% · Asistencia {pesos.asistencia}%
              <span className="hidden sm:inline"> — ajustable en Configuración</span>
            </p>
          </div>
        </div>

        {/* La barra va fuera de la cabecera del podio: es de la pantalla
            entera, no de esa tarjeta. */}

        <div className="flex items-end justify-center gap-2 sm:gap-4">
          {/* 2nd */}
          {top3[1] && (
            <div className="flex flex-col items-center gap-1.5 sm:gap-2 flex-1 max-w-[120px] sm:max-w-40">
              <AvatarAlumno student={top3[1]} size={null} redondez="rounded-2xl"
                className="w-11 h-11 sm:w-14 sm:h-14 font-bold text-base sm:text-xl"
                style={{ background:'var(--neutral-solid)', color:'#fff' }}/>
              <div className="text-center">
                <p className="text-xs sm:text-sm font-bold leading-tight" style={{ color:'var(--t1)' }}>{top3[1].name.split(' ')[0]}</p>
                <p className="text-[10px] sm:text-xs hidden sm:block" style={{ color:'var(--t3)' }}>{top3[1].name.split(' ')[1]}</p>
              </div>
              <div className="w-full rounded-t-xl h-14 sm:h-20 flex items-center justify-center"
                style={{ background:'var(--neutral-solid)' }}>
                <div className="text-center text-white">
                  <p className="text-xl sm:text-2xl font-bold">2</p>
                  <p className="text-xs font-bold">{top3[1].score}</p>
                </div>
              </div>
            </div>
          )}
          {/* 1st */}
          {top3[0] && (
            <div className="flex flex-col items-center gap-1.5 sm:gap-2 flex-1 max-w-[140px] sm:max-w-44">
              <div className="w-2 h-2 rounded-full" style={{ background:'var(--warn-solid)' }}/>
              <AvatarAlumno student={top3[0]} size={null} redondez="rounded-2xl"
                className="w-12 h-12 sm:w-16 sm:h-16 text-base sm:text-xl"
                style={{ background:'var(--warn-solid)', color:'#fff' }}/>
              <div className="text-center">
                <p className="text-xs sm:text-sm font-bold" style={{ color:'var(--t1)' }}>{top3[0].name.split(' ')[0]}</p>
                <p className="text-[10px] sm:text-xs hidden sm:block" style={{ color:'var(--t3)' }}>{top3[0].name.split(' ')[1]}</p>
              </div>
              <div className="w-full rounded-t-xl h-20 sm:h-28 flex items-center justify-center" style={{ background:'var(--warn-solid)' }}>
                <div className="text-center">
                  <Trophy size={16} className="text-white mx-auto mb-1 sm:hidden"/>
                  <Trophy size={20} className="text-white mx-auto mb-1 hidden sm:block"/>
                  <p className="text-xl sm:text-2xl font-bold text-white">1</p>
                  <p className="text-xs sm:text-sm font-bold text-white">{top3[0].score}</p>
                </div>
              </div>
            </div>
          )}
          {/* 3rd */}
          {top3[2] && (
            <div className="flex flex-col items-center gap-1.5 sm:gap-2 flex-1 max-w-[120px] sm:max-w-40">
              <AvatarAlumno student={top3[2]} size={null} redondez="rounded-2xl"
                className="w-11 h-11 sm:w-14 sm:h-14 text-base sm:text-xl"
                style={{ background:'var(--bad-solid)', color:'#fff' }}/>
              <div className="text-center">
                <p className="text-xs sm:text-sm font-bold" style={{ color:'var(--t1)' }}>{top3[2].name.split(' ')[0]}</p>
                <p className="text-[10px] sm:text-xs hidden sm:block" style={{ color:'var(--t3)' }}>{top3[2].name.split(' ')[1]}</p>
              </div>
              <div className="w-full rounded-t-xl h-10 sm:h-14 flex items-center justify-center" style={{ background:'var(--bad-solid)' }}>
                <div className="text-center text-white">
                  <p className="text-xl sm:text-2xl font-bold">3</p>
                  <p className="text-xs font-bold hidden sm:block">{top3[2].score}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bar chart */}
      <div className="card p-5">
        <h2 className="section-title mb-4">Comparativa — Top 10</h2>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} layout="vertical" margin={{ top:0, right:30, bottom:0, left:40 }} barSize={12}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--grid)" horizontal={false}/>
            <XAxis type="number" domain={[0,10]} tick={{ fontSize:11, fill:'var(--axis)' }} axisLine={false} tickLine={false}/>
            <YAxis type="category" dataKey="name" tick={{ fontSize:11, fill:'var(--axis)' }} axisLine={false} tickLine={false} width={55}/>
            <Tooltip wrapperStyle={{ outline:'none' }} cursor={{ fill:'var(--soft-bg)' }} contentStyle={{ fontSize:11, borderRadius:10, background:'var(--tooltip-bg)', border:'1px solid var(--tooltip-border)', color:'var(--tooltip-text)' }}/>
            <Bar dataKey="score" name="Score ponderado" radius={[0,4,4,0]}>
              {chartData.map((_, i) => <Cell key={i} fill={i===0?'var(--warn-solid)':i===1?'var(--neutral-solid)':i===2?'var(--bad-solid)':'var(--info)'}/>)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Full ranking table */}
      <DataTable
        columns={[
          { key:'pos',    label:'',          className:'w-10' },
          { key:'alumno', label:'Alumno',     className:'flex-grow min-w-[110px] sm:min-w-[160px]' },
          { key:'score',  label:'Score',      className:'w-16 sm:w-24' },
          { key:'grade',  label:'Promedio',   className:'w-24 hidden sm:flex' },
          { key:'att',    label:'Asistencia', className:'w-24 hidden sm:flex' },
          { key:'tasks',  label:'Tareas',     className:'w-24 hidden md:flex' },
        ]}
        isEmpty={!cargandoTabla && sorted.length === 0}
        emptyText="Aún no hay alumnos con datos para rankear.">
        {cargandoTabla ? <SkeletonRows/> : (
        <ProgressiveList items={sorted} emptyLabel="Aún no hay alumnos con datos para rankear.">
        {(s, i) => {
          const cfg        = getStatusConfig(s.status)
          return (
            <DataTableRow key={s.id} onClick={() => navigate(`/admin/alumnos/${s.id}`)}
              style={{
                borderLeft:`4px solid ${s.status==='critical'?'var(--bad)':s.status==='at-risk'?'var(--warn)':'var(--good)'}`,
              }}
              cells={[
                { className:'w-10', content:<MedalIcon pos={i+1}/> },
                {
                  className:'flex-grow min-w-[110px] sm:min-w-[160px]',
                  content:(
                    <DataTableAvatar
                      initials={s.name.split(' ').slice(0,2).map(n=>n[0]).join('')}
                      avatarSrc={s.avatarSrc}
                      name={s.name}
                      sub={
                        <span className="flex items-center gap-2">
                          <span style={{ color:'var(--t3)' }}>{groups.find(g=>g.id===s.groupId)?.name}</span>
                          <span className={`badge ${cfg.bg} ${cfg.color} border ${cfg.border} text-[10px]`}>
                            <span className="sm:hidden w-2 h-2 rounded-full bg-current" aria-label={cfg.label}/>
                            <span className="hidden sm:inline">{cfg.label}</span>
                          </span>
                        </span>
                      }
                    />
                  ),
                },
                {
                  className:'w-16 sm:w-24 flex flex-col items-start',
                  content:(
                    <>
                      <p className="font-bold" style={{ color: colorCalificacion(s.score) }}>{s.score}</p>
                      <p className="text-[10px]" style={{ color:'var(--t3)' }}>ponderado</p>
                    </>
                  ),
                },
                {
                  className:'w-24 hidden sm:flex flex-col items-start',
                  content:(
                    <>
                      <p className="font-bold" style={{ color: colorCalificacion(s.examenes) }}>{s.examenes ?? '—'}</p>
                      <p className="text-[10px]" style={{ color:'var(--t3)' }}>exámenes</p>
                    </>
                  ),
                },
                {
                  className:'w-24 hidden sm:flex flex-col items-start',
                  content:(
                    <>
                      <p className="font-bold" style={{ color:'var(--t2)' }}>
                        {s.asisPct === null || s.asisPct === undefined ? '—' : `${s.asisPct}%`}
                      </p>
                      <p className="text-[10px]" style={{ color:'var(--t3)' }}>asistencia</p>
                    </>
                  ),
                },
                {
                  className:'w-24 hidden md:flex flex-col items-start',
                  content:(
                    <>
                      <p className="font-bold" style={{ color:'var(--t2)' }}>{s.assignmentsDone}/{s.assignmentsTotal}</p>
                      <p className="text-[10px]" style={{ color:'var(--t3)' }}>tareas</p>
                    </>
                  ),
                },
              ]}
            />
          )
        }}
        </ProgressiveList>
        )}
      </DataTable>
    </div>
  )
}
