import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, Clock, MapPin, Filter, Plus, X, AlertCircle, Pencil, Trash2, UserPlus, BookOpen, TrendingUp, Star, Ban, Columns2, Rows3, Check, ChevronDown, ChevronUp } from 'lucide-react'
import {
  fetchGroups, fetchStudents, fetchAttendanceStats,
  computeGroupStats, createGroup, updateGroup, deleteGroup,
} from '../../lib/supabaseData'
import ConfirmDialog from '../../components/admin/ConfirmDialog'
import ModalPortal from '../../components/ui/ModalPortal'
import StudentFormModal from '../../components/admin/StudentFormModal'
import CredentialsPanel from '../../components/admin/CredentialsPanel'
import GroupShaderCard from '../../components/ui/GroupShaderCard'
import KpiCard from '../../components/ui/KpiCard'
import { useGroupColors, COLOR_PALETTES, GRADIENT_PALETTES, SOLID_PALETTES, MATE_PALETTES } from '../../hooks/useGroupColors'
import { logoInstitucion, INSTITUCIONES } from '../../lib/instituciones'
import ProgressiveList from '../../components/ui/ProgressiveList'
import IconoCurso from '../../components/ui/IconoCurso'
import BarraFiltros from '../../components/ui/BarraFiltros'
import StudentDock from '../../components/ui/StudentDock'
import { filtrarGrupos } from '../../components/ui/BuscadorGrupo'
import { useSucursalActiva, TODAS } from '../../hooks/useSucursalActiva'
import { useAuth } from '../../context/AuthContext'
import { useSucursales } from '../../hooks/useSucursales'

function FilterSelect({ value, onChange, options }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      className="text-xs font-semibold rounded-xl py-2 px-3 outline-none"
      style={{ background:'var(--soft-bg)', border:'1px solid var(--card-border)', color:'var(--t1)' }}>
      {options.map(o => <option key={o.value} value={o.value} style={{ color:'#000', background:'#fff' }}>{o.label}</option>)}
    </select>
  )
}

/** Barra de métrica; muestra un guion cuando todavía no hay datos que promediar. */
function MetricBar({ value, max, suffix = '', thresholds }) {
  if (value === null || value === undefined) {
    return <span className="text-xs" style={{ color:'var(--t3)' }}>Sin datos aún</span>
  }
  const color = value >= thresholds[0] ? 'var(--good)' : value >= thresholds[1] ? 'var(--info)' : 'var(--warn)'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background:'var(--soft-bg)' }}>
        <div className="h-full rounded-full" style={{ width:`${(value/max)*100}%`, background:color }} />
      </div>
      <span className="text-xs font-bold" style={{ color:'var(--t1)' }}>{value}{suffix}</span>
    </div>
  )
}

/* ── Modal de alta / edición de grupo ───────────────────────── */
// Valores literales a propósito: se guardan en la BD (groups.color).
const ICONOS_GRUPO = [
  ...INSTITUCIONES,
  { id:'universidad', alt:'Universidad', src:'/logos/universidad-informe-transparente.png' },
]
// Corrección óptica: los archivos traen cantidades distintas de margen interno.
// La escala compensa ese margen para que los emblemas pesen igual a la vista.
const ESCALA_ICONO = { ecoems:1.08, unam:1.04, ipn:.9, uam:1.16, universidad:1.52 }


