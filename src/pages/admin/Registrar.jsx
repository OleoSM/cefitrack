import { nombreCanal } from '../../lib/realtime'
import { useState, useMemo, useRef, useEffect, useCallback, createContext, useContext } from 'react'
import AvatarAlumno from '../../components/ui/AvatarAlumno'
import { useNavigate, useLocation } from 'react-router-dom'
import { createPortal } from 'react-dom'
import {
  Plus, Minus, Check, ChevronDown, ChevronRight,
  UserPlus, X, Maximize2, SlidersHorizontal,
  ArrowLeft, Calendar, Shield, Users, Clock,
  Save, RotateCw, Download, Pencil, Search, Columns2, Rows3,
} from 'lucide-react'
import clsx from 'clsx'
import {
  fetchGroups, fetchStudents,
  fetchColumnasRegistro, fetchCeldasRegistro, fetchAsistenciaRegistro,
  setCeldaRegistro, crearColumnaRegistro, borrarColumnaRegistro, setRegistroAdmin,
  actualizarContactoAlumno,
} from '../../lib/supabaseData'
import GroupShaderCard from '../../components/ui/GroupShaderCard'
import { useGroupColors } from '../../hooks/useGroupColors'
import ProgressiveList from '../../components/ui/ProgressiveList'
import ModalPortal from '../../components/ui/ModalPortal'
import { useBreakpoint } from '../../hooks/useBreakpoint'
import { NeonCheckbox } from '../../components/ui/NeonCheckbox'
import { useAdminTheme } from '../../context/AdminThemeContext'
import { folioEX, folioEXD } from '../../lib/folios'
import { supabase } from '../../lib/supabaseClient'
import { useSucursalActiva, TODAS } from '../../hooks/useSucursalActiva'
import { fetchDocumentosAlumnos } from '../../lib/expedienteData'
import { fetchPagosDeAlumnos, estadoPagoExamenes } from '../../lib/pagosData'
import { AREAS_UNIVERSIDAD } from '../../lib/areas'
import StudentFormModal from '../../components/admin/StudentFormModal'
import CredentialsPanel from '../../components/admin/CredentialsPanel'
import StudentDock from '../../components/ui/StudentDock'
import BarraFiltros from '../../components/ui/BarraFiltros'
import { tintaSobre } from '../../lib/color'

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
  area:   '#7A3F63',
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
  const navigate = useNavigate()
  const { getAccent } = useGroupColors()
  const { sucursal, setSucursal, opcionesConTodas } = useSucursalActiva()
  const [query, setQuery] = useState('')
  const [columns, setColumns] = useState(1)
  const gruposSucursal = sucursal === TODAS ? groups : groups.filter(g => g.sucursal === sucursal)
  const gruposVisibles = gruposSucursal.filter(g => `${g.name} ${g.subject}`.toLowerCase().includes(query.trim().toLowerCase()))

  return (
    <div className="w-full space-y-5">
      <div>
        <h1 className="page-title">Calificaciones</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--t3)' }}>
          Selecciona el grupo para abrir su lista de registro.
        </p>
      </div>

      <BarraFiltros
        filtros={[
          { id:'sucursal', label:'Sucursal', value:sucursal, onChange:setSucursal,
            porDefecto:sucursal, options:opcionesConTodas },
        ]}
        busqueda={{
          value: query,
          onChange: setQuery,
          placeholder: 'Buscar grupo por nombre',
          coincidencias: gruposVisibles.map(g => ({
            id:g.id, label:g.name, sub:g.subject,
          })),
          /* Elegir un grupo aquí es abrir su hoja: es lo único que se hace en
             esta pantalla. */
          onElegir: id => { const g = groups.find(x => x.id === id); if (g) onSelect(g) },
        }}
        resumen={`${gruposVisibles.length} grupo(s)`}
        acciones={
          <button className="btn-secondary p-2.5 flex-shrink-0" onClick={()=>setColumns(v=>v===1?2:1)}
            title="Cambiar distribución" aria-label="Cambiar distribución">
            {columns===1?<Columns2 size={16}/>:<Rows3 size={16}/>}
          </button>
        }/>

      {!loading && groups.length === 0 && (
        <div className="card p-8 text-center">
          <p className="text-sm" style={{ color: 'var(--t3)' }}>
            No hay grupos todavía. Créalos desde la sección Grupos.
          </p>
        </div>
      )}

      <ProgressiveList items={gruposVisibles} className={`grid gap-4 ${columns===2?'lg:grid-cols-2':'grid-cols-1'}`}
        sizes={{ mobile: 4, tablet: 8, desktop: 12 }}
        emptyLabel={groups.length ? 'Ningún grupo coincide con la sucursal o la búsqueda.' : ''}>
        {g => {
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
                  {/* Mismo dock que en Grupos: con foto, con el nombre en el
                      globo y abriendo el perfil al pulsar. Aquí eran iniciales
                      grises que no llevaban a ninguna parte. */}
                  <StudentDock students={grpStudents} accent={accent}
                    onOpenStudent={id => navigate(`/admin/alumnos/${id}`)}/>
                  <button className="btn-secondary text-xs py-2 gap-1.5 pointer-events-none" tabIndex={-1}>
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
        }}
      </ProgressiveList>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// CELDAS
