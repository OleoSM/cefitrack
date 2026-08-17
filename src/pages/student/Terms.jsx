import { useState, useRef, useEffect } from 'react'
import { useStudentData } from '../../hooks/useStudentData'
import { signTerms } from '../../lib/supabaseData'
import {
  CheckCircle2, Clock, FileText, Shield, PenLine,
  Upload, Trash2, Check, AlertTriangle, Download, FileSignature,
} from 'lucide-react'
import clsx from 'clsx'
import { downloadStampedPdf } from '../../lib/termsPdf'
import { fetchDocumentos, subirDocumento, guardarGarantia, fetchTerminosActivo } from '../../lib/expedienteData'

const TERMS_PDF_URL = '/docs/terminos-condiciones-ecoems-universidad.pdf'

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
      ctx.strokeStyle = 'var(--t1)'
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
        background: 'var(--soft-bg)',
        border: '1.5px dashed var(--card-border)',
      }}>
        {!hasStrokes && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 pointer-events-none select-none" style={{ color:'var(--card-border)' }}>
            <PenLine size={22}/>
            <p className="text-xs">Dibuja tu firma aquí</p>
          </div>
        )}
        <canvas
          ref={canvasRef}
          className="block w-full min-h-[180px] sm:min-h-[220px]"
          style={{ height: 'clamp(180px, 32vw, 240px)', touchAction:'none', cursor: disabled ? 'not-allowed' : 'crosshair' }}
          onMouseDown={start} onMouseMove={move} onMouseUp={stop} onMouseLeave={stop}
          onTouchStart={start} onTouchMove={move} onTouchEnd={stop}
        />
      </div>

      <div className="flex items-center justify-between mt-2.5">
        <button
          onClick={clear}
          disabled={!hasStrokes || disabled}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all disabled:opacity-35"
          style={{ color:'var(--t3)', background:'var(--card-bg)', border:'1px solid var(--card-border)' }}>
          <Trash2 size={12}/> Limpiar
        </button>
        <button
          onClick={capture}
          disabled={!hasStrokes || disabled}
          className="flex items-center gap-1.5 text-xs font-bold px-4 py-1.5 rounded-lg transition-all duration-150 disabled:opacity-35 active:scale-95"
          style={{
            background: hasStrokes && !disabled ? 'white' : 'var(--card-bg)',
            color:      hasStrokes && !disabled ? '#000'  : 'var(--t4)',
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
      <p className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color:'var(--t3)' }}>{label}</p>
      <button
        type="button"
        onClick={() => ref.current?.click()}
        disabled={disabled}
        className="w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all active:scale-[.98] disabled:opacity-50"
        style={{
          background:  file ? 'var(--good-soft)' : 'var(--soft-bg)',
          border:     `1px solid ${file ? 'var(--good-soft)' : 'var(--card-bg)'}`,
        }}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{
          background: file ? 'var(--good-soft)' : 'var(--card-bg)',
        }}>
          {file
            ? <CheckCircle2 size={16} style={{ color:'var(--good)' }}/>
            : <Icon         size={16} style={{ color:'var(--t3)' }}/>
          }
        </div>
        <div className="flex-1 min-w-0">
          {file
            ? <p className="text-xs font-semibold truncate" style={{ color:'var(--good)' }}>{file}</p>
            : <p className="text-xs"                        style={{ color:'var(--t3)' }}>Subir archivo (PDF, JPG, PNG)</p>
          }
        </div>
        {!file && <Upload size={13} style={{ color:'var(--t4)', flexShrink:0 }}/>}
      </button>
      <input
        ref={ref} type="file" className="hidden"
        accept=".pdf,.jpg,.jpeg,.png"
        onChange={e => onChange(e.target.files[0]?.name ?? null)}
      />
    </div>
  )
}

