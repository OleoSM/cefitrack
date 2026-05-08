import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Trophy, TrendingUp, TrendingDown, Minus, Medal } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell
} from 'recharts'
import { students, groups, statusConfig } from '../../data/mockData'

const trendIcons = {
  up:   <TrendingUp  size={14} className="text-emerald-500"/>,
  down: <TrendingDown size={14} className="text-red-500"/>,
  same: <Minus size={14} className="text-slate-400"/>,
}
const trends = ['up','same','up','down','up','up','same','down','up','same','down','up','same','down','up','up','same','down','up','same']

function MedalIcon({ pos }) {
  if (pos === 1) return <div className="w-8 h-8 rounded-full bg-gold-500 flex items-center justify-center"><Trophy size={16} className="text-white"/></div>
  if (pos === 2) return <div className="w-8 h-8 rounded-full bg-slate-300 flex items-center justify-center"><Medal size={16} className="text-white"/></div>
  if (pos === 3) return <div className="w-8 h-8 rounded-full bg-amber-700 flex items-center justify-center"><Medal size={14} className="text-white"/></div>
  return <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 text-sm font-bold">{pos}</div>
}

export default function Rankings() {
  const navigate = useNavigate()
  const [groupFilter, setGroup] = useState('all')

  const sorted = [...students]
    .filter(s => groupFilter === 'all' || s.groupId === groupFilter)
    .sort((a,b) => b.avgGrade - a.avgGrade)

  const chartData = sorted.slice(0,10).map(s => ({
    name: s.name.split(' ')[0],
    promedio: s.avgGrade,
    asistencia: s.attendanceRate/10,
  }))

  const top3 = sorted.slice(0,3)

  return (
    <div className="max-w-5xl space-y-5">
      {/* Podium top 3 */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="section-title flex items-center gap-2"><Trophy size={18} className="text-gold-500"/> Top 3 del Ciclo</h2>
          <select value={groupFilter} onChange={e=>setGroup(e.target.value)} className="input-field text-sm w-auto">
            <option value="all">Todos los grupos</option>
            {groups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>

        <div className="flex items-end justify-center gap-4">
          {/* 2nd */}
          {top3[1] && (
            <div className="flex flex-col items-center gap-2 flex-1 max-w-40">
              <div className="w-14 h-14 rounded-2xl bg-slate-200 flex items-center justify-center text-slate-600 font-bold text-xl">
                {top3[1].name.split(' ').slice(0,2).map(n=>n[0]).join('')}
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-slate-800 leading-tight">{top3[1].name.split(' ')[0]}</p>
                <p className="text-xs text-slate-500">{top3[1].name.split(' ')[1]}</p>
              </div>
              <div className="w-full bg-slate-100 rounded-t-xl h-20 flex items-center justify-center">
                <div className="text-center">
                  <p className="text-2xl font-bold text-slate-500">2</p>
                  <p className="text-xs font-bold text-slate-700">{top3[1].avgGrade}</p>
                </div>
              </div>
            </div>
          )}
          {/* 1st */}
          {top3[0] && (
            <div className="flex flex-col items-center gap-2 flex-1 max-w-44">
              <div className="w-2 h-2 rounded-full bg-gold-500"/>
              <div className="w-16 h-16 rounded-2xl bg-gold-500 flex items-center justify-center text-white font-bold text-xl ring-4 ring-gold-200">
                {top3[0].name.split(' ').slice(0,2).map(n=>n[0]).join('')}
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-slate-800">{top3[0].name.split(' ')[0]}</p>
                <p className="text-xs text-slate-500">{top3[0].name.split(' ')[1]}</p>
              </div>
              <div className="w-full bg-gold-500 rounded-t-xl h-28 flex items-center justify-center">
                <div className="text-center">
                  <Trophy size={20} className="text-white mx-auto mb-1"/>
                  <p className="text-2xl font-bold text-white">1</p>
                  <p className="text-sm font-bold text-white">{top3[0].avgGrade}</p>
                </div>
              </div>
            </div>
          )}
          {/* 3rd */}
          {top3[2] && (
            <div className="flex flex-col items-center gap-2 flex-1 max-w-40">
              <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-800 font-bold text-xl">
                {top3[2].name.split(' ').slice(0,2).map(n=>n[0]).join('')}
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-slate-800">{top3[2].name.split(' ')[0]}</p>
                <p className="text-xs text-slate-500">{top3[2].name.split(' ')[1]}</p>
              </div>
              <div className="w-full bg-amber-100 rounded-t-xl h-14 flex items-center justify-center">
                <div className="text-center">
                  <p className="text-2xl font-bold text-amber-700">3</p>
                  <p className="text-xs font-bold text-amber-800">{top3[2].avgGrade}</p>
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
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false}/>
            <XAxis type="number" domain={[0,10]} tick={{ fontSize:11, fill:'#94a3b8' }} axisLine={false} tickLine={false}/>
            <YAxis type="category" dataKey="name" tick={{ fontSize:11, fill:'#475569' }} axisLine={false} tickLine={false} width={55}/>
            <Tooltip contentStyle={{ fontSize:11, borderRadius:8 }}/>
            <Bar dataKey="promedio" name="Promedio" radius={[0,4,4,0]}>
              {chartData.map((_, i) => <Cell key={i} fill={i===0?'#f59e0b':i===1?'#94a3b8':i===2?'#b45309':'#3b82f6'}/>)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Full ranking table */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
          <h2 className="section-title">Ranking Completo</h2>
        </div>
        <div className="divide-y divide-slate-50">
          {sorted.map((s, i) => {
            const cfg = statusConfig[s.status]
            const trend = trendIcons[trends[i % trends.length]]
            const gradeColor = s.avgGrade>=8.5?'text-emerald-600':s.avgGrade>=7?'text-blue-600':'text-red-600'
            return (
              <button key={s.id} onClick={()=>navigate(`/admin/alumnos/${s.id}`)}
                className="w-full flex items-center gap-4 px-5 py-3 hover:bg-slate-50 transition-colors text-left">
                <MedalIcon pos={i+1}/>
                <div className="w-9 h-9 rounded-full bg-navy-100 flex items-center justify-center text-navy-800 text-xs font-bold flex-shrink-0">
                  {s.name.split(' ').slice(0,2).map(n=>n[0]).join('')}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800">{s.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] text-slate-400">{groups.find(g=>g.id===s.groupId)?.name}</span>
                    <span className={`badge ${cfg.bg} ${cfg.color} border ${cfg.border} text-[10px]`}>
                      {cfg.label}
                    </span>
                  </div>
                </div>
                <div className="hidden sm:flex items-center gap-6 flex-shrink-0">
                  <div className="text-center">
                    <p className={`font-bold ${gradeColor}`}>{s.avgGrade}</p>
                    <p className="text-[10px] text-slate-400">promedio</p>
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-slate-700">{s.attendanceRate}%</p>
                    <p className="text-[10px] text-slate-400">asistencia</p>
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-slate-700">{s.assignmentsDone}/{s.assignmentsTotal}</p>
                    <p className="text-[10px] text-slate-400">tareas</p>
                  </div>
                </div>
                <div className="flex-shrink-0">{trend}</div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
