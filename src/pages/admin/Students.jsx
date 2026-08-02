import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Users, Plus, Pencil, Trash2, KeyRound } from 'lucide-react'
import { statusConfig, getStatusConfig } from '../../data/mockData'
import { fetchStudents, fetchGroups, deleteStudent, fetchAttendanceStats } from '../../lib/supabaseData'
import {
  DataTable, DataTableRow,
  DataTableAvatar, DataTableBadge, DataTableBar,
} from '../../components/ui/DataTable'
import { NeonCheckbox } from '../../components/ui/NeonCheckbox'
import { useGroupColors } from '../../hooks/useGroupColors'
import { useAuth } from '../../context/AuthContext'
import StudentFormModal from '../../components/admin/StudentFormModal'
import ResetPasswordModal from '../../components/admin/ResetPasswordModal'
import ConfirmDialog from '../../components/admin/ConfirmDialog'
import CredentialsPanel from '../../components/admin/CredentialsPanel'
import ProgressiveList, { FilterBar } from '../../components/ui/ProgressiveList'

const attColor   = r => r >= 90 ? 'var(--good)' : r >= 75 ? 'var(--info)' : 'var(--bad)'
const gradeColor = g => g >= 8.5 ? 'text-emerald-400' : g >= 7 ? 'text-blue-400' : 'text-red-400'

const COLUMNS = [
  { key:'name',    label:'Alumno',     className:'flex-grow min-w-[180px]' },
  { key:'group',   label:'Grupo',      className:'w-28' },
  { key:'att',     label:'Asistencia', className:'w-36 hidden sm:flex' },
  { key:'grade',   label:'Promedio',   className:'w-24 justify-end text-right' },
  { key:'tasks',   label:'Tareas',     className:'w-32 hidden md:flex' },
  { key:'status',  label:'Estado',     className:'w-28' },
  { key:'contact', label:'Contacto',   className:'w-40 hidden xl:flex' },
  { key:'action',  label:'',           className:'w-28 flex justify-end' },
]

