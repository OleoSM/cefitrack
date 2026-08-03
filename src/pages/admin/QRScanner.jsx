import { useEffect, useRef, useState, useCallback } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { useNavigate } from 'react-router-dom'
import {
  QrCode, Camera, CameraOff, CheckCircle, AlertTriangle,
  ArrowLeft, Users, Clock, Trash2, ChevronDown
} from 'lucide-react'
import { attendanceColors } from '../../data/mockData'
import { fetchStudents, fetchGroups } from '../../lib/supabaseData'
import clsx from 'clsx'

const QR_PREFIX = 'EDUTRACK:'
const DEBOUNCE_MS = 3500

export default function QRScanner() {
  const navigate  = useNavigate()
  const qrRef     = useRef(null)    // Html5Qrcode instance
  const recentRef = useRef(new Set()) // debounce set

  const [scanning,    setScanning]    = useState(false)
  const [camError,    setCamError]    = useState('')
  const [groupFilter, setGroupFilter] = useState('all')
  const [lastScanned, setLastScanned] = useState(null) // { student, time }
  const [scannedLog,  setScannedLog]  = useState([])   // accumulated list
  const [flashGreen,  setFlashGreen]  = useState(false)
  const [students,    setStudents]    = useState([])
  const [groups,      setGroups]      = useState([])

  // El padrón se lee de la BD: un alumno dado de alta hoy debe poder escanear hoy.
  const studentsRef = useRef(students)
  useEffect(() => { studentsRef.current = students }, [students])

  useEffect(() => {
    Promise.all([fetchStudents(), fetchGroups()])
      .then(([sts, grs]) => { setStudents(sts); setGroups(grs) })
      .catch(() => {})
  }, [])

  /* ── helpers ───────────────────────────────────────────────── */
  const flashSuccess = () => {
    setFlashGreen(true)
    setTimeout(() => setFlashGreen(false), 800)
  }

  const handleDecode = useCallback((raw) => {
    if (!raw.startsWith(QR_PREFIX)) return
    const studentId = raw.slice(QR_PREFIX.length)

    // debounce same student
    if (recentRef.current.has(studentId)) return
    recentRef.current.add(studentId)
    setTimeout(() => recentRef.current.delete(studentId), DEBOUNCE_MS)

    const s = studentsRef.current.find(st => st.id === studentId)
    if (!s) return

    // optional group filter
    if (groupFilter !== 'all' && s.groupId !== groupFilter) return

    const time = new Date().toLocaleTimeString('es-MX', { hour:'2-digit', minute:'2-digit' })
    setLastScanned({ student: s, time })
    setScannedLog(prev =>
      prev.find(e => e.student.id === s.id) ? prev : [{ student: s, time }, ...prev]
    )
    flashSuccess()
  }, [groupFilter])

  /* ── start / stop ────────────────────────────────────────── */
  const startScanner = useCallback(async () => {
    if (qrRef.current) return
    setCamError('')
    try {
      const qr = new Html5Qrcode('qr-video-container')
      qrRef.current = qr
      await qr.start(
        { facingMode: 'environment' },
        { fps: 12, qrbox: { width: 240, height: 240 }, aspectRatio: 1 },
        handleDecode,
        () => {}   // silent errors
      )
      setScanning(true)
    } catch {
      setCamError('No se pudo acceder a la cámara. Verifica los permisos en tu navegador.')
      qrRef.current = null
    }
  }, [handleDecode])

  const stopScanner = useCallback(async () => {
    if (!qrRef.current) return
    await qrRef.current.stop().catch(() => {})
    qrRef.current = null
    setScanning(false)
  }, [])

  // cleanup on unmount
  useEffect(() => {
    return () => {
      if (qrRef.current) { qrRef.current.stop().catch(() => {}); qrRef.current = null }
    }
  }, [])

  const removeFromLog = (id) =>
    setScannedLog(prev => prev.filter(e => e.student.id !== id))

  const clearLog = () => { setScannedLog([]); setLastScanned(null) }

  return (
    <div className="space-y-4">
      {/* Back */}
      <button onClick={() => navigate('/admin/asistencias')}
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors">
        <ArrowLeft size={15}/> Regresar a Asistencias
      </button>

      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-r from-navy-900 to-navy-700 p-5 flex items-center gap-4 text-white">
        <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
          <QrCode size={26}/>
        </div>
        <div className="flex-1">
          <h1 className="text-lg font-bold">Pase de Lista por QR</h1>
          <p className="text-navy-300 text-sm mt-0.5">
            Escanea el QR personal de cada alumno para registrar su asistencia automáticamente.
          </p>
        </div>
        <div className="text-center px-4 py-2 rounded-xl bg-white/10 flex-shrink-0">
          <p className="text-2xl font-bold text-emerald-300">{scannedLog.length}</p>
          <p className="text-[11px] text-navy-300">Escaneados</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        {/* ── Camera panel ───────────────────────────────── */}
        <div className="xl:col-span-3 space-y-4">

          {/* Group filter + controls */}
          <div className="card p-4 flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-48">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Filtrar grupo
              </label>
              <div className="relative">
                <select value={groupFilter} onChange={e => setGroupFilter(e.target.value)}
                  className="input-field pr-9 appearance-none font-medium">
                  <option value="all">Todos los grupos</option>
                  {groups.map(g => <option key={g.id} value={g.id}>{g.name} — {g.subject}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
              </div>
            </div>
            <div className="flex gap-2">
              {!scanning ? (
                <button onClick={startScanner} className="btn-primary">
                  <Camera size={16}/> Activar cámara
                </button>
              ) : (
                <button onClick={stopScanner}
                  className="bg-red-600 text-white px-4 py-2 rounded-lg font-medium text-sm hover:bg-red-700 transition-colors flex items-center gap-2">
                  <CameraOff size={16}/> Detener
                </button>
              )}
            </div>
          </div>

          {/* Camera view */}
          <div className={clsx(
            'card overflow-hidden relative transition-all duration-300',
            flashGreen && 'ring-4 ring-emerald-400'
          )}>
            {/* Flash overlay */}
            <div className={clsx(
              'absolute inset-0 bg-emerald-400 z-20 pointer-events-none transition-opacity duration-300',
              flashGreen ? 'opacity-20' : 'opacity-0'
            )}/>

            {/* Html5Qrcode mounts here */}
            <div id="qr-video-container" className="w-full" style={{ minHeight: 300 }}/>

            {/* Idle overlay */}
            {!scanning && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50 gap-4"
                style={{ minHeight: 300 }}>
                {camError ? (
                  <div className="text-center px-8">
                    <AlertTriangle size={40} className="text-red-400 mx-auto mb-3"/>
                    <p className="font-semibold text-slate-700 mb-1">Error de cámara</p>
                    <p className="text-sm text-red-600">{camError}</p>
                    <button onClick={startScanner} className="btn-primary mx-auto mt-4">
                      Reintentar
                    </button>
                  </div>
                ) : (
                  <div className="text-center px-8">
                    <div className="w-20 h-20 rounded-2xl border-4 border-dashed border-slate-300 flex items-center justify-center mx-auto mb-4">
                      <QrCode size={36} className="text-slate-300"/>
                    </div>
                    <p className="font-semibold text-slate-600 mb-1">Cámara desactivada</p>
                    <p className="text-sm text-slate-400">Presiona "Activar cámara" para comenzar el escaneo.</p>
                  </div>
                )}
              </div>
            )}

            {/* Scanning indicator */}
            {scanning && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10">
                <div className="flex items-center gap-2 bg-black/60 text-white text-xs px-3 py-1.5 rounded-full backdrop-blur-sm">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"/>
                  Escaneando… apunta al QR del alumno
                </div>
              </div>
            )}
          </div>

          {/* Last scanned */}
          {lastScanned && (
            <div className="card p-4 border-l-4 border-l-emerald-500 animate-fade-in">
              <div className="flex items-center gap-3">
                <CheckCircle size={22} className="text-emerald-500 flex-shrink-0"/>
                <div className="flex-1">
                  <p className="text-xs text-emerald-700 font-semibold uppercase tracking-wider">Último escaneo exitoso</p>
                  <p className="text-base font-bold text-slate-900">{lastScanned.student.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {groups.find(g=>g.id===lastScanned.student.groupId)?.name} · Registrado a las {lastScanned.time}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-800 font-bold text-sm flex-shrink-0">
                  {lastScanned.student.name.split(' ').slice(0,2).map(n=>n[0]).join('')}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Scanned log ────────────────────────────────── */}
        <div className="xl:col-span-2">
          <div className="card overflow-hidden h-full flex flex-col">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                <Users size={15} className="text-slate-500"/>
                <h2 className="text-sm font-semibold text-slate-700">
                  Presentes ({scannedLog.length})
                </h2>
              </div>
              {scannedLog.length > 0 && (
                <button onClick={clearLog}
                  className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1 transition-colors">
                  <Trash2 size={12}/> Limpiar
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto">
              {scannedLog.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full py-12 text-center px-4">
                  <QrCode size={36} className="text-slate-200 mb-3"/>
                  <p className="text-sm text-slate-400 font-medium">Sin escaneos aún</p>
                  <p className="text-xs text-slate-300 mt-1">Escanea el QR de un alumno para registrarlo aquí.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {scannedLog.map((entry, i) => {
                    const grp = groups.find(g => g.id === entry.student.groupId)
                    return (
                      <div key={entry.student.id}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors animate-fade-in">
                        <div className="relative">
                          <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-800 text-xs font-bold flex-shrink-0">
                            {entry.student.name.split(' ').slice(0,2).map(n=>n[0]).join('')}
                          </div>
                          {i === 0 && (
                            <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white"/>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-800 truncate">{entry.student.name}</p>
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                            <Clock size={10}/>
                            <span>{entry.time}</span>
                            <span>·</span>
                            <span>{grp?.name}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <span className="badge bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"/>
                            Presente
                          </span>
                          <button onClick={() => removeFromLog(entry.student.id)}
                            className="p-1 rounded hover:bg-slate-200 text-slate-300 hover:text-slate-500 transition-colors">
                            <Trash2 size={12}/>
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Footer summary */}
            {scannedLog.length > 0 && (
              <div className="px-4 py-3 bg-emerald-50 border-t border-emerald-100 flex-shrink-0">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-emerald-700 font-medium">{scannedLog.length} alumnos presentes registrados</span>
                  <button
                    onClick={() => navigate('/admin/asistencias')}
                    className="text-navy-700 font-semibold hover:underline">
                    Ir a lista completa →
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="card p-5">
        <h3 className="text-sm font-bold text-slate-700 mb-3">¿Cómo funciona?</h3>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {[
            { n:'1', title:'El alumno abre su app', desc:'Va a "Mi Código QR" en su panel.' },
            { n:'2', title:'Docente activa cámara', desc:'Presiona "Activar cámara" en esta pantalla.' },
            { n:'3', title:'Escanea el QR', desc:'Apunta la cámara al código del alumno.' },
            { n:'4', title:'Registro automático', desc:'El alumno aparece como "Presente" al instante.' },
          ].map(step => (
            <div key={step.n} className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-navy-900 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5">
                {step.n}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">{step.title}</p>
                <p className="text-xs text-slate-500 mt-0.5">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
