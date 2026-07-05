import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { getStudentById } from '../../data/mockData'
import {
  CheckCircle2, Clock, FileText, Shield, PenLine,
  Upload, Trash2, Check, AlertTriangle,
} from 'lucide-react'
import clsx from 'clsx'

// ── Canvas de firma ──────────────────────────────────────────────────────────
function SignaturePad({ onCapture, disabled }) {
  const canvasRef  = useRef(null)
  const drawing    = useRef(false)
  const [hasStrokes, setHasStrokes] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const id = setTimeout(() => {
      const dpr  = window.devicePixelRatio || 1
      const rect = canvas.getBoundingClientRect()
      canvas.width  = rect.width  * dpr
      canvas.height = rect.height * dpr
      const ctx = canvas.getContext('2d')
      ctx.scale(dpr, dpr)
      ctx.strokeStyle = 'rgba(255,255,255,.88)'
      ctx.lineWidth   = 2.5
      ctx.lineCap     = 'round'
      ctx.lineJoin    = 'round'
    }, 60)
    return () => clearTimeout(id)
  }, [])

  const getPos = e => {
    const rect = canvasRef.current.getBoundingClientRect()
    const src  = e.touches ? e.touches[0] : e
    return { x: src.clientX - rect.left, y: src.clientY - rect.top }
  }

  const start = e => {
    if (disabled) return
    e.preventDefault()
    drawing.current = true
    const ctx = canvasRef.current.getContext('2d')
    const { x, y } = getPos(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  const move = e => {
    if (!drawing.current) return
    e.preventDefault()
    const ctx = canvasRef.current.getContext('2d')
    const { x, y } = getPos(e)
    ctx.lineTo(x, y)
    ctx.stroke()
    if (!hasStrokes) setHasStrokes(true)
  }

  const stop = () => { drawing.current = false }

  const clear = () => {
    const canvas = canvasRef.current
    const dpr    = window.devicePixelRatio || 1
    canvas.getContext('2d').clearRect(0, 0, canvas.width / dpr, canvas.height / dpr)
    setHasStrokes(false)
  }

  const capture = () => onCapture(canvasRef.current.toDataURL('image/png'))

  return (
    <div>
      <div className="relative rounded-xl overflow-hidden" style={{
        background: 'rgba(255,255,255,.025)',
        border: '1.5px dashed rgba(255,255,255,.18)',
      }}>
        {!hasStrokes && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 pointer-events-none select-none" style={{ color:'rgba(255,255,255,.16)' }}>
            <PenLine size={22}/>
            <p className="text-xs">Dibuja tu firma aquí</p>
          </div>
        )}
        <canvas
          ref={canvasRef}
          className="block w-full"
          style={{ height: 156, touchAction:'none', cursor: disabled ? 'not-allowed' : 'crosshair' }}
          onMouseDown={start} onMouseMove={move} onMouseUp={stop} onMouseLeave={stop}
          onTouchStart={start} onTouchMove={move} onTouchEnd={stop}
        />
      </div>

      <div className="flex items-center justify-between mt-2.5">
        <button
          onClick={clear}
          disabled={!hasStrokes || disabled}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all disabled:opacity-35"
          style={{ color:'rgba(255,255,255,.45)', background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.08)' }}>
          <Trash2 size={12}/> Limpiar
        </button>
        <button
          onClick={capture}
          disabled={!hasStrokes || disabled}
          className="flex items-center gap-1.5 text-xs font-bold px-4 py-1.5 rounded-lg transition-all duration-150 disabled:opacity-35 active:scale-95"
          style={{
            background: hasStrokes && !disabled ? 'white' : 'rgba(255,255,255,.08)',
            color:      hasStrokes && !disabled ? '#000'  : 'rgba(255,255,255,.25)',
          }}>
          <Check size={12}/> Usar esta firma
        </button>
      </div>
    </div>
  )
}

// ── Subida de documento ──────────────────────────────────────────────────────
function DocUpload({ label, icon: Icon, file, onChange, disabled }) {
  const ref = useRef(null)
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color:'rgba(255,255,255,.35)' }}>{label}</p>
      <button
        type="button"
        onClick={() => ref.current?.click()}
        disabled={disabled}
        className="w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all active:scale-[.98] disabled:opacity-50"
        style={{
          background:  file ? 'rgba(52,211,153,.07)' : 'rgba(255,255,255,.04)',
          border:     `1px solid ${file ? 'rgba(52,211,153,.22)' : 'rgba(255,255,255,.09)'}`,
        }}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{
          background: file ? 'rgba(52,211,153,.14)' : 'rgba(255,255,255,.06)',
        }}>
          {file
            ? <CheckCircle2 size={16} style={{ color:'#34d399' }}/>
            : <Icon         size={16} style={{ color:'rgba(255,255,255,.35)' }}/>
          }
        </div>
        <div className="flex-1 min-w-0">
          {file
            ? <p className="text-xs font-semibold truncate" style={{ color:'#34d399' }}>{file}</p>
            : <p className="text-xs"                        style={{ color:'rgba(255,255,255,.35)' }}>Subir archivo (PDF, JPG, PNG)</p>
          }
        </div>
        {!file && <Upload size={13} style={{ color:'rgba(255,255,255,.22)', flexShrink:0 }}/>}
      </button>
      <input
        ref={ref} type="file" className="hidden"
        accept=".pdf,.jpg,.jpeg,.png"
        onChange={e => onChange(e.target.files[0]?.name ?? null)}
      />
    </div>
  )
}

