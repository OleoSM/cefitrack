import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, Plus, Pencil, Trash2, KeyRound, AlertCircle, RefreshCw, ShieldCheck } from 'lucide-react'
import PermisosAlumnoModal from '../../components/admin/PermisosAlumnoModal'
import { statusConfig, getStatusConfig } from '../../data/mockData'
import { fetchStudents, fetchGroups, deleteStudent, fetchAttendanceStats } from '../../lib/supabaseData'
import {
  DataTable, DataTableRow,
  DataTableAvatar, DataTableBadge, DataTableBar, SkeletonRows,
} from '../../components/ui/DataTable'
import { useGroupColors } from '../../hooks/useGroupColors'
import { useAuth } from '../../context/AuthContext'
import StudentFormModal from '../../components/admin/StudentFormModal'
import ResetPasswordModal from '../../components/admin/ResetPasswordModal'
import ConfirmDialog from '../../components/admin/ConfirmDialog'
import CredentialsPanel from '../../components/admin/CredentialsPanel'
import ProgressiveList from '../../components/ui/ProgressiveList'
import { useSucursales } from '../../hooks/useSucursales'
import BarraFiltros from '../../components/ui/BarraFiltros'
import { useSucursalActiva, TODAS } from '../../hooks/useSucursalActiva'

const attColor   = r => r >= 90 ? 'var(--good)' : r >= 75 ? 'var(--info)' : 'var(--bad)'
const gradeColor = g => g >= 8.5 ? 'text-emerald-400' : g >= 7 ? 'text-blue-400' : 'text-red-400'

const COLUMNS = [
  { key:'name',    label:'Alumno',     className:'flex-grow min-w-0 sm:min-w-[140px]' },
  { key:'group',   label:'Grupo',      className:'w-28 hidden md:flex' },
  { key:'att',     label:'Asistencia', className:'w-36 hidden lg:flex' },
  { key:'grade',   label:'Promedio',   className:'w-12 sm:w-24' },
  { key:'tasks',   label:'Tareas',     className:'w-32 hidden xl:flex' },
  { key:'status',  label:'Estado',     className:'w-28 hidden md:flex' },
  { key:'contact', label:'Contacto',   className:'w-40 hidden xl:flex' },
  { key:'action',  label:'',           className:'w-[6.5rem] md:w-32 flex justify-end' },
]

