import { nombreCanal } from '../../lib/realtime'
import { useState, useMemo, useRef, useEffect, useCallback, createContext, useContext, Fragment } from 'react'
import AvatarAlumno from '../../components/ui/AvatarAlumno'
import { useNavigate, useLocation } from 'react-router-dom'
import { createPortal } from 'react-dom'
import {
  Plus, Minus, Check, ChevronDown, ChevronRight,
  UserPlus, X, Maximize2, SlidersHorizontal,
  ArrowLeft, Calendar, Shield, Users, Clock,
  Save, RotateCw, Download, Pencil, Search, Columns2, Rows3, GripVertical, AlertTriangle,
} from 'lucide-react'
import clsx from 'clsx'
import {
  fetchGroups, fetchStudents,
  fetchColumnasRegistro, fetchCeldasRegistro, fetchAsistenciaRegistro,
  setCeldaRegistro, crearColumnaRegistro, borrarColumnaRegistro, setRegistroAdmin,
  actualizarContactoAlumno, reordenarRegistro, configurarColumnaRegistro,
  configurarRequisitoColumna, agregarBloqueExamen, fetchOrdenBloques, guardarOrdenBloques, setFechaEntrega,
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
import ConfirmDialog from '../../components/admin/ConfirmDialog'
import AvisoCorreoModal from '../../components/admin/AvisoCorreoModal'
import { plantillaActividad } from '../../lib/avisosData'
import { useAuth } from '../../context/AuthContext'

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
/* Texto "Falta …" cuando la columna tiene un prerrequisito sin cumplir (mismo
   criterio que requisito_cumplido en la BD). La celda se captura igual, pero
   esa calificación no cuenta para el promedio hasta que se cumpla. */
function avisoRequisito(col, sc, colsPorId) {
  if (!col.requisitoId) return null
  const req = colsPorId[col.requisitoId]
  if (!req) return null
  const v = sc[`${req.materia}_${req.id}`]
  let ok
  if (v === undefined || v === null || String(v).trim() === '') ok = false
  else if (req.formato === 'check') ok = v === 1 || v === '1'
  else if (req.formato === 'valor') ok = true
  else if (String(v).toUpperCase() === 'NP') ok = false
  else {
    const n = parseFloat(String(v).replace(',', '.'))
    ok = !isNaN(n) && (col.requisitoMin == null || n >= col.requisitoMin)
  }
  return ok ? null : `Falta ${req.name.replace(/\s+\d+$/, '').toLowerCase()}`
}

function MarcaAviso({ aviso }) {
  if (!aviso) return null
  return <span style={{ display:'block', fontSize:8, fontWeight:800, lineHeight:1.1, color:'var(--bad)', whiteSpace:'nowrap' }}>{aviso}</span>
}

function ScoreCell({ value, onChange, compact, bg: cellBg, sc, celda, foco = false, aviso = null }) {
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
    <td onClick={startEdit} title={aviso ? `${aviso}: no cuenta para el promedio hasta cumplirlo. Click para editar` : 'Click para editar'} data-celda={celda}
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
    }}>
      <span style={{ opacity: aviso && display !== '—' ? .55 : 1, textDecoration: aviso && display !== '—' ? 'line-through' : 'none' }}>{display}</span>
      <MarcaAviso aviso={aviso}/>
    </td>
  )
}

function CheckCell({ checked, onChange, bg: cellBg, sc, aviso = null }) {
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
      <MarcaAviso aviso={aviso}/>
    </td>
  )
}

/* Celda de una actividad que NO es evaluación: texto libre o, si la columna
   define opciones, una lista para elegir. */
