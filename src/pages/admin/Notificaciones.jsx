import { useCallback, useEffect, useMemo, useState } from 'react'
import { BellRing, Send, Clock, Mail, Zap, CheckCircle2, XCircle, MinusCircle, Eye, AlertTriangle, RefreshCw, Trophy, CalendarClock } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import ProgressiveList from '../../components/ui/ProgressiveList'
import BarraFiltros from '../../components/ui/BarraFiltros'
import { SkeletonBlock } from '../../components/ui/DataTable'
import ConfirmDialog from '../../components/admin/ConfirmDialog'
import AvisoCorreosApagados from '../../components/admin/AvisoCorreosApagados'
import { useCorreosHabilitados } from '../../hooks/useCorreosHabilitados'
import { TIPO_AVISO, fetchAvisosEnviados, fetchProximosAVencer, fetchHistorialCorreos, ejecutarAvisosAuto } from '../../lib/notificacionesData'

/*
 * Notificaciones (admin y sub-admins con el apartado de correos): todo lo
 * enviado ordenado por tipo y fecha, lo que está próximo a vencer, el
 * historial de correos y los avisos automáticos. Listas de 5 en 5.
 */
const fecha = f => new Date(f).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const PESTANAS = [
  { id: 'enviados', label: 'Enviados', Icono: Send },
  { id: 'proximos', label: 'Próximo a vencer', Icono: Clock },
  { id: 'correos', label: 'Correos', Icono: Mail },
  { id: 'auto', label: 'Automáticos', Icono: Zap, soloAdmin: true },
]

function Fila({ icono: Icono, color, titulo, detalle, derecha }) {
  return (
    <div className="flex items-center gap-3 rounded-xl px-3 py-2.5 min-w-0" style={{ border: '1px solid var(--divider)' }}>
      <Icono size={16} className="flex-shrink-0" style={{ color }}/>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold truncate" style={{ color: 'var(--t1)' }}>{titulo}</p>
        <p className="text-[11px] truncate" style={{ color: 'var(--t3)' }}>{detalle}</p>
      </div>
      {derecha}
    </div>
  )
}

export default function Notificaciones() {
  const { currentUser } = useAuth()
  const esAdmin = currentUser?.role === 'admin'
  const correosHabilitados = useCorreosHabilitados()
  const [pestana, setPestana] = useState('enviados')
  const [avisos, setAvisos] = useState(null)
  const [proximos, setProximos] = useState(null)
  const [correos, setCorreos] = useState(null)
  const [error, setError] = useState('')

  const cargar = useCallback(() => {
    setError('')
    fetchAvisosEnviados().then(setAvisos).catch(() => { setAvisos([]); setError('No se pudo cargar lo enviado.') })
    fetchProximosAVencer(7).then(setProximos).catch(() => setProximos([]))
    fetchHistorialCorreos().then(setCorreos).catch(() => setCorreos([]))
  }, [])
  useEffect(() => { cargar() }, [cargar])

  return (
    <div className="w-full space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="page-title">Notificaciones</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--t3)' }}>Todo lo que se ha avisado, lo que está por vencer y los correos enviados.</p>
        </div>
        <button type="button" onClick={cargar} className="btn-secondary min-h-10"><RefreshCw size={14}/> Actualizar</button>
        {correosHabilitados === false && <AvisoCorreosApagados className="w-full"/>}
      </div>

      <div role="tablist" aria-label="Secciones" className="flex gap-1 p-1 rounded-xl overflow-x-auto" style={{ background: 'var(--soft-bg)', border: '1px solid var(--card-border)' }}>
        {PESTANAS.filter(p => !p.soloAdmin || esAdmin).map(({ id, label, Icono }) => {
          const activa = pestana === id
          const cuenta = id === 'proximos' ? proximos?.filter(p => !p.avisado).length : null
          return (
            <button key={id} type="button" role="tab" aria-selected={activa} onClick={() => setPestana(id)}
              className="flex items-center justify-center gap-2 rounded-lg px-4 min-h-10 text-sm font-semibold whitespace-nowrap flex-1"
              style={activa ? { background: 'var(--accent)', color: 'var(--accent-contrast)' } : { color: 'var(--t2)' }}>
              <Icono size={15}/> {label}
              {!!cuenta && <span className="min-w-5 h-5 px-1.5 rounded-full text-[11px] font-bold flex items-center justify-center"
                style={activa ? { background: 'var(--accent-contrast)', color: 'var(--accent)' } : { background: 'var(--accent)', color: 'var(--accent-contrast)' }}>{cuenta}</span>}
            </button>
          )
        })}
      </div>

      {error && <p role="alert" className="text-sm" style={{ color: 'var(--bad)' }}>{error}</p>}
      {pestana === 'enviados' && <Enviados avisos={avisos}/>}
      {pestana === 'proximos' && <Proximos proximos={proximos}/>}
      {pestana === 'correos' && <Correos correos={correos}/>}
      {pestana === 'auto' && esAdmin && <Automaticos onEnviado={cargar}/>}
    </div>
  )
}

