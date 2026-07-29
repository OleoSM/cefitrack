import { useEffect, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Html5Qrcode } from 'html5-qrcode'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Camera, CameraOff, AlertTriangle, QrCode, RefreshCw, Shield } from 'lucide-react'
import { useStudentData } from '../../hooks/useStudentData'
import { registerAttendance } from '../../lib/supabaseData'

const SESSION_PREFIX = 'EDUTRACK_SESSION:'

function isDateValid(dateStr) {
  return dateStr === new Date().toISOString().split('T')[0]
}

/* ── Full-screen success ────────────────────────────────────── */
function SuccessScreen({ student, result, onHome }) {
  return createPortal(
    <div className="fixed inset-0 bg-emerald-500 flex flex-col items-center justify-center z-[9999] p-8 text-center">
      {/* Animated checkmark circle */}
      <div className="animate-scale-in w-32 h-32 rounded-full bg-white/20 flex items-center justify-center mb-6">
        <svg viewBox="0 0 100 100" width="72" height="72" fill="none">
          <polyline
            points="18,54 38,74 82,28"
            stroke="white"
            strokeWidth="9"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="animate-draw"
            style={{ strokeDasharray: 120, strokeDashoffset: 120 }}
          />
        </svg>
      </div>

      <h1 className="animate-slide-up-fade text-4xl font-bold text-white"
        style={{ animationDelay: '0.25s', animationFillMode: 'both' }}>
        ¡Listo!
      </h1>

      <p className="animate-slide-up-fade text-emerald-100 text-xl mt-2"
        style={{ animationDelay: '0.35s', animationFillMode: 'both' }}>
        Asistencia registrada
      </p>

      <div className="animate-slide-up-fade mt-7 bg-white/20 rounded-2xl px-8 py-5"
        style={{ animationDelay: '0.45s', animationFillMode: 'both' }}>
        <p className="text-white text-lg font-bold">{student?.name}</p>
        <p className="text-emerald-200 text-sm mt-0.5">{result.grpName}</p>
        <p className="text-emerald-300 text-xs mt-1">Registrado a las {result.time}</p>
      </div>

      <button onClick={onHome}
        className="animate-slide-up-fade mt-10 bg-white text-emerald-700 font-bold px-10 py-3.5 rounded-2xl text-base shadow-lg hover:bg-emerald-50 transition-colors"
        style={{ animationDelay: '0.6s', animationFillMode: 'both' }}>
        Ir al inicio
      </button>
    </div>,
    document.body,
  )
}

/* ── Full-screen error ──────────────────────────────────────── */
function ErrorScreen({ result, onRetry, onHome }) {
  return createPortal(
    <div className="fixed inset-0 bg-red-600 flex flex-col items-center justify-center z-[9999] p-8 text-center">
      {/* Animated X circle */}
      <div className="animate-scale-in w-32 h-32 rounded-full bg-white/20 flex items-center justify-center mb-6">
        <svg viewBox="0 0 100 100" width="72" height="72" fill="none">
          <line x1="25" y1="25" x2="75" y2="75"
            stroke="white" strokeWidth="9" strokeLinecap="round"
            className="animate-draw"
            style={{ strokeDasharray: 80, strokeDashoffset: 80 }}/>
          <line x1="75" y1="25" x2="25" y2="75"
            stroke="white" strokeWidth="9" strokeLinecap="round"
            style={{ strokeDasharray: 80, strokeDashoffset: 80,
              animation: 'drawStroke 0.5s ease-out 0.25s forwards' }}/>
        </svg>
      </div>

      <h1 className="animate-slide-up-fade text-3xl font-bold text-white"
        style={{ animationDelay: '0.25s', animationFillMode: 'both' }}>
        {result.title}
      </h1>

      <p className="animate-slide-up-fade text-red-100 text-base mt-3 max-w-xs leading-relaxed"
        style={{ animationDelay: '0.35s', animationFillMode: 'both' }}>
        {result.body}
      </p>

      <div className="animate-slide-up-fade flex gap-3 mt-10"
        style={{ animationDelay: '0.55s', animationFillMode: 'both' }}>
        <button onClick={onRetry}
          className="flex items-center gap-2 bg-white text-red-700 font-bold px-6 py-3 rounded-2xl shadow hover:bg-red-50 transition-colors">
          <RefreshCw size={16}/> Intentar de nuevo
        </button>
        <button onClick={onHome}
          className="flex items-center gap-2 bg-red-700 text-white font-semibold px-6 py-3 rounded-2xl border border-red-400 hover:bg-red-800 transition-colors">
          Inicio
        </button>
      </div>
    </div>,
    document.body,
  )
}

