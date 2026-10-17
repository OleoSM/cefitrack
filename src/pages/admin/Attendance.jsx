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
import {
  ArrowLeft, Camera, CameraOff, QrCode, CheckCircle2,
  FileSpreadsheet, Users, Clock, AlertTriangle, Scan,
  ChevronRight, UserCheck, CheckSquare, RotateCw, RefreshCw, CloudOff,
  Timer, Pause, Play, History, FolderClock, ChevronUp, ChevronDown, Download, X
} from 'lucide-react'

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

export default function Attendance() {
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

  /* ── Cronómetro de tolerancia (basado en tiempo real, no en un contador local) ── */
  const [showTolModal,   setShowTolModal]  = useState(false)
  const [tolInput,       setTolInput]      = useState('15')
  const [tolMin,         setTolMin]        = useState(null)   // minutos elegidos (null = sin cronómetro)
  const [startedAt,      setStartedAt]     = useState(null)   // epoch ms — inicio real del cronómetro
  const [pausedAt,       setPausedAt]      = useState(null)   // epoch ms mientras está pausado
  const [pausedAccumMs,  setPausedAccumMs] = useState(0)      // tiempo total pausado, se excluye del conteo
  const [retardos,       setRetardos]      = useState({})     // { studentId: bool }
  const [, forceTick] = useState(0)

  const qrRef          = useRef(null)        // Html5Qrcode instance
  const recentRef      = useRef(new Set())   // debounce set
  const tableScrollRef = useRef(null)
  const groupIdRef     = useRef(selectedGrp) // stable ref so handleDecode stays stable
  const tolExpiredRef  = useRef(false)       // ref estable para handleDecode
  const studentsRef    = useRef([])          // ref estable para handleDecode

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

  useEffect(() => {
    if (view === 'scan' && !showTolModal) {
      const t = setTimeout(startScanner, 350)
      return () => clearTimeout(t)
    } else if (view !== 'scan') {
      stopScanner()
    }
  }, [view, showTolModal]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll table to bottom on new entry
  useEffect(() => {
    if (tableScrollRef.current) {
      tableScrollRef.current.scrollTop = tableScrollRef.current.scrollHeight
    }
  }, [scannedLog])

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
    if (!(selectedGrp && selectedDate && scannedLog.length > 0)) return
    let vigente = true
    const t = setTimeout(() => {
      setSaveState('saving')
      saveSessionDb(
        selectedGrp, selectedDate,
        { tolMin, startedAt, pausedAt, pausedAccumMs, finished },
        scannedLog.map(e => ({ studentId: e.student.id, time: e.time, retardo: !!retardos[e.student.id] })),
      )
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

  const openHistory = (groupId) => { setHistoryGroupId(groupId); setShowHistoryModal(true) }

  const applySession = (session) => {
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
    setActionBusy(true); setActionError('')
    try {
      await saveSessionDb(
        selectedGrp, selectedDate,
        { tolMin, startedAt, pausedAt, pausedAccumMs, finished: true },
        buildRecords(),
      )
    } catch (err) {
      setActionError(`No se pudo guardar la lista: ${err?.message || 'error de conexión'}. Sigue abierta; vuelve a intentarlo.`)
      setActionBusy(false)
      return
    }
    // El respaldo se reconstruye desde lo que quedó en la base (no desde la
    // pantalla): así el Excel es exactamente lo guardado. Sin red, el de pantalla.
    try {
      const guardada = await loadSessionDb(selectedGrp, selectedDate)
      if (guardada) exportSessionExcel(guardada)
      else exportExcel()
    } catch { exportExcel() }
    refreshIndex()
    setActionBusy(false)
    goBack(true)
  }

  const guardarBorradorYSalir = async () => {
    setActionBusy(true); setActionError('')
    try {
      await saveSessionDb(
        selectedGrp, selectedDate,
        { tolMin, startedAt, pausedAt, pausedAccumMs, finished },
        buildRecords(),
      )
    } catch (err) {
      setActionError(`No se pudo guardar el borrador: ${err?.message || 'error de conexión'}.`)
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
      setActionError(`No se pudo borrar la lista guardada: ${err?.message || 'error de conexión'}.`)
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
      setActionError(`No se pudo descartar la lista guardada: ${err?.message || 'error de conexión'}.`)
      setActionBusy(false)
      return
    }
    refreshIndex()
    setActionBusy(false)
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
      const fila = { '#': i + 1, 'Alumno': s.name }
      let asistio = 0
      for (const ses of sesiones) {
        const reg = ses.records.find(r => r.studentId === s.id)
        fila[ses.date] = !reg ? 'F' : reg.retardo ? 'R' : 'P'
        if (reg) asistio++
      }
      fila['Asistencia %'] = Math.round((asistio / sesiones.length) * 100)
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
            Retoma cualquier lista para editarla o agregar alumnos.
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
        {sessionIndex.filter(s => s.groupId === historyGroupId).map(s => {
          const actual = view === 'scan' && s.date === selectedDate
          return (
            <div key={s.date}
              className="w-full flex items-center justify-between gap-2 p-3 rounded-xl transition-all"
              style={{
                background: 'var(--card-bg)',
                border: actual ? `2px solid ${accentColor}` : '1px solid var(--card-border)',
              }}>
              {/* Fila y descarga son botones hermanos: anidarlos sería HTML inválido */}
              <button onClick={() => applySession(toUiSession(s))}
                className="flex-1 min-w-0 text-left active:scale-[.98] transition-transform">
                <p className="text-sm font-semibold" style={{ color:'var(--t1)' }}>{fmtDate(s.date)}</p>
                <p className="text-xs mt-0.5" style={{ color:'var(--t3)' }}>
                  {s.records.length} presentes
                  {s.records.filter(r => r.retardo).length > 0 &&
                    ` · ${s.records.filter(r => r.retardo).length} retardos`}
                </p>
              </button>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="badge text-[10px] px-2 py-1"
                  style={s.finished
                    ? { background:'var(--good-soft)', color:'var(--good)', border:'1px solid var(--good-line)' }
                    : { background:'var(--warn-soft)', color:'var(--warn)', border:'1px solid var(--warn-line)' }}>
                  {s.finished ? 'Finalizada' : 'Borrador'}
                </span>
                <button onClick={() => exportSessionExcel(s)} title="Descargar esta lista en Excel" aria-label="Descargar en Excel"
                  className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors"
                  style={{ background:'var(--soft-bg)', border:'1px solid var(--card-border)', color:'var(--t2)' }}
                  onMouseEnter={e => e.currentTarget.style.color='var(--good)'}
                  onMouseLeave={e => e.currentTarget.style.color='var(--t2)'}>
                  <Download size={14}/>
                </button>
              </div>
            </div>
          )
        })}
        {sessionIndex.every(s => s.groupId !== historyGroupId) && (
          <p className="text-sm py-6 text-center" style={{ color:'var(--t3)' }}>Este grupo aún no tiene listas guardadas.</p>
        )}
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
                footer={hasHistory && (
                  <button
                    onClick={() => openHistory(g.id)}
                    className="btn-secondary text-xs py-2">
                    <FolderClock size={14}/> Ver historial de listas
                  </button>
                )}>
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
            Tienes una lista del día de hoy con{' '}
            <strong style={{ color:'var(--good)' }}>{resumeSession.log.length} alumnos</strong>
            {' '}escaneados{resumeSession.finished ? ' (finalizada)' : ''}. ¿Deseas continuar donde te quedaste?
          </p>
        </div>
        {actionError && (
          <p role="alert" className="text-xs rounded-lg px-3 py-2" style={{ background:'var(--bad-soft)', border:'1px solid var(--bad-line)', color:'var(--bad)' }}>{actionError}</p>
        )}
        <div className="space-y-2">
          <button onClick={() => applySession(resumeSession)} disabled={actionBusy}
            className="btn-primary w-full justify-center">
            <RotateCw size={14}/> Continuar lista
          </button>
          <button onClick={empezarDeNuevo} disabled={actionBusy}
            className="btn-secondary w-full justify-center disabled:opacity-40">
            {actionBusy ? 'Descartando…' : 'Empezar de nuevo'}
          </button>
        </div>
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
            Tienes <strong style={{ color:'var(--good)' }}>{scannedLog.length} alumnos</strong> registrados.
            Si sales ahora, la lista se guardará en el historial y podrás continuar al regresar.
          </p>
        </div>
        {actionError && (
          <p role="alert" className="text-xs rounded-lg px-3 py-2" style={{ background:'var(--bad-soft)', border:'1px solid var(--bad-line)', color:'var(--bad)' }}>{actionError}</p>
        )}
        <div className="space-y-2">
          <button onClick={guardarBorradorYSalir} disabled={actionBusy}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-40"
            style={{ background:'var(--good-solid)', color:'#fff' }}>
            {actionBusy ? 'Guardando…' : 'Guardar borrador y salir'}
          </button>
          <button onClick={borrarListaYSalir} disabled={actionBusy}
            className="w-full py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-40"
            style={DANGER_BTN_STYLE}>
            Salir sin guardar
          </button>
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
          ¿Terminar pase de lista?
        </h2>
        <p className="text-sm text-center leading-relaxed mb-1" style={{ color: 'var(--t2)' }}>
          La lista quedará en el <span style={{ color: 'var(--t2)', fontWeight:600 }}>historial</span>{' '}
          — podrás reabrirla después desde "Ver historial de listas" para ajustar retardos o agregar alumnos.
        </p>

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
            Cancelar
          </button>
          <button onClick={handleConfirmFinish} disabled={actionBusy}
            className="btn-primary flex-1 justify-center">
            <CheckSquare size={14}/> {actionBusy ? 'Guardando…' : actionError ? 'Reintentar' : 'Confirmar'}
          </button>
        </div>
      </div>
    </ModalPortal>
  )

  /* ── Tolerance modal (pop-up antes de comenzar) ─────────── */
  const ToleranceModal = showTolModal && !resumeSession && (
    <ModalPortal maxWidth="max-w-sm">
      <div className="p-6 space-y-4">
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
        <KpiCard variant="surface" icon={IconFaltas} tone="neutral" label="Sin escanear" value={absentCount}/>
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

      {/* ── Main layout ────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* ── Camera column (lg: 2/5) ─────────────────────── */}
        <div className="lg:col-span-2 space-y-3">

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
        <div className="lg:col-span-3 flex flex-col card overflow-hidden" style={{ minHeight: 380 }}>

          {/* Table top bar */}
          <div className="px-4 py-3 flex items-center justify-between flex-shrink-0"
            style={{ borderBottom: '1px solid var(--divider)' }}>
            <div className="flex items-center gap-2.5">
              <UserCheck size={14} style={{ color: accentColor }}/>
              <span className="text-sm font-bold" style={{ color: 'var(--t1)' }}>
                Lista de asistencia
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
            {scannedLog.length === 0 ? (
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
                : 'Esperando escaneos…'}
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