function Enviados({ avisos }) {
  const [tipo, setTipo] = useState('todos')
  const [estado, setEstado] = useState('todos')
  const [q, setQ] = useState('')
  const lista = useMemo(() => (avisos ?? []).filter(a =>
    (tipo === 'todos' || a.tipo === tipo)
    && (estado === 'todos' || (estado === 'descartado') === a.descartado)
    && (!q.trim() || a.asunto.toLowerCase().includes(q.trim().toLowerCase()))), [avisos, tipo, estado, q])
  if (avisos === null) return <SkeletonBlock className="h-48"/>
  return (
    <section className="space-y-3">
      <BarraFiltros
        filtros={[
          { id: 'tipo', label: 'Tipo', value: tipo, onChange: setTipo, porDefecto: 'todos',
            options: [{ value: 'todos', label: 'Todos los tipos' }, ...Object.entries(TIPO_AVISO).map(([value, label]) => ({ value, label }))] },
          { id: 'estado', label: 'Estado', value: estado, onChange: setEstado, porDefecto: 'todos',
            options: [{ value: 'todos', label: 'Enviados y descartados' }, { value: 'enviado', label: 'Solo enviados' }, { value: 'descartado', label: 'Solo descartados' }] },
        ]}
        busqueda={{ value: q, onChange: setQ, placeholder: 'Buscar por asunto…' }}
        resumen={`${lista.length} aviso(s)`}/>
      <ProgressiveList items={lista} className="space-y-1.5" sizes={{ mobile: 5, tablet: 5, desktop: 5 }} emptyLabel="Todavía no hay avisos.">
        {a => (
          <Fila key={a.id} icono={a.descartado ? MinusCircle : BellRing} color={a.descartado ? 'var(--t3)' : 'var(--accent)'}
            titulo={a.descartado ? `${TIPO_AVISO[a.tipo] ?? a.tipo} (descartado)` : (a.asunto || TIPO_AVISO[a.tipo])}
            detalle={`${TIPO_AVISO[a.tipo] ?? a.tipo} · ${fecha(a.fecha)}${a.descartado ? '' : ` · ${a.correos.enviado} correo(s)${a.correos.omitido ? ` · ${a.correos.omitido} sin enviar` : ''}`}`}
            derecha={!a.descartado && a.correos.fallido > 0 && <span className="text-[11px] font-bold" style={{ color: 'var(--bad)' }}>{a.correos.fallido} con error</span>}/>
        )}
      </ProgressiveList>
    </section>
  )
}

