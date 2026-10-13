import { useEffect, useRef, useState } from 'react'
import { Camera, X, RefreshCw, Check, ImagePlus, Trash2 } from 'lucide-react'
import ModalPortal from './ModalPortal'
import AvatarAlumno from './AvatarAlumno'
import { prepararFoto, guardarFoto, quitarFoto } from '../../lib/fotosPerfil'

/**
 * Tarjeta "Tu foto" de Mi QR: tomar una foto con la cámara (o elegirla de la
 * galería si el navegador no da cámara) y dejarla como foto de perfil.
 * La foto la ven solo el alumno y el personal de su grupo.
 */
export default function FotoPerfil({ student, onCambio }) {
  const [camara, setCamara] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [confirmarQuitar, setConfirmarQuitar] = useState(false)
  const galeria = useRef(null)

  const guardar = async blob => {
    setGuardando(true); setError('')
    try {
      const path = await guardarFoto(student.id, blob)
      onCambio?.(path)
      setCamara(false)
    } catch (e) { setError(e.message) }
    finally { setGuardando(false) }
  }

  const desdeGaleria = async e => {
    const f = e.target.files?.[0]; e.target.value = ''
    if (!f) return
    if (!f.type.startsWith('image/')) { setError('Elige una imagen.'); return }
    try { await guardar(await prepararFoto(f)) } catch { setError('No se pudo leer la imagen.') }
  }

  const quitar = async () => {
    setGuardando(true); setError('')
    try { await quitarFoto(student.id); onCambio?.(null); setConfirmarQuitar(false) }
    catch (e) { setError(e.message) }
    finally { setGuardando(false) }
  }

  return (
    <div className="card p-5 space-y-3">
      <h2 className="section-title">Tu foto</h2>
      <div className="flex items-center gap-4">
        <AvatarAlumno student={student} size={72} redondez="rounded-2xl"/>
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-xs" style={{ color: 'var(--t3)' }}>
            Tu docente la usa para reconocerte al pasar lista. Solo la ven tú y el personal de tu grupo.
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setCamara(true)} disabled={guardando} className="btn-primary min-h-11 justify-center text-sm">
              <Camera size={14}/> {student.fotoPath ? 'Tomar otra' : 'Tomar foto'}
            </button>
            <button type="button" onClick={() => galeria.current?.click()} disabled={guardando} className="btn-secondary min-h-11 justify-center text-sm">
              <ImagePlus size={14}/> Galería
            </button>
            {student.fotoPath && (
              <button type="button" onClick={() => setConfirmarQuitar(true)} disabled={guardando}
                aria-label="Quitar foto" className="btn-danger min-h-11 justify-center text-sm"><Trash2 size={14}/></button>
            )}
          </div>
          <input ref={galeria} type="file" accept="image/*" className="hidden" onChange={desdeGaleria}/>
        </div>
      </div>
      {guardando && !camara && <p role="status" className="text-xs" style={{ color: 'var(--t3)' }}>Guardando…</p>}
      {error && <p role="alert" className="text-xs font-semibold" style={{ color: 'var(--bad)' }}>{error}</p>}

      {camara && <Camara guardando={guardando} onClose={() => setCamara(false)} onFoto={guardar}
        onSinCamara={() => { setCamara(false); galeria.current?.click() }}/>}

      {confirmarQuitar && (
        <ModalPortal maxWidth="max-w-sm" onClose={() => !guardando && setConfirmarQuitar(false)}>
          <div className="p-6 space-y-4 text-center">
            <h2 className="text-base font-bold" style={{ color: 'var(--t1)' }}>¿Quitar tu foto?</h2>
            <p className="text-sm" style={{ color: 'var(--t2)' }}>Se borra y vuelves a aparecer con tu avatar o tus iniciales.</p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setConfirmarQuitar(false)} disabled={guardando} className="btn-secondary flex-1 justify-center min-h-11">Cancelar</button>
              <button type="button" onClick={quitar} disabled={guardando} className="btn-danger flex-1 justify-center min-h-11">
                {guardando ? 'Quitando…' : 'Sí, quitarla'}
              </button>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  )
}

