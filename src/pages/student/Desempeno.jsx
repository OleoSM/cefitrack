import { useEffect, useState } from 'react'
import { Sparkles, BookOpen, TrendingUp, ThumbsUp, Lightbulb } from 'lucide-react'
import { fetchMiDesempeno } from '../../lib/permisosAlumno'
import { NIVELES } from '../../lib/reportesIA'
import { SkeletonBlock } from '../../components/ui/DataTable'
import { BotonAyuda } from '../../components/ui/Ayuda'

/*
 * Mi desempeño: el último reporte con IA que generó tu profesor, sin las
 * notas internas (alertas, recomendaciones para el docente ni métricas
 * crudas: eso lo filtra el servidor en mi_desempeno()).
 */
const colorNivel = n => n >= 4 ? 'var(--good)' : n === 3 ? 'var(--info)' : n === 2 ? 'var(--warn)' : 'var(--bad)'

function Nivel({ valor }) {
  return (
    <span className="flex gap-1 flex-shrink-0" role="img" aria-label={`Nivel ${valor} de 5`}>
      {[1, 2, 3, 4, 5].map(i => <span key={i} className="w-4 h-1.5 rounded-full" style={{ background: i <= valor ? colorNivel(valor) : 'var(--divider)' }}/>)}
    </span>
  )
}

function Lista({ titulo, Icono, items, color = 'var(--accent)' }) {
  return (
    <section className="card p-4 sm:p-5 min-w-0">
      <h3 className="flex items-center gap-2 text-sm font-bold mb-3" style={{ color: 'var(--t1)' }}><Icono size={15} style={{ color }}/> {titulo}</h3>
      <ul className="space-y-3">
        {(items ?? []).map((c, i) => (
          <li key={i}>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold" style={{ color: 'var(--t1)' }}>{c.nombre}</span>
              <Nivel valor={c.nivel}/>
            </div>
            <p className="text-xs mt-0.5" style={{ color: 'var(--t3)' }}>{c.evidencia}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Vinetas({ titulo, Icono, items, color }) {
  return (
    <section className="card p-4 sm:p-5 min-w-0">
      <h3 className="flex items-center gap-2 text-sm font-bold mb-3" style={{ color: 'var(--t1)' }}><Icono size={15} style={{ color }}/> {titulo}</h3>
      {items?.length ? (
        <ul className="space-y-2">
          {items.map((t, i) => (
            <li key={i} className="flex gap-2 text-sm" style={{ color: 'var(--t1)' }}>
              <span className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0" style={{ background: color }}/>{t}
            </li>
          ))}
        </ul>
      ) : <p className="text-xs" style={{ color: 'var(--t3)' }}>Nada que destacar por ahora.</p>}
    </section>
  )
}

export default function Desempeno() {
  const [r, setR] = useState(undefined)   // undefined = cargando, null = sin reporte
  const [error, setError] = useState('')

  useEffect(() => { fetchMiDesempeno().then(setR).catch(() => { setR(null); setError('No se pudo cargar tu desempeño.') }) }, [])
  const nivel = NIVELES[r?.nivel_general]

  return (
    <div className="w-full space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="page-title">Mi desempeño</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--t3)' }}>Tus competencias, hábitos y recomendaciones según tus calificaciones y asistencia.</p>
        </div>
        <BotonAyuda titulo="Mi desempeño">
          <p>Es un análisis que genera tu profesor con ayuda de inteligencia artificial a partir de tus calificaciones y tu asistencia en SIGA.</p>
          <p>Úsalo como guía para saber en qué vas bien y qué conviene reforzar. Si tienes dudas, revísalo con tu profesor en turno.</p>
        </BotonAyuda>
      </div>

      {error && <p role="alert" className="text-sm" style={{ color: 'var(--bad)' }}>{error}</p>}

      {r === undefined ? (
        <div className="space-y-3">{[0, 1, 2].map(i => <SkeletonBlock key={i} className="h-28"/>)}</div>
      ) : r === null ? (
        <div className="card p-8 text-center space-y-2">
          <Sparkles size={30} className="mx-auto" style={{ color: 'var(--accent)' }}/>
          <p className="text-sm font-semibold" style={{ color: 'var(--t1)' }}>Aún no hay un reporte de desempeño</p>
          <p className="text-xs" style={{ color: 'var(--t3)' }}>Cuando tu profesor lo genere, aparecerá aquí.</p>
        </div>
      ) : (
        <>
          <div className="card p-4 sm:p-5 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {nivel && <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: nivel.fondo, color: nivel.color }}>{nivel.label}</span>}
              <span className="text-[11px]" style={{ color: 'var(--t3)' }}>Actualizado el {new Date(r.fecha).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--t1)' }}>{r.resumen}</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl px-3 py-2.5" style={{ background: 'var(--soft-bg)' }}>
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--t3)' }}>Promedio</p>
                <p className="text-lg font-bold" style={{ color: 'var(--t1)' }}>{r.promedio ?? '—'}</p>
              </div>
              <div className="rounded-xl px-3 py-2.5" style={{ background: 'var(--soft-bg)' }}>
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--t3)' }}>Asistencia</p>
                <p className="text-lg font-bold" style={{ color: 'var(--t1)' }}>{r.asistencia != null ? `${r.asistencia}%` : '—'}</p>
              </div>
            </div>
          </div>
          <div className="grid lg:grid-cols-2 gap-4">
            <Lista titulo="Competencias académicas" Icono={BookOpen} items={r.competencias}/>
            <Lista titulo="Hábitos de estudio" Icono={TrendingUp} items={r.habilidades}/>
          </div>
          <div className="grid lg:grid-cols-2 gap-4">
            <Vinetas titulo="Tus fortalezas" Icono={ThumbsUp} items={r.fortalezas} color="var(--good)"/>
            <Vinetas titulo="Qué puedes mejorar" Icono={TrendingUp} items={r.areas_mejora} color="var(--warn)"/>
          </div>
          <Vinetas titulo="Recomendaciones" Icono={Lightbulb} items={(r.recomendaciones ?? []).map(x => x.texto)} color="var(--accent)"/>
          <p className="text-[11px] text-center" style={{ color: 'var(--t3)' }}>Generado con IA a partir de tus datos en SIGA. Dudas o comentarios: revísalo con tu profesor en turno.</p>
        </>
      )}
    </div>
  )
}
