import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { QRCodeSVG } from 'qrcode.react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, RefreshCw, Maximize2, Minimize2,
  ChevronDown, Clock, Users, CheckCircle, QrCode, Shield
} from 'lucide-react'
import { fetchGroups } from '../../lib/supabaseData'
import { createQrSession, loadSessionDb } from '../../lib/attendanceDb'

const QR_SESSION_PREFIX = 'EDUTRACK_SESSION:'
const TOKEN_DURATION_S  = 300   // token válido 5 minutos

function todayISO() {
  return new Date().toISOString().split('T')[0]
}

export default function SessionQR() {
  const navigate = useNavigate()

  const [groups,      setGroups]      = useState([])
  const [group,       setGroup]       = useState(null)
  const [date,        setDate]        = useState(todayISO())
  const [token,       setToken]       = useState(null)
  const [countdown,   setCountdown]   = useState(TOKEN_DURATION_S)
  const [fullscreen,  setFullscreen]  = useState(false)
  const [scannedCount,setScannedCount]= useState(0)

  useEffect(() => {
    fetchGroups().then(gs => {
      setGroups(gs)
      if (gs.length > 0) setGroup(g => g ?? gs[0].id)
    }).catch(() => {})
  }, [])

  /* qr value: "EDUTRACK_SESSION:g1:2026-05-07:<token BD>" */
  const qrValue = token ? `${QR_SESSION_PREFIX}${group}:${date}:${token}` : ''

  // Crea/renueva la sesión en la BD: el token del QR es el que valida
  // register_attendance en el servidor.
  const refreshToken = useCallback(() => {
    if (!group || !date) return
    createQrSession(group, date, TOKEN_DURATION_S / 60)
      .then(s => { if (s) { setToken(s.token); setCountdown(TOKEN_DURATION_S) } })
      .catch(() => {})
  }, [group, date])

  useEffect(() => { refreshToken() }, [refreshToken])

  // Conteo en vivo de alumnos registrados en la sesión (cada 10 s).
  useEffect(() => {
    if (!group || !date) return
    const poll = () =>
      loadSessionDb(group, date)
        .then(s => setScannedCount(s?.records.length ?? 0))
        .catch(() => {})
    poll()
    const iv = setInterval(poll, 10000)
    return () => clearInterval(iv)
  }, [group, date])

  /* countdown timer */
  useEffect(() => {
    if (!token) return
    const iv = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { refreshToken(); return TOKEN_DURATION_S }
        return c - 1
      })
    }, 1000)
    return () => clearInterval(iv)
  }, [token, refreshToken])

  const mins = String(Math.floor(countdown / 60)).padStart(2, '0')
  const secs = String(countdown % 60).padStart(2, '0')
  const pct  = (countdown / TOKEN_DURATION_S) * 100
  const grp  = groups.find(g => g.id === group)

  /* ── Fullscreen mode ───────────────────────────────────────── */
  // Va por portal: el contenedor de página tiene un transform residual de
  // animate-page-in, que haría que inset-0 se recorte a la página, no a la ventana.
  if (fullscreen) {
    return createPortal(
      <div className="fixed inset-0 bg-navy-950 z-[9999] flex flex-col items-center justify-center gap-6 p-8">
        {/* Header */}
        <div className="flex items-center gap-3">
          <img src="/logo.jpeg" alt="SIGA CEFIMAT" className="w-10 h-10 rounded-full object-cover"
            style={{ border:'1px solid rgba(255,255,255,.25)' }}/>
          <div className="text-center">
            <p className="text-white font-bold text-xl">SIGA CEFIMAT — Pase de Lista</p>
            <p className="text-navy-300 text-sm">{grp?.name} · {grp?.subject}</p>
          </div>
        </div>

        {/* QR Code */}
        <div className="p-6 bg-white rounded-3xl shadow-2xl">
          <QRCodeSVG
            value={qrValue}
            size={300}
            level="H"
            fgColor="#1e3a6e"
            bgColor="#ffffff"
          />
        </div>

        {/* Instruction */}
        <div className="text-center max-w-xs">
          <p className="text-white text-lg font-bold">Escanea para registrar tu asistencia</p>
          <p className="text-navy-300 text-sm mt-1">
            Abre SIGA → Mi Código QR → Escanear QR del Salón
          </p>
        </div>

        {/* Countdown ring */}
        <div className="flex flex-col items-center gap-2">
          <div className="relative w-20 h-20">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 80 80">
              <circle cx="40" cy="40" r="34" fill="none" stroke="#1e3a8a" strokeWidth="6"/>
              <circle cx="40" cy="40" r="34" fill="none" stroke="#f59e0b"
                strokeWidth="6" strokeDasharray={`${2 * Math.PI * 34}`}
                strokeDashoffset={`${2 * Math.PI * 34 * (1 - pct / 100)}`}
                className="transition-all duration-1000"/>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-white text-lg font-bold font-mono leading-none">{mins}:{secs}</span>
              <span className="text-navy-400 text-[10px]">restante</span>
            </div>
          </div>

          <div className="flex gap-3 mt-2">
            <button onClick={refreshToken}
              className="flex items-center gap-2 bg-navy-800 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-navy-700 transition-colors">
              <RefreshCw size={14}/> Nuevo código
            </button>
            <button onClick={() => setFullscreen(false)}
              className="flex items-center gap-2 bg-navy-800 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-navy-700 transition-colors">
              <Minimize2 size={14}/> Salir
            </button>
          </div>
        </div>

        {/* Scanned count */}
        <div className="absolute top-4 right-4 bg-emerald-600 text-white px-4 py-2 rounded-xl flex items-center gap-2">
          <Users size={16}/>
          <span className="font-bold">{scannedCount}</span>
          <span className="text-emerald-200 text-sm">escaneados</span>
        </div>
      </div>,
      document.body,
    )
  }

  /* ── Normal mode ───────────────────────────────────────────── */
  return (
    <div className="max-w-4xl space-y-4">
      <button onClick={() => navigate('/admin/asistencias')}
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors">
        <ArrowLeft size={15}/> Regresar a Asistencias
      </button>

      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-r from-navy-900 to-navy-700 p-5 flex items-center gap-4 text-white">
        <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
          <QrCode size={26} className="text-gold-300"/>
        </div>
        <div className="flex-1">
          <h1 className="text-lg font-bold">QR de Sesión — Para los Alumnos</h1>
          <p className="text-navy-300 text-sm mt-0.5">
            Muestra este código en la entrada. Los alumnos lo escanean con su app para registrar su asistencia.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">

        {/* ── Controls ──────────────────────────────────────── */}
        <div className="xl:col-span-2 space-y-4">
          <div className="card p-5 space-y-4">
            <h2 className="section-title">Configurar sesión</h2>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Grupo</label>
              <div className="relative">
                <select value={group} onChange={e => setGroup(e.target.value)}
                  className="input-field pr-9 appearance-none font-medium">
                  {groups.map(g => <option key={g.id} value={g.id}>{g.name} — {g.subject}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Fecha</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="input-field font-medium"/>
            </div>

            {/* Countdown */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <Clock size={14} className="text-gold-500"/>
                  Código activo
                </div>
                <span className="font-mono font-bold text-navy-900 text-lg">{mins}:{secs}</span>
              </div>
              <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-1000"
                  style={{ width:`${pct}%`, background: pct>40?'#10b981':pct>20?'#f59e0b':'#ef4444' }}
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-2">
                Se renueva automáticamente cada 5 minutos para evitar suplantaciones.
              </p>
            </div>

            <div className="flex gap-2">
              <button onClick={refreshToken} className="btn-secondary flex-1 justify-center">
                <RefreshCw size={14}/> Nuevo código
              </button>
              <button onClick={() => setFullscreen(true)} className="btn-primary flex-1 justify-center">
                <Maximize2 size={14}/> Pantalla completa
              </button>
            </div>
          </div>

          {/* Instructions for students */}
          <div className="card p-5">
            <h3 className="text-sm font-bold text-slate-700 mb-3">Instrucciones para el alumno</h3>
            <ol className="space-y-2.5">
              {[
                { step:'Abre SIGA CEFIMAT en tu teléfono.' },
                { step:'Ve a "Mi Código QR".' },
                { step:'Toca el botón "Escanear QR del Salón".' },
                { step:'Apunta la cámara al QR del docente.' },
                { step:'¡Tu asistencia queda registrada al instante!' },
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-slate-700">
                  <span className="w-5 h-5 rounded-full bg-navy-100 text-navy-700 text-[11px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  {item.step}
                </li>
              ))}
            </ol>
          </div>

          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
            <Shield size={15} className="text-amber-500 flex-shrink-0 mt-0.5"/>
            <p className="text-xs text-amber-700 leading-relaxed">
              El código cambia cada 5 minutos. Los alumnos deben escanearlo en tiempo real —
              una captura de pantalla compartida no funcionará si el código ya expiró.
            </p>
          </div>
        </div>

        {/* ── QR Display ──────────────────────────────────────── */}
        <div className="xl:col-span-3">
          <div className="card p-8 flex flex-col items-center h-full">
            <div className="flex items-center justify-between w-full mb-6">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">QR activo para</p>
                <p className="font-bold text-slate-900 text-lg mt-0.5">{grp?.name} — {grp?.subject}</p>
                <p className="text-slate-400 text-xs mt-0.5">{date}</p>
              </div>
              <div className={`badge text-xs font-bold ${pct > 40 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : pct > 20 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-red-50 text-red-700 border-red-200'} border`}>
                <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${pct > 40 ? 'bg-emerald-500' : pct > 20 ? 'bg-amber-500' : 'bg-red-500'}`}/>
                {pct > 40 ? 'Activo' : pct > 20 ? 'Próximo a vencer' : 'Venciendo'}
              </div>
            </div>

            {/* QR Code — big */}
            <div className="p-6 bg-white rounded-2xl border-2 border-slate-100 shadow-inner transition-all">
              <QRCodeSVG
                key={qrValue}           /* re-render on token change */
                value={qrValue}
                size={280}
                level="H"
                fgColor="#0f2b5b"
                bgColor="#ffffff"
              />
            </div>

            <p className="text-sm text-slate-500 mt-5 text-center">
              Coloca tu teléfono en la entrada con esta pantalla visible.<br/>
              Activa la pantalla completa para mejor visibilidad.
            </p>

            <div className="mt-4 flex items-center gap-2 text-xs text-slate-400">
              <span className="font-mono bg-slate-100 px-2 py-1 rounded text-slate-500">{token}</span>
              <span>código de sesión</span>
            </div>

            <button onClick={() => setFullscreen(true)}
              className="mt-6 btn-primary w-full justify-center">
              <Maximize2 size={15}/> Modo pantalla completa para la entrada
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
