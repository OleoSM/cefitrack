import { useMemo, useState } from 'react'
import {
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line,
} from 'recharts'
import {
  Layers, Sigma, Atom, FlaskConical, Dna, Landmark, Globe2,
  BookOpen, Languages, Cpu, BookMarked, ArrowLeft, ChevronRight,
  GraduationCap, ClipboardList, AlertTriangle,
} from 'lucide-react'
import MateriaBarChart from '../../components/ui/MateriaBarChart'
import { useStudentData } from '../../hooks/useStudentData'
import ProgressiveList from '../../components/ui/ProgressiveList'
import { calificacionBase10 } from '../../lib/studentMetrics'
import { useStudentTheme } from '../../context/StudentThemeContext'
import Dropdown from '../../components/ui/Dropdown'

/* Color personalizado por materia (línea de acento de cada card) */
const MATERIA_COLORS = ['#60a5fa', '#34d399', '#f59e0b', '#a78bfa', '#f472b6', '#22d3ee', '#fb7185', '#facc15']

/* Icono representativo según el nombre de la materia */
function materiaIcon(m) {
  const n = (m || '').toLowerCase()
  if (/(álgebra|algebra|matem|cálculo|calculo|geometr|trigono|aritm)/.test(n)) return Sigma
  if (/(fís|fisic)/.test(n)) return Atom
  if (/(quím|quimic)/.test(n)) return FlaskConical
  if (/biolog/.test(n)) return Dna
  if (/(histor|cívic|civic|étic|etic)/.test(n)) return Landmark
  if (/geograf/.test(n)) return Globe2
  if (/(español|espanol|lectur|redacc|literat)/.test(n)) return BookOpen
  if (/(inglés|ingles|idiom)/.test(n)) return Languages
  if (/(comput|inform|tecnolog)/.test(n)) return Cpu
  return BookMarked
}