function GroupFormModal({ group = null, sucursales, paletteId, onClose, onSaved }) {
  const { sucursales: catalogoSucursales } = useSucursales()
  const editing = !!group
  const [form, setForm] = useState({
    name:     group?.name ?? '',
    subject:  group?.subject ?? '',
    schedule: group?.schedule ?? '',
    room:     group?.room ?? '',
    color:    group?.color ?? COLOR_PALETTES[0].accent,
    sucursal: group?.sucursal ?? '',
    institucion: group?.institucion ?? null,
    curso: group?.curso ?? (group?.institucion && group.institucion !== 'ecoems' ? 'universidad' : 'ecoems'),
    instituciones: group?.instituciones ?? (['unam','uam','ipn'].includes(group?.institucion) ? [group.institucion] : []),
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState(null)
  const [selectedPalette, setSelectedPalette] = useState(paletteId ?? 'ocean')
  const [showMoreColors, setShowMoreColors] = useState(false)
  const set = (k,v) => setForm(f => ({ ...f, [k]:v }))

  const handleSubmit = async e => {
    e.preventDefault()
    if (form.curso === 'universidad' && form.instituciones.length === 0) {
      setError('Selecciona al menos una institución para Universidad.'); return
    }
    setSaving(true); setError(null)
    const payload = {
      name: form.name, subject: form.curso === 'ecoems' ? 'ECOEMS' : 'Universidad',
      schedule: form.schedule || null, room: form.room || null,
      color: form.color, sucursal: form.sucursal || null,
      institucion: form.curso === 'ecoems' ? 'ecoems' : (form.instituciones[0] ?? null),
      curso:form.curso, instituciones:form.instituciones,
    }
    const res = editing
      ? await updateGroup({ id: group.id, ...payload })
      : await createGroup(payload)
    setSaving(false)
    if (!res.ok) { setError(res.message); return }
    onSaved({ groupId:group?.id ?? res.group?.id, paletteId:selectedPalette })
    onClose()
  }

  return (
    <ModalPortal onClose={onClose} scrollable>
        <div className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom:'1px solid var(--divider)' }}>
          <h2 className="text-sm font-bold" style={{ color:'var(--t1)' }}>
            {editing ? `Editar grupo — ${group.name}` : 'Nuevo Grupo'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg transition-colors"
            style={{ color:'var(--t3)' }}
            onMouseEnter={e => e.currentTarget.style.color='var(--t1)'}
            onMouseLeave={e => e.currentTarget.style.color='var(--t3)'}>
            <X size={15}/>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{color:'var(--t3)'}}>Curso</label>
            <select value={form.curso} onChange={e=>setForm(f => ({
              ...f,
              curso:e.target.value,
              instituciones:e.target.value === 'ecoems' ? [] : (f.instituciones.length ? f.instituciones : ['unam']),
            }))} className="input-field" required>
              <option value="ecoems">ECOEMS</option><option value="universidad">Universidad</option>
            </select>
          </div>
          {[
            { label:'Nombre del grupo', key:'name', placeholder:'Ej. Grupo D', required:true },
            { label:'Horario', key:'schedule', placeholder:'Ej. Lun / Mié  08:00 – 09:30' },
            { label:'Aula', key:'room', placeholder:'Ej. Aula 201' },
          ].map(f => (
            <div key={f.key}>
              <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5"
                style={{ color:'var(--t3)' }}>{f.label}</label>
              <input required={f.required} value={form[f.key]} onChange={e=>set(f.key,e.target.value)}
                placeholder={f.placeholder} className="input-field"/>
            </div>
          ))}

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5"
              style={{ color:'var(--t3)' }}>Sucursal</label>
            {/* Selector, ya no texto libre. `groups.sucursal` pasó a ser clave
                foránea contra el catálogo: un valor escrito a mano —una errata,
                un código viejo tipo CN1— ya no se guarda, revienta al enviar.
                Con la lista cerrada el error no se puede cometer. */}
            <select value={form.sucursal} onChange={e=>set('sucursal', e.target.value)}
              className="input-field">
              {catalogoSucursales.length === 0 && (
                <option value="">Cargando sucursales…</option>
              )}
              {catalogoSucursales.map(s => (
                <option key={s.id} value={s.id}>{s.nombre}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest mb-2"
              style={{ color:'var(--t3)' }}>Apariencia de la tarjeta</label>
            <div className="rounded-2xl p-3 space-y-3" style={{background:'var(--soft-bg)',border:'1px solid var(--card-border)'}}>
              {[
                ['Degradados', GRADIENT_PALETTES],
                ['Colores sólidos', SOLID_PALETTES],
                ['Mate', MATE_PALETTES],
              ].map(([titulo,paletas]) => {
                const visibles = showMoreColors ? paletas : paletas.slice(0, 5)
                return <div key={titulo}>
                  <p className="text-[9px] font-bold uppercase tracking-widest mb-2" style={{color:'var(--t3)'}}>{titulo}</p>
                  <div className="flex flex-wrap gap-2">
                    {visibles.map(p => <button key={p.id} type="button" title={p.name}
                      aria-label={`${titulo}: ${p.name}`} aria-pressed={selectedPalette === p.id}
                      onClick={() => { setSelectedPalette(p.id); set('color', p.accent) }}
                      className="relative w-10 h-10 sm:w-11 sm:h-11 flex-none rounded-xl overflow-hidden transition-transform active:scale-95"
                      style={{
                        background:p.type === 'gradient' ? `linear-gradient(135deg, ${p.colors[0]}, ${p.colors[1]}, ${p.colors[3]})` : p.accent,
                        border:selectedPalette === p.id?'3px solid #fff':'1px solid var(--card-border)',
                        boxShadow:selectedPalette === p.id?'0 0 0 2px var(--accent)':'none',
                      }}>
                      {selectedPalette === p.id && <Check size={14} className="absolute inset-0 m-auto text-white drop-shadow" strokeWidth={3}/>}
                    </button>)}
                  </div>
                </div>
              })}
            </div>
            <button type="button" onClick={() => setShowMoreColors(v => !v)}
              className="mt-2 min-h-11 px-3 rounded-xl inline-flex items-center gap-2 text-xs font-bold"
              style={{color:'var(--accent)',background:'var(--soft-bg)',border:'1px solid var(--card-border)'}}>
              {showMoreColors ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
              {showMoreColors ? 'Ver menos' : `Ver más colores (${COLOR_PALETTES.length - 15})`}
            </button>
          </div>

          {/* Selector visual del icono. Los cuatro usan exactamente el mismo
              marco para que las proporciones distintas de cada escudo no
              cambien el peso visual ni el área táctil. */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest mb-2"
              style={{ color:'var(--t3)' }}>Icono del grupo</label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              {ICONOS_GRUPO.map(inst => {
                const activo = inst.id === 'ecoems'
                  ? form.curso === 'ecoems'
                  : inst.id === 'universidad'
                    ? form.curso === 'universidad' && form.instituciones.length > 1
                    : form.curso === 'universidad' && form.instituciones.length === 1 && form.instituciones[0] === inst.id
                const logo = inst.src ? {src:inst.src,alt:inst.alt} : logoInstitucion(inst.id)
                return (
                  <button key={inst.id} type="button"
                    aria-pressed={activo}
                    onClick={() => setForm(f => ({
                      ...f,
                      curso:inst.id === 'ecoems' ? 'ecoems' : 'universidad',
                      instituciones:inst.id === 'ecoems' ? [] : inst.id === 'universidad' ? ['unam','uam','ipn'] : [inst.id],
                    }))}
                    title={logo?.alt}
                    className="min-h-[104px] rounded-2xl flex flex-col items-center justify-center gap-2 p-2.5 transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2"
                    style={{
                      background: activo ? 'var(--accent)' : 'var(--soft-bg)',
                      border: activo ? '2px solid var(--accent)' : '1px solid var(--card-border)',
                      boxShadow: activo ? '0 8px 24px color-mix(in srgb, var(--accent) 28%, transparent)' : 'none',
                    }}>
                    <span className="w-[4.5rem] h-[4.5rem] flex items-center justify-center p-1 flex-shrink-0 overflow-hidden">
                      <img src={logo.src} alt={logo.alt}
                        className="w-full h-full object-contain"
                        style={{transform:`scale(${inst.id === 'universidad' ? 1.72 : ESCALA_ICONO[inst.id] ?? 1})`,transformOrigin:'center',filter:inst.id==='universidad'?'brightness(0) invert(1)':undefined}}/>
                    </span>
                    <span className="text-[10px] font-extrabold leading-none truncate w-full text-center"
                      style={{ color: activo ? 'var(--accent-contrast)' : 'var(--t2)' }}>
                      {logo.alt}
                    </span>
                  </button>
                )
              })}
            </div>
            <p className="text-[10px] mt-2" style={{color:'var(--t4)'}}>Elige ECOEMS, UNAM, IPN, UAM o el emblema Universidad incluido en el reporte.</p>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg px-3 py-2"
              style={{ background:'var(--bad-soft)', border:'1px solid var(--bad-line)' }}>
              <AlertCircle size={13} className="mt-0.5 shrink-0 text-red-400"/>
              <span className="text-xs text-red-400">{error}</span>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Cancelar</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
              {editing ? <Pencil size={14}/> : <Plus size={14}/>}
              {saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear grupo'}
            </button>
          </div>
        </form>
    </ModalPortal>
  )
}

export default function Groups() {
  const navigate      = useNavigate()
  const { getAccent, getPaletteId, setGroupPalette } = useGroupColors()
  const { currentUser, allowedSucursales, canAccess } = useAuth()
  const { sucursales: catalogoSucursales, nombreDe } = useSucursales()
  const isAdmin = currentUser?.role === 'admin'

  const [groups, setGroups]     = useState([])
  const [students, setStudents] = useState([])
  const [attendance, setAttendance] = useState({})
  const [loading, setLoading]   = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [formFor, setFormFor]   = useState(null)   // { group } | { group:null } para alta
  const [deleteFor, setDeleteFor] = useState(null)
  const [addStudentTo, setAddStudentTo] = useState(null)  // grupo al que se le agrega alumno
  const [lastCred, setLastCred] = useState(null)
  /* La sucursal ya no arranca en «todas»: se hereda de la vista anterior o
     cae en la primera a la que se tiene acceso. Ver useSucursalActiva. */
  const { sucursal, setSucursal, opcionesConTodas } = useSucursalActiva()
  const [curso, setCurso] = useState('todos')
  const [buscaGrupo, setBuscaGrupo] = useState('')
  const [cardColumns, setCardColumns] = useState(1)

  const load = useCallback(async () => {
    try {
      const [grs, sts] = await Promise.all([fetchGroups(), fetchStudents()])
      const stats = await fetchAttendanceStats(sts)
      setGroups(grs)
      setStudents(sts)
      setAttendance(stats.byGroup)
      setLoadError(null)
    } catch {
      setLoadError('No se pudieron cargar los grupos.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const visibleGroups = isAdmin ? groups : groups.filter(g => canAccess(g.sucursal, g.id))
  const sucursalOptions = catalogoSucursales
    .filter(s => isAdmin || allowedSucursales.includes(s.id))
    .map(s => s.id)
  const bySucursal = sucursal === TODAS ? visibleGroups : visibleGroups.filter(g => g.sucursal === sucursal)
  const porCurso = curso === 'todos' ? bySucursal : bySucursal.filter(g=>g.curso===curso)
  const filteredGroups = filtrarGrupos(porCurso, buscaGrupo)
  const filteredStudents = students.filter(s => filteredGroups.some(g => g.id === s.groupId))

  const globalGrades = filteredStudents.map(s => s.avgGrade).filter(Number.isFinite)
  const globalAvg = globalGrades.length
    ? (globalGrades.reduce((a,b) => a+b, 0) / globalGrades.length).toFixed(1)
    : '—'

  return (
    <div className="space-y-5">
      {formFor && (
        <GroupFormModal
          group={formFor.group}
          sucursales={sucursalOptions}
          paletteId={formFor.group ? getPaletteId(formFor.group.id) : 'ocean'}
          onClose={() => setFormFor(null)}
          onSaved={async ({groupId,paletteId}) => {
            if (groupId) setGroupPalette(groupId, paletteId)
            await load()
          }}
        />
      )}
      {deleteFor && (
        <ConfirmDialog
          title="Eliminar grupo"
          message={`Se eliminará el grupo ${deleteFor.name}.`}
          detail="Solo se puede eliminar si no tiene alumnos asignados."
          onConfirm={async () => {
            const res = await deleteGroup(deleteFor.id)
            if (res.ok) await load()
            return res
          }}
          onClose={() => setDeleteFor(null)}
        />
      )}
      {addStudentTo && (
        <StudentFormModal
          groups={visibleGroups}
          defaultGroupId={addStudentTo.id}
          onClose={() => setAddStudentTo(null)}
          onSaved={cred => { if (cred) setLastCred(cred); load() }}
        />
      )}

      {lastCred && <CredentialsPanel cred={lastCred} onClose={() => setLastCred(null)}/>}

      {/* Misma barra que el resto del panel: una entrada a los filtros, las
          fichas de lo que está puesto y la búsqueda con coincidencias. */}
      <BarraFiltros
        filtros={[
          { id:'sucursal', label:'Sucursal', value:sucursal, onChange:setSucursal,
            porDefecto:sucursal, options:opcionesConTodas },
          { id:'curso', label:'Vertiente', value:curso, onChange:setCurso, porDefecto:'todos',
            options:[
              { value:'todos', label:`Todas (${bySucursal.length})` },
              { value:'ecoems', label:`ECOEMS (${bySucursal.filter(g=>g.curso==='ecoems').length})` },
              { value:'universidad', label:`Universidad (${bySucursal.filter(g=>g.curso==='universidad').length})` },
            ] },
        ]}
        busqueda={{
          value: buscaGrupo,
          onChange: setBuscaGrupo,
          placeholder: 'Buscar grupo por nombre',
          coincidencias: filtrarGrupos(porCurso, buscaGrupo).map(g => ({
            id:g.id, label:g.name, sub:[g.subject, g.sucursal ? nombreDe(g.sucursal) : null].filter(Boolean).join(' · '),
          })),
          onElegir: () => {},
        }}
        resumen={`${filteredGroups.length} grupo(s)`}
        acciones={
          <div className="flex items-center gap-2 flex-shrink-0">
            <button type="button" onClick={() => setCardColumns(v => v === 1 ? 2 : 1)}
              className="btn-secondary p-2.5" title={cardColumns === 1 ? 'Mostrar dos columnas' : 'Mostrar una columna'}
              aria-label={cardColumns === 1 ? 'Mostrar dos columnas' : 'Mostrar una columna'}>
              {cardColumns === 1 ? <Columns2 size={16}/> : <Rows3 size={16}/>}
            </button>
            {isAdmin && (
              <button onClick={() => setFormFor({ group: null })} className="btn-primary">
                <Plus size={14}/> <span className="hidden sm:inline">Nuevo grupo</span>
              </button>
            )}
          </div>
        }>
        {/* La vertiente también como botones: es el corte que más se usa y con
            el escudo delante se reconoce sin leer. */}
        <div className="flex items-center gap-1 p-1 rounded-xl w-fit max-w-full overflow-x-auto"
          style={{ background:'var(--soft-bg)', border:'1px solid var(--card-border)' }}
          role="group" aria-label="Filtrar por vertiente">
          {[
            { value:'todos', label:'Todos', icon:null },
            { value:'ecoems', label:'ECOEMS', icon:<IconoCurso curso="ecoems" size={16}/> },
            { value:'universidad', label:'Universidad', icon:<IconoCurso curso="universidad" size={16}/> },
          ].map(o => {
            const activo = curso === o.value
            const n = o.value === 'todos' ? bySucursal.length : bySucursal.filter(g => g.curso === o.value).length
            return (
              <button key={o.value} type="button" onClick={() => setCurso(o.value)}
                aria-pressed={activo}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95 flex-shrink-0"
                style={activo
                  ? { background:'var(--accent)', color:'var(--accent-contrast)' }
                  : { background:'transparent', color:'var(--t3)' }}>
                {o.icon}
                <span>{o.label}</span>
                <span className="text-[10px] font-black opacity-70">{n}</span>
              </button>
            )
          })}
        </div>
      </BarraFiltros>

      {loadError && (
        <div className="card p-4 flex items-center gap-2">
          <AlertCircle size={14} className="text-red-400"/>
          <span className="text-xs text-red-400">{loadError}</span>
        </div>
      )}

      {/* Summary */}
      <div data-kpi-grid className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-4">
        <KpiCard icon={BookOpen} label="Total Grupos" tone="neutral" value={filteredGroups.length}
          sub={sucursal === 'todas' ? 'Todas las sucursales' : `Sucursal ${nombreDe(sucursal)}`} />
        <KpiCard icon={Users} label="Total Alumnos" tone="info" value={filteredStudents.length}
          sub={`En ${filteredGroups.length} grupo(s)`} />
        <KpiCard icon={TrendingUp} label="Promedio Global" tone="good" value={globalAvg}
          sub={globalAvg === '—' ? 'Sin calificaciones aún' : `${globalGrades.length} alumno(s) con calificación`}
          pill={globalAvg === '—' ? null
            : { icon: Star, text: Number(globalAvg) >= 8.5 ? '¡Muy bien!' : Number(globalAvg) >= 7 ? 'Aceptable' : 'Requiere atención' }} />
      </div>

      {/* Group cards */}
      {!loading && filteredGroups.length === 0 && (
        <div className="card p-8 text-center">
          <p className="text-sm" style={{ color:'var(--t2)' }}>
            No hay grupos todavía. Crea el primero con “Nuevo grupo”.
          </p>
        </div>
      )}

      <ProgressiveList items={filteredGroups} className={`grid gap-4 ${cardColumns === 2 ? 'lg:grid-cols-2' : 'grid-cols-1'}`}
        sizes={{ mobile: 3, tablet: 6, desktop: 10 }}
        emptyLabel="No hay grupos con ese criterio.">
        {g => {
          const stats       = computeGroupStats(g, students, attendance)
          const grpStudents = students.filter(s => s.groupId === g.id)
          const critical    = grpStudents.filter(s => s.status === 'critical' || s.status === 'at-risk').length

          return (
            <GroupShaderCard
              key={g.id}
              group={g}
              onClick={() => navigate(`/admin/grupos/${g.id}`)}
              showPicker={false}
              footer={
                <>
                  {/* Metrics */}
                  <div className="flex sm:grid sm:grid-cols-2 items-center gap-4 sm:gap-3 pt-2.5 mb-2.5 sm:pt-4 sm:mb-4"
                    style={{ borderTop:'1px solid var(--divider)' }}>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider mb-0 sm:mb-1.5" style={{ color:'var(--t3)' }}>
                        <span className="sm:hidden">Prom.</span>
                        <span className="hidden sm:inline">Promedio del grupo</span>
                      </p>
                      <div className="hidden sm:block">
                        <MetricBar value={stats.avgGrade} max={10} thresholds={[8.5, 7]} />
                      </div>
                      <p className="sm:hidden text-base font-bold tabular-nums leading-none" style={{ color:'var(--t1)' }}>
                        {stats.avgGrade ?? '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider mb-1 sm:mb-1.5" style={{ color:'var(--t3)' }}>
                        Asistencia
                      </p>
                      <div className="hidden sm:block">
                        <MetricBar value={stats.attendanceRate} max={100} suffix="%" thresholds={[90, 80]} />
                      </div>
                      <p className="sm:hidden text-base font-bold tabular-nums leading-none" style={{ color:'var(--t1)' }}>
                        {stats.attendanceRate === null || stats.attendanceRate === undefined ? '—' : `${stats.attendanceRate}%`}
                      </p>
                      <span className="sm:hidden flex-1"/>
                    </div>
                  </div>

                  {/* Avatares + botón */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3">
                    <StudentDock students={grpStudents} accent={getAccent(g.id)}
                      onOpenStudent={id=>navigate(`/admin/alumnos/${id}`)}/>
                    <div className="flex items-center gap-1.5 flex-shrink-0 self-end sm:self-auto">
                      {isAdmin && [
                        { icon: UserPlus, title: 'Añadir alumno a este grupo', hover: 'var(--good)', act: () => setAddStudentTo(g) },
                        { icon: Pencil, title: 'Editar grupo',   hover: 'var(--info)', act: () => setFormFor({ group: g }) },
                        { icon: Trash2, title: 'Eliminar grupo', hover: 'var(--bad)', act: () => setDeleteFor(g) },
                      ].map(({ icon: Icon, title, hover, act }) => (
                        <button key={title} title={title}
                          onClick={e => { e.stopPropagation(); act() }}
                          className="w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 active:scale-90"
                          style={{ color:'var(--t2)',background:'var(--soft-bg)',border:'1px solid var(--card-border)' }}
                          onMouseEnter={e => {e.currentTarget.style.color = hover;e.currentTarget.style.transform='translateY(-2px) scale(1.06)'}}
                          onMouseLeave={e => {e.currentTarget.style.color = 'var(--t2)';e.currentTarget.style.transform='none'}}>
                          <Icon size={18}/>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              }>

              {/* Header info */}
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-base font-bold truncate" style={{ color:'var(--t1)' }}>{g.name}</h3>
                    <p className="text-sm mt-0.5 truncate" style={{ color:'var(--t2)' }}>
                      {g.subject}
                      <span className="sm:hidden" style={{ color:'var(--t3)' }}> · {stats.studentCount} alumnos</span>
                    </p>
                  </div>
                  {critical > 0 && (
                    <span className="badge bg-red-500/15 text-red-400 border border-red-500/25 flex-shrink-0 text-[11px]">
                      {critical} en riesgo
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 sm:mt-2 text-xs" style={{ color:'var(--t3)' }}>
                  {g.schedule && <span className="hidden sm:flex items-center gap-1.5"><Clock size={11}/>{g.schedule}</span>}
                  {g.room && <span className="hidden sm:flex items-center gap-1.5"><MapPin size={11}/>{g.room}</span>}
                  <span className="hidden sm:flex items-center gap-1.5"><Users size={11}/>{stats.studentCount} alumnos</span>
                </div>
              </div>
            </GroupShaderCard>
          )
        }}
      </ProgressiveList>
    </div>
  )
}
