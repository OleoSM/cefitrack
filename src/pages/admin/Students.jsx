import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Users, ArrowRight } from 'lucide-react'
import { statusConfig } from '../../data/mockData'
import { fetchStudents, fetchGroups } from '../../lib/supabaseData'
import {
  DataTable, DataTableRow,
  DataTableAvatar, DataTableBadge, DataTableBar,
} from '../../components/ui/DataTable'
import { NeonCheckbox } from '../../components/ui/NeonCheckbox'
import { useGroupColors } from '../../hooks/useGroupColors'

const attColor   = r => r >= 90 ? '#34d399' : r >= 75 ? '#60a5fa' : '#f87171'
const gradeColor = g => g >= 8.5 ? 'text-emerald-400' : g >= 7 ? 'text-blue-400' : 'text-red-400'

const COLUMNS = [
  { key:'name',    label:'Alumno',     className:'flex-grow min-w-[180px]' },
  { key:'group',   label:'Grupo',      className:'w-28' },
  { key:'att',     label:'Asistencia', className:'w-36 hidden sm:flex' },
  { key:'grade',   label:'Promedio',   className:'w-24' },
  { key:'tasks',   label:'Tareas',     className:'w-32 hidden md:flex' },
  { key:'status',  label:'Estado',     className:'w-28' },
  { key:'contact', label:'Contacto',   className:'w-40 hidden lg:flex' },
  { key:'action',  label:'',           className:'w-10' },
]

