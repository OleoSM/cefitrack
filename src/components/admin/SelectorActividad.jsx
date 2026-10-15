import { useEffect, useMemo, useState } from 'react'
import { Search, ChevronLeft, Check, X } from 'lucide-react'
import { fetchColumnasRegistro, fetchColumnaRegistro } from '../../lib/supabaseData'
import BuscadorGrupo from '../ui/BuscadorGrupo'

/**
 * Elegir la actividad (columna de la hoja) a la que pertenece un material.
 * Sustituye a dos <select> nativos: con decenas de actividades agrupadas el
 * menú del sistema quedaba encimado, con encabezados en blanco, y en el
 * teléfono no se veía todo. Aquí: 1) se elige el grupo con buscador, 2) sus
 * actividades salen agrupadas por materia en un área con scroll y buscador.
 *
 * Props: grupos, nombreDe(sucursal), columnaId, onElegir({ columnaId, grupoId, nombre } | null)
 */
export default function SelectorActividad({ grupos, nombreDe, columnaId, onElegir }) {
  const [grupoId, setGrupoId] = useState('')
  const [columnas, setColumnas] = useState([])
  const [cargando, setCargando] = useState(false)
  const [q, setQ] = useState('')
  const [qGrupo, setQGrupo] = useState('')
  // Elegir una actividad la acepta y PLIEGA el selector: queda solo el resumen
  // con "Cambiar". Se abre de entrada solo si aún no hay actividad.
  const [abierto, setAbierto] = useState(!columnaId)

  // Al editar un material que ya tiene actividad, se abre en su grupo.
  useEffect(() => {
    if (!columnaId || grupoId) return
    fetchColumnaRegistro(columnaId).then(c => { if (c?.groupId) setGrupoId(c.groupId) }).catch(() => {})
  }, [columnaId, grupoId])

  useEffect(() => {
    if (!grupoId) { setColumnas([]); return }
    let vivo = true
    setCargando(true)
    fetchColumnasRegistro(grupoId)
      .then(c => { if (vivo) setColumnas(c) })
      .catch(() => { if (vivo) setColumnas([]) })
      .finally(() => { if (vivo) setCargando(false) })
    return () => { vivo = false }
  }, [grupoId])

  const texto = q.trim().toLowerCase()
  const grupo = grupos.find(g => g.id === grupoId)
  const elegida = columnas.find(c => c.id === columnaId)

  const porMateria = useMemo(() => {
    const m = new Map()
    for (const c of columnas) {
      if (texto && !`${c.nombre} ${c.materia}`.toLowerCase().includes(texto)) continue
      if (!m.has(c.materia)) m.set(c.materia, [])
      m.get(c.materia).push(c)
    }
    return [...m.entries()]
  }, [columnas, texto])

  const etiquetaFormato = c => c.formato === 'check' ? '✓' : c.formato === 'valor' ? 'Aa' : `/${c.calMax}`

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--card-border)', background: 'var(--soft-bg)' }}>
      {/* Cabecera: qué está elegido y cómo volver */}
      <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: '1px solid var(--divider)' }}>
        {grupo && abierto ? (
          <button type="button" onClick={() => { setGrupoId(''); setQ('') }}
            className="inline-flex items-center gap-1 text-xs font-semibold min-h-9 px-1.5 rounded-lg" style={{ color: 'var(--accent)' }}>
            <ChevronLeft size={14}/> Grupos
          </button>
        ) : null}
        <p className="text-xs min-w-0 flex-1 truncate" style={{ color: 'var(--t2)' }}>
          {elegida
            ? <>Actividad: <b style={{ color: 'var(--t1)' }}>{elegida.nombre}</b> <span style={{ color: 'var(--t3)' }}>({elegida.materia}{grupo ? ` · ${grupo.name}` : ''})</span></>
            : grupo ? <>Grupo <b style={{ color: 'var(--t1)' }}>{grupo.name}</b>: elige la actividad</>
            : 'Elige el grupo de la actividad'}
        </p>
        {!abierto && (
          <button type="button" onClick={() => { setAbierto(true); setQ('') }}
            className="text-xs font-semibold min-h-9 px-2 rounded-lg flex-shrink-0" style={{ color: 'var(--accent)' }}>
            Cambiar
          </button>
        )}
        {columnaId && (
          <button type="button" onClick={() => { onElegir(null); setAbierto(true) }} aria-label="Quitar actividad"
            className="w-9 h-9 flex items-center justify-center rounded-lg flex-shrink-0" style={{ color: 'var(--t3)' }}><X size={14}/></button>
        )}
      </div>

      {/* Paso 1: el grupo, con el buscador compartido (5 al tocar, más al bajar,
          coincidencias al escribir). Paso 2: sus actividades. */}
      {!abierto ? null : !grupo ? (
        <div className="p-3">
          <BuscadorGrupo grupos={grupos} query={qGrupo} onQuery={setQGrupo} nombreDe={nombreDe}
            seleccionado={null} onSeleccionar={id => { if (id) { setGrupoId(id); setQ('') } }}
            placeholder="Busca el grupo de la actividad…"/>
        </div>
      ) : (
      <>
      <label className="relative block px-3 pt-2.5">
        <Search size={14} className="absolute left-6 top-1/2 translate-y-[-25%]" style={{ color: 'var(--t3)' }}/>
        <input value={q} onChange={e => setQ(e.target.value)} aria-label="Buscar actividad"
          placeholder="Buscar actividad o materia…" className="input-field w-full min-h-11 !pl-9"/>
      </label>

      <div className="max-h-60 overflow-y-auto overscroll-contain px-2 py-2">
        {cargando ? (
          <p className="text-xs px-2 py-3" style={{ color: 'var(--t3)' }}>Cargando actividades…</p>
        ) : porMateria.length === 0 ? (
          <p className="text-xs px-2 py-3" style={{ color: 'var(--t3)' }}>{columnas.length ? 'Ninguna actividad coincide.' : 'Este grupo aún no tiene actividades.'}</p>
        ) : porMateria.map(([materia, lista]) => (
          <div key={materia} className="mb-1.5">
            <p className="sticky top-0 z-10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest"
              style={{ color: 'var(--t3)', background: 'var(--soft-bg)' }}>{materia} · {lista.length}</p>
            {lista.map(c => {
              const activa = c.id === columnaId
              return (
                <button key={c.id} type="button" aria-pressed={activa}
                  onClick={() => { onElegir({ columnaId: c.id, grupoId, nombre: c.nombre }); setAbierto(false); setQ('') }}
                  className="w-full flex items-center gap-2 text-left px-2.5 min-h-11 rounded-lg text-sm"
                  style={activa
                    ? { background: 'var(--accent)', color: 'var(--accent-contrast)' }
                    : { color: 'var(--t1)' }}
                  onMouseEnter={e => { if (!activa) e.currentTarget.style.background = 'var(--card-bg)' }}
                  onMouseLeave={e => { if (!activa) e.currentTarget.style.background = 'transparent' }}>
                  <span className="w-4 flex-shrink-0">{activa && <Check size={14}/>}</span>
                  <span className="flex-1 min-w-0 truncate">{c.nombre}</span>
                  <span className="text-[10px] font-bold flex-shrink-0 opacity-75">{etiquetaFormato(c)}</span>
                </button>
              )
            })}
          </div>
        ))}
      </div>
      </>
      )}
    </div>
  )
}
