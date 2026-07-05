import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Users, Clock, MapPin } from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { getGroupById, getStudentsByGroup, monthlyTrend, statusConfig } from '../../data/mockData'
import { useGroupColors } from '../../hooks/useGroupColors'
import GroupShaderCard from '../../components/ui/GroupShaderCard'
import { DataTable, DataTableRow, DataTableAvatar, DataTableBadge, DataTableBar } from '../../components/ui/DataTable'

const grpTrendKey = { g1:'grupoA', g2:'grupoB', g3:'grupoC' }

const COLUMNS = [
  { key:'rank',   label:'#',          className:'w-8' },
  { key:'name',   label:'Alumno',     className:'flex-grow min-w-[160px]' },
  { key:'att',    label:'Asistencia', className:'w-32 hidden sm:flex' },
  { key:'grade',  label:'Promedio',   className:'w-20' },
  { key:'tasks',  label:'Tareas',     className:'w-28 hidden md:flex' },
  { key:'status', label:'Estado',     className:'w-28' },
  { key:'action', label:'',           className:'w-16 flex justify-end' },
]

export default function GroupDetail() {
  const { groupId }   = useParams()
  const navigate      = useNavigate()
  const { getAccent } = useGroupColors()

  const grp        = getGroupById(groupId)
  const grpStudents = getStudentsByGroup(groupId)

  if (!grp) return <div style={{ color:'rgba(255,255,255,.40)' }} className="p-6">Grupo no encontrado.</div>

  const trendKey = grpTrendKey[groupId]
  const accent   = getAccent(groupId)

  const sorted = [...grpStudents].sort((a,b) => b.avgGrade - a.avgGrade)
  const attColor = r => r >= 90 ? '#34d399' : r >= 75 ? '#60a5fa' : '#f87171'
  const gradeClass = g => g >= 8.5 ? 'text-emerald-400' : g >= 7 ? 'text-blue-400' : 'text-red-400'

  return (
    <div className="max-w-5xl space-y-5">

      {/* Back */}
      <button onClick={() => navigate('/admin/grupos')}
        className="flex items-center gap-1.5 text-sm font-medium transition-colors"
        style={{ color:'rgba(255,255,255,.38)' }}
        onMouseEnter={e => e.currentTarget.style.color='white'}
        onMouseLeave={e => e.currentTarget.style.color='rgba(255,255,255,.38)'}>
        <ArrowLeft size={15}/> Regresar a Grupos
      </button>

      {/* Header card con shader */}
      <GroupShaderCard
        group={grp}
        showPicker>

        {/* Info */}
        <div>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h1 className="text-lg sm:text-xl font-bold" style={{ color:'rgba(255,255,255,.92)' }}>
                {grp.name} — {grp.subject}
              </h1>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs" style={{ color:'rgba(255,255,255,.40)' }}>
                <span className="flex items-center gap-1.5"><Clock size={12}/>{grp.schedule}</span>
                <span className="flex items-center gap-1.5"><MapPin size={12}/>{grp.room}</span>
                <span className="flex items-center gap-1.5"><Users size={12}/>{grp.studentCount} alumnos</span>
              </div>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <div className="text-center px-3 py-2 rounded-xl"
                style={{ background:'rgba(255,255,255,.07)', border:'1px solid rgba(255,255,255,.10)' }}>
                <p className="text-lg font-bold" style={{ color:'rgba(255,255,255,.90)' }}>{grp.avgGrade}</p>
                <p className="text-[10px]" style={{ color:'rgba(255,255,255,.38)' }}>Promedio</p>
              </div>
              <div className="text-center px-3 py-2 rounded-xl"
                style={{ background:'rgba(255,255,255,.07)', border:'1px solid rgba(255,255,255,.10)' }}>
                <p className="text-lg font-bold" style={{ color:'rgba(255,255,255,.90)' }}>{grp.attendanceRate}%</p>
                <p className="text-[10px]" style={{ color:'rgba(255,255,255,.38)' }}>Asistencia</p>
              </div>
            </div>
          </div>
        </div>
      </GroupShaderCard>

      {/* Trend chart */}
      <div className="card p-4 sm:p-5">
        <h2 className="section-title mb-4">Evolución del Promedio</h2>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={monthlyTrend} margin={{ top:5, right:10, bottom:0, left:-15 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.06)" />
            <XAxis dataKey="mes" tick={{ fontSize:11, fill:'rgba(255,255,255,.35)' }} axisLine={false} tickLine={false} />
            <YAxis domain={[6,10]} tick={{ fontSize:11, fill:'rgba(255,255,255,.35)' }} axisLine={false} tickLine={false} />
            <Tooltip wrapperStyle={{ outline:'none' }} cursor={{ stroke:'rgba(255,255,255,.10)', strokeWidth:1 }} contentStyle={{ fontSize:11, borderRadius:10, background:'rgba(10,10,20,.92)', border:'1px solid rgba(255,255,255,.12)', color:'rgba(255,255,255,.80)' }} />
            <Line type="monotone" dataKey={trendKey} name={grp.name} stroke={accent} strokeWidth={2.5}
              dot={{ r:4, fill:accent }} activeDot={{ r:5 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Students table */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="section-title">Alumnos del Grupo</h2>
          <button onClick={() => navigate('/admin/asistencias')} className="btn-primary text-xs py-1.5">
            Pasar lista
          </button>
        </div>

        <DataTable columns={COLUMNS} isEmpty={sorted.length === 0}>
          {sorted.map((s, i) => {
            const cfg = statusConfig[s.status]
            const ac  = attColor(s.attendanceRate)
            return (
              <DataTableRow
                key={s.id}
                onClick={() => navigate(`/admin/alumnos/${s.id}`)}
                cells={[
                  {
                    className: 'w-8',
                    content: <span className="text-xs font-mono" style={{ color:'rgba(255,255,255,.35)' }}>{i+1}</span>,
                  },
                  {
                    className: 'flex-grow min-w-[160px]',
                    content: <DataTableAvatar
                      initials={s.name.split(' ').slice(0,2).map(n=>n[0]).join('')}
                      statusColor={ac}
                      name={s.name}
                      sub={s.email}
                    />,
                  },
                  {
                    className: 'w-32 hidden sm:flex',
                    content: <DataTableBar value={s.attendanceRate} color={ac} label={`${s.attendanceRate}%`} />,
                  },
                  {
                    className: 'w-20',
                    content: <span className={`text-base font-bold ${gradeClass(s.avgGrade)}`}>{s.avgGrade}</span>,
                  },
                  {
                    className: 'w-28 hidden md:flex',
                    content: <DataTableBar value={s.assignmentsDone} max={s.assignmentsTotal} color="#60a5fa" label={`${s.assignmentsDone}/${s.assignmentsTotal}`} />,
                  },
                  {
                    className: 'w-28',
                    content: <DataTableBadge label={cfg.label} dot={cfg.dot} bg={cfg.bg} color={cfg.color} border={cfg.border} />,
                  },
                  {
                    className: 'w-16 flex justify-end',
                    content: (
                      <span className="text-xs font-semibold" style={{ color:`${accent}cc` }}>
                        Ver perfil →
                      </span>
                    ),
                  },
                ]}
              />
            )
          })}
        </DataTable>
      </div>

    </div>
  )
}
