import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, Clock, MapPin, ArrowRight, Filter, Plus, X, AlertCircle, Pencil, Trash2, UserPlus } from 'lucide-react'
import {
  fetchGroups, fetchStudents, fetchAttendanceStats,
  computeGroupStats, createGroup, updateGroup, deleteGroup,
} from '../../lib/supabaseData'
import ConfirmDialog from '../../components/admin/ConfirmDialog'
import ModalPortal from '../../components/ui/ModalPortal'
import StudentFormModal from '../../components/admin/StudentFormModal'
import CredentialsPanel from '../../components/admin/CredentialsPanel'
import GroupShaderCard from '../../components/ui/GroupShaderCard'
import { useGroupColors } from '../../hooks/useGroupColors'
import { useAuth } from '../../context/AuthContext'

function FilterSelect({ value, onChange, options }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      className="text-xs font-semibold rounded-xl py-2 px-3 outline-none"
      style={{ background:'rgba(255,255,255,.07)', border:'1px solid rgba(255,255,255,.12)', color:'rgba(255,255,255,.85)' }}>
      {options.map(o => <option key={o.value} value={o.value} style={{ color:'#000', background:'#fff' }}>{o.label}</option>)}
    </select>
  )
}

/** Barra de métrica; muestra un guion cuando todavía no hay datos que promediar. */
function MetricBar({ value, max, suffix = '', thresholds }) {
  if (value === null || value === undefined) {
    return <span className="text-xs" style={{ color:'rgba(255,255,255,.30)' }}>Sin datos aún</span>
  }
  const color = value >= thresholds[0] ? '#34d399' : value >= thresholds[1] ? '#60a5fa' : '#fbbf24'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background:'rgba(255,255,255,.10)' }}>
        <div className="h-full rounded-full" style={{ width:`${(value/max)*100}%`, background:color }} />
      </div>
      <span className="text-xs font-bold" style={{ color:'rgba(255,255,255,.70)' }}>{value}{suffix}</span>
    </div>
  )
}

