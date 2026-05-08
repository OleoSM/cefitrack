import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { groups, students } from '../../data/mockData'
import { Users, Clock, MapPin, ArrowLeft, RefreshCw, Maximize2, Minimize2 } from 'lucide-react'

function genToken() {
  return Math.random().toString(36).slice(2, 8).toUpperCase()
}
const TOKEN_TTL = 300
const CIRCUMFERENCE = 2 * Math.PI * 28

export default function Attendance() {
  const navigate = useNavigate()
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [token,       setToken]       = useState(genToken)
  const [secondsLeft, setSecondsLeft] = useState(TOKEN_TTL)
  const [fullscreen,  setFullscreen]  = useState(false)

  useEffect(() => {
    if (!selectedGroup) return
    setToken(genToken())
    setSecondsLeft(TOKEN_TTL)
    const id = setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) { setToken(genToken()); return TOKEN_TTL }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [selectedGroup])

  const grp    = groups.find(g => g.id === selectedGroup)
  const today  = new Date().toISOString().split('T')[0]
  const qrVal  = selectedGroup ? `EDUTRACK_SESSION:${selectedGroup}:${today}:${token}` : ''
  const mins   = String(Math.floor(secondsLeft / 60)).padStart(2, '0')
  const secs   = String(secondsLeft % 60).padStart(2, '0')
  const offset = CIRCUMFERENCE * (1 - secondsLeft / TOKEN_TTL)

  const renewToken = () => { setToken(genToken()); setSecondsLeft(TOKEN_TTL) }

  /* ── Fullscreen overlay ─────────────────────────────────── */
  if (fullscreen && selectedGroup) {
    return (
      <div className="fixed inset-0 bg-navy-950 flex flex-col items-center justify-center z-[100] p-6 text-center">
        <p className="text-navy-400 text-xs uppercase tracking-widest font-semibold mb-1">Pase de Lista</p>
        <p className="text-white font-bold text-2xl">{grp?.name}</p>
        <p className="text-navy-300 text-sm mt-0.5 mb-7">{grp?.subject}</p>

        <div className="p-6 bg-white rounded-3xl shadow-2xl">
          <QRCodeSVG value={qrVal} size={270} level="H" fgColor="#0f2b5b" bgColor="#ffffff" />
        </div>

        <div className="mt-7 flex items-center gap-5">
          <svg width="56" height="56" viewBox="0 0 60 60">
            <circle cx="30" cy="30" r="28" fill="none" stroke="#1e3a5f" strokeWidth="4"/>
            <circle cx="30" cy="30" r="28" fill="none" stroke="#f59e0b" strokeWidth="4"
              strokeDasharray={CIRCUMFERENCE} strokeDashoffset={offset}
              strokeLinecap="round" transform="rotate(-90 30 30)"
              style={{ transition:'stroke-dashoffset 1s linear' }}/>
          </svg>
          <div className="text-left">
            <p className="font-mono font-bold text-3xl text-white">{mins}:{secs}</p>
            <p className="text-navy-400 text-xs">Siguiente renovación</p>
          </div>
          <button onClick={renewToken}
            className="w-9 h-9 rounded-lg bg-navy-800 hover:bg-navy-700 transition-colors flex items-center justify-center text-navy-300 hover:text-white">
            <RefreshCw size={16}/>
          </button>
        </div>

        <button onClick={() => setFullscreen(false)}
          className="mt-10 flex items-center gap-2 text-navy-500 hover:text-white transition-colors text-sm">
          <Minimize2 size={15}/> Salir de pantalla completa
        </button>
      </div>
    )
  }

  /* ── Group selector ─────────────────────────────────────── */
  if (!selectedGroup) {
    return (
      <div className="max-w-2xl space-y-5">
        <div>
          <h1 className="page-title">Pasar Lista</h1>
          <p className="text-slate-500 text-sm mt-1">
            Selecciona el grupo para generar el código QR de sesión.
          </p>
        </div>

        <div className="grid gap-3 sm:gap-4">
          {groups.map(g => {
            const count = students.filter(s => s.groupId === g.id).length
            return (
              <button key={g.id} onClick={() => setSelectedGroup(g.id)}
                className="bg-white rounded-xl border border-slate-100 shadow-card p-4 sm:p-5 text-left hover:shadow-md hover:-translate-y-0.5 transition-all group w-full overflow-hidden">
                <div className="flex items-center gap-3 sm:gap-4">
                  {/* Color accent bar */}
                  <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ background: g.color }} />

                  {/* Avatar */}
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
                    style={{ background: g.color }}>
                    {g.name.split(' ')[1]}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-900 text-base">{g.name}</p>
                    <p className="text-slate-500 text-sm">{g.subject}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1.5 text-xs text-slate-400">
                      <span className="flex items-center gap-1"><Users size={11}/>{count} alumnos</span>
                      <span className="hidden sm:flex items-center gap-1"><Clock size={11}/>{g.schedule}</span>
                      <span className="flex items-center gap-1"><MapPin size={11}/>{g.room}</span>
                    </div>
                  </div>

                  {/* Arrow */}
                  <div className="w-9 h-9 rounded-xl bg-slate-100 group-hover:bg-slate-200 flex items-center justify-center flex-shrink-0 transition-colors">
                    <span className="text-slate-400 font-bold text-base">→</span>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  /* ── QR display ─────────────────────────────────────────── */
  return (
    <div className="max-w-md mx-auto space-y-5">
      <button onClick={() => setSelectedGroup(null)}
        className="flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors text-sm font-medium">
        <ArrowLeft size={16}/> Cambiar grupo
      </button>

      <div className="card overflow-hidden">
        {/* Group header */}
        <div className="px-5 py-4 flex items-center gap-3 border-b border-slate-100">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-base flex-shrink-0"
            style={{ background: grp?.color }}>
            {grp?.name.split(' ')[1]}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-slate-900">{grp?.name}</p>
            <p className="text-slate-500 text-sm">{grp?.subject}</p>
          </div>
          <span className="badge bg-emerald-50 text-emerald-700 border border-emerald-200 flex-shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"/>Activo
          </span>
        </div>

        {/* QR code */}
        <div className="py-7 flex justify-center bg-slate-50">
          <div className="p-5 bg-white rounded-2xl shadow-inner border-2 border-slate-100">
            <QRCodeSVG value={qrVal} size={220} level="H" fgColor="#0f2b5b" bgColor="#ffffff" />
          </div>
        </div>

        {/* Timer + actions */}
        <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <svg width="44" height="44" viewBox="0 0 60 60" className="flex-shrink-0">
              <circle cx="30" cy="30" r="28" fill="none" stroke="#e2e8f0" strokeWidth="5"/>
              <circle cx="30" cy="30" r="28" fill="none" stroke="#f59e0b" strokeWidth="5"
                strokeDasharray={CIRCUMFERENCE} strokeDashoffset={offset}
                strokeLinecap="round" transform="rotate(-90 30 30)"
                style={{ transition:'stroke-dashoffset 1s linear' }}/>
            </svg>
            <div>
              <p className="font-mono font-bold text-xl text-slate-800 leading-none">{mins}:{secs}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Se renueva solo</p>
            </div>
          </div>

          <div className="flex gap-2 flex-shrink-0">
            <button onClick={renewToken} className="btn-secondary py-2 text-xs px-3">
              <RefreshCw size={13}/>
              <span className="hidden sm:inline">Renovar</span>
            </button>
            <button onClick={() => setFullscreen(true)} className="btn-primary py-2 text-xs px-3">
              <Maximize2 size={13}/>
              <span className="hidden sm:inline">Pantalla completa</span>
            </button>
          </div>
        </div>
      </div>

      <p className="text-center text-xs text-slate-400 leading-relaxed px-2">
        Solo los alumnos de{' '}
        <span className="font-semibold text-slate-600">{grp?.name}</span>{' '}
        podrán registrar su asistencia con este código.
      </p>
    </div>
  )
}
