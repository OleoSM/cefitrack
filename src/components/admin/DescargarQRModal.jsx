import { useState } from 'react'
import { QrCode, X, FileText, Images, Download } from 'lucide-react'
import ModalPortal from '../ui/ModalPortal'
import { descargarPdfGrupo, descargarZipGrupo } from '../../lib/qrLote'

/**
 * Descarga conjunta de los QR de asistencia de un grupo. Se elige el formato:
 * PDF listo para imprimir (cuadrícula en hojas carta) o un ZIP con un PNG por
 * alumno para repartirlos por mensaje.
 */
export default function DescargarQRModal({ grupo, alumnos, onClose }) {
  const [formato, setFormato] = useState('pdf')
  const [avance, setAvance] = useState(null)   // { hechos, total }
  const [error, setError] = useState('')
  const ordenados = [...alumnos].sort((a, b) => a.name.localeCompare(b.name, 'es'))
  const trabajando = avance != null

  const descargar = async () => {
    setError(''); setAvance({ hechos: 0, total: ordenados.length })
    try {
      const fn = formato === 'pdf' ? descargarPdfGrupo : descargarZipGrupo
      await fn(grupo, ordenados, (hechos, total) => setAvance({ hechos, total }))
      onClose()
    } catch (err) {
      // El detalle va a la consola: el mensaje genérico escondía la causa real.
      console.error('[QR del grupo]', err)
      setError('No se pudo generar la descarga. Inténtalo de nuevo.')
    } finally { setAvance(null) }
  }

  const Opcion = ({ valor, Icono, titulo, texto }) => {
    const activo = formato === valor
    return (
      <button type="button" onClick={() => setFormato(valor)} aria-pressed={activo} disabled={trabajando}
        className="flex-1 text-left rounded-xl p-3 min-h-11"
        style={{
          background: activo ? 'var(--accent)' : 'var(--soft-bg)',
          color: activo ? 'var(--accent-contrast)' : 'var(--t1)',
          border: `1px solid ${activo ? 'var(--accent)' : 'var(--card-border)'}`,
        }}>
        <span className="flex items-center gap-2 text-sm font-bold"><Icono size={15}/> {titulo}</span>
        <span className="block text-[11px] mt-1" style={{ opacity: .85 }}>{texto}</span>
      </button>
    )
  }

  return (
    <ModalPortal maxWidth="max-w-md" onClose={() => !trabajando && onClose()}>
      <div className="flex items-center justify-between gap-3 px-5 py-3.5" style={{ borderBottom: '1px solid var(--divider)' }}>
        <h2 className="flex items-center gap-2 text-sm font-bold min-w-0" style={{ color: 'var(--t1)' }}>
          <QrCode size={15} style={{ color: 'var(--accent)' }}/>
          <span className="truncate">QR de {grupo.name}</span>
        </h2>
        <button type="button" onClick={onClose} disabled={trabajando} aria-label="Cerrar"
          className="w-11 h-11 flex items-center justify-center rounded-lg" style={{ color: 'var(--t3)' }}><X size={15}/></button>
      </div>
      <div className="p-5 space-y-4">
        <p className="text-sm" style={{ color: 'var(--t2)' }}>
          {ordenados.length} alumno{ordenados.length !== 1 ? 's' : ''}. Son los mismos QR que cada alumno ve en "Mi QR" y que lee el escáner de Pasar lista.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <Opcion valor="pdf" Icono={FileText} titulo="PDF para imprimir" texto="12 QR por hoja carta, con el nombre debajo."/>
          <Opcion valor="zip" Icono={Images} titulo="Imágenes (ZIP)" texto="Un PNG por alumno, para mandarlo por mensaje."/>
        </div>
        {trabajando && (
          <div role="status">
            <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--soft-bg)' }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${(avance.hechos / Math.max(1, avance.total)) * 100}%`, background: 'var(--accent)' }}/>
            </div>
            <p className="text-xs mt-1.5" style={{ color: 'var(--t3)' }}>Generando {avance.hechos} de {avance.total}…</p>
          </div>
        )}
        {error && <p role="alert" className="text-xs font-semibold" style={{ color: 'var(--bad)' }}>{error}</p>}
        <div className="flex gap-3">
          <button type="button" onClick={onClose} disabled={trabajando} className="btn-secondary flex-1 justify-center min-h-11">Cancelar</button>
          <button type="button" onClick={descargar} disabled={trabajando || ordenados.length === 0} className="btn-primary flex-1 justify-center min-h-11">
            <Download size={14}/> {trabajando ? 'Generando…' : 'Descargar'}
          </button>
        </div>
      </div>
    </ModalPortal>
  )
}