/* ── Modal de alta / edición de grupo ───────────────────────── */
const COLORES = ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#ec4899','#06b6d4']

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
          style={{ borderBottom:'1px solid rgba(255,255,255,.08)' }}>
          <h2 className="text-sm font-bold" style={{ color:'rgba(255,255,255,.85)' }}>
            {editing ? `Editar grupo — ${group.name}` : 'Nuevo Grupo'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg transition-colors"
            style={{ color:'rgba(255,255,255,.40)' }}
            onMouseEnter={e => e.currentTarget.style.color='white'}
            onMouseLeave={e => e.currentTarget.style.color='rgba(255,255,255,.40)'}>
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
                style={{ color:'rgba(255,255,255,.35)' }}>{f.label}</label>
              <input required={f.required} value={form[f.key]} onChange={e=>set(f.key,e.target.value)}
                placeholder={f.placeholder} className="input-field"/>
            </div>
          ))}

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5"
              style={{ color:'rgba(255,255,255,.35)' }}>Sucursal</label>
            <input value={form.sucursal} onChange={e=>set('sucursal',e.target.value)}
              placeholder="Ej. CN1" className="input-field" list="sucursales-existentes"/>
            <datalist id="sucursales-existentes">
              {sucursales.map(s => <option key={s} value={s}/>)}
            </datalist>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest mb-2"
              style={{ color:'rgba(255,255,255,.35)' }}>Color</label>
            <div className="flex gap-2">
              {COLORES.map(c => (
                <button key={c} type="button" onClick={() => set('color', c)}
                  className="w-7 h-7 rounded-lg transition-transform"
                  style={{
                    background:c,
                    transform: form.color === c ? 'scale(1.15)' : 'scale(1)',
                    border: form.color === c ? '2px solid rgba(255,255,255,.85)' : '2px solid transparent',
                  }}/>
              ))}
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg px-3 py-2"
              style={{ background:'rgba(239,68,68,.10)', border:'1px solid rgba(239,68,68,.30)' }}>
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
    <div className="max-w-5xl space-y-5">
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
        <Filter size={14} style={{ color:'rgba(255,255,255,.35)' }} />
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label:'Total Grupos',    value:filteredGroups.length },
          { label:'Total Alumnos',   value:filteredStudents.length },
          { label:'Promedio Global', value:globalAvg },
        ].map(({ label, value }) => (
          <div key={label} className="stat-card text-center">
            <p className="text-3xl font-bold" style={{ color:'rgba(255,255,255,.90)' }}>{value}</p>
            <p className="text-sm mt-1" style={{ color:'rgba(255,255,255,.40)' }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Group cards */}
      {!loading && filteredGroups.length === 0 && (
        <div className="card p-8 text-center">
          <p className="text-sm" style={{ color:'rgba(255,255,255,.45)' }}>
            No hay grupos todavía. Crea el primero con “Nuevo grupo”.
          </p>
        </div>
      )}

      <div className="grid gap-4">
        {filteredGroups.map(g => {
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4 mb-4"
                    style={{ borderTop:'1px solid rgba(255,255,255,.07)' }}>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color:'rgba(255,255,255,.28)' }}>
                        Promedio del grupo
                      </p>
                      <MetricBar value={stats.avgGrade} max={10} thresholds={[8.5, 7]} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color:'rgba(255,255,255,.28)' }}>
                        Asistencia
                      </p>
                      <MetricBar value={stats.attendanceRate} max={100} suffix="%" thresholds={[90, 80]} />
                    </div>
                  </div>

                  {/* Avatares + botón */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex -space-x-2 overflow-hidden">
                      {grpStudents.slice(0, 6).map(s => (
                        <div key={s.id}
                          className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                          style={{ background:'rgba(255,255,255,.12)', border:'2px solid #08080f', color:'rgba(255,255,255,.65)' }}>
                          {s.name.split(' ').map(n=>n[0]).join('').slice(0,2)}
                        </div>
                      ))}
                      {grpStudents.length > 6 && (
                        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-[10px] font-semibold flex-shrink-0"
                          style={{ background:'rgba(255,255,255,.08)', border:'2px solid #08080f', color:'rgba(255,255,255,.40)' }}>
                          +{grpStudents.length - 6}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {isAdmin && [
                        { icon: UserPlus, title: 'Añadir alumno a este grupo', hover: '#34d399', act: () => setAddStudentTo(g) },
                        { icon: Pencil, title: 'Editar grupo',   hover: '#60a5fa', act: () => setFormFor({ group: g }) },
                        { icon: Trash2, title: 'Eliminar grupo', hover: '#f87171', act: () => setDeleteFor(g) },
                      ].map(({ icon: Icon, title, hover, act }) => (
                        <button key={title} title={title}
                          onClick={e => { e.stopPropagation(); act() }}
                          className="p-1.5 rounded-lg transition-colors"
                          style={{ color:'rgba(255,255,255,.28)' }}
                          onMouseEnter={e => e.currentTarget.style.color = hover}
                          onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,.28)'}>
                          <Icon size={13}/>
                        </button>
                      ))}
                      <button
                        onClick={e => { e.stopPropagation(); navigate(`/admin/grupos/${g.id}`) }}
                        className="btn-secondary text-xs py-1.5">
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
                    <h3 className="text-base font-bold truncate" style={{ color:'rgba(255,255,255,.90)' }}>{g.name}</h3>
                    <p className="text-sm mt-0.5" style={{ color:'rgba(255,255,255,.45)' }}>{g.subject}</p>
                  </div>
                  {critical > 0 && (
                    <span className="badge bg-red-500/15 text-red-400 border border-red-500/25 flex-shrink-0 text-[11px]">
                      {critical} en riesgo
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs" style={{ color:'rgba(255,255,255,.35)' }}>
                  {g.schedule && <span className="flex items-center gap-1.5"><Clock size={11}/>{g.schedule}</span>}
                  {g.room && <span className="flex items-center gap-1.5"><MapPin size={11}/>{g.room}</span>}
                  <span className="flex items-center gap-1.5"><Users size={11}/>{stats.studentCount} alumnos</span>
                </div>
              </div>
            </GroupShaderCard>
          )
        })}
      </div>
    </div>
  )
}
