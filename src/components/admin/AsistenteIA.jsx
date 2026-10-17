import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Sparkles, X, Send, Trash2 } from 'lucide-react'
import { preguntarAsistente, fetchGastoAsistente } from '../../lib/asistenteData'

/*
 * Asistente con IA (Claude Haiku) — admins y sub-admins con el apartado "ia", solo consultas.
 * Botón flotante → panel de chat. La conversación vive en memoria (se borra
 * al recargar) y al servidor solo viajan los últimos mensajes, para gastar poco.
 */
const SUGERENCIAS = [
  'Resumen de todos los grupos',
  '¿Qué alumnos están en riesgo y por qué?',
  '¿Qué alumnos tienen asistencia menor a 90 %?',
  '¿Qué alumnos tienen la garantía pendiente?',
]

/* Formato mínimo y seguro (sin HTML): listas con "- " y **negritas**. */
function Texto({ texto }) {
  const negritas = linea => linea.split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
    p.startsWith('**') && p.endsWith('**') ? <b key={i}>{p.slice(2, -2)}</b> : <span key={i}>{p}</span>)
  return (
    <div className="space-y-1">
      {texto.split('\n').filter(l => l.trim()).map((l, i) => {
        const vineta = l.match(/^\s*(?:[-*•]|\d+\.)\s+(.*)$/)
        return vineta
          ? <p key={i} className="flex gap-1.5"><span aria-hidden="true">•</span><span>{negritas(vineta[1])}</span></p>
          : <p key={i}>{negritas(l)}</p>
      })}
    </div>
  )
}

export default function AsistenteIA() {
  const [abierto, setAbierto] = useState(false)
  const [mensajes, setMensajes] = useState([])
  const [texto, setTexto] = useState('')
  const [pensando, setPensando] = useState(false)
  const [gasto, setGasto] = useState(null)
  const fin = useRef(null)

  useEffect(() => { if (abierto) fetchGastoAsistente().then(setGasto).catch(() => {}) }, [abierto])
  useEffect(() => { fin.current?.scrollIntoView({ behavior: 'smooth' }) }, [mensajes, pensando])

  const preguntar = async pregunta => {
    const q = pregunta.trim()
    if (!q || pensando) return
    const historial = [...mensajes.filter(m => !m.error), { role: 'user', content: q }]
    setMensajes(m => [...m, { role: 'user', content: q }])
    setTexto(''); setPensando(true)
    const r = await preguntarAsistente(historial.map(({ role, content }) => ({ role, content })))
    setPensando(false)
    if (r?.gasto) setGasto(g => ({ ...(g ?? {}), ...r.gasto }))
    setMensajes(m => [...m, r?.ok
      ? { role: 'assistant', content: r.respuesta }
      : { role: 'assistant', content: r?.message ?? 'No se pudo consultar al asistente.', error: true }])
  }

  const agotado = gasto && gasto.usado >= gasto.limite

  return createPortal(
    <>
      {!abierto && (
        <button type="button" onClick={() => setAbierto(true)} aria-label="Abrir asistente de IA" data-sin-zoom
          className="fixed z-[60] right-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] lg:bottom-6 w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-transform hover:-translate-y-0.5"
          style={{ background: 'var(--accent)', color: 'var(--accent-contrast)' }}>
          <Sparkles size={22}/>
        </button>
      )}

      {abierto && (
        <div role="dialog" aria-label="Asistente de SIGA"
          className="fixed z-[60] inset-x-2 bottom-[calc(5rem+env(safe-area-inset-bottom))] top-16 lg:inset-auto lg:right-6 lg:bottom-6 lg:w-[400px] lg:h-[560px] flex flex-col rounded-2xl overflow-hidden"
          style={{ background: 'var(--panel-bg)', border: '1px solid var(--card-border)', boxShadow: '0 24px 64px rgba(0,0,0,.35)', backdropFilter: 'blur(24px)' }}>
          <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: '1px solid var(--divider)' }}>
            <Sparkles size={16} style={{ color: 'var(--accent)' }}/>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold" style={{ color: 'var(--t1)' }}>Asistente de SIGA</p>
              <p className="text-[10px]" style={{ color: 'var(--t3)' }}>
                Solo consulta datos · {gasto ? `US$${gasto.usado.toFixed(2)} de US$${Number(gasto.limite).toFixed(2)} este mes` : 'IA (Claude Haiku)'}
              </p>
            </div>
            {mensajes.length > 0 && (
              <button type="button" onClick={() => setMensajes([])} aria-label="Borrar conversación"
                className="w-9 h-9 flex items-center justify-center rounded-lg" style={{ color: 'var(--t3)' }}><Trash2 size={15}/></button>
            )}
            <button type="button" onClick={() => setAbierto(false)} aria-label="Cerrar asistente"
              className="w-9 h-9 flex items-center justify-center rounded-lg" style={{ color: 'var(--t3)' }}><X size={16}/></button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 text-sm">
            {mensajes.length === 0 && (
              <div className="space-y-3">
                <p style={{ color: 'var(--t2)' }}>Pregúntame sobre alumnos, grupos, asistencia, calificaciones, pagos o garantías. Respondo con los datos de SIGA. También analizo competencias: escribe, por ejemplo, «competencias y habilidades de Diego Hernández» o «reporte del grupo 2da V IPN».</p>
                <div className="flex flex-col gap-1.5">
                  {SUGERENCIAS.map(s => (
                    <button key={s} type="button" onClick={() => preguntar(s)} disabled={agotado}
                      className="text-left text-xs px-3 min-h-9 rounded-xl"
                      style={{ background: 'var(--soft-bg)', border: '1px solid var(--card-border)', color: 'var(--t1)' }}>{s}</button>
                  ))}
                </div>
              </div>
            )}
            {mensajes.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className="max-w-[85%] rounded-2xl px-3 py-2 leading-relaxed"
                  style={m.role === 'user'
                    ? { background: 'var(--accent)', color: 'var(--accent-contrast)' }
                    : m.error
                      ? { background: 'var(--bad-soft)', border: '1px solid var(--bad-line)', color: 'var(--t1)' }
                      : { background: 'var(--soft-bg)', border: '1px solid var(--card-border)', color: 'var(--t1)' }}>
                  {m.role === 'user' ? m.content : <Texto texto={m.content}/>}
                </div>
              </div>
            ))}
            {pensando && (
              <p role="status" className="text-xs" style={{ color: 'var(--t3)' }}>Consultando los datos de SIGA…</p>
            )}
            <div ref={fin}/>
          </div>

          <form onSubmit={e => { e.preventDefault(); preguntar(texto) }} className="flex gap-2 p-3" style={{ borderTop: '1px solid var(--divider)' }}>
            <input value={texto} onChange={e => setTexto(e.target.value)} maxLength={500} disabled={agotado}
              placeholder={agotado ? 'Tope del mes alcanzado' : 'Escribe tu pregunta…'} aria-label="Pregunta para el asistente"
              className="input-field flex-1 min-h-11"/>
            <button type="submit" disabled={pensando || !texto.trim() || agotado} aria-label="Enviar pregunta"
              className="w-11 min-h-11 flex items-center justify-center rounded-xl flex-shrink-0 disabled:opacity-40"
              style={{ background: 'var(--accent)', color: 'var(--accent-contrast)' }}>
              <Send size={16}/>
            </button>
          </form>
        </div>
      )}
    </>,
    document.body,
  )
}
