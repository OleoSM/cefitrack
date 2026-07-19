import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, Clock, MapPin, ArrowRight, Filter } from 'lucide-react'
import { groups, students } from '../../data/mockData'
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

function GradeBar({ value }) {
  const color = value >= 8.5 ? '#34d399' : value >= 7 ? '#60a5fa' : '#fbbf24'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background:'rgba(255,255,255,.10)' }}>
        <div className="h-full rounded-full" style={{ width:`${(value/10)*100}%`, background:color }} />
      </div>
      <span className="text-xs font-bold" style={{ color:'rgba(255,255,255,.70)' }}>{value}</span>
    </div>
  )
}

function AttBar({ value }) {
  const color = value >= 90 ? '#34d399' : value >= 80 ? '#60a5fa' : '#fbbf24'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background:'rgba(255,255,255,.10)' }}>
        <div className="h-full rounded-full" style={{ width:`${value}%`, background:color }} />
      </div>
      <span className="text-xs font-bold" style={{ color:'rgba(255,255,255,.70)' }}>{value}%</span>
    </div>
  )
}

export default function Groups() {
  const navigate      = useNavigate()
  const { getAccent } = useGroupColors()
  const { currentUser, allowedSucursales, canAccess } = useAuth()
  const isAdmin = currentUser?.role === 'admin'

  const visibleGroups = isAdmin ? groups : groups.filter(g => canAccess(g.sucursal, g.id))
  const sucursalOptions = isAdmin ? [...new Set(groups.map(g => g.sucursal))] : allowedSucursales

  const [sucursal, setSucursal] = useState('todas')
  const filteredGroups = sucursal === 'todas' ? visibleGroups : visibleGroups.filter(g => g.sucursal === sucursal)
  const filteredStudents = students.filter(s => filteredGroups.some(g => g.id === s.groupId))

  return (
    <div className="max-w-5xl space-y-5">
      {/* Filtro sucursal */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter size={14} style={{ color:'rgba(255,255,255,.35)' }} />
        <FilterSelect value={sucursal} onChange={setSucursal}
          options={[{ value:'todas', label: isAdmin ? 'Todas las sucursales' : 'Mis sucursales' }, ...sucursalOptions.map(s => ({ value:s, label:s }))]} />
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label:'Total Grupos',    value:filteredGroups.length },
          { label:'Total Alumnos',   value:filteredStudents.length },
          { label:'Promedio Global', value:'8.2' },
        ].map(({ label, value }) => (
          <div key={label} className="stat-card text-center">
            <p className="text-3xl font-bold" style={{ color:'rgba(255,255,255,.90)' }}>{value}</p>
            <p className="text-sm mt-1" style={{ color:'rgba(255,255,255,.40)' }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Group cards */}
      <div className="grid gap-4">
        {filteredGroups.map(g => {
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
                      <GradeBar value={g.avgGrade} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color:'rgba(255,255,255,.28)' }}>
                        Asistencia
                      </p>
                      <AttBar value={g.attendanceRate} />
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
                    <button
                      onClick={e => { e.stopPropagation(); navigate(`/admin/grupos/${g.id}`) }}
                      className="btn-secondary text-xs py-1.5 flex-shrink-0">
                      Ver grupo <ArrowRight size={13}/>
                    </button>
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
                  <span className="flex items-center gap-1.5"><Clock size={11}/>{g.schedule}</span>
                  <span className="flex items-center gap-1.5"><MapPin size={11}/>{g.room}</span>
                  <span className="flex items-center gap-1.5"><Users size={11}/>{g.studentCount} alumnos</span>
                </div>
              </div>
            </GroupShaderCard>
          )
        })}
      </div>
    </div>
  )
}
