import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Trophy, TrendingUp, TrendingDown, Minus, Medal } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell
} from 'recharts'
import { students, groups, statusConfig } from '../../data/mockData'
import { DataTable, DataTableRow, DataTableAvatar } from '../../components/ui/DataTable'
import { loadSettings, calcularScore } from '../../lib/settings'

const trendIcons = {
  up:   <TrendingUp  size={14} className="text-emerald-500"/>,
  down: <TrendingDown size={14} className="text-red-500"/>,
  same: <Minus size={14} className="text-slate-400"/>,
}
const trends = ['up','same','up','down','up','up','same','down','up','same','down','up','same','down','up','up','same','down','up','same']

function MedalIcon({ pos }) {
  if (pos === 1) return <div className="w-8 h-8 rounded-full bg-gold-500 flex items-center justify-center"><Trophy size={16} className="text-white"/></div>
  if (pos === 2) return <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background:'rgba(255,255,255,.20)' }}><Medal size={16} className="text-white/70"/></div>
  if (pos === 3) return <div className="w-8 h-8 rounded-full bg-amber-700/70 flex items-center justify-center"><Medal size={14} className="text-white"/></div>
  return <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold" style={{ background:'rgba(255,255,255,.07)', color:'rgba(255,255,255,.40)' }}>{pos}</div>
}