/* ── Main component ─────────────────────────────────────────── */
export default function ScanQR() {
  const navigate = useNavigate()
  const { student, group: grp } = useStudentData()

  const qrRef      = useRef(null)
  const scannedRef = useRef(false)

  const [scanning, setScanning] = useState(false)
  const [camError, setCamError] = useState('')
  const [result,   setResult]   = useState(null)

  /* ── Decode, validate & register in Supabase ─────────────── */
  const handleDecode = useCallback(async (raw) => {
    if (scannedRef.current) return
    if (!raw.startsWith(SESSION_PREFIX)) return
    scannedRef.current = true
    stopScanner()

    const parts = raw.slice(SESSION_PREFIX.length).split(':')
    if (parts.length < 3) {
      setResult({ ok:false, title:'QR inválido', body:'Este código no corresponde a una sesión de SIGA CEFIMAT.' })
      return
    }

    const [qrGroup, qrDate, qrToken] = parts

    if (!isDateValid(qrDate)) {
      setResult({ ok:false, title:'Código expirado', body:'Este QR ya no es válido. Pídele al docente que muestre el código actualizado.' })
      return
    }

    if (student?.groupId !== qrGroup) {
      setResult({
        ok: false,
        title: 'Grupo incorrecto',
        body: `Este QR es de otro grupo — pero tú perteneces a ${grp?.name ?? 'tu grupo'}. Verifica con tu docente.`,
      })
      return
    }

    // Registro real en Supabase: el servidor valida el token y decide
    // presente/tardanza según la tolerancia de la sesión.
    const res = await registerAttendance(qrToken, student.id)
    if (!res.ok) {
      setResult({
        ok: false,
        title: res.code === 'expired' ? 'Código expirado' : res.code === 'wrong_group' ? 'Grupo incorrecto' : 'Error al registrar',
        body: res.message,
      })
      return
    }

    const now = new Date().toLocaleTimeString('es-MX', { hour:'2-digit', minute:'2-digit' })
    setResult({ ok:true, grpName: grp?.name, time: now, status: res.status })
  }, [student, grp])

  /* ── Camera ─────────────────────────────────────────────── */
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

  const retry = () => { setResult(null); scannedRef.current = false }

  /* ── Result screens ─────────────────────────────────────── */
  if (result?.ok) {
    return <SuccessScreen student={student} result={result} onHome={() => navigate('/student')} />
  }
  if (result && !result.ok) {
    return <ErrorScreen result={result} onRetry={retry} onHome={() => navigate('/student')} />
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
              Apunta la cámara al código que el docente tiene en la entrada.
            </p>
          </div>
        </div>
        {student && (
          <div className="mt-3 pt-3 border-t border-navy-800 flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-gold-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {student.name.split(' ').slice(0,2).map(n=>n[0]).join('')}
            </div>
            <span className="text-navy-300 text-xs">
              Registrando asistencia de <strong className="text-white">{student.name}</strong> · {grp?.name}
            </span>
          </div>
        )}
      </div>

      {/* Camera */}
      <div className="card overflow-hidden relative">
        <div id="student-qr-reader" className="w-full" style={{ minHeight: 320 }}/>

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
                  Activa la cámara y apunta al QR del docente.
                </p>
                <button onClick={startScanner} className="btn-primary mx-auto">
                  <Camera size={15}/> Activar cámara
                </button>
              </div>
            )}
          </div>
        )}

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

      <div className="card p-4">
        <div className="flex items-start gap-3">
          <Shield size={15} className="text-slate-400 flex-shrink-0 mt-0.5"/>
          <div className="text-xs text-slate-500 leading-relaxed space-y-1">
            <p><strong className="text-slate-700">Solo funciona hoy.</strong> El QR cambia cada 5 minutos y solo es válido para la fecha actual.</p>
            <p><strong className="text-slate-700">Solo tú te puedes registrar.</strong> Tu asistencia queda vinculada a tu cuenta.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