function Proximos({ proximos }) {
  const [tipo, setTipo] = useState('todos')
  const lista = (proximos ?? []).filter(p => tipo === 'todos' || p.tipo === tipo)
  if (proximos === null) return <SkeletonBlock className="h-48"/>
  return (
    <section className="space-y-3">
      <p className="text-xs" style={{ color: 'var(--t3)' }}>Actividades con fecha de entrega y materiales que se borran en los próximos 7 días.</p>
      <BarraFiltros filtros={[{ id: 'tipo', label: 'Tipo', value: tipo, onChange: setTipo, porDefecto: 'todos',
        options: [{ value: 'todos', label: 'Todo' }, { value: 'actividad', label: 'Actividades' }, { value: 'material', label: 'Materiales' }] }]}
        resumen={`${lista.length} elemento(s)`}/>
      <ProgressiveList items={lista} className="space-y-1.5" sizes={{ mobile: 5, tablet: 5, desktop: 5 }} emptyLabel="Nada vence en los próximos 7 días.">
        {p => {
          const horas = (new Date(p.fecha).getTime() - Date.now()) / 36e5
          const urgente = horas < 48
          return (
            <Fila key={p.clave} icono={p.tipo === 'actividad' ? CalendarClock : Clock} color={urgente ? 'var(--warn)' : 'var(--accent)'}
              titulo={p.titulo} detalle={`${p.tipo === 'actividad' ? 'Entrega' : 'Se borra'} ${fecha(p.fecha)}${p.detalle ? ` · ${p.detalle}` : ''}`}
              derecha={<span className="text-[11px] font-bold whitespace-nowrap" style={{ color: p.avisado ? 'var(--good)' : urgente ? 'var(--warn)' : 'var(--t3)' }}>
                {p.avisado ? 'Recordado' : urgente ? 'Pendiente de recordar' : 'Sin recordar'}</span>}/>
          )
        }}
      </ProgressiveList>
    </section>
  )
}

function Correos({ correos }) {
  const [estado, setEstado] = useState('todos')
  const [tipo, setTipo] = useState('todos')
  const [q, setQ] = useState('')
  const lista = useMemo(() => (correos ?? []).filter(c =>
    (estado === 'todos' || c.estado === estado) && (tipo === 'todos' || c.tipo === tipo)
    && (!q.trim() || `${c.destinatario} ${c.asunto}`.toLowerCase().includes(q.trim().toLowerCase()))), [correos, estado, tipo, q])
  if (correos === null) return <SkeletonBlock className="h-48"/>
  return (
    <section className="space-y-3">
      <BarraFiltros
        filtros={[
          { id: 'estado', label: 'Estado', value: estado, onChange: setEstado, porDefecto: 'todos',
            options: [{ value: 'todos', label: 'Todos' }, { value: 'enviado', label: 'Enviados' }, { value: 'omitido', label: 'Omitidos' }, { value: 'fallido', label: 'Con error' }] },
          { id: 'tipo', label: 'Para', value: tipo, onChange: setTipo, porDefecto: 'todos',
            options: [{ value: 'todos', label: 'Alumnos y tutores' }, { value: 'alumno', label: 'Alumnos' }, { value: 'tutor', label: 'Tutores' }] },
        ]}
        busqueda={{ value: q, onChange: setQ, placeholder: 'Buscar correo o asunto…' }}
        resumen={`${lista.length} correo(s)`}/>
      <ProgressiveList items={lista} className="space-y-1.5" sizes={{ mobile: 5, tablet: 5, desktop: 5 }} emptyLabel="No hay correos con esos filtros.">
        {c => {
          const Icono = c.estado === 'enviado' ? CheckCircle2 : c.estado === 'fallido' ? XCircle : MinusCircle
          const color = c.estado === 'enviado' ? 'var(--good)' : c.estado === 'fallido' ? 'var(--bad)' : 'var(--t3)'
          return <Fila key={c.id} icono={Icono} color={color} titulo={c.asunto || '(sin asunto)'}
            detalle={`${c.tipo === 'tutor' ? 'Tutor' : 'Alumno'} · ${c.destinatario} · ${fecha(c.fecha)}${c.motivo ? ` · ${c.motivo}` : ''}`}/>
        }}
      </ProgressiveList>
    </section>
  )
}