function ValorCell({ value, onChange, opciones, sc, aviso = null }) {
  const hc = useHC()
  const [draft, setDraft] = useState(value ?? '')
  useEffect(() => { setDraft(value ?? '') }, [value])
  const estilo = { width:'100%', fontSize:11, fontWeight:700, textAlign:'center', background:'transparent',
    border:'none', outline:'none', color: draft ? 'var(--t1)' : 'var(--t4)', padding:'4px 2px' }
  return (
    <td style={{ minWidth:76, textAlign:'center', background: hc ? 'var(--card-bg)' : 'transparent',
      border: hc ? '1px solid var(--divider)' : sc ? `1px solid ${sc}45` : 'none', padding:'0 2px' }}>
      {opciones?.length ? (
        <select value={draft} onChange={e => { setDraft(e.target.value); onChange(e.target.value) }}
          aria-label="Valor" style={{ ...estilo, cursor:'pointer', appearance:'none' }}>
          <option value="">—</option>
          {opciones.map(o => <option key={o} value={o} style={{ background:'var(--panel-bg)', color:'var(--t1)' }}>{o}</option>)}
        </select>
      ) : (
        <input value={draft} maxLength={60} placeholder="—" aria-label="Valor"
          onChange={e => setDraft(e.target.value)}
          onBlur={() => { if (String(draft) !== String(value ?? '')) onChange(draft.trim()) }}
          onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
          style={estilo}/>
      )}
      <MarcaAviso aviso={aviso}/>
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

/* Garantía: 90 % de asistencia, todos los simulacros presentados, todas las
   tareas entregadas y mínimo 80 % en cada una. `reglas` trae solo las columnas
   que cuentan para la garantía y que ya se aplicaron (alguien tiene valor):
   una tarea que aún no se deja no puede quitarle la garantía a nadie. */
function GuaranteeBadge({ studentId, cells, attendance, reglas, bg: cellBg }) {
  const hc = useHC()
  const { pct, total } = resumenAsistencia(attendance[studentId])
  const vacio = v => v === undefined || v === null || String(v).trim() === '' || String(v).toUpperCase() === 'NP'
  const faltas = []
  if (total > 0 && pct < 90) faltas.push(`Asistencia ${Math.round(pct)} % (mínimo 90 %)`)
  for (const s of reglas?.simulacros ?? []) if (vacio(cells[s.clave])) faltas.push(`No presentó ${s.name}`)
  for (const t of reglas?.tareas ?? []) {
    const v = cells[t.clave]
    if (t.check) { if (!(v === 1 || v === '1')) faltas.push(`No entregó ${t.name}`); continue }
    if (vacio(v)) { faltas.push(`No entregó ${t.name}`); continue }
    const n = parseFloat(String(v).replace(',', '.'))
    if (!isNaN(n) && n < t.calMax * 0.8) faltas.push(`${t.name}: ${n} (mínimo ${+(t.calMax * 0.8).toFixed(2)})`)
  }
  const ok = faltas.length === 0
  return (
    <td title={ok ? 'Cumple: 90 % de asistencia, todos los simulacros y todas las tareas con 80 % o más.' : `Sin garantía:\n· ${faltas.join('\n· ')}`}
      style={{
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

/* ── Configurar columna (crear o editar) ──
   El lápiz ya no renombra solo en este navegador: abre esta ventana y guarda
   en la BD nombre, tipo, FORMATO (calificación / check / valor), máximo, si
   cuenta para el promedio, opciones y descripción. */
const TIPOS_COLUMNA = ['tarea', 'actividad', 'examen', 'proyecto', 'participación']
const FORMATOS = [
  { id:'calificacion', titulo:'Calificación', desc:'Un número de 0 al máximo. Puede contar para el promedio.', icono:'9.5' },
  { id:'check',        titulo:'Check',        desc:'Hecho / no hecho. No es una evaluación.',                  icono:'✓' },
  { id:'valor',        titulo:'Valor',        desc:'Texto, número o una opción de tu lista. No es una evaluación.', icono:'Aa' },
]
/* `columnas`: las demás columnas del grupo, para elegir prerrequisito.
   `soloExtras`: columna fija de la plantilla — no se renombra ni cambia de
   formato, pero sí se le puede poner requisito y decidir si cuenta para la garantía. */
function ColumnaModal({ titulo, inicial, onGuardar, onClose, columnas = [], soloExtras = false }) {
  const [f, setF] = useState(() => ({
    nombre: inicial?.name ?? '', tipo: inicial?.t ?? 'actividad', formato: inicial?.formato ?? 'calificacion',
    calMax: inicial?.calMax ?? 10, cuenta: inicial?.cuenta ?? true,
    opcionesTxt: (inicial?.opciones ?? []).join(', '), descripcion: inicial?.descripcion ?? '',
    requisitoId: inicial?.requisitoId ?? '', requisitoMin: inicial?.requisitoMin ?? '',
    cuentaGarantia: inicial?.cuentaGarantia ?? true,
    fechaEntrega: inicial?.fechaEntrega ?? '',
  }))
  const candidatos = columnas.filter(c => c.id !== inicial?.id)
  const reqElegido = candidatos.find(c => c.id === f.requisitoId)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [confirmar, setConfirmar] = useState(null)   // n valores que se borrarían
  const set = (k, v) => setF(prev => ({ ...prev, [k]: v }))
  const opciones = f.opcionesTxt.split(',').map(o => o.trim()).filter(Boolean)

  const guardar = async (limpiar = false) => {
    setError('')
    if (!soloExtras && !f.nombre.trim()) { setError('Escribe un nombre para la columna.'); return }
    if (f.requisitoMin !== '' && !(Number(f.requisitoMin) >= 0)) { setError('El mínimo del requisito debe ser un número.'); return }
    if (f.formato === 'calificacion' && !(Number(f.calMax) > 0)) { setError('La calificación máxima debe ser mayor que 0.'); return }
    setGuardando(true)
    const res = await onGuardar({
      nombre: f.nombre.trim(), tipo: f.tipo, formato: f.formato, calMax: Number(f.calMax) || 10,
      cuenta: f.formato === 'calificacion' ? f.cuenta : false,
      opciones: f.formato === 'valor' ? opciones : null, descripcion: f.descripcion.trim(), limpiar,
      requisitoId: f.requisitoId || null,
      requisitoMin: f.requisitoId && reqElegido?.formato === 'calificacion' && f.requisitoMin !== '' ? Number(f.requisitoMin) : null,
      cuentaGarantia: f.cuentaGarantia,
      fechaEntrega: f.fechaEntrega || null,
    })
    setGuardando(false)
    if (res?.conValores) { setConfirmar(res.conValores); return }
    if (!res?.ok) { setError(res?.message || 'No se pudo guardar.'); return }
  }

  if (confirmar) return (
    <ModalPortal maxWidth="max-w-sm" onClose={() => !guardando && setConfirmar(null)}>
      <div className="p-6 space-y-4 text-center">
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center mx-auto"
          style={{ background:'var(--warn-soft)', border:'1px solid var(--warn-line)' }}>
          <AlertTriangle size={20} style={{ color:'var(--warn)' }}/>
        </div>
        <h2 className="text-base font-bold" style={{ color:'var(--t1)' }}>¿Cambiar el formato de "{f.nombre}"?</h2>
        <p className="text-sm" style={{ color:'var(--t2)' }}>
          Esta columna ya tiene <b>{confirmar}</b> valor{confirmar !== 1 ? 'es' : ''} capturado{confirmar !== 1 ? 's' : ''}.
          En el formato nuevo no tienen sentido y <b>se borrarán</b>. Si eran calificaciones, el promedio se recalcula.
        </p>
        <div className="flex gap-3">
          <button type="button" onClick={() => setConfirmar(null)} disabled={guardando} className="btn-secondary flex-1 justify-center">Cancelar</button>
          <button type="button" onClick={() => guardar(true)} disabled={guardando} className="btn-danger flex-1 justify-center">
            {guardando ? 'Aplicando…' : 'Sí, cambiar y borrar'}
          </button>
        </div>
      </div>
    </ModalPortal>
  )

  return (
    <ModalPortal maxWidth="max-w-md" onClose={() => !guardando && onClose()}>
      <div className="flex items-center justify-between gap-3 px-5 py-3.5" style={{ borderBottom:'1px solid var(--divider)' }}>
        <h2 className="text-sm font-bold" style={{ color:'var(--t1)' }}>{titulo}</h2>
        <button type="button" onClick={onClose} aria-label="Cerrar" className="w-11 h-11 flex items-center justify-center rounded-lg" style={{ color:'var(--t3)' }}><X size={15}/></button>
      </div>
      <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
        {soloExtras && (
          <p className="text-xs rounded-lg px-3 py-2" style={{ background:'var(--soft-bg)', color:'var(--t3)', border:'1px solid var(--card-border)' }}>
            Columna fija de la hoja: su nombre y formato no cambian, pero puedes ponerle un requisito y decidir si cuenta para la garantía.
          </p>
        )}
        {!soloExtras && <>
        <label className="block">
          <span className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color:'var(--t3)' }}>Nombre</span>
          <input value={f.nombre} onChange={e => set('nombre', e.target.value)} placeholder="Ej: Tarea 4, Trajo material" maxLength={60}
            className="input-field w-full min-h-11" autoFocus/>
        </label>

        <div>
          <span className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color:'var(--t3)' }}>Tipo</span>
          <div className="flex flex-wrap gap-1.5">
            {TIPOS_COLUMNA.map(t => (
              <button key={t} type="button" onClick={() => set('tipo', t)} aria-pressed={f.tipo === t}
                className="min-h-9 px-3 rounded-full text-xs font-bold capitalize"
                style={f.tipo === t ? { background:'var(--accent)', color:'var(--accent-contrast)' } : { background:'var(--soft-bg)', color:'var(--t2)', border:'1px solid var(--card-border)' }}>
                {t}
              </button>
            ))}
          </div>
        </div>

        <label className="block">
          <span className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color:'var(--t3)' }}>Fecha de entrega (opcional)</span>
          <input type="date" value={f.fechaEntrega} onChange={e => set('fechaEntrega', e.target.value)} className="input-field w-full min-h-11"/>
          <span className="block text-[11px] mt-1" style={{ color:'var(--t3)' }}>
            Con fecha, a los alumnos que no la hayan entregado les llega un recordatorio por correo 2 días antes.
          </span>
        </label>

        <div>
          <span className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color:'var(--t3)' }}>¿Qué se captura?</span>
          <div className="grid gap-2">
            {FORMATOS.map(fm => {
              const activo = f.formato === fm.id
              return (
                <button key={fm.id} type="button" onClick={() => set('formato', fm.id)} aria-pressed={activo}
                  className="w-full flex items-center gap-3 p-3 rounded-xl text-left"
                  style={activo ? { background:'var(--card-bg)', border:'2px solid var(--accent)' } : { background:'var(--soft-bg)', border:'1px solid var(--card-border)' }}>
                  <span className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 text-sm font-bold"
                    style={activo ? { background:'var(--accent)', color:'var(--accent-contrast)' } : { background:'var(--card-bg)', color:'var(--t2)' }}>
                    {fm.icono}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold" style={{ color:'var(--t1)' }}>{fm.titulo}</span>
                    <span className="block text-[11px]" style={{ color:'var(--t3)' }}>{fm.desc}</span>
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {f.formato === 'calificacion' && (
          <div className="grid grid-cols-2 gap-3 items-end">
            <label className="block">
              <span className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color:'var(--t3)' }}>Calificación máxima</span>
              <input type="number" min="1" step="any" inputMode="decimal" value={f.calMax} onChange={e => set('calMax', e.target.value)}
                className="input-field w-full min-h-11 text-center font-bold"/>
            </label>
            <NeonCheckbox className="min-h-11" checked={f.cuenta} onChange={() => set('cuenta', !f.cuenta)}
              label={<span className="text-xs font-semibold">Cuenta para el promedio</span>}/>
          </div>
        )}
        {f.formato === 'calificacion' && !f.cuenta && (
          <p className="text-[11px]" style={{ color:'var(--t3)' }}>Se captura y se ve en la hoja, pero no afecta el promedio, el ranking ni lo que ve el alumno.</p>
        )}
        {f.formato === 'valor' && (
          <label className="block">
            <span className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color:'var(--t3)' }}>Opciones (opcional, separadas por coma)</span>
            <input value={f.opcionesTxt} onChange={e => set('opcionesTxt', e.target.value)} placeholder="Ej: Excelente, Bien, Regular"
              className="input-field w-full min-h-11"/>
            <span className="block text-[11px] mt-1" style={{ color:'var(--t3)' }}>
              {opciones.length ? `Se elegirá de una lista: ${opciones.join(' · ')}` : 'Sin opciones: se escribe texto libre en cada celda.'}
            </span>
          </label>
        )}

        <label className="block">
          <span className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color:'var(--t3)' }}>Descripción (opcional)</span>
          <textarea value={f.descripcion} onChange={e => set('descripcion', e.target.value)} rows={2} maxLength={200}
            placeholder="Qué se evalúa o cuándo se marca" className="input-field w-full"/>
        </label>
        </>}

        {/* ── Depende de… ── Ej.: el examen solo cuenta si antes se entregó la guía. */}
        <div className="rounded-xl p-3 space-y-2" style={{ background:'var(--soft-bg)', border:'1px solid var(--card-border)' }}>
          <span className="block text-[10px] font-bold uppercase tracking-widest" style={{ color:'var(--t3)' }}>Prerrequisito (opcional)</span>
          <select value={f.requisitoId} onChange={e => set('requisitoId', e.target.value)} aria-label="Prerrequisito"
            className="input-field w-full min-h-11">
            <option value="">Ninguno: cuenta siempre</option>
            {[...new Set(candidatos.map(c => c.materia))].map(m => (
              <optgroup key={m} label={m}>
                {candidatos.filter(c => c.materia === m).map(c => (
                  <option key={c.id} value={c.id}>{c.name}{c.formato === 'check' ? ' (✓)' : c.formato === 'valor' ? ' (valor)' : ''}</option>
                ))}
              </optgroup>
            ))}
          </select>
          {reqElegido?.formato === 'calificacion' && (
            <label className="flex items-center gap-2 text-xs" style={{ color:'var(--t2)' }}>
              Mínimo en "{reqElegido.name}" para cumplirlo
              <input type="number" min="0" step="any" value={f.requisitoMin} onChange={e => set('requisitoMin', e.target.value)}
                placeholder="cualquiera" className="input-field !w-24 min-h-9 text-center"/>
            </label>
          )}
          <p className="text-[11px]" style={{ color:'var(--t3)' }}>
            {reqElegido
              ? `Si "${reqElegido.name}" no está ${reqElegido.formato === 'check' ? 'marcada' : 'capturada'}, esta celda se puede llenar pero NO cuenta para el promedio y la hoja la marca "Falta …".`
              : 'Ejemplo: el examen solo cuenta si antes se entregó la guía de estudio.'}
          </p>
        </div>

        <NeonCheckbox checked={f.cuentaGarantia} onChange={() => set('cuentaGarantia', !f.cuentaGarantia)}
          label={<span className="text-xs font-semibold">Cuenta para la garantía</span>}/>
        <p className="text-[11px] -mt-2" style={{ color:'var(--t3)' }}>
          {f.cuentaGarantia
            ? 'Si es tarea o simulacro, el alumno debe cumplirla para conservar la garantía.'
            : 'No afecta la garantía del alumno (por ejemplo, una tarea extra).'}
        </p>

        {error && <p role="alert" className="text-xs font-semibold" style={{ color:'var(--bad)' }}>{error}</p>}
        <div className="flex gap-3">
          <button type="button" onClick={onClose} disabled={guardando} className="btn-secondary flex-1 min-h-11 justify-center">Cancelar</button>
          <button type="button" onClick={() => guardar(false)} disabled={guardando} className="btn-primary flex-1 min-h-11 justify-center">
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </ModalPortal>
  )
}

