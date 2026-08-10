import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Trophy, TrendingUp, TrendingDown, Minus, Medal } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell
} from 'recharts'
import { getStatusConfig } from '../../data/mockData'
import AvatarAlumno from '../../components/ui/AvatarAlumno'
import { fetchStudents, fetchGroups, fetchAttendanceStats } from '../../lib/supabaseData'
import { DataTable, DataTableRow, DataTableAvatar } from '../../components/ui/DataTable'
import ProgressiveList from '../../components/ui/ProgressiveList'
import { loadSettings, calcularScore } from '../../lib/settings'
import { useSucursales } from '../../hooks/useSucursales'

const trendIcons = {
  up:   <TrendingUp  size={14} className="text-emerald-500"/>,
  down: <TrendingDown size={14} className="text-red-500"/>,
  same: <Minus size={14} className="text-slate-400"/>,
}
const trends = ['up','same','up','down','up','up','same','down','up','same','down','up','same','down','up','up','same','down','up','same']

function MedalIcon({ pos }) {
  if (pos === 1) return <div className="w-8 h-8 rounded-full bg-gold-500 flex items-center justify-center"><Trophy size={16} className="text-white"/></div>
  if (pos === 2) return <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background:'var(--soft-bg)' }}><Medal size={16} className="text-white/70"/></div>
  if (pos === 3) return <div className="w-8 h-8 rounded-full bg-amber-700/70 flex items-center justify-center"><Medal size={14} className="text-white"/></div>
  return <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold" style={{ background:'var(--soft-bg)', color:'var(--t3)' }}>{pos}</div>
}