function Automaticos({ onEnviado }) {
  const [vista, setVista] = useState({})        // { [accion]: lotes[] }
  const [ocupado, setOcupado] = useState(null)
  const [aviso, setAviso] = useState(null)
  const [confirmar, setConfirmar] = useState(null)
  const ACCIONES = [
    { id: 'recordatorios', titulo: 'Recordatorios de 2 días', Icono: CalendarClock,
      detalle: 'A quien no ha entregado una actividad que vence en 2 días (alumno y tutor) y a quien tiene un material que se borra en menos de 2 días. Cada aviso se manda una sola vez.' },
    { id: 'top_mensual', titulo: 'Top mensual', Icono: Trophy,
      detalle: 'A cada alumno: el Top 10 de su grupo del mes y su lugar. Puntaje: 50 % promedio, 30 % asistencia y 20 % racha.' },
  ]
  const previa = async id => {
    setOcupado(id); setAviso(null)
    const r = await ejecutarAvisosAuto(id, true)
    setOcupado(null)
    if (!r?.ok) return setAviso({ bad: true, text: r?.message })
    setVista(v => ({ ...v, [id]: r.lotes }))
  }
  const enviar = async id => {
    const r = await ejecutarAvisosAuto(id, false)
    if (!r?.ok) return { ok: false, message: r?.message }
    setAviso({ bad: false, text: `${r.avisos} aviso(s) · ${r.enviados} correo(s) enviados${r.omitidos ? ` · ${r.omitidos} sin cupo` : ''}${r.fallidos ? ` · ${r.fallidos} con error` : ''}.` })
    setVista(v => ({ ...v, [id]: [] })); onEnviado?.()
  }
  return (
    <section className="space-y-4">
      <div className="flex gap-2 rounded-xl p-3 text-xs" style={{ background: 'var(--warn-soft)', border: '1px solid var(--warn-line)', color: 'var(--t1)' }}>
        <AlertTriangle size={15} className="flex-shrink-0" style={{ color: 'var(--warn)' }}/>
        <span>El envío automático diario (recordatorios) y el del día 1 de cada mes (top) aún <b>no están programados</b>. Por ahora se disparan desde aquí: primero revisa la vista previa.</span>
      </div>
      {aviso && <p role={aviso.bad ? 'alert' : 'status'} className="text-sm" style={{ color: aviso.bad ? 'var(--bad)' : 'var(--good)' }}>{aviso.text}</p>}
      {ACCIONES.map(a => (
        <div key={a.id} className="card p-4 sm:p-5 space-y-3">
          <div className="flex items-start gap-3">
            <span className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'var(--accent)', color: 'var(--accent-contrast)' }}><a.Icono size={18}/></span>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-bold" style={{ color: 'var(--t1)' }}>{a.titulo}</h2>
              <p className="text-xs mt-0.5" style={{ color: 'var(--t3)' }}>{a.detalle}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-secondary min-h-10" disabled={!!ocupado} onClick={() => previa(a.id)}>
              <Eye size={14}/> {ocupado === a.id ? 'Calculando…' : 'Vista previa'}
            </button>
            <button type="button" className="btn-primary min-h-10" disabled={!!ocupado || !vista[a.id]?.length} onClick={() => setConfirmar(a)}>
              <Send size={14}/> Enviar ahora
            </button>
          </div>
          {vista[a.id] && (
            <ProgressiveList items={vista[a.id]} className="space-y-1.5" sizes={{ mobile: 5, tablet: 5, desktop: 5 }} emptyLabel="No hay nada pendiente por enviar.">
              {(l, i) => <Fila key={i} icono={a.Icono} color="var(--accent)" titulo={l.titulo} detalle={`${l.detalle} · ${l.correos} correo(s)`}/>}
            </ProgressiveList>
          )}
        </div>
      ))}
      {confirmar && (
        <ConfirmDialog title={`¿Enviar "${confirmar.titulo}"?`}
          message={`Se mandarán ${(vista[confirmar.id] ?? []).reduce((s, l) => s + l.correos, 0)} correo(s) reales y la notificación dentro de SIGA.`}
          detail="Lo que no quepa en el cupo diario queda como omitido." confirmLabel="Sí, enviar" busyLabel="Enviando…"
          onConfirm={() => enviar(confirmar.id)} onClose={() => setConfirmar(null)}/>
      )}
    </section>
  )
}