/* Una materia solo existe en la BD a través de sus columnas: por eso se crea
   junto con su primera actividad. Antes vivía solo en la pantalla hasta que se
   le añadía una columna, y si se recargaba antes se perdía — y nunca llegaba a
   Materiales ni a ninguna otra parte. */
function AddSubjectModal({ onAdd, onClose }) {
  const [name,setName]=useState('')
  const [primera,setPrimera]=useState('Tarea 1')
  const [guardando,setGuardando]=useState(false)
  const [error,setError]=useState('')
  // Literales a propósito: se guardan en subj.color. Tonos mate, no neón.
  const COLORS=['#2B5F9E','#5D3E90','#2F6B41','#8A5A12','#A03A32','#90501C','#94356B','#1C6474']
  const [color,setColor]=useState(COLORS[0])
  const listo = name.trim() && primera.trim() && !guardando
  const crear = async () => {
    if (!listo) return
    setGuardando(true); setError('')
    const res = await onAdd(name.trim(), color, primera.trim())
    setGuardando(false)
    if (!res?.ok) setError(res?.message || 'No se pudo crear la sección.')
  }
  return (
    <ModalPortal maxWidth="max-w-sm" onClose={() => !guardando && onClose()}>
      <div className="p-5 space-y-4">
        <h2 className="text-sm font-bold" style={{ color: 'var(--t1)' }}>Nueva sección</h2>
        <label className="block">
          <span className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color:'var(--t3)' }}>Nombre de la sección</span>
          <input value={name} onChange={e=>setName(e.target.value)} placeholder="Ej. Matemáticas"
            className="input-field w-full min-h-11" onKeyDown={e=>e.key==='Enter'&&crear()} autoFocus/>
        </label>
        <label className="block">
          <span className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color:'var(--t3)' }}>Primera actividad</span>
          <input value={primera} onChange={e=>setPrimera(e.target.value)} placeholder="Ej. Tarea 1"
            className="input-field w-full min-h-11" onKeyDown={e=>e.key==='Enter'&&crear()}/>
          <span className="block text-[11px] mt-1" style={{ color:'var(--t3)' }}>Se guarda en ese momento. Después puedes añadir más columnas o configurarla con el lápiz.</span>
        </label>
        <div className="flex gap-2 flex-wrap">
          {COLORS.map(c=>(
            <button key={c} onClick={()=>setColor(c)} aria-label={`Elegir color ${c}`} className="w-11 h-11 rounded-full transition-all active:scale-90"
              style={{ background:c, outline:color===c?'3px solid var(--accent)':'none', outlineOffset:2 }}/>
          ))}
        </div>
        {error && <p role="alert" className="text-xs font-semibold" style={{ color:'var(--bad)' }}>{error}</p>}
        <div className="flex gap-3">
          <button onClick={onClose} disabled={guardando} className="btn-secondary flex-1 min-h-11 justify-center">Cancelar</button>
          <button onClick={crear} disabled={!listo}
            className="btn-primary flex-1 min-h-11 justify-center">{guardando ? 'Guardando…' : 'Añadir'}</button>
        </div>
      </div>
    </ModalPortal>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// HEADER DE SECCIÓN (collapse/expand con +/-)