export default function Rankings() {
  const navigate = useNavigate()
  const [sucursalFilter, setSucursal] = useState('all')
  const [groupFilter, setGroup] = useState('all')
  const { sucursales, nombreDe } = useSucursales()
  const { pesos } = loadSettings()

  const [students, setStudents] = useState([])
  const [groups, setGroups]     = useState([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const [sts, grs] = await Promise.all([fetchStudents(), fetchGroups()])
        // La asistencia se recalcula de las sesiones reales, no del valor sembrado.
        const stats = await fetchAttendanceStats(sts)
        if (!alive) return
        setStudents(sts.map(s => ({ ...s, attendanceRate: stats.byStudent[s.id] ?? null })))
        setGroups(grs)
      } catch { /* se muestra la tabla vacía */ }
      finally { if (alive) setLoading(false) }
    })()
    return () => { alive = false }
  }, [])

  // Lugar en el grupo = score ponderado (Exámenes / Tareas / Asistencia según Configuración)
  const groupsInSucursal = sucursalFilter === 'all'
    ? groups
    : groups.filter(g => g.sucursal === sucursalFilter)

  useEffect(() => {
    if (groupFilter !== 'all' && !groupsInSucursal.some(g => g.id === groupFilter)) setGroup('all')
  }, [sucursalFilter, groupFilter, groupsInSucursal])

  const groupIdsInSucursal = new Set(groupsInSucursal.map(g => g.id))
  const sorted = [...students]
    .filter(s => groupIdsInSucursal.has(s.groupId))
    .filter(s => groupFilter === 'all' || s.groupId === groupFilter)
    .map(s => ({ ...s, score: calcularScore(s, pesos) }))
    .sort((a,b) => b.score - a.score)

  const chartData = sorted.slice(0,10).map(s => ({
    name: s.name.split(' ')[0],
    score: s.score,
    promedio: s.avgGrade ?? 0,
    asistencia: (s.attendanceRate ?? 0)/10,
  }))

  const top3 = sorted.slice(0,3)

  return (
    <div className="space-y-5">
      {/* Podium top 3 */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="section-title flex items-center gap-2"><Trophy size={18} className="text-gold-500"/> Top 3 del Ciclo</h2>
            <p className="text-[11px] mt-1" style={{ color:'var(--t3)' }}>
              Ponderación: Exámenes {pesos.examenes}% · Tareas {pesos.tareas}% · Asistencia {pesos.asistencia}%
              <span className="hidden sm:inline"> — ajustable en Configuración</span>
            </p>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <select value={sucursalFilter} onChange={e=>setSucursal(e.target.value)} className="input-field text-sm w-auto">
              <option value="all">Todas las sucursales</option>
              {sucursales.map(s=><option key={s.id} value={s.id}>{nombreDe(s.id)}</option>)}
            </select>
            <select value={groupFilter} onChange={e=>setGroup(e.target.value)} className="input-field text-sm w-auto">
              <option value="all">Todos los grupos</option>
              {groupsInSucursal.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
        </div>

        <div className="flex items-end justify-center gap-2 sm:gap-4">
          {/* 2nd */}
          {top3[1] && (
            <div className="flex flex-col items-center gap-1.5 sm:gap-2 flex-1 max-w-[120px] sm:max-w-40">
              <AvatarAlumno student={top3[1]} size={null} redondez="rounded-2xl"
                className="w-11 h-11 sm:w-14 sm:h-14 font-bold text-base sm:text-xl"
                style={{ background:'var(--soft-bg)', color:'var(--t1)' }}/>
              <div className="text-center">
                <p className="text-xs sm:text-sm font-bold leading-tight" style={{ color:'var(--t1)' }}>{top3[1].name.split(' ')[0]}</p>
                <p className="text-[10px] sm:text-xs hidden sm:block" style={{ color:'var(--t3)' }}>{top3[1].name.split(' ')[1]}</p>
              </div>
              <div className="w-full rounded-t-xl h-14 sm:h-20 flex items-center justify-center"
                style={{ background:'var(--soft-bg)' }}>
                <div className="text-center">
                  <p className="text-xl sm:text-2xl font-bold" style={{ color:'var(--t3)' }}>2</p>
                  <p className="text-xs font-bold" style={{ color:'var(--t2)' }}>{top3[1].score}</p>
                </div>
              </div>
            </div>
          )}
          {/* 1st */}
          {top3[0] && (
            <div className="flex flex-col items-center gap-1.5 sm:gap-2 flex-1 max-w-[140px] sm:max-w-44">
              <div className="w-2 h-2 rounded-full bg-gold-500"/>
              <AvatarAlumno student={top3[0]} size={null} redondez="rounded-2xl"
                className="w-12 h-12 sm:w-16 sm:h-16 bg-gold-500 text-white text-base sm:text-xl ring-4 ring-gold-400/20"/>
              <div className="text-center">
                <p className="text-xs sm:text-sm font-bold" style={{ color:'var(--t1)' }}>{top3[0].name.split(' ')[0]}</p>
                <p className="text-[10px] sm:text-xs hidden sm:block" style={{ color:'var(--t3)' }}>{top3[0].name.split(' ')[1]}</p>
              </div>
              <div className="w-full bg-gold-500/80 rounded-t-xl h-20 sm:h-28 flex items-center justify-center">
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
                className="w-11 h-11 sm:w-14 sm:h-14 bg-amber-500/20 text-amber-300 text-base sm:text-xl"/>
              <div className="text-center">
                <p className="text-xs sm:text-sm font-bold" style={{ color:'var(--t1)' }}>{top3[2].name.split(' ')[0]}</p>
                <p className="text-[10px] sm:text-xs hidden sm:block" style={{ color:'var(--t3)' }}>{top3[2].name.split(' ')[1]}</p>
              </div>
              <div className="w-full bg-amber-500/15 rounded-t-xl h-10 sm:h-14 flex items-center justify-center">
                <div className="text-center">
                  <p className="text-xl sm:text-2xl font-bold text-amber-400">3</p>
                  <p className="text-xs font-bold text-amber-300 hidden sm:block">{top3[2].score}</p>
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
              {chartData.map((_, i) => <Cell key={i} fill={i===0?'var(--warn)':i===1?'#94a3b8':i===2?'#b45309':'var(--info)'}/>)}
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
          { key:'trend',  label:'',           className:'w-8' },
        ]}
        isEmpty={!loading && sorted.length === 0}
        emptyText="Aún no hay alumnos con datos para rankear.">
        <ProgressiveList items={sorted} emptyLabel="Aún no hay alumnos con datos para rankear.">
        {(s, i) => {
          const cfg        = getStatusConfig(s.status)
          const trend      = trendIcons[trends[i % trends.length]]
          const gradeColor = (s.avgGrade ?? 0)>=8.5?'text-emerald-400':(s.avgGrade ?? 0)>=7?'text-blue-400':'text-red-400'
          return (
            <DataTableRow key={s.id} onClick={() => navigate(`/admin/alumnos/${s.id}`)}
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
                          <span className={`badge ${cfg.bg} ${cfg.color} border ${cfg.border} text-[10px]`}>{cfg.label}</span>
                        </span>
                      }
                    />
                  ),
                },
                {
                  className:'w-16 sm:w-24 flex flex-col items-start',
                  content:(
                    <>
                      <p className="font-bold" style={{ color: s.score>=8.5?'var(--good)':s.score>=7?'var(--warn)':'var(--bad)' }}>{s.score}</p>
                      <p className="text-[10px]" style={{ color:'var(--t3)' }}>score</p>
                    </>
                  ),
                },
                {
                  className:'w-24 hidden sm:flex flex-col items-start',
                  content:(
                    <>
                      <p className={`font-bold ${gradeColor}`}>{s.avgGrade ?? '—'}</p>
                      <p className="text-[10px]" style={{ color:'var(--t3)' }}>promedio</p>
                    </>
                  ),
                },
                {
                  className:'w-24 hidden sm:flex flex-col items-start',
                  content:(
                    <>
                      <p className="font-bold" style={{ color:'var(--t2)' }}>
                        {s.attendanceRate === null ? '—' : `${s.attendanceRate}%`}
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
                { className:'w-8 flex justify-end', content:trend },
              ]}
            />
          )
        }}
        </ProgressiveList>
      </DataTable>
    </div>
  )
}