export default function Rankings() {
  const navigate = useNavigate()
  const [groupFilter, setGroup] = useState('all')
  const { pesos } = loadSettings()

  // Lugar en el grupo = score ponderado (Exámenes / Tareas / Asistencia según Configuración)
  const sorted = [...students]
    .filter(s => groupFilter === 'all' || s.groupId === groupFilter)
    .map(s => ({ ...s, score: calcularScore(s, pesos) }))
    .sort((a,b) => b.score - a.score)

  const chartData = sorted.slice(0,10).map(s => ({
    name: s.name.split(' ')[0],
    score: s.score,
    promedio: s.avgGrade,
    asistencia: s.attendanceRate/10,
  }))

  const top3 = sorted.slice(0,3)

  return (
    <div className="max-w-5xl space-y-5">
      {/* Podium top 3 */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="section-title flex items-center gap-2"><Trophy size={18} className="text-gold-500"/> Top 3 del Ciclo</h2>
            <p className="text-[11px] mt-1" style={{ color:'rgba(255,255,255,.32)' }}>
              Ponderación: Exámenes {pesos.examenes}% · Tareas {pesos.tareas}% · Asistencia {pesos.asistencia}%
              <span className="hidden sm:inline"> — ajustable en Configuración</span>
            </p>
          </div>
          <select value={groupFilter} onChange={e=>setGroup(e.target.value)} className="input-field text-sm w-auto">
            <option value="all">Todos los grupos</option>
            {groups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>

        <div className="flex items-end justify-center gap-2 sm:gap-4">
          {/* 2nd */}
          {top3[1] && (
            <div className="flex flex-col items-center gap-1.5 sm:gap-2 flex-1 max-w-[120px] sm:max-w-40">
              <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center font-bold text-base sm:text-xl"
                style={{ background:'rgba(255,255,255,.12)', color:'rgba(255,255,255,.70)' }}>
                {top3[1].name.split(' ').slice(0,2).map(n=>n[0]).join('')}
              </div>
              <div className="text-center">
                <p className="text-xs sm:text-sm font-bold leading-tight" style={{ color:'rgba(255,255,255,.82)' }}>{top3[1].name.split(' ')[0]}</p>
                <p className="text-[10px] sm:text-xs hidden sm:block" style={{ color:'rgba(255,255,255,.35)' }}>{top3[1].name.split(' ')[1]}</p>
              </div>
              <div className="w-full rounded-t-xl h-14 sm:h-20 flex items-center justify-center"
                style={{ background:'rgba(255,255,255,.08)' }}>
                <div className="text-center">
                  <p className="text-xl sm:text-2xl font-bold" style={{ color:'rgba(255,255,255,.40)' }}>2</p>
                  <p className="text-xs font-bold" style={{ color:'rgba(255,255,255,.65)' }}>{top3[1].score}</p>
                </div>
              </div>
            </div>
          )}
          {/* 1st */}
          {top3[0] && (
            <div className="flex flex-col items-center gap-1.5 sm:gap-2 flex-1 max-w-[140px] sm:max-w-44">
              <div className="w-2 h-2 rounded-full bg-gold-500"/>
              <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-gold-500 flex items-center justify-center text-white font-bold text-base sm:text-xl ring-4 ring-gold-400/20">
                {top3[0].name.split(' ').slice(0,2).map(n=>n[0]).join('')}
              </div>
              <div className="text-center">
                <p className="text-xs sm:text-sm font-bold" style={{ color:'rgba(255,255,255,.88)' }}>{top3[0].name.split(' ')[0]}</p>
                <p className="text-[10px] sm:text-xs hidden sm:block" style={{ color:'rgba(255,255,255,.35)' }}>{top3[0].name.split(' ')[1]}</p>
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
              <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center font-bold text-base sm:text-xl bg-amber-500/20 text-amber-300">
                {top3[2].name.split(' ').slice(0,2).map(n=>n[0]).join('')}
              </div>
              <div className="text-center">
                <p className="text-xs sm:text-sm font-bold" style={{ color:'rgba(255,255,255,.82)' }}>{top3[2].name.split(' ')[0]}</p>
                <p className="text-[10px] sm:text-xs hidden sm:block" style={{ color:'rgba(255,255,255,.35)' }}>{top3[2].name.split(' ')[1]}</p>
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
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.06)" horizontal={false}/>
            <XAxis type="number" domain={[0,10]} tick={{ fontSize:11, fill:'rgba(255,255,255,.35)' }} axisLine={false} tickLine={false}/>
            <YAxis type="category" dataKey="name" tick={{ fontSize:11, fill:'rgba(255,255,255,.45)' }} axisLine={false} tickLine={false} width={55}/>
            <Tooltip wrapperStyle={{ outline:'none' }} cursor={{ fill:'rgba(255,255,255,.04)' }} contentStyle={{ fontSize:11, borderRadius:10, background:'rgba(10,10,20,.92)', border:'1px solid rgba(255,255,255,.12)', color:'rgba(255,255,255,.80)' }}/>
            <Bar dataKey="score" name="Score ponderado" radius={[0,4,4,0]}>
              {chartData.map((_, i) => <Cell key={i} fill={i===0?'#f59e0b':i===1?'#94a3b8':i===2?'#b45309':'#3b82f6'}/>)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Full ranking table */}
      <DataTable
        columns={[
          { key:'pos',    label:'',          className:'w-10' },
          { key:'alumno', label:'Alumno',     className:'flex-grow min-w-[160px]' },
          { key:'score',  label:'Score',      className:'w-24' },
          { key:'grade',  label:'Promedio',   className:'w-24 hidden sm:flex' },
          { key:'att',    label:'Asistencia', className:'w-24 hidden sm:flex' },
          { key:'tasks',  label:'Tareas',     className:'w-24 hidden md:flex' },
          { key:'trend',  label:'',           className:'w-8' },
        ]}
        isEmpty={sorted.length === 0}>
        {sorted.map((s, i) => {
          const cfg        = statusConfig[s.status]
          const trend      = trendIcons[trends[i % trends.length]]
          const gradeColor = s.avgGrade>=8.5?'text-emerald-400':s.avgGrade>=7?'text-blue-400':'text-red-400'
          return (
            <DataTableRow key={s.id} onClick={() => navigate(`/admin/alumnos/${s.id}`)}
              cells={[
                { className:'w-10', content:<MedalIcon pos={i+1}/> },
                {
                  className:'flex-grow min-w-[160px]',
                  content:(
                    <DataTableAvatar
                      initials={s.name.split(' ').slice(0,2).map(n=>n[0]).join('')}
                      name={s.name}
                      sub={
                        <span className="flex items-center gap-2">
                          <span style={{ color:'rgba(255,255,255,.32)' }}>{groups.find(g=>g.id===s.groupId)?.name}</span>
                          <span className={`badge ${cfg.bg} ${cfg.color} border ${cfg.border} text-[10px]`}>{cfg.label}</span>
                        </span>
                      }
                    />
                  ),
                },
                {
                  className:'w-24 flex flex-col items-start',
                  content:(
                    <>
                      <p className="font-bold" style={{ color: s.score>=8.5?'#34d399':s.score>=7?'#fbbf24':'#f87171' }}>{s.score}</p>
                      <p className="text-[10px]" style={{ color:'rgba(255,255,255,.30)' }}>score</p>
                    </>
                  ),
                },
                {
                  className:'w-24 hidden sm:flex flex-col items-start',
                  content:(
                    <>
                      <p className={`font-bold ${gradeColor}`}>{s.avgGrade}</p>
                      <p className="text-[10px]" style={{ color:'rgba(255,255,255,.30)' }}>promedio</p>
                    </>
                  ),
                },
                {
                  className:'w-24 hidden sm:flex flex-col items-start',
                  content:(
                    <>
                      <p className="font-bold" style={{ color:'rgba(255,255,255,.65)' }}>{s.attendanceRate}%</p>
                      <p className="text-[10px]" style={{ color:'rgba(255,255,255,.30)' }}>asistencia</p>
                    </>
                  ),
                },
                {
                  className:'w-24 hidden md:flex flex-col items-start',
                  content:(
                    <>
                      <p className="font-bold" style={{ color:'rgba(255,255,255,.65)' }}>{s.assignmentsDone}/{s.assignmentsTotal}</p>
                      <p className="text-[10px]" style={{ color:'rgba(255,255,255,.30)' }}>tareas</p>
                    </>
                  ),
                },
                { className:'w-8 flex justify-end', content:trend },
              ]}
            />
          )
        })}
      </DataTable>
    </div>
  )
}
