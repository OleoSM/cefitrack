import { useAuth } from '../../context/AuthContext'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, Legend
} from 'recharts'
import { getStudentById, getEvalsByStudent } from '../../data/mockData'

export default function MyGrades() {
  const { currentUser } = useAuth()
  const s = getStudentById(currentUser?.studentId)
  const evals = getEvalsByStudent(s?.id)

  if (!s) return <div className="text-slate-500">Perfil no disponible.</div>

  // Group by materia
  const byMateria = evals.reduce((acc, e) => {
    if (!acc[e.materia]) acc[e.materia] = []
    acc[e.materia].push(e)
    return acc
  }, {})

  const materiaStats = Object.entries(byMateria).map(([mat, evs]) => ({
    materia: mat,
    promedio: +(evs.reduce((s,e)=>s+e.calificacion,0)/evs.length).toFixed(1),
    count: evs.length,
    max: Math.max(...evs.map(e=>e.calificacion)),
    min: Math.min(...evs.map(e=>e.calificacion)),
  }))

  const chartColors = materiaStats.map(m => m.promedio>=8?'#10b981':m.promedio>=6?'#3b82f6':'#f43f5e')

  return (
    <div className="max-w-4xl space-y-5">
      <div>
        <h1 className="page-title">Mis Calificaciones</h1>
        <p className="text-slate-500 text-sm mt-1">Historial completo de evaluaciones — solo lectura.</p>
      </div>

      {/* Overall average */}
      <div className="grid grid-cols-3 gap-4">
        <div className="stat-card text-center">
          <p className={`text-4xl font-bold ${s.avgGrade>=8?'text-emerald-600':s.avgGrade>=7?'text-blue-600':'text-amber-600'}`}>{s.avgGrade}</p>
          <p className="text-sm text-slate-500 mt-1">Promedio General</p>
        </div>
        <div className="stat-card text-center">
          <p className="text-4xl font-bold text-blue-600">{evals.length}</p>
          <p className="text-sm text-slate-500 mt-1">Evaluaciones</p>
        </div>
        <div className="stat-card text-center">
          <p className="text-4xl font-bold text-amber-600">{evals.filter(e=>e.calificacion<6).length}</p>
          <p className="text-sm text-slate-500 mt-1">Por debajo de 6</p>
        </div>
      </div>

      {/* Bar chart by materia */}
      <div className="card p-5">
        <h2 className="section-title mb-4">Promedio por Materia</h2>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={materiaStats} margin={{ top:5, right:10, bottom:20, left:-10 }} barSize={30}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false}/>
            <XAxis dataKey="materia" tick={{ fontSize:10, fill:'#94a3b8' }} angle={-15} textAnchor="end" axisLine={false} tickLine={false}/>
            <YAxis domain={[0,10]} tick={{ fontSize:11, fill:'#94a3b8' }} axisLine={false} tickLine={false}/>
            <Tooltip contentStyle={{ fontSize:11, borderRadius:8 }} formatter={v=>[v,'Promedio']}/>
            <Bar dataKey="promedio" radius={[6,6,0,0]}>
              {materiaStats.map((_,i)=><Cell key={i} fill={chartColors[i]}/>)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* By materia cards */}
      {Object.entries(byMateria).map(([mat, evs]) => {
        const prom = +(evs.reduce((s,e)=>s+e.calificacion,0)/evs.length).toFixed(1)
        const color = prom>=8?'border-l-emerald-500':prom>=6?'border-l-blue-500':'border-l-red-500'
        return (
          <div key={mat} className={`card overflow-hidden border-l-4 ${color}`}>
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-800">{mat}</h3>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500">{evs.length} evaluaciones</span>
                <span className={`text-lg font-bold ${prom>=8?'text-emerald-600':prom>=6?'text-blue-600':'text-red-600'}`}>{prom}</span>
              </div>
            </div>
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="table-header">Tipo</th>
                  <th className="table-header">Calificación</th>
                  <th className="table-header">Periodo</th>
                  <th className="table-header">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {evs.map(e => {
                  const c = e.calificacion>=8?'text-emerald-600':e.calificacion>=6?'text-blue-600':'text-red-600'
                  return (
                    <tr key={e.id} className="hover:bg-slate-50/50">
                      <td className="table-cell"><span className="badge bg-slate-100 text-slate-600">{e.tipo}</span></td>
                      <td className="table-cell"><span className={`font-bold text-lg ${c}`}>{e.calificacion}</span></td>
                      <td className="table-cell text-slate-500">{e.periodo}</td>
                      <td className="table-cell text-slate-500 text-xs">{e.fecha}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      })}
    </div>
  )
}