// ── Textos placeholder (se reemplazarán con el contenido real) ───────────────
const TC_TEXT = `TÉRMINOS Y CONDICIONES — CEFIMAT
[Versión: pendiente de publicación oficial]

El texto completo de los Términos y Condiciones será publicado próximamente. Por favor contacta a tu asesor CEFIMAT para obtener la versión vigente.

1. SERVICIOS
CEFIMAT provee servicios educativos de preparación para exámenes de admisión a nivel superior (UNAM, IPN, ECOEMS y otras instituciones).

2. GARANTÍA CEFIMAT
La garantía de repetición del curso sin costo aplica cuando el alumno cumple simultáneamente con:
  a) Asistencia mínima del 90% (considerando la regla de 3 retardos = 1 inasistencia)
  b) Haber presentado todos los exámenes de simulación
  c) Obtener calificación mínima del 80% en cada tarea asignada

El incumplimiento de cualquiera de los tres requisitos anula la garantía de forma definitiva.

3. RETARDOS
Tres (3) retardos equivalen a una (1) inasistencia para efectos del cálculo del porcentaje de asistencia.

4. OBLIGACIONES DEL ALUMNO
El alumno se compromete a asistir puntualmente, entregar tareas en tiempo y forma, y presentar todos los simulacros programados.

5. VALIDEZ DE LA FIRMA
La firma digital registrada en esta plataforma tiene carácter de compromiso del alumno. Su validez es responsabilidad exclusiva del firmante.`

const PRIV_TEXT = `AVISO DE PRIVACIDAD — CEFIMAT
[Versión: pendiente de publicación oficial]

CEFIMAT, como responsable del tratamiento de tus datos personales, te informa:

DATOS QUE RECABAMOS
- Nombre completo, correo electrónico
- CURP del alumno
- Identificación oficial del tutor/responsable
- Datos de desempeño académico y asistencias
- Firma digital

FINALIDADES
- Gestión académica y control de asistencias
- Comunicación sobre desempeño académico
- Cumplimiento de obligaciones legales y contractuales

TUS DERECHOS (ARCO)
Puedes ejercer tus derechos de Acceso, Rectificación, Cancelación y Oposición escribiendo a privacidad@cefimat.mx.

Tus datos no serán transferidos a terceros sin tu consentimiento previo, salvo las excepciones previstas en la Ley Federal de Protección de Datos Personales.`

