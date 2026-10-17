import { useState } from 'react'
import { Mail, X, CheckCircle2, AlertTriangle, BellRing } from 'lucide-react'
import ModalPortal from '../ui/ModalPortal'
import SelectorAudiencia from './SelectorAudiencia'
import { enviarAviso, correosPrevistos } from '../../lib/avisosData'

/**
 * Popup "¿Avisar por correo?" — sale al crear una actividad o subir un
 * material, y al elegir una sugerencia en Notificaciones. El asunto y el
 * mensaje llegan redactados; se pueden editar antes de enviar.
 *
 * `alumnos`: objetos alumno (con personalEmail y tutor.email).
 * `tipo`, `refId`, `groupId`: para registrar el aviso y no volver a sugerirlo.
 */
export default function AvisoCorreoModal({ titulo, contexto, alumnos, asuntoInicial, mensajeInicial, tipo, refId, groupId, onClose, onEnviado }) {
  const [audiencia, setAudiencia] = useState('ambos')
  const [asunto, setAsunto] = useState(asuntoInicial ?? '')
  const [mensaje, setMensaje] = useState(mensajeInicial ?? '')
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState(null)   // { ok, texto }
  const conteo = correosPrevistos(alumnos, audiencia)

  const enviar = async () => {
    setEnviando(true)
    try {
      const r = await enviarAviso({ alumnos, asunto, mensaje, audiencia, tipo, refId, groupId })
      if (!r.ok) setResultado({ ok: false, texto: `Se avisó dentro de SIGA, pero no por correo: ${r.message}` })
      else {
        const partes = [`${r.enviados} correo(s) enviado(s)`]
        if (r.omitidos) partes.push(`${r.omitidos} sin enviar (sin correo o sin cupo)`)
        if (r.fallidos) partes.push(`${r.fallidos} con error${r.motivoFallo ? `: ${r.motivoFallo}` : ''}`)
        setResultado({ ok: r.enviados > 0, texto: `${partes.join(' · ')}. También se avisó dentro de SIGA.` })
        onEnviado?.(r)
      }
    } catch (e) {
      setResultado({ ok: false, texto: e?.message ?? 'No se pudo enviar el aviso.' })
    }
    setEnviando(false)
  }

  return (
    <ModalPortal maxWidth="max-w-lg" onClose={() => !enviando && onClose()}>
      <div className="flex items-center justify-between gap-3 px-5 py-3.5" style={{ borderBottom: '1px solid var(--divider)' }}>
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-bold" style={{ color: 'var(--t1)' }}>
            <BellRing size={15} style={{ color: 'var(--accent)' }}/> {titulo ?? '¿Avisar por correo?'}
          </h2>
          {contexto && <p className="text-[11px] mt-0.5 truncate" style={{ color: 'var(--t3)' }}>{contexto}</p>}
        </div>
        <button type="button" onClick={onClose} disabled={enviando} aria-label="Cerrar"
          className="w-11 h-11 flex items-center justify-center rounded-lg flex-shrink-0" style={{ color: 'var(--t3)' }}><X size={15}/></button>
      </div>

      <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
        {resultado ? (
          <>
            <div role={resultado.ok ? 'status' : 'alert'} className="flex gap-2 rounded-xl p-3 text-sm"
              style={resultado.ok
                ? { background: 'var(--good-soft)', border: '1px solid var(--good-line)', color: 'var(--good)' }
                : { background: 'var(--bad-soft)', border: '1px solid var(--bad-line)', color: 'var(--bad)' }}>
              {resultado.ok ? <CheckCircle2 size={16} className="flex-shrink-0"/> : <AlertTriangle size={16} className="flex-shrink-0"/>}
              <span>{resultado.texto}</span>
            </div>
            <button type="button" onClick={onClose} className="btn-primary w-full justify-center min-h-11">Listo</button>
          </>
        ) : (
          <>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--t3)' }}>
                ¿A quién se le envía? · {alumnos.length} alumno(s)
              </p>
              <SelectorAudiencia valor={audiencia} onChange={setAudiencia} conteo={conteo} disabled={enviando} vertical/>
              <p className="text-[11px] mt-1.5" style={{ color: conteo.total ? 'var(--t3)' : 'var(--warn)' }}>
                {conteo.total
                  ? `Saldrán ${conteo.total} correo(s). Quien no tenga correo registrado recibe solo la notificación dentro de SIGA.`
                  : 'Nadie en este grupo tiene correo registrado para esta opción: solo se avisará dentro de SIGA.'}
              </p>
            </div>
            <label className="block">
              <span className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--t3)' }}>Asunto</span>
              <input value={asunto} onChange={e => setAsunto(e.target.value)} maxLength={150} className="input-field w-full min-h-11"/>
            </label>
            <label className="block">
              <span className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--t3)' }}>Mensaje</span>
              <textarea value={mensaje} onChange={e => setMensaje(e.target.value)} rows={7} className="input-field w-full resize-y"/>
            </label>
            <div className="flex flex-col-reverse sm:flex-row gap-2">
              <button type="button" onClick={onClose} disabled={enviando} className="btn-secondary flex-1 justify-center min-h-11">Ahora no</button>
              <button type="button" onClick={enviar} disabled={enviando || !asunto.trim() || !mensaje.trim()}
                className="btn-primary flex-1 justify-center min-h-11">
                <Mail size={14}/> {enviando ? 'Enviando…' : 'Enviar aviso'}
              </button>
            </div>
          </>
        )}
      </div>
    </ModalPortal>
  )
}
