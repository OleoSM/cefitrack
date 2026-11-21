import { useState, useEffect, useRef, useCallback } from 'react'
import AvatarAlumno from '../../components/ui/AvatarAlumno'
import { useSucursales } from '../../hooks/useSucursales'
import { filtrarGrupos } from '../../components/ui/BuscadorGrupo'
import BarraFiltros from '../../components/ui/BarraFiltros'
import { useSucursalActiva, TODAS } from '../../hooks/useSucursalActiva'
import { Html5Qrcode } from 'html5-qrcode'
import * as XLSX from 'xlsx'
import { getLastSimulacro } from '../../data/mockData'
import { fetchGroups, fetchStudents, fetchEvaluations } from '../../lib/supabaseData'
import { loadSettings } from '../../lib/settings'
import {
  todayISO, remainingSeconds, loadSessionDb, saveSessionDb, deleteSessionDb, fetchSessionIndex,
  diffLista, mensajeErrorLista,
} from '../../lib/attendanceDb'
import GroupShaderCard from '../../components/ui/GroupShaderCard'
import { useGroupColors } from '../../hooks/useGroupColors'
import ModalPortal from '../../components/ui/ModalPortal'
import ProgressiveList from '../../components/ui/ProgressiveList'
import { DataTable, DataTableRow, SkeletonBlock } from '../../components/ui/DataTable'
import KpiCard, { KpiGrid } from '../../components/ui/KpiCard'
import { IconAsistencia, IconRetardos, IconFaltas, IconAlumnos } from '../../components/ui/SigaKpiIcons'
import { DANGER_BTN_STYLE } from '../../components/admin/ConfirmDialog'
import { tintaSobre } from '../../lib/color'
import { asistenciasEfectivas } from '../../lib/studentMetrics'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { IconHojaCalificaciones } from '../../components/ui/SigaAdminIcons'
import {
  ArrowLeft, Camera, CameraOff, QrCode, CheckCircle2,
  FileSpreadsheet, Users, Clock, AlertTriangle, Scan,
  ChevronRight, ChevronLeft, UserCheck, CheckSquare, RotateCw, RefreshCw, CloudOff,
  Timer, Pause, Play, History, FolderClock, ChevronUp, ChevronDown, Download, X, ListChecks, Trash2, Info
} from 'lucide-react'
import { NeonCheckbox } from '../../components/ui/NeonCheckbox'

const QR_PREFIX   = 'EDUTRACK:'
const DEBOUNCE_MS = 3000

const fmtMMSS = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
const fmtDate = iso => new Date(`${iso}T00:00:00`).toLocaleDateString('es-MX', { day:'2-digit', month:'long', year:'numeric' })
const TOL_PRESETS = [5, 10, 15, 20]

const COLUMNS_LISTA = [
  { key:'n',       label:'#',          className:'w-8 hidden sm:flex' },
  { key:'alumno',  label:'Alumno',     className:'flex-grow min-w-0' },
  { key:'hora',    label:'Hora',       className:'w-16 sm:w-20 flex justify-end' },
  { key:'retardo', label:'Retardo',    className:'w-16 sm:w-20 flex justify-center' },
]

/* Lista manual: el mismo registro que el QR (alumno + hora + retardo), pero
   marcando una casilla. Sirve cuando no hay cámara o el alumno no trae su QR. */
