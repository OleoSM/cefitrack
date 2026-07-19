import { useMemo, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, LineChart, Line,
} from 'recharts'
import { ChevronDown, Layers } from 'lucide-react'
import { useStudentData } from '../../hooks/useStudentData'
import { getStudentEvals } from '../../lib/studentMetrics'
import { useStudentTheme } from '../../context/StudentThemeContext'
import Dropdown from '../../components/ui/Dropdown'

/* Color personalizado por materia (línea de acento de cada card) */
const MATERIA_COLORS = ['#60a5fa', '#34d399', '#f59e0b', '#a78bfa', '#f472b6', '#22d3ee', '#fb7185', '#facc15']

export default function MyGrades() {
  const { t } = useStudentTheme()
  const { student: s } = useStudentData()

  const [scope, setScope] = useState('general')      // 'general' | nombre de materia
  const [openMats, setOpenMats] = useState([])       // acordeones abiertos

  const evals = useMemo(() => s ? getStudentEvals(s.id) : [], [s])

  const byMateria = useMemo(() => evals.reduce((acc, e) => {
    if (!acc[e.materia]) acc[e.materia] = []
    acc[e.materia].push(e)
    return acc
  }, {}), [evals])

  if (!s) return <div style={{ color: t.t3 }}>Perfil no disponible.</div>

  const materias = Object.keys(byMateria)
  const colorOf = mat => MATERIA_COLORS[materias.indexOf(mat) % MATERIA_COLORS.length]

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

  const toggleMat = mat =>
    setOpenMats(prev => prev.includes(mat) ? prev.filter(m => m !== mat) : [...prev, mat])

  const gradeColor = g => g >= 8 ? '#34d399' : g >= 6 ? '#60a5fa' : '#f87171'
  const visibleMaterias = scope === 'general' ? materias : [scope]

  const scopeOptions = [
    { value: 'general', label: 'General', icon: <Layers size={12}/> },
    ...materias.map(m => ({
      value: m, label: m,
      icon: <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: colorOf(m) }}/>,
    })),
  ]

  return (
    <div className="max-w-4xl space-y-5">
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
        <div className="stat-card text-center">
          <p className="text-3xl sm:text-4xl font-bold tabular-nums" style={{ color: gradeColor(scopeProm) }}>{scopeProm}</p>
          <p className="text-sm mt-1" style={{ color: t.t3 }}>
            {scope === 'general' ? 'Promedio General' : `Promedio ${scope}`}
          </p>
        </div>
        <div className="stat-card text-center">
          <p className="text-3xl sm:text-4xl font-bold tabular-nums" style={{ color: '#60a5fa' }}>
            {scopeEvals.length}<span className="text-lg font-semibold" style={{ color: t.t4 }}> / {evals.length}</span>
          </p>
          <p className="text-sm mt-1" style={{ color: t.t3 }}>Evaluaciones</p>
        </div>
        <div className="stat-card text-center">
          <p className="text-3xl sm:text-4xl font-bold tabular-nums" style={{ color: '#fbbf24' }}>{scopeBajo6}</p>
          <p className="text-sm mt-1" style={{ color: t.t3 }}>Por debajo de 6</p>
        </div>
      </div>

      {/* ── Materias (acordeones, primero) ─────────────────────── */}
      <div className="space-y-3">
        {visibleMaterias.map(mat => {
          const evs = byMateria[mat]
          const prom = +(evs.reduce((sum, e) => sum + e.calificacion, 0) / evs.length).toFixed(1)
          const accent = colorOf(mat)
          const open = scope !== 'general' || openMats.includes(mat)
          return (
            <div key={mat} className="card overflow-hidden" style={{ borderLeft: `3px solid ${accent}` }}>
              {/* Header clickeable (dropdown) */}
              <button onClick={() => scope === 'general' && toggleMat(mat)}
                className="w-full px-4 sm:px-5 py-3.5 flex items-center justify-between gap-3 text-left transition-colors"
                style={{ background: open ? t.softBg : 'transparent', cursor: scope === 'general' ? 'pointer' : 'default' }}>
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: accent }}/>
                  <h3 className="font-bold text-sm sm:text-base truncate" style={{ color: t.t1 }}>{mat}</h3>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                    style={{ background: `${accent}18`, color: t.light ? t.t2 : accent, border: `1px solid ${accent}40` }}>
                    {evs.length} / {evals.length}
                  </span>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-base sm:text-lg font-bold tabular-nums" style={{ color: gradeColor(prom) }}>{prom}</span>
                  {scope === 'general' && (
                    <ChevronDown size={16} className="transition-transform duration-200"
                      style={{ color: t.t3, transform: open ? 'rotate(180deg)' : 'none' }}/>
                  )}
                </div>
              </button>

              {/* Tabla desplegable */}
              {open && (
                <div className="overflow-x-auto animate-fade-in" style={{ borderTop: `1px solid ${t.divider}` }}>
                  <table className="w-full min-w-[360px]">
                    <thead style={{ borderBottom: `1px solid ${t.divider}`, background: t.softBg }}>
                      <tr>
                        <th className="table-header">Tipo</th>
                        <th className="table-header">Calificación</th>
                        <th className="table-header hidden sm:table-cell">Periodo</th>
                        <th className="table-header">Fecha</th>
                      </tr>
                    </thead>
                    <tbody>
                      {evs.map(e => (
                        <tr key={e.id} className="transition-colors" style={{ borderBottom: `1px solid ${t.divider}` }}>
                          <td className="table-cell">
                            <span className="badge text-[11px]" style={{ background: t.softBg, color: t.t2, border: `1px solid ${t.cardBorder}` }}>{e.tipo}</span>
                          </td>
                          <td className="table-cell">
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
                          <td className="table-cell text-xs" style={{ color: t.t3 }}>{e.fecha}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Gráfica (después de la tabla de materias) ──────────── */}
      <div className="card p-4 sm:p-5">
        <h2 className="section-title mb-4">
          {scope === 'general' ? 'Promedio por Materia' : `Evolución — ${scope}`}
        </h2>
        {scope === 'general' ? (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={materiaStats} margin={{ top: 5, right: 10, bottom: 24, left: -10 }} barSize={30}>
              <CartesianGrid strokeDasharray="3 3" stroke={t.grid} vertical={false}/>
              <XAxis dataKey="materia" tick={{ fontSize: 10, fill: t.axis }} angle={-15} textAnchor="end" axisLine={false} tickLine={false}/>
              <YAxis domain={[0, 10]} tick={{ fontSize: 11, fill: t.axis }} axisLine={false} tickLine={false}/>
              <Tooltip wrapperStyle={{ outline: 'none' }} cursor={{ fill: t.softBg }}
                contentStyle={{ fontSize: 11, borderRadius: 10, background: t.tooltipBg, border: `1px solid ${t.tooltipBorder}`, color: t.tooltipText }}
                formatter={v => [v, 'Promedio']}/>
              <Bar dataKey="promedio" radius={[6, 6, 0, 0]}>
                {materiaStats.map((m, i) => <Cell key={i} fill={colorOf(m.materia)}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
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
