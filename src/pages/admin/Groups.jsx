import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, Clock, MapPin, ArrowRight, Filter, Plus, X, AlertCircle, Pencil, Trash2, UserPlus, BookOpen, TrendingUp, Star } from 'lucide-react'
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
import { useGroupColors } from '../../hooks/useGroupColors'
import ProgressiveList from '../../components/ui/ProgressiveList'
import { useAuth } from '../../context/AuthContext'

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
const COLORES = ['#2B5F9E','#2F6B41','#8A5A12','#5D3E90','#94356B','#1C6474']

function GroupFormModal({ group = null, sucursales, onClose, onSaved }) {
  const editing = !!group
  const [form, setForm] = useState({
    name:     group?.name ?? '',
    subject:  group?.subject ?? '',
    schedule: group?.schedule ?? '',
    room:     group?.room ?? '',
    color:    group?.color ?? COLORES[0],
    sucursal: group?.sucursal ?? (sucursales[0] ?? ''),
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState(null)
  const set = (k,v) => setForm(f => ({ ...f, [k]:v }))

  const handleSubmit = async e => {
    e.preventDefault()
    setSaving(true); setError(null)
    const payload = {
      name: form.name, subject: form.subject,
      schedule: form.schedule || null, room: form.room || null,
      color: form.color, sucursal: form.sucursal || null,
    }
    const res = editing
      ? await updateGroup({ id: group.id, ...payload })
      : await createGroup(payload)
    setSaving(false)
    if (!res.ok) { setError(res.message); return }
    onSaved()
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
          {[
            { label:'Nombre del grupo', key:'name', placeholder:'Ej. Grupo D', required:true },
            { label:'Materia', key:'subject', placeholder:'Ej. Cálculo Diferencial', required:true },
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
            <input value={form.sucursal} onChange={e=>set('sucursal',e.target.value)}
              placeholder="Ej. CN1" className="input-field" list="sucursales-existentes"/>
            <datalist id="sucursales-existentes">
              {sucursales.map(s => <option key={s} value={s}/>)}
            </datalist>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest mb-2"
              style={{ color:'var(--t3)' }}>Color</label>
            <div className="flex gap-2">
              {COLORES.map(c => (
                <button key={c} type="button" onClick={() => set('color', c)}
                  className="w-7 h-7 rounded-lg transition-transform"
                  style={{
                    background:c,
                    transform: form.color === c ? 'scale(1.15)' : 'scale(1)',
                    border: form.color === c ? '2px solid var(--card-border)' : '2px solid transparent',
                  }}/>
              ))}
            </div>
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
  const { getAccent } = useGroupColors()
  const { currentUser, allowedSucursales, canAccess } = useAuth()
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
  const [sucursal, setSucursal] = useState('todas')

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
  const sucursalOptions = isAdmin
    ? [...new Set(groups.map(g => g.sucursal).filter(Boolean))]
    : allowedSucursales
  const filteredGroups = sucursal === 'todas' ? visibleGroups : visibleGroups.filter(g => g.sucursal === sucursal)
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
          onClose={() => setFormFor(null)}
          onSaved={load}
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

      {/* Filtro sucursal + alta */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter size={14} style={{ color:'var(--t3)' }} />
        <FilterSelect value={sucursal} onChange={setSucursal}
          options={[{ value:'todas', label: isAdmin ? 'Todas las sucursales' : 'Mis sucursales' }, ...sucursalOptions.map(s => ({ value:s, label:s }))]} />
        {isAdmin && (
          <button onClick={() => setFormFor({ group: null })} className="btn-primary ml-auto">
            <Plus size={14}/> Nuevo grupo
          </button>
        )}
      </div>

      {loadError && (
        <div className="card p-4 flex items-center gap-2">
          <AlertCircle size={14} className="text-red-400"/>
          <span className="text-xs text-red-400">{loadError}</span>
        </div>
      )}

      {/* Summary */}
      <div data-kpi-grid className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-4">
        <KpiCard icon={BookOpen} label="Total Grupos" tone="neutral" value={filteredGroups.length}
          sub={sucursal === 'todas' ? 'Todas las sucursales' : `Sucursal ${sucursal}`} />
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

      <ProgressiveList items={filteredGroups} className="grid gap-4"
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
              showPicker
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
                  <div className="flex items-center justify-end sm:justify-between gap-3">
                    <div className="hidden sm:flex -space-x-2 overflow-hidden">
                      {grpStudents.slice(0, 6).map(s => (
                        <div key={s.id}
                          className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                          style={{ background:'var(--soft-bg)', border:'2px solid var(--card-bg)', color:'var(--t2)' }}>
                          {s.name.split(' ').map(n=>n[0]).join('').slice(0,2)}
                        </div>
                      ))}
                      {grpStudents.length > 6 && (
                        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-[10px] font-semibold flex-shrink-0"
                          style={{ background:'var(--soft-bg)', border:'2px solid var(--card-bg)', color:'var(--t3)' }}>
                          +{grpStudents.length - 6}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {isAdmin && [
                        { icon: UserPlus, title: 'Añadir alumno a este grupo', hover: 'var(--good)', act: () => setAddStudentTo(g) },
                        { icon: Pencil, title: 'Editar grupo',   hover: 'var(--info)', act: () => setFormFor({ group: g }) },
                        { icon: Trash2, title: 'Eliminar grupo', hover: 'var(--bad)', act: () => setDeleteFor(g) },
                      ].map(({ icon: Icon, title, hover, act }) => (
                        <button key={title} title={title}
                          onClick={e => { e.stopPropagation(); act() }}
                          className="p-1.5 rounded-lg transition-colors"
                          style={{ color:'var(--t3)' }}
                          onMouseEnter={e => e.currentTarget.style.color = hover}
                          onMouseLeave={e => e.currentTarget.style.color = 'var(--t3)'}>
                          <Icon size={13}/>
                        </button>
                      ))}
                      {/* En móvil sobra: la tarjeta entera ya navega al grupo,
                          y repetir la acción cuesta una fila completa. */}
                      <button
                        onClick={e => { e.stopPropagation(); navigate(`/admin/grupos/${g.id}`) }}
                        className="btn-secondary text-xs py-1.5 hidden sm:inline-flex">
                        Ver grupo <ArrowRight size={13}/>
                      </button>
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
