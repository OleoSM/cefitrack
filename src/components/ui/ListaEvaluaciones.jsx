import { useMemo, useState } from 'react'
import { ChevronRight, Search, X, Layers, ArrowDownUp, Tag, BookOpen } from 'lucide-react'
import ProgressiveList from './ProgressiveList'
import { iconoMateria } from './SigaMateriaIcons'
import { colorMateria, colorCalificacion, calificacionBase10 } from '../../lib/studentMetrics'
import { tintaSobre } from '../../lib/color'

/**
 * Lista de evaluaciones de un alumno, SIEMPRE ordenada y agrupada:
 * por materia → categoría → fecha (o por categoría, o sin agrupar), con una
 * mini etiqueta de categoría en cada fila y filtros (categoría, materia,
 * orden, búsqueda). La usan el perfil del alumno en admin y Mis calificaciones.
 *
 * `evaluaciones`: objetos de mapEvaluation (calificación en su escala original).
 * `nombresColumnas`: { columnaId: "Tarea 3" } para titular cada fila.
 * `materiaFija`: la lista ya es de una sola materia (oculta ese filtro).
 * `onAbrir(e)`: al tocar una fila (abre el detalle).
 */

/* Categorías normalizadas: el `tipo` llega libre ("examen parcial",
   "Tarea", "actividad"…). Orden = importancia en la calificación. */
const CATEGORIAS = [
  { id: 'examen',    label: 'Examen',    tono: 'info',    re: /examen|parcial|final/ },
  { id: 'simulacro', label: 'Simulacro', tono: 'bad',     re: /simulacro/ },
  { id: 'proyecto',  label: 'Proyecto',  tono: 'neutral', re: /proyecto/ },
  { id: 'tarea',     label: 'Tarea',     tono: 'good',    re: /tarea/ },
  { id: 'actividad', label: 'Actividad', tono: 'warn',    re: /actividad|practica|práctica|ejercicio|participaci/ },
]
const OTRA = { id: 'otra', label: 'Otra', tono: 'neutral' }

export function categoriaDe(tipo = '') {
  const t = String(tipo).toLowerCase()
  return CATEGORIAS.find(c => c.re.test(t)) ?? { ...OTRA, label: tipo ? tipo.charAt(0).toUpperCase() + tipo.slice(1) : 'Otra' }
}
const ordenCategoria = id => { const i = CATEGORIAS.findIndex(c => c.id === id); return i < 0 ? 99 : i }

/** Mini etiqueta de categoría: pastilla sólida con texto blanco. */
export function EtiquetaCategoria({ tipo, className = '' }) {
  const c = categoriaDe(tipo)
  return (
    <span className={`inline-flex items-center px-1.5 py-px rounded-md text-[10px] font-bold uppercase tracking-wide text-white flex-shrink-0 ${className}`}
      style={{ background: `var(--${c.tono}-solid)` }}>
      {c.label}
    </span>
  )
}

const ORDENES = [
  { id: 'recientes', label: 'Más recientes' },
  { id: 'antiguas',  label: 'Más antiguas' },
  { id: 'mayor',     label: 'Mayor calificación' },
  { id: 'menor',     label: 'Menor calificación' },
]

const media = evs => evs.length ? +(evs.reduce((s, e) => s + calificacionBase10(e), 0) / evs.length).toFixed(1) : null

function Chip({ activo, onClick, children, count }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={activo}
      className="flex-shrink-0 min-h-9 inline-flex items-center gap-1.5 px-3 rounded-full text-xs font-semibold"
      style={activo
        ? { background: 'var(--accent)', color: 'var(--accent-contrast)', border: '1px solid var(--accent)' }
        : { background: 'var(--card-bg)', color: 'var(--t2)', border: '1px solid var(--card-border)' }}>
      {children}
      {count !== undefined && (
        <span className="text-[10px] font-bold px-1.5 rounded-full tabular-nums"
          style={activo ? { background: 'var(--accent-contrast)', color: 'var(--accent)' } : { background: 'var(--soft-bg)', color: 'var(--t3)' }}>
          {count}
        </span>
      )}
    </button>
  )
}