export default function Students() {
  const navigate = useNavigate()
  const { getAccent } = useGroupColors()
  const { currentUser, allowedSucursales, canAccess, puedeDarAltas } = useAuth()
  const isAdmin = currentUser?.role === 'admin'
  const { sucursales: catalogoSucursales, nombreDe } = useSucursales()

  const [students, setStudents]   = useState([])
  const [groups, setGroups]       = useState([])
  const [loading, setLoading]     = useState(true)

  const [query, setQuery]         = useState('')
  const { sucursal: sucursalFilter, setSucursal: setSucursalFilter, opcionesConTodas } = useSucursalActiva()
  /* Se recuerda el último grupo elegido (en este navegador): al volver a
     Alumnos se abre donde se dejó, en vez de volver a buscarlo cada vez. */
  const CLAVE_GRUPO = 'siga_alumnos_ultimo_grupo'
  const [groupFilter, setGroupState] = useState(() => {
    try { return localStorage.getItem(CLAVE_GRUPO) || 'all' } catch { return 'all' }
  })
  const setGroup = id => {
    setGroupState(id)
    try { if (id && id !== 'all') localStorage.setItem(CLAVE_GRUPO, id); else localStorage.removeItem(CLAVE_GRUPO) } catch { /* sin storage */ }
  }
  const restaurado = useRef(false)
  const [buscaGrupo, setBuscaGrupo] = useState('')
  const [statusFilter, setStatus] = useState('all')
  const [sort, setSort]           = useState('name')

  /* CRUD */
  const [formFor, setFormFor]     = useState(null)   // { student } | { student:null } para alta
  const [resetFor, setResetFor]   = useState(null)
  const [deleteFor, setDeleteFor] = useState(null)
  const [permisosFor, setPermisosFor] = useState(null)   // alumno cuyos permisos del portal se editan
  const [lastCred, setLastCred]   = useState(null)

  const [loadError, setLoadError] = useState(null)

  const load = useCallback(async () => {
    try {
      const [s, g] = await Promise.all([fetchStudents(), fetchGroups()])
      // `students.attendance_rate` es el valor sembrado y quedó obsoleto: la tasa
      // real se calcula de las sesiones capturadas, igual que en Grupos y Rankings.
      const stats = await fetchAttendanceStats(s)
      setStudents(s.map(st => ({ ...st, attendanceRate: stats.byStudent[st.id] ?? null })))
      setGroups(g)
      setLoadError(null)
    } catch (err) {
      setLoadError(err?.message || 'No se pudieron cargar los alumnos.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const visibleGroups = isAdmin ? groups : groups.filter(g => canAccess(g.sucursal, g.id))
  const sucursalOptions = catalogoSucursales
    .filter(s => isAdmin || allowedSucursales.includes(s.id))
    .map(s => s.id)
  const visibleGroupIds = new Set(visibleGroups.map(g => g.id))
  const groupsInSucursal = sucursalFilter === TODAS
    ? visibleGroups
    : visibleGroups.filter(g => g.sucursal === sucursalFilter)

  useEffect(() => {
    // Hasta que llegan los grupos no se puede saber si el guardado existe:
    // comprobarlo antes lo borraba siempre al entrar.
    if (loading || groupFilter === 'all') return
    if (groupsInSucursal.some(g => g.id === groupFilter)) { restaurado.current = true; return }
    const grupo = visibleGroups.find(g => g.id === groupFilter)
    // Al entrar, si el grupo recordado es de otra sucursal, se va a la suya (una vez).
    if (grupo && !restaurado.current) { restaurado.current = true; setSucursalFilter(grupo.sucursal); return }
    setGroup('all')
    // setGroup/setSucursalFilter son estables en la práctica
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, sucursalFilter, groupFilter, groupsInSucursal])

  const filtered = students
    .filter(s => visibleGroupIds.has(s.groupId))
    .filter(s => {
      const q = query.toLowerCase()
      const grp = groups.find(g => g.id === s.groupId)
      return (s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q))
        && (sucursalFilter === TODAS || grp?.sucursal === sucursalFilter)
        && (groupFilter === 'all' || s.groupId === groupFilter)
        && (statusFilter === 'all' || s.status === statusFilter)
    })
    .sort((a, b) => {
      // Los alumnos sin datos van al final en vez de romper el orden con NaN.
      const desc = (x, y) => (y ?? -Infinity) - (x ?? -Infinity)
      if (sort === 'grade')  return desc(a.avgGrade, b.avgGrade)
      if (sort === 'attend') return desc(a.attendanceRate, b.attendanceRate)
      return a.name.localeCompare(b.name)
    })

  return (
    <div className="w-full space-y-5">
      <div>
        <h1 className="page-title">Alumnos</h1>
        <p className="text-sm mt-1" style={{ color:'var(--t3)' }}>
          Busca a un alumno, revisa su avance y administra su cuenta.
        </p>
      </div>

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
          onConfirm={async () => { const res = await deleteStudent(deleteFor.id); if (res?.ok === false) return res; await load() }}
          onClose={() => setDeleteFor(null)}
        />
      )}

      {lastCred && <CredentialsPanel cred={lastCred} onClose={() => setLastCred(null)}/>}
      {permisosFor && <PermisosAlumnoModal student={permisosFor} groups={groups} onClose={() => setPermisosFor(null)}/>}

      {/* ── Filtros ─────────────────────────────────────────── */}
      <BarraFiltros
        filtros={[
          { id:'sucursal', label:'Sucursal', value:sucursalFilter, onChange:setSucursalFilter,
            porDefecto:sucursalFilter, options:opcionesConTodas },
          { id:'grupo', label:'Grupo', tipo:'grupo', value:groupFilter, onChange:setGroup,
            porDefecto:'all', grupos:groupsInSucursal, query:buscaGrupo, onQuery:setBuscaGrupo,
            nombreDe },
          { id:'estado', label:'Estado', value:statusFilter, onChange:setStatus, porDefecto:'all',
            options:[{ value:'all', label:'Todos' },
              ...Object.entries(statusConfig).map(([k,v]) => ({ value:k, label:v.label }))] },
          { id:'orden', label:'Ordenar', value:sort, onChange:setSort, porDefecto:'name',
            options:[{ value:'name', label:'Nombre A-Z' }, { value:'grade', label:'Mayor promedio' },
              { value:'attend', label:'Mayor asistencia' }] },
        ]}
        busqueda={{ value: query, onChange: setQuery, placeholder:'Buscar alumno…',
          coincidencias: students.filter(s => visibleGroupIds.has(s.groupId)).map(s => ({
            id: s.id, label: s.name, sub: groups.find(g => g.id === s.groupId)?.name ?? '' })),
          onElegir: id => navigate(`/admin/alumnos/${id}`) }}
        resumen={`${filtered.length} de ${students.length}`}
        acciones={puedeDarAltas && (
          <button onClick={() => setFormFor({ student: null })} disabled={visibleGroups.length === 0}
            className="btn-primary flex-shrink-0">
            <Plus size={14}/> <span className="hidden sm:inline">Nuevo alumno</span>
          </button>
        )}/>

      {loadError && (
        <div role="alert" className="card p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between"
          style={{ background:'var(--bad-soft)', borderColor:'var(--bad-line)' }}>
          <span className="text-sm flex items-center gap-2" style={{ color:'var(--bad)' }}>
            <AlertCircle size={14}/>{loadError}
          </span>
          <button onClick={() => { setLoading(true); load() }} className="btn-secondary min-h-11 justify-center">
            <RefreshCw size={14}/> Reintentar
          </button>
        </div>
      )}

      {/* ── Tabla ───────────────────────────────────────────── */}
      <DataTable
        columns={COLUMNS}
        isEmpty={!loading && !loadError && filtered.length === 0}
        emptyIcon={<Users size={36} />}
        emptyText="No se encontraron alumnos con ese criterio.">

        {loading ? <SkeletonRows/> : (
        <ProgressiveList items={filtered} emptyLabel="No se encontraron alumnos con ese criterio.">
        {s => {
          const cfg         = getStatusConfig(s.status)
          const grp         = groups.find(g => g.id === s.groupId)
          const ac          = attColor(s.attendanceRate ?? 0)
          const groupAccent = getAccent(s.groupId)   // mismo color que Groups / Attendance / Registrar

          /* La lista es de ALUMNOS: se recorre buscando a una persona, y el
             grupo ya viaja en su propia columna. Teñir la fila entera del
             color del grupo convertía la búsqueda en una lectura por bloques
             de color y competía con los indicadores de riesgo. */

          // El avatar siempre muestra el color del grupo (coincide con el resto de la app)
          const avatarColor = ac

          return (
            <DataTableRow
              key={s.id}
              onClick={() => navigate(`/admin/alumnos/${s.id}`)}
              cells={[
                /* Alumno */
                {
                  className: 'flex-grow min-w-0 sm:min-w-[140px]',
                  content: (
                    <DataTableAvatar
                      initials={s.name.split(' ').slice(0,2).map(n=>n[0]).join('')}
                      statusColor={avatarColor}
                      avatarSrc={s.avatarSrc}
                      name={s.name}
                      sub={<>
                        <span className="sm:hidden">{grp?.name}</span>
                        <span className="hidden sm:inline">{s.email}</span>
                      </>}
                      accentColor={groupAccent}
                    />
                  ),
                },
                /* Grupo */
                {
                  className: 'w-28 hidden md:flex',
                  content: (
                    <span
                      className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ background:'var(--soft-bg)', color:'var(--t2)' }}>
                      {grp?.name}
                    </span>
                  ),
                },
                /* Asistencia */
                {
                  className: 'w-36 hidden lg:flex',
                  content: s.attendanceRate === null
                    ? <span className="text-xs" style={{ color:'var(--t3)' }}>Sin datos</span>
                    : (
                      <DataTableBar
                        value={s.attendanceRate}
                        color={ac}
                        label={`${s.attendanceRate}%`}
                      />
                    ),
                },
                /* Promedio */
                {
                  className: 'w-12 sm:w-24',
                  content: s.avgGrade === null
                    ? <span className="text-sm" style={{ color:'var(--t4)' }}>—</span>
                    : (
                      <span className={`text-sm sm:text-base font-bold ${gradeColor(s.avgGrade)}`}>
                        {s.avgGrade}
                      </span>
                    ),
                },
                /* Tareas */
                {
                  className: 'w-32 hidden xl:flex',
                  content: s.assignmentsTotal > 0
                    ? (
                      <DataTableBar
                        value={s.assignmentsDone}
                        max={s.assignmentsTotal}
                        color="var(--info)"
                        label={`${s.assignmentsDone}/${s.assignmentsTotal}`}
                      />
                    )
                    : <span className="text-xs" style={{ color:'var(--t4)' }}>—</span>,
                },
                /* Estado */
                {
                  className: 'w-28 hidden md:flex',
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
                    <span className="text-xs" style={{ color:'var(--t3)' }}>Sin tutor</span>
                  ),
                },
                /* Acciones */
                {
                  className: 'w-[6.5rem] md:w-32 flex justify-end',
                  content: (
                    <div className="flex items-center gap-1">
                      {[
                        { icon: Pencil,   title: 'Editar alumno',           hover: 'var(--info)', act: () => setFormFor({ student: s }) },
                        { icon: ShieldCheck, title: 'Permisos del portal',  hover: 'var(--accent)', act: () => setPermisosFor(s) },
                        { icon: KeyRound, title: 'Restablecer contraseña',  hover: 'var(--warn)', act: () => setResetFor(s) },
                        // Dar de baja: solo con el permiso de altas.
                        ...(puedeDarAltas ? [{ icon: Trash2, title: 'Eliminar alumno', hover: 'var(--bad)', act: () => setDeleteFor(s) }] : []),
                      ].map(({ icon: Icon, title, hover, act }) => (
                        <button key={title} title={title}
                          onClick={e => { e.stopPropagation(); act() }}
                          aria-label={title}
                          className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center transition-colors"
                          style={{ color:'var(--t2)', background:'var(--soft-bg)', border:'1px solid var(--card-border)' }}
                          onMouseEnter={e => e.currentTarget.style.color = hover}
                          onMouseLeave={e => e.currentTarget.style.color = 'var(--t2)'}>
                          <Icon size={14}/>
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
