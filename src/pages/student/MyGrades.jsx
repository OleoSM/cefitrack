import { useMemo, useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import {
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line,
} from 'recharts'
import { Layers, ArrowLeft, ChevronRight, ClipboardList, AlertTriangle, Compass, MousePointerClick, MessageCircleQuestion } from 'lucide-react'
import MateriaBarChart from '../../components/ui/MateriaBarChart'
import { useStudentData } from '../../hooks/useStudentData'
import { calificacionBase10, colorCalificacion, tonoCalificacion, colorMateria } from '../../lib/studentMetrics'
import { fetchNombresColumnas } from '../../lib/supabaseData'
import { useStudentTheme } from '../../context/StudentThemeContext'
import KpiCard, { KpiGrid } from '../../components/ui/KpiCard'
import { IconPromedio } from '../../components/ui/SigaKpiIcons'
import { iconoMateria, claveMateria } from '../../components/ui/SigaMateriaIcons'
import DetalleEvaluacion from '../../components/ui/DetalleEvaluacion'
import ListaEvaluaciones from '../../components/ui/ListaEvaluaciones'
import { Pista, BotonAyuda, CabeceraSeccion } from '../../components/ui/Ayuda'
import { tintaSobre } from '../../lib/color'
import { areaDe } from '../../lib/areas'
import { estadoPerfil } from './EstadoPagina'

const evaluacionesTxt = n => `${n} evaluaci${n === 1 ? 'ón' : 'ones'}`
const media = evs => evs.length ? +(evs.reduce((s, e) => s + e.calificacion, 0) / evs.length).toFixed(1) : null

export default function MyGrades() {
  const { t } = useStudentTheme()
  const { student: s, evaluations, loading, error } = useStudentData({ withEvaluations: true })

  // Desde "Lo más reciente" del panel se llega con la materia ya elegida.
  const { state: navState } = useLocation()
  const [scope, setScope] = useState(navState?.materia ?? 'general')      // 'general' | nombre de materia
  useEffect(() => { if (navState?.materia) setScope(navState.materia) }, [navState])
  const area = areaDe(s?.universidadArea)

  // Se normalizan a escala 10 para que convivan evaluaciones con distinto máximo.
  const evals = useMemo(
    () => evaluations.map(e => ({ ...e, original: e.calificacion, calificacion: +calificacionBase10(e).toFixed(1) })),
    [evaluations],
  )

  const byMateria = useMemo(() => evals.reduce((acc, e) => {
    if (!acc[e.materia]) acc[e.materia] = []
    acc[e.materia].push(e)
    return acc
  }, {}), [evals])

  const materias = useMemo(() => Object.keys(byMateria), [byMateria])

  // Detalle de una calificación y nombres de las asignaciones de la hoja.
  const [detalle, setDetalle] = useState(null)
  const [nombresColumnas, setNombresColumnas] = useState({})
  useEffect(() => {
    let vivo = true
    fetchNombresColumnas(evaluations.map(e => e.columnaId)).then(m => { if (vivo) setNombresColumnas(m) }).catch(() => {})
    return () => { vivo = false }
  }, [evaluations])

  /* Icono de cada materia. Si dos materias caen en la misma familia (Álgebra
     y Geometría → matemáticas), la segunda usa la variante B: así no se ven
     dos tarjetas idénticas una junto a otra. */
  const iconoDe = useMemo(() => {
    const vistas = {}
    const mapa = {}
    for (const m of materias) {
      const k = claveMateria(m)
      mapa[m] = iconoMateria(m, vistas[k] ?? 0)
      vistas[k] = (vistas[k] ?? 0) + 1
    }
    return m => mapa[m] ?? iconoMateria(m)
  }, [materias])

  const estado = estadoPerfil({ loading, student: s, error })
  if (estado) return estado

  // El color sale del nombre de la materia, no de su posición: así es el
  // mismo aquí, en Mi Panel y en la gráfica.
  const colorOf = mat => colorMateria(mat, t.light)

  /* ── Alcance: general o una materia ── */
  const scopeEvals = scope === 'general' ? evals : (byMateria[scope] ?? [])
  // Sin evaluaciones no hay promedio: un 0 se leía como "reprobado".
  const scopeProm = media(scopeEvals)
  const scopeBajo6 = scopeEvals.filter(e => e.calificacion < 6).length

  const materiaStats = materias.map(mat => ({ materia: mat, promedio: media(byMateria[mat]), count: byMateria[mat].length }))

  /* Serie temporal de la materia seleccionada */
  const materiaSerie = scope !== 'general'
    ? [...scopeEvals].sort((a, b) => a.fecha.localeCompare(b.fecha)).map(e => ({
        fecha: new Date(e.fecha + 'T12:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }).replace('.', ''),
        calificacion: e.calificacion, tipo: e.tipo,
      }))
    : []


  return (
    <div className="w-full space-y-5">
      {/* Encabezado */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="page-title">Mis Calificaciones</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--t3)' }}>
            {scope === 'general' ? 'Tus calificaciones de todas las materias. Toca una materia para ver el detalle.' : `Detalle de ${scope}.`}
          </p>
          {/* El área decide qué examen presenta el alumno. Solo aplica a
              universidad: ECOEMS no se divide por áreas. */}
          {area && (
            <Pista texto="Tu área de examen de universidad. Define qué materias pesan más en tu preparación.">
              <span className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-full text-[11px] font-bold"
                style={{ background: 'var(--soft-bg)', color: 'var(--t2)', border: '1px solid var(--card-border)' }}>
                <Compass size={12}/> {area.label}
              </span>
            </Pista>
          )}
        </div>
        <BotonAyuda titulo="Mis calificaciones">
          <p>Aquí ves cada calificación que tu docente registró, agrupada por materia.</p>
          <p><b>Escala:</b> todas se convierten a escala de 10, aunque el examen haya sido sobre otro máximo (por ejemplo 45 de 50 = 9.0).</p>
          <p><b>Colores:</b> <b style={{ color: 'var(--good)' }}>verde</b> 8 o más · <b style={{ color: 'var(--info)' }}>azul</b> de 6 a 7.9 · <b style={{ color: 'var(--bad)' }}>rojo</b> menos de 6.</p>
          <p><b>Promedio de esta página:</b> es la media simple de tus calificaciones. El <b>promedio oficial</b> (el de Mi Panel) combina exámenes, tareas y asistencia con los pesos que define CEFIMAT.</p>
          <p>Usa los botones de materia para cambiar entre "Todas" y una materia concreta.</p>
        </BotonAyuda>
      </div>

      {/* Las calificaciones las captura el profesor: una duda sobre una nota se
          resuelve con él, en clase, no en la plataforma. */}
      <div role="note" className="flex items-start gap-2.5 rounded-xl px-3.5 py-3 text-sm"
        style={{ background: 'var(--info-soft)', border: '1px solid var(--info-line)', color: 'var(--t2)' }}>
        <MessageCircleQuestion size={18} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--info)' }}/>
        <p>
          <b style={{ color: 'var(--t1)' }}>¿Dudas con una calificación?</b> Coméntalo directamente con tu
          profesor en clase: él puede revisarla y corregirla si hace falta.
        </p>
      </div>

      {/* ── Selector de materia: visible y explícito ──
          Antes era un desplegable discreto en la esquina y nadie sabía que
          existía. Ahora es una fila de botones rotulada. */}
      {materias.length > 0 && (
        <div className="card p-3 sm:p-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold mb-2.5" style={{ color: 'var(--t2)' }}>
            <MousePointerClick size={14} style={{ color: 'var(--accent)' }}/> ¿Qué materia quieres ver? Toca una para cambiar.
          </p>
          <div role="tablist" aria-label="Materia" className="flex gap-2 overflow-x-auto scroll-carril sm:flex-wrap pb-0.5">
            {[{ id: 'general', label: 'Todas', Icono: Layers }, ...materias.map(m => ({ id: m, label: m, Icono: iconoDe(m) }))].map(({ id, label, Icono }) => {
              const activo = scope === id
              const color = id === 'general' ? null : colorOf(id)
              return (
                <button key={id} type="button" role="tab" aria-selected={activo} onClick={() => setScope(id)}
                  className="flex-shrink-0 min-h-11 inline-flex items-center gap-2 pl-1.5 pr-3.5 rounded-full text-sm font-semibold transition-colors"
                  style={activo
                    ? { background: 'var(--accent)', color: 'var(--accent-contrast)', border: '1px solid var(--accent)' }
                    : { background: 'var(--card-bg)', color: 'var(--t1)', border: '1px solid var(--card-border)' }}>
                  <span className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                    style={color ? { background: color, color: tintaSobre(color) } : { background: 'var(--soft-bg)', color: 'var(--t2)' }}>
                    <Icono size={16}/>
                  </span>
                  <span className="whitespace-nowrap">{label}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Indicadores (en función del alcance elegido) */}
      <KpiGrid cols={3}>
        <KpiCard icon={IconPromedio}
          label={scope === 'general' ? 'Promedio de calificaciones' : `Promedio · ${scope}`}
          info="Media simple de tus calificaciones en escala de 10. El promedio oficial, que también cuenta tareas y asistencia, está en Mi Panel."
          value={scopeProm ?? '—'} unit={scopeProm === null ? undefined : '/ 10'}
          sub={scopeProm === null ? 'Aún sin evaluaciones' : 'Media simple de lo registrado'}
          tone={tonoCalificacion(scopeProm)}/>
        <KpiCard icon={ClipboardList} label="Evaluaciones registradas"
          info="Cuántas calificaciones tiene registradas tu docente en lo que estás viendo, contra el total de todas tus materias."
          value={scopeEvals.length} unit={`/ ${evals.length}`}
          sub={scope === 'general' ? 'En todas las materias' : `De ${evals.length} en total`}
          tone="neutral"/>
        <KpiCard icon={AlertTriangle}
          label={scopeBajo6 > 0 ? 'Por debajo de 6' : 'Ninguna reprobada'}
          info="Calificaciones menores a 6 (reprobatorias). Son las que conviene repasar primero."
          value={scopeEvals.length ? scopeBajo6 : '—'}
          sub={scopeEvals.length ? `De ${scopeEvals.length} evaluaciones` : 'Aún sin evaluaciones'}
          tone={!scopeEvals.length ? 'neutral' : scopeBajo6 > 0 ? 'bad' : 'good'}/>
      </KpiGrid>

      {/* ── Materias ── */}
      {scope === 'general' && materias.length === 0 ? (
        <div className="card p-8 text-center text-sm" style={{ color: 'var(--t3)' }}>
          Tu docente todavía no ha registrado calificaciones.
        </div>
      ) : scope === 'general' ? (
        <section className="space-y-3">
          <CabeceraSeccion titulo="Tus materias"
            subtitulo="Toca una materia para ver cada calificación."
            ayuda={<>
              <p>Cada tarjeta es una materia con el promedio de sus calificaciones.</p>
              <p>El número grande es la media simple en escala de 10, con el mismo código de color: verde 8 o más, azul de 6 a 7.9, rojo menos de 6.</p>
              <p>Toca la tarjeta para ver la lista completa y cómo has ido avanzando.</p>
            </>}/>
          {/* Tarjeta compacta en una fila: icono, nombre y promedio. Sustituye
              a la ilustración 3:4, que ocupaba media pantalla por materia sin
              decir nada que el icono no dijera. */}
          <div className="grid gap-2.5 sm:gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 15rem), 1fr))' }}>
            {materias.map(mat => {
              const evs = byMateria[mat]
              const prom = media(evs)
              const color = colorOf(mat)
              const Icono = iconoDe(mat)
              return (
                <button key={mat} type="button" onClick={() => setScope(mat)}
                  className="card w-full text-left flex items-center gap-3 p-3 sm:p-3.5 group transition-colors hover:border-[var(--accent)]"
                  style={{ borderLeft: `4px solid ${color}` }}>
                  <span className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: color, color: tintaSobre(color) }}>
                    <Icono size={22}/>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold truncate" style={{ color: 'var(--t1)' }}>{mat}</span>
                    <span className="flex items-center gap-1 text-[11px] mt-0.5" style={{ color: 'var(--t3)' }}>
                      {evaluacionesTxt(evs.length)}
                      <span className="inline-flex items-center gap-0.5 font-semibold" style={{ color: 'var(--accent)' }}>
                        · Ver detalle <ChevronRight size={12} className="transition-transform group-hover:translate-x-0.5"/>
                      </span>
                    </span>
                  </span>
                  <Pista texto={`Promedio de tus ${evaluacionesTxt(evs.length)} de ${mat}, en escala de 10.`}>
                    <span className="text-2xl font-bold tabular-nums" style={{ color: colorCalificacion(prom) }}>{prom}</span>
                  </Pista>
                </button>
              )
            })}
          </div>

          {/* Lista completa, con la misma presentación que el detalle de una
              materia y que el perfil en administración. */}
          <div className="card p-3 sm:p-4 space-y-3">
            <CabeceraSeccion titulo="Todas tus evaluaciones"
              subtitulo="Ordenadas por materia y categoría. Toca una para ver el detalle."
              ayuda={<>
                <p>Aquí están todas tus calificaciones juntas, agrupadas por materia y, dentro de cada una, por categoría (exámenes primero, luego simulacros, proyectos, tareas y actividades).</p>
                <p>Usa los filtros para ver solo una categoría o una materia, cambia el orden o busca una asignación por su nombre.</p>
                <p>La etiqueta de color de cada fila dice qué tipo de evaluación es. Toca la fila para ver el detalle.</p>
              </>}/>
            <ListaEvaluaciones light={t.light} nombresColumnas={nombresColumnas}
              evaluaciones={evals.map(e => ({ ...e, calificacion: e.original }))}
              onAbrir={setDetalle}/>
          </div>
        </section>
      ) : (
        (() => {
          const mat = scope
          const evs = byMateria[mat] ?? []
          const prom = media(evs)
          const color = colorOf(mat)
          const Icono = iconoDe(mat)
          return (
            <section className="space-y-2.5">
              <div className="card overflow-hidden" style={{ borderLeft: `4px solid ${color}` }}>
                <div className="px-3 sm:px-5 py-3 flex items-center justify-between gap-2 sm:gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <button type="button" onClick={() => setScope('general')} aria-label="Volver a todas las materias"
                      title="Volver a todas las materias"
                      className="min-w-11 min-h-11 -ml-1.5 flex items-center justify-center rounded-xl flex-shrink-0"
                      style={{ color: 'var(--t2)', background: 'var(--soft-bg)', border: '1px solid var(--card-border)' }}>
                      <ArrowLeft size={16}/>
                    </button>
                    <span className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: color, color: tintaSobre(color) }}>
                      <Icono size={20}/>
                    </span>
                    <div className="min-w-0">
                      <h2 className="font-bold text-sm sm:text-base truncate" style={{ color: 'var(--t1)' }}>{mat}</h2>
                      <p className="text-[11px]" style={{ color: 'var(--t3)' }}>{evaluacionesTxt(evs.length)} de {evals.length}</p>
                    </div>
                  </div>
                  <Pista texto={`Promedio de ${mat} en escala de 10.`}>
                    <span className="text-xl sm:text-2xl font-bold tabular-nums flex-shrink-0" style={{ color: colorCalificacion(prom) }}>{prom ?? '—'}</span>
                  </Pista>
                </div>
              </div>

              {/* Misma lista que el perfil del alumno en administración: cada
                  fila abre el detalle de la asignación. */}
              <div className="card p-3 sm:p-4">
                {/* La lista guarda la calificación en su escala original. */}
                <ListaEvaluaciones materiaFija light={t.light} nombresColumnas={nombresColumnas}
                  evaluaciones={evs.map(e => ({ ...e, calificacion: e.original }))}
                  onAbrir={setDetalle}/>
              </div>
            </section>
          )
        })()
      )}

      {/* ── Gráfica ── */}
      {materias.length > 0 && (
        <div className="card p-4 sm:p-5 space-y-4">
          <CabeceraSeccion
            titulo={scope === 'general' ? 'Promedio por materia' : `Evolución de ${scope}`}
            subtitulo={scope === 'general' ? 'Compara tus materias de un vistazo.' : 'Cómo han ido tus calificaciones en el tiempo.'}
            ayuda={scope === 'general'
              ? <><p>Cada barra es el promedio de una materia en escala de 10. La línea marca tu promedio general.</p><p>Las barras más cortas son las materias que más conviene reforzar.</p></>
              : <><p>Cada punto es una calificación, de la más antigua a la más reciente. Si la línea sube, vas mejorando.</p><p>Pasa el ratón o toca un punto para ver la evaluación.</p></>}/>
          {scope === 'general' ? (
            <MateriaBarChart stats={materiaStats} colorOf={colorOf} t={t} avg={scopeProm}/>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={materiaSerie} margin={{ top: 5, right: 8, bottom: 0, left: -22 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={t.grid}/>
                <XAxis dataKey="fecha" tick={{ fontSize: 10, fill: t.axis }} axisLine={false} tickLine={false}/>
                <YAxis domain={[0, 10]} tick={{ fontSize: 11, fill: t.axis }} axisLine={false} tickLine={false}/>
                <Tooltip wrapperStyle={{ outline: 'none' }} cursor={{ stroke: t.grid, strokeWidth: 1 }}
                  contentStyle={{ fontSize: 11, borderRadius: 10, background: t.tooltipBg, border: `1px solid ${t.tooltipBorder}`, color: t.tooltipText }}
                  formatter={(v, _, p) => [`${v} — ${p.payload.tipo}`, 'Calificación']}/>
                <Line type="monotone" dataKey="calificacion" stroke={colorOf(scope)} strokeWidth={2.5}
                  dot={{ r: 3.5, fill: colorOf(scope), strokeWidth: 0 }} activeDot={{ r: 5.5 }}/>
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      {detalle && (
        <DetalleEvaluacion evaluacion={detalle} light={t.light}
          onClose={() => setDetalle(null)}/>
      )}
    </div>
  )
}
