import { useState, useEffect, useRef, useCallback } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import * as XLSX from 'xlsx'
import { getEvalsByStudent, getLastSimulacro } from '../../data/mockData'
import { fetchGroups, fetchStudents } from '../../lib/supabaseData'
import { loadSettings } from '../../lib/settings'
import {
  todayISO, remainingSeconds, loadSessionDb, saveSessionDb, deleteSessionDb, fetchSessionIndex,
} from '../../lib/attendanceDb'
import GroupShaderCard from '../../components/ui/GroupShaderCard'
import { useGroupColors } from '../../hooks/useGroupColors'
import {
  ArrowLeft, Camera, CameraOff, QrCode, CheckCircle2,
  FileSpreadsheet, Users, Clock, AlertTriangle, Scan,
  ChevronRight, UserCheck, CheckSquare, RotateCw,
  Timer, Pause, Play, History, FolderClock, ChevronUp, ChevronDown,
} from 'lucide-react'

const QR_PREFIX   = 'EDUTRACK:'
const DEBOUNCE_MS = 3000

const fmtMMSS = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
const fmtDate = iso => new Date(`${iso}T00:00:00`).toLocaleDateString('es-MX', { day:'2-digit', month:'long', year:'numeric' })
const TOL_PRESETS = [5, 10, 15, 20]

