import { useState, useMemo, useRef, useEffect, useCallback, createContext, useContext } from 'react'
import AvatarAlumno from '../../components/ui/AvatarAlumno'
import { createPortal } from 'react-dom'
import {
  Plus, Minus, Trash2, Check, ChevronDown, ChevronRight,
  UserPlus, X, GraduationCap, Maximize2, SlidersHorizontal,
  ArrowLeft, Calendar, Shield, Users, Clock,
  Save, AlertTriangle, RotateCw, Download, Pencil, Search, Columns2, Rows3,
} from 'lucide-react'
import clsx from 'clsx'
import {
  fetchGroups, fetchStudents,
  fetchColumnasRegistro, fetchCeldasRegistro, fetchAsistenciaRegistro,
  setCeldaRegistro, crearColumnaRegistro, borrarColumnaRegistro, setRegistroAdmin,
} from '../../lib/supabaseData'
import GroupShaderCard from '../../components/ui/GroupShaderCard'
import { useGroupColors } from '../../hooks/useGroupColors'
import { useBreakpoint } from '../../hooks/useBreakpoint'
import { NeonCheckbox } from '../../components/ui/NeonCheckbox'
import { useAdminTheme } from '../../context/AdminThemeContext'
import { folioEX, folioEXD } from '../../lib/folios'
import { supabase } from '../../lib/supabaseClient'
import { useSucursales } from '../../hooks/useSucursales'
import { fetchDocumentosAlumnos } from '../../lib/expedienteData'
import StudentFormModal from '../../components/admin/StudentFormModal'
import CredentialsPanel from '../../components/admin/CredentialsPanel'

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const PAY_OPTIONS = ['Liquidado', 'Al corriente']
const MONTHS_ES   = ['Enero','Febrero','Marzo','Abril','Mayo','Junio']
const DOW_LABELS  = ['L','M','Mi','J','V']
const SOLID_BG    = '#0a0a14'  // fondo sólido para celdas sticky (neon mode)

/* ── Alto contraste: color por sección ── */
const HC = {
  bg:     '#ffffff',
  solidBg:'#f8fafc',
  rowEven:'#ffffff',
  rowOdd: '#f8fafc',
  hover:  '#eff6ff',
  txt:    '#0f172a',
  txtSub: '#475569',
  border: 'rgba(0,0,0,0.10)',
  /* Mate a propósito: en identidad clara está prohibido el neón. */
  pago:   '#2F6B41',
  gar:    '#1B6659',
  docs:   '#2B5F9E',
  sims:   '#8A5A12',
  online: '#5D3E90',
  att:    'var(--bad)',
}

const HCCtx = createContext(false)
const useHC = () => useContext(HCCtx)


function weekdaysOfMonth(year, month) {
  const days = [], d = new Date(year, month, 1)
  while (d.getMonth() === month) {
    if (d.getDay() >= 1 && d.getDay() <= 5) days.push(new Date(d))
    d.setDate(d.getDate() + 1)
  }
  return days
}
function dateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function scoreColor(v) {
  if (v === undefined || v === null || v === '') return 'var(--t4)'
  if (String(v).toUpperCase() === 'NP') return 'var(--bad)'
  const n = parseFloat(v)
  if (isNaN(n)) return 'var(--t4)'
  const s = n <= 1 ? n * 10 : n
  return s >= 8 ? 'var(--good)' : s >= 6 ? 'var(--warn)' : 'var(--bad)'
}
function scoreBg(v) {
  const c = scoreColor(v)
  if (c === 'var(--good)') return 'var(--good-soft)'
  if (c === 'var(--warn)') return 'var(--warn-soft)'
  if (c === 'var(--bad)') return 'var(--bad-soft)'
  return 'transparent'
}

// ─────────────────────────────────────────────────────────────────────────────
// DATOS INICIALES
// ─────────────────────────────────────────────────────────────────────────────



// ─────────────────────────────────────────────────────────────────────────────
// SELECTOR DE GRUPO
// ─────────────────────────────────────────────────────────────────────────────

function GroupPicker({ groups, students, loading, onSelect }) {
  const { getAccent } = useGroupColors()
  const { sucursales } = useSucursales()
  const [sucursal, setSucursal] = useState('todas')
  const [query, setQuery] = useState('')
  const [columns, setColumns] = useState(1)
  const gruposSucursal = sucursal === 'todas' ? groups : groups.filter(g => g.sucursal === sucursal)
  const gruposVisibles = gruposSucursal.filter(g => `${g.name} ${g.subject}`.toLowerCase().includes(query.trim().toLowerCase()))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Registrar</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--t3)' }}>
          Selecciona el grupo para abrir su lista de registro.
        </p>
      </div>

      <div className="filter-toolbar items-end">
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color:'var(--t3)' }}>
            Sucursal
          </label>
          <select value={sucursal} onChange={e => setSucursal(e.target.value)} className="input-field text-sm w-auto">
            <option value="todas">Todas las sucursales</option>
            {sucursales.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        </div>
        <p className="text-xs pb-2.5" style={{ color:'var(--t3)' }}>{gruposVisibles.length} grupo(s)</p>
        <label className="flex items-center gap-2 px-3 rounded-xl flex-1 min-w-[210px] max-w-sm"
          style={{background:'var(--soft-bg)',border:'1px solid var(--card-border)'}}>
          <Search size={14} style={{color:'var(--t3)'}}/>
          <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar grupo…"
            className="bg-transparent outline-none py-2.5 text-sm min-w-0 w-full" style={{color:'var(--t1)'}}/>
        </label>
        <button className="btn-secondary p-2.5" onClick={()=>setColumns(v=>v===1?2:1)} title="Cambiar distribución">
          {columns===1?<Columns2 size={16}/>:<Rows3 size={16}/>}<span className="hidden sm:inline text-xs">Vista</span>
        </button>
      </div>

      {!loading && groups.length === 0 && (
        <div className="card p-8 text-center">
          <p className="text-sm" style={{ color: 'var(--t3)' }}>
            No hay grupos todavía. Créalos desde la sección Grupos.
          </p>
        </div>
      )}

      <div className={`grid gap-4 ${columns===2?'lg:grid-cols-2':'grid-cols-1'}`}>
        {gruposVisibles.map(g => {
          const grpStudents = students.filter(s => s.groupId === g.id)
          const accent      = getAccent(g.id)

          return (
            <GroupShaderCard
              key={g.id}
              group={g}
              onClick={() => onSelect(g)}
              showPicker={false}
              footer={
                <div className="flex items-center justify-between pt-4 mt-1"
                  style={{ borderTop: '1px solid var(--divider)' }}>
                  <div className="flex -space-x-2">
                    {grpStudents.slice(0,6).map(s => (
                      <div key={s.id} className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold"
                        style={{ background: 'var(--soft-bg)', border:'2px solid var(--card-bg)', color: 'var(--t2)' }}>
                        {s.name.split(' ').map(n=>n[0]).join('').slice(0,2)}
                      </div>
                    ))}
                    {grpStudents.length > 6 && (
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold"
                        style={{ background: 'var(--soft-bg)', border:'2px solid var(--card-bg)', color: 'var(--t3)' }}>
                        +{grpStudents.length - 6}
                      </div>
                    )}
                  </div>
                  <button className="btn-secondary text-xs py-1.5 gap-1.5 pointer-events-none">
                    Abrir lista <ChevronRight size={13}/>
                  </button>
                </div>
              }>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm sm:text-base" style={{ color: 'var(--t1)' }}>{g.name}</p>
                <p className="text-xs sm:text-sm mt-0.5" style={{ color: 'var(--t2)' }}>{g.subject}</p>
                <div className="flex flex-wrap gap-3 mt-2">
                  {g.schedule && (
                    <span className="flex items-center gap-1 text-[11px]" style={{ color: 'var(--t3)' }}>
                      <Clock size={11}/>{g.schedule}
                    </span>
                  )}
                  <span className="flex items-center gap-1 text-[11px]" style={{ color: 'var(--t3)' }}>
                    <Users size={11}/>{grpStudents.length} alumnos
                  </span>
                </div>
              </div>
            </GroupShaderCard>
          )
        })}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// CELDAS
// ─────────────────────────────────────────────────────────────────────────────

function ScoreCell({ value, onChange, compact, bg: cellBg, sc }) {
  const hc = useHC()
  const [editing, setEditing] = useState(false)
  const [draft,   setDraft]   = useState('')
  const inputRef = useRef(null)

  const startEdit = () => { setDraft(value ?? ''); setEditing(true); setTimeout(() => inputRef.current?.select(), 30) }
  const commit = () => {
    setEditing(false)
    const t = draft.trim()
    if (!t) { onChange(undefined); return }
    if (t.toUpperCase() === 'NP') { onChange('NP'); return }
    const n = parseFloat(t)
    onChange(isNaN(n) ? t : n)
  }

  if (editing) return (
    <td style={{ minWidth: compact ? 52 : 64, background: hc ? (sc ? `${sc}12` : '#f8fafc') : (cellBg ?? SOLID_BG), padding:0 }}>
      <input ref={inputRef} value={draft} onChange={e => setDraft(e.target.value)}
        onBlur={commit} onKeyDown={e => { if (e.key==='Enter') commit(); if (e.key==='Escape') setEditing(false) }}
        style={{ width:'100%', height:'100%', minWidth: compact ? 52 : 64, textAlign:'center', fontSize:12, fontWeight:700,
          background: hc ? 'white' : 'var(--t4)',
          color: hc ? '#0f172a' : 'white',
          border: hc ? `1.5px solid ${sc ?? '#2563eb'}` : '1.5px solid rgba(255,255,255,.35)',
          borderRadius:6, padding:'4px 2px', outline:'none' }}
      />
    </td>
  )

  const col = scoreColor(value)
  const bg  = scoreBg(value)
  const display = (value === undefined || value === null || value === '') ? '—' : String(value)

  const hcBorder   = sc ? `1px solid ${sc}45` : '1px solid rgba(0,0,0,0.08)'
  const neonBorder = sc ? `1px solid ${sc}55` : 'none'
  const neonGlow   = (sc && display !== '—') ? `0 0 7px ${sc}35` : 'none'
  return (
    <td onClick={startEdit} title="Click para editar" style={{
      minWidth: compact ? 52 : 64, textAlign:'center', fontSize:12, fontWeight:700,
      color: col,
      background: hc ? (bg ? bg : (sc ? `${sc}06` : '#ffffff')) : (bg || (cellBg ?? 'transparent')),
      border: hc ? hcBorder : neonBorder,
      boxShadow: hc ? 'none' : neonGlow,
      borderRadius: 3,
      padding:'0 2px', cursor:'pointer', userSelect:'none',
      transition:'background .15s',
    }}>{display}</td>
  )
}

function CheckCell({ checked, onChange, bg: cellBg, sc }) {
  const hc = useHC()
  return (
    <td style={{
      minWidth:52, textAlign:'center',
      background: hc ? (sc ? `${sc}06` : '#ffffff') : cellBg,
      border: sc ? `1px solid ${sc}${hc ? '40' : '45'}` : 'none',
      boxShadow: (!hc && sc) ? `0 0 6px ${sc}28` : 'none',
      padding:'0 4px',
    }}>
      <button onClick={() => onChange(!checked)}
        className="mx-auto flex items-center justify-center transition-all duration-200 active:scale-90"
        style={{
          width:22, height:22, borderRadius:6,
          background: checked ? 'var(--good-soft)' : (hc ? 'rgba(0,0,0,.04)' : 'var(--card-bg)'),
          border: `1.5px solid ${checked ? 'var(--good-line)' : (hc ? 'rgba(0,0,0,.18)' : 'var(--t4)')}`,
          boxShadow: checked ? '0 0 10px var(--good-soft)' : 'none',
        }}>
        {checked && <Check size={12} style={{ color:'var(--good)' }}/>}
      </button>
    </td>
  )
}

function PaymentCell({ value, onChange, tdStyle }) {
  const hc = useHC()
  const [editing, setEditing] = useState(false)
  const [draft,   setDraft]   = useState('')
  const inputRef = useRef(null)

  const wordCount = str => str.trim() ? str.trim().split(/\s+/).length : 0

  const startEdit = () => {
    setDraft(value ?? '')
    setEditing(true)
    setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select() }, 20)
  }
  const commit = () => {
    setEditing(false)
    // Enforce 30-word limit
    const words = draft.trim().split(/\s+/)
    const clamped = words.length > 30 ? words.slice(0, 30).join(' ') : draft.trim()
    onChange(clamped)
  }

  const wc = wordCount(draft)
  const overLimit = wc > 30

  // Determine display color by known statuses or default
  const displayColor = (v) => {
    if (!v) return 'var(--t3)'
    const lower = v.toLowerCase()
    if (lower.includes('liquid')) return 'var(--good)'
    if (lower.includes('corrient')) return 'var(--warn)'
    if (lower.includes('pend') || lower.includes('adeud')) return 'var(--bad)'
    return hc ? '#0f172a' : 'var(--t2)'
  }

  if (editing) return (
    <td style={{ minWidth:114, ...tdStyle, padding:'0 4px', position:'relative' }}>
      <input
        ref={inputRef}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
        placeholder="Ej: Liquidado…"
        style={{
          width:'100%', fontSize:11, fontWeight:600, padding:'4px 6px',
          background: hc ? 'white' : 'var(--t4)',
          color: hc ? '#0f172a' : 'white',
          border: overLimit
            ? '1.5px solid #f87171'
            : hc ? '1.5px solid #2563eb' : '1.5px solid rgba(255,255,255,.35)',
          borderRadius:7, outline:'none',
        }}
      />
      {/* Word counter */}
      <span style={{
        position:'absolute', bottom:-14, right:4, fontSize:9, fontWeight:600,
        color: overLimit ? 'var(--bad)' : 'var(--t4)',
        pointerEvents:'none',
      }}>
        {wc}/30
      </span>
    </td>
  )

  return (
    <td style={{ minWidth:114, ...tdStyle, padding:'0 6px' }}>
      <button
        onClick={startEdit}
        title="Click para editar"
        className="w-full text-left truncate transition-opacity hover:opacity-80"
        style={{ fontSize:11, fontWeight:700, color: displayColor(value), maxWidth:108 }}>
        {value || <span style={{ color: 'var(--t4)', fontWeight:400 }}>—</span>}
      </button>
    </td>
  )
}

