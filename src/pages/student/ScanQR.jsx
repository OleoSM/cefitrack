import { useEffect, useRef, useState, useCallback } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  ArrowLeft, Camera, CameraOff, CheckCircle, AlertTriangle,
  QrCode, Clock, RefreshCw, Shield
} from 'lucide-react'
import { getStudentById, getGroupById } from '../../data/mockData'

const SESSION_PREFIX = 'EDUTRACK_SESSION:'

/* Validate that today matches the date in the QR */
function isDateValid(dateStr) {
  const today = new Date().toISOString().split('T')[0]
  return dateStr === today
}

export default function ScanQR() {
  const { currentUser } = useAuth()
  const navigate        = useNavigate()
  const student         = getStudentById(currentUser?.studentId)
  const grp             = getGroupById(student?.groupId)

  const qrRef    = useRef(null)
  const scannedRef = useRef(false)  // prevent multi-fire

  const [scanning,   setScanning]   = useState(false)
  const [camError,   setCamError]   = useState('')
  const [result,     setResult]     = useState(null)  // { ok, title, body, grpName }

  /* ── Parse & validate QR ─────────────────────────────────── */
  const handleDecode = useCallback((raw) => {
    if (scannedRef.current) return
    if (!raw.startsWith(SESSION_PREFIX)) return

    scannedRef.current = true
    stopScanner()

    const parts    = raw.slice(SESSION_PREFIX.length).split(':')
    // parts: [groupId, date, token]
    if (parts.length < 3) {
      setResult({ ok:false, title:'QR inválido', body:'Este código no corresponde a una sesión de EduTrack.' })
      return
    }

    const [qrGroup, qrDate] = parts
    const sessionGrp = getGroupById(qrGroup)

    if (!isDateValid(qrDate)) {
      setResult({
        ok: false,
        title: 'Código expirado',
        body: 'Este QR ya no es válido. Pídele al docente que muestre el código actualizado.',
      })
      return
    }

    if (student?.groupId !== qrGroup) {
      setResult({
        ok: false,
        title: 'Grupo incorrecto',
        body: `Este código es para ${sessionGrp?.name ?? 'otro grupo'}, pero tú perteneces a ${grp?.name}. Verifica con tu docente.`,
      })
      return
    }

    /* ── All good ── */
    const now = new Date().toLocaleTimeString('es-MX', { hour:'2-digit', minute:'2-digit' })
    setResult({
      ok: true,
      title: '¡Asistencia registrada!',
      body: `Quedaste registrado como Presente en ${sessionGrp?.name} · ${qrDate} a las ${now}.`,
      grpName: sessionGrp?.name,
      time: now,
    })
  }, [student, grp])

  /* ── Camera controls ─────────────────────────────────────── */
  const startScanner = useCallback(async () => {
    if (qrRef.current) return
    setCamError('')
    scannedRef.current = false
    try {
      const qr = new Html5Qrcode('student-qr-reader')
      qrRef.current = qr
      await qr.start(
        { facingMode: 'environment' },
        { fps: 12, qrbox: { width: 240, height: 240 } },
        handleDecode,
        () => {}
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

  useEffect(() => {
    return () => { if (qrRef.current) { qrRef.current.stop().catch(() => {}); qrRef.current = null } }
  }, [])

  const retry = () => {
    setResult(null)
    scannedRef.current = false
  }

  /* ── Result screens ─────────────────────────────────────── */
  if (result) {
    return (
      <div className="max-w-md mx-auto space-y-4 py-4">
        <button onClick={() => navigate('/student/mi-qr')}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors">
          <ArrowLeft size={15}/> Regresar
        </button>

        <div className={`card p-8 flex flex-col items-center text-center ${result.ok ? '' : ''}`}>
          <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-5 ${
            result.ok ? 'bg-emerald-100' : 'bg-red-100'
          }`}>
            {result.ok
              ? <CheckCircle size={40} className="text-emerald-600"/>
              : <AlertTriangle size={40} className="text-red-500"/>}
          </div>

          <h2 className={`text-xl font-bold mb-2 ${result.ok ? 'text-emerald-700' : 'text-slate-800'}`}>
            {result.title}
          </h2>
          <p className="text-slate-500 text-sm leading-relaxed">{result.body}</p>

          {result.ok && (
            <div className="mt-6 w-full bg-emerald-50 border border-emerald-200 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-emerald-200 flex items-center justify-center text-emerald-800 font-bold text-sm flex-shrink-0">
                  {student?.name.split(' ').slice(0,2).map(n=>n[0]).join('')}
                </div>
                <div className="text-left">
                  <p className="font-bold text-emerald-800">{student?.name}</p>
                  <div className="flex items-center gap-1.5 text-xs text-emerald-600 mt-0.5">
                    <Clock size={11}/>
                    Registrado a las {result.time}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-2 mt-6 w-full">
            {!result.ok && (
              <button onClick={retry}
                className="btn-primary flex-1 justify-center">
                <RefreshCw size={14}/> Intentar de nuevo
              </button>
            )}
            <button onClick={() => navigate('/student')}
              className="btn-secondary flex-1 justify-center">
              {result.ok ? 'Ir al inicio' : 'Cancelar'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  /* ── Scanner view ───────────────────────────────────────── */
  return (
    <div className="max-w-md mx-auto space-y-4">
      <button onClick={() => navigate('/student/mi-qr')}
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors">
        <ArrowLeft size={15}/> Regresar a Mi QR
      </button>

      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-r from-navy-900 to-navy-700 p-5 text-white">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
            <QrCode size={22}/>
          </div>
          <div>
            <p className="font-bold text-base">Escanear QR del Salón</p>
            <p className="text-navy-300 text-sm mt-0.5">
              Apunta la cámara al código que el docente puso en la entrada.
            </p>
          </div>
        </div>
        {student && (
          <div className="mt-3 pt-3 border-t border-navy-800 flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-gold-500 flex items-center justify-center text-white text-xs font-bold">
              {student.name.split(' ').slice(0,2).map(n=>n[0]).join('')}
            </div>
            <span className="text-navy-300 text-xs">
              Registrando asistencia de <strong className="text-white">{student.name}</strong> · {grp?.name}
            </span>
          </div>
        )}
      </div>

      {/* Camera area */}
      <div className="card overflow-hidden relative">
        {/* Html5Qrcode mounts here */}
        <div id="student-qr-reader" className="w-full" style={{ minHeight: 320 }}/>

        {/* Idle overlay */}
        {!scanning && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50 gap-4"
            style={{ minHeight: 320 }}>
            {camError ? (
              <div className="text-center px-6">
                <AlertTriangle size={38} className="text-red-400 mx-auto mb-3"/>
                <p className="font-semibold text-slate-700 mb-1">Sin acceso a cámara</p>
                <p className="text-sm text-red-600">{camError}</p>
                <button onClick={startScanner} className="btn-primary mx-auto mt-4">Reintentar</button>
              </div>
            ) : (
              <div className="text-center px-6">
                <div className="w-24 h-24 rounded-2xl border-4 border-dashed border-slate-200 flex items-center justify-center mx-auto mb-4">
                  <QrCode size={40} className="text-slate-300"/>
                </div>
                <p className="font-semibold text-slate-600 mb-1">Cámara desactivada</p>
                <p className="text-sm text-slate-400 mb-4">
                  Activa la cámara y apunta al QR que el docente tiene en la entrada.
                </p>
                <button onClick={startScanner} className="btn-primary mx-auto">
                  <Camera size={15}/> Activar cámara
                </button>
              </div>
            )}
          </div>
        )}

        {/* Scanning indicator */}
        {scanning && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10">
            <div className="flex items-center gap-2 bg-black/60 text-white text-xs px-3 py-1.5 rounded-full backdrop-blur-sm">
              <span className="w-2 h-2 rounded-full bg-gold-400 animate-pulse"/>
              Buscando QR del salón…
            </div>
          </div>
        )}

        {scanning && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10">
            <button onClick={stopScanner}
              className="flex items-center gap-1.5 bg-black/60 text-white text-xs px-3 py-1.5 rounded-full backdrop-blur-sm hover:bg-black/80 transition-colors">
              <CameraOff size={13}/> Cancelar
            </button>
          </div>
        )}
      </div>

      {/* Tips */}
      <div className="card p-4">
        <div className="flex items-start gap-3">
          <Shield size={15} className="text-slate-400 flex-shrink-0 mt-0.5"/>
          <div className="text-xs text-slate-500 leading-relaxed space-y-1">
            <p><strong className="text-slate-700">Solo funciona hoy.</strong> El QR del docente cambia cada 5 minutos y solo es válido para la fecha actual.</p>
            <p><strong className="text-slate-700">Solo tú te puedes registrar.</strong> Tu asistencia queda vinculada a tu cuenta — no puedes registrar a otros alumnos.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
