import { useCallback, useEffect, useState } from 'react'
import { Sparkles, RefreshCw, AlertTriangle, ThumbsUp, TrendingUp, Lightbulb, Users, Award, BookOpen, History, Download } from 'lucide-react'
import { generarReporte, fetchReportes, NIVELES } from '../../lib/reportesIA'
import { SkeletonBlock } from '../ui/DataTable'

/*
 * Reporte con IA de un alumno (`tipo="alumno"`) o de un grupo (`tipo="grupo"`).
 * Muestra el último guardado y deja volver a los anteriores; "Generar" pide
 * uno nuevo (≈ 1 centavo de dólar). Uso interno: solo admins y sub-admins
 * con el apartado "ia" llegan a verlo.
 */
const fecha = f => new Date(f).toLocaleString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
const colorNivel = n => n >= 4 ? 'var(--good)' : n === 3 ? 'var(--info)' : n === 2 ? 'var(--warn)' : 'var(--bad)'
const PARA = { docente: 'Docente', alumno: 'Alumno', tutor: 'Tutor' }

function Titulo({ icono: Icono, children, color = 'var(--accent)' }) {
  return (
    <h3 className="flex items-center gap-2 text-sm font-bold mb-3" style={{ color: 'var(--t1)' }}>
      <Icono size={15} style={{ color }}/> {children}
    </h3>
  )
}

function Nivel({ valor }) {
  return (
    <span className="flex gap-1 flex-shrink-0" role="img" aria-label={`Nivel ${valor} de 5`}>
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} className="w-4 h-1.5 rounded-full" style={{ background: i <= valor ? colorNivel(valor) : 'var(--divider)' }}/>
      ))}
    </span>
  )
}

function ListaNiveles({ items }) {
  return (
    <ul className="space-y-3">
      {(items ?? []).map((c, i) => (
        <li key={i} className="min-w-0">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold min-w-0" style={{ color: 'var(--t1)' }}>{c.nombre}</span>
            <Nivel valor={c.nivel}/>
          </div>
          <p className="text-xs mt-0.5" style={{ color: 'var(--t3)' }}>{c.evidencia}</p>
        </li>
      ))}
    </ul>
  )
}

function Viñetas({ items, color }) {
  if (!items?.length) return <p className="text-xs" style={{ color: 'var(--t3)' }}>Nada que destacar.</p>
  return (
    <ul className="space-y-2">
      {items.map((t, i) => (
        <li key={i} className="flex gap-2 text-sm" style={{ color: 'var(--t1)' }}>
          <span className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0" style={{ background: color }}/>
          <span className="min-w-0">{t}</span>
        </li>
      ))}
    </ul>
  )
}

function Dato({ label, valor, sub }) {
  return (
    <div className="rounded-xl px-3 py-2.5 min-w-0" style={{ background: 'var(--soft-bg)' }}>
      <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--t3)' }}>{label}</p>
      <p className="text-lg font-bold tabular-nums" style={{ color: 'var(--t1)' }}>{valor ?? '—'}</p>
      {sub && <p className="text-[11px] truncate" style={{ color: 'var(--t3)' }}>{sub}</p>}
    </div>
  )
}