export default function MyGrades() {
  const { t } = useStudentTheme()
  const { student: s, evaluations } = useStudentData({ withEvaluations: true })

  const [scope, setScope] = useState('general')      // 'general' | nombre de materia

  // Se normalizan a escala 10 para que convivan evaluaciones con distinto máximo.
  const evals = useMemo(
    () => evaluations.map(e => ({ ...e, calificacion: +calificacionBase10(e).toFixed(1) })),
    [evaluations],
  )

  const byMateria = useMemo(() => evals.reduce((acc, e) => {
    if (!acc[e.materia]) acc[e.materia] = []
    acc[e.materia].push(e)
    return acc
  }, {}), [evals])

  if (!s) return <div style={{ color: t.t3 }}>Perfil no disponible.</div>

  const materias = Object.keys(byMateria)
  // indexOf devuelve -1 para una materia desconocida, y MATERIA_COLORS[-1] es
  // undefined: de ahí venía el color inválido que tumbaba la gráfica.
  const colorOf = mat => {
    const i = materias.indexOf(mat)
    return MATERIA_COLORS[(i < 0 ? 0 : i) % MATERIA_COLORS.length]
  }

  /* ── Alcance: general o una materia ── */
  const scopeEvals = scope === 'general' ? evals : (byMateria[scope] ?? [])
  const scopeProm = scopeEvals.length
    ? +(scopeEvals.reduce((sum, e) => sum + e.calificacion, 0) / scopeEvals.length).toFixed(1)
    : 0
  const scopeBajo6 = scopeEvals.filter(e => e.calificacion < 6).length

  const materiaStats = materias.map(mat => {
    const evs = byMateria[mat]
    return {
      materia: mat,
      promedio: +(evs.reduce((sum, e) => sum + e.calificacion, 0) / evs.length).toFixed(1),
      count: evs.length,
    }
  })

  /* Serie temporal de la materia seleccionada */
  const materiaSerie = scope !== 'general'
    ? [...scopeEvals].sort((a, b) => a.fecha.localeCompare(b.fecha)).map(e => ({
        fecha: new Date(e.fecha + 'T12:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }).replace('.', ''),
        calificacion: e.calificacion, tipo: e.tipo,
      }))
    : []

  const gradeColor = g => g >= 8 ? '#34d399' : g >= 6 ? '#60a5fa' : '#f87171'

  const scopeOptions = [
    { value: 'general', label: 'Todas las materias', icon: <Layers size={12}/> },
    ...materias.map(m => {
      const Icon = materiaIcon(m)
      return { value: m, label: m, icon: <Icon size={12} style={{ color: colorOf(m) }}/> }
    }),
  ]

  return (
    <div className="space-y-5">
      {/* Header + selector General / materia */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="page-title">Mis Calificaciones</h1>
          <p className="text-sm mt-1" style={{ color: t.t3 }}>
            {scope === 'general' ? 'Historial completo de evaluaciones — solo lectura.' : `Desglose de ${scope}.`}
          </p>
        </div>
        <Dropdown value={scope} onChange={setScope} options={scopeOptions} align="right"/>
      </div>

      {/* KPI cards (en función del alcance elegido) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          {
            icon: GraduationCap,
            accent: gradeColor(scopeProm),
            value: <>{scopeProm}<span className="text-base font-semibold ml-0.5" style={{ color: t.t4 }}>/ 10</span></>,
            label: scope === 'general' ? 'Promedio General' : `Promedio · ${scope}`,
            bar: scopeProm / 10,
          },
          {
            icon: ClipboardList,
            accent: '#60a5fa',
            value: <>{scopeEvals.length}<span className="text-base font-semibold ml-0.5" style={{ color: t.t4 }}>/ {evals.length}</span></>,
            label: 'Evaluaciones registradas',
            bar: evals.length > 0 ? scopeEvals.length / evals.length : 0,
          },
          {
            icon: AlertTriangle,
            accent: scopeBajo6 > 0 ? '#fbbf24' : '#34d399',
            value: scopeBajo6,
            label: scopeBajo6 > 0 ? 'Por debajo de 6' : 'Ninguna reprobada',
            bar: scopeEvals.length > 0 ? scopeBajo6 / scopeEvals.length : 0,
          },
        ].map(({ icon: Icon, accent, value, label, bar }, i) => (
          <div key={i} className="stat-card relative overflow-hidden">
            {/* Franja de acento sólida. Antes era un halo radial que se
                desvanecía a transparente: sobre el blanco de IPN/UNAM no se
                percibe como color, sino como una mancha sucia. */}
            <div className="absolute inset-y-0 left-0 w-1 pointer-events-none"
              style={{ background: accent }}/>
            <div className="relative flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ background: accent }}>
                <Icon size={20} style={{ color: '#fff' }}/>
              </div>
              <div className="min-w-0">
                <p className="text-2xl sm:text-3xl font-bold tabular-nums leading-none" style={{ color: accent }}>{value}</p>
                <p className="text-xs mt-1.5 truncate" style={{ color: t.t3 }}>{label}</p>
              </div>
            </div>
            <div className="relative h-1 rounded-full overflow-hidden mt-3.5" style={{ background: t.softBg }}>
              <div className="h-full rounded-full transition-all duration-700"
                style={{ width: `${Math.round(bar * 100)}%`, background: `linear-gradient(90deg, ${accent}66, ${accent})` }}/>
            </div>
          </div>
        ))}
      </div>

      {/* ── Materias ───────────────────────────────────────────────
          General: grid compacto tipo KPI (una tarjetita por materia).
          Materia seleccionada: una sola card con su desglose completo. */}
      {scope === 'general' ? (
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
          {materias.map(mat => {
            const evs = byMateria[mat]
            const prom = +(evs.reduce((sum, e) => sum + e.calificacion, 0) / evs.length).toFixed(1)
            const accent = colorOf(mat)
            const Icon = materiaIcon(mat)
            return (
              <button key={mat} onClick={() => setScope(mat)}
                className="stat-card text-left transition-all active:scale-[.97] group"
                style={{ borderTop: `3px solid ${accent}` }}>
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: `${accent}1a`, border: `1px solid ${accent}40` }}>
                    <Icon size={15} style={{ color: accent }}/>
                  </div>
                  <ChevronRight size={14} className="opacity-0 group-hover:opacity-60 transition-opacity" style={{ color: t.t3 }}/>
                </div>
                <p className="text-2xl font-bold tabular-nums mt-2" style={{ color: gradeColor(prom) }}>{prom}</p>
                <p className="text-xs font-semibold mt-0.5 truncate" style={{ color: t.t1 }}>{mat}</p>
                <p className="text-[10px] mt-0.5" style={{ color: t.t4 }}>{evs.length} evaluacion{evs.length !== 1 ? 'es' : ''}</p>
              </button>
            )
          })}
        </div>
      ) : (
        (() => {
          const mat = scope
          const evs = byMateria[mat] ?? []
          const prom = evs.length ? +(evs.reduce((sum, e) => sum + e.calificacion, 0) / evs.length).toFixed(1) : 0
          const accent = colorOf(mat)
          const Icon = materiaIcon(mat)
          return (
            <div className="card overflow-hidden" style={{ borderLeft: `3px solid ${accent}` }}>
              <div className="px-4 sm:px-5 py-3.5 flex items-center justify-between gap-3" style={{ background: t.softBg }}>
                <div className="flex items-center gap-2.5 min-w-0">
                  <button onClick={() => setScope('general')} aria-label="Volver a todas las materias"
                    className="p-1.5 rounded-lg transition-colors flex-shrink-0" style={{ color: t.t3 }}
                    onMouseEnter={e => e.currentTarget.style.background = t.ddBg}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <ArrowLeft size={15}/>
                  </button>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: `${accent}1a`, border: `1px solid ${accent}40` }}>
                    <Icon size={15} style={{ color: accent }}/>
                  </div>
                  <h3 className="font-bold text-sm sm:text-base truncate" style={{ color: t.t1 }}>{mat}</h3>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 hidden sm:inline"
                    style={{ background: `${accent}18`, color: t.light ? t.t2 : accent, border: `1px solid ${accent}40` }}>
                    {evs.length} / {evals.length}
                  </span>
                </div>
                <span className="text-base sm:text-lg font-bold tabular-nums flex-shrink-0" style={{ color: gradeColor(prom) }}>{prom}</span>
              </div>

              <div className="overflow-x-auto" style={{ borderTop: `1px solid ${t.divider}` }}>
                <table className="w-full min-w-[360px]">
                  <thead style={{ borderBottom: `1px solid ${t.divider}`, background: t.softBg }}>
                    <tr>
                      <th className="table-header">Tipo</th>
                      <th className="table-header table-header--num">Calificación</th>
                      <th className="table-header hidden sm:table-cell">Periodo</th>
                      <th className="table-header table-header--num">Fecha</th>
                    </tr>
                  </thead>
                  <ProgressiveList as="tbody" colSpan={4} items={evs}
                    sizes={{ mobile: 5, tablet: 10, desktop: 15 }}
                    emptyLabel="Sin evaluaciones en esta materia.">
                    {e => (
                      <tr key={e.id} className="transition-colors" style={{ borderBottom: `1px solid ${t.divider}` }}>
                        <td className="table-cell">
                          <span className="badge text-[11px]" style={{ background: t.softBg, color: t.t2, border: `1px solid ${t.cardBorder}` }}>{e.tipo}</span>
                        </td>
                        <td className="table-cell table-cell--num">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-base sm:text-lg tabular-nums" style={{ color: gradeColor(e.calificacion) }}>{e.calificacion}</span>
                            {e.editedByAdmin && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold hidden sm:inline"
                                style={{ background: 'rgba(251,191,36,.15)', color: '#d97706' }}>
                                actualizado
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="table-cell hidden sm:table-cell" style={{ color: t.t2 }}>{e.periodo}</td>
                        <td className="table-cell table-cell--num text-xs" style={{ color: t.t3 }}>{e.fecha}</td>
                      </tr>
                    )}
                  </ProgressiveList>
                </table>
              </div>
            </div>
          )
        })()
      )}

      {/* ── Gráfica (después de la tabla de materias) ──────────── */}
      <div className="card p-4 sm:p-5">
        <h2 className="section-title mb-4">
          {scope === 'general' ? 'Promedio por Materia' : `Evolución — ${scope}`}
        </h2>
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
    </div>
  )
}
