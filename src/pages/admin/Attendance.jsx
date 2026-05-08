import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle, XCircle, Clock, FileCheck, Save, ChevronDown, Users, QrCode, ScanLine } from 'lucide-react'
import { groups, students, attendanceColors } from '../../data/mockData'
import clsx from 'clsx'

const STATUS_OPTS = [
  { key:'presente',    label:'Presente',    icon:CheckCircle, color:'text-emerald-600', activeBg:'bg-emerald-500' },
  { key:'tardanza',    label:'Tardanza',    icon:Clock,       color:'text-amber-600',   activeBg:'bg-amber-500'   },
  { key:'ausente',     label:'Ausente',     icon:XCircle,     color:'text-red-600',     activeBg:'bg-red-500'     },
  { key:'justificado', label:'Justificado', icon:FileCheck,   color:'text-blue-600',    activeBg:'bg-blue-500'    },
]

function today() {
  return new Date().toISOString().split('T')[0]
}

export default function Attendance() {
  const navigate = useNavigate()
  const [selectedGroup, setSelectedGroup] = useState('g1')
  const [date, setDate] = useState(today())
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [records, setRecords] = useState(() => {
    const grpStudents = students.filter(s => s.groupId === 'g1')
    return Object.fromEntries(grpStudents.map(s => [s.id, 'presente']))
  })

  const grpStudents = students.filter(s => s.groupId === selectedGroup)

  const handleGroupChange = gid => {
    setSelectedGroup(gid)
    setSaved(false)
    const newRec = Object.fromEntries(students.filter(s => s.groupId === gid).map(s => [s.id, 'presente']))
    setRecords(newRec)
  }

  const setStatus = (sid, status) => {
    setSaved(false)
    setRecords(r => ({ ...r, [sid]: status }))
  }

  const markAll = status => {
    setSaved(false)
    const upd = {}
    grpStudents.forEach(s => { upd[s.id] = status })
    setRecords(r => ({ ...r, ...upd }))
  }

  const handleSave = async () => {
    setSaving(true)
    await new Promise(r => setTimeout(r, 800))
    setSaving(false)
    setSaved(true)
  }

  const counts = STATUS_OPTS.reduce((acc, o) => {
    acc[o.key] = grpStudents.filter(s => records[s.id] === o.key).length
    return acc
  }, {})
  const marked = Object.values(records).filter(Boolean).length
  const grp = groups.find(g => g.id === selectedGroup)

  return (
    <div className="max-w-4xl space-y-5">

      {/* QR options grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Option A: teacher scans student */}
        <button onClick={() => navigate('/admin/asistencias/qr')}
          className="rounded-2xl bg-gradient-to-br from-navy-900 to-navy-700 p-4 flex items-center gap-3 text-white hover:from-navy-800 hover:to-navy-600 transition-all group text-left">
          <div className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0 group-hover:bg-white/20 transition-colors">
            <QrCode size={22} className="text-gold-300"/>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm">Yo escaneo el QR del alumno</p>
            <p className="text-navy-300 text-xs mt-0.5">Apunto mi cámara al código de cada alumno.</p>
          </div>
          <span className="text-gold-400 text-xs font-bold flex-shrink-0">→</span>
        </button>

        {/* Option B: student scans teacher QR */}
        <button onClick={() => navigate('/admin/asistencias/qr-sesion')}
          className="rounded-2xl bg-gradient-to-br from-emerald-700 to-emerald-600 p-4 flex items-center gap-3 text-white hover:from-emerald-600 hover:to-emerald-500 transition-all group text-left">
          <div className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0 group-hover:bg-white/20 transition-colors">
            <ScanLine size={22} className="text-emerald-200"/>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm">El alumno escanea mi QR</p>
            <p className="text-emerald-200 text-xs mt-0.5">Muestro un QR en la entrada y ellos lo escanean.</p>
          </div>
          <span className="text-emerald-300 text-xs font-bold flex-shrink-0">→</span>
        </button>
      </div>

      {/* Divider */}
      <div className="flex items-center gap-3 text-slate-400 text-xs font-medium">
        <div className="flex-1 h-px bg-slate-200"/>
        O bien, pasa lista manualmente
        <div className="flex-1 h-px bg-slate-200"/>
      </div>

      {/* Header controls */}
      <div className="card p-5">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Grupo</label>
            <div className="relative">
              <select value={selectedGroup} onChange={e => handleGroupChange(e.target.value)}
                className="input-field pr-9 appearance-none font-medium">
                {groups.map(g => (
                  <option key={g.id} value={g.id}>{g.name} — {g.subject}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Fecha</label>
            <input type="date" value={date} onChange={e=>setDate(e.target.value)} className="input-field font-medium" />
          </div>
          <button onClick={handleSave} disabled={saving || saved}
            className={clsx('btn-primary flex-shrink-0 h-10', saved && 'bg-emerald-600 hover:bg-emerald-600')}>
            {saving
              ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Guardando...</>
              : saved
                ? <><CheckCircle size={16}/>Lista guardada</>
                : <><Save size={16}/>Guardar lista</>}
          </button>
        </div>

        {/* Summary pills */}
        <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-slate-100">
          <div className="flex items-center gap-1.5 text-sm text-slate-600">
            <Users size={15} className="text-slate-400"/>
            <span className="font-semibold text-slate-800">{grpStudents.length}</span> alumnos ·
            <span className="font-semibold text-slate-800">{marked}</span> marcados
          </div>
          {STATUS_OPTS.map(o => (
            <div key={o.key} className={`badge border ${attendanceColors[o.key].bg} ${attendanceColors[o.key].text}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${attendanceColors[o.key].dot}`}/>
              {counts[o.key]} {o.label}s
            </div>
          ))}
        </div>
      </div>

      {/* Quick mark all */}
      <div className="flex gap-2 flex-wrap">
        <span className="text-xs text-slate-500 font-medium self-center mr-1">Marcar todos como:</span>
        {STATUS_OPTS.map(o => (
          <button key={o.key} onClick={() => markAll(o.key)}
            className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300 bg-white font-medium text-slate-700 hover:bg-slate-50 transition-colors">
            {o.label}
          </button>
        ))}
      </div>

      {/* Student list */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: grp?.color || '#3b82f6' }} />
          <h2 className="text-sm font-semibold text-slate-700">{grp?.name} — {grp?.subject}</h2>
          <span className="ml-auto text-xs text-slate-400">{new Date(date + 'T12:00').toLocaleDateString('es-MX',{ weekday:'long', day:'numeric', month:'long' })}</span>
        </div>

        <div className="divide-y divide-slate-50">
          {grpStudents.map((s, i) => {
            const cur = records[s.id] || 'presente'
            return (
              <div key={s.id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50/50 transition-colors">
                <span className="text-xs text-slate-400 w-5 font-mono">{i+1}</span>
                <div className="w-9 h-9 rounded-full bg-navy-100 flex items-center justify-center text-navy-800 text-xs font-bold flex-shrink-0">
                  {s.name.split(' ').slice(0,2).map(n=>n[0]).join('')}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800">{s.name}</p>
                  <p className="text-xs text-slate-400">Asist. histórica: {s.attendanceRate}%</p>
                </div>

                {/* Status buttons */}
                <div className="flex gap-1.5">
                  {STATUS_OPTS.map(o => {
                    const active = cur === o.key
                    return (
                      <button key={o.key} onClick={() => setStatus(s.id, o.key)}
                        title={o.label}
                        className={clsx(
                          'w-9 h-9 rounded-lg flex items-center justify-center transition-all',
                          active
                            ? `${o.activeBg} text-white shadow-sm scale-105`
                            : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                        )}>
                        <o.icon size={16} />
                      </button>
                    )
                  })}
                </div>

                {/* Status label */}
                <div className={`hidden sm:flex badge w-24 justify-center flex-shrink-0 ${attendanceColors[cur].bg} ${attendanceColors[cur].text}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${attendanceColors[cur].dot}`}/>
                  {attendanceColors[cur].label}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
