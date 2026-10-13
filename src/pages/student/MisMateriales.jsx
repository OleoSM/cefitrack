import { useEffect, useState } from 'react'
import { FileText, Image as ImageIcon, Download, ExternalLink, Clock, FolderOpen } from 'lucide-react'
import { fetchMateriales, urlMaterial, tiempoHasta, tamanoLegible } from '../../lib/materialesData'
import { fetchNombresColumnas } from '../../lib/supabaseData'
import ProgressiveList from '../../components/ui/ProgressiveList'
import { SkeletonBlock } from '../../components/ui/DataTable'
import { BotonAyuda } from '../../components/ui/Ayuda'

/*
 * Materiales que tu docente compartió (solucionarios, respuestas, guías).
 * Cada uno está disponible solo un tiempo: al vencer desaparece.
 */
export default function MisMateriales() {
  const [lista, setLista] = useState([])
  const [nombres, setNombres] = useState({})
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let vivo = true
    fetchMateriales()
      .then(async m => {
        if (!vivo) return
        setLista(m)
        const n = await fetchNombresColumnas(m.map(x => x.columnaId)).catch(() => ({}))
        if (vivo) setNombres(n)
      })
      .catch(() => { if (vivo) setError('No se pudieron cargar tus materiales.') })
      .finally(() => { if (vivo) setCargando(false) })
    return () => { vivo = false }
  }, [])

  const abrir = async (m, descargar) => {
    try {
      const url = await urlMaterial(m, descargar)
      if (descargar) { const a = document.createElement('a'); a.href = url; a.click() }
      else window.open(url, '_blank', 'noopener')
    } catch (e) { setError(e.message) }
  }

  return (
    <div className="w-full space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="page-title">Mis materiales</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--t3)' }}>Solucionarios, respuestas y guías que compartió tu docente.</p>
        </div>
        <BotonAyuda titulo="Mis materiales">
          <p>Aquí aparecen los archivos que tu docente comparte con tu grupo: soluciones de exámenes, respuestas de tareas o guías.</p>
          <p><b>Están disponibles por tiempo limitado:</b> cada uno dice cuándo se borra. Descárgalo si lo quieres conservar.</p>
        </BotonAyuda>
      </div>

      {error && <p role="alert" className="text-sm" style={{ color: 'var(--bad)' }}>{error}</p>}

      {cargando ? (
        <div className="space-y-3">{[0, 1].map(i => <SkeletonBlock key={i} className="h-20"/>)}</div>
      ) : lista.length === 0 ? (
        <div className="card p-8 text-center space-y-2">
          <FolderOpen size={32} className="mx-auto" style={{ color: 'var(--t3)' }}/>
          <p className="text-sm" style={{ color: 'var(--t2)' }}>Por ahora no hay materiales para ti.</p>
          <p className="text-xs" style={{ color: 'var(--t3)' }}>Cuando tu docente comparta una solución o una guía, aparecerá aquí.</p>
        </div>
      ) : (
        <ProgressiveList items={lista} className="grid gap-3 lg:grid-cols-2" sizes={{ mobile: 5, tablet: 8, desktop: 12 }}>
          {m => {
            const Icono = m.mime === 'application/pdf' ? FileText : ImageIcon
            const pronto = new Date(m.expiraEn).getTime() - Date.now() < 2 * 864e5
            return (
              <div key={m.id} className="card p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <span className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 text-white" style={{ background: 'var(--info-solid)' }}>
                    <Icono size={18}/>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold" style={{ color: 'var(--t1)' }}>{m.titulo}</p>
                    <p className="text-[11px]" style={{ color: 'var(--t3)' }}>
                      {m.columnaId && nombres[m.columnaId] ? `${nombres[m.columnaId]} · ` : ''}{tamanoLegible(m.tamano)}
                    </p>
                  </div>
                </div>
                {m.descripcion && <p className="text-xs" style={{ color: 'var(--t2)' }}>{m.descripcion}</p>}
                <p className="flex items-center gap-1 text-[11px] font-semibold" style={{ color: pronto ? 'var(--bad)' : 'var(--t3)' }}>
                  <Clock size={12}/> Disponible hasta {new Date(m.expiraEn).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} ({tiempoHasta(m.expiraEn)})
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => abrir(m, false)} className="btn-secondary justify-center min-h-11 text-sm"><ExternalLink size={14}/> Ver</button>
                  <button type="button" onClick={() => abrir(m, true)} className="btn-primary justify-center min-h-11 text-sm"><Download size={14}/> Descargar</button>
                </div>
              </div>
            )
          }}
        </ProgressiveList>
      )}
    </div>
  )
}