// ─────────────────────────────────────────────────────────────────────────────

/* `arrastre` (solo materias): { id, activo, onDown, onKey } — asa para mover la
   materia a izquierda o derecha. */
function SectionHeader({ label, cols, color, collapsed, onToggle, onAdd, onRemoveItem, onRename, nota, arrastre, tituloAdd = 'Añadir' }) {
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
    <th colSpan={cols} data-bloque-slot={arrastre?.id} style={{
      ...(arrastre?.activo ? { outline:'2px dashed #ffffff', outlineOffset:'-3px', opacity:.85 } : null),
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
        {arrastre && (
          <button type="button" data-sin-zoom onPointerDown={arrastre.onDown} onKeyDown={arrastre.onKey}
            title="Arrastra para mover este bloque" aria-label={`Mover ${label} (flechas izquierda y derecha)`}
            className="w-5 h-5 rounded flex items-center justify-center hover:bg-white/20"
            style={{ cursor: arrastre.activo ? 'grabbing' : 'grab', touchAction:'none', color: color ? '#ffffff' : 'var(--t2)' }}>
            <GripVertical size={12}/>
          </button>
        )}
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
            className={`${tituloAdd === 'Añadir' ? 'w-4' : 'px-1.5 gap-0.5'} h-4 rounded flex items-center justify-center hover:bg-white/20 transition-colors active:scale-90`}
            title={tituloAdd} aria-label={tituloAdd}>
            <Plus size={9}/>{tituloAdd !== 'Añadir' && <span style={{ fontSize:9, letterSpacing:0 }}>{tituloAdd}</span>}
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
/* `arrastre` (columnas de materia): { id, materia, activo, onDown, onKey } —
   asa para mover la columna dentro de su materia. */
function EditableColumnHeader({ value, onChange, onRemove, light, minWidth = 52, rowSpan, style: extraStyle, locked, arrastre, onConfigurar, formato, cuenta, requisito, garantia = true, bloque }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const inputRef = useRef(null)
  const textColor = light ? '#0f172a' : '#ffffff'
  const slot = arrastre ? { 'data-col-slot': arrastre.id, 'data-col-materia': arrastre.materia } : {}
  const resalte = arrastre?.activo ? { outline:'2px dashed var(--accent)', outlineOffset:'-3px' } : null
  const asa = arrastre && (
    <button type="button" data-sin-zoom onPointerDown={arrastre.onDown} onKeyDown={arrastre.onKey}
      title="Arrastra para mover esta columna" aria-label={`Mover la columna ${value} (flechas izquierda y derecha)`}
      className="shrink-0 rounded flex items-center justify-center hover:opacity-70"
      style={{ color:textColor, width:18, height:22, cursor: arrastre.activo ? 'grabbing' : 'grab', touchAction:'none' }}>
      <GripVertical size={11}/>
    </button>
  )

  useEffect(() => { if (!editing) setDraft(value) }, [value, editing])

  /* `bloque`: asa para mover un bloque fijo entero (Pago, Garantía, Área…). */
  const slotBloque = bloque ? { 'data-bloque-slot': bloque.id } : {}
  const resalteBloque = bloque?.activo ? { outline:'2px dashed var(--accent)', outlineOffset:'-3px', opacity:.85 } : null
  const asaBloque = bloque && (
    <button type="button" data-sin-zoom onPointerDown={bloque.onDown} onKeyDown={bloque.onKey}
      title="Arrastra para mover este bloque" aria-label={`Mover ${value} (flechas izquierda y derecha)`}
      className="shrink-0 rounded flex items-center justify-center hover:opacity-70"
      style={{ color:textColor, width:18, height:22, cursor: bloque.activo ? 'grabbing' : 'grab', touchAction:'none' }}>
      <GripVertical size={11}/>
    </button>
  )
  const extras = [requisito && `requiere ${requisito}`, garantia === false && 'sin garantía'].filter(Boolean)

  if (locked) return (
    <th rowSpan={rowSpan} title="Columna fija de la hoja" {...slot} {...slotBloque}
      style={{ minWidth, padding:'4px 2px', textAlign:'center', fontSize:9,
        fontWeight:700, color:textColor, borderRight:'1px solid var(--divider)', ...extraStyle, ...resalte, ...resalteBloque }}>
      <span className="flex items-center justify-center gap-0.5">
        {asaBloque}{asa}
        <span className="min-w-0 flex flex-col items-center leading-tight">
          <span className="truncate max-w-full">{value}</span>
          {extras.map(x => <span key={x} className="text-[8px] font-bold uppercase opacity-75 whitespace-nowrap">{x}</span>)}
        </span>
        {onConfigurar && (
          <button type="button" onClick={onConfigurar} title={`Requisito y garantía de ${value}`}
            aria-label={`Configurar requisito y garantía de ${value}`}
            className="shrink-0 rounded flex items-center justify-center hover:opacity-70" style={{ color:textColor, width:22, height:22 }}>
            <SlidersHorizontal size={10}/>
          </button>
        )}
      </span>
    </th>
  )

  const marca = formato === 'check' ? '✓ check' : formato === 'valor' ? 'Aa valor' : cuenta === false ? 'no cuenta' : null
  const startEditing = () => {
    if (onConfigurar) { onConfigurar(); return }
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
    <th rowSpan={rowSpan} {...slot} style={{ minWidth, padding:'4px 2px', textAlign:'center', fontSize:9,
      fontWeight:700, color:textColor, borderRight:'1px solid var(--divider)', ...extraStyle, ...resalte }}>
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
          {asa}
          <span className="min-w-0 flex flex-col items-center leading-tight">
            <span className="truncate max-w-full" title={value}>{value}</span>
            {marca && <span className="text-[8px] font-bold uppercase opacity-75 whitespace-nowrap">{marca}</span>}
            {extras.map(x => <span key={x} className="text-[8px] font-bold uppercase opacity-75 whitespace-nowrap">{x}</span>)}
          </span>
          <button type="button" onClick={startEditing} title={onConfigurar ? `Configurar ${value}` : `Editar ${value}`}
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
  const [configCol,     setConfigCol]     = useState(null)   // { subjId, col } columna en configuración
  // Borrar una columna o una sección entera se lleva sus calificaciones: siempre con confirmación.
  const [borrarPend,    setBorrarPend]    = useState(null)   // { tipo, subjId, colId?, nombre, valores }
  // Orden de TODOS los bloques de la hoja (también Pago, Garantía, Área…), por grupo.
  const [ordenGuardado, setOrdenGuardado] = useState(null)
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
      const [cols, celdas, asis, docs, pagosAlumnos, orden] = await Promise.all([
        fetchColumnasRegistro(group.id),
        fetchCeldasRegistro(group.id),
        fetchAsistenciaRegistro(group.id),
        fetchDocumentosAlumnos(groupStudents.map(s=>s.id)),
        // El cobro de los exámenes adicionales se refleja solo en la hoja: no
        // hay que marcarlo dos veces, en Pagos y aquí.
        fetchPagosDeAlumnos(groupStudents.map(s=>s.id)).catch(() => []),
        fetchOrdenBloques(group.id).catch(() => null),
      ])
      setOrdenGuardado(orden)

      // Las columnas llegan planas; la hoja las dibuja agrupadas por materia.
      const porMateria = new Map()
      for (const c of cols) {
        if (!porMateria.has(c.materia)) {
          porMateria.set(c.materia, {
            id: c.materia, name: c.materia,
            color: c.materiaColor || 'var(--info)', cols: [],
          })
        }
        porMateria.get(c.materia).cols.push({ id: c.id, name: c.nombre, t: c.tipo, calMax: c.calMax, esFija:c.esFija,
          formato: c.formato, cuenta: c.cuenta, opciones: c.opciones, descripcion: c.descripcion,
          materia: c.materia, requisitoId: c.requisitoId, requisitoMin: c.requisitoMin, cuentaGarantia: c.cuentaGarantia,
          fechaEntrega: c.fechaEntrega })
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
      } catch (err) {
        const m = err?.message ?? ''
        setErrorHoja(m.includes('fuera_de_rango') ? 'Esa calificación pasa del máximo de la columna. Corrígela.'
          : m.includes('valor_no_permitido') ? 'Ese valor no está en las opciones de la columna.'
          : m.includes('invalid_grade') ? 'Escribe un número (o NP) en las columnas de calificación.'
          : 'No se pudo guardar una calificación. Vuelve a escribirla.')
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

  /* ── Reordenar materias y columnas arrastrando ──
     Igual que las tarjetas KPI: eventos de puntero (ratón y dedo), la
     cabecera se mueve en vivo sobre la que tiene debajo y al soltar se guarda
     en la BD (reordenar_registro), así el orden es el mismo para todo el que
     abra la hoja. Si se arrastra cerca del borde, la hoja se desplaza sola. */
  const [arrastre, setArrastre] = useState(null)   // { tipo:'materia'|'col', id, materia }
  const [errorOrden, setErrorOrden] = useState(null)
  const subjectsRef = useRef(subjects)
  useEffect(() => { subjectsRef.current = subjects }, [subjects])

  /* ── Columnas por id, lista para elegir requisito y reglas de la garantía ── */
  const colsPorId = useMemo(() => Object.fromEntries(
    subjects.flatMap(sj => sj.cols.map(c => [c.id, { ...c, materia: sj.id }]))), [subjects])
  const todasLasColumnas = useMemo(() => subjects.flatMap(sj =>
    sj.cols.map(c => ({ id: c.id, name: c.name, materia: sj.name, formato: c.formato }))), [subjects])
  const reglasGarantia = useMemo(() => {
    // Solo las actividades ya aplicadas (alguien tiene valor) pueden quitar la garantía.
    const aplicada = clave => Object.values(cells).some(sc => {
      const v = sc?.[clave]; return v !== undefined && v !== null && String(v).trim() !== ''
    })
    const r = { tareas: [], simulacros: [] }
    for (const sj of subjects) for (const c of sj.cols) {
      if (c.cuentaGarantia === false) continue
      const clave = `${sj.id}_${c.id}`
      if (!aplicada(clave)) continue
      if (c.t === 'tarea') r.tareas.push({ clave, name: c.name, calMax: c.calMax, check: c.formato === 'check' })
      else if (c.t === 'simulacro') r.simulacros.push({ clave, name: c.name })
    }
    return r
  }, [subjects, cells])

  /* ── Orden de bloques ──
     Tokens: 'pago','garantia','area','asistencia','docs' y 'm:<materia>'. Por
     defecto Asistencia va justo después de Área. Los bloques nuevos (una
     materia recién creada) se añaden al final; un fijo que falte, en su sitio. */
  const ordenBloques = useMemo(() => {
    const porDefecto = ['pago', 'garantia', 'area', 'asistencia', 'docs', ...subjects.map(sj => `m:${sj.id}`)]
    if (!ordenGuardado?.length) return porDefecto
    const existe = new Set(porDefecto)
    const base = ordenGuardado.filter(t => existe.has(t))
    for (const t of porDefecto.filter(x => !base.includes(x))) {
      if (t.startsWith('m:')) { base.push(t); continue }
      const i = porDefecto.indexOf(t)
      const antes = porDefecto.slice(0, i).reverse().find(x => base.includes(x))
      base.splice(antes ? base.indexOf(antes) + 1 : 0, 0, t)
    }
    return base
  }, [subjects, ordenGuardado])
  const ordenRef = useRef(ordenBloques)
  useEffect(() => { ordenRef.current = ordenBloques }, [ordenBloques])

  const moverToken = (lista, id, destino) => {
    if (!destino || destino === id) return lista
    const desde = lista.indexOf(id), hacia = lista.indexOf(destino)
    if (desde < 0 || hacia < 0) return lista
    const copia = lista.filter(x => x !== id)
    copia.splice(copia.indexOf(destino) + (desde < hacia ? 1 : 0), 0, id)
    return copia
  }
  const moverBloque = (id, destino) => {
    const next = moverToken(ordenRef.current, id, destino)
    if (next === ordenRef.current) return
    ordenRef.current = next
    setOrdenGuardado(next)
  }
  const guardarOrdenBloquesYMaterias = async () => {
    setErrorOrden(null)
    const tokens = ordenRef.current
    // Las materias también quedan en ese orden en la BD (lo usa el portal del alumno).
    const posicion = Object.fromEntries(tokens.map((t, i) => [t, i]))
    const materias = [...subjectsRef.current].sort((a, b) => (posicion[`m:${a.id}`] ?? 999) - (posicion[`m:${b.id}`] ?? 999))
    aplicarOrden(materias)
    try {
      await guardarOrdenBloques(group.id, tokens)
      await reordenarRegistro(group.id, materias.map(sj => ({ materia: sj.id, columnas: sj.cols.map(c => c.id) })))
    } catch {
      setErrorOrden('No se pudo guardar el nuevo orden. Se restauró el anterior.')
      cargarHoja()
    }
  }

  const moverEn = (lista, id, destino) => {
    if (!destino || destino === id) return lista
    const desde = lista.findIndex(x => x.id === id)
    const hacia = lista.findIndex(x => x.id === destino)
    if (desde < 0 || hacia < 0) return lista
    const copia = lista.filter(x => x.id !== id)
    copia.splice(copia.findIndex(x => x.id === destino) + (desde < hacia ? 1 : 0), 0, lista[desde])
    return copia
  }
  const aplicarOrden = next => { subjectsRef.current = next; setSubjects(next) }
  const moverColumna = (materia, id, destino) => aplicarOrden(subjectsRef.current.map(sj =>
    sj.id === materia ? { ...sj, cols: moverEn(sj.cols, id, destino) } : sj))

  const guardarOrden = async () => {
    setErrorOrden(null)
    try {
      await reordenarRegistro(group.id, subjectsRef.current.map(sj => ({ materia: sj.id, columnas: sj.cols.map(c => c.id) })))
    } catch {
      setErrorOrden('No se pudo guardar el nuevo orden. Se restauró el anterior.')
      cargarHoja()
    }
  }

  const empezarArrastre = (tipo, id, materia, e) => {
    e.preventDefault(); e.stopPropagation()
    setArrastre({ tipo, id, materia })
    const contenedor = e.currentTarget.closest('[data-wide-sheet]')?.parentElement
    const foto = () => JSON.stringify([ordenRef.current, subjectsRef.current.map(sj => [sj.id, sj.cols.map(c => c.id)])])
    const inicial = foto()
    const mover = ev => {
      if (contenedor) {
        const r = contenedor.getBoundingClientRect()
        if (ev.clientX < r.left + 56) contenedor.scrollLeft -= 16
        else if (ev.clientX > r.right - 56) contenedor.scrollLeft += 16
      }
      const el = document.elementFromPoint(ev.clientX, ev.clientY)
      if (tipo === 'bloque') {
        moverBloque(id, el?.closest('[data-bloque-slot]')?.dataset.bloqueSlot)
      } else {
        const th = el?.closest('[data-col-slot]')
        if (th && th.dataset.colMateria === materia) moverColumna(materia, id, th.dataset.colSlot)
      }
    }
    const soltar = () => {
      setArrastre(null)
      window.removeEventListener('pointermove', mover)
      window.removeEventListener('pointerup', soltar)
      window.removeEventListener('pointercancel', soltar)
      if (foto() !== inicial) {   // un clic sin mover no escribe nada
        if (tipo === 'bloque') guardarOrdenBloquesYMaterias(); else guardarOrden()
      }
    }
    window.addEventListener('pointermove', mover)
    window.addEventListener('pointerup', soltar)
    window.addEventListener('pointercancel', soltar)
  }

  // Teclado: con el asa enfocada, ← y → la mueven un lugar y se guarda.
  const moverConTeclado = (tipo, id, materia, e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    const paso = e.key === 'ArrowLeft' ? -1 : 1
    if (tipo === 'bloque') {
      const lista = ordenRef.current
      const vecino = lista[lista.indexOf(id) + paso]
      if (!vecino) return
      moverBloque(id, vecino)
      guardarOrdenBloquesYMaterias()
      return
    }
    const lista = subjectsRef.current.find(sj => sj.id === materia)?.cols ?? []
    const i = lista.findIndex(x => x.id === id)
    const vecino = lista[i + paso]
    if (!vecino) return
    moverColumna(materia, id, vecino.id)
    guardarOrden()
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


  /* La materia se guarda YA, junto con su primera actividad: así existe para
     todas las pantallas (Materiales, Exámenes, portal del alumno…). */
  const addSubject = async (name, color, primera) => {
    if (subjects.some(s => s.name.toLowerCase() === name.toLowerCase()))
      return { ok: false, message: 'Ya existe una sección con ese nombre en este grupo.' }
    try {
      await crearColumnaRegistro({ groupId: group.id, materia: name, nombre: primera, tipo: 'tarea', calMax: 10, color })
      setAddSubjModal(false)
      await cargarHoja()
      onDataChange?.()
      return { ok: true }
    } catch { return { ok: false, message: 'No se pudo guardar la sección. Revisa tu conexión.' } }
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

  // Crear: primero la columna y, si no es la configuración por defecto, se
  // configura en el acto. Devuelve { ok, message } a la ventana.
  const addCol = async (subjId, cfg) => {
    const materia = subjects.find(s => s.id === subjId)
    if (!materia) return { ok: false, message: 'Materia no encontrada.' }
    if (materia.cols.some(c => c.name.toLowerCase() === cfg.nombre.toLowerCase()))
      return { ok: false, message: 'Ya hay otra columna con ese nombre en esta materia.' }
    try {
      const nueva = await crearColumnaRegistro({
        groupId: group.id, materia: materia.name, nombre: cfg.nombre,
        tipo: cfg.tipo, calMax: cfg.calMax, color: materia.color,
      })
      const porDefecto = cfg.formato === 'calificacion' && cfg.cuenta && !cfg.descripcion
      if (!porDefecto && nueva?.id) {
        const res = await configurarColumnaRegistro({ id: nueva.id, ...cfg })
        if (!res.ok) return res
      }
      if (nueva?.id && (cfg.requisitoId || cfg.cuentaGarantia === false)) {
        const res = await configurarRequisitoColumna({ id: nueva.id, ...cfg })
        if (!res.ok) return res
      }
      if (nueva?.id && cfg.fechaEntrega) {
        const res = await setFechaEntrega(nueva.id, cfg.fechaEntrega)
        if (!res.ok) return res
      }
      setAddColModal(null)
      await cargarHoja()
      if (nueva?.id) ofrecerAviso({ id: nueva.id, nombre: cfg.nombre, materia: materia.name, tipo: cfg.tipo, descripcion: cfg.descripcion })
      return { ok: true }
    } catch { return { ok: false, message: 'No se pudo crear la columna.' } }
  }

  const guardarConfigColumna = async cfg => {
    const col = configCol.col
    if (!col.esFija) {
      const res = await configurarColumnaRegistro({ id: col.id, ...cfg })
      if (!res.ok) return res
    }
    const cambiaExtras = (cfg.requisitoId ?? null) !== (col.requisitoId ?? null)
      || (cfg.requisitoMin ?? null) !== (col.requisitoMin ?? null) || cfg.cuentaGarantia !== col.cuentaGarantia
    if (cambiaExtras) {
      const res = await configurarRequisitoColumna({ id: col.id, ...cfg })
      if (!res.ok) return res
    }
    if ((cfg.fechaEntrega ?? null) !== (col.fechaEntrega ?? null)) {
      const res = await setFechaEntrega(col.id, cfg.fechaEntrega)
      if (!res.ok) return res
    }
    setConfigCol(null); await cargarHoja(); onDataChange?.()
    return { ok: true }
  }

  /* Bloque de examen: Guía de estudio → Examen → Análisis, ya encadenados. */
  const nuevoExamen = async () => {
    try {
      const n = await agregarBloqueExamen(group.id); await cargarHoja(); onDataChange?.()
      const { data: col } = await supabase.from('registro_columnas').select('id')
        .eq('group_id', group.id).eq('materia', 'Exámenes').eq('nombre', `Examen ${n}`).maybeSingle()
      if (col) ofrecerAviso({ id: col.id, nombre: `Examen ${n}`, materia: 'Exámenes', tipo: 'examen',
        descripcion: `Recuerda entregar la Guía de estudio ${n}: es requisito para que cuente el examen.` })
    }
    catch { setErrorHoja('No se pudo añadir el examen.') }
  }

  /* Popup "¿Avisar por correo?" al crear una actividad o un examen (solo quien
     tiene el apartado de correos y si el grupo tiene alumnos). */
  const { puedeVer, puedeDarAltas } = useAuth()
  const [aviso, setAviso] = useState(null)
  const ofrecerAviso = col => {
    if (!puedeVer('correos') || !groupStudents.length) return
    setAviso({ ...col, ...plantillaActividad({ ...col, grupo: group.name }) })
  }
  const avisoEl = aviso && (
    <AvisoCorreoModal titulo="¿Avisar a los alumnos por correo?"
      contexto={`${aviso.nombre} · ${aviso.materia} · ${group.name}`} alumnos={groupStudents}
      asuntoInicial={aviso.asunto} mensajeInicial={aviso.mensaje}
      tipo="actividad" refId={aviso.id} groupId={group.id} onClose={() => setAviso(null)}/>
  )

  /* Cuántas celdas con valor se perderían (para decirlo en la confirmación). */
  const contarValores = claves => students.reduce((n, s) => n + claves.filter(k => {
    const v = cells[s.id]?.[k]; return v !== undefined && v !== null && v !== ''
  }).length, 0)
  const pedirBorrarColumna = (subjId, col) => setBorrarPend({
    tipo: 'columna', subjId, colId: col.id, nombre: col.name, valores: contarValores([`${subjId}_${col.id}`]),
  })
  const pedirBorrarSeccion = subjId => {
    const materia = subjects.find(s => s.id === subjId)
    if (!materia) return
    setBorrarPend({ tipo: 'seccion', subjId, nombre: materia.name, columnas: materia.cols.length,
      valores: contarValores(materia.cols.map(c => `${subjId}_${c.id}`)) })
  }
  const confirmarBorrado = async () => {
    const p = borrarPend
    if (p.tipo === 'columna') await removeCol(p.subjId, p.colId)
    else await removeSubject(p.subjId)
  }
  const dialogoBorrado = borrarPend && (
    <ConfirmDialog
      title={borrarPend.tipo === 'columna' ? `¿Eliminar la columna "${borrarPend.nombre}"?` : `¿Eliminar la sección "${borrarPend.nombre}"?`}
      message={borrarPend.tipo === 'columna'
        ? `Se borra la columna y ${borrarPend.valores} calificación(es) capturada(s) en ella.`
        : `Se borran sus ${borrarPend.columnas} columna(s) y ${borrarPend.valores} calificación(es) capturada(s).`}
      detail="Los promedios del grupo se recalculan. Esta acción no se puede deshacer."
      onConfirm={confirmarBorrado}
      onClose={() => setBorrarPend(null)}/>
  )

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
      {puedeDarAltas && (
        <button onClick={() => setShowAddStudent(true)} className="btn-secondary text-xs py-2 gap-1.5">
          <UserPlus size={13}/> Alumno
        </button>
      )}
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

  /* ── Render por bloque ── */
  const bloqueVisible = t =>
    t === 'pago' || t === 'garantia' ? showSummary
    : t === 'area' ? showSummary && esUniversidad
    : t === 'asistencia' ? showAttendance
    : t === 'docs' ? showDocs
    : t.startsWith('m:') ? showSubject(t.slice(2)) && subjects.some(sj => sj.id === t.slice(2))
    : false
  const bloquesVisibles = ordenBloques.filter(bloqueVisible)
  const asaBloque = t => ({ id: t, activo: arrastre?.tipo === 'bloque' && arrastre.id === t,
    onDown: e => empezarArrastre('bloque', t, null, e), onKey: e => moverConTeclado('bloque', t, null, e) })
  const subjDe = t => subjects.find(sj => sj.id === t.slice(2))
  const estiloFijo = color => ({ background: hcMode ? 'var(--soft-bg)' : solidBg, borderBottom: `3px solid ${color}` })

  const cabecera1 = t => {
    if (t === 'pago') return <EditableColumnHeader key={t} locked rowSpan={2} minWidth={W.pago} light={hcMode}
      value="PAGO" bloque={asaBloque(t)} style={estiloFijo(HC.pago)}/>
    if (t === 'garantia') return <EditableColumnHeader key={t} locked rowSpan={2} minWidth={W.gar} light={hcMode}
      value="GARANTÍA" bloque={asaBloque(t)} style={estiloFijo(HC.gar)}/>
    if (t === 'area') return <EditableColumnHeader key={t} locked rowSpan={2} minWidth={W.area} light={hcMode}
      value="ÁREA" bloque={asaBloque(t)} style={estiloFijo(HC.area)}/>
    if (t === 'asistencia') return <SectionHeader key={t} label="ASISTENCIAS" color="var(--good)"
      cols={1} collapsed={false} onToggle={() => {}} arrastre={asaBloque(t)}/>
    if (t === 'docs') return <SectionHeader key={t} label="DOCUMENTOS" cols={collapsed['docs'] ? 1 : 5}
      collapsed={!!collapsed['docs']} onToggle={() => toggleSection('docs')} arrastre={asaBloque(t)}/>
    const subj = subjDe(t)
    if (!subj) return null
    const fija = esSeccionFija(subj)
    const esExamen = subj.id === 'Exámenes'
    return (
      <SectionHeader key={t}
        label={fija ? subj.name.toUpperCase() : headerName(`section:${subj.id}`, subj.name.toUpperCase())}
        color={subj.color}
        onRename={fija ? undefined : v => renameHeader(`section:${subj.id}`, v)}
        cols={collapsed[subj.id] ? 1 : subj.cols.length + 1}
        collapsed={!!collapsed[subj.id]}
        onToggle={() => toggleSection(subj.id)}
        onAdd={esExamen ? nuevoExamen : () => setAddColModal(subj.id)}
        tituloAdd={esExamen ? 'Añadir examen' : 'Añadir'}
        onRemoveItem={fija ? undefined : () => pedirBorrarSeccion(subj.id)}
        arrastre={asaBloque(t)}/>
    )
  }

  const cabecera2 = t => {
    if (t === 'pago' || t === 'garantia' || t === 'area') return null
    if (t === 'asistencia') return <EditableColumnHeader key={t} locked minWidth={88} light={hcMode} value="% ASIST."/>
    if (t === 'docs') return collapsed['docs']
      ? <th key={t} style={{ minWidth:52, fontSize:10, color: hcMode ? HC.docs : 'var(--t4)', textAlign:'center', borderRight: hcMode ? `2px solid ${HC.docs}` : '1px solid rgba(255,255,255,.06)' }}>···</th>
      : <Fragment key={t}>{[
          ['doc_curp','CURP'], ['doc_ine','INE tutor'], ['doc_terms','Firma T&C'], ['doc_guarantee','Garantía'], ['doc_exams','Exámenes'],
        ].map(([key, fallback]) => (
          <EditableColumnHeader locked key={key} minWidth={68} light={hcMode} value={fallback}
            style={{ background:hcMode?'var(--soft-bg)':`${HC.docs}0a`, borderBottom:`${hcMode?2:1}px solid ${HC.docs}${hcMode?'80':'60'}` }}/>
        ))}</Fragment>
    const subj = subjDe(t)
    if (!subj) return null
    if (collapsed[subj.id]) return <th key={t} style={{ minWidth:52, fontSize:10, color: 'var(--t4)', textAlign:'center', borderRight: '1px solid var(--divider)' }}>···</th>
    return (
      <Fragment key={t}>
        {subj.cols.map(col => (
          <EditableColumnHeader key={`${subj.id}_${col.id}`} minWidth={76} light={hcMode}
            locked={col.esFija}
            value={col.name}
            onChange={v => renameHeader(`col:${col.id}`, v)}
            onConfigurar={() => setConfigCol({ subjId: subj.id, col })}
            formato={col.formato} cuenta={col.cuenta}
            requisito={colsPorId[col.requisitoId]?.name} garantia={col.cuentaGarantia}
            onRemove={col.esFija ? undefined : () => pedirBorrarColumna(subj.id, col)}
            arrastre={{ id: col.id, materia: subj.id, activo: arrastre?.tipo === 'col' && arrastre.id === col.id,
              onDown: e => empezarArrastre('col', col.id, subj.id, e),
              onKey: e => moverConTeclado('col', col.id, subj.id, e) }}/>
        ))}
        <th style={{ minWidth:26, borderRight: '1px solid var(--divider)' }}>
          <button onClick={() => setAddColModal(subj.id)} className="mx-auto flex items-center justify-center w-4 h-4 rounded hover:bg-white/15" title="Añadir columna">
            <Plus size={9} style={{ color: 'var(--t3)' }}/>
          </button>
        </th>
      </Fragment>
    )
  }

  const celdasBloque = (t, s, sc, rowBg) => {
    if (t === 'pago') return <PaymentCell key={t} value={s.pago} onChange={v => setPago(s.id, v)}
      tdStyle={{ minWidth:W.pago, background: hcMode ? 'var(--card-bg)' : rowBg, border: hcMode ? '1px solid var(--divider)' : `1px solid ${HC.pago}40`, boxShadow: !hcMode ? `0 0 6px ${HC.pago}25` : 'none', verticalAlign:'middle' }}/>
    if (t === 'garantia') return <GuaranteeBadge key={t} studentId={s.id} cells={sc} attendance={attendance}
      reglas={reglasGarantia} bg={rowBg}/>
    if (t === 'area') return <AreaCell key={t} value={s.area} onChange={v => setArea(s.id, v)} bg={rowBg} sc={HC.area}/>
    if (t === 'asistencia') return <AttSummaryCell key={t} studentId={s.id} attendance={attendance} onClick={() => setAttModal(s.id)}/>
    if (t === 'docs') return collapsed['docs']
      ? <td key={t} style={{ minWidth:52, background: hcMode ? 'var(--card-bg)' : rowBg }}/>
      : <Fragment key={t}>
          <AutoStatusCell value={s.curpEstado} bg={rowBg}/>
          <AutoStatusCell value={s.ineEstado} bg={rowBg}/>
          <AutoStatusCell value={s.firmaTyC?'firmado':'pendiente'} bg={rowBg}/>
          <AutoStatusCell value={s.garantiaEstado} bg={rowBg}/>
          <AutoStatusCell value={s.examenesEstado} bg={rowBg}/>
        </Fragment>
    const subj = subjDe(t)
    if (!subj) return null
    if (collapsed[subj.id]) return <td key={t} style={{ minWidth:52, background: hcMode ? 'var(--card-bg)' : rowBg }}/>
    return (
      <Fragment key={t}>
        {subj.cols.map(col => {
          const clave = `${subj.id}_${col.id}`
          const aviso = avisoRequisito(col, sc, colsPorId)
          if (col.formato === 'check') return (
            <CheckCell key={clave} checked={sc[clave] === 1 || sc[clave] === '1'}
              onChange={v => setCell(s.id, clave, v ? '1' : '0')} sc={subj.color} aviso={aviso}/>
          )
          if (col.formato === 'valor') return (
            <ValorCell key={clave} value={sc[clave]} opciones={col.opciones}
              onChange={v => setCell(s.id, clave, v)} sc={subj.color} aviso={aviso}/>
          )
          return (
            <ScoreCell key={clave} value={sc[clave]} onChange={v => setCell(s.id, clave, v)} sc={subj.color}
              celda={`${s.id}_${col.id}`} foco={celdaFoco === `${s.id}_${col.id}`} aviso={aviso}/>
          )
        })}
        <td style={{ minWidth:26, background: hcMode ? 'var(--card-bg)' : rowBg }}/>
      </Fragment>
    )
  }

  const tableEl = (
    <div className="rounded-2xl overflow-hidden"
      style={{ border:'1px solid var(--card-border)', boxShadow:'var(--card-shadow)',
        /* En pantalla completa la hoja ocupa el hueco que le deja la barra en
           lugar de restarle una altura fija: la barra envuelve en varias líneas
           en móvil, y el `calc(100vh - 104px)` de antes se pasaba de largo. */
        ...(isFullscreen ? { flex:1, minHeight:0, display:'flex', flexDirection:'column' } : {}) }}>
      {/* Avisos de la hoja: antes el error de carga no se mostraba nunca y la
          hoja quedaba vacía sin explicación. */}
      {(errorHoja || errorOrden) && (
        <div role="alert" className="flex items-center justify-between gap-2 px-3 py-2 text-xs"
          style={{ background:'var(--bad-soft)', borderBottom:'1px solid var(--bad-line)', color:'var(--bad)' }}>
          <span>{errorHoja || errorOrden}</span>
          {errorHoja && <button type="button" onClick={cargarHoja} className="btn-secondary text-xs min-h-9">Reintentar</button>}
        </div>
      )}
      <p className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-[11px]"
        style={{ color:'var(--t3)', borderBottom:'1px solid var(--divider)', background:'var(--soft-bg)' }}>
        <GripVertical size={12}/> Arrastra el asa de cualquier bloque (Pago, Garantía, Área, Asistencias, Documentos o una materia) o de una columna para cambiarla de lugar. El orden se guarda para este grupo.
      </p>
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
              {/* Bloques (fijos y materias) en el orden del grupo */}
              {bloquesVisibles.map(t => cabecera1(t))}

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
            </tr>

            {/* ── Fila 2: nombres de columna ── */}
            <tr style={{ background: solidBg }}>
              {bloquesVisibles.map(t => cabecera2(t))}

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

                  {bloquesVisibles.map(t => celdasBloque(t, s, sc, rowBg))}

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
        {addColModal && <ColumnaModal titulo={`Añadir columna — ${subjects.find(s=>s.id===addColModal)?.name ?? ''}`}
          columnas={todasLasColumnas} onGuardar={cfg => addCol(addColModal, cfg)} onClose={()=>setAddColModal(null)}/>}
        {configCol && <ColumnaModal titulo={`Configurar columna — ${configCol.col.name}`} inicial={configCol.col}
          columnas={todasLasColumnas} soloExtras={configCol.col.esFija}
          onGuardar={guardarConfigColumna} onClose={()=>setConfigCol(null)}/>}
        {addSubjModal && <AddSubjectModal onAdd={addSubject} onClose={()=>setAddSubjModal(false)}/>}
        {showAddStudent && <StudentFormModal groups={[group]} defaultGroupId={group.id}
          onClose={()=>setShowAddStudent(false)} onSaved={async cred=>{await onDataChange?.();if(cred)setLastCred(cred)}}/>}
        {lastCred && <CredentialsPanel cred={lastCred} onClose={()=>setLastCred(null)}/>}
        {dialogoBorrado}
        {avisoEl}
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
        {addColModal && <ColumnaModal titulo={`Añadir columna — ${subjects.find(s=>s.id===addColModal)?.name ?? ''}`}
          columnas={todasLasColumnas} onGuardar={cfg => addCol(addColModal, cfg)} onClose={()=>setAddColModal(null)}/>}
        {configCol && <ColumnaModal titulo={`Configurar columna — ${configCol.col.name}`} inicial={configCol.col}
          columnas={todasLasColumnas} soloExtras={configCol.col.esFija}
          onGuardar={guardarConfigColumna} onClose={()=>setConfigCol(null)}/>}
        {addSubjModal && <AddSubjectModal onAdd={addSubject} onClose={()=>setAddSubjModal(false)}/>}
        {showAddStudent && <StudentFormModal groups={[group]} defaultGroupId={group.id}
          onClose={()=>setShowAddStudent(false)} onSaved={async cred=>{await onDataChange?.();if(cred)setLastCred(cred)}}/>}
        {lastCred && <CredentialsPanel cred={lastCred} onClose={()=>setLastCred(null)}/>}
        {dialogoBorrado}
        {avisoEl}
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