// ─────────────────────────────────────────────────────────────────────────────

/* `celda`: identificador "alumno_columna" para poder llegar a esta celda
   desde el detalle de una calificación. `foco`: resaltada (se acaba de llegar
   a ella): borde grueso de acento que parpadea para guiar la vista. */
function ScoreCell({ value, onChange, compact, bg: cellBg, sc, celda, foco = false }) {
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
    <td style={{ minWidth: compact ? 52 : 64, background: hc ? 'var(--card-bg)' : (cellBg ?? SOLID_BG), padding:0 }}>
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

  const hcBorder   = '1px solid var(--divider)'
  const neonBorder = sc ? `1px solid ${sc}55` : 'none'
  const neonGlow   = (sc && display !== '—') ? `0 0 7px ${sc}35` : 'none'
  return (
    <td onClick={startEdit} title="Click para editar" data-celda={celda}
      className={foco ? 'celda-foco' : undefined}
      style={{
      minWidth: compact ? 52 : 64, textAlign:'center', fontSize:12, fontWeight:700,
      color: col,
      background: hc ? (bg ? bg : 'var(--card-bg)') : (bg || (cellBg ?? 'transparent')),
      border: hc ? hcBorder : neonBorder,
      boxShadow: hc ? 'none' : neonGlow,
      borderRadius: 3,
      padding:'0 2px', cursor:'pointer', userSelect:'none',
      transition:'background .15s',
      ...(foco ? { outline:'3px solid var(--accent)', outlineOffset:'-3px' } : null),
    }}>{display}</td>
  )
}

