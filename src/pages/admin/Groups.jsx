import { useNavigate } from 'react-router-dom'
import { Users, Clock, MapPin, TrendingUp, ArrowRight } from 'lucide-react'
import { groups, students } from '../../data/mockData'

const grpColors = { g1:'bg-blue-500', g2:'bg-emerald-500', g3:'bg-amber-500' }
const grpLight  = { g1:'bg-blue-50 border-blue-200', g2:'bg-emerald-50 border-emerald-200', g3:'bg-amber-50 border-amber-200' }
const grpText   = { g1:'text-blue-700', g2:'text-emerald-700', g3:'text-amber-700' }

function GradeBar({ value }) {
  const color = value >= 8.5 ? '#10b981' : value >= 7 ? '#3b82f6' : '#f59e0b'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width:`${(value/10)*100}%`, background:color }} />
      </div>
      <span className="text-xs font-bold text-slate-700">{value}</span>
    </div>
  )
}

function AttBar({ value }) {
  const color = value >= 90 ? '#10b981' : value >= 80 ? '#3b82f6' : '#f59e0b'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width:`${value}%`, background:color }} />
      </div>
      <span className="text-xs font-bold text-slate-700">{value}%</span>
    </div>
  )
}

export default function Groups() {
  const navigate = useNavigate()
  const totalStudents = students.length

  return (
    <div className="max-w-5xl space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label:'Total Grupos',   value:groups.length },
          { label:'Total Alumnos',  value:totalStudents },
          { label:'Promedio Global',value:'8.2' },
        ].map(({ label, value }) => (
          <div key={label} className="stat-card text-center">
            <p className="text-3xl font-bold text-navy-900">{value}</p>
            <p className="text-sm text-slate-500 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Group cards */}
      <div className="grid gap-5">
        {groups.map(g => {
          const grpStudents = students.filter(s => s.groupId === g.id)
          const critical = grpStudents.filter(s => s.status === 'critical' || s.status === 'at-risk').length
          return (
            <div key={g.id} className="card hover:shadow-card-md transition-all">
              <div className="p-5">
                <div className="flex items-start gap-4">
                  {/* Color indicator */}
                  <div className={`w-12 h-12 rounded-xl ${grpColors[g.id]} flex items-center justify-center flex-shrink-0`}>
                    <span className="text-white font-bold text-lg">{g.name.split(' ')[1]}</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-base font-bold text-slate-900">{g.name}</h3>
                        <p className="text-sm text-slate-500 mt-0.5">{g.subject}</p>
                      </div>
                      {critical > 0 && (
                        <span className="badge bg-red-50 text-red-700 border border-red-200 flex-shrink-0">
                          {critical} en riesgo
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-4 mt-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1.5"><Clock size={12}/>{g.schedule}</span>
                      <span className="flex items-center gap-1.5"><MapPin size={12}/>{g.room}</span>
                      <span className="flex items-center gap-1.5"><Users size={12}/>{g.studentCount} alumnos</span>
                    </div>
                  </div>
                </div>

                {/* Metrics */}
                <div className="mt-4 grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                  <div>
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Promedio del grupo</p>
                    <GradeBar value={g.avgGrade} />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Asistencia</p>
                    <AttBar value={g.attendanceRate} />
                  </div>
                </div>

                {/* Student avatars */}
                <div className="mt-4 flex items-center justify-between">
                  <div className="flex -space-x-2">
                    {grpStudents.slice(0,6).map(s => (
                      <div key={s.id} className={`w-8 h-8 rounded-full border-2 border-white ${grpLight[g.id]} ${grpText[g.id]} flex items-center justify-center text-[10px] font-bold`}>
                        {s.name.split(' ').map(n=>n[0]).join('').slice(0,2)}
                      </div>
                    ))}
                    {grpStudents.length > 6 && (
                      <div className="w-8 h-8 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-[10px] font-semibold text-slate-500">
                        +{grpStudents.length - 6}
                      </div>
                    )}
                  </div>
                  <button onClick={() => navigate(`/admin/grupos/${g.id}`)}
                    className="btn-secondary text-xs py-1.5">
                    Ver grupo <ArrowRight size={13}/>
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
