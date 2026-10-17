import { useState, useRef, useEffect } from 'react'
import { useStudentData } from '../../hooks/useStudentData'
import { signTerms } from '../../lib/supabaseData'
import {
  CheckCircle2, Clock, FileText, Shield, PenLine, Upload, Trash2, Check,
  AlertTriangle, Download, FileSignature, ArrowRight, ArrowLeft, PartyPopper,
  XCircle, Minus, RotateCcw, ChevronDown,
} from 'lucide-react'
import { downloadStampedPdf } from '../../lib/termsPdf'
import { fetchDocumentos, subirDocumento, guardarGarantia, fetchTerminosActivo } from '../../lib/expedienteData'
import { estadoExpediente, leerLectura, guardarLectura } from '../../lib/estadoTerminos'
import { estadoPerfil } from './EstadoPagina'
import ModalPortal from '../../components/ui/ModalPortal'
import { BotonAyuda } from '../../components/ui/Ayuda'

const TERMS_PDF_URL = '/docs/terminos-condiciones-ecoems-universidad.pdf'

// ── Canvas de firma ──────────────────────────────────────────────────────────
/* Al pulsar "Usar esta firma" la caja entera se pinta de verde y se bloquea:
   no hay vista previa aparte, la propia caja confirma que la firma quedó
   lista. "Volver a dibujar" la libera. `capturada` viene del padre, así que
   al volver a este paso la caja aparece ya en verde. */
