import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, ResponsiveContainer,
} from 'recharts'
import { ArrowRight, Target, Zap, Trophy, Settings2, Check, GripHorizontal, ChevronRight, MessageCircle } from 'lucide-react'

// Contacto de CEFIMAT para dudas que no resuelve el profesor en turno.
const WHATSAPP = '5572008538'
import { getLastSimulacro, getTargetSchool, getSimulacrosByStudent, attendanceColors } from '../../data/mockData'
import { logoInstitucion, tipoDesdeNombre, estiloLogo } from '../../lib/instituciones'
import { useStudentData } from '../../hooks/useStudentData'
import { useConfiguracion } from '../../hooks/useConfiguracion'
import {
  promedioPonderado, rankingGrupo, statsAsistencia, esExamen, esTarea, evolucionPorMateria,
  colorCalificacion, tonoCalificacion, colorAsistencia, tonoAsistencia, colorMateria, calificacionBase10,
} from '../../lib/studentMetrics'
import { fetchGroupMetrics, fetchNombresColumnas } from '../../lib/supabaseData'
import DetalleEvaluacion from '../../components/ui/DetalleEvaluacion'
import { EtiquetaCategoria } from '../../components/ui/ListaEvaluaciones'
import { useStudentTheme, esColorClaro } from '../../context/StudentThemeContext'
import { BotonAyuda, CabeceraSeccion } from '../../components/ui/Ayuda'
import { iconoMateria } from '../../components/ui/SigaMateriaIcons'
import { tintaSobre } from '../../lib/color'
import KpiCard, { KpiGrid } from '../../components/ui/KpiCard'
import { IconAsistencia, IconPromedio, IconRanking, IconExpediente } from '../../components/ui/SigaKpiIcons'
import { NeonCheckbox } from '../../components/ui/NeonCheckbox'
import { estadoPerfil } from './EstadoPagina'
import { fetchPermisosAlumno } from '../../lib/permisosAlumno'
import TarjetaLiga from '../../components/ui/TarjetaLiga'

const KPI_IDS = ['simulacro', 'asistencia', 'tareas', 'promedio', 'ranking']
const KPI_NOMBRES = {
  simulacro: 'Último simulacro', asistencia: 'Asistencia', tareas: 'Tareas entregadas',
  promedio: 'Promedio ponderado', ranking: 'Lugar en grupo',
}
const KPI_DEFECTO = ['asistencia', 'tareas', 'promedio', 'ranking']
const KPI_KEY = 'student-dashboard-kpis'

function leerKpis() {
  try {
    const v = JSON.parse(localStorage.getItem(KPI_KEY))
    return Array.isArray(v) && v.length ? v.filter(id => KPI_IDS.includes(id)) : KPI_DEFECTO
  } catch { return KPI_DEFECTO }
}

/** Enlace "Ver más" de las tarjetas: área táctil de 44 px. */
function VerMas({ onClick, t }) {
  return (
    <button type="button" onClick={onClick}
      className="min-h-11 -mr-2 px-2 text-xs font-bold hover:underline inline-flex items-center gap-1 rounded-lg"
      style={{ color: t.light ? 'var(--accent)' : 'var(--t2)' }}>
      Ver más <ArrowRight size={12}/>
    </button>
  )
}

