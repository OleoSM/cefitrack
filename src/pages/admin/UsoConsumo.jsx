import { useCallback, useEffect, useState } from 'react'
import { Navigate, Link } from 'react-router-dom'
import { Sparkles, Mail, RefreshCw, MessageSquare, FileText, Send, AlertTriangle, ExternalLink, Save } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { useAuth } from '../../context/AuthContext'
import { fetchUsoConsumo, guardarTopes, serie30 } from '../../lib/usoData'
import KpiCard, { KpiGrid } from '../../components/ui/KpiCard'
import { DataTable, DataTableRow, SkeletonBlock } from '../../components/ui/DataTable'

/*
 * Uso y consumo — solo admin (super). Cuánto se ha gastado de la API de IA
 * (Anthropic) y cuántos correos se han mandado (Resend), con sus topes.
 */
const usd = (n, dec = 2) => `US$${Number(n ?? 0).toFixed(dec)}`
const miles = n => Number(n ?? 0).toLocaleString('es-MX')
const TOOLTIP = { fontSize: 11, borderRadius: 10, background: 'var(--tooltip-bg)', border: '1px solid var(--tooltip-border)', color: 'var(--tooltip-text)' }

function Barra({ valor, limite }) {
  const pct = Math.min(100, (Number(valor) / Math.max(Number(limite) || 1, 0.0001)) * 100)
  const color = pct >= 100 ? 'var(--bad)' : pct > 80 ? 'var(--warn)' : 'var(--good)'
  return (
    <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--soft-bg)' }} role="progressbar"
      aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }}/>
    </div>
  )
}

function Fila({ label, valor }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2" style={{ borderBottom: '1px solid var(--divider)' }}>
      <span className="text-sm" style={{ color: 'var(--t2)' }}>{label}</span>
      <span className="text-sm font-semibold tabular-nums text-right" style={{ color: 'var(--t1)' }}>{valor}</span>
    </div>
  )
}

function Seccion({ icono: Icono, titulo, sub, children }) {
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'var(--accent)', color: 'var(--accent-contrast)' }}>
          <Icono size={18}/>
        </span>
        <div className="min-w-0">
          <h2 className="section-title">{titulo}</h2>
          <p className="text-xs" style={{ color: 'var(--t3)' }}>{sub}</p>
        </div>
      </div>
      {children}
    </section>
  )
}