export default function ReporteIA({ tipo, id, nombre }) {
  const [reportes, setReportes] = useState(null)   // null = cargando
  const [indice, setIndice] = useState(0)
  const [generando, setGenerando] = useState(false)
  const [error, setError] = useState('')
  const [pdf, setPdf] = useState(false)

  const cargar = useCallback(() => {
    fetchReportes(tipo, id).then(r => { setReportes(r); setIndice(0) }).catch(() => setReportes([]))
  }, [tipo, id])
  useEffect(() => { cargar() }, [cargar])

  const generar = async () => {
    setGenerando(true); setError('')
    const r = await generarReporte(tipo, id)
    if (r?.ok) { setReportes(v => [r.reporte, ...(v ?? [])]); setIndice(0) }
    else setError(r?.message ?? 'No se pudo generar el reporte.')
    setGenerando(false)
  }

  // jsPDF se carga solo al pedir el PDF: no pesa en la carga de la pantalla.
  const descargarPdf = async () => {
    setPdf(true)
    try {
      const { descargarReporteIAPdf } = await import('../../lib/reporteIAPdf')
      await descargarReporteIAPdf({ reporte: rep, tipo, nombre })
    } catch { setError('No se pudo crear el PDF.') }
    setPdf(false)
  }

  const rep = reportes?.[indice]
  const c = rep?.contenido ?? {}
  const m = rep?.metricas ?? {}
  const nivel = NIVELES[c.nivel_general]

  return (
    <div className="space-y-4 min-w-0">
      {/* Encabezado */}
      <div className="card p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3">
        <span className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'var(--accent)', color: 'var(--accent-contrast)' }}>
          <Sparkles size={18}/>
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold" style={{ color: 'var(--t1)' }}>Reporte con IA{nombre ? ` · ${nombre}` : ''}</h2>
          <p className="text-xs" style={{ color: 'var(--t3)' }}>
            Competencias, habilidades y recomendaciones a partir de sus calificaciones y asistencia. Uso interno: {tipo === 'alumno' ? 'el alumno no lo ve' : 'los alumnos no lo ven'}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {reportes?.length > 1 && (
            <label className="flex items-center gap-1.5">
              <History size={14} style={{ color: 'var(--t3)' }}/>
              <select className="input-field min-h-10 w-auto text-xs" value={indice} onChange={e => setIndice(Number(e.target.value))}
                aria-label="Reportes anteriores" disabled={generando}>
                {reportes.map((r, i) => <option key={r.id} value={i}>{i === 0 ? 'Último · ' : ''}{fecha(r.created_at)}</option>)}
              </select>
            </label>
          )}
          {rep && !generando && (
            <button type="button" className="btn-secondary min-h-10" onClick={descargarPdf} disabled={pdf}>
              <Download size={14}/> {pdf ? 'Creando PDF…' : 'Descargar PDF'}
            </button>
          )}
          <button type="button" className="btn-primary min-h-10" onClick={generar} disabled={generando || reportes === null}>
            {generando ? <RefreshCw size={14} className="animate-spin"/> : <Sparkles size={14}/>}
            {generando ? 'Analizando…' : reportes?.length ? 'Generar uno nuevo' : 'Generar reporte'}
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="flex gap-2 rounded-xl p-3 text-sm"
          style={{ background: 'var(--bad-soft)', border: '1px solid var(--bad-line)', color: 'var(--bad)' }}>
          <AlertTriangle size={16} className="flex-shrink-0"/> {error}
        </div>
      )}

      {(reportes === null || generando) && (
        <div className="card p-5 space-y-3" aria-busy="true">
          {generando && <p className="text-sm" style={{ color: 'var(--t2)' }}>Analizando calificaciones y asistencia… tarda unos 10 segundos.</p>}
          <SkeletonBlock className="h-5 w-1/3"/><SkeletonBlock className="h-16 w-full"/><SkeletonBlock className="h-32 w-full"/>
        </div>
      )}

      {reportes?.length === 0 && !generando && (
        <div className="card p-8 text-center space-y-2">
          <Sparkles size={26} className="mx-auto" style={{ color: 'var(--accent)' }}/>
          <p className="text-sm font-semibold" style={{ color: 'var(--t1)' }}>Aún no hay reportes</p>
          <p className="text-xs max-w-md mx-auto" style={{ color: 'var(--t3)' }}>
            Pulsa "Generar reporte": la IA revisa {tipo === 'alumno' ? 'sus calificaciones por materia, asistencia y entregas comparadas con su grupo' : 'el desempeño del grupo por materia y por alumno'} y
            redacta competencias, fortalezas y recomendaciones. Cuesta alrededor de un centavo de dólar y queda guardado.
          </p>
        </div>
      )}

      {rep && !generando && (
        <>
          {/* Resumen y datos clave */}
          <div className="card p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              {nivel && (
                <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: nivel.fondo, color: nivel.color }}>
                  {nivel.label}
                </span>
              )}
              <span className="text-[11px]" style={{ color: 'var(--t3)' }}>
                {fecha(rep.created_at)} · {rep.modelo} · US${Number(rep.costo_usd).toFixed(3)}
              </span>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--t1)' }}>{c.resumen}</p>
            {tipo === 'alumno' ? (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                <Dato label="Promedio" valor={m.resumen?.promedio} sub={m.resumen?.promedio_grupo != null ? `Grupo: ${m.resumen.promedio_grupo}` : null}/>
                <Dato label="Posición" valor={m.resumen?.posicion} sub={m.alumno?.grupo}/>
                <Dato label="Asistencia" valor={m.resumen?.asistencia?.porcentaje != null ? `${m.resumen.asistencia.porcentaje}%` : null}
                  sub={m.resumen?.asistencia ? `${m.resumen.asistencia.faltas} falta(s) · ${m.resumen.asistencia.tardanzas} retardo(s)` : null}/>
                <Dato label="Garantía" valor={m.alumno?.garantia ? m.alumno.garantia.charAt(0).toUpperCase() + m.alumno.garantia.slice(1) : null} sub={m.alumno?.area}/>
              </div>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                <Dato label="Promedio" valor={m.resumen?.promedio}/>
                <Dato label="Asistencia" valor={m.resumen?.asistencia != null ? `${m.resumen.asistencia}%` : null}/>
                <Dato label="Alumnos" valor={m.grupo?.alumnos}/>
                <Dato label="En riesgo" valor={m.resumen?.en_riesgo}/>
              </div>
            )}
          </div>

          {c.alertas?.length > 0 && (
            <div role="alert" className="rounded-xl p-4 space-y-1.5" style={{ background: 'var(--warn-soft)', border: '1px solid var(--warn-line)' }}>
              <p className="flex items-center gap-2 text-sm font-bold" style={{ color: 'var(--warn)' }}><AlertTriangle size={15}/> Alertas</p>
              {c.alertas.map((a, i) => <p key={i} className="text-sm" style={{ color: 'var(--t1)' }}>{a}</p>)}
            </div>
          )}

          <div className="grid lg:grid-cols-2 gap-4">
            <section className="card p-4 sm:p-5 min-w-0">
              <Titulo icono={BookOpen}>Competencias académicas</Titulo>
              <ListaNiveles items={c.competencias}/>
            </section>
            {tipo === 'alumno' ? (
              <section className="card p-4 sm:p-5 min-w-0">
                <Titulo icono={TrendingUp}>Habilidades y hábitos</Titulo>
                <ListaNiveles items={c.habilidades}/>
              </section>
            ) : (
              <section className="card p-4 sm:p-5 min-w-0">
                <Titulo icono={AlertTriangle} color="var(--warn)">Materias que requieren atención</Titulo>
                <Viñetas color="var(--warn)" items={(c.materias_criticas ?? []).map(x => `${x.materia}: ${x.motivo}`)}/>
              </section>
            )}
          </div>

          {tipo === 'alumno' ? (
            <div className="grid lg:grid-cols-2 gap-4">
              <section className="card p-4 sm:p-5 min-w-0">
                <Titulo icono={ThumbsUp} color="var(--good)">Fortalezas</Titulo>
                <Viñetas items={c.fortalezas} color="var(--good)"/>
              </section>
              <section className="card p-4 sm:p-5 min-w-0">
                <Titulo icono={TrendingUp} color="var(--warn)">Áreas de mejora</Titulo>
                <Viñetas items={c.areas_mejora} color="var(--warn)"/>
              </section>
            </div>
          ) : (
            <div className="grid lg:grid-cols-2 gap-4">
              <section className="card p-4 sm:p-5 min-w-0">
                <Titulo icono={Users} color="var(--bad)">Alumnos en riesgo</Titulo>
                <Viñetas color="var(--bad)" items={(c.alumnos_riesgo ?? []).map(x => `${x.nombre}: ${x.motivo}`)}/>
              </section>
              <section className="card p-4 sm:p-5 min-w-0">
                <Titulo icono={Award} color="var(--good)">Destacados</Titulo>
                <Viñetas color="var(--good)" items={(c.destacados ?? []).map(x => `${x.nombre}: ${x.motivo}`)}/>
              </section>
            </div>
          )}

          <section className="card p-4 sm:p-5">
            <Titulo icono={Lightbulb}>Recomendaciones</Titulo>
            <ul className="space-y-2.5">
              {(c.recomendaciones ?? []).map((r, i) => {
                const obj = typeof r === 'string' ? { texto: r } : r
                return (
                  <li key={i} className="flex flex-col sm:flex-row sm:items-start gap-1.5 sm:gap-3">
                    {obj.para && (
                      <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-md self-start flex-shrink-0 sm:w-20 text-center"
                        style={{ background: 'var(--soft-bg)', color: 'var(--t2)' }}>{PARA[obj.para] ?? obj.para}</span>
                    )}
                    <span className="text-sm min-w-0" style={{ color: 'var(--t1)' }}>{obj.texto}</span>
                  </li>
                )
              })}
            </ul>
          </section>
          <p className="text-[11px] text-center" style={{ color: 'var(--t3)' }}>
            Generado por IA a partir de los datos de SIGA. Revísalo antes de usarlo en una decisión.
          </p>
        </>
      )}
    </div>
  )
}