function Camara({ guardando, onClose, onFoto, onSinCamara }) {
  const video = useRef(null)
  const [stream, setStream] = useState(null)
  const [captura, setCaptura] = useState(null)   // { blob, url }
  const [fallo, setFallo] = useState('')

  useEffect(() => {
    let s = null, vivo = true
    navigator.mediaDevices?.getUserMedia?.({ video: { facingMode: 'user', width: { ideal: 960 } }, audio: false })
      .then(st => { if (!vivo) { st.getTracks().forEach(t => t.stop()); return } s = st; setStream(st) })
      .catch(() => setFallo('No pudimos abrir tu cámara. Revisa el permiso del navegador o elige una foto de tu galería.'))
    if (!navigator.mediaDevices?.getUserMedia) setFallo('Tu navegador no permite usar la cámara aquí. Elige una foto de tu galería.')
    return () => { vivo = false; s?.getTracks().forEach(t => t.stop()) }
  }, [])

  useEffect(() => { if (video.current && stream) video.current.srcObject = stream }, [stream, captura])
  useEffect(() => () => { if (captura) URL.revokeObjectURL(captura.url) }, [captura])

  const disparar = async () => {
    const blob = await prepararFoto(video.current)
    setCaptura({ blob, url: URL.createObjectURL(blob) })
  }

  return (
    <ModalPortal maxWidth="max-w-md" onClose={() => !guardando && onClose()}>
      <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: '1px solid var(--divider)' }}>
        <h2 className="flex items-center gap-2 text-sm font-bold" style={{ color: 'var(--t1)' }}><Camera size={15}/> Tomar foto</h2>
        <button type="button" onClick={onClose} disabled={guardando} aria-label="Cerrar"
          className="w-11 h-11 flex items-center justify-center rounded-lg" style={{ color: 'var(--t3)' }}><X size={15}/></button>
      </div>
      <div className="p-5 space-y-4">
        {fallo ? (
          <>
            <p role="alert" className="text-sm" style={{ color: 'var(--t2)' }}>{fallo}</p>
            <button type="button" onClick={onSinCamara} className="btn-primary w-full justify-center min-h-11"><ImagePlus size={14}/> Elegir de la galería</button>
          </>
        ) : (
          <>
            <div className="relative mx-auto w-full max-w-[320px] aspect-square rounded-2xl overflow-hidden" style={{ background: '#000' }}>
              {captura
                ? <img src={captura.url} alt="Vista previa de tu foto" className="w-full h-full object-cover"/>
                : <video ref={video} autoPlay playsInline muted className="w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }}/>}
              {/* Guía para centrar la cara. */}
              {!captura && <div className="absolute inset-[12%] rounded-full pointer-events-none" style={{ border: '2px dashed rgba(255,255,255,.6)' }}/>}
            </div>
            <p className="text-xs text-center" style={{ color: 'var(--t3)' }}>Mira a la cámara, con buena luz y la cara dentro del círculo.</p>
            {captura ? (
              <div className="flex gap-3">
                <button type="button" onClick={() => setCaptura(null)} disabled={guardando} className="btn-secondary flex-1 justify-center min-h-11"><RefreshCw size={14}/> Repetir</button>
                <button type="button" onClick={() => onFoto(captura.blob)} disabled={guardando} className="btn-primary flex-1 justify-center min-h-11">
                  <Check size={14}/> {guardando ? 'Guardando…' : 'Usar esta foto'}
                </button>
              </div>
            ) : (
              <button type="button" onClick={disparar} disabled={!stream} className="btn-primary w-full justify-center min-h-11">
                <Camera size={14}/> {stream ? 'Tomar foto' : 'Abriendo cámara…'}
              </button>
            )}
          </>
        )}
      </div>
    </ModalPortal>
  )
}