export default function StudentDashboard() {
  const navigate = useNavigate()
  // Pesos globales al día: si llegan de la BD después de montar, el promedio
  // y el lugar se recalculan en vez de quedarse con la copia vieja.
  const { pesos: pesosGlobales } = useConfiguracion()
  const { t, card } = useStudentTheme()
  const tarjetaClara = esColorClaro(card.grad)
  const tintaTarjeta = tarjetaClara ? '#0f172a' : '#ffffff'

  const { student: s, group: grp, attendance, evaluations, loading, error } = useStudentData({
    withAttendance: true, withEvaluations: true,
  })

  const [ultimasFilter, setUltimasFilter] = useState('todas')
  const [hiddenMaterias, setHiddenMaterias] = useState([])
  const [groupMetrics, setGroupMetrics] = useState(null)
  const [kpiSettingsOpen, setKpiSettingsOpen] = useState(false)
  const [visibleKpis, setVisibleKpis] = useState(leerKpis)
  // Si el admin le ocultó Rankings, no se muestra "Lugar en grupo".
  const [verRankings, setVerRankings] = useState(true)
  useEffect(() => {
    if (!s?.id) return
    fetchPermisosAlumno(s.id).then(p => setVerRankings(p.verRankings !== false)).catch(() => {})
  }, [s?.id])
  const kpiPermitidos = verRankings ? KPI_IDS : KPI_IDS.filter(id => id !== 'ranking')
  const [arrastrando, setArrastrando] = useState(null)
  // Detalle de una calificación de "Lo más reciente" y nombres de asignación.
  const [detalle, setDetalle] = useState(null)
  const [nombresColumnas, setNombresColumnas] = useState({})
  useEffect(() => {
    let vivo = true
    fetchNombresColumnas(evaluations.map(e => e.columnaId)).then(m => { if (vivo) setNombresColumnas(m) }).catch(() => {})
    return () => { vivo = false }
  }, [evaluations])
  const kpiMenuRef = useRef(null)

  // Datos del grupo completo: necesarios para calcular el lugar del alumno.
  useEffect(() => {
    if (!s?.groupId) return
    let alive = true
    fetchGroupMetrics(s.groupId)
      .then(m => { if (alive) setGroupMetrics(m) })
      .catch(() => {})
    return () => { alive = false }
  }, [s?.groupId])

  // El menú de tarjetas se cierra al tocar fuera, como el resto de menús.
  useEffect(() => {
    if (!kpiSettingsOpen) return undefined
    const fuera = e => { if (!kpiMenuRef.current?.contains(e.target)) setKpiSettingsOpen(false) }
    document.addEventListener('pointerdown', fuera)
    return () => document.removeEventListener('pointerdown', fuera)
  }, [kpiSettingsOpen])

  /* ── Pipeline oficial: promedio ponderado + lugar en el grupo ──
     (los simulacros siguen en mockData; calificaciones y asistencia son de BD) */
  const pipeline = useMemo(() => {
    if (!s) return null
    const pond    = promedioPonderado(s, { evals: evaluations, attendance }, pesosGlobales)
    const ranking = groupMetrics
      ? rankingGrupo(groupMetrics.members, groupMetrics.evalsByStudent, groupMetrics.attendanceByStudent, pond.pesos)
      : []
    const myPos   = ranking.findIndex(x => x.id === s.id) + 1
    const asis    = statsAsistencia(attendance)
    const evo     = evolucionPorMateria(evaluations)
    return { pond, ranking, myPos, asis, evs: evaluations, evo }
  }, [s, attendance, evaluations, groupMetrics, pesosGlobales])

  const estado = estadoPerfil({ loading, student: s, error })
  if (estado) return estado
  if (!pipeline) return null

  const { pond, ranking, myPos, asis, evs, evo } = pipeline
  const lastSim = getLastSimulacro(s.id)
  const targetSchool = getTargetSchool(s.id)
  const allSims = getSimulacrosByStudent(s.id)

  /* Colores de estado: los mismos semánticos que el resto del portal, en el
     orden de `counts` (presente · tardanza · ausente). */
  const ESTADO_COLOR = { presente: t.good, tardanza: t.warn, ausente: t.bad }

  // Solo categorías con valor > 0: con todo en cero Recharts genera arcos NaN
  // (SVG corrupto, se ve como pantalla rota, especialmente en móvil).
  const attPieAll = Object.entries(asis.counts).map(([k, v]) => ({ key: k, name: attendanceColors[k].label, value: v }))
  const attPie = attPieAll.filter(d => d.value > 0)
  const hasAttendance = attPie.length > 0

  /* ── Últimas evaluaciones/exámenes/tareas ── */
  const ultimasOptions = [
    { value: 'todas',    label: 'Últimas evaluaciones', corto: 'Todas' },
    { value: 'examenes', label: 'Últimos exámenes',     corto: 'Exámenes' },
    { value: 'tareas',   label: 'Últimas tareas',       corto: 'Tareas' },
  ]
  const ultimas = [...evs]
    .filter(e => ultimasFilter === 'examenes' ? esExamen(e.tipo) : ultimasFilter === 'tareas' ? esTarea(e.tipo) : true)
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
    .slice(0, 5)

  const toggleMateria = m =>
    setHiddenMaterias(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m])

  const guardarOrden = lista => { try { localStorage.setItem(KPI_KEY, JSON.stringify(lista)) } catch { /* sin almacenamiento */ } }

  const toggleKpi = id => setVisibleKpis(prev => {
    const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    const safe = next.length ? next : prev
    guardarOrden(safe)
    return safe
  })

  /* ── Reordenar tarjetas arrastrando ──
     Con eventos de puntero (no drag & drop nativo): funcionan igual con
     ratón y con el dedo. Mientras se arrastra, la tarjeta ocupa el hueco de
     la que tiene debajo; al soltar se guarda el orden. */
  const moverKpi = (id, destino) => setVisibleKpis(prev => {
    if (!destino || destino === id || !prev.includes(destino)) return prev
    const desde = prev.indexOf(id)
    const hacia = prev.indexOf(destino)
    const lista = prev.filter(x => x !== id)
    lista.splice(lista.indexOf(destino) + (desde < hacia ? 1 : 0), 0, id)
    return lista
  })
  const empezarArrastre = (id, e) => {
    e.preventDefault()
    setArrastrando(id)
    const mover = ev => {
      const slot = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('[data-kpi-slot]')
      moverKpi(id, slot?.dataset.kpiSlot)
    }
    const soltar = () => {
      setArrastrando(null)
      setVisibleKpis(prev => { guardarOrden(prev); return prev })
      window.removeEventListener('pointermove', mover)
      window.removeEventListener('pointerup', soltar)
      window.removeEventListener('pointercancel', soltar)
    }
    window.addEventListener('pointermove', mover)
    window.addEventListener('pointerup', soltar)
    window.addEventListener('pointercancel', soltar)
  }
  // Teclado: con la pestaña enfocada, ← y → la mueven un lugar.
  const moverConTeclado = (id, e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    setVisibleKpis(prev => {
      const i = prev.indexOf(id)
      const j = e.key === 'ArrowLeft' ? i - 1 : i + 1
      if (j < 0 || j >= Math.min(prev.length, 4)) return prev
      const lista = [...prev]
      ;[lista[i], lista[j]] = [lista[j], lista[i]]
      guardarOrden(lista)
      return lista
    })
  }

  const { pesos } = pond
  const pctTareas = s.assignmentsTotal > 0 ? Math.round((s.assignmentsDone ?? 0) / s.assignmentsTotal * 100) : null
  const faltanPuntos = myPos > 1 && pond.promedio !== null && ranking[myPos - 2]
    ? (ranking[myPos - 2].promedio - pond.promedio).toFixed(1)
    : null

  const KPIS = {
    simulacro: {
      icon: Zap, label: 'Último simulacro',
      value: lastSim ? `${lastSim.aciertos}/${lastSim.total}` : '—',
      sub: lastSim?.folio ?? 'Sin simulacros registrados', tone: 'neutral',
      onClick: lastSim ? () => document.getElementById('prediccion')?.scrollIntoView({ behavior: 'smooth' }) : undefined,
    },
    asistencia: {
      icon: IconAsistencia, label: 'Asistencia',
      value: asis.pct === null ? '—' : asis.pct, unit: asis.pct === null ? undefined : '%',
      sub: asis.pct === null ? 'Sin listas aún' : `${asis.counts.presente} presentes`,
      tone: tonoAsistencia(asis.pct), onClick: () => navigate('/student/asistencias'),
    },
    tareas: {
      icon: IconExpediente, label: 'Tareas entregadas',
      value: s.assignmentsTotal > 0 ? `${s.assignmentsDone ?? 0}/${s.assignmentsTotal}` : '—',
      sub: pctTareas === null ? 'Sin tareas asignadas' : `${pctTareas}% completado`,
      tone: pctTareas === null ? 'neutral' : pctTareas >= 80 ? 'good' : 'warn',
      onClick: () => navigate('/student/calificaciones'),
    },
    promedio: {
      icon: IconPromedio, label: 'Promedio general ponderado',
      value: pond.promedio ?? '—', unit: pond.promedio === null ? undefined : '/ 10',
      sub: `Exámenes ${pesos.examenes}% · Tareas ${pesos.tareas}% · Asistencia ${pesos.asistencia}%`,
      tone: tonoCalificacion(pond.promedio), onClick: () => navigate('/student/calificaciones'),
    },
    ranking: {
      icon: IconRanking, label: 'Lugar en grupo',
      value: myPos ? `#${myPos}` : '—',
      sub: ranking.length ? `De ${ranking.length} alumnos` : 'Sin ranking aún',
      tone: 'neutral',
      pill: faltanPuntos ? { text: `A ${faltanPuntos} pts del #${myPos - 1}` } : undefined,
    },
  }
  // El orden es el que eligió el alumno (arrastrando), no el del catálogo.
  const kpisVisibles = visibleKpis.filter(id => kpiPermitidos.includes(id)).slice(0, 4)
  const KPI_INFO = {
    simulacro: 'Aciertos de tu último examen de simulación sobre el total de preguntas.',
    asistencia: 'Porcentaje de clases a las que asististe. Cada 3 retardos cuentan como 1 falta. Para la garantía necesitas al menos 90 %.',
    tareas: 'Tareas que entregaste de las que te asignaron. Para la garantía debes entregar todas y sacar mínimo 80 % en cada una.',
    promedio: `Tu promedio oficial: combina exámenes (${pesos.examenes} %), tareas (${pesos.tareas} %) y asistencia (${pesos.asistencia} %). Si aún no hay datos de alguna parte, su peso se reparte entre las demás.`,
    ranking: 'Tu lugar en el grupo según el promedio ponderado. Tus compañeros no ven tus calificaciones ni tú las suyas.',
  }

  return (
    <div className="w-full space-y-5">

      {/* ══ Tarjeta de bienvenida (color personalizable en Configuración) ══ */}
      {/* La tinta se decide por la luminancia del color elegido: con los
          claros y con la rueda libre, el blanco de siempre sería ilegible.
          El promedio y el lugar ya están en la fila de indicadores; aquí
          se quedan sólo la identidad del alumno y su grupo. */}
      <div className="kw rounded-2xl p-5 sm:p-6"
        style={{
          background: card.grad,
          color: tintaTarjeta,
          border: `1px solid ${tarjetaClara ? 'rgba(15,23,42,.14)' : 'rgba(255,255,255,.10)'}`,
        }}>
        <div className="flex items-center gap-4">
          {s.avatarSrc ? (
            <img src={s.avatarSrc} alt=""
              className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl object-cover flex-shrink-0"
              style={{ background: tarjetaClara ? 'rgba(15,23,42,.08)' : 'rgba(255,255,255,.10)' }}/>
          ) : (
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center text-lg sm:text-xl font-bold flex-shrink-0"
              style={{ background: tarjetaClara ? 'rgba(15,23,42,.10)' : 'rgba(255,255,255,.10)' }}>
              {s.name.split(' ').slice(0, 2).map(n => n[0]).join('')}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm" style={{ opacity: .6 }}>Bienvenido de vuelta</p>
            <h1 className="text-lg sm:text-xl font-bold truncate">{s.name}</h1>
            <p className="text-xs sm:text-sm mt-0.5 truncate" style={{ opacity: .6 }}>
              {[grp?.name, grp?.subject].filter(Boolean).join(' — ')}
            </p>
          </div>
        </div>
      </div>

      {/* ══ Liga y racha (asistencia) ══ */}
      <TarjetaLiga/>

      {/* ══ Dudas o comentarios ══ */}
      <div className="card p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <span className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'var(--soft-bg)', color: 'var(--accent)' }}>
          <MessageCircle size={18}/>
        </span>
        <p className="text-sm flex-1 min-w-0" style={{ color: 'var(--t1)' }}>
          <b>¿Dudas o comentarios?</b> Revísalo con tu profesor en turno.
          <span className="block text-xs mt-0.5" style={{ color: 'var(--t3)' }}>También puedes escribirnos por WhatsApp al {WHATSAPP.replace(/(\d{2})(\d{4})(\d{4})/, '$1 $2 $3')}.</span>
        </p>
        <a href={`https://wa.me/52${WHATSAPP}`} target="_blank" rel="noreferrer" className="btn-secondary min-h-11 justify-center text-sm">
          <MessageCircle size={15}/> Escribir por WhatsApp
        </a>
      </div>

      {/* ══ Indicadores ══ */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="section-title">Mi resumen</h2>
          <p className="text-[11px] mt-0.5 hidden sm:flex items-center gap-1" style={{ color: 'var(--t3)' }}>
            <GripHorizontal size={13}/> Arrastra la pestaña de una tarjeta para cambiarla de lugar.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
        <BotonAyuda titulo="Mi resumen">
          <p>Son tus indicadores principales. Pasa el ratón (o toca) el nombre de cada uno para saber qué mide.</p>
          <p><b>Cambiar el orden:</b> arrastra la pestaña <GripHorizontal size={13} className="inline"/> que está arriba de cada tarjeta. Con teclado, enfócala y usa las flechas ← →.</p>
          <p><b>Elegir cuáles ver:</b> con el botón de ajustes <Settings2 size={13} className="inline"/> puedes mostrar hasta cuatro.</p>
          <p>Las tarjetas con flecha llevan a su detalle al tocarlas.</p>
        </BotonAyuda>
        <div className="relative" ref={kpiMenuRef}>
          <button type="button" onClick={() => setKpiSettingsOpen(v => !v)}
            className="min-w-11 min-h-11 rounded-xl flex items-center justify-center"
            aria-expanded={kpiSettingsOpen} aria-label="Configurar tarjetas" title="Configurar tarjetas"
            style={{ background: 'var(--soft-bg)', border: '1px solid var(--card-border)', color: 'var(--t2)' }}>
            <Settings2 size={15}/>
          </button>
          {kpiSettingsOpen && (
            <div className="absolute right-0 top-full mt-2 z-40 w-60 rounded-xl p-3 space-y-1 animate-fade-in"
              style={{ background: 'var(--panel-bg)', border: '1px solid var(--card-border)', boxShadow: '0 18px 48px rgba(0,0,0,.3)' }}>
              <p className="text-xs font-bold" style={{ color: 'var(--t1)' }}>Tarjetas visibles</p>
              <p className="text-[10px] pb-1" style={{ color: 'var(--t3)' }}>Se muestran hasta cuatro.</p>
              {kpiPermitidos.map(id => (
                <NeonCheckbox key={id} className="w-full min-h-11"
                  checked={visibleKpis.includes(id)} onChange={() => toggleKpi(id)}
                  label={KPI_NOMBRES[id]}/>
              ))}
            </div>
          )}
        </div>
        </div>
      </div>
      <KpiGrid cols={4} className="pt-2">
        {kpisVisibles.map(id => (
          <div key={id} data-kpi-slot={id} className="relative h-full transition-opacity"
            style={arrastrando === id ? { opacity: .55 } : undefined}>
            {/* Pestaña de arrastre: sobresale del borde superior para no tapar
                el contenido de la tarjeta. */}
            <button type="button" data-sin-zoom
              onPointerDown={e => empezarArrastre(id, e)}
              onKeyDown={e => moverConTeclado(id, e)}
              aria-label={`Mover la tarjeta ${KPI_NOMBRES[id]} (flechas izquierda y derecha)`}
              title="Arrastra para mover esta tarjeta"
              className="absolute -top-2.5 left-1/2 -translate-x-1/2 z-20 w-12 h-6 rounded-full flex items-center justify-center"
              style={{ background: 'var(--panel-bg)', border: '1px solid var(--card-border)', color: 'var(--t2)',
                       cursor: arrastrando === id ? 'grabbing' : 'grab', touchAction: 'none',
                       boxShadow: '0 2px 6px rgba(0,0,0,.15)' }}>
              <GripHorizontal size={15}/>
            </button>
            <KpiCard {...KPIS[id]} info={KPI_INFO[id]}
              className={arrastrando === id ? 'ring-2 [--tw-ring-color:var(--accent)]' : ''}/>
          </div>
        ))}
      </KpiGrid>

      {/* ══ Predicción de escuela ══ */}
      {(lastSim || targetSchool) && (() => {
        const score   = lastSim?.aciertos ?? null
        const cutoff  = targetSchool?.corte ?? null
        const gap     = score !== null && cutoff !== null ? cutoff - score : null
        const reached = gap !== null && gap <= 0
        const pct     = score !== null && cutoff !== null ? Math.min(100, Math.round((score / cutoff) * 100)) : null
        const barColor = reached ? 'var(--good)' : pct >= 80 ? 'var(--warn)' : 'var(--info)'
        const logo = logoInstitucion(targetSchool?.tipo ?? tipoDesdeNombre(targetSchool?.nombre))
        return (
          <div id="prediccion" className="card p-4 sm:p-5 relative overflow-hidden">
            <div className="relative flex flex-col sm:flex-row sm:items-center gap-4">
              {logo ? (
                <div className="w-12 h-12 flex items-center justify-center flex-shrink-0">
                  {/* Sobre la tarjeta clara el escudo va con sus colores; en
                      el tema oscuro se pinta en blanco o se perdería. */}
                  <img src={logo.src} alt={logo.alt} style={estiloLogo(!t.light)}
                    className="max-w-full max-h-full object-contain"/>
                </div>
              ) : (
                <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
                  style={{ background: reached ? 'var(--good-soft)' : 'var(--info-soft)',
                           border: `1px solid ${reached ? 'var(--good-line)' : 'var(--info-line)'}` }}>
                  {reached ? <Trophy size={20} style={{ color: 'var(--good)' }}/> : <Target size={20} style={{ color: 'var(--info)' }}/>}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="section-title">Último simulacro vs objetivo</h2>
                  {allSims.length > 0 && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                      style={{ background: 'var(--soft-bg)', color: 'var(--t3)' }}>
                      {allSims.length} simulacro{allSims.length > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                {reached ? (
                  <p className="text-sm font-semibold mt-1" style={{ color: 'var(--good)' }}>
                    ¡Alcanzaste el puntaje de corte de {targetSchool?.nombre}!
                  </p>
                ) : gap !== null ? (
                  <p className="text-sm font-semibold mt-1" style={{ color: 'var(--t2)' }}>
                    Te faltan <span style={{ color: 'var(--warn)', fontWeight: 800 }}>{gap} aciertos</span> para{' '}
                    <span style={{ color: 'var(--t1)' }}>{targetSchool?.nombre}</span>
                  </p>
                ) : (
                  <p className="text-sm mt-1" style={{ color: 'var(--t3)' }}>Aún no hay simulacros registrados</p>
                )}
                {pct !== null && (
                  <div className="mt-3">
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--soft-bg)' }}>
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: barColor }}/>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[10px]" style={{ color: 'var(--t4)' }}>0 aciertos</span>
                      <span className="text-[10px]" style={{ color: 'var(--t4)' }}>Corte: {cutoff}</span>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3 sm:gap-4 flex-shrink-0">
                {score !== null && (
                  <div className="text-center">
                    <p className="text-3xl sm:text-4xl font-black tabular-nums" style={{ color: barColor, lineHeight: 1 }}>{score}</p>
                    <p className="text-[10px] mt-1 font-medium" style={{ color: 'var(--t4)' }}>tu puntaje</p>
                  </div>
                )}
                {score !== null && cutoff !== null && <div className="text-xl font-bold" style={{ color: 'var(--t4)' }}>/</div>}
                {cutoff !== null && (
                  <div className="text-center">
                    <p className="text-3xl sm:text-4xl font-black tabular-nums" style={{ color: 'var(--t4)', lineHeight: 1 }}>{cutoff}</p>
                    <p className="text-[10px] mt-1 font-medium" style={{ color: 'var(--t4)' }}>objetivo</p>
                  </div>
                )}
              </div>
            </div>
            {lastSim && (
              <p className="relative text-[11px] mt-3 pt-3" style={{ borderTop: '1px solid var(--divider)', color: 'var(--t4)' }}>
                <Zap size={10} className="inline mr-1 -mt-0.5" style={{ color: barColor }}/>
                {lastSim.folio ? `${lastSim.folio} · ` : ''}Simulacro del{' '}
                {new Date(lastSim.fecha + 'T12:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}
                {' · '}{lastSim.aciertos}/{lastSim.total} aciertos
              </p>
            )}
          </div>
        )
      })()}

      {/* ══ Evolución + Asistencia ══ */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Gráfica de líneas por materia (conectada a evaluaciones) */}
        <div className="card p-4 sm:p-5 xl:col-span-2">
          <CabeceraSeccion className="mb-3" titulo="Evolución de mis calificaciones"
            subtitulo="Toca una materia para mostrarla u ocultarla en la gráfica."
            acciones={<VerMas t={t} onClick={() => navigate('/student/calificaciones')}/>}
            ayuda={<>
              <p>Cada línea es una materia: muestra tu promedio de cada mes en escala de 10.</p>
              <p>Los botones de colores encienden o apagan cada materia. Apagadas se ven tachadas: úsalo para comparar solo las que te interesan.</p>
              <p>Si una línea baja, esa materia necesita más repaso.</p>
            </>}/>

          {/* Interruptores por materia. Encendido: color pleno de la materia
              con texto blanco; apagado: contorno y tachado. */}
          <div className="flex flex-wrap gap-2 mb-4">
            {evo.materias.map(m => {
              const hidden = hiddenMaterias.includes(m)
              const color = colorMateria(m, t.light)
              return (
                <button key={m} type="button" onClick={() => toggleMateria(m)} aria-pressed={!hidden}
                  className={`min-h-11 flex items-center gap-1.5 text-[11px] font-semibold px-3 rounded-xl transition-all active:scale-95 ${hidden ? '' : 'text-white'}`}
                  style={{
                    background: hidden ? 'transparent' : color,
                    border: `1px solid ${hidden ? 'var(--card-border)' : color}`,
                    color: hidden ? 'var(--t3)' : undefined,
                    textDecoration: hidden ? 'line-through' : 'none',
                  }}>
                  {!hidden && <Check size={12} aria-hidden="true"/>}
                  {m}
                </button>
              )
            })}
          </div>

          {evo.data.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={evo.data} margin={{ top: 5, right: 8, bottom: 0, left: -22 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={t.grid}/>
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: t.axis }} axisLine={false} tickLine={false}/>
                <YAxis domain={[4, 10]} tick={{ fontSize: 11, fill: t.axis }} axisLine={false} tickLine={false}/>
                <Tooltip wrapperStyle={{ outline: 'none' }}
                  cursor={{ stroke: t.grid, strokeWidth: 1 }}
                  contentStyle={{ fontSize: 11, borderRadius: 10, background: t.tooltipBg, border: `1px solid ${t.tooltipBorder}`, color: t.tooltipText }}/>
                {evo.materias.filter(m => !hiddenMaterias.includes(m)).map(m => {
                  const color = colorMateria(m, t.light)
                  return (
                    <Line key={m} type="monotone" dataKey={m} name={m}
                      stroke={color} strokeWidth={2.5}
                      dot={{ r: 3, fill: color, strokeWidth: 0 }}
                      activeDot={{ r: 5 }}
                      connectNulls />
                  )
                })}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-sm" style={{ color: 'var(--t3)' }}>
              Todavía no hay calificaciones registradas.
            </div>
          )}
        </div>

        {/* Asistencia pie */}
        <div className="card p-4 sm:p-5">
          <CabeceraSeccion className="mb-3" titulo="Mi asistencia"
            acciones={<VerMas t={t} onClick={() => navigate('/student/asistencias')}/>}
            ayuda={<>
              <p>El círculo reparte tus clases en <b style={{ color: 'var(--good)' }}>presentes</b>, <b style={{ color: 'var(--warn)' }}>retardos</b> y <b style={{ color: 'var(--bad)' }}>faltas</b>.</p>
              <p>El porcentaje del centro es tu asistencia: <b>cada 3 retardos cuentan como 1 falta</b>.</p>
              <p>Para conservar la garantía del curso necesitas al menos <b>90 %</b>.</p>
            </>}/>
          <div className="flex items-center justify-center">
            <div className="relative">
              {hasAttendance ? (
                <ResponsiveContainer width={150} height={150}>
                  <PieChart>
                    <Pie data={attPie} cx="50%" cy="50%" innerRadius={45} outerRadius={68} dataKey="value" stroke="none">
                      {attPie.map(d => <Cell key={d.key} fill={ESTADO_COLOR[d.key]}/>)}
                    </Pie>
                    <Tooltip wrapperStyle={{ outline: 'none' }}
                      contentStyle={{ fontSize: 11, borderRadius: 10, background: t.tooltipBg, border: `1px solid ${t.tooltipBorder}`, color: t.tooltipText }}/>
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="w-[150px] h-[150px] flex items-center justify-center">
                  <div className="w-[136px] h-[136px] rounded-full"
                    style={{ border: '12px solid var(--soft-bg)' }}/>
                </div>
              )}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-bold tabular-nums" style={{ color: hasAttendance ? colorAsistencia(asis.pct) : 'var(--t4)' }}>
                  {hasAttendance ? `${asis.pct}%` : '—'}
                </span>
                <span className="text-[10px]" style={{ color: 'var(--t3)' }}>{hasAttendance ? 'asistencia' : 'sin registros'}</span>
              </div>
            </div>
          </div>
          <div className="space-y-1.5 mt-2">
            {attPieAll.map(d => (
              <div key={d.key} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ background: ESTADO_COLOR[d.key] }}/>
                  <span style={{ color: 'var(--t2)' }}>{d.name}</span>
                </div>
                <span className="font-bold tabular-nums" style={{ color: 'var(--t1)' }}>{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ══ Últimas evaluaciones / exámenes / tareas ══
          Cada fila lleva a esa materia en Mis calificaciones: si dice "Tarea ·
          Matemáticas", tocarla abre Matemáticas con todas sus calificaciones. */}
      <section className="card p-4 sm:p-5 space-y-3">
        <CabeceraSeccion titulo="Lo más reciente"
          subtitulo="Toca una fila para ver el detalle."
          acciones={<VerMas t={t} onClick={() => navigate('/student/calificaciones')}/>}
          ayuda={<>
            <p>Tus últimas 5 calificaciones registradas, de la más nueva a la más antigua.</p>
            <p>Usa los botones <b>Todas · Exámenes · Tareas</b> para filtrar.</p>
            <p>Toca cualquier fila para abrir esa materia en Mis calificaciones y ver su historial completo.</p>
          </>}/>
        <div role="tablist" aria-label="Filtrar" className="flex gap-1.5 p-1 rounded-xl w-full sm:w-auto sm:inline-flex"
          style={{ background: 'var(--soft-bg)', border: '1px solid var(--card-border)' }}>
          {ultimasOptions.map(o => {
            const activo = ultimasFilter === o.value
            return (
              <button key={o.value} type="button" role="tab" aria-selected={activo} onClick={() => setUltimasFilter(o.value)}
                className="flex-1 sm:flex-none min-h-10 px-3.5 rounded-lg text-xs font-bold"
                style={activo ? { background: 'var(--accent)', color: 'var(--accent-contrast)' } : { color: 'var(--t2)' }}>
                {o.corto}
              </button>
            )
          })}
        </div>
        {ultimas.length === 0 ? (
          <p className="text-sm py-6 text-center" style={{ color: 'var(--t3)' }}>Sin registros de este tipo todavía.</p>
        ) : (
          <ul className="space-y-1.5">
            {ultimas.map(e => {
              const color = colorMateria(e.materia, t.light)
              const Icono = iconoMateria(e.materia)
              const cal = +calificacionBase10(e).toFixed(1)
              return (
                <li key={e.id}>
                  <button type="button" onClick={() => setDetalle(e)}
                    className="w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition-colors group hover:bg-[var(--soft-bg)]"
                    style={{ border: '1px solid var(--divider)' }}
                    title={`Ver ${e.materia}`}>
                    <span className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: color, color: tintaSobre(color) }}>
                      <Icono size={19}/>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 min-w-0">
                        <EtiquetaCategoria tipo={e.tipo}/>
                        <span className="text-sm font-semibold truncate" style={{ color: 'var(--t1)' }}>{nombresColumnas[e.columnaId] || e.tipo}</span>
                      </span>
                      <span className="block text-[11px] truncate" style={{ color: 'var(--t3)' }}>
                        {e.materia} · {new Date(e.fecha + 'T12:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }).replace('.', '')}
                      </span>
                    </span>
                    <span className="inline-flex items-center justify-center min-w-[2.75rem] px-2 py-1 rounded-lg font-bold text-sm tabular-nums"
                      style={{ background: 'var(--soft-bg)', color: colorCalificacion(cal) }}
                      title="Calificación en escala de 10">{cal}</span>
                    <ChevronRight size={16} className="flex-shrink-0 transition-transform group-hover:translate-x-0.5" style={{ color: 'var(--t3)' }}/>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {detalle && (
        <DetalleEvaluacion evaluacion={detalle} light={t.light} onClose={() => setDetalle(null)}
          accion={{ label: `Ver todas mis calificaciones de ${detalle.materia}`, icon: ArrowRight,
            onClick: () => navigate('/student/calificaciones', { state: { materia: detalle.materia } }) }}/>
      )}
    </div>
  )
}