const COLUMNS_MANUAL = [
  { key:'check',   label:'',           className:'w-9 flex justify-center' },
  { key:'alumno',  label:'Alumno',     className:'flex-grow min-w-0' },
  { key:'hora',    label:'Hora',       className:'w-14 sm:w-20 flex justify-end' },
  { key:'retardo', label:'Retardo',    className:'w-16 sm:w-20 flex justify-center' },
]
const CLAVE_MODO = 'siga_pase_lista_modo'
const horaAhora = () => new Date().toLocaleTimeString('es-MX', { hour:'2-digit', minute:'2-digit' })
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`

/* Días de clase de un grupo a partir de su horario en texto libre
   ("LUNES A VIERNES/HORARIO: …", "Sábado 08:00–14:00"). Devuelve un Set de
   getDay() (0 = domingo) o null si el horario no dice qué días. */
const NOMBRES_DIA = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']
function diasDeClase(horario) {
  if (!horario) return null
  const t = horario.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  const idx = w => NOMBRES_DIA.findIndex(n => w.startsWith(n))
  const dias = new Set()
  const rango = /(domingo|lunes|martes|miercoles|jueves|viernes|sabado)s?\s+a\s+(domingo|lunes|martes|miercoles|jueves|viernes|sabado)/g
  let m
  while ((m = rango.exec(t))) {
    for (let d = idx(m[1]); ; d = (d + 1) % 7) { dias.add(d); if (d === idx(m[2])) break }
  }
  for (const w of t.match(/[a-z]+/g) ?? []) { const d = idx(w); if (d >= 0) dias.add(d) }
  return dias.size ? dias : null
}

/* Calendario del historial: marca los días en que se tomó lista (finalizada o
   borrador) y al tocar uno lo abre. Los días de clase sin lista (desde la
   primera lista del grupo hasta ayer) van en naranja discreto y al tocarlos se
   pasa lista manual de esa fecha. Arranca en el mes de la última lista. */
const DIAS_SEMANA = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

/* Semáforo del calendario. Una lista guardada sin nadie presente es roja: en
   la base cuenta como falta para todo el grupo, así que no puede verse igual
   que una lista terminada. */
const SEMAFORO = {
  terminada: { label:'Lista terminada', texto:'Se pasó lista y se cerró correctamente.',
    celda:{ background:'var(--good-solid)', color:'#fff', border:'1px solid var(--good-solid)' } },
  pendiente: { label:'Lista sin cerrar', texto:'Se pasó lista, pero aún no se ha terminado.',
    celda:{ background:'var(--warn-solid)', color:'#fff', border:'1px solid var(--warn-solid)' } },
  vacia:     { label:'Lista sin asistentes', texto:'Se guardó sin ningún alumno presente y cuenta como falta para todo el grupo. Conviene revisarla o eliminarla.',
    celda:{ background:'var(--bad-solid)', color:'#fff', border:'1px solid var(--bad-solid)' } },
  sinLista:  { label:'Sin lista', texto:'Día de clase en el que no se pasó lista. Al seleccionarlo puede registrarse de forma manual.',
    celda:{ background:'var(--warn-soft)', color:'var(--warn)', border:'1px dashed var(--warn-line)' } },
}
const estadoDeLista = ses => !ses.records.length ? 'vacia' : ses.finished ? 'terminada' : 'pendiente'

function CalendarioListas({ sesiones, fechaAbierta, onElegir, diasClase, onPasarLista }) {
  const porFecha = new Map(sesiones.map(s => [s.date, s]))
  const primeraLista = [...porFecha.keys()].sort()[0] ?? null
  const [mes, setMes] = useState(() => ([...porFecha.keys()].sort().at(-1) ?? todayISO()).slice(0, 7))
  const [anio, numMes] = mes.split('-').map(Number)
  const primero = new Date(anio, numMes - 1, 1)
  const huecos = (primero.getDay() + 6) % 7            // la semana empieza en lunes
  const diasMes = new Date(anio, numMes, 0).getDate()
  const celdas = [...Array(huecos).fill(null), ...Array.from({ length: diasMes }, (_, i) => i + 1)]
  const mover = d => {
    const f = new Date(anio, numMes - 1 + d, 1)
    setMes(`${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}`)
  }
  const hoy = todayISO()
  const listasDelMes = sesiones.filter(s => s.date.startsWith(mes) && s.records.length).length
  const vaciasDelMes = sesiones.filter(s => s.date.startsWith(mes) && !s.records.length).length
  const sinLista = fecha => !!(diasClase && primeraLista && onPasarLista
    && fecha > primeraLista && fecha < hoy && !porFecha.has(fecha)
    && diasClase.has(new Date(`${fecha}T12:00:00`).getDay()))
  /* Leyenda oculta tras el botón "i". El sonar pulsa mientras no se haya
     abierto; al abrirla se apaga, y vuelve cada vez que se abre de nuevo el
     historial (el calendario se monta otra vez). */
  const [verLeyenda, setVerLeyenda] = useState(false)
  const [infoVista, setInfoVista] = useState(false)
  const alternarLeyenda = () => { setVerLeyenda(v => !v); setInfoVista(true) }
  const faltantesDelMes = Array.from({ length: diasMes }, (_, i) => `${mes}-${String(i + 1).padStart(2, '0')}`).filter(sinLista).length

  return (
    <div className="rounded-xl p-3" style={{ background:'var(--card-bg)', border:'1px solid var(--card-border)' }}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <button type="button" onClick={() => mover(-1)} aria-label="Mes anterior"
          className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ color:'var(--t2)', background:'var(--soft-bg)' }}>
          <ChevronLeft size={15}/>
        </button>
        <div className="text-center min-w-0">
          <p className="text-sm font-bold" style={{ color:'var(--t1)' }}>
            {(t => t.charAt(0).toUpperCase() + t.slice(1))(primero.toLocaleDateString('es-MX', { month:'long', year:'numeric' }))}
          </p>
          <p className="text-[11px]" style={{ color:'var(--t3)' }}>
            {listasDelMes ? plural(listasDelMes, 'lista tomada', 'listas tomadas') : 'Sin listas este mes'}
            {vaciasDelMes > 0 && <> · <span style={{ color:'var(--bad)' }}>{vaciasDelMes} sin asistentes</span></>}
            {faltantesDelMes > 0 && <> · <span style={{ color:'var(--warn)' }}>{plural(faltantesDelMes, 'día sin lista', 'días sin lista')}</span></>}
          </p>
        </div>
        <button type="button" onClick={() => mover(1)} aria-label="Mes siguiente"
          className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ color:'var(--t2)', background:'var(--soft-bg)' }}>
          <ChevronRight size={15}/>
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {DIAS_SEMANA.map((d, i) => (
          <span key={i} className="text-center text-[10px] font-bold uppercase" style={{ color:'var(--t4)' }}>{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {celdas.map((dia, i) => {
          if (!dia) return <span key={`h${i}`}/>
          const fecha = `${mes}-${String(dia).padStart(2, '0')}`
          const ses = porFecha.get(fecha)
          const esHoy = fecha === hoy
          const abierta = fecha === fechaAbierta
          if (!ses && sinLista(fecha)) return (
            <button key={fecha} type="button" onClick={() => onPasarLista(fecha)}
              title={`${fmtDate(fecha)} · Sin lista. Seleccione el día para registrarla de forma manual.`}
              aria-label={`Pasar lista manual del ${fmtDate(fecha)}, día sin lista`}
              className="h-9 flex items-center justify-center rounded-lg text-xs font-semibold tabular-nums transition-transform active:scale-95"
              style={{
                ...SEMAFORO.sinLista.celda,
                outline: abierta ? '2px solid var(--accent)' : 'none', outlineOffset: 1,
              }}>
              {dia}
            </button>
          )
          if (!ses) return (
            <span key={fecha} className="h-9 flex items-center justify-center rounded-lg text-xs tabular-nums"
              style={{ color: esHoy ? 'var(--t1)' : 'var(--t3)', border: esHoy ? '1px dashed var(--t3)' : '1px solid transparent', fontWeight: esHoy ? 700 : 400 }}>
              {dia}
            </span>
          )
          const retardos = ses.records.filter(r => r.retardo).length
          return (
            <button key={fecha} type="button" onClick={() => onElegir(ses)}
              title={`${fmtDate(fecha)} · ${SEMAFORO[estadoDeLista(ses)].label} · ${plural(ses.records.length, 'presente', 'presentes')}${retardos ? ` · ${plural(retardos, 'retardo', 'retardos')}` : ''}`}
              aria-label={`Abrir la lista del ${fmtDate(fecha)}: ${SEMAFORO[estadoDeLista(ses)].label.toLowerCase()}`}
              className="h-9 flex items-center justify-center rounded-lg text-xs font-bold tabular-nums transition-transform active:scale-95"
              style={{
                ...SEMAFORO[estadoDeLista(ses)].celda,
                outline: abierta ? '2px solid var(--accent)' : 'none', outlineOffset: 1,
              }}>
              {dia}
            </button>
          )
        })}
      </div>

      <div className="flex justify-end mt-2">
        <button type="button" onClick={alternarLeyenda}
          aria-expanded={verLeyenda} aria-controls="leyenda-calendario"
          aria-label={verLeyenda ? 'Ocultar el significado de los colores' : 'Ver el significado de los colores'}
          title="Significado de los colores"
          className="relative w-9 h-9 rounded-full flex items-center justify-center transition-colors"
          style={{ color: verLeyenda ? 'var(--accent)' : 'var(--t3)' }}>
          {!infoVista && <>
            <span aria-hidden="true" className="sonar-info"/>
            <span aria-hidden="true" className="sonar-info sonar-info-eco"/>
          </>}
          <Info size={17}/>
        </button>
      </div>

      {/* Leyenda del semáforo: qué significa cada color. */}
      {verLeyenda && (
      <ul id="leyenda-calendario" className="mt-1 pt-3 space-y-1.5" style={{ borderTop:'1px solid var(--divider)' }} aria-label="Significado de los colores">
        {Object.entries(SEMAFORO)
          .filter(([k]) => k !== 'sinLista' || (diasClase && onPasarLista))
          .map(([k, e]) => (
            <li key={k} className="flex items-start gap-2 text-[11px] leading-snug">
              <span className="w-3 h-3 rounded flex-shrink-0 mt-px" style={e.celda}/>
              <span style={{ color:'var(--t3)' }}>
                <strong className="font-semibold" style={{ color:'var(--t2)' }}>{e.label}.</strong> {e.texto}
              </span>
            </li>
          ))}
        <li className="flex items-start gap-2 text-[11px] leading-snug">
          <span className="w-3 h-3 rounded flex-shrink-0 mt-px" style={{ border:'1px dashed var(--t3)' }}/>
          <span style={{ color:'var(--t3)' }}><strong className="font-semibold" style={{ color:'var(--t2)' }}>Hoy.</strong> Fecha actual.</span>
        </li>
      </ul>
      )}
    </div>
  )
}

export default function Attendance() {
  const navigate = useNavigate()
  const location = useLocation()
  const { puedeVer, currentUser } = useAuth()
  const esAdmin = currentUser?.role === 'admin'
  const { sucursales, nombreDe } = useSucursales()
  const { getAccent } = useGroupColors()

  const [groups,         setGroups]        = useState([])
  const [students,       setStudents]      = useState([])
  const [sessionIndex,   setSessionIndex]  = useState([])  // sesiones guardadas en BD (todas, con registros)
  const [evaluations,    setEvaluations]   = useState([])  // para la columna de calificación del Excel
  const [view,           setView]          = useState('pick')  // 'pick' | 'scan'
  const [selectedGrp,    setSelectedGrp]   = useState(null)
  const { sucursal: sucursalFiltro, setSucursal: setSucursalFiltro, opcionesConTodas } = useSucursalActiva()
  const [buscaGrupo, setBuscaGrupo] = useState('')
  const [selectedDate,   setSelectedDate]  = useState(todayISO())
  const [scanning,       setScanning]      = useState(false)
  const [camError,       setCamError]      = useState('')
  const [scannedLog,     setScannedLog]    = useState([])
  const [lastScanned,    setLastScanned]   = useState(null)
  const [flashGreen,     setFlashGreen]    = useState(false)
  const [showLeaveModal, setShowLeaveModal]= useState(false)
  const [resumeSession,  setResumeSession] = useState(null) // sesión guardada de HOY, detectada al elegir grupo
  const [showConfirm,    setShowConfirm]   = useState(false)
  const [finished,       setFinished]      = useState(false)
  /* Estado de guardado visible: antes cada escritura terminaba en
     `.catch(() => {})` y una lista podía perderse sin que nadie lo notara. */
  const [loading,        setLoading]       = useState(true)
  const [loadError,      setLoadError]     = useState('')
  const [saveState,      setSaveState]     = useState('idle')   // idle | saving | saved | error
  const [saveRetry,      setSaveRetry]     = useState(0)
  const [actionBusy,     setActionBusy]    = useState(false)
  const [actionError,    setActionError]   = useState('')

  /* ── Historial ── */
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [historyGroupId,   setHistoryGroupId]   = useState(null)
  /* Lista del historial que se está por eliminar (fecha) y su estado. */
  const [borrarFecha,      setBorrarFecha]      = useState(null)
  const [borrando,         setBorrando]         = useState(false)
  const [borrarError,      setBorrarError]      = useState('')
  /* "Empezar de nuevo" pide una segunda confirmación con el conteo. */
  const [confirmarNuevo,   setConfirmarNuevo]   = useState(false)

  /* ── Cronómetro de tolerancia (basado en tiempo real, no en un contador local) ── */
  const [showTolModal,   setShowTolModal]  = useState(false)
  const [tolInput,       setTolInput]      = useState('15')
  const [tolMin,         setTolMin]        = useState(null)   // minutos elegidos (null = sin cronómetro)
  const [startedAt,      setStartedAt]     = useState(null)   // epoch ms — inicio real del cronómetro
  const [pausedAt,       setPausedAt]      = useState(null)   // epoch ms mientras está pausado
  const [pausedAccumMs,  setPausedAccumMs] = useState(0)      // tiempo total pausado, se excluye del conteo
  const [retardos,       setRetardos]      = useState({})     // { studentId: bool }
  const [, forceTick] = useState(0)

  /* ── Modo de pase de lista: QR o manual (se recuerda en este navegador) ── */
  const [modo, setModoState] = useState(() => {
    try { return localStorage.getItem(CLAVE_MODO) === 'manual' ? 'manual' : 'qr' } catch { return 'qr' }
  })
  const setModo = m => {
    setModoState(m)
    try { localStorage.setItem(CLAVE_MODO, m) } catch { /* sin storage */ }
  }
  const [buscaManual,  setBuscaManual]  = useState('')
  const [filtroManual, setFiltroManual] = useState('todos')   // todos | pendientes | presentes

  const qrRef          = useRef(null)        // Html5Qrcode instance
  const recentRef      = useRef(new Set())   // debounce set
  const tableScrollRef = useRef(null)
  const groupIdRef     = useRef(selectedGrp) // stable ref so handleDecode stays stable
  const tolExpiredRef  = useRef(false)       // ref estable para handleDecode
  const studentsRef    = useRef([])          // ref estable para handleDecode
  /* ¿Esta lista ya tuvo registros? Si en manual se desmarca al último, hay
     que guardar la lista vacía; si no, la base se quedaba con el anterior. */
  const huboRegistrosRef = useRef(false)
  /* "grupo|fecha" de una lista recién eliminada: el autoguardado pendiente no
     debe volver a crearla. */
  const eliminadaRef = useRef(null)
  /* Lo último que se sabe guardado en la base para la lista abierta
     (studentId → { time, retardo }). Cada guardado manda solo la diferencia. */
  const servidorRef = useRef(new Map())
  /* true si la lista ya existía en la base al abrirla (historial o retomada):
     entonces salir nunca la borra. */
  const existiaRef = useRef(false)

  useEffect(() => { groupIdRef.current = selectedGrp }, [selectedGrp])
  useEffect(() => { studentsRef.current = students }, [students])

  // Carga inicial desde Supabase: grupos, alumnos, evaluaciones e historial de listas.
  const cargarTodo = useCallback(() => {
    setLoading(true); setLoadError('')
    Promise.all([fetchGroups(), fetchStudents(), fetchSessionIndex(), fetchEvaluations()])
      .then(([gs, ss, idx, evs]) => {
        setGroups(gs); setStudents(ss); setSessionIndex(idx); setEvaluations(evs)
      })
      .catch(err => setLoadError(err?.message || 'No se pudieron cargar los grupos y las listas.'))
      .finally(() => setLoading(false))
  }, [])
  useEffect(() => { cargarTodo() }, [cargarTodo])

  const refreshIndex = () => fetchSessionIndex().then(setSessionIndex).catch(() => {})

  // Sesión de BD → forma que usa la UI (log con objetos student, mapa de retardos).
  const toUiSession = (dbs) => ({
    groupId: dbs.groupId,
    date: dbs.date,
    log: dbs.records
      .map(r => ({ student: studentsRef.current.find(s => s.id === r.studentId), time: r.time }))
      .filter(e => e.student),
    retardos: Object.fromEntries(dbs.records.filter(r => r.retardo).map(r => [r.studentId, true])),
    tolMin: dbs.tolMin,
    startedAt: dbs.startedAt,
    pausedAt: dbs.pausedAt,
    pausedAccumMs: dbs.pausedAccumMs,
    finished: dbs.finished,
  })

  const buildRecords = () =>
    scannedLog.map(e => ({ studentId: e.student.id, time: e.time, retardo: !!retardos[e.student.id] }))

  const fijarServidor = (records) => {
    servidorRef.current = new Map(records.map(r => [r.studentId, { time: r.time, retardo: !!r.retardo }]))
  }

  /* Guarda los cambios de la lista abierta (solo la diferencia con la base). */
  const guardarCambios = async (meta, grp = selectedGrp, fecha = selectedDate, records = buildRecords()) => {
    const cambios = diffLista(records, servidorRef.current)
    await saveSessionDb(grp, fecha, meta, cambios)
    const nuevo = new Map(servidorRef.current)
    cambios.removes.forEach(id => nuevo.delete(id))
    cambios.upserts.forEach(r => nuevo.set(r.studentId, { time: r.time, retardo: !!r.retardo }))
    servidorRef.current = nuevo
  }

  // Segundos restantes calculados sobre tiempo real transcurrido: si sales y
  // regresas (incluso otro día), el tiempo que pasó afecta la cuenta regresiva.
  const remainingSec = remainingSeconds({ tolMin, startedAt, pausedAt, pausedAccumMs })
  const tolExpired   = remainingSec !== null && remainingSec <= 0
  const timerPaused  = pausedAt !== null
  const retardoCount = Object.values(retardos).filter(Boolean).length

  useEffect(() => { tolExpiredRef.current = tolExpired }, [tolExpired])

  const grp           = groups.find(g => g.id === selectedGrp)
  const groupStudents = students.filter(s => s.groupId === selectedGrp)
  const accentColor   = selectedGrp ? getAccent(selectedGrp) : 'var(--info)'

  const dateLabel = selectedDate ? fmtDate(selectedDate) : ''
  const dateFile  = (selectedDate || todayISO()).replace(/-/g, '')

  /* ── Stable decode callback (empty deps → never recreated) ─── */
  const handleDecode = useCallback((raw) => {
    if (!raw.startsWith(QR_PREFIX)) return
    const studentId = raw.slice(QR_PREFIX.length)

    if (recentRef.current.has(studentId)) return
    recentRef.current.add(studentId)
    setTimeout(() => recentRef.current.delete(studentId), DEBOUNCE_MS)

    const student = studentsRef.current.find(st => st.id === studentId)
    if (!student) return
    if (groupIdRef.current && student.groupId !== groupIdRef.current) return

    const time = new Date().toLocaleTimeString('es-MX', { hour:'2-digit', minute:'2-digit' })
    setScannedLog(prev => {
      if (prev.find(e => e.student.id === studentId)) return prev
      return [...prev, { student, time }]
    })
    // Retardo automático: llegó después de vencida la tolerancia (override manual disponible)
    setRetardos(prev => prev[studentId] === undefined
      ? { ...prev, [studentId]: tolExpiredRef.current }
      : prev)
    setLastScanned({ student, time })
    setFlashGreen(true)
    setTimeout(() => setFlashGreen(false), 900)
  }, [])

  const toggleRetardo = id => setRetardos(prev => ({ ...prev, [id]: !prev[id] }))

  /* Marca o desmarca a mano. Marcar registra la hora de ese momento y aplica
     la misma regla de retardo que el QR; desmarcar lo quita de la lista. */
  /* En una lista de otro día no se sabe a qué hora llegó: se deja "—". */
  const horaDeRegistro = () => (selectedDate && selectedDate !== todayISO() ? '—' : horaAhora())
  const marcarManual = (student) => {
    const presente = scannedLog.some(e => e.student.id === student.id)
    if (presente) {
      setScannedLog(prev => prev.filter(e => e.student.id !== student.id))
      setRetardos(prev => { const n = { ...prev }; delete n[student.id]; return n })
      setLastScanned(prev => prev?.student.id === student.id ? null : prev)
      return
    }
    const time = horaDeRegistro()
    setScannedLog(prev => prev.some(e => e.student.id === student.id) ? prev : [...prev, { student, time }])
    setRetardos(prev => ({ ...prev, [student.id]: tolExpiredRef.current }))
    setLastScanned({ student, time })
  }
  const marcarVarios = (lista) => {
    const ya = new Set(scannedLog.map(e => e.student.id))
    const nuevos = lista.filter(s => !ya.has(s.id))
    if (!nuevos.length) return
    const time = horaDeRegistro()
    setScannedLog(prev => [...prev, ...nuevos.filter(s => !prev.some(e => e.student.id === s.id)).map(student => ({ student, time }))])
    setRetardos(prev => ({ ...prev, ...Object.fromEntries(nuevos.map(s => [s.id, tolExpiredRef.current])) }))
  }

  /* ── Scanner controls ──────────────────────────────────────── */
  const startScanner = useCallback(async () => {
    if (qrRef.current) return
    setCamError('')
    try {
      const qr = new Html5Qrcode('qr-reader')
      qrRef.current = qr
      await qr.start(
        { facingMode: 'environment' },
        { fps: 15, qrbox: { width: 210, height: 210 }, aspectRatio: 1.0 },
        handleDecode,
        () => {},
      )
      setScanning(true)
    } catch {
      setCamError('No se pudo acceder a la cámara. Verifica los permisos del navegador.')
      qrRef.current = null
    }
  }, [handleDecode])

  const stopScanner = useCallback(async () => {
    if (!qrRef.current) return
    await qrRef.current.stop().catch(() => {})
    qrRef.current = null
    setScanning(false)
  }, [])

  /* ── Effects ────────────────────────────────────────────────── */
  useEffect(() => () => { qrRef.current?.stop().catch(() => {}); qrRef.current = null }, [])

  // La cámara solo se enciende en modo QR; en manual se apaga.
  useEffect(() => {
    if (view === 'scan' && !showTolModal && modo === 'qr') {
      const t = setTimeout(startScanner, 350)
      return () => clearTimeout(t)
    }
    if (view !== 'scan' || modo !== 'qr') stopScanner()
  }, [view, showTolModal, modo]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll table to bottom on new entry (solo QR: en manual movería la
  // lista bajo el dedo cada vez que se marca a alguien).
  useEffect(() => {
    if (modo === 'qr' && tableScrollRef.current) {
      tableScrollRef.current.scrollTop = tableScrollRef.current.scrollHeight
    }
  }, [scannedLog, modo])

  // Tick de UI cada segundo mientras hay un cronómetro activo, para refrescar
  // la cuenta regresiva (el valor real se calcula siempre contra tiempo real).
  useEffect(() => {
    if (view !== 'scan' || tolMin == null) return
    const t = setInterval(() => forceTick(t => t + 1), 1000)
    return () => clearInterval(t)
  }, [view, tolMin])

  // Guarda la sesión (borrador) en la BD cada vez que cambia algo relevante,
  // con un pequeño debounce para no disparar una escritura por cada escaneo.
  useEffect(() => {
    if (scannedLog.length > 0) huboRegistrosRef.current = true
    if (!(selectedGrp && selectedDate && huboRegistrosRef.current)) return
    if (eliminadaRef.current === `${selectedGrp}|${selectedDate}`) return
    let vigente = true
    const t = setTimeout(() => {
      setSaveState('saving')
      guardarCambios({ tolMin, startedAt, pausedAt, pausedAccumMs, finished })
        .then(() => { if (vigente) setSaveState('saved') })
        .catch(() => { if (vigente) setSaveState('error') })
    }, 800)
    return () => { vigente = false; clearTimeout(t) }
  }, [scannedLog, retardos, tolMin, startedAt, pausedAt, pausedAccumMs, finished, selectedGrp, selectedDate, saveRetry])

  // Warn on browser refresh/close when session is active
  useEffect(() => {
    if (!scanning && scannedLog.length === 0) return
    const handler = e => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [scanning, scannedLog])

  /* ── Navigation ─────────────────────────────────────────────── */
  const selectGroup = async (groupId) => {
    eliminadaRef.current = null
    // Busca en la BD una lista guardada del día de hoy
    const today = todayISO()
    const saved = await loadSessionDb(groupId, today).catch(() => null)
    if (saved && saved.records?.length > 0) {
      setSelectedGrp(groupId)
      setSelectedDate(today)
      setResumeSession(toUiSession(saved))
      setView('scan')
      setCamError('')
      setLastScanned(null)
      return
    }
    huboRegistrosRef.current = false
    servidorRef.current = new Map()
    existiaRef.current = false
    setSelectedGrp(groupId)
    setSelectedDate(today)
    setScannedLog([])
    setLastScanned(null)
    setCamError('')
    setFinished(false)
    setTolInput(String(loadSettings().toleranciaMin))
    setShowTolModal(true)   // pop-up de tolerancia antes de comenzar
    setView('scan')
  }

  /* "Abrir lista" desde la tarjeta de Grupos llega con { abrirGrupo }: se abre
     ese grupo en cuanto cargan los grupos, y se limpia el estado para que
     recargar la página no lo vuelva a abrir. */
  const grupoPedido = location.state?.abrirGrupo
  useEffect(() => {
    if (!grupoPedido || !groups.some(g => g.id === grupoPedido)) return
    navigate(location.pathname, { replace: true, state: null })
    selectGroup(grupoPedido)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grupoPedido, groups])

  const openHistory = (groupId) => {
    setHistoryGroupId(groupId); setBorrarFecha(null); setBorrarError(''); setShowHistoryModal(true)
  }

  /* Día de clase sin lista (naranja en el calendario): abre una lista nueva de
     esa fecha en modo manual, sin cronómetro (no aplica a otro día). */
  /* Antes de cambiar a otra lista se guarda la abierta: el autoguardado con
     espera se cancela al cambiar de fecha y podría perderse el último cambio.
     Si no se puede guardar, no se cambia de lista. */
  const guardarAbierta = async () => {
    if (!(view === 'scan' && selectedGrp && huboRegistrosRef.current)) return true
    if (eliminadaRef.current === `${selectedGrp}|${selectedDate}`) return true
    try {
      if (scannedLog.length) await guardarCambios({ tolMin, startedAt, pausedAt, pausedAccumMs, finished })
      else if (!finished) await deleteSessionDb(selectedGrp, selectedDate)
      refreshIndex()
      return true
    } catch {
      setBorrarError('No se pudo guardar la lista abierta. Revisa tu conexión e inténtalo de nuevo.')
      return false
    }
  }

  const abrirDesdeHistorial = async (ses) => {
    if (!(await guardarAbierta())) return
    applySession(toUiSession(ses))
  }

  const pasarListaEnFecha = async (groupId, date) => {
    if (!(await guardarAbierta())) return
    eliminadaRef.current = null
    huboRegistrosRef.current = false
    servidorRef.current = new Map()
    existiaRef.current = false
    stopScanner()
    setSelectedGrp(groupId)
    setSelectedDate(date)
    setScannedLog([])
    setLastScanned(null)
    setRetardos({})
    setTolMin(null); setStartedAt(null); setPausedAt(null); setPausedAccumMs(0)
    setFinished(false)
    setCamError('')
    setResumeSession(null)
    setShowTolModal(false)
    setShowHistoryModal(false)
    setModo('manual')
    setView('scan')
  }

  /* Elimina una lista completa del historial (sesión + registros, en cascada):
     deja de contar como asistencia o falta para todo el grupo. Si es la lista
     que está abierta en pantalla, se cierra sin volver a guardarla. */
  const eliminarLista = async (groupId, date) => {
    setBorrando(true); setBorrarError('')
    eliminadaRef.current = `${groupId}|${date}`
    try {
      await deleteSessionDb(groupId, date)
    } catch (err) {
      eliminadaRef.current = null
      setBorrarError(mensajeErrorLista(err, 'No se pudo eliminar la lista. Revisa tu conexión e inténtalo de nuevo.'))
      setBorrando(false)
      return
    }
    setBorrando(false)
    setBorrarFecha(null)
    if (view === 'scan' && selectedGrp === groupId && selectedDate === date) {
      setShowHistoryModal(false)
      goBack(true)
    }
    refreshIndex()
  }

  const applySession = (session) => {
    eliminadaRef.current = null
    existiaRef.current = true
    huboRegistrosRef.current = (session.log ?? []).length > 0
    fijarServidor((session.log ?? []).map(e => ({
      studentId: e.student.id, time: e.time, retardo: !!session.retardos?.[e.student.id],
    })))
    setConfirmarNuevo(false)
    setSelectedGrp(session.groupId)
    setSelectedDate(session.date)
    setScannedLog(session.log ?? [])
    setLastScanned(session.log?.at(-1) ?? null)
    setRetardos(session.retardos ?? {})
    setTolMin(session.tolMin ?? null)
    setStartedAt(session.startedAt ?? null)
    setPausedAt(session.pausedAt ?? null)
    setPausedAccumMs(session.pausedAccumMs ?? 0)
    setFinished(!!session.finished)
    setCamError('')
    setShowTolModal(false)
    setResumeSession(null)
    setShowHistoryModal(false)
    setView('scan')
  }

  const startTolerance = (minutes) => {
    if (minutes === null) {                 // continuar sin cronómetro
      setTolMin(null)
      setStartedAt(null)
    } else {
      setTolMin(minutes)
      setStartedAt(Date.now())
    }
    setPausedAt(null)
    setPausedAccumMs(0)
    setShowTolModal(false)
  }

  const togglePause = () => {
    if (pausedAt) {
      setPausedAccumMs(a => a + (Date.now() - pausedAt))
      setPausedAt(null)
    } else {
      setPausedAt(Date.now())
    }
  }

  const resetTimerState = () => {
    setTolMin(null)
    setStartedAt(null)
    setPausedAt(null)
    setPausedAccumMs(0)
    setRetardos({})
    setShowTolModal(false)
  }

  const goBack = (force = false) => {
    if (!force && scannedLog.length > 0) { setShowLeaveModal(true); return }
    /* Si se desmarcó a todos, en la base quedó una lista vacía, y una lista
       vacía cuenta como falta para TODO el grupo. Al salir se elimina. */
    if (huboRegistrosRef.current && scannedLog.length === 0 && selectedGrp && selectedDate && !finished) {
      deleteSessionDb(selectedGrp, selectedDate).then(refreshIndex).catch(() => {})
    }
    huboRegistrosRef.current = false
    servidorRef.current = new Map()
    existiaRef.current = false
    setConfirmarNuevo(false)
    stopScanner()
    setView('pick')
    setSelectedGrp(null)
    setSelectedDate(todayISO())
    setScannedLog([])
    setLastScanned(null)
    setShowConfirm(false)
    setShowLeaveModal(false)
    setResumeSession(null)
    setFinished(false)
    setSaveState('idle')
    setActionError('')
    resetTimerState()
  }

  const handleFinish = () => { setActionError(''); setShowConfirm(true) }
  /* Se guarda explícitamente como finalizada (queda en el historial). Si la
     escritura falla, la lista NO se descarta: se avisa y se queda abierta. */
  const handleConfirmFinish = async () => {
    if (scannedLog.length === 0) return   // una lista vacía no se guarda como terminada
    setActionBusy(true); setActionError('')
    try {
      await guardarCambios({ tolMin, startedAt, pausedAt, pausedAccumMs, finished: true })
    } catch (err) {
      setActionError(mensajeErrorLista(err, 'No se pudo guardar la lista. Revisa tu conexión: la lista sigue abierta y no se perdió nada.'))
      setActionBusy(false)
      return
    }
    // Ya no se descarga el Excel al terminar: la lista queda guardada en la
    // base y el Excel se reconstruye cuando se pida desde el historial.
    refreshIndex()
    setActionBusy(false)
    goBack(true)
  }

  const guardarBorradorYSalir = async () => {
    setActionBusy(true); setActionError('')
    try {
      await guardarCambios({ tolMin, startedAt, pausedAt, pausedAccumMs, finished })
    } catch (err) {
      setActionError(mensajeErrorLista(err, 'No se pudo guardar la lista. Revisa tu conexión e inténtalo de nuevo.'))
      setActionBusy(false)
      return
    }
    refreshIndex()
    setActionBusy(false)
    goBack(true)
  }

  const borrarListaYSalir = async () => {
    setActionBusy(true); setActionError('')
    try {
      await deleteSessionDb(selectedGrp, selectedDate)
    } catch (err) {
      setActionError(mensajeErrorLista(err, 'No se pudo descartar la lista. Revisa tu conexión e inténtalo de nuevo.'))
      setActionBusy(false)
      return
    }
    refreshIndex()
    setActionBusy(false)
    goBack(true)
  }

  const empezarDeNuevo = async () => {
    setActionBusy(true); setActionError('')
    try {
      await deleteSessionDb(selectedGrp, selectedDate)
    } catch (err) {
      setActionError(mensajeErrorLista(err, 'No se pudo descartar la lista. Revisa tu conexión e inténtalo de nuevo.'))
      setActionBusy(false)
      return
    }
    refreshIndex()
    setActionBusy(false)
    setConfirmarNuevo(false)
    huboRegistrosRef.current = false
    servidorRef.current = new Map()
    existiaRef.current = false
    setScannedLog([])
    setRetardos({})
    setFinished(false)
    setResumeSession(null)
    setTolInput(String(loadSettings().toleranciaMin))
    setShowTolModal(true)
  }

  /* ── Excel export ───────────────────────────────────────────── */
  // fetchEvaluations ya devuelve ordenado por fecha desc, así que basta la primera.
  const lastEvalOf = (sid) => evaluations.find(e => e.studentId === sid) ?? null

  const exportExcel = () => {
    const buildRow = (student, idx, time, estado) => {
      const ev  = lastEvalOf(student.id)
      const sim = getLastSimulacro(student.id)
      return {
        '#':                            idx,
        'Nombre del Alumno':            student.name,
        'Hora de Llegada':              time,
        'Estado':                       estado,
        'Evaluación':                   ev ? ev.calificacion : '',
        'Examen General de Simulación': sim ? `${sim.folio ?? ''} ${sim.aciertos}/${sim.total}`.trim() : '',
      }
    }
    const rows = scannedLog.map((e, i) =>
      buildRow(e.student, i + 1, e.time, retardos[e.student.id] ? 'Retardo' : 'Presente'))
    const presentIds = new Set(scannedLog.map(e => e.student.id))
    groupStudents.forEach(s => {
      if (!presentIds.has(s.id))
        rows.push(buildRow(s, rows.length + 1, '—', 'Ausente'))
    })
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Lista')
    XLSX.writeFile(wb, `${grp?.name?.replace(/\s+/g, '') ?? 'Grupo'}_${dateFile}.xlsx`)
  }

  /**
   * Descarga cualquier lista del historial sin tener que reabrirla.
   * exportExcel() usa el estado de la sesión en curso; ésta parte de los
   * registros ya guardados en BD para la fecha elegida.
   */
  const exportSessionExcel = (sesion) => {
    const grupo = groups.find(g => g.id === sesion.groupId)
    const alumnos = students.filter(s => s.groupId === sesion.groupId)
    const porAlumno = Object.fromEntries(sesion.records.map(r => [r.studentId, r]))

    const rows = alumnos.map((s, i) => {
      const reg = porAlumno[s.id]
      const ev  = lastEvalOf(s.id)
      const sim = getLastSimulacro(s.id)
      return {
        '#': i + 1,
        'Nombre del Alumno': s.name,
        'Hora de Llegada': reg?.time ?? '—',
        'Estado': !reg ? 'Ausente' : reg.retardo ? 'Retardo' : 'Presente',
        'Evaluación': ev ? ev.calificacion : '',
        'Examen General de Simulación': sim ? `${sim.folio ?? ''} ${sim.aciertos}/${sim.total}`.trim() : '',
      }
    })

    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Lista')
    XLSX.writeFile(wb, `${grupo?.name?.replace(/\s+/g, '') ?? 'Grupo'}_${sesion.date}.xlsx`)
  }

  /**
   * Respaldo completo de un grupo, reconstruido desde la base: hoja "Resumen"
   * (alumno × fecha con P / R / F y su porcentaje) y una hoja por lista.
   * No se guardan archivos: el Excel se arma al pedirlo, siempre al día.
   */
  const exportRespaldoGrupo = (groupId) => {
    const grupo = groups.find(g => g.id === groupId)
    const alumnos = students.filter(s => s.groupId === groupId)
    const sesiones = sessionIndex.filter(s => s.groupId === groupId).sort((a, b) => a.date.localeCompare(b.date))
    if (!sesiones.length) return
    const wb = XLSX.utils.book_new()
    const resumen = alumnos.map((s, i) => {
      const fila = { '#': i + 1, 'Matrícula': s.matricula ?? '', 'Alumno': s.name }
      let presentes = 0, retardosAl = 0
      for (const ses of sesiones) {
        const reg = ses.records.find(r => r.studentId === s.id)
        fila[ses.date] = !reg ? 'F' : reg.retardo ? 'R' : 'P'
        if (reg) { if (reg.retardo) retardosAl++; else presentes++ }
      }
      fila['Retardos'] = retardosAl
      // Regla: 3 retardos = 1 falta.
      fila['Asistencia %'] = Math.round((asistenciasEfectivas(presentes, retardosAl) / sesiones.length) * 100)
      return fila
    })
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumen), 'Resumen')
    for (const ses of sesiones) {
      const porAlumno = Object.fromEntries(ses.records.map(r => [r.studentId, r]))
      const filas = alumnos.map((s, i) => {
        const reg = porAlumno[s.id]
        return { '#': i + 1, 'Nombre del Alumno': s.name, 'Hora de Llegada': reg?.time ?? '—',
          'Estado': !reg ? 'Ausente' : reg.retardo ? 'Retardo' : 'Presente' }
      })
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filas), ses.date)
    }
    XLSX.writeFile(wb, `Respaldo_asistencia_${grupo?.name?.replace(/\s+/g, '') ?? 'Grupo'}_${todayISO()}.xlsx`)
  }

  /* ── Modal: historial de listas (compartido por las dos vistas) ── */
  const HistoryModal = showHistoryModal && (
    <ModalPortal maxWidth="max-w-md" onClose={() => setShowHistoryModal(false)}>
      <div className="flex items-center justify-between gap-3 px-5 py-3.5" style={{ borderBottom:'1px solid var(--divider)' }}>
        <div className="min-w-0">
          <h2 className="text-sm font-bold truncate" style={{ color: 'var(--t1)' }}>
            Historial — {groups.find(g => g.id === historyGroupId)?.name}
          </h2>
          <p className="text-xs" style={{ color: 'var(--t3)' }}>
            Retoma una lista para editarla, o elimínala si fue de prueba.
          </p>
        </div>
        <button onClick={() => setShowHistoryModal(false)} aria-label="Cerrar"
          className="w-11 h-11 flex items-center justify-center rounded-lg flex-shrink-0" style={{ color:'var(--t3)' }}>
          <X size={15}/>
        </button>
      </div>
      <div className="p-5 space-y-2">
        {sessionIndex.some(s => s.groupId === historyGroupId) && (
          <button type="button" onClick={() => exportRespaldoGrupo(historyGroupId)} className="btn-primary w-full justify-center min-h-11 text-sm">
            <FileSpreadsheet size={15}/> Respaldo completo del grupo (Excel)
          </button>
        )}
        {sessionIndex.some(s => s.groupId === historyGroupId) && (
          <CalendarioListas key={historyGroupId}
            sesiones={sessionIndex.filter(s => s.groupId === historyGroupId)}
            fechaAbierta={view === 'scan' && selectedGrp === historyGroupId ? selectedDate : null}
            onElegir={abrirDesdeHistorial}
            diasClase={diasDeClase(groups.find(g => g.id === historyGroupId)?.schedule)}
            onPasarLista={fecha => pasarListaEnFecha(historyGroupId, fecha)}/>
        )}
        {borrarFecha && (
          <p role="alert" className="text-xs rounded-lg px-3 py-2 leading-relaxed"
            style={{ background:'var(--bad-soft)', border:'1px solid var(--bad-line)', color:'var(--bad)' }}>
            {borrarError || <>Se eliminará la lista del <strong>{fmtDate(borrarFecha)}</strong> para todo el grupo: sus asistencias, retardos y faltas dejarán de contar. No se puede deshacer.</>}
          </p>
        )}
        <ProgressiveList items={sessionIndex.filter(s => s.groupId === historyGroupId)} className="space-y-2"
          sizes={{ mobile: 5, tablet: 8, desktop: 12 }} emptyLabel="Este grupo aún no tiene listas guardadas.">
        {s => {
          const actual = view === 'scan' && s.date === selectedDate
          return (
            <div key={s.date}
              className="w-full flex items-center justify-between gap-2 p-3 rounded-xl transition-all"
              style={{
                background: 'var(--card-bg)',
                border: actual ? `2px solid ${accentColor}` : '1px solid var(--card-border)',
              }}>
              {/* Fila y descarga son botones hermanos: anidarlos sería HTML inválido */}
              <button onClick={() => abrirDesdeHistorial(s)}
                className="flex-1 min-w-0 text-left active:scale-[.98] transition-transform">
                <p className="text-sm font-semibold" style={{ color:'var(--t1)' }}>{fmtDate(s.date)}</p>
                <p className="text-xs mt-0.5" style={{ color:'var(--t3)' }}>
                  {plural(s.records.length, 'presente', 'presentes')}
                  {s.records.filter(r => r.retardo).length > 0 &&
                    ` · ${plural(s.records.filter(r => r.retardo).length, 'retardo', 'retardos')}`}
                </p>
              </button>
              {borrarFecha === s.date ? (
                <div className="flex items-center gap-1.5 flex-shrink-0" role="group" aria-label={`Confirmar eliminación de la lista del ${fmtDate(s.date)}`}>
                  <button type="button" onClick={() => eliminarLista(historyGroupId, s.date)} disabled={borrando}
                    className="min-h-9 px-3 rounded-xl text-xs font-bold disabled:opacity-40" style={DANGER_BTN_STYLE}>
                    {borrando ? 'Eliminando…' : 'Eliminar'}
                  </button>
                  <button type="button" onClick={() => { setBorrarFecha(null); setBorrarError('') }} disabled={borrando}
                    className="btn-secondary min-h-9 px-3 text-xs disabled:opacity-40">
                    No
                  </button>
                </div>
              ) : (
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="badge text-[10px] px-2 py-1"
                  style={{
                    terminada: { background:'var(--good-soft)', color:'var(--good)', border:'1px solid var(--good-line)' },
                    pendiente: { background:'var(--warn-soft)', color:'var(--warn)', border:'1px solid var(--warn-line)' },
                    vacia:     { background:'var(--bad-soft)',  color:'var(--bad)',  border:'1px solid var(--bad-line)' },
                  }[estadoDeLista(s)]}>
                  {{ terminada:'Terminada', pendiente:'Sin cerrar', vacia:'Sin asistentes' }[estadoDeLista(s)]}
                </span>
                <button onClick={() => exportSessionExcel(s)} title="Descargar esta lista en Excel" aria-label="Descargar en Excel"
                  className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors"
                  style={{ background:'var(--soft-bg)', border:'1px solid var(--card-border)', color:'var(--t2)' }}
                  onMouseEnter={e => e.currentTarget.style.color='var(--good)'}
                  onMouseLeave={e => e.currentTarget.style.color='var(--t2)'}>
                  <Download size={14}/>
                </button>
                {/* Regla: una lista terminada solo la elimina un administrador. */}
                {(esAdmin || !s.finished) && <button onClick={() => { setBorrarError(''); setBorrarFecha(s.date) }}
                  title="Eliminar esta lista del historial" aria-label={`Eliminar la lista del ${fmtDate(s.date)}`}
                  className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors"
                  style={{ background:'var(--soft-bg)', border:'1px solid var(--card-border)', color:'var(--t2)' }}
                  onMouseEnter={e => e.currentTarget.style.color='var(--bad)'}
                  onMouseLeave={e => e.currentTarget.style.color='var(--t2)'}>
                  <Trash2 size={14}/>
                </button>}
              </div>
              )}
            </div>
          )
        }}
        </ProgressiveList>
      </div>
    </ModalPortal>
  )

  /* ══════════════════════════════════════════════════════════════
     VIEW: GROUP PICKER
  ══════════════════════════════════════════════════════════════ */
  if (view === 'pick') {
    const gruposEnSucursal = sucursalFiltro === TODAS
      ? groups
      : groups.filter(g => g.sucursal === sucursalFiltro)
    const gruposVisibles = filtrarGrupos(gruposEnSucursal, buscaGrupo)
    return (
      <div className="w-full space-y-6">
        <div>
          <h1 className="page-title">Pasar Lista</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--t3)' }}>
            Selecciona el grupo para comenzar a registrar asistencia.
          </p>
        </div>

        <BarraFiltros
          filtros={[
            { id:'sucursal', label:'Sucursal', value:sucursalFiltro, onChange:setSucursalFiltro,
              porDefecto:sucursalFiltro, options:opcionesConTodas },
          ]}
          busqueda={{
            value: buscaGrupo,
            onChange: setBuscaGrupo,
            placeholder: 'Buscar grupo por nombre',
            coincidencias: gruposVisibles.map(g => ({
              id:g.id, label:g.name,
              sub:[g.subject, g.sucursal ? nombreDe(g.sucursal) : null].filter(Boolean).join(' · '),
            })),
            /* Aquí elegir un grupo ES entrar a pasarle lista: no hay un paso
               intermedio que valga la pena. */
            onElegir: id => id && selectGroup(id),
          }}
          resumen={`${gruposVisibles.length} grupo(s)`}/>

        {loadError && (
          <div role="alert" className="card p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between"
            style={{ background:'var(--bad-soft)', borderColor:'var(--bad-line)' }}>
            <span className="text-sm" style={{ color:'var(--bad)' }}>{loadError}</span>
            <button onClick={cargarTodo} className="btn-secondary min-h-11 justify-center"><RefreshCw size={14}/> Reintentar</button>
          </div>
        )}

        {loading && (
          <div className="grid gap-4" role="status" aria-label="Cargando grupos">
            {[0,1,2].map(i => <SkeletonBlock key={i} className="h-28"/>)}
          </div>
        )}

        {!loading && !loadError && (
        <ProgressiveList items={gruposVisibles} className="grid gap-4"
          sizes={{ mobile: 4, tablet: 8, desktop: 12 }}
          emptyLabel={groups.length ? 'Ningún grupo coincide con la sucursal o la búsqueda.' : 'No hay grupos todavía.'}>
          {g => {
            const count = students.filter(s => s.groupId === g.id).length
            const hasHistory = sessionIndex.some(s => s.groupId === g.id)
            return (
              <GroupShaderCard
                key={g.id} group={g} onClick={() => selectGroup(g.id)} showPicker
                footer={
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-3"
                    style={{ borderTop: '1px solid var(--divider)' }}>
                    {/* Calificaciones abre directo la hoja de este grupo. */}
                    {puedeVer('calificaciones') ? (
                      <button type="button" onClick={() => navigate('/admin/registrar', { state: { groupId: g.id } })}
                        className="btn-secondary text-xs min-h-9 gap-1.5">
                        <IconHojaCalificaciones size={14}/> Ir a calificaciones
                      </button>
                    ) : <span/>}
                    <div className="flex flex-wrap items-center gap-2 ml-auto">
                      {hasHistory && (
                        <button type="button" onClick={() => openHistory(g.id)} className="btn-secondary text-xs min-h-9 gap-1.5">
                          <FolderClock size={14}/> Historial
                        </button>
                      )}
                      <button type="button" onClick={() => selectGroup(g.id)} className="btn-primary text-xs min-h-9 gap-1.5">
                        Abrir lista <ChevronRight size={13}/>
                      </button>
                    </div>
                  </div>
                }>
                <div>
                  <p className="font-bold text-base" style={{ color: 'var(--t1)' }}>{g.name}</p>
                  <p className="text-sm" style={{ color: 'var(--t3)' }}>{g.subject}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1.5 text-xs" style={{ color: 'var(--t3)' }}>
                    <span className="flex items-center gap-1"><Users size={11}/>{count} alumnos</span>
                    <span className="hidden sm:flex items-center gap-1"><Clock size={11}/>{g.schedule}</span>
                  </div>
                </div>
              </GroupShaderCard>
            )
          }}
        </ProgressiveList>
        )}

        {HistoryModal}
      </div>
    )
  }

  /* ══════════════════════════════════════════════════════════════
     VIEW: SCANNER
  ══════════════════════════════════════════════════════════════ */
  const presentCount = scannedLog.length
  const totalCount   = groupStudents.length
  const absentCount  = totalCount - presentCount
  const pct          = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0

  // Lista manual: todo el grupo, filtrado por estado y nombre.
  const horaDe = Object.fromEntries(scannedLog.map(e => [e.student.id, e.time]))
  const qManual = buscaManual.trim().toLowerCase()
  const listaManual = [...groupStudents]
    .sort((a, b) => a.name.localeCompare(b.name))
    .filter(s => (filtroManual === 'todos' || (filtroManual === 'presentes') === !!horaDe[s.id])
      && (!qManual || s.name.toLowerCase().includes(qManual) || String(s.matricula ?? '').includes(qManual)))
  const pendientesVisibles = listaManual.filter(s => !horaDe[s.id])

  /* ── Resume session modal ────────────────────────────────── */
  const ResumeModal = resumeSession && (
    <ModalPortal maxWidth="max-w-sm" onClose={actionBusy ? undefined : () => goBack(true)}>
      <div className="relative p-6 space-y-4" role="document">
        {/* Cerrar el aviso = volver a elegir grupo sin tocar la lista guardada.
            Seguir aquí sin retomarla haría que el autoguardado la pisara. */}
        <button onClick={() => goBack(true)} disabled={actionBusy} aria-label="Cerrar aviso y volver a los grupos"
          className="absolute right-2 top-2 w-11 h-11 rounded-lg flex items-center justify-center transition-colors disabled:opacity-40"
          style={{ color:'var(--t3)' }}>
          <X size={15}/>
        </button>
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center mx-auto"
          style={{ background:'var(--warn-soft)', border:'1px solid var(--warn-line)' }}>
          <RotateCw size={20} style={{ color:'var(--warn)' }}/>
        </div>
        <div className="text-center">
          <h2 className="text-base font-bold mb-1" style={{ color: 'var(--t1)' }}>
            Lista guardada encontrada
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--t2)' }}>
            Ya hay una lista de hoy con{' '}
            <strong style={{ color:'var(--good)' }}>{plural(resumeSession.log.length, 'alumno presente', 'alumnos presentes')}</strong>
            {resumeSession.finished ? ', ya terminada' : ''}. ¿Quieres continuar con ella?
          </p>
        </div>
        {actionError && (
          <p role="alert" className="text-xs rounded-lg px-3 py-2" style={{ background:'var(--bad-soft)', border:'1px solid var(--bad-line)', color:'var(--bad)' }}>{actionError}</p>
        )}
        {confirmarNuevo ? (
          /* Segunda confirmación: empezar de nuevo BORRA la lista de hoy. */
          <div className="space-y-2">
            <p role="alert" className="text-xs rounded-lg px-3 py-2 leading-relaxed" style={{ background:'var(--bad-soft)', border:'1px solid var(--bad-line)', color:'var(--bad)' }}>
              Se borrarán las {plural(resumeSession.log.length, 'asistencia', 'asistencias')} registradas hoy. No se puede deshacer.
            </p>
            <button onClick={empezarDeNuevo} disabled={actionBusy}
              className="w-full py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-40"
              style={DANGER_BTN_STYLE}>
              {actionBusy ? 'Borrando…' : 'Borrar y empezar de nuevo'}
            </button>
            <button onClick={() => setConfirmarNuevo(false)} disabled={actionBusy}
              className="btn-secondary w-full justify-center disabled:opacity-40">
              No, conservar la lista
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <button onClick={() => applySession(resumeSession)} disabled={actionBusy}
              className="btn-primary w-full justify-center">
              <RotateCw size={14}/> Continuar lista
            </button>
            {/* Una lista terminada no se reinicia desde aquí: se edita o, si es
                admin, se elimina desde el historial. */}
            {!resumeSession.finished && (
              <button onClick={() => { setActionError(''); setConfirmarNuevo(true) }} disabled={actionBusy}
                className="btn-secondary w-full justify-center disabled:opacity-40">
                Empezar de nuevo
              </button>
            )}
          </div>
        )}
      </div>
    </ModalPortal>
  )

  /* ── Leave session modal ──────────────────────────────────── */
  const LeaveModal = showLeaveModal && (
    <ModalPortal maxWidth="max-w-sm" onClose={actionBusy ? undefined : () => setShowLeaveModal(false)}>
      <div className="p-6 space-y-4">
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center mx-auto"
          style={{ background:'var(--warn-soft)', border:'1px solid var(--warn-line)' }}>
          <AlertTriangle size={20} style={{ color:'var(--warn)' }}/>
        </div>
        <div className="text-center">
          <h2 className="text-base font-bold mb-1" style={{ color: 'var(--t1)' }}>
            Pase de lista en progreso
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--t2)' }}>
            Tienes <strong style={{ color:'var(--good)' }}>{plural(scannedLog.length, 'alumno presente', 'alumnos presentes')}</strong>.
            {existiaRef.current
              ? ' Los cambios se guardan solos; al salir, la lista queda en el historial.'
              : ' Si sales ahora, la lista se guardará en el historial y podrás continuar al regresar.'}
          </p>
        </div>
        {actionError && (
          <p role="alert" className="text-xs rounded-lg px-3 py-2" style={{ background:'var(--bad-soft)', border:'1px solid var(--bad-line)', color:'var(--bad)' }}>{actionError}</p>
        )}
        <div className="space-y-2">
          <button onClick={guardarBorradorYSalir} disabled={actionBusy}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-40"
            style={{ background:'var(--good-solid)', color:'#fff' }}>
            {actionBusy ? 'Guardando…' : existiaRef.current ? 'Guardar y salir' : 'Guardar borrador y salir'}
          </button>
          {/* Descartar solo existe para una lista nueva de esta visita. Una lista
              que ya estaba en la base (retomada o del historial) nunca se borra
              al salir: eso se hace desde el historial, con su confirmación. */}
          {!existiaRef.current && (
            <button onClick={borrarListaYSalir} disabled={actionBusy}
              className="w-full py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-40"
              style={DANGER_BTN_STYLE}>
              Descartar esta lista
            </button>
          )}
          <button onClick={() => { setActionError(''); setShowLeaveModal(false) }} disabled={actionBusy}
            className="btn-secondary w-full justify-center disabled:opacity-40">
            Seguir pasando lista
          </button>
        </div>
      </div>
    </ModalPortal>
  )

  /* ── Confirm finish modal ─────────────────────────────────── */
  const ConfirmModal = showConfirm && (
    <ModalPortal maxWidth="max-w-sm" onClose={actionBusy ? undefined : () => setShowConfirm(false)}>
      <div className="p-6">

        {/* Icon */}
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4"
          style={{ background:'var(--warn-soft)', border:'1px solid var(--warn-line)' }}>
          <AlertTriangle size={22} style={{ color:'var(--warn)' }}/>
        </div>

        {/* Copy */}
        <h2 className="text-base font-bold text-center mb-2" style={{ color: 'var(--t1)' }}>
          {presentCount === 0 ? 'No hay alumnos marcados' : '¿Terminar pase de lista?'}
        </h2>
        {presentCount === 0 ? (
          /* Una lista vacía cuenta como falta para todo el grupo: no se guarda
             como terminada, solo se puede descartar o seguir pasando lista. */
          <p className="text-sm text-center leading-relaxed mb-1" style={{ color: 'var(--t2)' }}>
            Una lista sin alumnos presentes registraría falta para todo el grupo.
            Si no hubo clase o la lista se abrió por error, puede descartarse.
          </p>
        ) : (
          <p className="text-sm text-center leading-relaxed mb-1" style={{ color: 'var(--t2)' }}>
            La lista quedará en el <span style={{ color: 'var(--t2)', fontWeight:600 }}>historial</span>{' '}
            — podrás reabrirla después desde "Ver historial de listas" para ajustar retardos o agregar alumnos,
            y descargar ahí su Excel cuando lo necesites.
          </p>
        )}

        {/* Summary */}
        <div className="mt-4 mb-5 rounded-xl p-3 flex items-center justify-around"
          style={{ background: 'var(--card-bg)', border: '1px solid var(--divider)' }}>
          <div className="text-center">
            <p className="text-lg font-bold" style={{ color:'var(--good)' }}>{presentCount}</p>
            <p className="text-[11px]" style={{ color: 'var(--t3)' }}>Presentes</p>
          </div>
          <div className="w-px h-8" style={{ background: 'var(--divider)' }}/>
          <div className="text-center">
            <p className="text-lg font-bold" style={{ color: 'var(--t3)' }}>{absentCount}</p>
            <p className="text-[11px]" style={{ color: 'var(--t3)' }}>Ausentes</p>
          </div>
          <div className="w-px h-8" style={{ background: 'var(--divider)' }}/>
          <div className="text-center">
            <p className="text-lg font-bold" style={{ color: 'var(--t1)' }}>{totalCount}</p>
            <p className="text-[11px]" style={{ color: 'var(--t3)' }}>Total</p>
          </div>
        </div>

        {actionError && (
          <p role="alert" className="text-xs rounded-lg px-3 py-2 mb-4" style={{ background:'var(--bad-soft)', border:'1px solid var(--bad-line)', color:'var(--bad)' }}>{actionError}</p>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button onClick={() => setShowConfirm(false)} disabled={actionBusy}
            className="btn-secondary flex-1 justify-center disabled:opacity-40">
            {presentCount === 0 ? 'Seguir pasando lista' : 'Cancelar'}
          </button>
          {presentCount === 0 ? (
            <button onClick={borrarListaYSalir} disabled={actionBusy}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-40"
              style={DANGER_BTN_STYLE}>
              {actionBusy ? 'Descartando…' : 'Descartar lista'}
            </button>
          ) : (
            <button onClick={handleConfirmFinish} disabled={actionBusy}
              className="btn-primary flex-1 justify-center">
              <CheckSquare size={14}/> {actionBusy ? 'Guardando…' : actionError ? 'Reintentar' : 'Confirmar'}
            </button>
          )}
        </div>
      </div>
    </ModalPortal>
  )

  /* ── Tolerance modal (pop-up antes de comenzar) ─────────── */
  const ToleranceModal = showTolModal && !resumeSession && (
    <ModalPortal maxWidth="max-w-sm" onClose={() => goBack(true)}>
      <div className="relative p-6 space-y-4">
        {/* Abrir la lista por error: se cancela sin guardar nada (aún no hay
            registros, así que en la base no existe ninguna lista). */}
        <button onClick={() => goBack(true)} aria-label="Cancelar y volver a los grupos"
          className="absolute right-2 top-2 w-11 h-11 rounded-lg flex items-center justify-center"
          style={{ color:'var(--t3)' }}>
          <X size={15}/>
        </button>
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center mx-auto"
          style={{ background: accentColor, color: tintaSobre(accentColor) }}>
          <Timer size={20}/>
        </div>
        <div className="text-center">
          <h2 className="text-base font-bold mb-1" style={{ color: 'var(--t1)' }}>
            Tolerancia de llegada
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--t2)' }}>
            Define los minutos de tolerancia para <strong style={{ color: 'var(--t2)' }}>{grp?.name}</strong>.
            Al vencer, los alumnos que se registren quedarán marcados con{' '}
            <strong style={{ color:'var(--warn)' }}>retardo</strong> automáticamente.
          </p>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {TOL_PRESETS.map(m => (
            <button key={m} onClick={() => setTolInput(String(m))}
              aria-pressed={String(m) === tolInput}
              className="min-h-11 rounded-xl text-sm font-bold transition-all"
              style={String(m) === tolInput
                ? { background:'var(--accent)', color:'var(--accent-contrast)', border:'1px solid var(--accent)' }
                : { background: 'var(--soft-bg)', border: '1px solid var(--card-border)', color: 'var(--t2)' }}>
              {m} min
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 rounded-xl pl-3 pr-1.5 py-1.5"
          style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
          <Clock size={14} style={{ color: 'var(--t3)' }}/>
          <input type="number" min="1" max="120" value={tolInput}
            onChange={e => setTolInput(e.target.value)}
            className="flex-1 min-w-0 bg-transparent py-1 px-2 text-sm font-semibold outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            style={{ color: 'var(--t1)' }}/>
          <span className="text-xs flex-shrink-0" style={{ color: 'var(--t3)' }}>min</span>
          <div className="flex flex-col flex-shrink-0 rounded-lg overflow-hidden"
            style={{ border: '1px solid var(--card-border)' }}>
            <button type="button" aria-label="Sumar un minuto"
              onClick={() => setTolInput(String(Math.min(120, (parseInt(tolInput, 10) || 0) + 1)))}
              className="w-6 h-4 flex items-center justify-center transition-colors"
              style={{ background: 'var(--soft-bg)', color: 'var(--t2)', borderBottom: '1px solid var(--card-border)' }}
              onMouseEnter={e => e.currentTarget.style.background= 'var(--divider)'}
              onMouseLeave={e => e.currentTarget.style.background= 'var(--soft-bg)'}>
              <ChevronUp size={11}/>
            </button>
            <button type="button" aria-label="Restar un minuto"
              onClick={() => setTolInput(String(Math.max(1, (parseInt(tolInput, 10) || 0) - 1)))}
              className="w-6 h-4 flex items-center justify-center transition-colors"
              style={{ background: 'var(--soft-bg)', color: 'var(--t2)' }}
              onMouseEnter={e => e.currentTarget.style.background= 'var(--divider)'}
              onMouseLeave={e => e.currentTarget.style.background= 'var(--soft-bg)'}>
              <ChevronDown size={11}/>
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <button onClick={() => {
            const m = parseInt(tolInput, 10)
            if (!isNaN(m) && m > 0) startTolerance(Math.min(m, 120))
          }} className="btn-primary w-full justify-center">
            <Play size={14}/> Comenzar pase de lista
          </button>
          <button onClick={() => startTolerance(null)}
            className="btn-secondary w-full justify-center">
            Continuar sin cronómetro
          </button>
          <button onClick={() => goBack(true)}
            className="w-full min-h-11 text-sm font-semibold rounded-xl transition-colors"
            style={{ color:'var(--t3)' }}
            onMouseEnter={e => e.currentTarget.style.color='var(--t1)'}
            onMouseLeave={e => e.currentTarget.style.color='var(--t3)'}>
            Cancelar, no pasar lista
          </button>
        </div>
      </div>
    </ModalPortal>
  )

  return (
    <div className="w-full space-y-4">

      {/* ── Breadcrumb ─────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={() => goBack()}
          className="flex items-center gap-1.5 text-sm font-medium transition-colors"
          style={{ color: 'var(--t3)' }}
          onMouseEnter={e => e.currentTarget.style.color= 'var(--t1)'}
          onMouseLeave={e => e.currentTarget.style.color= 'var(--t3)'}>
          <ArrowLeft size={15}/> Pasar Lista
        </button>
        <ChevronRight size={12} style={{ color: 'var(--t4)' }}/>
        <span className="text-sm font-semibold" style={{ color: 'var(--t1)' }}>
          {grp?.sucursal ? `${nombreDe(grp.sucursal)} - ${grp.name}` : grp?.name}
        </span>
        <span className="text-xs hidden sm:inline" style={{ color: 'var(--t4)' }}>· {grp?.subject}</span>
        {finished && (
          <span className="badge text-[10px] px-2 py-0.5"
            style={{ background:'var(--good-soft)', color:'var(--good)', border:'1px solid var(--good-line)' }}>
            Reabierta desde historial
          </span>
        )}
        <span className="ml-auto flex items-center gap-2">
          {saveState === 'error' ? (
            <button onClick={() => setSaveRetry(n => n + 1)} role="alert"
              className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-2 rounded-xl"
              style={DANGER_BTN_STYLE}
              title="El último cambio no llegó a la base de datos">
              <CloudOff size={14}/> Sin guardar · Reintentar
            </button>
          ) : saveState !== 'idle' && (
            <span className="text-[11px] font-semibold" role="status"
              style={{ color: saveState === 'saved' ? 'var(--good)' : 'var(--t3)' }}>
              {saveState === 'saving' ? 'Guardando…' : 'Guardado'}
            </span>
          )}
          <button onClick={() => openHistory(selectedGrp)} className="btn-secondary text-xs py-2">
            <History size={14}/> Ver historial
          </button>
        </span>
      </div>

      {/* ── Indicadores de la lista ─────────────────────────── */}
      <KpiGrid cols={4}>
        <KpiCard variant="surface" icon={IconAsistencia} tone="good" label="Presentes" value={presentCount}/>
        <KpiCard variant="surface" icon={IconRetardos} tone="warn" label="Retardos" value={retardoCount}/>
        <KpiCard variant="surface" icon={IconFaltas} tone="neutral" label={modo === 'manual' ? 'Sin marcar' : 'Sin escanear'} value={absentCount}/>
        <KpiCard variant="surface" icon={IconAlumnos} tone="info" label="Total" value={totalCount}
          sub={`${pct}% completado`}/>
      </KpiGrid>

      <div className="card px-5 py-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <p className="text-sm font-semibold" style={{ color:'var(--t2)' }}>
            Avance de la lista · <span className="tabular-nums" style={{ color:'var(--t1)' }}>{pct}%</span>
          </p>
          {tolMin !== null && remainingSec !== null && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono text-sm font-bold tabular-nums"
                style={tolExpired
                  ? { background:'var(--bad-soft)',  border:'1px solid var(--bad-line)',  color:'var(--bad)' }
                  : timerPaused
                    ? { background:'var(--warn-soft)', border:'1px solid var(--warn-line)', color:'var(--warn)' }
                    : { background:'var(--good-soft)', border:'1px solid var(--good-line)', color:'var(--good)' }}>
                <Timer size={14}/>
                {tolExpired ? 'Tolerancia vencida' : fmtMMSS(remainingSec)}
              </div>
              {!tolExpired && (
                <button onClick={togglePause} className="btn-secondary text-xs py-2">
                  {timerPaused ? <><Play size={14}/> Reanudar</> : <><Pause size={14}/> Pausar</>}
                </button>
              )}
            </div>
          )}
        </div>
        {/* Barra de una sola tinta: representa una cantidad (regla 2-bis). */}
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--soft-bg)' }}>
          <div className="h-full rounded-full transition-all duration-700 ease-out"
            style={{ width:`${pct}%`, background: accentColor }}/>
        </div>
      </div>

      {/* ── Modo: QR o manual ──────────────────────────────── */}
      <div role="tablist" aria-label="Forma de pasar lista" className="grid grid-cols-2 gap-2 sm:max-w-md">
        {[['qr', 'Escanear QR', QrCode], ['manual', 'Lista manual', ListChecks]].map(([id, label, Icon]) => (
          <button key={id} type="button" role="tab" aria-selected={modo === id} onClick={() => setModo(id)}
            className="min-h-11 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors"
            style={modo === id
              ? { background:'var(--accent)', color:'var(--accent-contrast)', border:'1px solid var(--accent)' }
              : { background:'var(--soft-bg)', color:'var(--t2)', border:'1px solid var(--card-border)' }}>
            <Icon size={15}/> {label}
          </button>
        ))}
      </div>

      {/* ── Main layout ────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* ── Camera column (lg: 2/5) ─────────────────────── */}
        {/* En manual se oculta pero sigue montada: Html5Qrcode necesita su nodo. */}
        <div className={`lg:col-span-2 space-y-3 ${modo === 'manual' ? 'hidden' : ''}`}>

          {/* Camera card */}
          <div className="card overflow-hidden relative" style={{
            outline: flashGreen ? '2px solid var(--good)' : '2px solid transparent',
            transition: 'outline-color .25s ease',
          }}>
            {/* Success flash */}
            <div className="absolute inset-0 z-20 pointer-events-none transition-opacity duration-300"
              style={{ background:'var(--good)', opacity: flashGreen ? 0.13 : 0 }}/>

            {/* Html5Qrcode mount point */}
            <div id="qr-reader" className="w-full" style={{ minHeight: 280 }}/>

            {/* Idle overlay */}
            {!scanning && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center"
                style={{ background:'var(--panel-bg)', minHeight: 280 }}>
                {camError ? (
                  <div className="text-center px-8 space-y-3">
                    <AlertTriangle size={32} className="mx-auto" style={{ color:'var(--bad)' }}/>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: 'var(--t2)' }}>
                        Error de cámara
                      </p>
                      <p className="text-xs mt-1" style={{ color: 'var(--t3)' }}>{camError}</p>
                    </div>
                    <button onClick={startScanner} className="btn-primary text-xs py-2 px-4 mx-auto">
                      Reintentar
                    </button>
                  </div>
                ) : (
                  <div className="text-center px-8">
                    {/* Animated scan frame */}
                    <div className="relative w-28 h-28 mx-auto mb-4">
                      <div className="absolute inset-0 rounded-2xl"
                        style={{ border:'1.5px dashed var(--card-border)' }}/>
                      <span className="absolute top-0 left-0 w-7 h-7 rounded-tl-2xl"
                        style={{ borderTop:`2px solid ${accentColor}`, borderLeft:`2px solid ${accentColor}` }}/>
                      <span className="absolute top-0 right-0 w-7 h-7 rounded-tr-2xl"
                        style={{ borderTop:`2px solid ${accentColor}`, borderRight:`2px solid ${accentColor}` }}/>
                      <span className="absolute bottom-0 left-0 w-7 h-7 rounded-bl-2xl"
                        style={{ borderBottom:`2px solid ${accentColor}`, borderLeft:`2px solid ${accentColor}` }}/>
                      <span className="absolute bottom-0 right-0 w-7 h-7 rounded-br-2xl"
                        style={{ borderBottom:`2px solid ${accentColor}`, borderRight:`2px solid ${accentColor}` }}/>
                      <QrCode size={28} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                        style={{ color: 'var(--t4)' }}/>
                    </div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--t2)' }}>
                      Cámara inactiva
                    </p>
                    <p className="text-xs mt-1" style={{ color: 'var(--t4)' }}>
                      Presiona "Activar cámara" para escanear
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Live scanning chip */}
            {scanning && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs"
                  style={{ background:'var(--panel-bg)', border:'1px solid var(--card-border)', color: 'var(--t1)' }}>
                  <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background:'var(--good)' }}/>
                  Escaneando…
                </div>
              </div>
            )}
          </div>

          {/* Toggle button */}
          {!scanning ? (
            <button onClick={startScanner} className="btn-primary w-full justify-center">
              <Camera size={14}/> Activar cámara
            </button>
          ) : (
            <button onClick={stopScanner}
              className="w-full flex items-center justify-center gap-2 rounded-xl font-bold text-sm py-2.5 transition-all"
              style={DANGER_BTN_STYLE}>
              <CameraOff size={14}/> Pausar escaneo
            </button>
          )}

          {/* Last scanned banner */}
          {lastScanned && (
            <div className="card p-3 animate-fade-in" style={{ borderLeft:`3px solid var(--good)` }}>
              <div className="flex items-center gap-2.5">
                <CheckCircle2 size={16} className="flex-shrink-0" style={{ color:'var(--good)' }}/>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color:'var(--good)' }}>
                    Último escaneado
                  </p>
                  <p className="text-sm font-bold truncate" style={{ color: 'var(--t1)' }}>
                    {lastScanned.student.name}
                  </p>
                </div>
                <span className="font-mono text-xs flex-shrink-0" style={{ color: 'var(--t3)' }}>
                  {lastScanned.time}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* ── Attendance table (lg: 3/5) ─────────────────── */}
        <div className={`${modo === 'manual' ? 'lg:col-span-5' : 'lg:col-span-3'} flex flex-col card overflow-hidden`} style={{ minHeight: 380 }}>

          {/* Table top bar */}
          <div className="px-4 py-3 flex items-center justify-between flex-shrink-0"
            style={{ borderBottom: '1px solid var(--divider)' }}>
            <div className="flex items-center gap-2.5">
              <UserCheck size={14} style={{ color: accentColor }}/>
              <span className="text-sm font-bold" style={{ color: 'var(--t1)' }}>
                {modo === 'manual' ? 'Lista manual' : 'Lista de asistencia'}
              </span>
              {presentCount > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                  style={{ background:'var(--good-soft)', color:'var(--good)' }}>
                  {presentCount}
                </span>
              )}
            </div>
            <span className="text-xs" style={{ color:'var(--t4)' }}>{dateLabel}</span>
          </div>

          {/* Table body */}
          <div ref={tableScrollRef} className="flex-1 overflow-y-auto">
            {modo === 'manual' ? (
              <div className="p-2 sm:p-3 space-y-3">
                <BarraFiltros
                  filtros={[{ id:'estado', label:'Mostrar', value:filtroManual, onChange:setFiltroManual, porDefecto:'todos',
                    options:[{ value:'todos', label:'Todos' }, { value:'pendientes', label:'Sin marcar' }, { value:'presentes', label:'Presentes' }] }]}
                  busqueda={{ value:buscaManual, onChange:setBuscaManual, placeholder:'Buscar alumno o matrícula…' }}
                  resumen={`${presentCount} de ${totalCount}`}/>
                {/* Fuera de la barra: dentro le quitaba el ancho al buscador en teléfono. */}
                {pendientesVisibles.length > 0 && (
                  <button type="button" onClick={() => marcarVarios(pendientesVisibles)}
                    className="btn-secondary w-full sm:w-auto justify-center min-h-11 text-xs"
                    title={qManual || filtroManual !== 'todos' ? 'Marca como presentes a los alumnos que se ven en la lista' : 'Marca como presentes a todos los que faltan'}>
                    <CheckSquare size={14}/> Marcar {qManual || filtroManual !== 'todos' ? 'visibles' : 'todos'} como presentes ({pendientesVisibles.length})
                  </button>
                )}
                <DataTable columns={COLUMNS_MANUAL}>
                  <ProgressiveList items={listaManual}
                    emptyLabel={totalCount === 0 ? 'Este grupo no tiene alumnos.' : 'Ningún alumno coincide con el filtro.'}>
                    {s => {
                      const hora = horaDe[s.id]
                      return (
                        <DataTableRow key={s.id} onClick={() => marcarManual(s)} cells={[
                          { className:'w-9 flex justify-center', content: (
                            <span onClick={e => e.stopPropagation()}>
                              <NeonCheckbox checked={!!hora} onChange={() => marcarManual(s)}
                                aria-label={`${hora ? 'Quitar asistencia de' : 'Marcar presente a'} ${s.name}`}/>
                            </span>
                          )},
                          { className:'flex-grow min-w-0', content: (
                            <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
                              <AvatarAlumno student={s} size={24}
                                style={hora ? { background:'var(--good-solid)', color:'#fff' } : { background:'var(--soft-bg)', color:'var(--t2)' }}/>
                              <span className="text-xs sm:text-sm font-medium truncate min-w-0"
                                style={{ color: hora ? 'var(--t1)' : 'var(--t2)' }}>
                                {s.name}
                              </span>
                            </div>
                          )},
                          { className:'w-14 sm:w-20 flex justify-end', content: (
                            <span className="font-mono text-[10px] sm:text-xs font-semibold tabular-nums whitespace-nowrap"
                              style={{ color: retardos[s.id] ? 'var(--warn)' : hora ? 'var(--t2)' : 'var(--t4)' }}>
                              {hora ?? '—'}
                            </span>
                          )},
                          { className:'w-16 sm:w-20 flex justify-center', content: hora ? (
                            <button onClick={e => { e.stopPropagation(); toggleRetardo(s.id) }}
                              role="switch" aria-checked={!!retardos[s.id]}
                              aria-label={`Retardo de ${s.name}`}
                              title={retardos[s.id] ? 'Con retardo — clic para quitar' : 'Marcar retardo'}
                              className="relative inline-flex w-9 h-5 rounded-full transition-colors duration-200 align-middle"
                              style={{ background: retardos[s.id] ? 'var(--warn-solid)' : 'var(--t4)' }}>
                              <span className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-200"
                                style={{ transform: retardos[s.id] ? 'translateX(16px)' : 'translateX(0)' }}/>
                            </button>
                          ) : null },
                        ]}/>
                      )
                    }}
                  </ProgressiveList>
                </DataTable>
              </div>
            ) : scannedLog.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-16 px-6 text-center">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                  style={{ background: 'var(--card-bg)', border: '1px solid var(--divider)' }}>
                  <Scan size={22} style={{ color: 'var(--t4)' }}/>
                </div>
                <p className="text-sm font-semibold" style={{ color:'var(--t3)' }}>
                  Sin registros aún
                </p>
                <p className="text-xs mt-1.5 leading-relaxed" style={{ color: 'var(--t4)' }}>
                  Activa la cámara y escanea el QR de<br/>cada alumno para registrarlo aquí
                </p>
              </div>
            ) : (
              <div className="p-2 sm:p-3">
                <DataTable columns={COLUMNS_LISTA}>
                  {scannedLog.map((entry, i) => (
                    <DataTableRow key={entry.student.id} cells={[
                      { className:'w-8 hidden sm:flex', content: (
                        <span className="font-mono text-[11px] tabular-nums" style={{ color: 'var(--t3)' }}>
                          {String(i + 1).padStart(2, '0')}
                        </span>
                      )},
                      { className:'flex-grow min-w-0', content: (
                        <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
                          <AvatarAlumno student={entry.student} size={24}
                            style={{ background:'var(--good-solid)', color:'#fff' }}/>
                          <span className="text-xs sm:text-sm font-medium truncate min-w-0" style={{ color: 'var(--t1)' }}>
                            {entry.student.name}
                          </span>
                        </div>
                      )},
                      { className:'w-16 sm:w-20 flex justify-end', content: (
                        <span className="font-mono text-[10px] sm:text-xs font-semibold tabular-nums whitespace-nowrap"
                          style={{ color: retardos[entry.student.id] ? 'var(--warn)' : 'var(--t2)' }}>
                          {entry.time}
                        </span>
                      )},
                      { className:'w-16 sm:w-20 flex justify-center', content: (
                        <button onClick={() => toggleRetardo(entry.student.id)}
                          role="switch" aria-checked={!!retardos[entry.student.id]}
                          aria-label={`Retardo de ${entry.student.name}`}
                          title={retardos[entry.student.id] ? 'Con retardo — clic para quitar' : 'Marcar retardo'}
                          className="relative inline-flex w-9 h-5 rounded-full transition-colors duration-200 align-middle"
                          style={{ background: retardos[entry.student.id] ? 'var(--warn-solid)' : 'var(--t4)' }}>
                          <span className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-200"
                            style={{ transform: retardos[entry.student.id] ? 'translateX(16px)' : 'translateX(0)' }}/>
                        </button>
                      )},
                    ]}/>
                  ))}
                </DataTable>
              </div>
            )}
          </div>

          {/* Footer: export + finish */}
          <div className="px-4 py-3 flex items-center justify-between gap-3 flex-shrink-0"
            style={{ borderTop: '1px solid var(--divider)', background: 'var(--card-bg)' }}>
            <p className="text-xs" style={{ color:'var(--t3)' }}>
              {scannedLog.length > 0
                ? `${presentCount} de ${totalCount} alumnos registrados`
                : modo === 'manual' ? 'Marca a los alumnos presentes' : 'Esperando escaneos…'}
            </p>
            <div className="flex items-center gap-2">
              {scannedLog.length > 0 && (
                <button onClick={exportExcel}
                  className="flex items-center gap-2 text-sm font-semibold px-3 py-2 rounded-xl transition-all active:scale-95"
                  style={{ background:'var(--good-soft)', border:'1px solid var(--good-line)', color:'var(--good)' }}
                  onMouseEnter={e => e.currentTarget.style.background='var(--good-line)'}
                  onMouseLeave={e => e.currentTarget.style.background='var(--good-soft)'}>
                  <FileSpreadsheet size={14}/>
                  <span className="hidden sm:inline">Excel</span>
                </button>
              )}
              <button onClick={handleFinish} className="btn-primary text-sm py-2">
                <CheckSquare size={14}/> Terminar pase de lista
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Modales ── */}
      {ConfirmModal}
      {ResumeModal}
      {LeaveModal}
      {ToleranceModal}

      {HistoryModal}
    </div>
  )
}