export default function UsoConsumo() {
  const { currentUser } = useAuth()
  const [d, setD] = useState(null)
  const [error, setError] = useState('')
  const [topes, setTopes] = useState({ ia: '', correo: '' })
  const [guardando, setGuardando] = useState(false)
  const [aviso, setAviso] = useState(null)

  const cargar = useCallback(() => {
    setError('')
    fetchUsoConsumo().then(x => {
      setD(x)
      setTopes({ ia: String(x.config?.asistente_limite_usd ?? 2), correo: String(x.config?.correo_limite_diario ?? 100) })
    }).catch(() => setError('No se pudo cargar el consumo.'))
  }, [])
  useEffect(() => { cargar() }, [cargar])

  if (currentUser?.role !== 'admin') return <Navigate to="/admin" replace />

  const guardar = async e => {
    e.preventDefault(); setAviso(null)
    const ia = Number(topes.ia), correo = Math.round(Number(topes.correo))
    if (!(ia > 0) || !(correo > 0)) return setAviso({ bad: true, text: 'Los topes deben ser mayores que 0.' })
    setGuardando(true)
    const r = await guardarTopes({ asistenteLimiteUsd: ia, correoLimiteDiario: correo })
    setGuardando(false)
    setAviso(r.ok ? { bad: false, text: 'Topes guardados.' } : { bad: true, text: r.message })
    if (r.ok) cargar()
  }

  if (error) return (
    <div role="alert" className="card p-5 flex flex-col sm:flex-row sm:items-center gap-3 justify-between"
      style={{ background: 'var(--bad-soft)', borderColor: 'var(--bad-line)' }}>
      <span className="text-sm" style={{ color: 'var(--bad)' }}>{error}</span>
      <button onClick={cargar} className="btn-secondary min-h-11 justify-center"><RefreshCw size={14}/> Reintentar</button>
    </div>
  )
  if (!d) return (
    <div className="w-full space-y-5" role="status" aria-label="Cargando consumo">
      <SkeletonBlock className="h-10 w-64"/>
      <KpiGrid cols={4}>{[0, 1, 2, 3].map(i => <SkeletonBlock key={i} className="h-28 sm:h-36"/>)}</KpiGrid>
      <SkeletonBlock className="h-64"/>
    </div>
  )

  const ia = d.ia_mes ?? {}, limiteIa = Number(d.config?.asistente_limite_usd ?? 2)
  const restanteIa = Math.max(0, limiteIa - Number(ia.costo ?? 0))
  const rep = d.reportes_mes ?? {}
  const costoChat = Math.max(0, Number(ia.costo ?? 0) - Number(rep.costo ?? 0))
  const cm = d.correos_mes ?? {}, hoy = d.correos_hoy ?? {}
  const diasIa = serie30(d.ia_dias, ['costo', 'consultas'])
  const diasCorreo = serie30(d.correos_dias, ['enviados', 'fallidos', 'omitidos'])
  const mes = new Date().toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })

  return (
    <div className="w-full space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Uso y consumo</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--t3)' }}>
            Gasto de la IA y correos enviados en {mes}. Solo lo ven los administradores.
          </p>
        </div>
        <button type="button" onClick={cargar} className="btn-secondary min-h-10"><RefreshCw size={14}/> Actualizar</button>
      </div>

      {/* ── IA ── */}
      <Seccion icono={Sparkles} titulo="Asistente de IA" sub={`API de Anthropic · modelo ${d.config?.asistente_modelo}`}>
        <KpiGrid cols={4}>
          <KpiCard icon={Sparkles} label="Gasto del mes" value={usd(ia.costo, 3)}
            tone={restanteIa <= 0 ? 'bad' : ia.costo / limiteIa > 0.8 ? 'warn' : 'good'} sub={`Tope: ${usd(limiteIa)} · quedan ${usd(restanteIa)}`}/>
          <KpiCard icon={MessageSquare} label="Consultas del mes" value={miles(ia.consultas)} tone="info"
            sub={ia.consultas ? `${usd(ia.costo / ia.consultas, 4)} en promedio` : 'Sin consultas aún'}/>
          <KpiCard icon={FileText} label="Reportes generados" value={miles((rep.alumno ?? 0) + (rep.grupo ?? 0))} tone="neutral"
            sub={`${rep.alumno ?? 0} de alumno · ${rep.grupo ?? 0} de grupo`}/>
          <KpiCard icon={Sparkles} label="Gasto histórico" value={usd(d.ia_total?.costo, 3)} tone="neutral"
            sub={`${miles(d.ia_total?.consultas)} consultas en total`}/>
        </KpiGrid>

        <div className="card p-4 sm:p-5 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold" style={{ color: 'var(--t1)' }}>Tope mensual de IA</span>
            <span className="tabular-nums" style={{ color: 'var(--t2)' }}>{usd(ia.costo, 3)} de {usd(limiteIa)}</span>
          </div>
          <Barra valor={ia.costo} limite={limiteIa}/>
          <p className="text-[11px]" style={{ color: 'var(--t3)' }}>
            Es una estimación con los precios de Haiku. Al llegar al tope, el asistente deja de responder hasta el día 1.
            El saldo real de la cuenta se ve en{' '}
            <a href="https://console.anthropic.com/settings/billing" target="_blank" rel="noreferrer" className="underline inline-flex items-center gap-0.5" style={{ color: 'var(--t2)' }}>
              console.anthropic.com <ExternalLink size={10}/>
            </a>.
          </p>
        </div>

        <div className="card p-4 sm:p-5">
          <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--t1)' }}>Gasto diario · últimos 30 días</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={diasIa} margin={{ top: 5, right: 8, bottom: 0, left: -12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--grid)" vertical={false}/>
              <XAxis dataKey="etiqueta" tick={{ fontSize: 10, fill: 'var(--axis)' }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={18}/>
              <YAxis tick={{ fontSize: 10, fill: 'var(--axis)' }} axisLine={false} tickLine={false} tickFormatter={v => `$${v < 0.1 ? v.toFixed(3) : v.toFixed(2)}`} width={52}/>
              <Tooltip wrapperStyle={{ outline: 'none' }} cursor={{ fill: 'var(--soft-bg)' }} contentStyle={TOOLTIP}
                formatter={(v, k) => k === 'costo' ? [usd(v, 4), 'Gasto'] : [v, 'Consultas']}/>
              <Bar dataKey="costo" fill="var(--accent)" radius={[4, 4, 0, 0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          <div className="min-w-0">
            <h3 className="text-sm font-bold mb-2" style={{ color: 'var(--t1)' }}>Quién lo usa (este mes)</h3>
            <DataTable columns={[{ key: 'n', label: 'Persona', className: 'flex-1 min-w-0' }, { key: 'c', label: 'Consultas', className: 'w-24 text-right justify-end' }, { key: 'g', label: 'Gasto', className: 'w-24 text-right justify-end' }]}
              isEmpty={!d.ia_usuarios?.length} emptyText="Nadie ha usado el asistente este mes.">
              {(d.ia_usuarios ?? []).map(u => (
                <DataTableRow key={u.nombre} cells={[
                  { className: 'flex-1 min-w-0', content: <span className="text-sm truncate" style={{ color: 'var(--t1)' }}>{u.nombre}</span> },
                  { className: 'w-24 justify-end', content: <span className="text-sm tabular-nums" style={{ color: 'var(--t2)' }}>{miles(u.consultas)}</span> },
                  { className: 'w-24 justify-end', content: <span className="text-sm font-semibold tabular-nums" style={{ color: 'var(--t1)' }}>{usd(u.costo, 3)}</span> },
                ]}/>
              ))}
            </DataTable>
          </div>
          <div className="card p-4 sm:p-5 min-w-0">
            <h3 className="text-sm font-bold mb-1" style={{ color: 'var(--t1)' }}>Desglose del mes</h3>
            <Fila label="Reportes con IA" valor={usd(rep.costo, 3)}/>
            <Fila label="Preguntas al chat" valor={usd(costoChat, 3)}/>
            <Fila label="Texto leído (tokens de entrada)" valor={miles(ia.tokens_entrada)}/>
            <Fila label="Texto escrito (tokens de salida)" valor={miles(ia.tokens_salida)}/>
            <Fila label="Reutilizado de caché" valor={miles(ia.tokens_cache)}/>
          </div>
        </div>
      </Seccion>

      {/* ── Correos ── */}
      <Seccion icono={Mail} titulo="Correos" sub={`Resend · remitente ${d.config?.correo_remitente || 'sin configurar'}`}>
        <KpiGrid cols={4}>
          <KpiCard icon={Send} label="Enviados hoy" value={`${miles(hoy.enviados)} / ${miles(hoy.limite)}`}
            tone={hoy.enviados >= hoy.limite ? 'bad' : hoy.enviados / hoy.limite > 0.8 ? 'warn' : 'good'} sub="Cupo diario de Resend"/>
          <KpiCard icon={Mail} label="Enviados del mes" value={miles(cm.enviados)} tone="info"
            sub={`${miles(cm.a_alumnos)} a alumnos · ${miles(cm.a_tutores)} a tutores`}/>
          <KpiCard icon={AlertTriangle} label="Sin enviar" value={miles((cm.fallidos ?? 0) + (cm.omitidos ?? 0))}
            tone={(cm.fallidos ?? 0) > 0 ? 'warn' : 'neutral'} sub={`${miles(cm.fallidos)} con error · ${miles(cm.omitidos)} omitidos`}/>
          <KpiCard icon={FileText} label="Mensajes del mes" value={miles(cm.mensajes)} tone="neutral"
            sub={`${miles(d.correos_total?.enviados)} correos enviados en total`}/>
        </KpiGrid>

        <div className="card p-4 sm:p-5 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold" style={{ color: 'var(--t1)' }}>Cupo de hoy</span>
            <span className="tabular-nums" style={{ color: 'var(--t2)' }}>{miles(hoy.enviados)} de {miles(hoy.limite)}</span>
          </div>
          <Barra valor={hoy.enviados} limite={hoy.limite}/>
          <p className="text-[11px]" style={{ color: 'var(--t3)' }}>
            Lo que no cabe en el cupo queda como "omitido" para mandarlo otro día. El historial de envíos está en{' '}
            <Link to="/admin/correos" className="underline" style={{ color: 'var(--t2)' }}>Enviar correos</Link>.
          </p>
        </div>

        <div className="card p-4 sm:p-5">
          <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--t1)' }}>Correos por día · últimos 30 días</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={diasCorreo} margin={{ top: 5, right: 8, bottom: 0, left: -18 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--grid)" vertical={false}/>
              <XAxis dataKey="etiqueta" tick={{ fontSize: 10, fill: 'var(--axis)' }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={18}/>
              <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: 'var(--axis)' }} axisLine={false} tickLine={false}/>
              <Tooltip wrapperStyle={{ outline: 'none' }} cursor={{ fill: 'var(--soft-bg)' }} contentStyle={TOOLTIP}/>
              <Legend wrapperStyle={{ fontSize: 11, color: 'var(--t2)' }}/>
              <Bar dataKey="enviados" name="Enviados" stackId="c" fill="var(--good)"/>
              <Bar dataKey="omitidos" name="Omitidos" stackId="c" fill="var(--warn)"/>
              <Bar dataKey="fallidos" name="Con error" stackId="c" fill="var(--bad)" radius={[4, 4, 0, 0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          <div className="min-w-0">
            <h3 className="text-sm font-bold mb-2" style={{ color: 'var(--t1)' }}>Quién envía (este mes)</h3>
            <DataTable columns={[{ key: 'n', label: 'Persona', className: 'flex-1 min-w-0' }, { key: 'm', label: 'Mensajes', className: 'w-24 text-right justify-end' }, { key: 'e', label: 'Correos', className: 'w-24 text-right justify-end' }]}
              isEmpty={!d.correos_usuarios?.length} emptyText="No se han enviado correos este mes.">
              {(d.correos_usuarios ?? []).map(u => (
                <DataTableRow key={u.nombre} cells={[
                  { className: 'flex-1 min-w-0', content: <span className="text-sm truncate" style={{ color: 'var(--t1)' }}>{u.nombre}</span> },
                  { className: 'w-24 justify-end', content: <span className="text-sm tabular-nums" style={{ color: 'var(--t2)' }}>{miles(u.mensajes)}</span> },
                  { className: 'w-24 justify-end', content: <span className="text-sm font-semibold tabular-nums" style={{ color: 'var(--t1)' }}>{miles(u.enviados)}</span> },
                ]}/>
              ))}
            </DataTable>
          </div>
          <div className="card p-4 sm:p-5 min-w-0">
            <h3 className="text-sm font-bold mb-1" style={{ color: 'var(--t1)' }}>Por qué no se enviaron (este mes)</h3>
            {d.correos_motivos?.length
              ? d.correos_motivos.map((x, i) => <Fila key={i} label={`${x.estado === 'fallido' ? 'Error' : 'Omitido'}: ${x.motivo}`} valor={miles(x.n)}/>)
              : <p className="text-sm py-6 text-center" style={{ color: 'var(--t3)' }}>Todo se envió bien este mes.</p>}
          </div>
        </div>
      </Seccion>

      {/* ── Topes ── */}
      <form onSubmit={guardar} className="card p-4 sm:p-5 space-y-4">
        <div>
          <h2 className="section-title">Topes</h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--t3)' }}>Límites para no gastar de más. Se aplican de inmediato.</p>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <label className="block">
            <span className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--t3)' }}>Gasto máximo de IA al mes (US$)</span>
            <input type="number" min="0.5" step="0.5" inputMode="decimal" className="input-field min-h-11"
              value={topes.ia} onChange={e => setTopes(t => ({ ...t, ia: e.target.value }))}/>
          </label>
          <label className="block">
            <span className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--t3)' }}>Correos máximos por día</span>
            <input type="number" min="1" step="1" inputMode="numeric" className="input-field min-h-11"
              value={topes.correo} onChange={e => setTopes(t => ({ ...t, correo: e.target.value }))}/>
            <span className="block text-[11px] mt-1" style={{ color: 'var(--t3)' }}>La capa gratis de Resend permite 100 al día y 3,000 al mes.</span>
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button className="btn-primary min-h-10" disabled={guardando}><Save size={14}/> {guardando ? 'Guardando…' : 'Guardar topes'}</button>
          {aviso && <span role={aviso.bad ? 'alert' : 'status'} className="text-sm" style={{ color: aviso.bad ? 'var(--bad)' : 'var(--good)' }}>{aviso.text}</span>}
        </div>
      </form>
    </div>
  )
}
