import { useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { useAuth } from '../../context/AuthContext'
import { getStudentById, getGroupById } from '../../data/mockData'
import { Download, QrCode, Info, Shield, ScanLine } from 'lucide-react'

const QR_PREFIX = 'EDUTRACK:'

export default function MyQR() {
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const student = getStudentById(currentUser?.studentId)
  const grp     = getGroupById(student?.groupId)
  const qrRef   = useRef(null)

  if (!student) return <div className="text-slate-500">Perfil no disponible.</div>

  const qrValue = `${QR_PREFIX}${student.id}`

  const handleDownload = () => {
    const svg = qrRef.current?.querySelector('svg')
    if (!svg) return
    const svgData = new XMLSerializer().serializeToString(svg)
    const canvas  = document.createElement('canvas')
    canvas.width  = 600
    canvas.height = 700
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, 600, 700)

    const img = new Image()
    img.onload = () => {
      ctx.drawImage(img, 75, 60, 450, 450)
      ctx.fillStyle = '#0f2b5b'
      ctx.font = 'bold 22px Inter, system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(student.name, 300, 550)
      ctx.fillStyle = '#64748b'
      ctx.font = '16px Inter, system-ui, sans-serif'
      ctx.fillText(`${grp?.name} — ${grp?.subject}`, 300, 578)
      ctx.fillStyle = '#94a3b8'
      ctx.font = '13px monospace'
      ctx.fillText(student.id, 300, 610)

      const link = document.createElement('a')
      link.download = `QR_${student.name.replace(/ /g, '_')}.png`
      link.href     = canvas.toDataURL('image/png')
      link.click()
    }
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)))
  }

  return (
    <div className="max-w-lg mx-auto space-y-5">
      <div>
        <h1 className="page-title">Mi Código QR</h1>
        <p className="text-slate-500 text-sm mt-1">
          Muestra este código al docente, o escanea el QR que el docente deja en la entrada.
        </p>
      </div>

      {/* ── SCAN TEACHER QR — hero CTA ─────────────────────── */}
      <button
        onClick={() => navigate('/student/escanear-qr')}
        className="w-full rounded-2xl bg-gradient-to-r from-navy-900 to-navy-700 p-5 flex items-center gap-4 text-white hover:from-navy-800 hover:to-navy-600 transition-all group"
      >
        <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center flex-shrink-0 group-hover:bg-white/20 transition-colors">
          <ScanLine size={28} className="text-gold-300"/>
        </div>
        <div className="flex-1 text-left">
          <p className="font-bold text-base">Escanear QR del Salón</p>
          <p className="text-navy-300 text-sm mt-0.5">
            Apunta tu cámara al código que el docente puso en la entrada para registrar tu asistencia al instante.
          </p>
        </div>
        <div className="text-gold-300 font-semibold text-sm flex-shrink-0">
          Abrir →
        </div>
      </button>

      {/* Divider */}
      <div className="flex items-center gap-3 text-slate-400 text-xs font-medium">
        <div className="flex-1 h-px bg-slate-200"/>
        O muestra tu QR personal al docente
        <div className="flex-1 h-px bg-slate-200"/>
      </div>

      {/* QR Card */}
      <div className="card p-8 flex flex-col items-center">
        {/* Header strip */}
        <div className="w-full flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-navy-900 flex items-center justify-center">
              <QrCode size={16} className="text-white"/>
            </div>
            <span className="font-bold text-navy-900 text-sm">EduTrack</span>
          </div>
          <span className="badge bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"/>
            Activo
          </span>
        </div>

        {/* QR Code */}
        <div ref={qrRef}
          className="p-5 bg-white rounded-2xl border-2 border-slate-100 shadow-inner">
          <QRCodeSVG
            value={qrValue}
            size={260}
            level="H"
            includeMargin={false}
            fgColor="#0f2b5b"
            bgColor="#ffffff"
            imageSettings={{
              src: '',
              height: 0,
              width: 0,
              excavate: false,
            }}
          />
        </div>

        {/* Student info below QR */}
        <div className="mt-5 text-center">
          <p className="text-xl font-bold text-slate-900">{student.name}</p>
          <p className="text-slate-500 text-sm mt-1">{grp?.name} — {grp?.subject}</p>
          <code className="text-xs text-slate-300 mt-2 block font-mono tracking-widest">
            {student.id}
          </code>
        </div>

        {/* Download */}
        <button onClick={handleDownload}
          className="btn-secondary mt-6 w-full justify-center">
          <Download size={15}/> Descargar QR (PNG)
        </button>
      </div>

      {/* Instructions */}
      <div className="card p-5">
        <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-3">
          <Info size={15} className="text-blue-500"/> ¿Cómo usarlo?
        </h3>
        <ol className="space-y-2.5">
          {[
            'Abre esta pantalla cuando el docente vaya a pasar lista.',
            'Muestra el QR hacia la cámara del docente.',
            'Espera la confirmación — el registro es inmediato.',
            'No compartas tu QR con otros alumnos.',
          ].map((step, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm text-slate-700">
              <span className="w-5 h-5 rounded-full bg-navy-100 text-navy-700 text-[11px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </div>

      {/* Privacy note */}
      <div className="flex items-start gap-3 bg-slate-50 border border-slate-200 rounded-xl p-4">
        <Shield size={16} className="text-slate-400 flex-shrink-0 mt-0.5"/>
        <p className="text-xs text-slate-500 leading-relaxed">
          Tu código QR está vinculado únicamente a tu identidad escolar en EduTrack.
          Solo el docente puede utilizarlo para registrar asistencia — ningún otro usuario tiene acceso al escáner.
        </p>
      </div>
    </div>
  )
}