function CheckCell({ checked, onChange, bg: cellBg, sc }) {
  const hc = useHC()
  return (
    <td style={{
      minWidth:52, textAlign:'center',
      background: hc ? 'var(--card-bg)' : cellBg,
      border: hc ? '1px solid var(--divider)' : sc ? `1px solid ${sc}45` : 'none',
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
            ? '1.5px solid var(--bad)'
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

/* Resumen de asistencia de un alumno sobre TODAS las sesiones capturadas del
   grupo. La hoja guarda 1 = presente, 2 = retardo, 0 = falta, y cargarHoja
   rellena con 0 las sesiones en que el alumno no aparece. Antes sólo se
   contaban las fechas con registro (las faltas no existían) y los retardos
   se trataban como falta. Regla del centro: el retardo es asistencia. */
export function resumenAsistencia(att = {}) {
  const valores = Object.values(att)
  const total   = valores.length
  const present = valores.filter(v => v === 1 || v === 2).length
  return { total, present, pct: total > 0 ? (present / total) * 100 : 0 }
}

function GuaranteeBadge({ studentId, cells, attendance, simCount, bg: cellBg, sc }) {
  const hc = useHC()
  const { pct } = resumenAsistencia(attendance[studentId])
  const simsOk = Array.from({length:simCount},(_,i)=>i+1)
    .every(n => { const v=cells[`sim_${n}`]; return v!==undefined && v!=='NP' && parseFloat(v)>0 })
  const ok = pct >= 90 && simsOk
  return (
    <td style={{
      minWidth:90,
      background: hc ? 'var(--card-bg)' : cellBg,
      border: hc ? '1px solid var(--divider)' : 'none',
      padding:'0 6px',
    }}>
      <span className={clsx('flex items-center justify-center gap-1 px-2 py-1 rounded-full mx-auto',
        ok ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
           : 'bg-red-500/15 text-red-400 border border-red-500/30')}
        style={{ fontSize:10, fontWeight:700, maxWidth:80 }}>
        <Shield size={9}/>{ok ? 'Garantía' : 'Sin gar.'}
      </span>
    </td>
  )
}

function AttSummaryCell({ studentId, attendance, onClick }) {
  const hc = useHC()
  const r = resumenAsistencia(attendance[studentId])
  const { total, present } = r
  const pct = Math.round(r.pct)
  const col = pct>=90 ? 'var(--good)' : pct>=75 ? 'var(--warn)' : 'var(--bad)'
  return (
    <td style={{
      minWidth:88, padding:'2px 6px',
      background: hc ? 'var(--card-bg)' : 'transparent',
      border: hc ? '1px solid var(--divider)' : 'none',
    }}>
      <button onClick={onClick}
        className="w-full flex flex-col items-center py-1 rounded-lg transition-all"
        style={{
          background: 'var(--card-bg)',
          border: '1px solid var(--card-border)',
        }}
        title="Abrir calendario">
        <span style={{ fontSize:13, fontWeight:900, color:col, lineHeight:1.2 }}>{pct}%</span>
        <span style={{ fontSize:9, color: 'var(--t3)' }}>{present}/{total}</span>
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
  const resumen = resumenAsistencia(att)
  const present = resumen.present
  const pct     = Math.round(resumen.pct)
  // Solo lectura: la asistencia se captura en Pasar Lista. Tener dos lugares
  // donde marcarla garantizaba que tarde o temprano dijeran cosas distintas.
  const toggle = () => {}

  return (
    <ModalPortal maxWidth="max-w-lg" onClose={onClose}>
        <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: '1px solid var(--divider)' }}>
          <div>
            <p className="text-sm font-bold" style={{ color: 'var(--t1)' }}>
              <Calendar size={13} className="inline mr-1.5 -mt-0.5"/> {studentName}
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--t3)' }}>{present}/{total} días · {pct}%</p>
            <p className="text-[10px] mt-1" style={{ color: 'var(--t4)' }}>
              Reflejo de Pasar Lista. Para corregir un día, entra ahí.
            </p>
          </div>
          <button onClick={onClose} aria-label="Cerrar asistencia" className="w-11 h-11 flex items-center justify-center rounded-lg flex-shrink-0"><X size={15} style={{ color: 'var(--t3)' }}/></button>
        </div>

        <div className="flex gap-1 px-5 pt-3 pb-2 overflow-x-auto">
          {MONTHS_ES.map((m,i) => (
            <button key={m} onClick={() => setMonth(i)}
              className="flex-shrink-0 min-h-11 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{ background:month===i?'var(--accent)':'var(--soft-bg)', color:month===i?'var(--accent-contrast)':'var(--t3)' }}>
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
                  const isP=val===1, isT=val===2, isA=val===0
                  return (
                    <div key={ci}
                      className="rounded-lg text-xs font-bold py-1.5 text-center"
                      style={{
                        background:isP?'var(--good-soft)':isT?'var(--warn-soft)':isA?'var(--bad-soft)':'var(--card-bg)',
                        border:`1px solid ${isP?'var(--good-line)':isT?'var(--warn-line)':isA?'var(--bad-line)':'var(--card-border)'}`,
                        color:isP?'var(--good)':isT?'var(--warn)':isA?'var(--bad)':'var(--t4)',
                      }}>
                      {d.getDate()}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
    </ModalPortal>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MODALES AUXILIARES
// ─────────────────────────────────────────────────────────────────────────────

function AddColModal({ subjName, onAdd, onClose }) {
  const [name,setName]=useState(''); const [type,setType]=useState('actividad')
  return (
    <ModalPortal maxWidth="max-w-sm" onClose={onClose}>
      <div className="p-5 space-y-4">
        <h2 className="text-sm font-bold" style={{ color: 'var(--t1)' }}>Añadir columna — {subjName}</h2>
        <input value={name} onChange={e=>setName(e.target.value)} placeholder="Nombre (ej: TAREA 4)"
          className="input-field w-full min-h-11" onKeyDown={e=>e.key==='Enter'&&name.trim()&&onAdd(name.trim(),type)}/>
        <div className="flex gap-2">
          {['actividad','tarea'].map(t=>(
            <button key={t} onClick={()=>setType(t)} className="flex-1 min-h-11 py-2 rounded-xl text-xs font-bold transition-all"
              style={{ background:type===t?'var(--accent)':'var(--soft-bg)', color:type===t?'var(--accent-contrast)':'var(--t3)' }}>
              {t.charAt(0).toUpperCase()+t.slice(1)}
            </button>
          ))}
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1 min-h-11 justify-center">Cancelar</button>
          <button onClick={()=>name.trim()&&onAdd(name.trim(),type)} disabled={!name.trim()}
            className="btn-primary flex-1 min-h-11 justify-center">Añadir</button>
        </div>
      </div>
    </ModalPortal>
  )
}

function AddSubjectModal({ onAdd, onClose }) {
  const [name,setName]=useState('')
  // Literales a propósito: se guardan en subj.color. Tonos mate, no neón.
  const COLORS=['#2B5F9E','#5D3E90','#2F6B41','#8A5A12','#A03A32','#90501C','#94356B','#1C6474']
  const [color,setColor]=useState(COLORS[0])
  return (
    <ModalPortal maxWidth="max-w-sm" onClose={onClose}>
      <div className="p-5 space-y-4">
        <h2 className="text-sm font-bold" style={{ color: 'var(--t1)' }}>Nueva sección</h2>
        <input value={name} onChange={e=>setName(e.target.value)} placeholder="Nombre de la sección"
          className="input-field w-full min-h-11" onKeyDown={e=>e.key==='Enter'&&name.trim()&&onAdd(name.trim(),color)} autoFocus/>
        <div className="flex gap-2 flex-wrap">
          {COLORS.map(c=>(
            <button key={c} onClick={()=>setColor(c)} aria-label={`Elegir color ${c}`} className="w-11 h-11 rounded-full transition-all active:scale-90"
              style={{ background:c, outline:color===c?'3px solid var(--accent)':'none', outlineOffset:2 }}/>
          ))}
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1 min-h-11 justify-center">Cancelar</button>
          <button onClick={()=>name.trim()&&onAdd(name.trim(),color)} disabled={!name.trim()}
            className="btn-primary flex-1 min-h-11 justify-center">Añadir</button>
        </div>
      </div>
    </ModalPortal>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// HEADER DE SECCIÓN (collapse/expand con +/-)
// ─────────────────────────────────────────────────────────────────────────────

function SectionHeader({ label, cols, color, collapsed, onToggle, onAdd, onRemoveItem, onRename, nota }) {
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
        {nota && (
          <span className="normal-case tracking-normal rounded-full px-2 py-0.5 text-[10px] font-bold whitespace-nowrap"
            style={{ background:'var(--panel-bg)', color:'var(--t2)' }}>{nota}</span>
        )}

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
  const ok    = value === 'validado' || value === 'firmado' || value === 'validada' || value === 'pagado'
  const medio = value === 'entregado' || value === 'entregada'
  return <td style={{minWidth:72,textAlign:'center',fontSize:10,fontWeight:700,background:bg,
    color: ok ? 'var(--good)' : medio ? 'var(--warn)' : value === 'rechazado' ? 'var(--bad)' : 'var(--t4)'}}>
    {value || 'Pendiente'}
  </td>
}

function AreaCell({ value, onChange, bg, sc }) {
  const hc = useHC()
  return (
    <td style={{ minWidth:76, textAlign:'center', background: hc ? 'var(--card-bg)' : bg,
      border:`1px solid ${sc}${hc ? '45' : '40'}`, padding:'0 2px', verticalAlign:'middle' }}>
      <select
        value={value ?? ''}
        onChange={e => onChange(e.target.value === '' ? null : Number(e.target.value))}
        aria-label="Área del alumno"
        title={AREAS_UNIVERSIDAD.find(a => a.id === value)?.label ?? 'Sin área asignada'}
        style={{ width:'100%', fontSize:11, fontWeight:700, textAlign:'center',
          background:'transparent', border:'none', outline:'none', cursor:'pointer',
          color: value ? (hc ? sc : 'var(--t1)') : 'var(--t4)',
          appearance:'none', padding:'4px 2px' }}>
        <option value="">—</option>
        {AREAS_UNIVERSIDAD.map(a => (
          <option key={a.id} value={a.id} style={{ background:'var(--panel-bg)', color:'var(--t1)' }}>
            {a.corto}
          </option>
        ))}
      </select>
    </td>
  )
}

/* `locked` marca las columnas del esqueleto de la hoja —documentos, pago,
   garantía, área, asistencia y las secciones de la plantilla base—. No se
   renombran ni se borran: renombrarlas rompe el significado de la columna para
   quien la lea después, y borrarlas por accidente se lleva las notas. */
function EditableColumnHeader({ value, onChange, onRemove, light, minWidth = 52, rowSpan, style: extraStyle, locked }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const inputRef = useRef(null)
  const textColor = light ? '#0f172a' : '#ffffff'

  useEffect(() => { if (!editing) setDraft(value) }, [value, editing])

  if (locked) return (
    <th rowSpan={rowSpan} title="Columna fija de la hoja"
      style={{ minWidth, padding:'4px 2px', textAlign:'center', fontSize:9,
        fontWeight:700, color:textColor, borderRight:'1px solid var(--divider)', ...extraStyle }}>
      {value}
    </th>
  )

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

function RegisterTable({ group, groupStudents, onBack, onDataChange, foco = null }) {
  /* Esta hoja es la fuente maestra de calificaciones: columnas, celdas y datos
     administrativos viven en la BD. Antes todo estaba en localStorage, así que
     lo capturado sólo existía en la máquina de quien lo escribió y no llegaba
     al perfil del alumno, a Evaluaciones ni al portal del alumno. */
  /* El avatar y el grupo viajan con la fila. Antes esta proyección se
     quedaba con el id y el nombre, así que `AvatarAlumno` recibía un alumno
     sin `avatarSrc` ni `groupId` y caía siempre en las iniciales grises: en la
     hoja donde más se recorre la lista, nadie se reconocía. */
  const rosterFromDb = () => groupStudents.map(s => ({
    id: s.id, name: s.name,
    avatar: s.avatar,
    avatarSrc: s.avatarSrc,
    groupId: s.groupId,
    pago: s.pagoEstado ?? '',
    garantia: s.garantia ?? '',
    firmaGar: !!s.firmaGarantia,
    firmaTyC: s.termsStatus === 'firmado',
    exGral: !!s.examenGeneral,
  }))

  const [students,      setStudents]      = useState(rosterFromDb)
  const [subjects,      setSubjects]      = useState([])
  /* Simulacros (EX) y Exámenes digitales (EXD) están bloqueados: aún no se
     guardan en la BD, así que no se ofrecen columnas que parezcan funcionar. */
  const simCount = 0
  const onlineCount = 0
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
  const [saveFlash,     setSaveFlash]     = useState(false)
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
  /* Marca que se salió de la pantalla completa a propósito estando en
     horizontal. Sin ella, el efecto de abajo volvería a entrar en el acto y
     el botón de salir no serviría de nada. */
  const salidaManual = useRef(false)

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

  /* Girar el aparato ES la petición: poner el teléfono en horizontal sobre
     esta hoja sólo puede significar «quiero verla entera», y pedirlo además
     con un botón sobra. Al volver a vertical se sale, que es igual de
     inequívoco. Sólo en táctil: en un monitor la orientación no dice nada.

     Ojo con `requestFullscreen`: el navegador la reserva para gestos del
     usuario y un giro no cuenta, así que puede rechazarla. No importa —el
     overlay es nuestro y ocupa la ventana igual—; la nativa es una mejora,
     no el mecanismo. */
  useEffect(() => {
    if (!esTactil) return undefined
    const mq = window.matchMedia('(orientation: landscape)')
    const alGirar = () => {
      if (mq.matches) {
        if (!salidaManual.current) setIsFullscreen(true)
      } else {
        salidaManual.current = false
        setIsFullscreen(false)
      }
    }
    alGirar()
    mq.addEventListener('change', alGirar)
    return () => mq.removeEventListener('change', alGirar)
  }, [esTactil])

  /* Salir con Esc o con el botón "atrás" del sistema deja la pantalla completa
     nativa pero no nuestro overlay; hay que sincronizarlos. Sólo en táctil,
     que es donde llegamos a pedirla. */
  useEffect(() => {
    if (!esTactil) return
    const alCambiarFS = () => {
      if (!document.fullscreenElement) { salidaManual.current = true; setIsFullscreen(false) }
    }
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
      const [cols, celdas, asis, docs, pagosAlumnos] = await Promise.all([
        fetchColumnasRegistro(group.id),
        fetchCeldasRegistro(group.id),
        fetchAsistenciaRegistro(group.id),
        fetchDocumentosAlumnos(groupStudents.map(s=>s.id)),
        // El cobro de los exámenes adicionales se refleja solo en la hoja: no
        // hay que marcarlo dos veces, en Pagos y aquí.
        fetchPagosDeAlumnos(groupStudents.map(s=>s.id)).catch(() => []),
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
      // Cada alumno arranca con FALTA en todas las sesiones capturadas del
      // grupo; sólo los registros de Pasar Lista lo vuelven presente/retardo.
      const att = {}
      for (const s of groupStudents) {
        att[s.id] = Object.fromEntries(asis.fechas.map(fecha => [fecha, 0]))
      }
      for (const [sid, porFecha] of Object.entries(asis.porAlumno)) {
        att[sid] ??= Object.fromEntries(asis.fechas.map(fecha => [fecha, 0]))
        for (const [fecha, estado] of Object.entries(porFecha)) {
          att[sid][fecha] = estado === 'presente' ? 1 : estado === 'tardanza' ? 2 : 0
        }
      }
      setAttendance(att)
      setStudents(rosterFromDb().map(student => {
        const alumno = groupStudents.find(s => s.id === student.id)
        const examenes = estadoPagoExamenes(pagosAlumnos.filter(p => p.studentId === student.id))
        return { ...student,
          curpEstado:docs.find(d=>d.student_id===student.id&&d.document_type==='curp')?.status ?? 'pendiente',
          ineEstado:docs.find(d=>d.student_id===student.id&&d.document_type==='ine_tutor')?.status ?? 'pendiente',
          area:alumno?.universidadArea ?? null,
          garantiaEstado:alumno?.garantiaEstado ?? 'pendiente',
          accesoEstado:alumno?.accesoEstado ?? 'pendiente',
          examenesEstado: examenes.pagado ? 'pagado' : 'pendiente',
        }
      }))
    } catch (err) {
      setErrorHoja('No se pudo cargar la hoja. Revisa tu conexión y vuelve a intentar.')
    } finally {
      setCargandoHoja(false)
    }
  }, [group.id, groupStudents])

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
      .channel(nombreCanal(`registro-grupo-${group.id}`))
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

  /* El área vive en `students.universidad_area`, no en la hoja: es un dato del
     alumno que también necesitan su perfil y su propio panel, no una nota. */
  const setArea = async (sid, val) => {
    const alumno = groupStudents.find(s => s.id === sid)
    /* La RPC reescribe los tres datos de contacto junto con el área. Sin la
       fila del alumno a mano se enviarían tres `null` y se borrarían sus
       correos y teléfonos: mejor no guardar nada. */
    if (!alumno) { setErrorHoja('No se pudo guardar el área: recarga la hoja e inténtalo de nuevo.'); return }
    const previo = students.find(s => s.id === sid)?.area ?? null
    setStudents(p => p.map(s => s.id === sid ? { ...s, area: val } : s))
    try {
      await actualizarContactoAlumno({
        id: sid,
        personalEmail: alumno.personalEmail ?? null,
        whatsapp: alumno.whatsapp ?? null,
        tutorWhatsapp: alumno.tutor?.whatsapp ?? null,
        universidadArea: val,
      })
    } catch {
      setStudents(p => p.map(s => s.id === sid ? { ...s, area: previo } : s))
      setErrorHoja('No se pudo guardar el área del alumno.')
    }
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

  /* Las secciones que crea `asegurar_plantilla_base` son el esqueleto de la
     hoja: se distinguen porque sus columnas vienen marcadas `es_fija`. Ni se
     renombran ni se borran —el error que se quiere evitar es quedarse sin la
     sección de documentos o de exámenes por un clic de más—. */
  const esSeccionFija = subj => subj.cols.some(c => c.esFija)
  const esUniversidad = (group.curso ?? (group.institucion === 'ecoems' ? 'ecoems' : 'universidad')) === 'universidad'

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

  /* ── Llegar a una asignación concreta ──
     Desde el detalle de una calificación ("Ver en la hoja") se llega con
     { columnaId, studentId }: se abre la materia de esa columna, se desplaza
     la hoja hasta la celda del alumno y se resalta unos segundos. Una sola
     vez por llegada. */
  const [celdaFoco, setCeldaFoco] = useState(null)
  const focoAplicado = useRef(false)
  useEffect(() => {
    if (!foco?.columnaId || focoAplicado.current || !subjects.length) return
    const subj = subjects.find(sj => sj.cols.some(c => c.id === foco.columnaId))
    if (!subj) return
    focoAplicado.current = true
    selectFocus(`subject:${subj.id}`)
    const clave = `${foco.studentId}_${foco.columnaId}`
    setCeldaFoco(clave)
    // Tras pintar la materia desplegada, se lleva la celda al centro. Sin
    // limpieza: la hoja recarga sus materias en vivo y eso cancelaría el
    // desplazamiento (el efecto ya no se repite).
    setTimeout(() => {
      document.querySelector(`[data-celda="${clave}"]`)?.scrollIntoView({ block:'center', inline:'center', behavior:'smooth' })
    }, 250)
    setTimeout(() => setCeldaFoco(null), 6000)
    // selectFocus es estable en la práctica (solo usa setters)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [foco, subjects])

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
      const { pct } = resumenAsistencia(attendance[s.id])
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

  // ── Stats ───────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    let conGar=0
    students.forEach(s=>{
      const { pct } = resumenAsistencia(attendance[s.id])
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
    ? { num:0,  name:116, pago:82,  gar:76, area:64 }   // teléfono
    : esCompacto
      ? { num:0,  name:168, pago:104, gar:88, area:76 } // tableta
      : { num:44, name:210, pago:114, gar:92, area:84 } // portátil y monitor
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
        style={{ background: accent, color: tintaSobre(accent) }}>
        {/* Fondo pleno con la tinta que más contraste dé: blanco sobre los
            sólidos institucionales, oscura sobre los acentos luminosos. */}
        <span className="text-xs font-bold">{group.name}</span>
        <span className="text-xs opacity-60">·</span>
        <span className="text-xs opacity-80">{group.subject}</span>
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
        style={saveFlash ? { background:'var(--good-solid)', color:'#fff' } : {}}>
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
          : { maxHeight:isMobile?'max(320px, calc(100dvh - 300px))':'calc(100dvh - 208px)' }) }}>
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
                <EditableColumnHeader locked rowSpan={2} minWidth={W.pago} light={hcMode}
                  value="PAGO"
                  style={{ background:hcMode?'var(--soft-bg)':solidBg, borderBottom:`3px solid ${HC.pago}` }}/>
                <EditableColumnHeader locked rowSpan={2} minWidth={W.gar} light={hcMode}
                  value="GARANTÍA"
                  style={{ background:hcMode?'var(--soft-bg)':solidBg, borderBottom:`3px solid ${HC.gar}` }}/>
                {esUniversidad && (
                  <EditableColumnHeader locked rowSpan={2} minWidth={W.area} light={hcMode}
                    value="ÁREA"
                    style={{ background:hcMode?'var(--soft-bg)':solidBg, borderBottom:`3px solid ${HC.area}` }}/>
                )}
              </>}

              {showDocs && <SectionHeader label="DOCUMENTOS"
                cols={collapsed['docs']?1:5}
                collapsed={!!collapsed['docs']} onToggle={()=>toggleSection('docs')}/>}

              {subjects.filter(subj=>showSubject(subj.id)).map(subj => {
                const fija = esSeccionFija(subj)
                return (
                <SectionHeader key={subj.id}
                  label={fija ? subj.name.toUpperCase() : headerName(`section:${subj.id}`,subj.name.toUpperCase())}
                  color={subj.color}
                  onRename={fija ? undefined : v=>renameHeader(`section:${subj.id}`,v)}
                  cols={collapsed[subj.id] ? 1 : subj.cols.length+1}
                  collapsed={!!collapsed[subj.id]}
                  onToggle={()=>toggleSection(subj.id)}
                  onAdd={()=>setAddColModal(subj.id)}
                  onRemoveItem={fija ? undefined : ()=>removeSubject(subj.id)}
                />
              )})}

              {showSims && <SectionHeader label={headerName('section:sims','SIMULACROS (EX)')}
                onRename={v=>renameHeader('section:sims',v)} color="var(--warn)"
                cols={collapsed['sims']?1:visibleSims.length*3+1}
                collapsed={!!collapsed['sims']}
                onToggle={()=>toggleSection('sims')}
                nota="Próximamente: aún no se guarda"
              />}
              {showOnline && <SectionHeader label={headerName('section:online','EXÁMENES DIGITALES (EXD)')}
                onRename={v=>renameHeader('section:online',v)} color={HC.online}
                cols={collapsed['online']?1:onlineCount+1}
                collapsed={!!collapsed['online']}
                onToggle={()=>toggleSection('online')}
                nota="Próximamente: aún no se guarda"
              />}
              {showAttendance && <SectionHeader label="ASISTENCIAS" color="var(--good)"
                cols={1} collapsed={false} onToggle={()=>{}}/>}
            </tr>

            {/* ── Fila 2: nombres de columna ── */}
            <tr style={{ background: solidBg }}>
              {/* Documentos */}
              {showDocs && (collapsed['docs']
                ? <th style={{ minWidth:52, fontSize:10, color: hcMode ? HC.docs : 'var(--t4)', textAlign:'center', borderRight: hcMode ? `2px solid ${HC.docs}` : '1px solid rgba(255,255,255,.06)' }}>···</th>
                : [
                    ['doc_curp','CURP'],
                    ['doc_ine','INE tutor'],
                    ['doc_terms','Firma T&C'],
                    ['doc_guarantee','Garantía'],
                    ['doc_exams','Exámenes'],
                  ].map(([key,fallback]) => (
                    <EditableColumnHeader locked key={key} minWidth={68} light={hcMode}
                      value={fallback}
                      style={{ background:hcMode?'var(--soft-bg)':`${HC.docs}0a`,
                        borderBottom:`${hcMode?2:1}px solid ${HC.docs}${hcMode?'80':'60'}` }}/>
                  ))
              )}

              {/* Secciones */}
              {subjects.filter(subj=>showSubject(subj.id)).map(subj => {
                if (collapsed[subj.id]) return <th key={subj.id} style={{ minWidth:52, fontSize:10, color: 'var(--t4)', textAlign:'center', borderRight: '1px solid var(--divider)' }}>···</th>
                return [
                  ...subj.cols.map(col => (
                    <EditableColumnHeader key={`${subj.id}_${col.id}`} minWidth={76} light={hcMode}
                      locked={col.esFija}
                      value={col.esFija ? col.name : headerName(`col:${col.id}`,col.name)}
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
              {showAttendance && <EditableColumnHeader locked minWidth={88} light={hcMode}
                value="% ASIST."/>}
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
                      {/* `accent` da el color del grupo a quien no ha elegido
                          avatar, en vez del gris plano de antes. */}
                      <AvatarAlumno student={s} size={24} accent={accent}/>
                      {/* `minWidth:0` es lo que permite a un hijo flex encoger
                          por debajo de su contenido; sin él no hay elipsis. */}
                      <span style={{ fontSize:12, fontWeight:500, color: hcMode ? '#0f172a' : 'rgba(255,255,255,.78)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1, minWidth:0 }}>
                        {s.name}
                      </span>
                    </div>
                  </td>

                  {/* Pago — NO sticky */}
                  {showSummary && <PaymentCell value={s.pago} onChange={v=>setPago(s.id,v)}
                    tdStyle={{ minWidth:W.pago, background: hcMode ? 'var(--card-bg)' : rowBg, border: hcMode ? '1px solid var(--divider)' : `1px solid ${HC.pago}40`, boxShadow: !hcMode ? `0 0 6px ${HC.pago}25` : 'none', verticalAlign:'middle' }}
                  />}

                  {/* Garantía — NO sticky */}
                  {showSummary && <GuaranteeBadge studentId={s.id} cells={sc} attendance={attendance} simCount={simCount}
                    bg={rowBg} sc={HC.gar}
                  />}

                  {/* Área — sólo en grupos de universidad: ECOEMS no se
                      divide por áreas y la columna sobraría en la hoja. */}
                  {showSummary && esUniversidad && (
                    <AreaCell value={s.area} onChange={v=>setArea(s.id,v)} bg={rowBg} sc={HC.area}/>
                  )}

                  {/* Documentos */}
                  {showDocs && (collapsed['docs']
                    ? <td style={{ minWidth:52, background: hcMode ? 'var(--card-bg)' : rowBg }}/>
                    : <>
                        <AutoStatusCell value={s.curpEstado} bg={rowBg}/>
                        <AutoStatusCell value={s.ineEstado} bg={rowBg}/>
                        <AutoStatusCell value={s.firmaTyC?'firmado':'pendiente'} bg={rowBg}/>
                        <AutoStatusCell value={s.garantiaEstado} bg={rowBg}/>
                        <AutoStatusCell value={s.examenesEstado} bg={rowBg}/>
                      </>
                  )}

                  {/* Materias */}
                  {subjects.filter(subj=>showSubject(subj.id)).map(subj => {
                    if(collapsed[subj.id]) return <td key={subj.id} style={{ minWidth:52, background: hcMode ? 'var(--card-bg)' : rowBg }}/>
                    return [
                      ...subj.cols.map(col=>(
                        <ScoreCell key={`${subj.id}_${col.id}`}
                          value={sc[`${subj.id}_${col.id}`]}
                          onChange={v=>setCell(s.id,`${subj.id}_${col.id}`,v)}
                          sc={subj.color}
                          celda={`${s.id}_${col.id}`}
                          foco={celdaFoco === `${s.id}_${col.id}`}
                        />
                      )),
                      <td key={`${subj.id}_sp`} style={{ minWidth:26, background: hcMode ? 'var(--card-bg)' : rowBg }}/>,
                    ]
                  })}

                  {/* Simulacros */}
                  {showSims && (collapsed['sims']
                    ? <td style={{ minWidth:52, background: hcMode ? 'var(--card-bg)' : rowBg }}/>
                    : [...visibleSims.flatMap(n=>[
                        <td key={`sim_${n}_sc`} colSpan={3} style={{ minWidth:160, background: rowBg, textAlign:'center', fontSize:10, color:'var(--t3)' }}>Próximamente</td>,
                      ]),
                      <td key="sims_sp" style={{ minWidth:26, background: hcMode ? 'var(--card-bg)' : rowBg }}/>,
                    ]
                  )}

                  {/* Online */}
                  {showOnline && (collapsed['online']
                    ? <td style={{ minWidth:52, background: hcMode ? 'var(--card-bg)' : rowBg }}/>
                    : [...Array.from({length:onlineCount},(_,i)=>i+1).map(n=>(
                        <td key={`on_${n}`} style={{ minWidth:64, background: rowBg, textAlign:'center', fontSize:10, color:'var(--t3)' }}>Próximamente</td>
                      )),
                      <td key="online_sp" style={{ minWidth:26, background: hcMode ? 'var(--card-bg)' : rowBg }}/>,
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
      {[['≥8','var(--good)'],['6–7.9','var(--warn)'],['<6','var(--bad)'],['NP','var(--bad)']].map(([l,c])=>(
        <span key={l} className="flex items-center gap-1.5">
          <span style={{ width:10, height:10, borderRadius:3, background:c, opacity:.6, flexShrink:0 }}/>
          {l}
        </span>
      ))}
      <span style={{ color: 'var(--t4)' }}>· Click en celda para editar · Enter para guardar</span>
    </div>
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
          <button onClick={() => { salidaManual.current = true; setIsFullscreen(false) }}
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
          onClose={()=>setShowAddStudent(false)} onSaved={async cred=>{await onDataChange?.();if(cred)setLastCred(cred)}}/>}
        {lastCred && <CredentialsPanel cred={lastCred} onClose={()=>setLastCred(null)}/>}
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
        {showAddStudent && <StudentFormModal groups={[group]} defaultGroupId={group.id}
          onClose={()=>setShowAddStudent(false)} onSaved={async cred=>{await onDataChange?.();if(cred)setLastCred(cred)}}/>}
        {lastCred && <CredentialsPanel cred={lastCred} onClose={()=>setLastCred(null)}/>}
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

  // Desde el detalle de una calificación ("Abrir en la hoja") se llega con
  // el grupo ya elegido: se abre su hoja directamente.
  // Se aplica una sola vez: si luego vuelve al selector y la lista de grupos
  // se recarga, no debe reabrirse sola.
  const { state: navState } = useLocation()
  const grupoInicialAplicado = useRef(false)
  useEffect(() => {
    if (grupoInicialAplicado.current || !navState?.groupId || !groups.length) return
    const g = groups.find(x => x.id === navState.groupId)
    if (g) { setSelectedGroup(g); grupoInicialAplicado.current = true }
  }, [navState, groups])

  const selectedStudents = useMemo(
    () => selectedGroup ? students.filter(s => s.groupId === selectedGroup.id) : [],
    [students, selectedGroup],
  )

  if (!selectedGroup) {
    return <GroupPicker groups={groups} students={students} loading={loading} onSelect={setSelectedGroup}/>
  }
  return (
    <RegisterTable
      group={selectedGroup}
      groupStudents={selectedStudents}
      onBack={() => setSelectedGroup(null)}
      onDataChange={cargar}
      foco={navState?.columnaId && navState?.groupId === selectedGroup.id
        ? { columnaId: navState.columnaId, studentId: navState.studentId } : null}
    />
  )
}