// ── Subida del PDF firmado a mano ─────────────────────────────────────────────
function HandSignedUpload({ file, onChange }) {
  const ref = useRef(null)
  return (
    <>
      <button type="button" onClick={() => ref.current?.click()}
        className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg transition-all active:scale-95"
        style={{
          background: file ? 'var(--good-soft)' : 'var(--card-bg)',
          border: `1px solid ${file ? 'var(--good-soft)' : 'var(--card-border)'}`,
          color: file ? 'var(--good)' : 'var(--t2)',
        }}>
        {file ? <CheckCircle2 size={13}/> : <Upload size={13}/>}
        {file ? file.name : 'Subir PDF firmado'}
      </button>
      <input ref={ref} type="file" className="hidden" accept="application/pdf"
        onChange={e => {
          const f = e.target.files[0]
          onChange(f ? { name: f.name, file: f } : null)
        }}/>
    </>
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
  const { student: s } = useStudentData()

  const [tab,        setTab]        = useState('tc')
  const [signature,  setSignature]  = useState(null)
  const [curpFile,   setCurpFile]   = useState(null)
  const [ineFile,    setIneFile]    = useState(null)
  const [signed,     setSigned]     = useState(false)
  const [signedAt,   setSignedAt]   = useState(null)
  const [tcRead,     setTcRead]     = useState(false)
  const [privRead,   setPrivRead]   = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [handSignedFile, setHandSignedFile] = useState(null) // { name, file } — firmado a mano, no persiste en Supabase todavía
  const [documents, setDocuments] = useState([])
  const [termsDocument, setTermsDocument] = useState(null)
  const [uploading, setUploading] = useState(null)
  const [garantiaAlumno, setGarantiaAlumno] = useState(null)
  const [garantiaTutor, setGarantiaTutor] = useState(null)
  const [garantiaSaved, setGarantiaSaved] = useState(false)
  const [formError, setFormError] = useState('')
  const [signatureTarget, setSignatureTarget] = useState('terms')
  const handSignedUrl = handSignedFile?.file ? URL.createObjectURL(handSignedFile.file) : null

  useEffect(() => () => { if (handSignedUrl) URL.revokeObjectURL(handSignedUrl) }, [handSignedUrl])

  // Sincroniza el estado de firma con lo registrado en la BD.
  useEffect(() => {
    if (!s) return
    const isSigned = s.termsStatus === 'firmado'
    setSigned(isSigned)
    if (s.signatureDataUrl) setSignature(s.signatureDataUrl)
    setTcRead(r => r || isSigned)
    setPrivRead(r => r || isSigned)
    setSignedAt(s.signedAt
      ? new Date(s.signedAt).toLocaleDateString('es-MX', { year:'numeric', month:'long', day:'numeric', hour:'2-digit', minute:'2-digit' })
      : null)
  }, [s])

  useEffect(() => { if (s?.id) fetchDocumentos(s.id).then(setDocuments).catch(()=>{}) }, [s?.id])
  useEffect(() => { fetchTerminosActivo().then(setTermsDocument).catch(()=>{}) }, [])
  const termsPdfUrl = termsDocument?.url ?? TERMS_PDF_URL

  if (!s) return null

  const hasSignature = !!signature
  const hasCurp = documents.some(d=>d.document_type === 'curp')
  const hasIne = documents.some(d=>d.document_type === 'ine_tutor')
  const canSign = hasSignature && hasCurp && hasIne && tcRead && privRead && !signed

  const checklist = [
    { ok: tcRead,       label:'Términos y Condiciones leídos' },
    { ok: privRead,     label:'Aviso de Privacidad leído' },
    { ok: hasCurp,      label:'CURP subida' },
    { ok: hasIne,       label:'INE del tutor subida' },
    { ok: hasSignature, label:'Firma digital capturada' },
  ]

  const handleDownloadStamped = () => {
    downloadStampedPdf({
      studentName: s.name, tcText: TC_TEXT, privText: PRIV_TEXT,
      signatureDataUrl: signature, signedAt: signedAt ?? new Date().toLocaleDateString('es-MX', { year:'numeric', month:'long', day:'numeric' }),
      termsPdfUrl,
    })
  }

  const handleDownloadBlank = () => {
    const link = document.createElement('a')
    link.href = termsPdfUrl
    link.download = 'TERMINOS_Y_CONDICIONES_ECOEMS_Y_UNIVERSIDAD.pdf'
    link.click()
  }

  const handleSign = async () => {
    if (!canSign) return
    setSubmitting(true)
    try {
      // Persiste la firma en Supabase (students.terms_status / signed_at)
      const res = await signTerms(s.id, signature)
      const when = res?.signedAt ? new Date(res.signedAt) : new Date()
      setSigned(true)
      setSignedAt(when.toLocaleDateString('es-MX', {
        year:'numeric', month:'long', day:'numeric', hour:'2-digit', minute:'2-digit',
      }))
    } catch {
      // sin conexión: se mantiene pendiente para reintentar
    } finally {
      setSubmitting(false)
    }
  }

  const uploadDoc = async (type, file) => {
    if (!file) return
    setUploading(type)
    try {
      await subirDocumento(s.id,type,file)
      setDocuments(await fetchDocumentos(s.id))
      if (type==='curp') setCurpFile(file); else setIneFile(file)
    } finally { setUploading(null) }
  }

  const saveGuarantee = async () => {
    if (!garantiaAlumno || !garantiaTutor) return
    setSubmitting(true)
    setFormError('')
    try { await guardarGarantia(s.id,garantiaAlumno,garantiaTutor); setGarantiaSaved(true) }
    catch (error) { setFormError(error?.message || 'No se pudo guardar la garantía. El backend todavía no está disponible.') }
    finally { setSubmitting(false) }
  }

  const TABS = [
    { id:'tc',    label:'Términos y Condiciones', short:'T&C',       icon: FileText },
    { id:'priv',  label:'Aviso de Privacidad',    short:'Privacidad', icon: Shield   },
    { id:'firma', label:'Firma y Documentos',     short:'Firma',      icon: PenLine  },
  ]

  return (
    <div className="w-full min-w-0 space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="page-title">Términos y Condiciones</h1>
          <p className="text-sm mt-1" style={{ color:'var(--t3)' }}>
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
        <div className="flex gap-3 p-4 rounded-xl" style={{ background:'var(--warn-soft)', border:'1px solid var(--warn-soft)' }}>
          <AlertTriangle size={16} style={{ color:'var(--warn)', flexShrink:0, marginTop:2 }}/>
          <div>
            <p className="text-sm font-semibold" style={{ color:'var(--warn)' }}>Acceso pendiente de activación</p>
            <p className="text-xs mt-0.5" style={{ color:'var(--t3)' }}>
              Lee los documentos, sube tu CURP e INE del tutor, y dibuja tu firma para completar el registro.
              La validez de la firma es responsabilidad enteramente del alumno.
            </p>
          </div>
        </div>
      )}
      {signed && (
        <div className="flex gap-3 p-4 rounded-xl" style={{ background:'var(--good-soft)', border:'1px solid var(--good-soft)' }}>
          <CheckCircle2 size={16} style={{ color:'var(--good)', flexShrink:0, marginTop:2 }}/>
          <div>
            <p className="text-sm font-semibold" style={{ color:'var(--good)' }}>Documentos firmados</p>
            <p className="text-xs mt-0.5" style={{ color:'var(--t3)' }}>
              Firmado el {signedAt}. Tu firma fue guardada en tu perfil.
            </p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl overflow-x-auto scroll-carril" style={{ background:'var(--soft-bg)', border:'1px solid var(--card-border)' }}>
        {TABS.map(t => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={clsx(
                'flex-1 min-w-[96px] flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-semibold transition-all',
                active ? 'bg-white text-black' : 'hover:text-white/70'
              )}
              style={{ color: active ? '#000' : 'var(--t3)' }}>
              <Icon size={13}/>
              <span className="hidden sm:inline">{t.label}</span>
              <span className="sm:hidden">{t.short}</span>
            </button>
          )
        })}
      </div>

      {/* ── Tab T&C ──────────────────────────────────────────────── */}
      {tab === 'tc' && (
        <div className="card p-3 sm:p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="section-title">Términos y Condiciones ECOEMS y Universidad</h2>
              <p className="text-xs mt-1" style={{ color:'var(--t3)' }}>Documento oficial vigente proporcionado por CEFIMAT.</p>
            </div>
            <a href={termsPdfUrl} download="TERMINOS_Y_CONDICIONES_ECOEMS_Y_UNIVERSIDAD.pdf"
              className="btn-secondary justify-center text-xs flex-shrink-0">
              <Download size={13}/> Descargar PDF
            </a>
          </div>
          <div className="rounded-xl overflow-hidden" style={{ border:'1px solid var(--card-border)', background:'var(--soft-bg)' }}>
            <object data={termsPdfUrl} type="application/pdf"
              className="block w-full h-[62vh] min-h-[420px] sm:min-h-[620px]">
              <div className="p-8 text-center">
                <p className="text-sm" style={{ color:'var(--t3)' }}>Tu navegador no puede mostrar el PDF aquí.</p>
                <a href={termsPdfUrl} target="_blank" rel="noreferrer" className="btn-primary inline-flex mt-3">Abrir documento</a>
              </div>
            </object>
          </div>
          {!tcRead
            ? (
              <button onClick={() => setTcRead(true)} className="btn-primary w-full justify-center">
                <CheckCircle2 size={15}/> He leído y acepto los Términos y Condiciones
              </button>
            )
            : (
              <div className="flex items-center gap-2 p-3 rounded-xl" style={{ background:'var(--good-soft)', border:'1px solid var(--good-soft)' }}>
                <CheckCircle2 size={14} style={{ color:'var(--good)' }}/>
                <span className="text-xs font-semibold" style={{ color:'var(--good)' }}>Leídos y aceptados</span>
              </div>
            )
          }
        </div>
      )}

      {/* ── Tab Privacidad ───────────────────────────────────────── */}
      {tab === 'priv' && (
        <div className="card p-5 space-y-4">
          <div className="max-h-64 overflow-y-auto pr-1 text-xs leading-relaxed" style={{ color:'var(--t2)', whiteSpace:'pre-line' }}>
            {PRIV_TEXT}
          </div>
          {!privRead
            ? (
              <button onClick={() => setPrivRead(true)} className="btn-primary w-full justify-center">
                <CheckCircle2 size={15}/> He leído el Aviso de Privacidad
              </button>
            )
            : (
              <div className="flex items-center gap-2 p-3 rounded-xl" style={{ background:'var(--good-soft)', border:'1px solid var(--good-soft)' }}>
                <CheckCircle2 size={14} style={{ color:'var(--good)' }}/>
                <span className="text-xs font-semibold" style={{ color:'var(--good)' }}>Leído y aceptado</span>
              </div>
            )
          }
        </div>
      )}

      {/* ── Tab Firma y Documentos ───────────────────────────────── */}
      {tab === 'firma' && (
        <div className="space-y-4">
          {formError && <div className="rounded-xl p-3 text-xs" style={{background:'var(--bad-soft)',border:'1px solid var(--bad-line)',color:'var(--bad)'}}>{formError}</div>}

          {/* Documentos */}
          <div className="card p-5 space-y-4">
            <h2 className="section-title">Documentos</h2>
            <DocUpload label={uploading==='curp'?'Subiendo CURP…':'CURP del alumno'} icon={FileText} file={curpFile ?? (hasCurp?{name:documents.find(d=>d.document_type==='curp')?.file_name}:null)} onChange={f=>uploadDoc('curp',f)} disabled={uploading==='curp'}/>
            <DocUpload label={uploading==='ine_tutor'?'Subiendo INE…':'INE / Identificación del tutor'} icon={Shield} file={ineFile ?? (hasIne?{name:documents.find(d=>d.document_type==='ine_tutor')?.file_name}:null)} onChange={f=>uploadDoc('ine_tutor',f)} disabled={uploading==='ine_tutor'}/>
          </div>

          <div className="card p-5 space-y-4">
            <div>
              <h2 className="section-title">Capturar firma</h2>
              <p className="text-xs mt-1" style={{color:'var(--t3)'}}>Se utiliza una sola caja; elige dónde guardar cada firma.</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                ['terms','T&C',signature],['guarantee_student','Garantía alumno',garantiaAlumno],['guarantee_tutor','Garantía tutor',garantiaTutor],
              ].map(([id,label,value])=><button key={id} onClick={()=>setSignatureTarget(id)}
                className="rounded-xl px-2 py-2 text-[10px] sm:text-xs font-bold"
                style={{background:signatureTarget===id?'var(--accent)':'var(--soft-bg)',color:signatureTarget===id?'#fff':'var(--t2)',border:'1px solid var(--card-border)'}}>
                {value?'✓ ':''}{label}
              </button>)}
            </div>
            {!(signatureTarget==='terms'&&signed) && !(signatureTarget!=='terms'&&garantiaSaved) && (
              <SignaturePad onCapture={value=>{
                if(signatureTarget==='terms') setSignature(value)
                else if(signatureTarget==='guarantee_student') setGarantiaAlumno(value)
                else setGarantiaTutor(value)
              }}/>
            )}
            {(signatureTarget==='terms'?signature:signatureTarget==='guarantee_student'?garantiaAlumno:garantiaTutor) &&
              <div className="rounded-xl p-3" style={{background:'var(--soft-bg)',border:'1px solid var(--card-border)'}}>
                <p className="text-[10px] font-bold mb-2" style={{color:'var(--t3)'}}>Vista previa de la firma seleccionada</p>
                <img src={signatureTarget==='terms'?signature:signatureTarget==='guarantee_student'?garantiaAlumno:garantiaTutor}
                  alt="Vista previa de firma" className="max-h-24 mx-auto"/>
              </div>}
          </div>

          <div className="card p-5 space-y-4">
            <div><h2 className="section-title">Garantía</h2><p className="text-xs mt-1" style={{color:'var(--t3)'}}>El alumno y el tutor aceptan la garantía y firman de manera independiente.</p></div>
            {garantiaSaved ? <div className="flex gap-2 text-sm" style={{color:'var(--good)'}}><CheckCircle2 size={16}/> Garantía entregada; administración debe validarla.</div> : <>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-xl p-3" style={{background:'var(--soft-bg)',border:'1px solid var(--card-border)',color:garantiaAlumno?'var(--good)':'var(--t3)'}}>{garantiaAlumno?'✓':'○'} Firma del alumno</div>
                <div className="rounded-xl p-3" style={{background:'var(--soft-bg)',border:'1px solid var(--card-border)',color:garantiaTutor?'var(--good)':'var(--t3)'}}>{garantiaTutor?'✓':'○'} Firma del tutor</div>
              </div>
              <button type="button" onClick={saveGuarantee} disabled={!garantiaAlumno||!garantiaTutor||submitting} className="btn-primary w-full justify-center"><FileSignature size={15}/> Aceptar y entregar garantía</button>
            </>}
          </div>

          {/* Firma */}
          <div className="card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="section-title">Firma digital</h2>
              {signed && (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background:'var(--good-soft)', color:'var(--good)', border:'1px solid var(--good-soft)' }}>
                  Guardada
                </span>
              )}
            </div>

            {/* Firma existente */}
            {signed && signature && (
              <div className="space-y-2">
                <div className="rounded-xl p-3" style={{ background:'var(--soft-bg)', border:'1px solid var(--card-border)' }}>
                  <img src={signature} alt="Firma guardada" className="max-h-28 mx-auto block"/>
                </div>
                <p className="text-[11px]" style={{ color:'var(--t4)' }}>
                  Firmado el {signedAt}
                </p>
                <button onClick={handleDownloadStamped}
                  className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg transition-all active:scale-95"
                  style={{ background:'var(--card-bg)', border:'1px solid var(--card-border)', color:'var(--t2)' }}>
                  <Download size={13}/> Descargar Términos con mi firma
                </button>
              </div>
            )}
            {signed && !signature && (
              <p className="text-xs" style={{ color:'var(--t3)' }}>Firma registrada en el sistema.</p>
            )}

            {/* Canvas */}
            {!signed && (
              <>
                {signature && (
                  <div className="flex items-center gap-2 p-2.5 rounded-xl" style={{ background:'var(--good-soft)', border:'1px solid var(--good-soft)' }}>
                    <CheckCircle2 size={13} style={{ color:'var(--good)' }}/>
                    <span className="text-xs font-semibold flex-1" style={{ color:'var(--good)' }}>Firma capturada</span>
                    <button onClick={() => setSignature(null)} className="text-[11px]" style={{ color:'var(--bad-line)' }}>
                      Volver a dibujar
                    </button>
                  </div>
                )}
                {signature && (
                  <button onClick={handleDownloadStamped}
                    className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg transition-all active:scale-95"
                    style={{ background:'var(--card-bg)', border:'1px solid var(--card-border)', color:'var(--t2)' }}>
                    <Download size={13}/> Descargar PDF con firma digital
                  </button>
                )}

                {/* Alternativa: firmar a mano */}
                <div className="pt-3 space-y-2.5" style={{ borderTop:'1px dashed var(--card-border)' }}>
                  <p className="text-xs font-semibold" style={{ color:'var(--t3)' }}>¿Prefieres firmar a mano?</p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button onClick={handleDownloadBlank}
                      className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg transition-all active:scale-95"
                      style={{ background:'var(--card-bg)', border:'1px solid var(--card-border)', color:'var(--t2)' }}>
                      <FileSignature size={13}/> Descargar PDF en blanco
                    </button>
                    <HandSignedUpload file={handSignedFile} onChange={setHandSignedFile}/>
                  </div>
                  {handSignedUrl && (
                    <div className="rounded-xl overflow-hidden" style={{ border:'1px solid var(--good-line)', background:'var(--soft-bg)' }}>
                      <div className="flex items-center justify-between gap-2 px-3 py-2" style={{ borderBottom:'1px solid var(--divider)' }}>
                        <span className="text-xs font-semibold truncate" style={{ color:'var(--good)' }}>{handSignedFile.name}</span>
                        <button onClick={() => setHandSignedFile(null)} className="text-xs" style={{ color:'var(--bad)' }}>Quitar</button>
                      </div>
                      <object data={handSignedUrl} type="application/pdf" className="block w-full h-[52vh] min-h-[360px]">
                        <p className="p-4 text-xs" style={{ color:'var(--t3)' }}>Vista previa no disponible.</p>
                      </object>
                    </div>
                  )}
                  <p className="text-[10px]" style={{ color:'var(--t4)' }}>
                    Descarga, fírmalo a mano y vuelve a subirlo aquí. El PDF que subas se adjunta a tu registro localmente por ahora —
                    la subida permanente a almacenamiento seguro está pendiente de habilitarse por el administrador.
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Checklist + botón */}
          {!signed && (
            <>
              <div className="card p-4 space-y-2.5">
                <p className="text-[11px] font-bold uppercase tracking-wider mb-3" style={{ color:'var(--t4)' }}>
                  Requisitos para firmar
                </p>
                {checklist.map(({ ok, label }) => (
                  <div key={label} className="flex items-center gap-2.5 text-xs">
                    <span className={clsx('w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 transition-all', ok ? 'bg-emerald-500/20' : 'bg-white/5')}>
                      {ok
                        ? <Check size={10} style={{ color:'var(--good)' }}/>
                        : <span className="w-1.5 h-1.5 rounded-full bg-white/15"/>
                      }
                    </span>
                    <span style={{ color: ok ? 'var(--t2)' : 'var(--t4)' }}>{label}</span>
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

              <p className="text-[11px] text-center" style={{ color:'var(--card-border)' }}>
                La validez de la firma es responsabilidad enteramente del alumno.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  )
}