export default function Attendance() {
  const { getAccent } = useGroupColors()

  const [groups,         setGroups]        = useState([])
  const [students,       setStudents]      = useState([])
  const [sessionIndex,   setSessionIndex]  = useState([])  // sesiones guardadas en BD (todas, con registros)
  const [view,           setView]          = useState('pick')  // 'pick' | 'scan'
  const [selectedGrp,    setSelectedGrp]   = useState(null)
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

  // Carga inicial desde Supabase: grupos, alumnos e historial de listas.
  useEffect(() => {
    Promise.all([fetchGroups(), fetchStudents(), fetchSessionIndex()])
      .then(([gs, ss, idx]) => { setGroups(gs); setStudents(ss); setSessionIndex(idx) })
      .catch(() => {})
  }, [])

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
  const accentColor   = selectedGrp ? getAccent(selectedGrp) : '#3b82f6'

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
    const t = setTimeout(() => {
      saveSessionDb(
        selectedGrp, selectedDate,
        { tolMin, startedAt, pausedAt, pausedAccumMs, finished },
        scannedLog.map(e => ({ studentId: e.student.id, time: e.time, retardo: !!retardos[e.student.id] })),
      ).catch(() => {})
    }, 800)
    return () => clearTimeout(t)
  }, [scannedLog, retardos, tolMin, startedAt, pausedAt, pausedAccumMs, finished, selectedGrp, selectedDate])

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
    resetTimerState()
  }

  const handleFinish = () => setShowConfirm(true)
  const handleConfirmFinish = () => {
    exportExcel()
    // Se guarda explícitamente como finalizada (queda en el historial, no se borra)
    saveSessionDb(
      selectedGrp, selectedDate,
      { tolMin, startedAt, pausedAt, pausedAccumMs, finished: true },
      buildRecords(),
    ).then(refreshIndex).catch(() => {})
    goBack(true)
  }

  /* ── Excel export ───────────────────────────────────────────── */
  const lastEvalOf = (sid) => {
    const evs = getEvalsByStudent(sid).sort((a, b) => b.fecha.localeCompare(a.fecha))
    return evs[0] ?? null
  }

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

  /* ══════════════════════════════════════════════════════════════
     VIEW: GROUP PICKER
  ══════════════════════════════════════════════════════════════ */
  if (view === 'pick') {
    return (
      <div className="w-full space-y-6">
        <div>
          <h1 className="page-title">Pasar Lista</h1>
          <p className="text-sm mt-1" style={{ color:'rgba(255,255,255,.38)' }}>
            Selecciona el grupo para comenzar a registrar asistencia.
          </p>
        </div>

        <div className="grid gap-3 sm:gap-4">
          {groups.map(g => {
            const count = students.filter(s => s.groupId === g.id).length
            const hasHistory = sessionIndex.some(s => s.groupId === g.id)
            return (
              <GroupShaderCard
                key={g.id} group={g} onClick={() => selectGroup(g.id)} showPicker
                footer={hasHistory && (
                  <button
                    onClick={() => openHistory(g.id)}
                    className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-all active:scale-95"
                    style={{ background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.10)', color:'rgba(255,255,255,.55)' }}
                    onMouseEnter={e => { e.currentTarget.style.background='rgba(255,255,255,.12)'; e.currentTarget.style.color='white' }}
                    onMouseLeave={e => { e.currentTarget.style.background='rgba(255,255,255,.06)'; e.currentTarget.style.color='rgba(255,255,255,.55)' }}>
                    <FolderClock size={13}/> Ver historial de listas
                  </button>
                )}>
                <div>
                  <p className="font-bold text-base" style={{ color:'rgba(255,255,255,.90)' }}>{g.name}</p>
                  <p className="text-sm" style={{ color:'rgba(255,255,255,.45)' }}>{g.subject}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1.5 text-xs" style={{ color:'rgba(255,255,255,.32)' }}>
                    <span className="flex items-center gap-1"><Users size={11}/>{count} alumnos</span>
                    <span className="hidden sm:flex items-center gap-1"><Clock size={11}/>{g.schedule}</span>
                  </div>
                </div>
              </GroupShaderCard>
            )
          })}
        </div>

        {/* ── Modal: historial de listas ── */}
        {showHistoryModal && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
            style={{ background:'rgba(0,0,0,.65)', backdropFilter:'blur(6px)' }}
            onClick={() => setShowHistoryModal(false)}>
            <div className="w-full max-w-md rounded-2xl p-6 space-y-4 animate-scale-in max-h-[80vh] overflow-y-auto"
              style={{ background:'#0f1020', border:'1px solid rgba(255,255,255,.12)', boxShadow:'0 24px 72px rgba(0,0,0,.70)' }}
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background:'rgba(255,255,255,.08)', border:'1px solid rgba(255,255,255,.14)' }}>
                  <History size={18} style={{ color:'rgba(255,255,255,.70)' }}/>
                </div>
                <div>
                  <h2 className="text-base font-bold" style={{ color:'rgba(255,255,255,.92)' }}>
                    Historial — {groups.find(g => g.id === historyGroupId)?.name}
                  </h2>
                  <p className="text-xs" style={{ color:'rgba(255,255,255,.40)' }}>
                    Retoma cualquier lista para editarla o agregar alumnos.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                {sessionIndex.filter(s => s.groupId === historyGroupId).map(s => (
                  <button key={s.date} onClick={() => applySession(toUiSession(s))}
                    className="w-full flex items-center justify-between gap-3 p-3 rounded-xl text-left transition-all active:scale-[.98]"
                    style={{ background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.08)' }}
                    onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,.09)'}
                    onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,.05)'}>
                    <div>
                      <p className="text-sm font-semibold" style={{ color:'rgba(255,255,255,.85)' }}>{fmtDate(s.date)}</p>
                      <p className="text-xs mt-0.5" style={{ color:'rgba(255,255,255,.40)' }}>
                        {s.records.length} presentes
                        {s.records.filter(r => r.retardo).length > 0 &&
                          ` · ${s.records.filter(r => r.retardo).length} retardos`}
                      </p>
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full flex-shrink-0"
                      style={s.finished
                        ? { background:'rgba(16,185,129,.14)', color:'#10b981', border:'1px solid rgba(16,185,129,.28)' }
                        : { background:'rgba(251,191,36,.14)', color:'#fbbf24', border:'1px solid rgba(251,191,36,.28)' }}>
                      {s.finished ? 'Finalizada' : 'Borrador'}
                    </span>
                  </button>
                ))}
              </div>

              <button onClick={() => setShowHistoryModal(false)}
                className="w-full py-2.5 rounded-xl text-sm font-semibold"
                style={{ background:'rgba(255,255,255,.07)', color:'rgba(255,255,255,.60)' }}>
                Cerrar
              </button>
            </div>
          </div>
        )}
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
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background:'rgba(0,0,0,.65)', backdropFilter:'blur(6px)' }}>
      <div className="w-full max-w-sm rounded-2xl p-6 space-y-4 animate-scale-in"
        style={{ background:'#0f1020', border:'1px solid rgba(255,255,255,.12)', boxShadow:'0 24px 72px rgba(0,0,0,.70)' }}>
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center mx-auto"
          style={{ background:'rgba(251,191,36,.12)', border:'1px solid rgba(251,191,36,.25)' }}>
          <RotateCw size={20} style={{ color:'#fbbf24' }}/>
        </div>
        <div className="text-center">
          <h2 className="text-base font-bold mb-1" style={{ color:'rgba(255,255,255,.92)' }}>
            Lista guardada encontrada
          </h2>
          <p className="text-sm leading-relaxed" style={{ color:'rgba(255,255,255,.50)' }}>
            Tienes una lista del día de hoy con{' '}
            <strong style={{ color:'#10b981' }}>{resumeSession.log.length} alumnos</strong>
            {' '}escaneados{resumeSession.finished ? ' (finalizada)' : ''}. ¿Deseas continuar donde te quedaste?
          </p>
        </div>
        <div className="space-y-2">
          <button onClick={() => applySession(resumeSession)}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold"
            style={{ background:'white', color:'black' }}>
            <RotateCw size={13}/> Continuar lista
          </button>
          <button onClick={() => {
            deleteSessionDb(selectedGrp, selectedDate).then(refreshIndex).catch(() => {})
            setScannedLog([])
            setRetardos({})
            setFinished(false)
            setResumeSession(null)
            setTolInput(String(loadSettings().toleranciaMin))
            setShowTolModal(true)
          }} className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{ background:'rgba(255,255,255,.07)', color:'rgba(255,255,255,.60)' }}>
            Empezar de nuevo
          </button>
        </div>
      </div>
    </div>
  )

  /* ── Leave session modal ──────────────────────────────────── */
  const LeaveModal = showLeaveModal && (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background:'rgba(0,0,0,.65)', backdropFilter:'blur(6px)' }}>
      <div className="w-full max-w-sm rounded-2xl p-6 space-y-4 animate-scale-in"
        style={{ background:'#0f1020', border:'1px solid rgba(255,255,255,.12)', boxShadow:'0 24px 72px rgba(0,0,0,.70)' }}>
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center mx-auto"
          style={{ background:'rgba(251,191,36,.12)', border:'1px solid rgba(251,191,36,.25)' }}>
          <AlertTriangle size={20} style={{ color:'#fbbf24' }}/>
        </div>
        <div className="text-center">
          <h2 className="text-base font-bold mb-1" style={{ color:'rgba(255,255,255,.92)' }}>
            Pase de lista en progreso
          </h2>
          <p className="text-sm leading-relaxed" style={{ color:'rgba(255,255,255,.50)' }}>
            Tienes <strong style={{ color:'#10b981' }}>{scannedLog.length} alumnos</strong> registrados.
            Si sales ahora, la lista se guardará en el historial y podrás continuar al regresar.
          </p>
        </div>
        <div className="space-y-2">
          <button onClick={() => {
            saveSessionDb(
              selectedGrp, selectedDate,
              { tolMin, startedAt, pausedAt, pausedAccumMs, finished },
              buildRecords(),
            ).then(refreshIndex).catch(() => {})
            goBack(true)
          }} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold"
            style={{ background:'white', color:'black' }}>
            Guardar borrador y salir
          </button>
          <button onClick={() => { deleteSessionDb(selectedGrp, selectedDate).then(refreshIndex).catch(() => {}); goBack(true) }}
            className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{ background:'rgba(248,113,113,.12)', border:'1px solid rgba(248,113,113,.25)', color:'#f87171' }}>
            Salir sin guardar
          </button>
          <button onClick={() => setShowLeaveModal(false)}
            className="w-full py-2.5 rounded-xl text-sm font-semibold"
            style={{ background:'rgba(255,255,255,.07)', color:'rgba(255,255,255,.60)' }}>
            Seguir pasando lista
          </button>
        </div>
      </div>
    </div>
  )

  /* ── Confirm finish modal ─────────────────────────────────── */
  const ConfirmModal = showConfirm && (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background:'rgba(0,0,0,.65)', backdropFilter:'blur(6px)', WebkitBackdropFilter:'blur(6px)' }}
      onClick={() => setShowConfirm(false)}>
      <div
        className="w-full max-w-sm rounded-2xl p-6 animate-scale-in"
        style={{ background:'#0f1020', border:'1px solid rgba(255,255,255,.12)', boxShadow:'0 24px 72px rgba(0,0,0,.70)' }}
        onClick={e => e.stopPropagation()}>

        {/* Icon */}
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4"
          style={{ background:'rgba(251,191,36,.12)', border:'1px solid rgba(251,191,36,.25)' }}>
          <AlertTriangle size={22} style={{ color:'#fbbf24' }}/>
        </div>

        {/* Copy */}
        <h2 className="text-base font-bold text-center mb-2" style={{ color:'rgba(255,255,255,.92)' }}>
          ¿Terminar pase de lista?
        </h2>
        <p className="text-sm text-center leading-relaxed mb-1" style={{ color:'rgba(255,255,255,.50)' }}>
          La lista quedará en el <span style={{ color:'rgba(255,255,255,.80)', fontWeight:600 }}>historial</span>{' '}
          — podrás reabrirla después desde "Ver historial de listas" para ajustar retardos o agregar alumnos.
        </p>

        {/* Summary */}
        <div className="mt-4 mb-5 rounded-xl p-3 flex items-center justify-around"
          style={{ background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.07)' }}>
          <div className="text-center">
            <p className="text-lg font-bold" style={{ color:'#10b981' }}>{presentCount}</p>
            <p className="text-[11px]" style={{ color:'rgba(255,255,255,.35)' }}>Presentes</p>
          </div>
          <div className="w-px h-8" style={{ background:'rgba(255,255,255,.08)' }}/>
          <div className="text-center">
            <p className="text-lg font-bold" style={{ color:'rgba(255,255,255,.40)' }}>{absentCount}</p>
            <p className="text-[11px]" style={{ color:'rgba(255,255,255,.35)' }}>Ausentes</p>
          </div>
          <div className="w-px h-8" style={{ background:'rgba(255,255,255,.08)' }}/>
          <div className="text-center">
            <p className="text-lg font-bold" style={{ color: accentColor }}>{totalCount}</p>
            <p className="text-[11px]" style={{ color:'rgba(255,255,255,.35)' }}>Total</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={() => setShowConfirm(false)}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{ background:'rgba(255,255,255,.07)', border:'1px solid rgba(255,255,255,.12)', color:'rgba(255,255,255,.70)' }}
            onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,.12)'}
            onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,.07)'}>
            Cancelar
          </button>
          <button
            onClick={handleConfirmFinish}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2"
            style={{ background:'white', color:'black' }}
            onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,.88)'}
            onMouseLeave={e => e.currentTarget.style.background='white'}>
            <CheckSquare size={14}/> Confirmar
          </button>
        </div>
      </div>
    </div>
  )

  /* ── Tolerance modal (pop-up antes de comenzar) ─────────── */
  const ToleranceModal = showTolModal && !resumeSession && (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background:'rgba(0,0,0,.65)', backdropFilter:'blur(6px)' }}>
      <div className="w-full max-w-sm rounded-2xl p-6 space-y-4 animate-scale-in"
        style={{ background:'#0f1020', border:'1px solid rgba(255,255,255,.12)', boxShadow:'0 24px 72px rgba(0,0,0,.70)' }}>
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center mx-auto"
          style={{ background:`${accentColor}1f`, border:`1px solid ${accentColor}44` }}>
          <Timer size={20} style={{ color: accentColor }}/>
        </div>
        <div className="text-center">
          <h2 className="text-base font-bold mb-1" style={{ color:'rgba(255,255,255,.92)' }}>
            Tolerancia de llegada
          </h2>
          <p className="text-sm leading-relaxed" style={{ color:'rgba(255,255,255,.50)' }}>
            Define los minutos de tolerancia para <strong style={{ color:'rgba(255,255,255,.80)' }}>{grp?.name}</strong>.
            Al vencer, los alumnos que se registren quedarán marcados con{' '}
            <strong style={{ color:'#fbbf24' }}>retardo</strong> automáticamente.
          </p>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {TOL_PRESETS.map(m => (
            <button key={m} onClick={() => setTolInput(String(m))}
              className="py-2 rounded-xl text-sm font-bold transition-all"
              style={String(m) === tolInput
                ? { background:'white', color:'black' }
                : { background:'rgba(255,255,255,.07)', border:'1px solid rgba(255,255,255,.10)', color:'rgba(255,255,255,.60)' }}>
              {m} min
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 rounded-xl pl-3 pr-1.5 py-1.5"
          style={{ background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.10)' }}>
          <Clock size={14} style={{ color:'rgba(255,255,255,.35)' }}/>
          <input type="number" min="1" max="120" value={tolInput}
            onChange={e => setTolInput(e.target.value)}
            className="flex-1 min-w-0 bg-transparent py-1 px-2 text-sm font-semibold outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            style={{ color:'rgba(255,255,255,.85)' }}/>
          <span className="text-xs flex-shrink-0" style={{ color:'rgba(255,255,255,.35)' }}>min</span>
          <div className="flex flex-col flex-shrink-0 rounded-lg overflow-hidden"
            style={{ border:'1px solid rgba(255,255,255,.12)' }}>
            <button type="button" aria-label="Sumar un minuto"
              onClick={() => setTolInput(String(Math.min(120, (parseInt(tolInput, 10) || 0) + 1)))}
              className="w-6 h-4 flex items-center justify-center transition-colors"
              style={{ background:'rgba(255,255,255,.08)', color:'rgba(255,255,255,.65)', borderBottom:'1px solid rgba(255,255,255,.12)' }}
              onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,.16)'}
              onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,.08)'}>
              <ChevronUp size={11}/>
            </button>
            <button type="button" aria-label="Restar un minuto"
              onClick={() => setTolInput(String(Math.max(1, (parseInt(tolInput, 10) || 0) - 1)))}
              className="w-6 h-4 flex items-center justify-center transition-colors"
              style={{ background:'rgba(255,255,255,.08)', color:'rgba(255,255,255,.65)' }}
              onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,.16)'}
              onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,.08)'}>
              <ChevronDown size={11}/>
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <button onClick={() => {
            const m = parseInt(tolInput, 10)
            if (!isNaN(m) && m > 0) startTolerance(Math.min(m, 120))
          }} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold"
            style={{ background:'white', color:'black' }}>
            <Play size={13}/> Comenzar pase de lista
          </button>
          <button onClick={() => startTolerance(null)}
            className="w-full py-2 text-xs font-semibold transition-colors"
            style={{ color:'rgba(255,255,255,.35)' }}
            onMouseEnter={e => e.currentTarget.style.color='rgba(255,255,255,.60)'}
            onMouseLeave={e => e.currentTarget.style.color='rgba(255,255,255,.35)'}>
            Continuar sin cronómetro
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="w-full space-y-4">

      {/* ── Breadcrumb ─────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={() => goBack()}
          className="flex items-center gap-1.5 text-sm font-medium transition-colors"
          style={{ color:'rgba(255,255,255,.40)' }}
          onMouseEnter={e => e.currentTarget.style.color='rgba(255,255,255,.85)'}
          onMouseLeave={e => e.currentTarget.style.color='rgba(255,255,255,.40)'}>
          <ArrowLeft size={15}/> Pasar Lista
        </button>
        <ChevronRight size={12} style={{ color:'rgba(255,255,255,.20)' }}/>
        <span className="text-sm font-semibold" style={{ color: accentColor }}>
          {grp?.sucursal ? `${grp.sucursal} - ${grp.name}` : grp?.name}
        </span>
        <span className="text-xs hidden sm:inline" style={{ color:'rgba(255,255,255,.28)' }}>· {grp?.subject}</span>
        {finished && (
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
            style={{ background:'rgba(16,185,129,.14)', color:'#10b981', border:'1px solid rgba(16,185,129,.28)' }}>
            Reabierta desde historial
          </span>
        )}
        <button onClick={() => openHistory(selectedGrp)}
          className="ml-auto flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-all"
          style={{ background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.10)', color:'rgba(255,255,255,.55)' }}
          onMouseEnter={e => { e.currentTarget.style.background='rgba(255,255,255,.12)'; e.currentTarget.style.color='white' }}
          onMouseLeave={e => { e.currentTarget.style.background='rgba(255,255,255,.06)'; e.currentTarget.style.color='rgba(255,255,255,.55)' }}>
          <History size={13}/> Ver historial
        </button>
      </div>

      {/* ── Progress KPI bar ───────────────────────────────── */}
      <div className="card px-5 py-4">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
          <div className="flex items-center flex-wrap gap-3 sm:gap-5">
            {[
              { label:'Presentes',      value: presentCount, color:'#10b981' },
              { label:'Retardos',       value: retardoCount, color:'#fbbf24' },
              { label:'Sin escanear',   value: absentCount,  color:'rgba(255,255,255,.38)' },
              { label:'Total',          value: totalCount,   color: accentColor },
            ].map((k, i) => (
              <div key={k.label} className="flex items-center gap-3 sm:gap-5">
                {i > 0 && <div className="hidden sm:block w-px h-7" style={{ background:'rgba(255,255,255,.08)' }}/>}
                <div className="text-center">
                  <p className="text-2xl font-bold leading-none tabular-nums" style={{ color: k.color }}>{k.value}</p>
                  <p className="text-[11px] mt-0.5" style={{ color:'rgba(255,255,255,.33)' }}>{k.label}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-3">
            {tolMin !== null && remainingSec !== null && (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono text-sm font-bold tabular-nums"
                  style={tolExpired
                    ? { background:'rgba(239,68,68,.14)',  border:'1px solid rgba(239,68,68,.30)',  color:'#f87171' }
                    : timerPaused
                      ? { background:'rgba(251,191,36,.12)', border:'1px solid rgba(251,191,36,.28)', color:'#fbbf24' }
                      : { background:'rgba(16,185,129,.10)', border:'1px solid rgba(16,185,129,.25)', color:'#10b981' }}>
                  <Timer size={13}/>
                  {tolExpired ? 'Tolerancia vencida' : fmtMMSS(remainingSec)}
                </div>
                {!tolExpired && (
                  <button onClick={togglePause}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95"
                    style={{ background:'rgba(255,255,255,.07)', border:'1px solid rgba(255,255,255,.12)', color:'rgba(255,255,255,.70)' }}
                    onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,.12)'}
                    onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,.07)'}>
                    {timerPaused ? <><Play size={12}/> Reanudar</> : <><Pause size={12}/> Pausar</>}
                  </button>
                )}
              </div>
            )}
            <div className="text-right hidden sm:block">
              <p className="text-2xl font-bold tabular-nums" style={{ color: accentColor }}>{pct}%</p>
              <p className="text-[11px]" style={{ color:'rgba(255,255,255,.33)' }}>completado</p>
            </div>
          </div>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background:'rgba(255,255,255,.07)' }}>
          <div className="h-full rounded-full transition-all duration-700 ease-out"
            style={{ width:`${pct}%`, background:`linear-gradient(90deg, #10b981, ${accentColor})` }}/>
        </div>
      </div>

      {/* ── Main layout ────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* ── Camera column (lg: 2/5) ─────────────────────── */}
        <div className="lg:col-span-2 space-y-3">

          {/* Camera card */}
          <div className="card overflow-hidden relative" style={{
            outline: flashGreen ? '2px solid #10b981' : '2px solid transparent',
            transition: 'outline-color .25s ease',
          }}>
            {/* Success flash */}
            <div className="absolute inset-0 z-20 pointer-events-none transition-opacity duration-300"
              style={{ background:'#10b981', opacity: flashGreen ? 0.13 : 0 }}/>

            {/* Html5Qrcode mount point */}
            <div id="qr-reader" className="w-full" style={{ minHeight: 280 }}/>

            {/* Idle overlay */}
            {!scanning && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center"
                style={{ background:'#0a0a14', minHeight: 280 }}>
                {camError ? (
                  <div className="text-center px-8 space-y-3">
                    <AlertTriangle size={32} className="mx-auto" style={{ color:'#f87171' }}/>
                    <div>
                      <p className="text-sm font-semibold" style={{ color:'rgba(255,255,255,.80)' }}>
                        Error de cámara
                      </p>
                      <p className="text-xs mt-1" style={{ color:'rgba(255,255,255,.42)' }}>{camError}</p>
                    </div>
                    <button onClick={startScanner} className="btn-primary text-xs py-2 px-4">
                      Reintentar
                    </button>
                  </div>
                ) : (
                  <div className="text-center px-8">
                    {/* Animated scan frame */}
                    <div className="relative w-28 h-28 mx-auto mb-4">
                      <div className="absolute inset-0 rounded-2xl"
                        style={{ border:'1.5px dashed rgba(255,255,255,.10)' }}/>
                      <span className="absolute top-0 left-0 w-7 h-7 rounded-tl-2xl"
                        style={{ borderTop:`2px solid ${accentColor}`, borderLeft:`2px solid ${accentColor}` }}/>
                      <span className="absolute top-0 right-0 w-7 h-7 rounded-tr-2xl"
                        style={{ borderTop:`2px solid ${accentColor}`, borderRight:`2px solid ${accentColor}` }}/>
                      <span className="absolute bottom-0 left-0 w-7 h-7 rounded-bl-2xl"
                        style={{ borderBottom:`2px solid ${accentColor}`, borderLeft:`2px solid ${accentColor}` }}/>
                      <span className="absolute bottom-0 right-0 w-7 h-7 rounded-br-2xl"
                        style={{ borderBottom:`2px solid ${accentColor}`, borderRight:`2px solid ${accentColor}` }}/>
                      <QrCode size={28} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                        style={{ color:'rgba(255,255,255,.16)' }}/>
                    </div>
                    <p className="text-sm font-semibold" style={{ color:'rgba(255,255,255,.55)' }}>
                      Cámara inactiva
                    </p>
                    <p className="text-xs mt-1" style={{ color:'rgba(255,255,255,.28)' }}>
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
                  style={{ background:'rgba(0,0,0,.68)', backdropFilter:'blur(8px)', color:'rgba(255,255,255,.85)' }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"/>
                  Escaneando…
                </div>
              </div>
            )}
          </div>

          {/* Toggle button */}
          {!scanning ? (
            <button onClick={startScanner} className="btn-primary w-full justify-center">
              <Camera size={15}/> Activar cámara
            </button>
          ) : (
            <button onClick={stopScanner}
              className="w-full flex items-center justify-center gap-2 rounded-xl font-semibold text-sm py-2.5 transition-all"
              style={{ background:'rgba(239,68,68,.12)', border:'1px solid rgba(239,68,68,.22)', color:'#f87171' }}
              onMouseEnter={e => e.currentTarget.style.background='rgba(239,68,68,.20)'}
              onMouseLeave={e => e.currentTarget.style.background='rgba(239,68,68,.12)'}>
              <CameraOff size={15}/> Pausar escaneo
            </button>
          )}

          {/* Last scanned banner */}
          {lastScanned && (
            <div className="card p-3 animate-fade-in" style={{ borderLeft:`3px solid #10b981` }}>
              <div className="flex items-center gap-2.5">
                <CheckCircle2 size={16} className="flex-shrink-0" style={{ color:'#10b981' }}/>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color:'#10b981' }}>
                    Último escaneado
                  </p>
                  <p className="text-sm font-bold truncate" style={{ color:'rgba(255,255,255,.88)' }}>
                    {lastScanned.student.name}
                  </p>
                </div>
                <span className="font-mono text-xs flex-shrink-0" style={{ color:'rgba(255,255,255,.42)' }}>
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
            style={{ borderBottom:'1px solid rgba(255,255,255,.07)' }}>
            <div className="flex items-center gap-2.5">
              <UserCheck size={14} style={{ color: accentColor }}/>
              <span className="text-sm font-bold" style={{ color:'rgba(255,255,255,.85)' }}>
                Lista de asistencia
              </span>
              {presentCount > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                  style={{ background:'rgba(16,185,129,.15)', color:'#10b981' }}>
                  {presentCount}
                </span>
              )}
            </div>
            <span className="text-xs" style={{ color:'rgba(255,255,255,.26)' }}>{dateLabel}</span>
          </div>

          {/* Table body */}
          <div ref={tableScrollRef} className="flex-1 overflow-y-auto">
            {scannedLog.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-16 px-6 text-center">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                  style={{ background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.07)' }}>
                  <Scan size={22} style={{ color:'rgba(255,255,255,.16)' }}/>
                </div>
                <p className="text-sm font-semibold" style={{ color:'rgba(255,255,255,.36)' }}>
                  Sin registros aún
                </p>
                <p className="text-xs mt-1.5 leading-relaxed" style={{ color:'rgba(255,255,255,.20)' }}>
                  Activa la cámara y escanea el QR de<br/>cada alumno para registrarlo aquí
                </p>
              </div>
            ) : (
              <div className="w-full overflow-x-auto">
              <table className="w-full min-w-[420px]">
                <thead>
                  <tr style={{ borderBottom:'1px solid rgba(255,255,255,.06)' }}>
                    <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest w-10"
                      style={{ color:'rgba(255,255,255,.24)' }}>#</th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest"
                      style={{ color:'rgba(255,255,255,.24)' }}>Nombre del Alumno</th>
                    <th className="pr-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-widest"
                      style={{ color:'rgba(255,255,255,.24)' }}>Hora de llegada</th>
                    <th className="pr-4 py-2.5 text-center text-[10px] font-bold uppercase tracking-widest w-20"
                      style={{ color:'rgba(255,255,255,.24)' }}>Retardo</th>
                  </tr>
                </thead>
                <tbody>
                  {scannedLog.map((entry, i) => (
                    <tr key={entry.student.id}
                      className="transition-colors animate-fade-in"
                      style={{ borderBottom:'1px solid rgba(255,255,255,.04)' }}
                      onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,.03)'}
                      onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                      <td className="px-4 py-3">
                        <span className="font-mono text-[11px] tabular-nums" style={{ color:'rgba(255,255,255,.28)' }}>
                          {String(i + 1).padStart(2, '0')}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                            style={{ background:'rgba(16,185,129,.15)', color:'#10b981' }}>
                            {entry.student.name.split(' ').slice(0, 2).map(n => n[0]).join('')}
                          </div>
                          <span className="text-sm font-medium truncate" style={{ color:'rgba(255,255,255,.85)' }}>
                            {entry.student.name}
                          </span>
                        </div>
                      </td>
                      <td className="pr-4 py-3 text-right">
                        <span className="font-mono text-xs font-semibold tabular-nums"
                          style={{ color: retardos[entry.student.id] ? '#fbbf24' : 'rgba(255,255,255,.48)' }}>
                          {entry.time}
                        </span>
                      </td>
                      <td className="pr-4 py-3 text-center">
                        <button onClick={() => toggleRetardo(entry.student.id)}
                          role="switch" aria-checked={!!retardos[entry.student.id]}
                          title={retardos[entry.student.id] ? 'Con retardo — clic para quitar' : 'Marcar retardo'}
                          className="relative inline-flex w-9 h-5 rounded-full transition-colors duration-200 align-middle"
                          style={{ background: retardos[entry.student.id] ? '#f59e0b' : 'rgba(255,255,255,.13)' }}>
                          <span className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-200"
                            style={{ transform: retardos[entry.student.id] ? 'translateX(16px)' : 'translateX(0)' }}/>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </div>

          {/* Footer: export + finish */}
          <div className="px-4 py-3 flex items-center justify-between gap-3 flex-shrink-0"
            style={{ borderTop:'1px solid rgba(255,255,255,.07)', background:'rgba(255,255,255,.02)' }}>
            <p className="text-xs" style={{ color:'rgba(255,255,255,.36)' }}>
              {scannedLog.length > 0
                ? `${presentCount} de ${totalCount} alumnos registrados`
                : 'Esperando escaneos…'}
            </p>
            <div className="flex items-center gap-2">
              {scannedLog.length > 0 && (
                <button onClick={exportExcel}
                  className="flex items-center gap-2 text-sm font-semibold px-3 py-2 rounded-xl transition-all active:scale-95"
                  style={{ background:'rgba(16,185,129,.12)', border:'1px solid rgba(16,185,129,.25)', color:'#10b981' }}
                  onMouseEnter={e => e.currentTarget.style.background='rgba(16,185,129,.22)'}
                  onMouseLeave={e => e.currentTarget.style.background='rgba(16,185,129,.12)'}>
                  <FileSpreadsheet size={13}/>
                  <span className="hidden sm:inline">Excel</span>
                </button>
              )}
              <button onClick={handleFinish}
                className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl transition-all active:scale-95"
                style={{ background:'rgba(255,255,255,.09)', border:'1px solid rgba(255,255,255,.16)', color:'rgba(255,255,255,.80)' }}
                onMouseEnter={e => { e.currentTarget.style.background='rgba(255,255,255,.13)'; e.currentTarget.style.color='white' }}
                onMouseLeave={e => { e.currentTarget.style.background='rgba(255,255,255,.09)'; e.currentTarget.style.color='rgba(255,255,255,.80)' }}>
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

      {/* ── Modal: historial de listas (accesible también desde la vista de escaneo) ── */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          style={{ background:'rgba(0,0,0,.65)', backdropFilter:'blur(6px)' }}
          onClick={() => setShowHistoryModal(false)}>
          <div className="w-full max-w-md rounded-2xl p-6 space-y-4 animate-scale-in max-h-[80vh] overflow-y-auto"
            style={{ background:'#0f1020', border:'1px solid rgba(255,255,255,.12)', boxShadow:'0 24px 72px rgba(0,0,0,.70)' }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background:'rgba(255,255,255,.08)', border:'1px solid rgba(255,255,255,.14)' }}>
                <History size={18} style={{ color:'rgba(255,255,255,.70)' }}/>
              </div>
              <div>
                <h2 className="text-base font-bold" style={{ color:'rgba(255,255,255,.92)' }}>
                  Historial — {groups.find(g => g.id === historyGroupId)?.name}
                </h2>
                <p className="text-xs" style={{ color:'rgba(255,255,255,.40)' }}>
                  Retoma cualquier lista para editarla o agregar alumnos.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              {sessionIndex.filter(s => s.groupId === historyGroupId).map(s => (
                <button key={s.date} onClick={() => applySession(toUiSession(s))}
                  className="w-full flex items-center justify-between gap-3 p-3 rounded-xl text-left transition-all active:scale-[.98]"
                  style={{
                    background: s.date === selectedDate ? `${accentColor}1a` : 'rgba(255,255,255,.05)',
                    border: s.date === selectedDate ? `1px solid ${accentColor}55` : '1px solid rgba(255,255,255,.08)',
                  }}>
                  <div>
                    <p className="text-sm font-semibold" style={{ color:'rgba(255,255,255,.85)' }}>{fmtDate(s.date)}</p>
                    <p className="text-xs mt-0.5" style={{ color:'rgba(255,255,255,.40)' }}>
                      {s.records.length} presentes
                      {s.records.filter(r => r.retardo).length > 0 &&
                        ` · ${s.records.filter(r => r.retardo).length} retardos`}
                    </p>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full flex-shrink-0"
                    style={s.finished
                      ? { background:'rgba(16,185,129,.14)', color:'#10b981', border:'1px solid rgba(16,185,129,.28)' }
                      : { background:'rgba(251,191,36,.14)', color:'#fbbf24', border:'1px solid rgba(251,191,36,.28)' }}>
                    {s.finished ? 'Finalizada' : 'Borrador'}
                  </span>
                </button>
              ))}
            </div>

            <button onClick={() => setShowHistoryModal(false)}
              className="w-full py-2.5 rounded-xl text-sm font-semibold"
              style={{ background:'rgba(255,255,255,.07)', color:'rgba(255,255,255,.60)' }}>
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