export default function ListaEvaluaciones({ evaluaciones = [], nombresColumnas = {}, light = false, materiaFija = false, onAbrir }) {
  const [cat, setCat] = useState('todas')
  const [materia, setMateria] = useState('todas')
  const [orden, setOrden] = useState('recientes')
  const [agrupar, setAgrupar] = useState(materiaFija ? 'categoria' : 'materia')
  const [q, setQ] = useState('')

  const nombreDe = e => nombresColumnas[e.columnaId] || ''

  // Conteos para los chips (sobre el conjunto sin ese mismo filtro).
  const porCat = useMemo(() => {
    const m = {}
    for (const e of evaluaciones) {
      if (materia !== 'todas' && e.materia !== materia) continue
      const c = categoriaDe(e.tipo); m[c.id] = m[c.id] ?? { ...c, n: 0 }; m[c.id].n++
    }
    return Object.values(m).sort((a, b) => ordenCategoria(a.id) - ordenCategoria(b.id))
  }, [evaluaciones, materia])
  const porMateria = useMemo(() => {
    const m = {}
    for (const e of evaluaciones) {
      if (cat !== 'todas' && categoriaDe(e.tipo).id !== cat) continue
      m[e.materia] = (m[e.materia] ?? 0) + 1
    }
    return Object.entries(m).sort((a, b) => a[0].localeCompare(b[0], 'es'))
  }, [evaluaciones, cat])

  const filtradas = useMemo(() => {
    const txt = q.trim().toLowerCase()
    const cmp = {
      recientes: (a, b) => b.fecha.localeCompare(a.fecha),
      antiguas:  (a, b) => a.fecha.localeCompare(b.fecha),
      mayor:     (a, b) => calificacionBase10(b) - calificacionBase10(a),
      menor:     (a, b) => calificacionBase10(a) - calificacionBase10(b),
    }[orden]
    return evaluaciones
      .filter(e => cat === 'todas' || categoriaDe(e.tipo).id === cat)
      .filter(e => materia === 'todas' || e.materia === materia)
      .filter(e => !txt || `${nombreDe(e)} ${e.tipo} ${e.materia} ${e.periodo ?? ''}`.toLowerCase().includes(txt))
      // Sin agrupar manda el orden elegido; agrupado, dentro de cada grupo la
      // categoría va primero y luego el orden elegido.
      .sort((a, b) => (agrupar === 'materia' ? ordenCategoria(categoriaDe(a.tipo).id) - ordenCategoria(categoriaDe(b.tipo).id) : 0) || cmp(a, b))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evaluaciones, cat, materia, orden, agrupar, q, nombresColumnas])

  const grupos = useMemo(() => {
    if (agrupar === 'ninguno') return [{ clave: 'todas', titulo: null, items: filtradas }]
    const m = new Map()
    for (const e of filtradas) {
      const clave = agrupar === 'materia' ? e.materia : categoriaDe(e.tipo).id
      if (!m.has(clave)) m.set(clave, [])
      m.get(clave).push(e)
    }
    return [...m.entries()]
      .sort((a, b) => agrupar === 'materia' ? a[0].localeCompare(b[0], 'es') : ordenCategoria(a[0]) - ordenCategoria(b[0]))
      .map(([clave, items]) => ({ clave, titulo: agrupar === 'materia' ? clave : categoriaDe(items[0].tipo).label, items }))
  }, [filtradas, agrupar])

  const hayFiltros = cat !== 'todas' || materia !== 'todas' || q
  const limpiar = () => { setCat('todas'); setMateria('todas'); setQ('') }

  const Fila = e => {
    const color = colorMateria(e.materia, light)
    const Icono = iconoMateria(e.materia)
    const base10 = +calificacionBase10(e).toFixed(1)
    const tipo = e.tipo ? e.tipo.charAt(0).toUpperCase() + e.tipo.slice(1) : 'Evaluación'
    const nombre = nombreDe(e)
    return (
      <button key={e.id} type="button" onClick={() => onAbrir?.(e)}
        className="w-full flex items-center gap-3 p-2.5 sm:p-3 rounded-xl text-left group transition-colors hover:bg-[var(--soft-bg)]"
        style={{ border: '1px solid var(--divider)' }} title={`Ver detalle de ${nombre || tipo}`}>
        <span className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: color, color: tintaSobre(color) }}>
          <Icono size={19}/>
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 min-w-0">
            <EtiquetaCategoria tipo={e.tipo}/>
            <span className="text-sm font-semibold truncate" style={{ color: 'var(--t1)' }}>{nombre || tipo}</span>
          </span>
          <span className="block text-[11px] truncate mt-0.5" style={{ color: 'var(--t3)' }}>
            {!materiaFija && agrupar !== 'materia' ? `${e.materia} · ` : ''}
            {new Date(e.fecha + 'T12:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: '2-digit' }).replace('.', '')}
            {e.periodo ? ` · ${e.periodo}` : ''}
          </span>
        </span>
        <span className="text-right flex-shrink-0">
          <span className="inline-flex items-center justify-center min-w-[2.75rem] px-2 py-1 rounded-lg font-bold text-sm tabular-nums"
            style={{ background: 'var(--soft-bg)', color: colorCalificacion(base10) }}>{base10}</span>
          {Number(e.calMax) !== 10 && (
            <span className="block text-[10px] mt-0.5" style={{ color: 'var(--t3)' }}>{e.calificacion}/{e.calMax}</span>
          )}
        </span>
        <ChevronRight size={16} className="flex-shrink-0 transition-transform group-hover:translate-x-0.5" style={{ color: 'var(--t3)' }}/>
      </button>
    )
  }

  if (evaluaciones.length === 0) return (
    <div className="py-10 text-center" style={{ color: 'var(--t3)' }}>
      <BookOpen size={32} className="mx-auto opacity-50"/>
      <p className="text-sm mt-2">Todavía no hay evaluaciones capturadas.</p>
    </div>
  )

  return (
    <div className="space-y-3">
      {/* ── Filtros ── */}
      <div className="rounded-xl p-3 space-y-2.5" style={{ background: 'var(--soft-bg)', border: '1px solid var(--card-border)' }}>
        <div className="flex flex-col sm:flex-row gap-2">
          <label className="relative flex-1 min-w-0">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--t3)' }}/>
            <input value={q} onChange={ev => setQ(ev.target.value)} placeholder="Buscar asignación…"
              aria-label="Buscar asignación" className="input-field w-full !pl-9 min-h-10"/>
          </label>
          <div className="flex gap-2">
            <label className="flex items-center gap-1.5 min-w-0 flex-1 sm:flex-none">
              <ArrowDownUp size={14} className="flex-shrink-0" style={{ color: 'var(--t3)' }}/>
              <select value={orden} onChange={ev => setOrden(ev.target.value)} aria-label="Ordenar" className="input-field min-h-10 w-full sm:w-auto">
                {ORDENES.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </label>
            <label className="flex items-center gap-1.5 min-w-0 flex-1 sm:flex-none">
              <Layers size={14} className="flex-shrink-0" style={{ color: 'var(--t3)' }}/>
              <select value={agrupar} onChange={ev => setAgrupar(ev.target.value)} aria-label="Agrupar" className="input-field min-h-10 w-full sm:w-auto">
                {!materiaFija && <option value="materia">Por materia</option>}
                <option value="categoria">Por categoría</option>
                <option value="ninguno">Sin agrupar</option>
              </select>
            </label>
          </div>
        </div>

        <div>
          <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--t3)' }}><Tag size={11}/> Categoría</p>
          <div className="flex gap-1.5 overflow-x-auto scroll-carril sm:flex-wrap">
            <Chip activo={cat === 'todas'} onClick={() => setCat('todas')} count={porCat.reduce((s, c) => s + c.n, 0)}>Todas</Chip>
            {porCat.map(c => (
              <Chip key={c.id} activo={cat === c.id} onClick={() => setCat(c.id)} count={c.n}>
                <span className="w-2 h-2 rounded-full" style={{ background: `var(--${c.tono}-solid)` }}/>{c.label}
              </Chip>
            ))}
          </div>
        </div>

        {!materiaFija && porMateria.length > 1 && (
          <div>
            <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--t3)' }}><BookOpen size={11}/> Materia</p>
            <div className="flex gap-1.5 overflow-x-auto scroll-carril sm:flex-wrap">
              <Chip activo={materia === 'todas'} onClick={() => setMateria('todas')}>Todas</Chip>
              {porMateria.map(([m, n]) => (
                <Chip key={m} activo={materia === m} onClick={() => setMateria(m)} count={n}>
                  <span className="w-2 h-2 rounded-full" style={{ background: colorMateria(m, light) }}/>{m}
                </Chip>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 text-xs" style={{ color: 'var(--t3)' }}>
          <span>Mostrando <b style={{ color: 'var(--t1)' }}>{filtradas.length}</b> de {evaluaciones.length}</span>
          {hayFiltros && (
            <button type="button" onClick={limpiar} className="inline-flex items-center gap-1 min-h-8 px-2 rounded-lg font-semibold" style={{ color: 'var(--accent)' }}>
              <X size={12}/> Quitar filtros
            </button>
          )}
        </div>
      </div>

      {/* ── Grupos ── */}
      {filtradas.length === 0 ? (
        <p className="text-sm py-6 text-center" style={{ color: 'var(--t3)' }}>Ninguna evaluación coincide con los filtros.</p>
      ) : grupos.map(g => {
        const prom = media(g.items)
        return (
          <section key={g.clave} className="space-y-1.5">
            {g.titulo && (
              <div className="flex items-center gap-2 pt-1">
                {agrupar === 'materia'
                  ? (() => { const c = colorMateria(g.titulo, light); const I = iconoMateria(g.titulo); return (
                      <span className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: c, color: tintaSobre(c) }}><I size={14}/></span>) })()
                  : <EtiquetaCategoria tipo={g.items[0].tipo}/>}
                <h4 className="text-sm font-bold truncate" style={{ color: 'var(--t1)' }}>{g.titulo}</h4>
                <span className="text-[10px] font-bold px-1.5 py-px rounded-full" style={{ background: 'var(--soft-bg)', color: 'var(--t3)', border: '1px solid var(--card-border)' }}>
                  {g.items.length}
                </span>
                {prom !== null && (
                  <span className="ml-auto text-xs font-bold tabular-nums" style={{ color: colorCalificacion(prom) }} title="Promedio del grupo, escala de 10">
                    Prom. {prom}
                  </span>
                )}
              </div>
            )}
            <ProgressiveList items={g.items} sizes={{ mobile: 5, tablet: 5, desktop: 5 }} className="space-y-1.5">
              {Fila}
            </ProgressiveList>
          </section>
        )
      })}
    </div>
  )
}
