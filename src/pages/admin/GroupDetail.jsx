import { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Users, Clock, MapPin, UserPlus, Eye, BarChart3, RefreshCw, Sparkles } from 'lucide-react'
import ReporteIA from '../../components/admin/ReporteIA'
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
import { DataTable, DataTableRow, DataTableAvatar, DataTableBadge, DataTableBar, SkeletonBlock } from '../../components/ui/DataTable'
import ProgressiveList from '../../components/ui/ProgressiveList'
import BarraFiltros from '../../components/ui/BarraFiltros'
import { useAuth } from '../../context/AuthContext'
import StudentFormModal from '../../components/admin/StudentFormModal'
import CredentialsPanel from '../../components/admin/CredentialsPanel'
import KpiCard, { KpiGrid } from '../../components/ui/KpiCard'
import { IconPromedio, IconAsistencia, IconRiesgo } from '../../components/ui/SigaKpiIcons'

const COLUMNS = [
  { key:'rank',   label:'#',          className:'w-8' },
  { key:'name',   label:'Alumno',     className:'flex-grow min-w-[110px] sm:min-w-[140px]' },
  { key:'att',    label:'Asistencia', className:'w-28 hidden md:flex' },
  { key:'grade',  label:'Promedio',   className:'w-16 sm:w-20' },
  { key:'tasks',  label:'Tareas',     className:'w-24 hidden xl:flex' },
  { key:'status', label:'Estado',     className:'w-28 hidden xl:flex' },
  { key:'action', label:'',           className:'w-11 sm:w-16 flex justify-end' },
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
  const { currentUser, puedeVer, puedeDarAltas } = useAuth()
  const isAdmin = currentUser?.role === 'admin'
  const conIA = puedeVer('ia')

  const [grp, setGrp]           = useState(null)
  const [students, setStudents] = useState([])
  const [attByStudent, setAtt]  = useState({})
  const [attByGroup, setAttGrp] = useState({})
  const [metrics, setMetrics]   = useState(null)
  const [loading, setLoading]   = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [showAddStudent, setShowAddStudent] = useState(false)
  const [allGroups, setAllGroups] = useState([])
  const [lastCred, setLastCred] = useState(null)
  const [studentQuery, setStudentQuery] = useState('')
  const [detailView, setDetailView] = useState('students')

  const load = useCallback(async () => {
    setLoadError(null)
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
    } catch (err) {
      // Error de red o de permisos: no es lo mismo que "el grupo no existe".
      setLoadError(err?.message || 'No se pudo cargar el grupo.')
    }
    finally { setLoading(false) }
  }, [groupId])

  useEffect(() => { load() }, [load])

  const trend = useMemo(
    () => metrics ? buildTrend(metrics.evalsByStudent) : [],
    [metrics],
  )

  if (loading) return (
    <div className="w-full space-y-5" role="status" aria-label="Cargando grupo">
      <SkeletonBlock className="h-32"/>
      <KpiGrid cols={4}>{[0,1,2,3].map(i => <SkeletonBlock key={i} className="h-28 sm:h-36"/>)}</KpiGrid>
      <SkeletonBlock className="h-64"/>
    </div>
  )
  if (loadError) return (
    <div role="alert" className="card p-5 flex flex-col sm:flex-row sm:items-center gap-3 justify-between"
      style={{ background:'var(--bad-soft)', borderColor:'var(--bad-line)' }}>
      <span className="text-sm" style={{ color:'var(--bad)' }}>{loadError}</span>
      <button onClick={() => { setLoading(true); load() }} className="btn-secondary min-h-11 justify-center">
        <RefreshCw size={14}/> Reintentar
      </button>
    </div>
  )
  if (!grp) return (
    <div className="card p-8 text-center">
      <p className="text-sm" style={{ color:'var(--t3)' }}>Este grupo no existe o fue eliminado.</p>
      <button onClick={() => navigate('/admin/grupos')} className="btn-secondary mt-4 mx-auto justify-center">Volver a Grupos</button>
    </div>
  )

  const accent = getAccent(groupId)
  const stats  = computeGroupStats(grp, students, attByGroup)

  const sorted = [...students].sort((a, b) => (b.avgGrade ?? 0) - (a.avgGrade ?? 0))
  const visibleStudents = sorted.filter(s => `${s.name} ${s.email ?? ''}`.toLocaleLowerCase('es-MX').includes(studentQuery.trim().toLocaleLowerCase('es-MX')))
  const attColor = r => r >= 90 ? 'var(--good)' : r >= 75 ? 'var(--info)' : 'var(--bad)'
  const gradeClass = g => g >= 8.5 ? 'text-emerald-400' : g >= 7 ? 'text-blue-400' : 'text-red-400'

  return (
    <div className="w-full flex flex-col gap-5">

      {/* Header card con shader */}
      <GroupShaderCard
        group={grp}
        showPicker>

        {/* Info */}
        <div>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h1 className="text-xl font-bold tracking-tight" style={{ color:'var(--t1)' }}>
                {grp.name} — {grp.subject}
              </h1>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs" style={{ color:'var(--t3)' }}>
                <span className="flex items-center gap-1.5"><Users size={12}/>{stats.studentCount} alumnos</span>
              </div>
            </div>
          </div>
        </div>
      </GroupShaderCard>

      <KpiGrid cols={4} className="order-2">
        <KpiCard icon={IconPromedio} label="Promedio general" value={stats.avgGrade ?? '—'}
          tone={stats.avgGrade == null ? 'neutral' : stats.avgGrade >= 7 ? 'good' : 'warn'} sub="Evaluaciones registradas"/>
        <KpiCard icon={IconAsistencia} label="Asistencia" value={stats.attendanceRate === null ? '—' : `${stats.attendanceRate}%`} tone="info" sub="Acumulado del grupo"/>
        <KpiCard icon={Clock} tone="info" label="Horario del grupo"
          value={<span className="text-sm sm:text-base">{grp.schedule || 'Por definir'}</span>}
          pill={{ icon: MapPin, text: grp.room || 'Aula por asignar' }}/>
        <KpiCard icon={IconRiesgo} label="Requieren atención" value={students.filter(s=>['critical','at-risk'].includes(s.status)).length} tone="warn" sub={`De ${students.length} alumnos`}/>
      </KpiGrid>

      <div className="filter-toolbar order-3" role="tablist" aria-label="Detalle del grupo">
        <button role="tab" aria-selected={detailView === 'students'} onClick={()=>setDetailView('students')}
          className="min-h-11 px-3 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-2"
          style={{background:detailView==='students'?'var(--accent)':'var(--soft-bg)',color:detailView==='students'?'var(--accent-contrast)':'var(--t2)',border:'1px solid var(--card-border)'}}>
          <Users size={14}/> Alumnos
        </button>
        <button role="tab" aria-selected={detailView === 'trend'} onClick={()=>setDetailView('trend')}
          className="min-h-11 px-3 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-2"
          style={{background:detailView==='trend'?'var(--accent)':'var(--soft-bg)',color:detailView==='trend'?'var(--accent-contrast)':'var(--t2)',border:'1px solid var(--card-border)'}}>
          <BarChart3 size={14}/> Evolución
        </button>
        {conIA && (
          <button role="tab" aria-selected={detailView === 'ia'} onClick={()=>setDetailView('ia')}
            className="min-h-11 px-3 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-2"
            style={{background:detailView==='ia'?'var(--accent)':'var(--soft-bg)',color:detailView==='ia'?'var(--accent-contrast)':'var(--t2)',border:'1px solid var(--card-border)'}}>
            <Sparkles size={14}/> Reporte IA
          </button>
        )}
      </div>

      {detailView === 'ia' && conIA && <div className="order-4"><ReporteIA tipo="grupo" id={groupId} nombre={grp.name}/></div>}

      {/* Trend chart */}
      {detailView === 'trend' && <div className="card p-4 sm:p-5 order-4">
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
      </div>}

      {puedeDarAltas && showAddStudent && (
        <StudentFormModal
          groups={allGroups}
          defaultGroupId={groupId}
          onClose={() => setShowAddStudent(false)}
          onSaved={cred => { if (cred) setLastCred(cred); load() }}
        />
      )}

      {lastCred && <CredentialsPanel cred={lastCred} onClose={() => setLastCred(null)}/>}

      {/* Students table */}
      {detailView === 'students' && <div className="order-4">
        <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
          <div>
            <h2 className="section-title">Alumnos del Grupo</h2>
            <p className="text-[11px] mt-0.5" style={{color:'var(--t3)'}}>{visibleStudents.length} de {students.length} alumno(s)</p>
          </div>
          <div className="flex gap-2">
            {puedeDarAltas && (
              <button onClick={() => setShowAddStudent(true)} className="btn-secondary text-xs py-2">
                <UserPlus size={14}/> Añadir alumno
              </button>
            )}
            <button onClick={() => navigate('/admin/asistencias')} className="btn-primary text-xs py-2">
              Pasar lista
            </button>
          </div>
        </div>

        <div className="mb-3">
          <BarraFiltros
            busqueda={{ value: studentQuery, onChange: setStudentQuery, placeholder: 'Buscar alumno por nombre o correo',
              coincidencias: students.map(s => ({ id: s.id, label: s.name, sub: s.email ?? '' })),
              onElegir: id => navigate(`/admin/alumnos/${id}`) }}
            resumen={`${visibleStudents.length} de ${students.length}`}/>
        </div>

        <DataTable columns={COLUMNS} isEmpty={visibleStudents.length === 0}
          emptyText={students.length ? 'No hay alumnos que coincidan con la búsqueda.' : 'Este grupo todavía no tiene alumnos asignados.'}>
          <ProgressiveList items={visibleStudents} emptyLabel="No hay alumnos que coincidan con la búsqueda.">
          {(s, i) => {
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
                    className: 'w-28 hidden md:flex',
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
                    className: 'w-24 hidden xl:flex',
                    content: s.assignmentsTotal > 0
                      ? <DataTableBar value={s.assignmentsDone} max={s.assignmentsTotal} color="var(--info)" label={`${s.assignmentsDone}/${s.assignmentsTotal}`} />
                      : <span className="text-xs" style={{ color:'var(--t3)' }}>—</span>,
                  },
                  {
                    className: 'w-28 hidden xl:flex',
                    content: <DataTableBadge label={cfg.label} dot={cfg.dot} bg={cfg.bg} color={cfg.color} border={cfg.border} />,
                  },
                  {
                    className: 'w-11 sm:w-16 flex justify-end',
                    content: (
                      <span className="text-xs font-semibold inline-flex items-center gap-1" style={{ color: 'var(--t2)' }}>
                        {/* El color del grupo va en el ícono; el texto, en el del tema
                            (con algunos acentos quedaba por debajo de 4.5:1). */}
                        <Eye size={15} style={{ color: accent }}/><span className="hidden sm:inline">Ver perfil</span>
                      </span>
                    ),
                  },
                ]}
              />
            )
          }}
          </ProgressiveList>
        </DataTable>
      </div>}

    </div>
  )
}
