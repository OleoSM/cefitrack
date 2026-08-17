import { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Users, Clock, MapPin, UserPlus, TrendingUp, CalendarCheck, AlertTriangle } from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { getStatusConfig } from '../../data/mockData'
import {
  fetchGroupById, fetchStudents, fetchGroups, fetchAttendanceStats,
  fetchGroupMetrics, computeGroupStats,
} from '../../lib/supabaseData'
import { calificacionBase10 } from '../../lib/studentMetrics'
import { useGroupColors } from '../../hooks/useGroupColors'
import GroupShaderCard from '../../components/ui/GroupShaderCard'
import { DataTable, DataTableRow, DataTableAvatar, DataTableBadge, DataTableBar } from '../../components/ui/DataTable'
import StudentFormModal from '../../components/admin/StudentFormModal'
import CredentialsPanel from '../../components/admin/CredentialsPanel'
import KpiCard from '../../components/ui/KpiCard'

const COLUMNS = [
  { key:'rank',   label:'#',          className:'w-8' },
  { key:'name',   label:'Alumno',     className:'flex-grow min-w-[110px] sm:min-w-[140px]' },
  { key:'att',    label:'Asistencia', className:'w-32 hidden md:flex' },
  { key:'grade',  label:'Promedio',   className:'w-16 sm:w-20' },
  { key:'tasks',  label:'Tareas',     className:'w-28 hidden md:flex' },
  { key:'status', label:'Estado',     className:'w-28 hidden md:flex' },
  { key:'action', label:'',           className:'w-16 flex justify-end' },
]

/** Evolución mensual del promedio del grupo a partir de sus evaluaciones reales. */
function buildTrend(evalsByStudent) {
  const buckets = {}
  for (const evs of Object.values(evalsByStudent)) {
    for (const e of evs) {
      const mes = e.fecha.slice(0, 7)
      ;(buckets[mes] ??= []).push(calificacionBase10(e))
    }
  }
  return Object.keys(buckets).sort().map(mes => ({
    mes: new Date(mes + '-15T12:00').toLocaleDateString('es-MX', { month:'short' }).replace('.', ''),
    promedio: +(buckets[mes].reduce((a, b) => a + b, 0) / buckets[mes].length).toFixed(1),
  }))
}