export default function Students() {
  const navigate = useNavigate()
  const { getAccent } = useGroupColors()
  const { currentUser, allowedSucursales, canAccess } = useAuth()
  const isAdmin = currentUser?.role === 'admin'

  const [students, setStudents]   = useState([])
  const [groups, setGroups]       = useState([])
  const [loading, setLoading]     = useState(true)

  const [query, setQuery]         = useState('')
  const [sucursalFilter, setSucursalFilter] = useState('all')
  const [groupFilter, setGroup]   = useState('all')
  const [statusFilter, setStatus] = useState('all')
  const [sort, setSort]           = useState('name')
  const [visual, setVisual]       = useState(false)   // ← modo visual

  /* CRUD */
  const [formFor, setFormFor]     = useState(null)   // { student } | { student:null } para alta
  const [resetFor, setResetFor]   = useState(null)
  const [deleteFor, setDeleteFor] = useState(null)
  const [lastCred, setLastCred]   = useState(null)

  const load = useCallback(async () => {
    const [s, g] = await Promise.all([fetchStudents(), fetchGroups()])
    // `students.attendance_rate` es el valor sembrado y quedó obsoleto: la tasa
    // real se calcula de las sesiones capturadas, igual que en Grupos y Rankings.
    const stats = await fetchAttendanceStats(s)
    setStudents(s.map(st => ({ ...st, attendanceRate: stats.byStudent[st.id] ?? null })))
    setGroups(g)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const visibleGroups = isAdmin ? groups : groups.filter(g => canAccess(g.sucursal, g.id))
  const sucursalOptions = isAdmin ? [...new Set(groups.map(g => g.sucursal).filter(Boolean))] : allowedSucursales
  const visibleGroupIds = new Set(visibleGroups.map(g => g.id))

  const filtered = students
    .filter(s => visibleGroupIds.has(s.groupId))
    .filter(s => {
      const q = query.toLowerCase()
      const grp = groups.find(g => g.id === s.groupId)
      return (s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q))
        && (sucursalFilter === 'all' || grp?.sucursal === sucursalFilter)
        && (groupFilter === 'all' || s.groupId === groupFilter)
        && (statusFilter === 'all' || s.status === statusFilter)
    })
    .sort((a, b) => {
      // Los alumnos sin datos van al final en vez de romper el orden con NaN.
      const desc = (x, y) => (y ?? -Infinity) - (x ?? -Infinity)
      if (sort === 'grade')  return desc(a.avgGrade, b.avgGrade)
      if (sort === 'attend') return desc(a.attendanceRate, b.attendanceRate)
      if (sort === 'rank')   return (a.rank ?? Infinity) - (b.rank ?? Infinity)
      return a.name.localeCompare(b.name)
    })

  return (
    <div className="space-y-4">

      {formFor && (
        <StudentFormModal
          student={formFor.student}
          groups={visibleGroups}
          onClose={() => setFormFor(null)}
          onSaved={cred => { if (cred) setLastCred(cred); load() }}
        />
      )}
      {resetFor && (
        <ResetPasswordModal
          student={resetFor}
          onClose={() => setResetFor(null)}
          onDone={cred => setLastCred(cred)}
        />
      )}
      {deleteFor && (
        <ConfirmDialog
          title="Eliminar alumno"
          message={`Se eliminará a ${deleteFor.name} junto con su cuenta de acceso.`}
          detail="También se borran sus calificaciones y registros de asistencia. Esta acción no se puede deshacer."
          onConfirm={async () => { await deleteStudent(deleteFor.id); await load() }}
          onClose={() => setDeleteFor(null)}
        />
      )}

      {lastCred && <CredentialsPanel cred={lastCred} onClose={() => setLastCred(null)}/>}

      {/* ── Filtros ─────────────────────────────────────────── */}
      <FilterBar
        activos={[sucursalFilter, groupFilter, statusFilter].filter(v => v !== 'all').length + (query ? 1 : 0)}
        acciones={
          <button onClick={() => setFormFor({ student: null })} disabled={visibleGroups.length === 0}
            className="btn-primary sm:ml-auto">
            <Plus size={14}/> <span className="hidden sm:inline">Nuevo alumno</span>
          </button>
        }>
        <>
          <div className="flex-1 min-w-[160px]">
            <div className="relative">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2"
                style={{ color:'var(--t4)' }} />
              <input value={query} onChange={e => setQuery(e.target.value)}
                placeholder="Buscar alumno…" className="input-field pl-9" />
            </div>
          </div>

          {[
            { label:'Sucursal', value:sucursalFilter, setter:setSucursalFilter,
              opts:[{v:'all',l: isAdmin ? 'Todas' : 'Mis sucursales'}, ...sucursalOptions.map(s=>({v:s,l:s}))] },
            { label:'Grupo', value:groupFilter, setter:setGroup,
              opts:[{v:'all',l:'Todos los grupos'}, ...visibleGroups.map(g=>({v:g.id,l:g.name}))] },
            { label:'Estado', value:statusFilter, setter:setStatus,
              opts:[{v:'all',l:'Todos'}, ...Object.entries(statusConfig).map(([k,v])=>({v:k,l:v.label}))] },
            { label:'Ordenar', value:sort, setter:setSort,
              opts:[{v:'name',l:'Nombre A-Z'},{v:'grade',l:'Mayor promedio'},{v:'attend',l:'Mayor asistencia'},{v:'rank',l:'Ranking'}] },
          ].map(({ label, value, setter, opts }) => (
            <div key={label}>
              <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5"
                style={{ color:'var(--t3)' }}>{label}</label>
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
              color="#5D3E90"
            />
          </div>

        </>
      </FilterBar>

      <p className="text-[11px] flex items-center gap-1.5 px-1" style={{ color:'var(--t3)' }}>
        <Users size={11} />
        {filtered.length} de {students.length} alumnos
        {visual && (
          <span className="ml-2 hidden sm:flex items-center gap-1.5">
            {visibleGroups.map(g => {
              const accent = getAccent(g.id)
              return (
                <span key={g.id} className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full" style={{ background: accent }} />
                  <span style={{ color:'var(--t3)' }}>{g.name}</span>
                </span>
              )
            })}
          </span>
        )}
      </p>

      {/* ── Tabla ───────────────────────────────────────────── */}
      <DataTable
        columns={COLUMNS}
        isEmpty={!loading && filtered.length === 0}
        emptyIcon={<Users size={36} />}
        emptyText="No se encontraron alumnos con ese criterio.">

        {loading ? null : (
        <ProgressiveList items={filtered} emptyLabel="No se encontraron alumnos con ese criterio.">
        {s => {
          const cfg         = getStatusConfig(s.status)
          const grp         = groups.find(g => g.id === s.groupId)
          const ac          = attColor(s.attendanceRate ?? 0)
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
                        : { background:'var(--soft-bg)', color:'var(--t2)' }
                      }>
                      {grp?.name}
                    </span>
                  ),
                },
                /* Asistencia */
                {
                  className: 'w-36 hidden sm:flex',
                  content: s.attendanceRate === null
                    ? <span className="text-xs" style={{ color:'var(--t4)' }}>Sin datos</span>
                    : (
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
                  content: s.avgGrade === null
                    ? <span className="text-sm" style={{ color:'var(--t4)' }}>—</span>
                    : (
                      <span className={`text-base font-bold ${gradeColor(s.avgGrade)}`}>
                        {s.avgGrade}
                      </span>
                    ),
                },
                /* Tareas */
                {
                  className: 'w-32 hidden md:flex',
                  content: s.assignmentsTotal > 0
                    ? (
                      <DataTableBar
                        value={s.assignmentsDone}
                        max={s.assignmentsTotal}
                        color={visual ? groupAccent : 'var(--info)'}
                        label={`${s.assignmentsDone}/${s.assignmentsTotal}`}
                      />
                    )
                    : <span className="text-xs" style={{ color:'var(--t4)' }}>—</span>,
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
                  className: 'w-40 hidden xl:flex flex-col',
                  content: s.tutor?.name || s.tutor?.email ? (
                    <>
                      <p className="text-xs font-medium truncate" style={{ color:'var(--t2)' }}>
                        {s.tutor.name ?? '—'}
                      </p>
                      <p className="text-[11px] truncate" style={{ color:'var(--t3)' }}>
                        {s.tutor.email ?? s.tutor.phone ?? ''}
                      </p>
                    </>
                  ) : (
                    <span className="text-xs" style={{ color:'var(--t4)' }}>Sin tutor</span>
                  ),
                },
                /* Acciones */
                {
                  className: 'w-28 flex justify-end',
                  content: (
                    <div className="flex items-center gap-0.5">
                      {[
                        { icon: Pencil,   title: 'Editar alumno',           hover: 'var(--info)', act: () => setFormFor({ student: s }) },
                        { icon: KeyRound, title: 'Restablecer contraseña',  hover: 'var(--warn)', act: () => setResetFor(s) },
                        { icon: Trash2,   title: 'Eliminar alumno',         hover: 'var(--bad)', act: () => setDeleteFor(s) },
                      ].map(({ icon: Icon, title, hover, act }) => (
                        <button key={title} title={title}
                          onClick={e => { e.stopPropagation(); act() }}
                          className="p-1.5 rounded-lg transition-colors"
                          style={{ color:'var(--t4)' }}
                          onMouseEnter={e => e.currentTarget.style.color = hover}
                          onMouseLeave={e => e.currentTarget.style.color = 'var(--t4)'}>
                          <Icon size={13}/>
                        </button>
                      ))}
                    </div>
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