export default function Students() {
  const navigate = useNavigate()
  const { getAccent } = useGroupColors()

  const [students, setStudents]   = useState([])
  const [groups, setGroups]       = useState([])
  const [loading, setLoading]     = useState(true)

  const [query, setQuery]         = useState('')
  const [groupFilter, setGroup]   = useState('all')
  const [statusFilter, setStatus] = useState('all')
  const [sort, setSort]           = useState('name')
  const [visual, setVisual]       = useState(false)   // ← modo visual

  useEffect(() => {
    let alive = true
    Promise.all([fetchStudents(), fetchGroups()]).then(([s, g]) => {
      if (!alive) return
      setStudents(s)
      setGroups(g)
      setLoading(false)
    })
    return () => { alive = false }
  }, [])

  const filtered = students
    .filter(s => {
      const q = query.toLowerCase()
      return (s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q))
        && (groupFilter === 'all' || s.groupId === groupFilter)
        && (statusFilter === 'all' || s.status === statusFilter)
    })
    .sort((a, b) => {
      if (sort === 'grade')  return b.avgGrade - a.avgGrade
      if (sort === 'attend') return b.attendanceRate - a.attendanceRate
      if (sort === 'rank')   return a.rank - b.rank
      return a.name.localeCompare(b.name)
    })

  return (
    <div className="max-w-6xl space-y-4">

      {/* ── Filtros ─────────────────────────────────────────── */}
      <div className="card p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[160px]">
            <div className="relative">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2"
                style={{ color:'rgba(255,255,255,.25)' }} />
              <input value={query} onChange={e => setQuery(e.target.value)}
                placeholder="Buscar alumno…" className="input-field pl-9" />
            </div>
          </div>

          {[
            { label:'Grupo', value:groupFilter, setter:setGroup,
              opts:[{v:'all',l:'Todos los grupos'}, ...groups.map(g=>({v:g.id,l:g.name}))] },
            { label:'Estado', value:statusFilter, setter:setStatus,
              opts:[{v:'all',l:'Todos'}, ...Object.entries(statusConfig).map(([k,v])=>({v:k,l:v.label}))] },
            { label:'Ordenar', value:sort, setter:setSort,
              opts:[{v:'name',l:'Nombre A-Z'},{v:'grade',l:'Mayor promedio'},{v:'attend',l:'Mayor asistencia'},{v:'rank',l:'Ranking'}] },
          ].map(({ label, value, setter, opts }) => (
            <div key={label}>
              <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5"
                style={{ color:'rgba(255,255,255,.30)' }}>{label}</label>
              <select value={value} onChange={e => setter(e.target.value)} className="input-field text-sm">
                {opts.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
            </div>
          ))}

          {/* ── Checkbox modo visual ──────────────────────────── */}
          <div className="flex items-end pb-0.5">
            <NeonCheckbox
              checked={visual}
              onChange={e => setVisual(e.target.checked)}
              label="Vista por grupo"
              color="#a78bfa"
            />
          </div>
        </div>

        <p className="text-[11px] mt-3 flex items-center gap-1.5" style={{ color:'rgba(255,255,255,.28)' }}>
          <Users size={11} />
          {filtered.length} de {students.length} alumnos
          {visual && (
            <span className="ml-2 flex items-center gap-1.5">
              {groups.map(g => {
                const accent = getAccent(g.id)
                return (
                  <span key={g.id} className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full" style={{ background: accent }} />
                    <span style={{ color:'rgba(255,255,255,.40)' }}>{g.name}</span>
                  </span>
                )
              })}
            </span>
          )}
        </p>
      </div>

      {/* ── Tabla ───────────────────────────────────────────── */}
      <DataTable
        columns={COLUMNS}
        isEmpty={!loading && filtered.length === 0}
        emptyIcon={<Users size={36} />}
        emptyText="No se encontraron alumnos con ese criterio.">

        {loading ? null : filtered.map(s => {
          const cfg         = statusConfig[s.status]
          const grp         = groups.find(g => g.id === s.groupId)
          const ac          = attColor(s.attendanceRate)
          const groupAccent = getAccent(s.groupId)   // mismo color que Groups / Attendance / Registrar

          /* En modo visual: la fila toma el color del grupo */
          const rowStyle = visual
            ? {
                borderLeft:  `3px solid ${groupAccent}`,
                background:  `${groupAccent}0d`,
              }
            : {}

          // El avatar siempre muestra el color del grupo (coincide con el resto de la app)
          const avatarColor = ac

          return (
            <DataTableRow
              key={s.id}
              onClick={() => navigate(`/admin/alumnos/${s.id}`)}
              style={rowStyle}
              cells={[
                /* Alumno */
                {
                  className: 'flex-grow min-w-[180px]',
                  content: (
                    <DataTableAvatar
                      initials={s.name.split(' ').slice(0,2).map(n=>n[0]).join('')}
                      statusColor={avatarColor}
                      name={s.name}
                      sub={s.email}
                      accentColor={groupAccent}
                    />
                  ),
                },
                /* Grupo */
                {
                  className: 'w-28',
                  content: (
                    <span
                      className="text-[11px] font-semibold px-2 py-0.5 rounded-full transition-all duration-300"
                      style={visual
                        ? { background:`${groupAccent}25`, color: groupAccent, border:`1px solid ${groupAccent}55` }
                        : { background:'rgba(255,255,255,.08)', color:'rgba(255,255,255,.55)' }
                      }>
                      {grp?.name}
                    </span>
                  ),
                },
                /* Asistencia */
                {
                  className: 'w-36 hidden sm:flex',
                  content: (
                    <DataTableBar
                      value={s.attendanceRate}
                      color={visual ? groupAccent : ac}
                      label={`${s.attendanceRate}%`}
                    />
                  ),
                },
                /* Promedio */
                {
                  className: 'w-24',
                  content: (
                    <span className={`text-base font-bold ${gradeColor(s.avgGrade)}`}>
                      {s.avgGrade}
                    </span>
                  ),
                },
                /* Tareas */
                {
                  className: 'w-32 hidden md:flex',
                  content: (
                    <DataTableBar
                      value={s.assignmentsDone}
                      max={s.assignmentsTotal}
                      color={visual ? groupAccent : '#60a5fa'}
                      label={`${s.assignmentsDone}/${s.assignmentsTotal}`}
                    />
                  ),
                },
                /* Estado */
                {
                  className: 'w-28',
                  content: (
                    <DataTableBadge
                      label={cfg.label}
                      dot={cfg.dot}
                      bg={cfg.bg}
                      color={cfg.color}
                      border={cfg.border}
                    />
                  ),
                },
                /* Contacto */
                {
                  className: 'w-40 hidden lg:flex flex-col',
                  content: (
                    <>
                      <p className="text-xs font-medium truncate" style={{ color:'rgba(255,255,255,.62)' }}>
                        {s.tutor.name}
                      </p>
                      <p className="text-[11px] truncate" style={{ color:'rgba(255,255,255,.30)' }}>
                        {s.tutor.email}
                      </p>
                    </>
                  ),
                },
                /* Acción */
                {
                  className: 'w-10 flex justify-end',
                  content: (
                    <div className="p-1.5 rounded-lg" style={{ color: visual ? `${groupAccent}99` : 'rgba(255,255,255,.28)' }}>
                      <ArrowRight size={14} />
                    </div>
                  ),
                },
              ]}
            />
          )
        })}
      </DataTable>

    </div>
  )
}