function SignaturePad({ onCapture, capturada = false, disabled }) {
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
      // La firma es un documento, no parte del tema: tinta oscura fija sobre
      // un canvas blanco (el "papel"). Con la tinta del tema, en el modo
      // oscuro el PNG guardado quedaba blanco translúcido e invisible en el
      // PDF y en el panel claro del admin.
      ctx.strokeStyle = '#0f172a'
      ctx.lineWidth   = 2.5
      ctx.lineCap     = 'round'
      ctx.lineJoin    = 'round'
    }, 60)
    return () => clearTimeout(id)
  }, [])

  const bloqueado = disabled || capturada

  const getPos = e => {
    const rect = canvasRef.current.getBoundingClientRect()
    const src  = e.touches ? e.touches[0] : e
    return { x: src.clientX - rect.left, y: src.clientY - rect.top }
  }
  const start = e => {
    if (bloqueado) return
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

  return (
    <div>
      <div className="relative rounded-xl overflow-hidden transition-colors" style={{
        border: capturada ? '2px solid var(--good-solid)' : '1.5px dashed var(--card-border)',
      }}>
        {!hasStrokes && !capturada && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-1 pointer-events-none select-none" style={{ color:'#64748b' }}>
            <PenLine size={22}/>
            <p className="text-xs">Dibuja tu firma aquí con el dedo o el ratón</p>
          </div>
        )}
        {capturada && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-1.5 pointer-events-none select-none"
            style={{ background:'color-mix(in srgb, var(--good-solid) 18%, transparent)' }}>
            <span className="w-11 h-11 rounded-full flex items-center justify-center text-white" style={{ background:'var(--good-solid)' }}>
              <Check size={22} strokeWidth={3}/>
            </span>
            <p className="text-sm font-bold px-3 py-1 rounded-full text-white" style={{ background:'var(--good-solid)' }}>Firma lista</p>
          </div>
        )}
        <canvas
          ref={canvasRef}
          className="block w-full"
          style={{ height: 'clamp(160px, 28vw, 220px)', touchAction:'none', cursor: bloqueado ? 'default' : 'crosshair', background:'#ffffff' }}
          onMouseDown={start} onMouseMove={move} onMouseUp={stop} onMouseLeave={stop}
          onTouchStart={start} onTouchMove={move} onTouchEnd={stop}
        />
      </div>

      <div className="flex items-center justify-between gap-2 mt-2.5">
        {capturada ? (
          <button type="button" onClick={() => { clear(); onCapture(null) }} disabled={disabled}
            className="btn-secondary justify-center text-xs min-h-11">
            <RotateCcw size={13}/> Volver a dibujar
          </button>
        ) : (
          <>
            <button type="button" onClick={clear} disabled={!hasStrokes || disabled}
              className="btn-secondary justify-center text-xs min-h-11 disabled:opacity-40">
              <Trash2 size={13}/> Limpiar
            </button>
            <button type="button" onClick={() => onCapture(canvasRef.current.toDataURL('image/png'))}
              disabled={!hasStrokes || disabled}
              className="btn-primary justify-center text-xs min-h-11 disabled:opacity-40">
              <Check size={13}/> Usar esta firma
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ── Subida de documento ──────────────────────────────────────────────────────
/* `onChange` entrega el File, no su nombre. Antes pasaba `files[0].name` —una
   cadena— y `subirDocumento` hacia `file.name.split(...)` sobre ella: reventaba
   antes de tocar la red, asi que NINGÚN documento llegaba a subirse. El nombre
   a mostrar se recibe aparte, ya sea del archivo recien elegido o del que la
   base de datos tenga registrado. */
function DocUpload({ label, icon: Icon, fileName, estado, onChange, disabled, motivo }) {
  const ref = useRef(null)
  const ok = !!fileName
  const tono = estado === 'validado' ? 'good' : estado === 'rechazado' ? 'bad' : ok ? 'warn' : null
  const color = tono ? `var(--${tono})` : 'var(--t3)'
  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color:'var(--t3)' }}>{label}</p>
        {estado && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{ background:`var(--${tono}-soft)`, color, border:`1px solid var(--${tono}-line)` }}>
            {estado === 'validado' ? 'Validado' : estado === 'rechazado' ? 'Rechazado' : 'En revisión'}
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={() => ref.current?.click()}
        disabled={disabled}
        className="w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all active:scale-[.98] disabled:opacity-50"
        style={{
          background:  ok ? `var(--${tono}-soft)` : 'var(--soft-bg)',
          border:     `1px solid ${ok ? `var(--${tono}-line)` : 'var(--card-border)'}`,
        }}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{
          background: ok ? `var(--${tono}-soft)` : 'var(--card-bg)',
        }}>
          {ok
            ? <CheckCircle2 size={16} style={{ color }}/>
            : <Icon         size={16} style={{ color:'var(--t3)' }}/>
          }
        </div>
        <div className="flex-1 min-w-0">
          {ok
            ? <>
                <p className="text-xs font-semibold truncate" style={{ color }}>{fileName}</p>
                <p className="text-[10px]" style={{ color:'var(--t3)' }}>Toca para reemplazarlo</p>
              </>
            : <p className="text-xs" style={{ color:'var(--t3)' }}>Subir archivo (PDF, JPG, PNG · máx. 10 MB)</p>
          }
        </div>
        <Upload size={13} style={{ color:'var(--t4)', flexShrink:0 }}/>
      </button>
      {estado === 'rechazado' && motivo && (
        <p className="text-[11px] mt-1.5" style={{ color:'var(--bad)' }}>Motivo: {motivo}</p>
      )}
      <input
        ref={ref} type="file" className="hidden"
        accept=".pdf,.jpg,.jpeg,.png,.webp"
        onChange={e => {
          const f = e.target.files?.[0]
          e.target.value = ''          // permite volver a elegir el mismo archivo
          if (f) onChange(f)
        }}
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
        className="flex-1 min-h-11 flex items-center justify-center gap-1.5 text-xs font-semibold px-3 rounded-xl transition-all active:scale-95"
        style={{
          background: file ? 'var(--good-soft)' : 'var(--soft-bg)',
          border: `1px solid ${file ? 'var(--good-line)' : 'var(--card-border)'}`,
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

// Respaldo legible cuando el PDF institucional no puede mostrarse.
const TC_TEXT = `TÉRMINOS Y CONDICIONES — CEFIMAT
Versión institucional vigente: agosto de 2026

1. SERVICIOS
CEFIMAT provee servicios educativos de preparación para exámenes de admisión a nivel superior (UNAM, IPN, ECOEMS y otras instituciones).

2. GARANTÍA CEFIMAT
La garantía de repetición del curso sin costo aplica cuando el alumno cumple simultáneamente con:
  a) Asistencia mínima del 90% (considerando la regla de 3 retardos = 1 inasistencia)
  b) Haber presentado todos los exámenes de simulación
  c) Entregar todas las tareas asignadas y obtener una calificación mínima del 80% en cada una

El incumplimiento de cualquiera de los tres requisitos anula la garantía de forma definitiva.

3. RETARDOS
Tres (3) retardos equivalen a una (1) inasistencia para efectos del cálculo del porcentaje de asistencia.

4. OBLIGACIONES DEL ALUMNO
El alumno se compromete a asistir puntualmente, entregar tareas en tiempo y forma, y presentar todos los simulacros programados.

5. VALIDEZ DE LA FIRMA
La firma digital registrada en esta plataforma tiene carácter de compromiso del alumno. Su validez es responsabilidad exclusiva del firmante.`

const PRIV_TEXT = `AVISO DE PRIVACIDAD — CEFIMAT
Versión institucional vigente: agosto de 2026

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

CONSERVACIÓN Y SEGURIDAD
La información se conserva durante el tiempo necesario para prestar los servicios educativos y atender las obligaciones aplicables. CEFIMAT aplica controles administrativos y técnicos para evitar acceso, alteración o divulgación no autorizados.

TUS DERECHOS (ARCO)
Puedes ejercer tus derechos de Acceso, Rectificación, Cancelación y Oposición escribiendo a privacidad@cefimat.mx.

TRANSFERENCIAS Y CAMBIOS
Tus datos no serán transferidos a terceros sin tu consentimiento previo, salvo las excepciones previstas en la Ley Federal de Protección de Datos Personales. Los cambios sustanciales a este aviso se comunicarán por esta plataforma o por los medios de contacto registrados.`

// ── Asistente ────────────────────────────────────────────────────────────────
/* Antes eran tres pestañas con todo a la vista y el alumno no sabía por dónde
   empezar ni cuándo había terminado. Ahora es un camino de 5 pasos: se ve solo
   el paso actual, cada uno dice qué hacer, al completarlo aparece un aviso con
   el siguiente y al final un aviso de "en espera de validación". */
const PASOS = [
  // Primero el Aviso de Privacidad y luego los Términos (pedido de CEFIMAT).
  { id:'priv',     titulo:'Leer el Aviso de Privacidad',     corto:'Privacidad', icon:Shield,
    explica:'Te dice qué datos tuyos guarda CEFIMAT, para qué y cuáles son tus derechos.' },
  { id:'tc',       titulo:'Leer los Términos y Condiciones', corto:'Términos',   icon:FileText,
    explica:'Lee el documento oficial de CEFIMAT. Explica la garantía del curso, la regla de retardos y tus obligaciones.' },
  { id:'docs',     titulo:'Subir tus documentos',            corto:'Documentos', icon:Upload,
    explica:'Sube tu CURP y la identificación (INE) de tu tutor. Sirve una foto clara o un PDF.' },
  { id:'garantia', titulo:'Firmar la garantía del curso',    corto:'Garantía',   icon:FileSignature,
    explica:'Con tu firma aceptas las condiciones de la garantía: 90 % de asistencia, todos los simulacros, todas las tareas y mínimo un 80 % en cada tarea.' },
  { id:'firma',    titulo:'Firmar y enviar',                 corto:'Firma',      icon:PenLine,
    explica:'Último paso: firma los Términos y envía tu expediente para que administración lo revise.' },
]
const pasoInfo = id => PASOS.find(p => p.id === id)

/** Círculo de un paso en la línea de progreso. */
function CirculoPaso({ n, estado, actual }) {
  if (estado === 'hecho') return (
    <span className="w-9 h-9 rounded-full flex items-center justify-center text-white flex-shrink-0" style={{ background:'var(--good-solid)' }}>
      <Check size={17} strokeWidth={3}/>
    </span>
  )
  if (estado === 'rechazado') return (
    <span className="w-9 h-9 rounded-full flex items-center justify-center text-white flex-shrink-0" style={{ background:'var(--bad-solid)' }}>
      <Minus size={18} strokeWidth={3}/>
    </span>
  )
  return (
    <span className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
      style={actual
        ? { background:'var(--accent)', color:'var(--accent-contrast)', boxShadow:'0 0 0 3px var(--card-bg), 0 0 0 5px var(--accent)' }
        : { background:'var(--soft-bg)', color:'var(--t3)', border:'1px solid var(--card-border)' }}>
      {n}
    </span>
  )
}

/** Fila de requisito con su casilla (verde al cumplirse). */
function Requisito({ ok, children }) {
  return (
    <div className="flex items-center gap-2.5 text-sm">
      <span className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 text-white transition-colors"
        style={ok ? { background:'var(--good-solid)' } : { background:'var(--soft-bg)', border:'1px solid var(--card-border)' }}>
        {ok && <Check size={14} strokeWidth={3}/>}
      </span>
      <span style={{ color: ok ? 'var(--t1)' : 'var(--t3)' }}>{children}</span>
    </div>
  )
}

/** Caja verde de "paso hecho". */
function Hecho({ children }) {
  return (
    <div className="flex items-center gap-2.5 p-3 rounded-xl" style={{ background:'var(--good-soft)', border:'1px solid var(--good-line)' }}>
      <span className="w-7 h-7 rounded-full flex items-center justify-center text-white flex-shrink-0" style={{ background:'var(--good-solid)' }}>
        <Check size={15} strokeWidth={3}/>
      </span>
      <span className="text-sm font-semibold" style={{ color:'var(--good)' }}>{children}</span>
    </div>
  )
}

/** Aviso de rechazo con el motivo que puso administración. */
function Rechazo({ motivo, children }) {
  return (
    <div role="alert" className="flex gap-2.5 p-3 rounded-xl" style={{ background:'var(--bad-soft)', border:'1px solid var(--bad-line)' }}>
      <XCircle size={18} className="flex-shrink-0 mt-px" style={{ color:'var(--bad)' }}/>
      <div className="text-sm" style={{ color:'var(--bad)' }}>
        <p className="font-semibold">{children}</p>
        {motivo && <p className="text-xs mt-0.5">Motivo: {motivo}</p>}
      </div>
    </div>
  )
}

// ── Página principal ─────────────────────────────────────────────────────────
export default function Terms() {
  const { student: s, group, loading, error } = useStudentData()
  // El comprobante de inscripción solo existe para ECOEMS.
  const esEcoems = (group?.curso ?? (group?.institucion === 'ecoems' ? 'ecoems' : null)) === 'ecoems'
  // Universidad con UNAM entre sus instituciones: puede subir su comprobante de examen (opcional).
  const esUnam = !esEcoems && ((group?.instituciones ?? []).includes('unam') || group?.institucion === 'unam')

  const [documents, setDocuments]         = useState([])
  const [termsDocument, setTermsDocument] = useState(null)
  const [lectura, setLectura]             = useState({})
  const [paso, setPaso]                   = useState(null)
  const [signature, setSignature]         = useState(null)   // firma de T&C, aún sin enviar
  const [garantiaFirma, setGarantiaFirma] = useState(null)
  const [firmadoLocal, setFirmadoLocal]   = useState(null)   // { signedAt, signatureDataUrl } tras enviar
  const [garantiaLocal, setGarantiaLocal] = useState(false)
  const [submitting, setSubmitting]       = useState(false)
  const [uploading, setUploading]         = useState(null)
  const [handSignedFile, setHandSignedFile] = useState(null)
  const [formError, setFormError]         = useState('')
  const [nota, setNota]                   = useState('')     // avance parcial ("CURP recibida, falta la INE")
  const [aviso, setAviso]                 = useState(null)   // id del paso recién completado
  const [aMano, setAMano]                 = useState(false)

  useEffect(() => { if (s?.id) setLectura(leerLectura(s.id)) }, [s?.id])
  useEffect(() => { if (s?.id) fetchDocumentos(s.id).then(setDocuments).catch(() => {}) }, [s?.id])
  useEffect(() => { fetchTerminosActivo().then(setTermsDocument).catch(() => {}) }, [])

  // El alumno de useStudentData puede tardar en reflejar lo que se acaba de
  // enviar: se superpone lo hecho en esta sesión para no mostrar un paso
  // "pendiente" que ya se completó.
  const alumno = s && {
    ...s,
    termsStatus: firmadoLocal ? 'firmado' : s.termsStatus,
    garantiaEstado: garantiaLocal && s.garantiaEstado === 'pendiente' ? 'entregada' : s.garantiaEstado,
  }
  const exp = estadoExpediente(alumno, documents, lectura)
  const estadoDe = id => exp.pasos.find(p => p.id === id) ?? { estado:'pendiente' }

  // Paso inicial: el primero rechazado, si no el primero pendiente; con todo
  // hecho se muestra el último (resumen de la firma).
  useEffect(() => {
    if (paso || !s) return
    const rechazado = exp.pasos.find(p => p.estado === 'rechazado')
    const pendiente = exp.pasos.find(p => p.estado !== 'hecho')
    setPaso((rechazado ?? pendiente)?.id ?? 'firma')
  }, [s, paso, exp.pasos])

  const estado = estadoPerfil({ loading, student: s, error })
  if (estado) return estado

  const termsPdfUrl = termsDocument?.url ?? TERMS_PDF_URL
  const signedAtRaw = firmadoLocal?.signedAt ?? s.signedAt
  const signedAt = signedAtRaw
    ? new Date(signedAtRaw).toLocaleDateString('es-MX', { year:'numeric', month:'long', day:'numeric', hour:'2-digit', minute:'2-digit' })
    : null
  const firmaGuardada = firmadoLocal?.signatureDataUrl ?? s.signatureDataUrl ?? null
  const actual = pasoInfo(paso) ?? PASOS[0]
  const idx = PASOS.findIndex(p => p.id === actual.id)
  const estActual = estadoDe(actual.id)
  const siguiente = PASOS[idx + 1]
  const { docs } = exp

  /* Marca el paso como completado y abre el aviso. El aviso se pinta en el
     render siguiente, ya con el estado actualizado, así que sabe cuál toca
     después o si ya terminó todo. */
  const completar = id => { setNota(''); setAviso(id) }

  const marcarLeido = clave => {
    const nueva = { ...lectura, [clave]: true }
    setLectura(nueva)
    guardarLectura(s.id, nueva)
    completar(clave)
  }

  const uploadDoc = async (type, file) => {
    if (!file) return false
    // Las fotos se reducen solas al subirlas (hasta 25 MB); un PDF, hasta 10 MB.
    const esPdf = /.pdf$/i.test(file.name)
    if (file.size > (esPdf ? 10 : 25) * 1024 * 1024) {
      setFormError(esPdf
        ? `"${file.name}" pesa más de 10 MB. Escanéalo con menos resolución o sube fotos.`
        : `"${file.name}" pesa más de 25 MB. Toma la foto de nuevo.`)
      return false
    }
    setUploading(type)
    setFormError('')
    try {
      await subirDocumento(s.id, type, file)
      const nuevos = await fetchDocumentos(s.id)
      setDocuments(nuevos)
      return nuevos
    } catch (e) {
      setFormError(e?.message || 'No se pudo subir el documento. Revisa tu conexión e inténtalo de nuevo.')
      return false
    } finally { setUploading(null) }
  }

  const subirDocDePaso = async (type, file) => {
    const nuevos = await uploadDoc(type, file)
    if (!nuevos) return
    const tiene = t => {
      const d = nuevos.find(x => x.document_type === t)
      return d && d.status !== 'rechazado'
    }
    if (type === 'comprobante_ecoems') { setNota('✓ Comprobante de inscripción ECOEMS recibido.'); return }
    if (type === 'comprobante_unam') { setNota('✓ Comprobante de examen UNAM recibido.'); return }
    if (tiene('curp') && tiene('ine_tutor')) completar('docs')
    else setNota(tiene('curp') ? '✓ CURP recibida. Ahora sube la INE de tu tutor.' : '✓ INE recibida. Ahora sube tu CURP.')
  }

  const entregarGarantia = async () => {
    if (!garantiaFirma) return
    setSubmitting(true)
    setFormError('')
    try { await guardarGarantia(s.id, garantiaFirma); setGarantiaLocal(true); completar('garantia') }
    catch (e) { setFormError(e?.message || 'No se pudo guardar la garantía. Inténtalo de nuevo.') }
    finally { setSubmitting(false) }
  }

  const requisitosFirma = [
    { ok: estadoDe('priv').estado === 'hecho', label:'Leíste el Aviso de Privacidad',     paso:'priv' },
    { ok: estadoDe('tc').estado === 'hecho',   label:'Leíste los Términos y Condiciones', paso:'tc' },
    { ok: estadoDe('docs').estado === 'hecho', label:'Subiste tu CURP y la INE de tu tutor', paso:'docs' },
    // Sin esto se podía "enviar" con la garantía pendiente y el alumno creía
    // haber terminado cuando su expediente seguía incompleto.
    { ok: estadoDe('garantia').estado === 'hecho', label:'Firmaste la garantía del curso', paso:'garantia' },
    { ok: !!signature,                         label:'Dibujaste tu firma' },
  ]
  const puedeFirmar = requisitosFirma.every(r => r.ok) && estadoDe('firma').estado !== 'hecho'

  const firmarYEnviar = async () => {
    if (!puedeFirmar) return
    setSubmitting(true)
    setFormError('')
    try {
      const res = await signTerms(s.id, signature)
      setFirmadoLocal({ signedAt: res?.signedAt ?? new Date().toISOString(), signatureDataUrl: res?.signatureDataUrl ?? signature })
      completar('firma')
    } catch (e) {
      setFormError(e?.message || 'No se pudo guardar tu firma. Revisa tu conexión e inténtalo de nuevo.')
    } finally { setSubmitting(false) }
  }

  const descargarConFirma = () => downloadStampedPdf({
    studentName: s.name, tcText: TC_TEXT, privText: PRIV_TEXT,
    signatureDataUrl: firmaGuardada ?? signature, signedAt: signedAt ?? new Date().toLocaleDateString('es-MX', { year:'numeric', month:'long', day:'numeric' }),
    termsPdfUrl,
  })
  const descargarEnBlanco = () => {
    const link = document.createElement('a')
    link.href = termsPdfUrl
    link.download = 'TERMINOS_Y_CONDICIONES_ECOEMS_Y_UNIVERSIDAD.pdf'
    link.click()
  }

  // ── Aviso al completar un paso ──
  const pendienteTrasAviso = exp.pasos.find(p => p.estado !== 'hecho')
  const terminoTodo = !pendienteTrasAviso

  /* Banner de estado general: los mismos 4 estados que el menú lateral. */
  const BANNER = {
    aceptado: { tono:'good', icon:CheckCircle2,  titulo:'¡Todo en orden!', texto:'Administración validó tu expediente. Tu acceso está activo.' },
    error:    { tono:'bad',  icon:XCircle,       titulo:'Debes volver a subir algo', texto:'Administración rechazó uno o más documentos. Los pasos marcados en rojo te dicen cuál y por qué.' },
    revision: { tono:'info', icon:Clock,         titulo:'Expediente enviado: en espera de validación', texto:'Ya entregaste todo. Administración lo revisará y te avisará con una notificación.' },
    alerta:   { tono:'warn', icon:AlertTriangle, titulo:`Te faltan ${exp.total - exp.hechos} de ${exp.total} pasos`, texto:'Sigue los pasos en orden. Cuando termines, tu expediente se enviará a revisión.' },
  }[exp.estado]
  const BannerIcon = BANNER.icon

  return (
    <div className="w-full min-w-0 space-y-4">

      {/* Encabezado */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="page-title">Términos y Condiciones</h1>
          <p className="text-sm mt-1" style={{ color:'var(--t3)' }}>
            Completa los {exp.total} pasos para activar tu acceso. Te guiamos uno por uno.
          </p>
        </div>
        <BotonAyuda titulo="Términos y Condiciones">
          <p>Para usar SIGA con acceso completo, CEFIMAT necesita tu expediente: aceptar los Términos y el Aviso de Privacidad, tu CURP, la INE de tu tutor, la firma de la garantía y tu firma de los Términos.</p>
          <p><b>Cómo funciona:</b> verás un paso a la vez. Cuando completes uno, te avisaremos cuál sigue. Los pasos terminados se marcan en <b style={{color:'var(--good)'}}>verde ✓</b>.</p>
          <p><b>Después de enviar:</b> administración revisa tus documentos. Si alguno no es válido, el paso se marca en <b style={{color:'var(--bad)'}}>rojo –</b> con el motivo y solo tienes que volver a subirlo.</p>
          <p>En el menú lateral, el icono de "Términos" te dice tu estado: <b>⚠</b> te falta algo, <b>–</b> debes corregir algo, <b>✓</b> todo en orden.</p>
        </BotonAyuda>
      </div>

      {/* Estado general */}
      <div className="flex gap-3 p-4 rounded-xl" style={{ background:`var(--${BANNER.tono}-soft)`, border:`1px solid var(--${BANNER.tono}-line)` }}>
        <BannerIcon size={18} style={{ color:`var(--${BANNER.tono})`, flexShrink:0, marginTop:1 }}/>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold" style={{ color:`var(--${BANNER.tono})` }}>{BANNER.titulo}</p>
          <p className="text-xs mt-0.5" style={{ color:'var(--t2)' }}>{BANNER.texto}</p>
          {exp.estado === 'alerta' && (
            <div className="mt-2.5 h-2 rounded-full overflow-hidden" style={{ background:'var(--soft-bg)' }}
              role="progressbar" aria-valuenow={exp.hechos} aria-valuemin={0} aria-valuemax={exp.total}>
              <div className="h-full rounded-full transition-all" style={{ width:`${(exp.hechos / exp.total) * 100}%`, background:'var(--good-solid)' }}/>
            </div>
          )}
        </div>
      </div>

      {/* Línea de progreso: cada paso es pulsable para volver a él */}
      <nav aria-label="Pasos" className="card p-3 sm:p-4">
        <ol className="flex items-start justify-between gap-1">
          {PASOS.map((p, i) => {
            const est = estadoDe(p.id).estado
            const esActual = p.id === actual.id
            return (
              <li key={p.id} className="flex-1 flex flex-col items-center min-w-0 relative">
                {i > 0 && (
                  <span aria-hidden="true" className="absolute top-[18px] right-1/2 w-full h-0.5 -z-0"
                    style={{ background: estadoDe(PASOS[i - 1].id).estado === 'hecho' ? 'var(--good-solid)' : 'var(--card-border)' }}/>
                )}
                <button type="button" onClick={() => { setPaso(p.id); setNota(''); setFormError('') }}
                  aria-current={esActual ? 'step' : undefined}
                  title={`Paso ${i + 1}: ${p.titulo}${est === 'hecho' ? ' (completado)' : est === 'rechazado' ? ' (rechazado, corrígelo)' : ''}`}
                  className="relative z-10 flex flex-col items-center gap-1.5 min-w-0 rounded-xl px-1 py-0.5">
                  <CirculoPaso n={i + 1} estado={est} actual={esActual}/>
                  <span className={`text-[10px] sm:text-xs font-semibold text-center leading-tight ${esActual ? '' : 'hidden sm:block'}`}
                    style={{ color: esActual ? 'var(--t1)' : est === 'hecho' ? 'var(--good)' : est === 'rechazado' ? 'var(--bad)' : 'var(--t3)' }}>
                    {p.corto}
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
      </nav>

      {/* Paso actual */}
      <section className="card p-4 sm:p-5 space-y-4" aria-labelledby="titulo-paso">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color:'var(--t3)' }}>Paso {idx + 1} de {PASOS.length}</p>
          <h2 id="titulo-paso" className="text-lg font-bold mt-0.5" style={{ color:'var(--t1)' }}>{actual.titulo}</h2>
          <p className="text-sm mt-1" style={{ color:'var(--t2)' }}>{actual.explica}</p>
        </div>

        {formError && (
          <div role="alert" className="flex gap-2 rounded-xl p-3 text-xs" style={{ background:'var(--bad-soft)', border:'1px solid var(--bad-line)', color:'var(--bad)' }}>
            <AlertTriangle size={14} className="flex-shrink-0 mt-px"/> {formError}
          </div>
        )}
        {nota && (
          <div className="rounded-xl p-3 text-sm font-semibold" style={{ background:'var(--good-soft)', border:'1px solid var(--good-line)', color:'var(--good)' }}>{nota}</div>
        )}

        {/* 1 · Términos */}
        {actual.id === 'tc' && (
          <>
            <div className="rounded-xl overflow-hidden" style={{ border:'1px solid var(--card-border)', background:'var(--soft-bg)' }}>
              <object data={termsPdfUrl} type="application/pdf" className="block w-full h-[48vh] min-h-[320px]">
                <div className="p-6 text-center">
                  <p className="text-sm" style={{ color:'var(--t3)' }}>Tu navegador no puede mostrar el PDF aquí.</p>
                  <a href={termsPdfUrl} target="_blank" rel="noreferrer" className="btn-primary inline-flex mt-3">Abrir el documento</a>
                </div>
              </object>
            </div>
            <a href={termsPdfUrl} download="TERMINOS_Y_CONDICIONES_ECOEMS_Y_UNIVERSIDAD.pdf" className="btn-secondary justify-center text-xs w-full">
              <Download size={13}/> Descargar el PDF para leerlo después
            </a>
            {estActual.estado === 'hecho'
              ? <Hecho>Leíste y aceptaste los Términos y Condiciones</Hecho>
              : <button type="button" onClick={() => marcarLeido('tc')} className="btn-primary w-full justify-center min-h-11">
                  <CheckCircle2 size={15}/> Ya los leí y los acepto
                </button>}
          </>
        )}

        {/* 2 · Privacidad */}
        {actual.id === 'priv' && (
          <>
            {/* 75 caracteres por línea como máximo: en monitor el texto legal se
                estiraba a casi 200 y costaba seguir la línea. */}
            <div className="rounded-xl p-4 sm:p-5 text-xs sm:text-sm leading-relaxed max-w-[75ch]" style={{ color:'var(--t2)', whiteSpace:'pre-line', background:'var(--soft-bg)', border:'1px solid var(--card-border)' }}>
              {PRIV_TEXT}
            </div>
            {estActual.estado === 'hecho'
              ? <Hecho>Leíste y aceptaste el Aviso de Privacidad</Hecho>
              : <button type="button" onClick={() => marcarLeido('priv')} className="btn-primary w-full justify-center min-h-11">
                  <CheckCircle2 size={15}/> Ya lo leí y lo acepto
                </button>}
          </>
        )}

        {/* 3 · Documentos */}
        {actual.id === 'docs' && (
          <>
            {estActual.estado === 'rechazado' && <Rechazo motivo={estActual.motivo}>Administración rechazó un documento. Vuelve a subirlo.</Rechazo>}
            <div className="space-y-2">
              <Requisito ok={!!docs.curp && docs.curp.status !== 'rechazado'}>CURP del alumno</Requisito>
              <Requisito ok={!!docs.ine && docs.ine.status !== 'rechazado'}>INE o identificación de tu tutor</Requisito>
            </div>
            <DocUpload
              label={uploading === 'curp' ? 'Subiendo CURP…' : 'CURP del alumno'}
              icon={FileText} fileName={docs.curp?.file_name} estado={docs.curp?.status}
              motivo={docs.curp?.rejection_reason}
              onChange={f => subirDocDePaso('curp', f)} disabled={!!uploading}/>
            <DocUpload
              label={uploading === 'ine_tutor' ? 'Subiendo INE…' : 'INE / identificación del tutor'}
              icon={Shield} fileName={docs.ine?.file_name} estado={docs.ine?.status}
              motivo={docs.ine?.rejection_reason}
              onChange={f => subirDocDePaso('ine_tutor', f)} disabled={!!uploading}/>
            {estActual.estado === 'hecho' && <Hecho>Tus dos documentos están entregados</Hecho>}
            {/* Comprobante ECOEMS: opcional. Muchos alumnos lo reciben después
                de inscribirse, así que no bloquea el paso ni el proceso. */}
            {esEcoems && (
              <div className="pt-3 mt-1 space-y-2" style={{ borderTop:'1px dashed var(--divider)' }}>
                <p className="text-xs" style={{ color:'var(--t3)' }}>
                  <b style={{ color:'var(--t2)' }}>Opcional:</b> si ya tienes tu comprobante de inscripción al examen ECOEMS, súbelo aquí.
                  Si aún no lo tienes, puedes subirlo después: no te impide terminar.
                </p>
                <DocUpload
                  label={uploading === 'comprobante_ecoems' ? 'Subiendo comprobante…' : 'Comprobante de inscripción ECOEMS'}
                  icon={FileText} fileName={docs.ecoems?.file_name} estado={docs.ecoems?.status}
                  motivo={docs.ecoems?.rejection_reason}
                  onChange={f => subirDocDePaso('comprobante_ecoems', f)} disabled={!!uploading}/>
              </div>
            )}
            {/* Comprobante de examen UNAM: igual de opcional que el de ECOEMS. */}
            {esUnam && (
              <div className="pt-3 mt-1 space-y-2" style={{ borderTop:'1px dashed var(--divider)' }}>
                <p className="text-xs" style={{ color:'var(--t3)' }}>
                  <b style={{ color:'var(--t2)' }}>Opcional:</b> si ya tienes tu comprobante del examen de la UNAM, súbelo aquí.
                  Si aún no lo tienes, puedes subirlo después: no te impide terminar.
                </p>
                <DocUpload
                  label={uploading === 'comprobante_unam' ? 'Subiendo comprobante…' : 'Comprobante de examen UNAM'}
                  icon={FileText} fileName={docs.unam?.file_name} estado={docs.unam?.status}
                  motivo={docs.unam?.rejection_reason}
                  onChange={f => subirDocDePaso('comprobante_unam', f)} disabled={!!uploading}/>
              </div>
            )}
          </>
        )}

        {/* 4 · Garantía */}
        {actual.id === 'garantia' && (
          <>
            {estActual.estado === 'rechazado' && <Rechazo motivo={estActual.motivo}>Administración rechazó tu garantía. Fírmala de nuevo.</Rechazo>}
            {alumno.garantiaEstado === 'validada'
              ? <Hecho>Garantía validada por administración</Hecho>
              : estActual.estado === 'hecho'
                ? <Hecho>Garantía entregada. Administración la validará.</Hecho>
                : (
                  <>
                    <SignaturePad capturada={!!garantiaFirma} onCapture={setGarantiaFirma} disabled={submitting}/>
                    <button type="button" onClick={entregarGarantia} disabled={!garantiaFirma || submitting}
                      className="btn-primary w-full justify-center min-h-11 disabled:opacity-40">
                      {submitting ? <span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin"/> : <FileSignature size={15}/>}
                      {submitting ? 'Entregando…' : garantiaFirma ? 'Entregar la garantía' : 'Primero dibuja tu firma'}
                    </button>
                    <details className="rounded-xl p-3" style={{ background:'var(--soft-bg)', border:'1px solid var(--card-border)' }}>
                      <summary className="text-xs font-semibold cursor-pointer min-h-8 flex items-center gap-1.5" style={{ color:'var(--t2)' }}>
                        <ChevronDown size={13}/> ¿La firmaste en papel? Súbela aquí
                      </summary>
                      <div className="pt-3">
                        <DocUpload
                          label={uploading === 'garantia' ? 'Subiendo garantía…' : 'Garantía firmada en papel'}
                          icon={FileSignature} fileName={docs.garantia?.file_name} estado={docs.garantia?.status}
                          motivo={docs.garantia?.rejection_reason}
                          onChange={async f => { if (await uploadDoc('garantia', f)) completar('garantia') }}
                          disabled={!!uploading}/>
                      </div>
                    </details>
                  </>
                )}
          </>
        )}

        {/* 5 · Firma */}
        {actual.id === 'firma' && (
          <>
            {estActual.estado === 'rechazado' && <Rechazo motivo={estActual.motivo}>Administración rechazó el PDF firmado a mano. Vuelve a firmar.</Rechazo>}
            {estActual.estado === 'hecho' ? (
              <>
                <Hecho>{s.termsStatus === 'firmado' || firmadoLocal
                  ? `Firmaste los Términos${signedAt ? ` el ${signedAt}` : ''}`
                  : 'Entregaste los Términos firmados a mano'}</Hecho>
                {(firmaGuardada || signature) && (
                  <button type="button" onClick={descargarConFirma} className="btn-secondary w-full justify-center text-xs min-h-11">
                    <Download size={13}/> Descargar mis Términos firmados
                  </button>
                )}
              </>
            ) : (
              <>
                <div className="space-y-2">
                  {requisitosFirma.map(r => (
                    <div key={r.label} className="flex items-center justify-between gap-2">
                      <Requisito ok={r.ok}>{r.label}</Requisito>
                      {!r.ok && r.paso && (
                        <button type="button" onClick={() => setPaso(r.paso)} className="text-xs font-semibold min-h-9 px-2 rounded-lg" style={{ color:'var(--accent)' }}>
                          Ir a este paso
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <SignaturePad capturada={!!signature} onCapture={setSignature} disabled={submitting}/>
                <button type="button" onClick={firmarYEnviar} disabled={!puedeFirmar || submitting}
                  className="btn-primary w-full justify-center py-3 text-sm min-h-11 disabled:opacity-40">
                  {submitting ? <span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin"/> : <CheckCircle2 size={16}/>}
                  {submitting ? 'Enviando…' : puedeFirmar ? 'Firmar y enviar mi expediente' : 'Completa las casillas de arriba para enviar'}
                </button>
                <p className="text-[11px] text-center" style={{ color:'var(--t3)' }}>La validez de la firma es responsabilidad enteramente del alumno.</p>

                {/* Alternativa: firmar a mano */}
                <div className="pt-3" style={{ borderTop:'1px dashed var(--card-border)' }}>
                  <button type="button" onClick={() => setAMano(v => !v)} aria-expanded={aMano}
                    className="text-xs font-semibold min-h-9 flex items-center gap-1.5" style={{ color:'var(--t2)' }}>
                    <ChevronDown size={13} className={`transition-transform ${aMano ? 'rotate-180' : ''}`}/> ¿Prefieres firmar a mano en papel?
                  </button>
                  {aMano && (
                    <div className="space-y-2.5 pt-2.5">
                      <p className="text-xs" style={{ color:'var(--t3)' }}>Descarga el PDF, fírmalo a mano, escanéalo o tómale foto en PDF y súbelo aquí.</p>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <button type="button" onClick={descargarEnBlanco} className="btn-secondary flex-1 justify-center text-xs min-h-11">
                          <Download size={13}/> Descargar PDF en blanco
                        </button>
                        <HandSignedUpload file={handSignedFile} onChange={setHandSignedFile}/>
                      </div>
                      {handSignedFile && (
                        <button type="button" disabled={uploading === 'terminos'}
                          onClick={async () => { if (await uploadDoc('terminos', handSignedFile.file)) { setHandSignedFile(null); completar('firma') } }}
                          className="btn-primary w-full justify-center text-xs min-h-11 disabled:opacity-50">
                          <Upload size={13}/> {uploading === 'terminos' ? 'Subiendo…' : 'Entregar este PDF firmado'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}

        {/* Navegación entre pasos */}
        <div className="flex items-center justify-between gap-2 pt-2" style={{ borderTop:'1px solid var(--divider)' }}>
          <button type="button" onClick={() => idx > 0 && setPaso(PASOS[idx - 1].id)} disabled={idx === 0}
            className="btn-secondary text-xs min-h-11 disabled:opacity-30">
            <ArrowLeft size={14}/> Anterior
          </button>
          {siguiente && (
            <button type="button" onClick={() => setPaso(siguiente.id)} disabled={estActual.estado !== 'hecho'}
              title={estActual.estado !== 'hecho' ? 'Completa este paso para continuar' : `Ir a: ${siguiente.titulo}`}
              className="btn-primary text-xs min-h-11 disabled:opacity-40">
              {estActual.estado !== 'hecho' ? 'Completa este paso' : 'Siguiente paso'} <ArrowRight size={14}/>
            </button>
          )}
        </div>
      </section>

      {/* Aviso al completar un paso / al terminar todo */}
      {aviso && (
        <ModalPortal onClose={() => setAviso(null)} maxWidth="max-w-sm">
          <div className="p-6 text-center space-y-4">
            {terminoTodo ? (
              <>
                <span className="w-16 h-16 mx-auto rounded-full flex items-center justify-center text-white" style={{ background:'var(--good-solid)' }}>
                  <PartyPopper size={30}/>
                </span>
                <div>
                  <h2 className="text-lg font-bold" style={{ color:'var(--t1)' }}>¡Terminaste! Tu expediente fue enviado</h2>
                  <p className="text-sm mt-2" style={{ color:'var(--t2)' }}>
                    Ya no tienes que hacer nada más. Ahora está <b>en espera de validación</b>: administración revisará tus documentos
                    y te avisará con una notificación. Si algo no es válido, te diremos exactamente qué corregir.
                  </p>
                </div>
                <button type="button" onClick={() => setAviso(null)} className="btn-primary w-full justify-center min-h-11">Entendido</button>
              </>
            ) : (
              <>
                <span className="w-14 h-14 mx-auto rounded-full flex items-center justify-center text-white" style={{ background:'var(--good-solid)' }}>
                  <Check size={28} strokeWidth={3}/>
                </span>
                <div>
                  <h2 className="text-base font-bold" style={{ color:'var(--t1)' }}>¡Listo! {pasoInfo(aviso)?.corto} completado</h2>
                  <p className="text-sm mt-2" style={{ color:'var(--t2)' }}>
                    Llevas {exp.hechos} de {exp.total} pasos. Sigue: <b>{pasoInfo(pendienteTrasAviso.id)?.titulo}</b>.
                  </p>
                </div>
                <button type="button" onClick={() => { setPaso(pendienteTrasAviso.id); setAviso(null) }}
                  className="btn-primary w-full justify-center min-h-11">
                  Ir al siguiente paso <ArrowRight size={15}/>
                </button>
                <button type="button" onClick={() => setAviso(null)} className="text-xs font-semibold min-h-9" style={{ color:'var(--t3)' }}>
                  Lo haré después
                </button>
              </>
            )}
          </div>
        </ModalPortal>
      )}
    </div>
  )
}