// ── Página principal ─────────────────────────────────────────────────────────
export default function Terms() {
  const { currentUser } = useAuth()
  const s = getStudentById(currentUser?.studentId)

  const [tab,        setTab]        = useState('tc')
  const [signature,  setSignature]  = useState(s?.signatureDataUrl ?? null)
  const [curpFile,   setCurpFile]   = useState(s?.curpDoc    ?? null)
  const [ineFile,    setIneFile]    = useState(s?.ineTutorDoc ?? null)
  const [signed,     setSigned]     = useState(s?.termsStatus === 'firmado')
  const [signedAt,   setSignedAt]   = useState(s?.signedAt   ?? null)
  const [tcRead,     setTcRead]     = useState(s?.termsStatus === 'firmado')
  const [privRead,   setPrivRead]   = useState(s?.termsStatus === 'firmado')
  const [submitting, setSubmitting] = useState(false)

  if (!s) return null

  const canSign = !!signature && !!curpFile && !!ineFile && tcRead && privRead && !signed

  const checklist = [
    { ok: tcRead,       label:'Términos y Condiciones leídos' },
    { ok: privRead,     label:'Aviso de Privacidad leído' },
    { ok: !!curpFile,   label:'CURP subida' },
    { ok: !!ineFile,    label:'INE del tutor subida' },
    { ok: !!signature,  label:'Firma capturada' },
  ]

  const handleSign = async () => {
    if (!canSign) return
    setSubmitting(true)
    await new Promise(r => setTimeout(r, 1100))
    const now = new Date().toLocaleDateString('es-MX', {
      year:'numeric', month:'long', day:'numeric', hour:'2-digit', minute:'2-digit',
    })
    setSigned(true)
    setSignedAt(now)
    setSubmitting(false)
    // Persiste en el objeto de mockData (en memoria, se pierde al recargar)
    s.termsStatus     = 'firmado'
    s.signatureDataUrl = signature
    s.signedAt        = now
    s.curpDoc         = curpFile
    s.ineTutorDoc     = ineFile
  }

  const TABS = [
    { id:'tc',    label:'Términos y Condiciones', short:'T&C',       icon: FileText },
    { id:'priv',  label:'Aviso de Privacidad',    short:'Privacidad', icon: Shield   },
    { id:'firma', label:'Firma y Documentos',     short:'Firma',      icon: PenLine  },
  ]

  return (
    <div className="max-w-2xl space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="page-title">Términos y Condiciones</h1>
          <p className="text-sm mt-1" style={{ color:'rgba(255,255,255,.38)' }}>
            Firma los documentos requeridos para activar tu acceso completo.
          </p>
        </div>
        <span className={clsx(
          'flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold mt-1',
          signed
            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
            : 'bg-amber-500/15  text-amber-400  border border-amber-500/30'
        )}>
          {signed ? <CheckCircle2 size={13}/> : <Clock size={13}/>}
          {signed ? 'Firmado' : 'Pendiente'}
        </span>
      </div>

      {/* Banner de estado */}
      {!signed && (
        <div className="flex gap-3 p-4 rounded-xl" style={{ background:'rgba(251,191,36,.07)', border:'1px solid rgba(251,191,36,.20)' }}>
          <AlertTriangle size={16} style={{ color:'#fbbf24', flexShrink:0, marginTop:2 }}/>
          <div>
            <p className="text-sm font-semibold" style={{ color:'#fbbf24' }}>Acceso pendiente de activación</p>
            <p className="text-xs mt-0.5" style={{ color:'rgba(255,255,255,.42)' }}>
              Lee los documentos, sube tu CURP e INE del tutor, y dibuja tu firma para completar el registro.
              La validez de la firma es responsabilidad enteramente del alumno.
            </p>
          </div>
        </div>
      )}
      {signed && (
        <div className="flex gap-3 p-4 rounded-xl" style={{ background:'rgba(52,211,153,.07)', border:'1px solid rgba(52,211,153,.18)' }}>
          <CheckCircle2 size={16} style={{ color:'#34d399', flexShrink:0, marginTop:2 }}/>
          <div>
            <p className="text-sm font-semibold" style={{ color:'#34d399' }}>Documentos firmados</p>
            <p className="text-xs mt-0.5" style={{ color:'rgba(255,255,255,.42)' }}>
              Firmado el {signedAt}. Tu firma fue guardada en tu perfil.
            </p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.07)' }}>
        {TABS.map(t => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={clsx(
                'flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-semibold transition-all',
                active ? 'bg-white text-black' : 'hover:text-white/70'
              )}
              style={{ color: active ? '#000' : 'rgba(255,255,255,.38)' }}>
              <Icon size={13}/>
              <span className="hidden sm:inline">{t.label}</span>
              <span className="sm:hidden">{t.short}</span>
            </button>
          )
        })}
      </div>

      {/* ── Tab T&C ──────────────────────────────────────────────── */}
      {tab === 'tc' && (
        <div className="card p-5 space-y-4">
          <div className="max-h-64 overflow-y-auto pr-1 text-xs leading-relaxed" style={{ color:'rgba(255,255,255,.50)', whiteSpace:'pre-line' }}>
            {TC_TEXT}
          </div>
          {!tcRead
            ? (
              <button onClick={() => setTcRead(true)} className="btn-primary w-full justify-center">
                <CheckCircle2 size={15}/> He leído y acepto los Términos y Condiciones
              </button>
            )
            : (
              <div className="flex items-center gap-2 p-3 rounded-xl" style={{ background:'rgba(52,211,153,.07)', border:'1px solid rgba(52,211,153,.18)' }}>
                <CheckCircle2 size={14} style={{ color:'#34d399' }}/>
                <span className="text-xs font-semibold" style={{ color:'#34d399' }}>Leídos y aceptados</span>
              </div>
            )
          }
        </div>
      )}

      {/* ── Tab Privacidad ───────────────────────────────────────── */}
      {tab === 'priv' && (
        <div className="card p-5 space-y-4">
          <div className="max-h-64 overflow-y-auto pr-1 text-xs leading-relaxed" style={{ color:'rgba(255,255,255,.50)', whiteSpace:'pre-line' }}>
            {PRIV_TEXT}
          </div>
          {!privRead
            ? (
              <button onClick={() => setPrivRead(true)} className="btn-primary w-full justify-center">
                <CheckCircle2 size={15}/> He leído el Aviso de Privacidad
              </button>
            )
            : (
              <div className="flex items-center gap-2 p-3 rounded-xl" style={{ background:'rgba(52,211,153,.07)', border:'1px solid rgba(52,211,153,.18)' }}>
                <CheckCircle2 size={14} style={{ color:'#34d399' }}/>
                <span className="text-xs font-semibold" style={{ color:'#34d399' }}>Leído y aceptado</span>
              </div>
            )
          }
        </div>
      )}

      {/* ── Tab Firma y Documentos ───────────────────────────────── */}
      {tab === 'firma' && (
        <div className="space-y-4">

          {/* Documentos */}
          <div className="card p-5 space-y-4">
            <h2 className="section-title">Documentos</h2>
            <DocUpload label="CURP del alumno"             icon={FileText} file={curpFile}  onChange={setCurpFile}  disabled={signed}/>
            <DocUpload label="INE / Identificación del tutor" icon={Shield}   file={ineFile}   onChange={setIneFile}   disabled={signed}/>
          </div>

          {/* Firma */}
          <div className="card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="section-title">Firma digital</h2>
              {signed && (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background:'rgba(52,211,153,.12)', color:'#34d399', border:'1px solid rgba(52,211,153,.20)' }}>
                  Guardada
                </span>
              )}
            </div>

            {/* Firma existente */}
            {signed && signature && (
              <div className="space-y-2">
                <div className="rounded-xl p-3" style={{ background:'rgba(255,255,255,.02)', border:'1px solid rgba(255,255,255,.07)' }}>
                  <img src={signature} alt="Firma guardada" className="max-h-28 mx-auto block"/>
                </div>
                <p className="text-[11px]" style={{ color:'rgba(255,255,255,.22)' }}>
                  Firmado el {signedAt}
                </p>
              </div>
            )}
            {signed && !signature && (
              <p className="text-xs" style={{ color:'rgba(255,255,255,.30)' }}>Firma registrada en el sistema.</p>
            )}

            {/* Canvas */}
            {!signed && (
              <>
                <SignaturePad onCapture={setSignature} disabled={signed}/>
                {signature && (
                  <div className="flex items-center gap-2 p-2.5 rounded-xl" style={{ background:'rgba(52,211,153,.07)', border:'1px solid rgba(52,211,153,.18)' }}>
                    <CheckCircle2 size={13} style={{ color:'#34d399' }}/>
                    <span className="text-xs font-semibold flex-1" style={{ color:'#34d399' }}>Firma capturada</span>
                    <button onClick={() => setSignature(null)} className="text-[11px]" style={{ color:'rgba(248,113,113,.60)' }}>
                      Volver a dibujar
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Checklist + botón */}
          {!signed && (
            <>
              <div className="card p-4 space-y-2.5">
                <p className="text-[11px] font-bold uppercase tracking-wider mb-3" style={{ color:'rgba(255,255,255,.28)' }}>
                  Requisitos para firmar
                </p>
                {checklist.map(({ ok, label }) => (
                  <div key={label} className="flex items-center gap-2.5 text-xs">
                    <span className={clsx('w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 transition-all', ok ? 'bg-emerald-500/20' : 'bg-white/5')}>
                      {ok
                        ? <Check size={10} style={{ color:'#34d399' }}/>
                        : <span className="w-1.5 h-1.5 rounded-full bg-white/15"/>
                      }
                    </span>
                    <span style={{ color: ok ? 'rgba(255,255,255,.60)' : 'rgba(255,255,255,.25)' }}>{label}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={handleSign}
                disabled={!canSign || submitting}
                className="btn-primary w-full justify-center py-3 text-sm"
                style={{ opacity: canSign ? 1 : 0.38 }}>
                {submitting
                  ? <span className="w-4 h-4 rounded-full border-2 border-black/30 border-t-black animate-spin"/>
                  : <CheckCircle2 size={16}/>
                }
                {submitting ? 'Guardando…' : 'Firmar y enviar'}
              </button>

              <p className="text-[11px] text-center" style={{ color:'rgba(255,255,255,.18)' }}>
                La validez de la firma es responsabilidad enteramente del alumno.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  )
}