export default function GroupDetail() {
  const { groupId }   = useParams()
  const navigate      = useNavigate()
  const { getAccent } = useGroupColors()

  const [grp, setGrp]           = useState(null)
  const [students, setStudents] = useState([])
  const [attByStudent, setAtt]  = useState({})
  const [attByGroup, setAttGrp] = useState({})
  const [metrics, setMetrics]   = useState(null)
  const [loading, setLoading]   = useState(true)
  const [showAddStudent, setShowAddStudent] = useState(false)
  const [allGroups, setAllGroups] = useState([])
  const [lastCred, setLastCred] = useState(null)

  const load = useCallback(async () => {
    try {
      const [g, allStudents, m, grs] = await Promise.all([
        fetchGroupById(groupId), fetchStudents(), fetchGroupMetrics(groupId), fetchGroups(),
      ])
      const stats = await fetchAttendanceStats(allStudents)
      setGrp(g)
      setStudents(allStudents.filter(s => s.groupId === groupId))
      setAtt(stats.byStudent)
      setAttGrp(stats.byGroup)
      setMetrics(m)
      setAllGroups(grs)
    } catch { /* se muestra el estado vacío */ }
    finally { setLoading(false) }
  }, [groupId])

  useEffect(() => { load() }, [load])

  const trend = useMemo(
    () => metrics ? buildTrend(metrics.evalsByStudent) : [],
    [metrics],
  )

  if (loading) return <div style={{ color:'var(--t3)' }} className="p-6">Cargando grupo…</div>
  if (!grp) return <div style={{ color:'var(--t3)' }} className="p-6">Grupo no encontrado.</div>

  const accent = getAccent(groupId)
  const stats  = computeGroupStats(grp, students, attByGroup)

  const sorted = [...students].sort((a, b) => (b.avgGrade ?? 0) - (a.avgGrade ?? 0))
  const attColor = r => r >= 90 ? 'var(--good)' : r >= 75 ? 'var(--info)' : 'var(--bad)'
  const gradeClass = g => g >= 8.5 ? 'text-emerald-400' : g >= 7 ? 'text-blue-400' : 'text-red-400'

  return (
    <div className="flex flex-col gap-5">

      {/* Header card con shader */}
      <GroupShaderCard
        group={grp}
        showPicker>

        {/* Info */}
        <div>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h1 className="text-lg sm:text-xl font-bold" style={{ color:'var(--t1)' }}>
                {grp.name} — {grp.subject}
              </h1>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs" style={{ color:'var(--t3)' }}>
                {grp.schedule && <span className="flex items-center gap-1.5"><Clock size={12}/>{grp.schedule}</span>}
                {grp.room && <span className="flex items-center gap-1.5"><MapPin size={12}/>{grp.room}</span>}
                <span className="flex items-center gap-1.5"><Users size={12}/>{stats.studentCount} alumnos</span>
              </div>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <div className="text-center px-3 py-2 rounded-xl"
                style={{ background:'var(--soft-bg)', border:'1px solid var(--card-border)' }}>
                <p className="text-lg font-bold" style={{ color:'var(--t1)' }}>{stats.avgGrade ?? '—'}</p>
                <p className="text-[10px]" style={{ color:'var(--t3)' }}>Promedio</p>
              </div>
              <div className="text-center px-3 py-2 rounded-xl"
                style={{ background:'var(--soft-bg)', border:'1px solid var(--card-border)' }}>
                <p className="text-lg font-bold" style={{ color:'var(--t1)' }}>
                  {stats.attendanceRate === null ? '—' : `${stats.attendanceRate}%`}
                </p>
                <p className="text-[10px]" style={{ color:'var(--t3)' }}>Asistencia</p>
              </div>
            </div>
          </div>
        </div>
      </GroupShaderCard>

      <div data-kpi-grid className="grid grid-cols-2 xl:grid-cols-4 gap-3 order-2">
        <KpiCard icon={TrendingUp} label="Promedio general" value={stats.avgGrade ?? '—'} tone="good" sub="Evaluaciones registradas"/>
        <KpiCard icon={CalendarCheck} label="Asistencia" value={stats.attendanceRate === null ? '—' : `${stats.attendanceRate}%`} tone="info" sub="Acumulado del grupo"/>
        <KpiCard icon={Clock} label="Siguiente clase" value={grp.schedule || 'Por definir'} tone="neutral" sub="Editable desde el grupo"/>
        <KpiCard icon={AlertTriangle} label="Requieren atención" value={students.filter(s=>['critical','at-risk'].includes(s.status)).length} tone="warn" sub={`De ${students.length} alumnos`}/>
      </div>

      {/* Trend chart */}
      <div className="card p-4 sm:p-5 order-4">
        <h2 className="section-title mb-4">Evolución del Promedio</h2>
        {trend.length === 0 ? (
          <p className="text-sm py-8 text-center" style={{ color:'var(--t3)' }}>
            Aún no hay calificaciones capturadas para este grupo.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={trend} margin={{ top:5, right:10, bottom:0, left:-15 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--grid)" />
              <XAxis dataKey="mes" tick={{ fontSize:11, fill:'var(--axis)' }} axisLine={false} tickLine={false} />
              <YAxis domain={[0,10]} tick={{ fontSize:11, fill:'var(--axis)' }} axisLine={false} tickLine={false} />
              <Tooltip wrapperStyle={{ outline:'none' }} cursor={{ stroke:'var(--grid)', strokeWidth:1 }} contentStyle={{ fontSize:11, borderRadius:10, background:'var(--tooltip-bg)', border:'1px solid var(--tooltip-border)', color:'var(--tooltip-text)' }} />
              <Line type="monotone" dataKey="promedio" name={grp.name} stroke={accent} strokeWidth={2.5}
                dot={{ r:4, fill:accent }} activeDot={{ r:5 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {showAddStudent && (
        <StudentFormModal
          groups={allGroups}
          defaultGroupId={groupId}
          onClose={() => setShowAddStudent(false)}
          onSaved={cred => { if (cred) setLastCred(cred); load() }}
        />
      )}

      {lastCred && <CredentialsPanel cred={lastCred} onClose={() => setLastCred(null)}/>}

      {/* Students table */}
      <div className="order-3">
        <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
          <h2 className="section-title">Alumnos del Grupo</h2>
          <div className="flex gap-2">
            <button onClick={() => setShowAddStudent(true)} className="btn-secondary text-xs py-1.5">
              <UserPlus size={13}/> Añadir alumno
            </button>
            <button onClick={() => navigate('/admin/asistencias')} className="btn-primary text-xs py-1.5">
              Pasar lista
            </button>
          </div>
        </div>

        <DataTable columns={COLUMNS} isEmpty={sorted.length === 0}
          emptyText="Este grupo todavía no tiene alumnos asignados.">
          {sorted.map((s, i) => {
            const cfg = getStatusConfig(s.status)
            const rate = attByStudent[s.id]
            const ac  = attColor(rate ?? 0)
            return (
              <DataTableRow
                key={s.id}
                onClick={() => navigate(`/admin/alumnos/${s.id}`)}
                cells={[
                  {
                    className: 'w-8',
                    content: <span className="text-xs font-mono" style={{ color:'var(--t3)' }}>{i+1}</span>,
                  },
                  {
                    className: 'flex-grow min-w-[110px] sm:min-w-[140px]',
                    content: <DataTableAvatar
                      initials={s.name.split(' ').slice(0,2).map(n=>n[0]).join('')}
                      avatarSrc={s.avatarSrc}
                      statusColor={ac}
                      name={s.name}
                      sub={s.email}
                    />,
                  },
                  {
                    className: 'w-32 hidden md:flex',
                    content: rate === null || rate === undefined
                      ? <span className="text-xs" style={{ color:'var(--t3)' }}>Sin sesiones</span>
                      : <DataTableBar value={rate} color={ac} label={`${rate}%`} />,
                  },
                  {
                    className: 'w-16 sm:w-20',
                    content: Number.isFinite(s.avgGrade)
                      ? <span className={`text-sm sm:text-base font-bold ${gradeClass(s.avgGrade)}`}>{s.avgGrade}</span>
                      : <span className="text-sm" style={{ color:'var(--t3)' }}>—</span>,
                  },
                  {
                    className: 'w-28 hidden md:flex',
                    content: s.assignmentsTotal > 0
                      ? <DataTableBar value={s.assignmentsDone} max={s.assignmentsTotal} color="var(--info)" label={`${s.assignmentsDone}/${s.assignmentsTotal}`} />
                      : <span className="text-xs" style={{ color:'var(--t3)' }}>—</span>,
                  },
                  {
                    className: 'w-28 hidden md:flex',
                    content: <DataTableBadge label={cfg.label} dot={cfg.dot} bg={cfg.bg} color={cfg.color} border={cfg.border} />,
                  },
                  {
                    className: 'w-16 flex justify-end',
                    content: (
                      <span className="text-xs font-semibold" style={{ color: accent }}>
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
