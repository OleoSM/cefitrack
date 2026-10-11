import { AlertTriangle, RefreshCw } from 'lucide-react'

/**
 * Estados compartidos del portal del alumno: carga y "no hay perfil".
 *
 * Antes cada pantalla resolvía esto a su manera —unas devolvían `null` y el
 * alumno veía la página en blanco, otras un texto suelto con su propio
 * color—. Aquí hay un único patrón: mientras carga, un esqueleto; si no hay
 * datos, un mensaje visible con la forma de reintentar.
 */
export function EstadoCarga({ filas = 3 }) {
  return (
    <div className="w-full space-y-4" aria-busy="true" aria-live="polite">
      <span className="sr-only">Cargando…</span>
      <div className="h-7 w-48 rounded-lg animate-pulse" style={{ background: 'var(--soft-bg)' }}/>
      {Array.from({ length: filas }, (_, i) => (
        <div key={i} className="card h-28 animate-pulse" style={{ background: 'var(--soft-bg)' }}/>
      ))}
    </div>
  )
}

export function EstadoVacio({
  titulo = 'No pudimos cargar tu información',
  mensaje = 'Revisa tu conexión e inténtalo de nuevo. Si el problema sigue, avisa a tu docente.',
  onReintentar = () => window.location.reload(),
}) {
  return (
    <div role="alert" className="card p-6 sm:p-8 flex flex-col items-center text-center gap-3">
      <span className="w-12 h-12 rounded-2xl flex items-center justify-center"
        style={{ background: 'var(--warn-soft)', border: '1px solid var(--warn-line)', color: 'var(--warn)' }}>
        <AlertTriangle size={22}/>
      </span>
      <p className="text-sm font-bold" style={{ color: 'var(--t1)' }}>{titulo}</p>
      <p className="text-xs max-w-sm" style={{ color: 'var(--t3)' }}>{mensaje}</p>
      {onReintentar && (
        <button type="button" onClick={onReintentar} className="btn-secondary justify-center min-h-11">
          <RefreshCw size={14}/> Reintentar
        </button>
      )}
    </div>
  )
}

/** Atajo para el patrón de todas las pantallas: carga → error / sin perfil → contenido.
 *  Con `error` se avisa aunque el perfil sí haya cargado: si falló la
 *  asistencia o las calificaciones, mostrar la pantalla con datos a medias
 *  haría creer al alumno que no tiene registros. */
export function estadoPerfil({ loading, student, error }) {
  if (loading && !student) return <EstadoCarga/>
  if (error) return <EstadoVacio mensaje="No se pudo cargar toda tu información. Revisa tu conexión e inténtalo de nuevo."/>
  if (!student) return <EstadoVacio/>
  return null
}