function GuaranteeBadge({ studentId, cells, attendance, simCount, bg: cellBg, sc }) {
  const hc = useHC()
  const att = attendance[studentId] || {}
  const total = Object.keys(att).length
  const present = Object.values(att).filter(v => v===1).length
  const pct = total > 0 ? (present/total)*100 : 0
  const simsOk = Array.from({length:simCount},(_,i)=>i+1)
    .every(n => { const v=cells[`sim_${n}`]; return v!==undefined && v!=='NP' && parseFloat(v)>0 })
  const ok = pct >= 90 && simsOk
  return (
    <td style={{
      minWidth:90,
      background: hc ? (sc ? `${sc}06` : '#ffffff') : cellBg,
      border: hc && sc ? `1px solid ${sc}40` : 'none',
      padding:'0 6px',
    }}>
      <span className={clsx('flex items-center justify-center gap-1 px-2 py-1 rounded-full mx-auto',
        ok ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
           : 'bg-red-500/10 text-red-400 border border-red-500/20')}
        style={{ fontSize:10, fontWeight:700, maxWidth:80 }}>
        <Shield size={9}/>{ok ? 'Garantía' : 'Sin gar.'}
      </span>
    </td>
  )
}

function AttSummaryCell({ studentId, attendance, onClick }) {
  const hc = useHC()
  const att = attendance[studentId] || {}
  const total   = Object.values(att).filter(v => v!==undefined).length
  const present = Object.values(att).filter(v => v===1).length
  const pct = total > 0 ? Math.round((present/total)*100) : 0
  const col = pct>=90 ? 'var(--good)' : pct>=75 ? 'var(--warn)' : 'var(--bad)'
  return (
    <td style={{
      minWidth:88, padding:'2px 6px',
      background: hc ? `${HC.att}06` : 'transparent',
      border: hc ? `1px solid ${HC.att}40` : 'none',
    }}>
      <button onClick={onClick}
        className="w-full flex flex-col items-center py-1 rounded-lg transition-all hover:-translate-y-0.5"
        style={{
          background: hc ? 'rgba(0,0,0,.04)' : 'var(--card-bg)',
          border: hc ? `1px solid ${HC.att}50` : '1px solid rgba(255,255,255,.08)',
        }}
        title="Abrir calendario">
        <span style={{ fontSize:13, fontWeight:900, color:col, lineHeight:1.2 }}>{pct}%</span>
        <span style={{ fontSize:9, color: hc ? '#94a3b8' : 'var(--t4)' }}>{present}/{total}</span>
      </button>
    </td>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MODAL DE ASISTENCIAS
// ─────────────────────────────────────────────────────────────────────────────

function AttendanceModal({ studentId, studentName, attendance, onChange, onClose }) {
  const [month, setMonth] = useState(0)
  const days  = useMemo(() => weekdaysOfMonth(2026, month), [month])
  const weeks = useMemo(() => {
    const ws=[]; let wk=[]; let prev=null
    days.forEach(d => {
      const m = Math.floor((d.getDate()-1)/7)
      if (prev!==null && m!==prev) { ws.push(wk); wk=[] }
      wk.push(d); prev=m
    })
    if (wk.length) ws.push(wk)
    return ws
  }, [days])

  const att     = attendance[studentId] || {}
  const total   = Object.keys(att).length
  const present = Object.values(att).filter(v=>v===1).length
  const pct     = total>0 ? Math.round((present/total)*100) : 0
  // Solo lectura: la asistencia se captura en Pasar Lista. Tener dos lugares
  // donde marcarla garantizaba que tarde o temprano dijeran cosas distintas.
  const toggle = () => {}

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl overflow-hidden"
        style={{ background:'rgba(10,10,18,.98)', border: '1px solid var(--card-border)' }}
        onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--card-border)' }}>
          <div>
            <p className="text-sm font-bold" style={{ color: 'var(--t1)' }}>
              <Calendar size={13} className="inline mr-1.5 -mt-0.5"/> {studentName}
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--t3)' }}>{present}/{total} días · {pct}%</p>
            <p className="text-[10px] mt-1" style={{ color: 'var(--t4)' }}>
              Reflejo de Pasar Lista. Para corregir un día, entra ahí.
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10"><X size={15} style={{ color: 'var(--t3)' }}/></button>
        </div>

        <div className="flex gap-1 px-5 pt-3 pb-2 overflow-x-auto">
          {MONTHS_ES.map((m,i) => (
            <button key={m} onClick={() => setMonth(i)}
              className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{ background:month===i?'white':'var(--soft-bg)', color:month===i?'#000':'var(--t3)' }}>
              {m}
            </button>
          ))}
        </div>

        <div className="px-5 pb-5" style={{ maxHeight:300, overflowY:'auto' }}>
          <div className="grid grid-cols-5 gap-1 mb-2">
            {DOW_LABELS.map(d=><div key={d} className="text-center text-[10px] font-bold uppercase" style={{ color: 'var(--t4)' }}>{d}</div>)}
          </div>
          {weeks.map((wk,wi) => {
            const off = wk[0].getDay()-1
            const cells=[]; for(let i=0;i<off;i++) cells.push(null); wk.forEach(d=>cells.push(d))
            while(cells.length<5) cells.push(null)
            return (
              <div key={wi} className="grid grid-cols-5 gap-1 mb-1">
                {cells.map((d,ci) => {
                  if(!d) return <div key={ci}/>
                  const k=dateKey(d), val=att[k]
                  const isP=val===1, isA=val===0
                  return (
                    <div key={ci}
                      className="rounded-lg text-xs font-bold py-1.5 text-center"
                      style={{
                        background:isP?'var(--good-soft)':isA?'var(--bad-soft)':'var(--card-bg)',
                        border:`1px solid ${isP?'var(--good-line)':isA?'var(--bad-line)':'var(--card-border)'}`,
                        color:isP?'var(--good)':isA?'var(--bad)':'var(--t4)',
                      }}>
                      {d.getDate()}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MODALES AUXILIARES
// ─────────────────────────────────────────────────────────────────────────────

function AddColModal({ subjName, onAdd, onClose }) {
  const [name,setName]=useState(''); const [type,setType]=useState('actividad')
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-xs rounded-2xl p-5 space-y-4" style={{ background:'rgba(10,10,18,.98)', border: '1px solid var(--card-border)' }} onClick={e=>e.stopPropagation()}>
        <p className="text-sm font-bold" style={{ color: 'var(--t1)' }}>Añadir columna — {subjName}</p>
        <input value={name} onChange={e=>setName(e.target.value)} placeholder="Nombre (ej: TAREA 4)"
          className="input-dark w-full" onKeyDown={e=>e.key==='Enter'&&name.trim()&&onAdd(name.trim(),type)}/>
        <div className="flex gap-2">
          {['actividad','tarea'].map(t=>(
            <button key={t} onClick={()=>setType(t)} className="flex-1 py-2 rounded-xl text-xs font-bold transition-all"
              style={{ background:type===t?'white':'var(--soft-bg)', color:type===t?'#000':'var(--t3)' }}>
              {t.charAt(0).toUpperCase()+t.slice(1)}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 rounded-xl text-xs font-semibold" style={{ background: 'var(--soft-bg)', color: 'var(--t2)' }}>Cancelar</button>
          <button onClick={()=>name.trim()&&onAdd(name.trim(),type)} disabled={!name.trim()}
            className="flex-1 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-40" style={{ background:'white', color:'#000' }}>Añadir</button>
        </div>
      </div>
    </div>
  )
}

function AddSubjectModal({ onAdd, onClose }) {
  const [name,setName]=useState('')
  // Literales a propósito: se guardan en subj.color. Tonos mate, no neón.
  const COLORS=['#2B5F9E','#5D3E90','#2F6B41','#8A5A12','#A03A32','#90501C','#94356B','#1C6474']
  const [color,setColor]=useState(COLORS[0])
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-xs rounded-2xl p-5 space-y-4" style={{ background:'rgba(10,10,18,.98)', border: '1px solid var(--card-border)' }} onClick={e=>e.stopPropagation()}>
        <p className="text-sm font-bold" style={{ color: 'var(--t1)' }}>Nueva sección</p>
        <input value={name} onChange={e=>setName(e.target.value)} placeholder="Nombre de la sección"
          className="input-dark w-full" onKeyDown={e=>e.key==='Enter'&&name.trim()&&onAdd(name.trim(),color)} autoFocus/>
        <div className="flex gap-2 flex-wrap">
          {COLORS.map(c=>(
            <button key={c} onClick={()=>setColor(c)} className="w-6 h-6 rounded-full transition-all active:scale-90"
              style={{ background:c, outline:color===c?'2px solid white':'none', outlineOffset:2 }}/>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 rounded-xl text-xs font-semibold" style={{ background: 'var(--soft-bg)', color: 'var(--t2)' }}>Cancelar</button>
          <button onClick={()=>name.trim()&&onAdd(name.trim(),color)} disabled={!name.trim()}
            className="flex-1 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-40" style={{ background:'white', color:'#000' }}>Añadir</button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// HEADER DE SECCIÓN (collapse/expand con +/-)
// ─────────────────────────────────────────────────────────────────────────────

function SectionHeader({ label, cols, color, collapsed, onToggle, onAdd, onRemoveItem, onRename }) {
  const hc = useHC()
  const c = color ?? (hc ? '#64748b' : 'var(--t2)')
  const [editingLabel, setEditingLabel] = useState(false)
  const [labelDraft, setLabelDraft] = useState(label)
  const commitLabel = () => {
    const next = labelDraft.trim()
    setEditingLabel(false)
    if (next && next !== label) onRename?.(next)
  }
  return (
    <th colSpan={cols} style={{
      textAlign:'center', padding:'5px 6px', fontWeight:800, fontSize:10,
      letterSpacing:'0.07em',
      color: color ? '#ffffff' : 'var(--t2)',
      borderLeft:  hc ? `2px solid ${c}` : '1px solid rgba(255,255,255,.06)',
      borderRight: hc ? `2px solid ${c}` : '1px solid rgba(255,255,255,.06)',
      borderBottom: color ? `3px solid ${color}` : 'none',
      // Cabecera de sección con el color pleno y texto blanco. El fondo al 7 %
      // de alfa era invisible sobre blanco y la sección no se distinguía.
      boxShadow: 'none',
      background: color ?? (hc ? '#e2e8f0' : 'var(--soft-bg)'),
    }}>
      <span className="flex items-center justify-center gap-1.5">
        {/* Botón collapse / expand */}
        <button onClick={onToggle}
          className="flex items-center justify-center w-4 h-4 rounded transition-all hover:bg-white/15 active:scale-90 font-black"
          style={{ fontSize:14, lineHeight:1, color: color ? '#ffffff' : 'var(--t2)' }}
          title={collapsed ? 'Expandir sección' : 'Colapsar sección'}>
          {collapsed ? '+' : '−'}
        </button>

        {editingLabel ? (
          <input value={labelDraft} autoFocus onChange={e=>setLabelDraft(e.target.value)}
            onBlur={commitLabel}
            onKeyDown={e=>{ if(e.key==='Enter') commitLabel(); if(e.key==='Escape') setEditingLabel(false) }}
            style={{ width:120, padding:'2px 5px', borderRadius:5, textAlign:'center',
              color:hc?'#0f172a':'#ffffff', background:hc?'#ffffff':'#171724',
              border:'1px solid rgba(255,255,255,.55)', outline:'none' }}/>
        ) : <span style={{ cursor:'default' }}>{label}</span>}

        {onRename && !editingLabel && (
          <button type="button" onClick={()=>{ setLabelDraft(label); setEditingLabel(true) }}
            className="w-5 h-5 rounded flex items-center justify-center hover:bg-white/20"
            title={`Editar ${label}`} aria-label={`Editar ${label}`}>
            <Pencil size={10}/>
          </button>
        )}

        {/* Añadir columna */}
        {onAdd && !collapsed && (
          <button onClick={e=>{ e.stopPropagation(); onAdd() }}
            className="w-4 h-4 rounded flex items-center justify-center hover:bg-white/20 transition-colors active:scale-90"
            title="Añadir">
            <Plus size={9}/>
          </button>
        )}
        {/* Quitar último ítem */}
        {onRemoveItem && !collapsed && (
          <button onClick={e=>{ e.stopPropagation(); onRemoveItem() }}
            className="w-4 h-4 rounded flex items-center justify-center hover:bg-red-500/30 transition-colors active:scale-90"
            title="Quitar último">
            <Minus size={9}/>
          </button>
        )}
      </span>
    </th>
  )
}

function AutoStatusCell({ value, bg }) {
  const ok = value === 'validado' || value === 'firmado'
  return <td style={{minWidth:72,textAlign:'center',fontSize:10,fontWeight:700,background:bg,color:ok?'var(--good)':value==='entregado'?'var(--warn)':'var(--t4)'}}>
    {value || 'Pendiente'}
  </td>
}

function EditableColumnHeader({ value, onChange, onRemove, light, minWidth = 52, rowSpan, style: extraStyle }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const inputRef = useRef(null)
  const textColor = light ? '#0f172a' : '#ffffff'

  useEffect(() => { if (!editing) setDraft(value) }, [value, editing])

  const startEditing = () => {
    setDraft(value)
    setEditing(true)
    setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select() }, 20)
  }
  const commit = () => {
    const next = draft.trim()
    setEditing(false)
    if (next && next !== value) onChange(next)
  }

  return (
    <th rowSpan={rowSpan} style={{ minWidth, padding:'4px 2px', textAlign:'center', fontSize:9,
      fontWeight:700, color:textColor, borderRight:'1px solid var(--divider)', ...extraStyle }}>
      {editing ? (
        <input ref={inputRef} value={draft} onChange={e=>setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e=>{ if(e.key==='Enter') commit(); if(e.key==='Escape') setEditing(false) }}
          aria-label={`Editar nombre de ${value}`}
          style={{ width:Math.max(42,minWidth-6), padding:'2px 3px', textAlign:'center',
            borderRadius:4, outline:'none', background:light?'#ffffff':'#171724',
            color:textColor, border:`1px solid ${light?'#475569':'rgba(255,255,255,.55)'}` }}/>
      ) : (
        <span className="flex items-center justify-center gap-1 px-0.5">
          <span className="truncate" title={value}>{value}</span>
          <button type="button" onClick={startEditing} title={`Editar ${value}`}
            aria-label={`Editar nombre de ${value}`}
            className="shrink-0 rounded flex items-center justify-center transition-opacity hover:opacity-70"
            style={{ color:textColor, width:22, height:22 }}>
            <Pencil size={10}/>
          </button>
          {onRemove && (
            <button type="button" onClick={onRemove} title={`Eliminar ${value}`}
              aria-label={`Eliminar ${value}`}
              className="shrink-0 rounded flex items-center justify-center"
              style={{ color:'var(--bad)', width:22, height:22 }}>
              <X size={11}/>
            </button>
          )}
        </span>
      )}
    </th>
  )
}

function FocusFilter({ options, value, onChange }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const selected = options.find(option => option.id === value) ?? options[0]

  useEffect(() => {
    if (!open) return
    const close = event => { if (!rootRef.current?.contains(event.target)) setOpen(false) }
    const escape = event => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', escape)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative w-full sm:w-auto">
      <button type="button" onClick={()=>setOpen(v=>!v)} aria-expanded={open}
        aria-haspopup="listbox"
        className="w-full sm:w-[230px] min-h-11 rounded-xl px-3.5 flex items-center gap-2 text-left"
        style={{ background:'var(--panel-bg)', border:'1px solid var(--card-border)',
          color:'var(--t1)', boxShadow:open?'0 10px 30px rgba(0,0,0,.18)':'none' }}>
        <SlidersHorizontal size={15} style={{ color:'var(--accent)', flexShrink:0 }}/>
        <span className="min-w-0 flex-1">
          <span className="block text-[9px] font-bold uppercase tracking-widest" style={{ color:'var(--t3)' }}>Ver</span>
          <span className="block text-xs font-bold truncate">{selected?.label}</span>
        </span>
        <ChevronDown size={15} className={clsx('transition-transform', open && 'rotate-180')}/>
      </button>

      {open && (
        <div role="listbox" aria-label="Seleccionar contenido de la tabla"
          className="absolute left-0 right-0 sm:right-auto sm:w-[300px] top-[calc(100%+8px)] z-40 rounded-2xl p-2"
          style={{ background:'var(--panel-bg)', border:'1px solid var(--card-border)',
            boxShadow:'0 22px 60px rgba(0,0,0,.32)', color:'var(--t1)' }}>
          <p className="px-2.5 pt-1.5 pb-2 text-[10px] font-bold uppercase tracking-widest"
            style={{ color:'var(--t3)' }}>Contenido de la tabla</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 max-h-[min(360px,55vh)] overflow-y-auto">
            {options.map(option => {
              const active = option.id === value
              return (
                <button key={option.id} type="button" role="option" aria-selected={active}
                  onClick={()=>{ onChange(option.id); setOpen(false) }}
                  className="min-h-10 rounded-xl px-3 flex items-center gap-2 text-left text-xs font-semibold"
                  style={{ background:active?'var(--soft-bg)':'transparent',
                    color:active?'var(--t1)':'var(--t2)',
                    border:`1px solid ${active?'var(--accent)':'transparent'}` }}>
                  <span className="w-4 h-4 rounded-full flex items-center justify-center shrink-0"
                    style={{ border:`1.5px solid ${active?'var(--accent)':'var(--t4)'}` }}>
                    {active && <span className="w-2 h-2 rounded-full" style={{ background:'var(--accent)' }}/>}
                  </span>
                  <span className="truncate">{option.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TABLA DE REGISTRO
// ─────────────────────────────────────────────────────────────────────────────

/* ── Menú de utilidades ───────────────────────────────────────────────────────
   La barra de la hoja acumulaba diez mandos en fila. Los que no se usan
   mientras se captura —plegar, reiniciar vistas, exportar y ahora la fijación
   de columnas— se recogen aquí detrás de un botón.

   No reutiliza `ui/Dropdown` a propósito: aquél sustituye a un <select>, sirve
   una lista de valores y se pinta con el tema del portal del ALUMNO; este panel
   lleva contenido libre y va en el panel de administración. Comparten aspecto a
   través de las variables de tema, no del componente. */
function MenuUtilidades({ children }) {
  const [abierto, setAbierto] = useState(false)
  const [caja, setCaja] = useState(null)
  const botonRef = useRef(null)
  const panelRef = useRef(null)

  /* El panel se dibuja en un portal con coordenadas calculadas y recortadas al
     viewport, no como `absolute` colgando del botón. Tres motivos, y los tres
     se daban aquí:
       · la barra envuelve en varias filas, así que el botón acaba en cualquier
         sitio y un panel anclado a su borde derecho se salía por la izquierda
         en pantalla de teléfono;
       · en pantalla completa el panel vive dentro de una barra con
         `backdrop-filter`, que crea bloque contenedor para los descendientes
         `fixed` y desplazaría cualquier posicionamiento respecto al viewport;
       · si el botón queda en la mitad baja, el menú se abre hacia arriba. */
  const medir = useCallback(() => {
    const b = botonRef.current?.getBoundingClientRect()
    if (!b) return
    const vw = window.innerWidth, vh = window.innerHeight
    const M = 12                                   // aire contra los bordes
    const ancho = Math.min(268, vw - M * 2)
    const izq = Math.min(Math.max(M, b.right - ancho), vw - ancho - M)

    const huecoAbajo  = vh - b.bottom - M - 6
    const huecoArriba = b.top - M - 6
    const haciaArriba = huecoAbajo < 240 && huecoArriba > huecoAbajo

    setCaja(haciaArriba
      ? { left: izq, bottom: vh - b.top + 6, width: ancho, maxHeight: huecoArriba }
      : { left: izq, top: b.bottom + 6,      width: ancho, maxHeight: huecoAbajo })
  }, [])

  const alternar = () => {
    if (!abierto) medir()
    setAbierto(a => !a)
  }

  useEffect(() => {
    if (!abierto) return
    const fuera = e => {
      if (botonRef.current?.contains(e.target)) return
      if (panelRef.current?.contains(e.target)) return
      setAbierto(false)
    }
    const escape = e => { if (e.key === 'Escape') setAbierto(false) }
    // El panel va en el body: si la página o la hoja se desplazan por debajo,
    // hay que reubicarlo o quedaría flotando lejos de su botón.
    document.addEventListener('mousedown', fuera)
    document.addEventListener('keydown', escape)
    window.addEventListener('resize', medir)
    window.addEventListener('scroll', medir, true)
    return () => {
      document.removeEventListener('mousedown', fuera)
      document.removeEventListener('keydown', escape)
      window.removeEventListener('resize', medir)
      window.removeEventListener('scroll', medir, true)
    }
  }, [abierto, medir])

  return (
    <>
      <button ref={botonRef} type="button" onClick={alternar}
        aria-haspopup="menu" aria-expanded={abierto}
        className="btn-secondary text-xs py-2 gap-1.5">
        <SlidersHorizontal size={13}/> Utilidades
        <ChevronDown size={12} style={{ transform: abierto ? 'rotate(180deg)' : 'none', transition:'transform .2s' }}/>
      </button>

      {abierto && caja && createPortal(
        <div ref={panelRef} role="menu"
          className="rounded-xl py-1.5 animate-fade-in"
          style={{ position:'fixed', zIndex:10000, overflowY:'auto', overscrollBehavior:'contain',
            background:'var(--panel-bg)', border:'1px solid var(--card-border)',
            boxShadow:'0 18px 48px rgba(0,0,0,.30)', ...caja }}>
          {children({ cerrar: () => setAbierto(false) })}
        </div>,
        document.body
      )}
    </>
  )
}

/* Fila de acción dentro del menú. */
function ItemMenu({ icon: Icono, label, onClick }) {
  return (
    <button type="button" role="menuitem" onClick={onClick}
      className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-left transition-colors"
      style={{ color:'var(--t2)' }}
      onMouseEnter={e => { e.currentTarget.style.background = 'var(--soft-bg)'; e.currentTarget.style.color = 'var(--t1)' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--t2)' }}>
      <Icono size={13} className="flex-shrink-0"/>{label}
    </button>
  )
}

const SeparadorMenu = () => (
  <div className="my-1.5" style={{ borderTop:'1px solid var(--divider)' }}/>
)

const TituloMenu = ({ children }) => (
  <p className="px-3.5 pt-1 pb-1.5 text-[10px] font-bold uppercase tracking-widest"
    style={{ color:'var(--t3)' }}>{children}</p>
)

function RegisterTable({ group, groupStudents, onBack, onDataChange }) {
  /* Esta hoja es la fuente maestra de calificaciones: columnas, celdas y datos
     administrativos viven en la BD. Antes todo estaba en localStorage, así que
     lo capturado sólo existía en la máquina de quien lo escribió y no llegaba
     al perfil del alumno, a Evaluaciones ni al portal del alumno. */
  const rosterFromDb = () => groupStudents.map(s => ({
    id: s.id, name: s.name,
    pago: s.pagoEstado ?? '',
    garantia: s.garantia ?? '',
    firmaGar: !!s.firmaGarantia,
    firmaTyC: s.termsStatus === 'firmado',
    exGral: !!s.examenGeneral,
  }))

  const [students,      setStudents]      = useState(rosterFromDb)
  const [subjects,      setSubjects]      = useState([])
  const [simCount,      setSimCount]      = useState(0)
  const [onlineCount,   setOnlineCount]   = useState(0)
  const [tableFocus,    setTableFocus]    = useState('all')
  const [activeSim,     setActiveSim]     = useState(1)
  const simNamesKey = `siga_registro_sim_headers_${group.id}`
  const [simHeaderNames, setSimHeaderNames] = useState(() => {
    try { return JSON.parse(localStorage.getItem(simNamesKey) || '{}') }
    catch { return {} }
  })
  const customHeadersKey = `siga_registro_headers_${group.id}`
  const [customHeaders, setCustomHeaders] = useState(() => {
    try { return JSON.parse(localStorage.getItem(customHeadersKey) || '{}') }
    catch { return {} }
  })
  const [cells,         setCells]         = useState({})
  const [attendance,    setAttendance]    = useState({})
  const [cargandoHoja,  setCargandoHoja]  = useState(true)
  const [errorHoja,     setErrorHoja]     = useState(null)
  /* Regla de despliegue: en pantalla chica la hoja arranca con las secciones
     anchas plegadas. Cuarenta columnas no se navegan en 390 px, y desplegarlo
     todo de golpe obliga a un scroll horizontal interminable antes de poder
     elegir qué mirar. En escritorio arranca abierta, como siempre. */
  // Se lee una sola vez al montar: si el usuario gira el dispositivo no tiene
  // sentido replegarle secciones que acaba de abrir a mano.
  const [collapsed, setCollapsed] = useState(() =>
    (window.innerWidth < 1024)
      ? { docs: true, sims: true, online: true }
      : {})
  const [isFullscreen,  setIsFullscreen]  = useState(false)
  /* Fijar el nombre a la izquierda ayuda a no perder de vista de quién es la
     fila, pero se lleva un tercio del ancho. Arranca SUELTO: pesa más recuperar
     ese ancho que conservar el nombre a la vista, y quien lo prefiera lo activa
     en Utilidades. Gobierna todo el bloque congelado —# y Alumno—: soltar sólo
     uno de los dos dejaría el ordinal flotando sobre el nombre. */
  const [fijarAlumno,   setFijarAlumno]   = useState(false)
  const [attModal,      setAttModal]      = useState(null)
  const [addColModal,   setAddColModal]   = useState(null)
  const [addSubjModal,  setAddSubjModal]  = useState(false)
  const [showLeaveModal,setShowLeaveModal]= useState(false)
  const [saveFlash,     setSaveFlash]     = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null) // { id, name } | null
  const [showAddStudent, setShowAddStudent] = useState(false)
  const [lastCred, setLastCred] = useState(null)
  const [studentQuery, setStudentQuery] = useState('')

  useEffect(() => {
    if (activeSim > simCount) setActiveSim(Math.max(1, simCount))
  }, [activeSim, simCount])

  const { getAccent } = useGroupColors()
  const { t: adminT } = useAdminTheme()
  const accent = getAccent(group.id)

  // Antes era un interruptor manual con paleta propia, ajena al sistema de
  // tokens. Ahora lo determina la identidad activa: IPN y UNAM son claras.
  const hcMode = !!adminT?.light

  /* ── Adaptación a la pantalla ────────────────────────────────────
     La hoja congela las columnas # y Alumno. Con 44 + 210 px congelados,
     en un teléfono de 411 px no quedaba sitio para las celdas que se van a
     rellenar: el bloque fijo tapaba la zona de registro y la hoja no se
     podía usar. Una tableta en vertical sufre lo mismo en menor grado, así
     que el corte es el de escritorio (1024) —el mismo que ya usa esta hoja
     para plegar secciones al arrancar—, con el nombre más estrecho todavía
     en teléfono. */
  const { isMobile, isDesktop } = useBreakpoint()
  const esCompacto = !isDesktop

  /* Puntero grueso = dedo. Es la señal estándar para distinguir un teléfono o
     una tableta de un portátil, y no cambia al girar el aparato, al revés que
     el ancho. Sólo ahí se toca la pantalla completa nativa y la orientación:
     en un monitor el overlay ya lo ocupa todo y fijar el apaisado no significa
     nada. */
  const esTactil = useMemo(
    () => window.matchMedia?.('(pointer: coarse)').matches ?? false, [])
  const [avisoGirar, setAvisoGirar] = useState(false)

  /* Pantalla completa en teléfono y tableta: además del overlay se pide la
     pantalla completa nativa y se fija el apaisado, que es lo único que hace
     caber cuarenta columnas. Si el navegador no deja fijarla —iOS no lo
     permite— se pide al usuario que gire, en vez de rotar la hoja por CSS:
     con una rotación falsa el teclado sale desalineado, y ésta es justo la
     pantalla donde más se teclea. */
  useEffect(() => {
    if (!esTactil) return
    let cancelado = false
    ;(async () => {
      if (isFullscreen) {
        try { await document.documentElement.requestFullscreen?.() } catch { /* iOS Safari no lo permite fuera de <video> */ }
        try { await window.screen?.orientation?.lock?.('landscape') }
        catch { if (!cancelado) setAvisoGirar(true) }
      } else {
        try { window.screen?.orientation?.unlock?.() } catch { /* no soportado */ }
        if (document.fullscreenElement) { try { await document.exitFullscreen() } catch { /* ignorado */ } }
        if (!cancelado) setAvisoGirar(false)
      }
    })()
    return () => { cancelado = true }
  }, [isFullscreen, esTactil])

  /* Salir con Esc o con el botón "atrás" del sistema deja la pantalla completa
     nativa pero no nuestro overlay; hay que sincronizarlos. Sólo en táctil,
     que es donde llegamos a pedirla. */
  useEffect(() => {
    if (!esTactil) return
    const alCambiarFS = () => { if (!document.fullscreenElement) setIsFullscreen(false) }
    document.addEventListener('fullscreenchange', alCambiarFS)
    return () => document.removeEventListener('fullscreenchange', alCambiarFS)
  }, [esTactil])

  /* Si se pidió girar a mano, el aviso se retira solo al girar. */
  useEffect(() => {
    if (!avisoGirar) return
    const mq = window.matchMedia('(orientation: landscape)')
    const revisar = () => { if (mq.matches) setAvisoGirar(false) }
    revisar()
    mq.addEventListener('change', revisar)
    return () => mq.removeEventListener('change', revisar)
  }, [avisoGirar])

  /* Salir de la hoja con la pantalla completa puesta dejaría el aparato
     bloqueado en apaisado para el resto de la aplicación. */
  useEffect(() => () => {
    try { window.screen?.orientation?.unlock?.() } catch { /* no soportado */ }
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {})
  }, [])

  /* ── Carga de la hoja desde la BD ───────────────────────────── */
  const cargarHoja = useCallback(async () => {
    setErrorHoja(null)
    try {
      const [cols, celdas, asis, docs] = await Promise.all([
        fetchColumnasRegistro(group.id),
        fetchCeldasRegistro(group.id),
        fetchAsistenciaRegistro(group.id),
        fetchDocumentosAlumnos(groupStudents.map(s=>s.id)),
      ])

      // Las columnas llegan planas; la hoja las dibuja agrupadas por materia.
      const porMateria = new Map()
      for (const c of cols) {
        if (!porMateria.has(c.materia)) {
          porMateria.set(c.materia, {
            id: c.materia, name: c.materia,
            color: c.materiaColor || 'var(--info)', cols: [],
          })
        }
        porMateria.get(c.materia).cols.push({ id: c.id, name: c.nombre, t: c.tipo, calMax: c.calMax, esFija:c.esFija })
      }
      setSubjects([...porMateria.values()])

      // La clave de celda combina materia y columna, como espera el render.
      const idAMateria = Object.fromEntries(cols.map(c => [c.id, c.materia]))
      const mapa = {}
      for (const [sid, porCol] of Object.entries(celdas)) {
        mapa[sid] = {}
        for (const [colId, val] of Object.entries(porCol)) {
          if (idAMateria[colId]) mapa[sid][`${idAMateria[colId]}_${colId}`] = val
        }
      }
      setCells(mapa)

      // Asistencia en solo lectura: la captura vive en Pasar Lista.
      const att = {}
      for (const [sid, porFecha] of Object.entries(asis.porAlumno)) {
        att[sid] = {}
        for (const [fecha, estado] of Object.entries(porFecha)) {
          att[sid][fecha] = estado === 'presente' ? 1 : estado === 'tardanza' ? 2 : 0
        }
      }
      setAttendance(att)
      setStudents(rosterFromDb().map(student => ({ ...student,
        curpEstado:docs.find(d=>d.student_id===student.id&&d.document_type==='curp')?.status ?? 'pendiente',
        ineEstado:docs.find(d=>d.student_id===student.id&&d.document_type==='ine_tutor')?.status ?? 'pendiente',
        area:groupStudents.find(s=>s.id===student.id)?.universidadArea,
        garantiaEstado:groupStudents.find(s=>s.id===student.id)?.garantiaEstado ?? 'pendiente',
      })))
    } catch (err) {
      setErrorHoja('No se pudo cargar la hoja. Revisa tu conexión y vuelve a intentar.')
    } finally {
      setCargandoHoja(false)
    }
  }, [group.id])

  useEffect(() => { cargarHoja() }, [cargarHoja])

  /* La hoja deja de ser una fotografía tomada al entrar: cualquier pase de
     lista o calificación guardada desde otra pantalla vuelve a consultar el
     grupo y actualiza filas, porcentajes y garantía sin recargar la página. */
  useEffect(() => {
    let timer
    const refresh = () => {
      clearTimeout(timer)
      timer = setTimeout(cargarHoja, 250)
    }
    const channel = supabase
      .channel(`registro-grupo-${group.id}`)
      .on('postgres_changes', { event:'*', schema:'public', table:'evaluations' }, refresh)
      .on('postgres_changes', { event:'*', schema:'public', table:'attendance_records' }, refresh)
      .on('postgres_changes', { event:'*', schema:'public', table:'attendance_sessions', filter:`group_id=eq.${group.id}` }, refresh)
      .on('postgres_changes', { event:'*', schema:'public', table:'registro_columnas', filter:`group_id=eq.${group.id}` }, refresh)
      .subscribe()
    return () => {
      clearTimeout(timer)
      supabase.removeChannel(channel)
    }
  }, [group.id, cargarHoja])

  /* Guardado por celda, con espera para no disparar una escritura por tecla. */
  const timersCelda = useRef({})
  useEffect(() => () => Object.values(timersCelda.current).forEach(clearTimeout), [])

  /* Ya no hace falta avisar al salir: no hay cambios sin guardar. Cada celda
     se persiste 600 ms después de escribirla. */

  // ── Mutators ────────────────────────────────────────────────────────────────
  /* La celda se pinta al instante y se persiste 600 ms después. El id de la
     columna es la segunda mitad de la clave (`materia_uuid`).

     Ojo: la hoja también usa claves propias para simulacros y exámenes
     digitales (`sim_1`, `on_2`…), que todavía no tienen columna en la BD.
     Sólo se persiste lo que apunta a un UUID real; lo demás se queda en la
     vista, como estaba, hasta que esas secciones también se modelen. */
  const esColumnaBd = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

  const setCell = (sid, key, val) => {
    setCells(p => ({ ...p, [sid]: { ...p[sid], [key]: val } }))
    const columnaId = key.slice(key.indexOf('_') + 1)
    if (!esColumnaBd.test(columnaId)) return
    const timerKey  = `${sid}:${columnaId}`
    clearTimeout(timersCelda.current[timerKey])
    timersCelda.current[timerKey] = setTimeout(async () => {
      const value = val === '' || val === null || val === undefined ? null : val
      try {
        await setCeldaRegistro(sid, columnaId, value)
        onDataChange?.()
      } catch {
        setErrorHoja('No se pudo guardar una calificación. Vuelve a escribirla.')
      }
    }, 600)
  }

  const toggleCheck = async (sid, field) => {
    const alumno = students.find(s => s.id === sid)
    const valor  = !alumno?.[field]
    setStudents(p => p.map(s => s.id === sid ? { ...s, [field]: valor } : s))
    const campo = field === 'firmaGar' ? 'firma_garantia' : field === 'exGral' ? 'examen_general' : null
    // firmaTyC se gobierna desde T&C / Firmas, no desde aquí.
    if (campo) {
      try { await setRegistroAdmin(sid, campo, valor) }
      catch { setErrorHoja('No se pudo guardar el cambio.') }
    }
  }

  const setPago = async (sid, val) => {
    setStudents(p => p.map(s => s.id === sid ? { ...s, pago: val } : s))
    try { await setRegistroAdmin(sid, 'pago_estado', val) }
    catch { setErrorHoja('No se pudo guardar el estado de pago.') }
  }

  // La asistencia es espejo de Pasar Lista: aquí no se edita.
  const toggleAtt = () => {}
  const toggleSection = id => setCollapsed(p=>({...p,[id]:!p[id]}))
  const simHeaderName = (n, field) => simHeaderNames[n]?.[field]
    || (field === 'score' ? folioEX(n) : field === 'task' ? 'TAREA' : 'ANLS.')
  const renameSimHeader = (n, field, value) => {
    setSimHeaderNames(prev => {
      const next = { ...prev, [n]: { ...prev[n], [field]: value } }
      localStorage.setItem(simNamesKey, JSON.stringify(next))
      return next
    })
  }
  const headerName = (key, fallback) => customHeaders[key] || fallback
  const renameHeader = (key, value) => {
    setCustomHeaders(prev => {
      const next = { ...prev, [key]:value }
      localStorage.setItem(customHeadersKey, JSON.stringify(next))
      return next
    })
  }
  const resetCollapsed = () => setCollapsed({})

  const showSummary = tableFocus === 'all' || tableFocus === 'summary'
  const showDocs = tableFocus === 'all' || tableFocus === 'docs'
  const showSubject = id => tableFocus === 'all' || tableFocus === `subject:${id}`
  const showSims = false
  const showOnline = false
  const showAttendance = tableFocus === 'all' || tableFocus === 'attendance' || tableFocus === 'summary'
  const visibleSims = tableFocus === 'sims'
    ? [activeSim]
    : Array.from({ length:simCount }, (_,i)=>i+1)
  const plegarTodo = () => setCollapsed({ docs: true, sims: true, online: true,
    ...Object.fromEntries(subjects.map(x => [x.id, true])) })

  /* Las secciones de la hoja, para el selector de Utilidades. Asistencias no
     está: ocupa una columna y no se pliega. */
  const secciones = useMemo(() => [
    { id:'docs',   label:'Documentos' },
    ...subjects.map(s => ({ id:s.id, label:s.name })),
  ], [subjects])
  const focusOptions = useMemo(() => [
    { id:'summary', label:'Resumen' },
    { id:'docs', label:'Documentos' },
    ...subjects.map(s => ({ id:`subject:${s.id}`, label:s.name })),
    { id:'attendance', label:'Asistencia' },
    { id:'all', label:'Todas' },
  ], [subjects])

  const selectFocus = id => {
    setTableFocus(id)
    const sectionId = id.startsWith('subject:') ? id.slice(8) : id
    if (['docs','sims','online'].includes(sectionId) || id.startsWith('subject:')) {
      setCollapsed(prev => ({ ...prev, [sectionId]:false }))
    }
  }

  /* En vertical la hoja abría con las materias desplegadas: cuarenta columnas
     que obligaban a un barrido horizontal largo antes de encontrar nada. Fuera
     de escritorio arranca con TODO plegado, y se abre la sección que se va a
     capturar desde Utilidades o tocando su cabecera. Se hace una sola vez, al
     llegar las materias: replegar cada vez que alguien gira el aparato le
     cerraría secciones que acaba de abrir a mano. */
  const plegadoInicial = useRef(false)
  useEffect(() => {
    if (plegadoInicial.current || isDesktop || subjects.length === 0) return
    plegadoInicial.current = true
    setCollapsed({ docs: true, sims: true, online: true,
      ...Object.fromEntries(subjects.map(x => [x.id, true])) })
  }, [isDesktop, subjects])

  /* El padrón es el del grupo. Antes se podían agregar alumnos aquí con un id
     inventado (`r<timestamp>`), y quedaban sólo en la hoja: no tenían cuenta,
     ni perfil, ni asistencia. Para dar de alta se usa Alumnos o Grupos. */
  const removeStudent = () => {}

  /* Una materia sin columnas no existe en la BD; se materializa al crear su
     primera columna. Mientras tanto vive en el estado para poder nombrarla. */
  const addSubject = (name, color) => {
    setSubjects(p => p.some(s => s.name === name) ? p : [...p, { id: name, name, color, cols: [] }])
    setAddSubjModal(false)
  }

  const removeSubject = async subjId => {
    const materia = subjects.find(s => s.id === subjId)
    if (!materia) return
    try {
      await Promise.all(materia.cols.map(c => borrarColumnaRegistro(c.id)))
      await cargarHoja()
      onDataChange?.()
    } catch { setErrorHoja('No se pudo eliminar la sección.') }
    setSubjects(p => p.filter(s => s.id !== subjId))
  }

  const addCol = async (subjId, name, type) => {
    const materia = subjects.find(s => s.id === subjId)
    if (!materia) return
    setAddColModal(null)
    try {
      await crearColumnaRegistro({
        groupId: group.id, materia: materia.name, nombre: name,
        tipo: type, color: materia.color,
      })
      await cargarHoja()
    } catch { setErrorHoja('No se pudo crear la columna.') }
  }

  const removeCol = async (subjId, colId) => {
    try {
      await borrarColumnaRegistro(colId)
      await cargarHoja()
      onDataChange?.()   // borrar una columna cambia promedios
    } catch { setErrorHoja('No se pudo eliminar la columna.') }
  }

  /* ── Save evaluation ────────────────────────────────────────── */
  /* Exporta la lista completa a Excel con la misma estructura de la tabla */
  const exportListExcel = async () => {
    const XLSX = await import('xlsx')

    const header = ['#', headerName('student','Alumno'), headerName('payment','Pago'),
      headerName('guarantee','Garantía'), headerName('doc_guarantee','Firma Gar.'),
      headerName('doc_terms','Firma T&C'), headerName('doc_exam','Examen Gral.')]
    subjects.forEach(subj => subj.cols.forEach(col =>
      header.push(`${subj.name} — ${headerName(`col:${col.id}`,col.name)}`)))
    for (let n = 1; n <= simCount; n++) header.push(
      simHeaderName(n, 'score'), simHeaderName(n, 'task'), simHeaderName(n, 'analysis'))
    for (let n = 1; n <= onlineCount; n++) header.push(headerName(`online:${n}`,folioEXD(n)))
    header.push(headerName('attendance','% Asistencia'))

    const rows = students.map((s, idx) => {
      const sc  = cells[s.id] || {}
      const att = attendance[s.id] || {}
      const total   = Object.keys(att).length
      const present = Object.values(att).filter(v => v === 1).length
      const pct = total > 0 ? (present / total) * 100 : 0
      const simsOk = Array.from({ length: simCount }, (_, i) => i + 1)
        .every(n => { const v = sc[`sim_${n}`]; return v !== undefined && v !== 'NP' && parseFloat(v) > 0 })

      const row = [
        idx + 1, s.name, s.pago,
        pct >= 90 && simsOk ? 'Con garantía' : 'Sin garantía',
        s.firmaGar ? 'Sí' : 'No', s.firmaTyC ? 'Sí' : 'No', s.exGral ? 'Sí' : 'No',
      ]
      subjects.forEach(subj => subj.cols.forEach(col => row.push(sc[`${subj.id}_${col.id}`] ?? '')))
      for (let n = 1; n <= simCount; n++)
        row.push(sc[`sim_${n}`] ?? '', sc[`sim_${n}_tarea`] ? 'Sí' : 'No', sc[`sim_${n}_analisis`] ? 'Sí' : 'No')
      for (let n = 1; n <= onlineCount; n++) row.push(sc[`on_${n}`] ?? '')
      row.push(`${Math.round(pct)}%`)
      return row
    })

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet([header, ...rows])
    ws['!cols'] = header.map((h, i) => ({ wch: i === 1 ? 32 : Math.max(10, h.length + 2) }))
    XLSX.utils.book_append_sheet(wb, ws, 'Lista')

    const fecha = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-')
    XLSX.writeFile(wb, `Evaluacion_${group.name.replace(/\s+/g, '_')}_${fecha}.xlsx`)
  }

  // Guardar y descargar son acciones separadas: antes cada guardado disparaba
  // la descarga del Excel, lo que llenaba la carpeta de archivos repetidos.
  // Cada celda se guarda sola al escribirla. Este botón sólo fuerza una
  // recarga desde la BD, que además confirma que todo quedó asentado.
  const handleSaveEval = async () => {
    await cargarHoja()
    onDataChange?.()
    setSaveFlash(true)
    setTimeout(() => setSaveFlash(false), 2200)
  }

  const handleBack = () => onBack()
  const confirmLeave = () => { setShowLeaveModal(false); onBack() }

  // ── Stats ───────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    let conGar=0
    students.forEach(s=>{
      const att=attendance[s.id]||{}, t=Object.keys(att).length, p=Object.values(att).filter(v=>v===1).length
      const pct=t>0?(p/t)*100:0
      const sc=cells[s.id]||{}
      const simsOk=Array.from({length:simCount},(_,i)=>i+1).every(n=>{const v=sc[`sim_${n}`];return v!==undefined&&v!=='NP'&&parseFloat(v)>0})
      if(pct>=90&&simsOk) conGar++
    })
    return { total:students.length, conGar, sinGar:students.length-conGar }
  }, [students,attendance,cells,simCount])

  // ── Column widths & sticky (SOLO # y Alumno) ─────────────────────────────────
  /* En pantalla chica el ordinal se retira —es un número de fila, el dato menos
     útil de la hoja— y el nombre se estrecha. Así el bloque congelado baja de
     254 px a 132, y en un teléfono de 411 px quedan ~247 px de zona de registro
     en vez de ~125: la diferencia entre ver una columna y ver tres. */
  const W = isMobile
    ? { num:0,  name:116, pago:82,  gar:76 }   // teléfono
    : esCompacto
      ? { num:0,  name:168, pago:104, gar:88 } // tableta
      : { num:44, name:210, pago:114, gar:92 } // portátil y monitor
  const L = { num:0, name: esCompacto ? 0 : W.num }   // ← only # and Alumno are sticky

  const solidBg = hcMode ? HC.solidBg : SOLID_BG

  const thStickyStyle = (left, extra={}) => ({
    ...(fijarAlumno ? { position:'sticky', left, zIndex:4 } : null),
    background: solidBg,
    borderBottom: hcMode ? '2px solid #1e293b' : '1px solid rgba(255,255,255,.09)',
    ...extra,
  })

  // ── Render helper: toolbar ───────────────────────────────────────────────────
  /* Pantalla completa sobre pantalla chica: ahí cada fila que envuelve la barra
     se resta de la hoja, así que se deja sólo lo que se usa mientras se captura. */
  const compactoFS = isFullscreen && esCompacto

  const toolbar = (
    <div className={clsx('flex flex-wrap items-center gap-2', compactoFS ? 'mb-2' : 'mb-4')}>
      {/* Back (no fullscreen) */}
      {!isFullscreen && (
        <button onClick={handleBack} className="btn-secondary text-xs py-2 gap-1.5">
          <ArrowLeft size={13}/> Grupos
        </button>
      )}

      {/* Group pill */}
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
        style={{ background: accent, color:'#ffffff' }}>
        {/* El chip lleva ahora fondo pleno, así que su contenido va en blanco:
            el nombre seguía pintado con el color del acento y desaparecía. */}
        <span className="text-xs font-bold" style={{ color:'#ffffff' }}>{group.name}</span>
        <span className="text-xs" style={{ color:'rgba(255,255,255,.55)' }}>·</span>
        <span className="text-xs" style={{ color:'rgba(255,255,255,.80)' }}>{group.subject}</span>
      </div>

      {/* Stats. En pantalla completa sobre pantalla chica se retiran: son
          informativos, y con el chip de grupo y seis botones la barra envolvía
          en dos filas: ~90 px de los 411 de alto de un teléfono apaisado, justo
          en el modo que se abre para ver MÁS hoja. */}
      {[{v:stats.total,l:'Total',c:'var(--t2)'},{v:stats.conGar,l:'Con garantía',c:'var(--good)'},{v:stats.sinGar,l:'Sin garantía',c:'var(--bad)'}].map(({v,l,c})=>(
        <div key={l} className={clsx('text-center px-3 py-1.5 rounded-xl', esCompacto && 'hidden')}
          style={{ background:`color-mix(in srgb, ${c} 14%, var(--card-bg))`, border:`1px solid color-mix(in srgb, ${c} 45%, var(--card-border))`, minWidth:86 }}>
          <span className="text-base font-black mr-1" style={{ color:c }}>{v}</span>
          <span className="text-[10px]" style={{ color: 'var(--t3)' }}>{l}</span>
        </div>
      ))}

      <div className="flex-1"/>

      {/* Acciones */}
      <button onClick={() => setShowAddStudent(true)} className="btn-secondary text-xs py-2 gap-1.5">
        <UserPlus size={13}/> Alumno
      </button>
      <button onClick={() => setAddSubjModal(true)} className="btn-secondary text-xs py-2 gap-1.5">
        <Plus size={13}/> Sección
      </button>
      {/* Utilidades: lo que no se toca mientras se capturan calificaciones. */}
      <MenuUtilidades>
        {({ cerrar }) => (
          <>
            <TituloMenu>Vista</TituloMenu>
            <div className="px-3.5 pb-1">
              <NeonCheckbox
                label="Fijar columna Alumno"
                checked={fijarAlumno}
                onChange={e => setFijarAlumno(e.target.checked)}
                className="text-xs"
              />
              <p className="text-[10px] mt-1.5 leading-snug" style={{ color:'var(--t3)' }}>
                El nombre se queda a la vista al desplazar. Cuesta {W.name} px
                de ancho de captura.
              </p>
            </div>

            <SeparadorMenu/>

            {/* El mando de verdad contra el barrido horizontal: se muestran
                sólo los bloques que se van a capturar. */}
            <div className="flex items-baseline justify-between px-3.5 pt-1 pb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color:'var(--t3)' }}>
                Secciones visibles
              </span>
              <span className="text-[10px] font-semibold" style={{ color:'var(--t3)' }}>
                {secciones.filter(s => !collapsed[s.id]).length}/{secciones.length}
              </span>
            </div>
            <div className="px-3.5 pb-1 space-y-1.5">
              {secciones.map(s => (
                <NeonCheckbox key={s.id}
                  label={<span className="text-xs truncate">{s.label}</span>}
                  checked={!collapsed[s.id]}
                  onChange={() => toggleSection(s.id)}
                />
              ))}
            </div>
            <div className="flex gap-1.5 px-3.5 pt-1.5 pb-1">
              <button type="button" onClick={plegarTodo}
                className="flex-1 text-[10px] font-bold py-1.5 rounded-lg transition-colors"
                style={{ background:'var(--soft-bg)', color:'var(--t2)' }}>
                Ocultar todas
              </button>
              <button type="button" onClick={resetCollapsed}
                className="flex-1 text-[10px] font-bold py-1.5 rounded-lg transition-colors"
                style={{ background:'var(--soft-bg)', color:'var(--t2)' }}>
                Mostrar todas
              </button>
            </div>

            <SeparadorMenu/>
            <ItemMenu icon={Download} label="Descargar Excel"
              onClick={() => { exportListExcel(); cerrar() }}/>
          </>
        )}
      </MenuUtilidades>
      {/* Guardar */}
      <button onClick={handleSaveEval}
        className="btn-primary text-xs py-2 gap-1.5 transition-all duration-300"
        style={saveFlash ? { background:'var(--good)', color:'#000', boxShadow:'0 0 14px var(--good-line)' } : {}}>
        <Save size={13}/> {saveFlash ? '¡Guardado!' : 'Guardar'}
      </button>
      {/* En pantalla completa la salida es la "X" de la esquina, siempre a la
          vista; repetirla aquí sólo duplicaba el mismo mando. */}
      {!isFullscreen && (
        <button
          onClick={() => setIsFullscreen(true)}
          className="btn-secondary text-xs py-2 gap-1.5">
          <Maximize2 size={13}/> Pantalla completa
        </button>
      )}
    </div>
  )

  // ── Tabla ────────────────────────────────────────────────────────────────────
  const focusBar = (
    <div className="mb-3 flex flex-col sm:flex-row sm:items-start gap-2">
      <FocusFilter options={focusOptions} value={tableFocus} onChange={selectFocus}/>
      <label className="flex items-center gap-2 px-3 rounded-xl min-w-[210px] sm:ml-auto"
        style={{background:'var(--soft-bg)',border:'1px solid var(--card-border)'}}>
        <Search size={13} style={{color:'var(--t3)'}}/>
        <input value={studentQuery} onChange={e=>setStudentQuery(e.target.value)} placeholder="Filtrar alumno…"
          className="bg-transparent outline-none py-2 text-xs w-full min-w-0" style={{color:'var(--t1)'}}/>
      </label>
      {tableFocus === 'sims' && (
        <div className="flex flex-1 items-center gap-1.5 overflow-x-auto pb-1 sm:pt-1" aria-label="Simulacro activo">
          {Array.from({length:simCount},(_,i)=>i+1).map(n => (
            <button key={n} type="button" onClick={()=>setActiveSim(n)}
              aria-pressed={activeSim===n}
              className="shrink-0 rounded-md px-2.5 py-1 text-[11px] font-bold"
              style={{ background:activeSim===n ? HC.sims : 'var(--soft-bg)',
                color:activeSim===n ? '#ffffff' : 'var(--t2)',
                border:`1px solid ${activeSim===n ? HC.sims : 'var(--card-border)'}` }}>
              {simHeaderName(n,'score')}
            </button>
          ))}
        </div>
      )}
    </div>
  )

  const thText     = hcMode ? '#0f172a'              : 'var(--t3)'
  const thTextSub  = hcMode ? '#475569'              : 'var(--t3)'
  const rowEvenBg  = hcMode ? HC.rowEven             : '#0c0c16'
  const rowOddBg   = hcMode ? HC.rowOdd              : '#0e0e1a'
  const rowHoverBg = hcMode ? HC.hover               : 'rgba(255,255,255,.045)'
  const cellBorder = hcMode ? '1px solid rgba(0,0,0,.08)' : '1px solid rgba(255,255,255,.05)'

  const tableEl = (
    <div className="rounded-2xl overflow-hidden"
      style={{ border:'1px solid var(--card-border)', boxShadow:'var(--card-shadow)',
        /* En pantalla completa la hoja ocupa el hueco que le deja la barra en
           lugar de restarle una altura fija: la barra envuelve en varias líneas
           en móvil, y el `calc(100vh - 104px)` de antes se pasaba de largo. */
        ...(isFullscreen ? { flex:1, minHeight:0, display:'flex', flexDirection:'column' } : {}) }}>
      <div style={{
        overflowX:'auto', overflowY:'auto',
        /* El barrido horizontal sobre la hoja disparaba el gesto de "atrás"
           del navegador al llegar al borde. */
        overscrollBehaviorX:'contain',
        ...(isFullscreen
          ? { flex:1, minHeight:0 }
          : { maxHeight:isMobile?'max(320px, calc(100dvh - 300px))':'calc(100vh - 208px)' }) }}>
        <table data-wide-sheet style={{
          borderCollapse:'collapse',
          /* Ocupa el contenedor en vistas pequeñas (Resumen, Documentos o un
             solo simulacro), pero conserva su ancho intrínseco y el scroll
             cuando una materia o la vista Todas tienen muchas columnas. */
          width:'100%', minWidth:'max-content',
          fontSize:12, background: hcMode ? 'var(--card-bg)' : 'transparent',
        }}>
          <thead style={{ position:'sticky', top:0, zIndex:5 }}>

            {/* ── Fila 1: headers de sección ── */}
            <tr style={{ background: solidBg }}>
              {/* # y ALUMNO: sticky */}
              {!esCompacto && (
                <th rowSpan={2} style={{ ...thStickyStyle(L.num), minWidth:W.num, textAlign:'center', padding:'8px 4px', fontSize:10, fontWeight:700, color: hcMode ? '#1e293b' : 'var(--t3)' }}>#</th>
              )}
              <EditableColumnHeader rowSpan={2} minWidth={W.name} light={hcMode}
                value={headerName('student','ALUMNO')} onChange={v=>renameHeader('student',v)}
                style={{ ...thStickyStyle(L.name), textAlign:'left', padding:'8px 12px' }}/>
              {/* PAGO y GARANTÍA: NO sticky */}
              {showSummary && <>
                <EditableColumnHeader rowSpan={2} minWidth={W.pago} light={hcMode}
                  value={headerName('payment','PAGO')} onChange={v=>renameHeader('payment',v)}
                  style={{ background:hcMode?`${HC.pago}14`:solidBg, borderBottom:`3px solid ${HC.pago}` }}/>
                <EditableColumnHeader rowSpan={2} minWidth={W.gar} light={hcMode}
                  value={headerName('guarantee','GARANTÍA')} onChange={v=>renameHeader('guarantee',v)}
                  style={{ background:hcMode?`${HC.gar}14`:solidBg, borderBottom:`3px solid ${HC.gar}` }}/>
              </>}

              {showDocs && <SectionHeader label={headerName('section:docs','DOCUMENTOS')}
                onRename={v=>renameHeader('section:docs',v)} cols={collapsed['docs']?1:4}
                collapsed={!!collapsed['docs']} onToggle={()=>toggleSection('docs')}/>}

              {subjects.filter(subj=>showSubject(subj.id)).map(subj => (
                <SectionHeader key={subj.id}
                  label={headerName(`section:${subj.id}`,subj.name.toUpperCase())} color={subj.color}
                  onRename={v=>renameHeader(`section:${subj.id}`,v)}
                  cols={collapsed[subj.id] ? 1 : subj.cols.length+1}
                  collapsed={!!collapsed[subj.id]}
                  onToggle={()=>toggleSection(subj.id)}
                  onAdd={()=>setAddColModal(subj.id)}
                  onRemoveItem={subj.cols.some(c=>c.esFija) ? undefined : ()=>removeSubject(subj.id)}
                />
              ))}

              {showSims && <SectionHeader label={headerName('section:sims','SIMULACROS (EX)')}
                onRename={v=>renameHeader('section:sims',v)} color="var(--warn)"
                cols={collapsed['sims']?1:visibleSims.length*3+1}
                collapsed={!!collapsed['sims']}
                onToggle={()=>toggleSection('sims')}
                onAdd={()=>setSimCount(n=>n+1)}
                onRemoveItem={()=>setSimCount(n=>Math.max(1,n-1))}
              />}
              {showOnline && <SectionHeader label={headerName('section:online','EXÁMENES DIGITALES (EXD)')}
                onRename={v=>renameHeader('section:online',v)} color="#5D3E90"
                cols={collapsed['online']?1:onlineCount+1}
                collapsed={!!collapsed['online']}
                onToggle={()=>toggleSection('online')}
                onAdd={()=>setOnlineCount(n=>n+1)}
                onRemoveItem={()=>setOnlineCount(n=>Math.max(1,n-1))}
              />}
              {showAttendance && <SectionHeader label={headerName('section:attendance','ASISTENCIAS')}
                onRename={v=>renameHeader('section:attendance',v)} color="var(--good)"
                cols={1} collapsed={false} onToggle={()=>{}}/>}
            </tr>

            {/* ── Fila 2: nombres de columna ── */}
            <tr style={{ background: solidBg }}>
              {/* Documentos */}
              {showDocs && (collapsed['docs']
                ? <th style={{ minWidth:52, fontSize:10, color: hcMode ? HC.docs : 'var(--t4)', textAlign:'center', borderRight: hcMode ? `2px solid ${HC.docs}70` : '1px solid rgba(255,255,255,.06)' }}>···</th>
                : [
                    ['doc_curp','CURP'],
                    ['doc_ine','INE tutor'],
                    ['doc_terms','Firma T&C'],
                    ['doc_guarantee','Garantía'],
                  ].map(([key,fallback]) => (
                    <EditableColumnHeader key={key} minWidth={68} light={hcMode}
                      value={headerName(key,fallback)} onChange={v=>renameHeader(key,v)}
                      style={{ background:hcMode?`${HC.docs}0d`:`${HC.docs}0a`,
                        borderBottom:`${hcMode?2:1}px solid ${HC.docs}${hcMode?'80':'60'}` }}/>
                  ))
              )}

              {/* Secciones */}
              {subjects.filter(subj=>showSubject(subj.id)).map(subj => {
                if (collapsed[subj.id]) return <th key={subj.id} style={{ minWidth:52, fontSize:10, color: 'var(--t4)', textAlign:'center', borderRight: '1px solid var(--divider)' }}>···</th>
                return [
                  ...subj.cols.map(col => (
                    <EditableColumnHeader key={`${subj.id}_${col.id}`} minWidth={76} light={hcMode}
                      value={headerName(`col:${col.id}`,col.name)}
                      onChange={v=>renameHeader(`col:${col.id}`,v)}
                      onRemove={col.esFija ? undefined : ()=>removeCol(subj.id,col.id)}/>
                  )),
                  <th key={`${subj.id}_add`} style={{ minWidth:26, borderRight: '1px solid var(--divider)' }}>
                    <button onClick={()=>setAddColModal(subj.id)} className="mx-auto flex items-center justify-center w-4 h-4 rounded hover:bg-white/15" title="Añadir columna">
                      <Plus size={9} style={{ color: 'var(--t3)' }}/>
                    </button>
                  </th>,
                ]
              })}

              {/* Simulacros */}
              {showSims && (collapsed['sims']
                ? <th style={{ minWidth:52, textAlign:'center', fontSize:10, color: 'var(--t4)' }}>···</th>
                : [...visibleSims.flatMap(n=>[
                    <EditableColumnHeader key={`s${n}sc`} minWidth={58} light={hcMode}
                      value={simHeaderName(n,'score')} onChange={v=>renameSimHeader(n,'score',v)}/>,
                    <EditableColumnHeader key={`s${n}t`} minWidth={54} light={hcMode}
                      value={simHeaderName(n,'task')} onChange={v=>renameSimHeader(n,'task',v)}/>,
                    <EditableColumnHeader key={`s${n}a`} minWidth={54} light={hcMode}
                      value={simHeaderName(n,'analysis')} onChange={v=>renameSimHeader(n,'analysis',v)}/>,
                  ]),
                  <th key="sims_sp" style={{ minWidth:26 }}/>
                ]
              )}

              {/* Online */}
              {showOnline && (collapsed['online']
                ? <th style={{ minWidth:52, textAlign:'center', fontSize:10, color: 'var(--t4)' }}>···</th>
                : [...Array.from({length:onlineCount},(_,i)=>i+1).map(n=>(
                    <EditableColumnHeader key={`on${n}`} minWidth={64} light={hcMode}
                      value={headerName(`online:${n}`,folioEXD(n))}
                      onChange={v=>renameHeader(`online:${n}`,v)}/>
                  )),
                  <th key="online_sp" style={{ minWidth:26 }}/>
                ]
              )}

              {/* Asistencias */}
              {showAttendance && <EditableColumnHeader minWidth={88} light={hcMode}
                value={headerName('attendance','% ASIST.')} onChange={v=>renameHeader('attendance',v)}/>}
            </tr>
          </thead>

          <tbody>
            {students.filter(s=>s.name.toLowerCase().includes(studentQuery.trim().toLowerCase())).map((s, idx) => {
              const sc = cells[s.id] || {}
              const rowBg = idx%2===0 ? rowEvenBg : rowOddBg

              return (
                <tr key={s.id}
                  style={{ height:isMobile?48:40, background:rowBg }}
                  onMouseEnter={e=>e.currentTarget.style.background=rowHoverBg}
                  onMouseLeave={e=>e.currentTarget.style.background=rowBg}
                  className="group transition-colors duration-75">

                  {/* # — sticky (se retira en pantalla chica) */}
                  {!esCompacto && (
                    <td style={{ ...(fijarAlumno ? { position:'sticky', left:L.num, zIndex:2 } : null), background:solidBg, minWidth:W.num, width:W.num, textAlign:'center', fontSize:11, fontWeight:700, color: hcMode ? '#1e293b' : 'var(--t3)', padding:'0 4px', verticalAlign:'middle', borderRight: hcMode ? '2px solid #1e293b30' : 'none' }}>
                      {idx+1}
                    </td>
                  )}

                  {/* Alumno — sticky */}
                  <td style={{ ...(fijarAlumno ? { position:'sticky', left:L.name, zIndex:2 } : null), background:solidBg, minWidth:W.name, width:W.name, maxWidth:W.name, padding:'0 10px', verticalAlign:'middle', borderRight: hcMode ? '2px solid #1e293b40' : '1px solid rgba(255,255,255,.06)' }}>
                    {/* El ancho se ata AQUÍ y no sólo en la celda: en una tabla
                        de layout automático el `width` de un <td> es una
                        sugerencia, y el navegador ensanchaba la columna hasta
                        que cupiera el nombre entero —medido: 280 px donde se
                        pedían 168—. Con el contenedor acotado, el `flex:1` de
                        abajo por fin recorta con puntos suspensivos. */}
                    <div style={{ display:'flex', alignItems:'center', gap:8,
                      width: W.name - 20, maxWidth: W.name - 20 }}>
                      <AvatarAlumno student={s} size={24}
                        style={{ background: hcMode ? 'rgba(0,0,0,.08)' : 'var(--card-border)', color: hcMode ? '#1e293b' : 'var(--t2)', border:'none' }}/>
                      {/* `minWidth:0` es lo que permite a un hijo flex encoger
                          por debajo de su contenido; sin él no hay elipsis. */}
                      <span style={{ fontSize:12, fontWeight:500, color: hcMode ? '#0f172a' : 'rgba(255,255,255,.78)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1, minWidth:0 }}>
                        {s.name}
                      </span>
                      <button onClick={() => setDeleteConfirm({ id:s.id, name:s.name })}
                        style={{ opacity:0, flexShrink:0 }}
                        className="group-hover:!opacity-100 transition-opacity p-0.5 rounded hover:bg-red-500/20"
                        title="Eliminar alumno">
                        <Trash2 size={11} style={{ color:'var(--bad-line)' }}/>
                      </button>
                    </div>
                  </td>

                  {/* Pago — NO sticky */}
                  {showSummary && <PaymentCell value={s.pago} onChange={v=>setPago(s.id,v)}
                    tdStyle={{ minWidth:W.pago, background: hcMode ? `${HC.pago}06` : rowBg, border: `1px solid ${HC.pago}${hcMode ? '45' : '40'}`, boxShadow: !hcMode ? `0 0 6px ${HC.pago}25` : 'none', verticalAlign:'middle' }}
                  />}

                  {/* Garantía — NO sticky */}
                  {showSummary && <GuaranteeBadge studentId={s.id} cells={sc} attendance={attendance} simCount={simCount}
                    bg={rowBg} sc={HC.gar}
                  />}

                  {/* Documentos */}
                  {showDocs && (collapsed['docs']
                    ? <td style={{ minWidth:52, background: hcMode ? `${HC.docs}06` : rowBg }}/>
                    : <>
                        <AutoStatusCell value={s.curpEstado} bg={rowBg}/>
                        <AutoStatusCell value={s.ineEstado} bg={rowBg}/>
                        <AutoStatusCell value={s.firmaTyC?'firmado':'pendiente'} bg={rowBg}/>
                        <AutoStatusCell value={s.garantiaEstado} bg={rowBg}/>
                      </>
                  )}

                  {/* Materias */}
                  {subjects.filter(subj=>showSubject(subj.id)).map(subj => {
                    if(collapsed[subj.id]) return <td key={subj.id} style={{ minWidth:52, background: hcMode ? `${subj.color}06` : rowBg }}/>
                    return [
                      ...subj.cols.map(col=>(
                        <ScoreCell key={`${subj.id}_${col.id}`}
                          value={sc[`${subj.id}_${col.id}`]}
                          onChange={v=>setCell(s.id,`${subj.id}_${col.id}`,v)}
                          sc={subj.color}
                        />
                      )),
                      <td key={`${subj.id}_sp`} style={{ minWidth:26, background: hcMode ? `${subj.color}04` : rowBg }}/>,
                    ]
                  })}

                  {/* Simulacros */}
                  {showSims && (collapsed['sims']
                    ? <td style={{ minWidth:52, background: hcMode ? `${HC.sims}06` : rowBg }}/>
                    : [...visibleSims.flatMap(n=>[
                        <ScoreCell key={`sim_${n}_sc`} compact value={sc[`sim_${n}`]} onChange={v=>setCell(s.id,`sim_${n}`,v)} sc={HC.sims}/>,
                        <CheckCell key={`sim_${n}_t`} checked={!!sc[`sim_${n}_tarea`]} onChange={()=>setCell(s.id,`sim_${n}_tarea`,!sc[`sim_${n}_tarea`])} bg={rowBg} sc={HC.sims}/>,
                        <CheckCell key={`sim_${n}_a`} checked={!!sc[`sim_${n}_analisis`]} onChange={()=>setCell(s.id,`sim_${n}_analisis`,!sc[`sim_${n}_analisis`])} bg={rowBg} sc={HC.sims}/>,
                      ]),
                      <td key="sims_sp" style={{ minWidth:26, background: hcMode ? `${HC.sims}04` : rowBg }}/>,
                    ]
                  )}

                  {/* Online */}
                  {showOnline && (collapsed['online']
                    ? <td style={{ minWidth:52, background: hcMode ? `${HC.online}06` : rowBg }}/>
                    : [...Array.from({length:onlineCount},(_,i)=>i+1).map(n=>(
                        <ScoreCell key={`on_${n}`} compact value={sc[`on_${n}`]} onChange={v=>setCell(s.id,`on_${n}`,v)} sc={HC.online}/>
                      )),
                      <td key="online_sp" style={{ minWidth:26, background: hcMode ? `${HC.online}04` : rowBg }}/>,
                    ]
                  )}

                  {/* Asistencias */}
                  {showAttendance && <AttSummaryCell studentId={s.id} attendance={attendance} onClick={()=>setAttModal(s.id)}/>}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )

  // ── Add student bar ──────────────────────────────────────────────────────────
  const legend = (
    <div className="flex flex-wrap gap-4 mt-2" style={{ fontSize:11, color: 'var(--t4)' }}>
      {[['≥8','var(--good)'],['6–7.9','var(--warn)'],['<6','var(--bad)'],['NP','var(--t4)']].map(([l,c])=>(
        <span key={l} className="flex items-center gap-1.5">
          <span style={{ width:10, height:10, borderRadius:3, background:c, opacity:.6, flexShrink:0 }}/>
          {l}
        </span>
      ))}
      <span style={{ color: 'var(--t4)' }}>· Click en celda para editar · Enter para guardar</span>
    </div>
  )

  /* ── Delete confirmation modal (before fullscreen early-return) ────────────── */
  const deleteModal = deleteConfirm && createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background:'rgba(0,0,0,.65)', backdropFilter:'blur(6px)' }}
      onClick={() => setDeleteConfirm(null)}>
      <div className="w-full max-w-sm rounded-2xl p-6 space-y-4 animate-scale-in"
        style={{ background:'var(--panel-bg)', border: '1px solid var(--card-border)', boxShadow:'0 24px 72px rgba(0,0,0,.70)' }}
        onClick={e => e.stopPropagation()}>

        <div className="w-11 h-11 rounded-2xl flex items-center justify-center mx-auto"
          style={{ background:'var(--bad-soft)', border:'1px solid var(--bad-line)' }}>
          <Trash2 size={20} style={{ color:'var(--bad)' }}/>
        </div>

        <div className="text-center">
          <h2 className="text-base font-bold mb-1" style={{ color: 'var(--t1)' }}>
            ¿Eliminar alumno?
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--t2)' }}>
            Se eliminará a{' '}
            <strong style={{ color: 'var(--t1)' }}>{deleteConfirm.name}</strong>
            {' '}del registro. Esta acción no se puede deshacer.
          </p>
        </div>

        <div className="flex gap-3">
          <button onClick={() => setDeleteConfirm(null)}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{ background: 'var(--soft-bg)', color: 'var(--t2)' }}
            onMouseEnter={e => e.currentTarget.style.background= 'var(--t4)'}
            onMouseLeave={e => e.currentTarget.style.background= 'var(--t2)'}>
            Cancelar
          </button>
          <button
            onClick={() => { removeStudent(deleteConfirm.id); setDeleteConfirm(null) }}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all"
            style={{ background:'var(--bad-soft)', border:'1px solid var(--bad-line)', color:'var(--bad)' }}
            onMouseEnter={e => e.currentTarget.style.background='var(--bad-line)'}
            onMouseLeave={e => e.currentTarget.style.background='var(--bad-soft)'}>
            Sí, eliminar
          </button>
        </div>
      </div>
    </div>,
    document.body
  )

  /* ── Restore banner (must be defined BEFORE the fullscreen early-return) ──── */
  const leaveModal = showLeaveModal && createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background:'rgba(0,0,0,.65)', backdropFilter:'blur(6px)' }}>
      <div className="w-full max-w-sm rounded-2xl p-6 space-y-4 animate-scale-in"
        style={{ background:'var(--panel-bg)', border: '1px solid var(--card-border)', boxShadow:'0 24px 72px rgba(0,0,0,.70)' }}>
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center mx-auto"
          style={{ background:'var(--warn-soft)', border:'1px solid var(--warn-line)' }}>
          <AlertTriangle size={20} style={{ color:'var(--warn)' }}/>
        </div>
        <div className="text-center">
          <h2 className="text-base font-bold mb-1" style={{ color: 'var(--t1)' }}>
            ¿Salir del registro?
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--t3)' }}>
            Tienes calificaciones y cambios sin finalizar. Puedes guardar un borrador para continuar después.
          </p>
        </div>
        <div className="space-y-2">
          <button onClick={() => confirmLeave(true)}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all"
            style={{ background:'white', color:'black' }}>
            <Save size={13}/> Guardar borrador y salir
          </button>
          <button onClick={() => confirmLeave(false)}
            className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{ background:'var(--bad-soft)', border:'1px solid var(--bad-line)', color:'var(--bad)' }}
            onMouseEnter={e => e.currentTarget.style.background='var(--bad-line)'}
            onMouseLeave={e => e.currentTarget.style.background='var(--bad-soft)'}>
            Descartar cambios y salir
          </button>
          <button onClick={() => setShowLeaveModal(false)}
            className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{ background: 'var(--soft-bg)', color: 'var(--t2)' }}>
            Seguir editando
          </button>
        </div>
      </div>
    </div>,
    document.body
  )

  // ── Fullscreen wrapper (portal → fuera del árbol DOM del layout) ────────────
  if (isFullscreen) return createPortal(
    <HCCtx.Provider value={hcMode}>
      <div style={{ position:'fixed', inset:0, zIndex:9999, background: hcMode ? '#f8fafc' : 'var(--card-bg)', display:'flex', flexDirection:'column' }}>
        {/* Topbar fullscreen */}
        <div style={{ flexShrink:0, display:'flex', alignItems:'flex-start', gap:12, padding:'12px 20px 10px', borderBottom: hcMode ? '2px solid #1e293b20' : '1px solid rgba(255,255,255,.07)', background: hcMode ? '#ffffff' : 'rgba(5,5,10,.92)', backdropFilter:'blur(16px)', WebkitBackdropFilter:'blur(16px)' }}>
          <div style={{ flex:1, minWidth:0 }}>{toolbar}</div>
          {/* Salida. 44 px de lado: el mínimo táctil recomendado, y la hoja se
              usa con el dedo justo en esta vista. */}
          <button onClick={() => setIsFullscreen(false)}
            aria-label="Salir de pantalla completa" title="Salir de pantalla completa"
            style={{ flexShrink:0, width:44, height:44, display:'flex', alignItems:'center', justifyContent:'center',
              borderRadius:12, border:'1px solid var(--card-border)',
              background:'var(--soft-bg)', color:'var(--t1)' }}>
            <X size={18}/>
          </button>
        </div>
        {/* Contenido */}
        <div style={{ flex:1, minHeight:0, display:'flex', flexDirection:'column', overflow:'hidden', padding:'12px 16px 8px' }}>
          {focusBar}
          {tableEl}
          {legend}
        </div>

        {/* Sólo cuando el navegador no dejó fijar el apaisado (iOS). Se retira
            solo en cuanto el aparato gira. */}
        {avisoGirar && (
          <div style={{ position:'absolute', left:16, right:16, bottom:16, display:'flex', alignItems:'center', gap:10,
            padding:'12px 14px', borderRadius:14,
            border:'1px solid var(--card-border)', background:'var(--panel-bg)', color:'var(--t1)' }}>
            <RotateCw size={18} style={{ flexShrink:0, color:'var(--accent)' }}/>
            <span style={{ fontSize:12, lineHeight:1.35 }}>
              Gira el dispositivo para ver la hoja completa. Este navegador no permite fijar el apaisado.
            </span>
            <button onClick={() => setAvisoGirar(false)} aria-label="Ocultar aviso"
              style={{ marginLeft:'auto', flexShrink:0, width:28, height:28, display:'flex', alignItems:'center', justifyContent:'center', borderRadius:8, color:'var(--t3)' }}>
              <X size={14}/>
            </button>
          </div>
        )}
        {/* Modales */}
        {attModal && <AttendanceModal studentId={attModal} studentName={students.find(s=>s.id===attModal)?.name??''} attendance={attendance} onChange={toggleAtt} onClose={()=>setAttModal(null)}/>}
        {addColModal && <AddColModal subjName={subjects.find(s=>s.id===addColModal)?.name??''} onAdd={(n,t)=>addCol(addColModal,n,t)} onClose={()=>setAddColModal(null)}/>}
        {addSubjModal && <AddSubjectModal onAdd={addSubject} onClose={()=>setAddSubjModal(false)}/>}
        {showAddStudent && <StudentFormModal groups={[group]} defaultGroupId={group.id}
          onClose={()=>setShowAddStudent(false)} onSaved={cred=>{setShowAddStudent(false);if(cred)setLastCred(cred);onDataChange?.()}}/>}
        {lastCred && <CredentialsPanel cred={lastCred} onClose={()=>setLastCred(null)}/>}
        {deleteModal}
        {leaveModal}
      </div>
    </HCCtx.Provider>,
    document.body
  )

  // ── Vista normal ─────────────────────────────────────────────────────────────
  return (
    <HCCtx.Provider value={hcMode}>
      <div className="space-y-3">
        {toolbar}
        {focusBar}
        {tableEl}
        {legend}

        {attModal && <AttendanceModal studentId={attModal} studentName={students.find(s=>s.id===attModal)?.name??''} attendance={attendance} onChange={toggleAtt} onClose={()=>setAttModal(null)}/>}
        {addColModal && <AddColModal subjName={subjects.find(s=>s.id===addColModal)?.name??''} onAdd={(n,t)=>addCol(addColModal,n,t)} onClose={()=>setAddColModal(null)}/>}
        {addSubjModal && <AddSubjectModal onAdd={addSubject} onClose={()=>setAddSubjModal(false)}/>}
        {deleteModal}
        {leaveModal}
      </div>
    </HCCtx.Provider>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PÁGINA PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

export default function Registrar() {
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [groups, setGroups]     = useState([])
  const [students, setStudents] = useState([])
  const [loading, setLoading]   = useState(true)

  const cargar = useCallback(async () => {
    try {
      const [g, s] = await Promise.all([fetchGroups(), fetchStudents()])
      setGroups(g); setStudents(s)
    } catch { /* la pantalla muestra su estado vacío */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  if (!selectedGroup) {
    return <GroupPicker groups={groups} students={students} loading={loading} onSelect={setSelectedGroup}/>
  }
  return (
    <RegisterTable
      group={selectedGroup}
      groupStudents={students.filter(s => s.groupId === selectedGroup.id)}
      onBack={() => setSelectedGroup(null)}
      onDataChange={cargar}
    />
  )
}
