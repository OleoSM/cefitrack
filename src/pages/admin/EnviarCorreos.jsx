import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Send, Users, AlertTriangle, CheckCircle2, Mail, History, XCircle, MinusCircle, PenLine, BellRing } from 'lucide-react'
import { fetchStudents, fetchGroups } from '../../lib/supabaseData'
import { crearNotificaciones, guardarBorradorCorreo, enviarCorreo, fetchCupoCorreos, fetchEnviosRecientes } from '../../lib/comunicacionesData'
import { useCorreosHabilitados } from '../../hooks/useCorreosHabilitados'
import AvisoCorreosApagados from '../../components/admin/AvisoCorreosApagados'
import { useAuth } from '../../context/AuthContext'
import { NeonCheckbox } from '../../components/ui/NeonCheckbox'
import BarraFiltros from '../../components/ui/BarraFiltros'
import ProgressiveList from '../../components/ui/ProgressiveList'
import { useSucursales } from '../../hooks/useSucursales'
import { useSucursalActiva, TODAS } from '../../hooks/useSucursalActiva'
import SelectorAudiencia from '../../components/admin/SelectorAudiencia'
import AvisoCorreoModal from '../../components/admin/AvisoCorreoModal'
import AvisosSugeridos from '../../components/admin/AvisosSugeridos'
import { audienciaDe, fetchSugerencias, descartarAvisos } from '../../lib/avisosData'

export default function EnviarCorreos() {
  const { puedeVer } = useAuth()
  // Admin, o sub-admin con el apartado: solo escribe a alumnos de sus grupos.
  const isAdmin = puedeVer('correos')
  const { nombreDe } = useSucursales()
  const { sucursal, setSucursal, opcionesConTodas } = useSucursalActiva()
  const [groups, setGroups] = useState([])
  // Siempre hay UN grupo elegido: por defecto, el primero de la sucursal.
  const [grupo, setGrupo] = useState('')
  const [buscaGrupo, setBuscaGrupo] = useState('')
  const [query, setQuery] = useState('')
  const [students, setStudents] = useState([])
  const [selected, setSelected] = useState([])
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [audiencia, setAudiencia] = useState('ambos')
  const { alumno: includeStudent, tutor: includeTutor } = audienciaDe(audiencia)
  const [pestana, setPestana] = useState('redactar')   // 'redactar' | 'notificaciones'
  const [sugerencias, setSugerencias] = useState(null) // null = cargando
  const [avisoAbierto, setAvisoAbierto] = useState(null)
  const [status, setStatus] = useState(null)
  const [saving, setSaving] = useState(false)
  const [cupo, setCupo] = useState(null)          // { enviados, limite } de hoy
  const correosHabilitados = useCorreosHabilitados()
  const [envios, setEnvios] = useState([])        // historial reciente

  const refrescarEnvios = () => {
    fetchCupoCorreos().then(setCupo).catch(() => {})
    fetchEnviosRecientes().then(setEnvios).catch(() => {})
  }
  useEffect(() => {
    Promise.all([fetchStudents(), fetchGroups()])
      .then(([sts, grs]) => { setStudents(sts); setGroups(grs) })
      .catch(() => setStatus({ bad:true, text:'No se cargaron los alumnos.' }))
    refrescarEnvios()
  }, [])

  // Sugerencias de la pestaña Notificaciones (se calculan con los alumnos ya cargados).
  useEffect(() => {
    if (!students.length || !groups.length) return
    fetchSugerencias({ students, groups }).then(setSugerencias).catch(() => setSugerencias([]))
  }, [students, groups])
  const grupoDe = useMemo(() => Object.fromEntries(groups.map(g => [g.id, g])), [groups])
  const sugerenciasVisibles = (sugerencias ?? []).filter(s =>
    sucursal === TODAS || s.alumnos.some(a => grupoDe[a.groupId]?.sucursal === sucursal))
  const quitarSugerencias = claves => setSugerencias(v => (v ?? []).filter(s => !claves.includes(s.clave)))
  const descartar = async lista => {
    try { await descartarAvisos(lista); quitarSugerencias(lista.map(s => s.clave)) }
    catch {
      const message = 'No se pudo descartar. Inténtalo de nuevo.'
      setStatus({ bad:true, text: message }); return { ok:false, message }
    }
  }

  /* Cuántos correos saldrían realmente: el del alumno es su correo PERSONAL
     (el de acceso @siga.mx no es un buzón) y el del tutor, el que registró. */
  const elegidos = students.filter(s => selected.includes(s.id))
  const conCorreoAlumno = elegidos.filter(s => s.personalEmail).length
  const conCorreoTutor  = elegidos.filter(s => s.tutor?.email).length
  const correosPrevistos = (includeStudent ? conCorreoAlumno : 0) + (includeTutor ? conCorreoTutor : 0)
  const restante = cupo ? Math.max(0, cupo.limite - cupo.enviados) : null

  const gruposEnSucursal = sucursal === TODAS ? groups : groups.filter(g => g.sucursal === sucursal)
  const primerGrupo = gruposEnSucursal[0]?.id ?? ''
  // Si el grupo elegido no está en la sucursal (al entrar o al cambiarla), el primero.
  useEffect(() => {
    if (!gruposEnSucursal.some(g => g.id === grupo)) setGrupo(primerGrupo)
  }, [gruposEnSucursal, grupo, primerGrupo])
  const delGrupo = useMemo(() => students.filter(s => s.groupId === grupo), [students, grupo])
  const visibles = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('es-MX')
    return delGrupo.filter(s => !q || `${s.name} ${s.email ?? ''}`.toLocaleLowerCase('es-MX').includes(q))
  }, [delGrupo, query])
  /* "Todos" opera sobre lo filtrado: seleccionar a un grupo entero es filtrar
     por él y pulsar "Todos". */
  const all = visibles.length > 0 && visibles.every(s => selected.includes(s.id))
  const toggleTodos = () => {
    const ids = visibles.map(s => s.id)
    setSelected(v => all ? v.filter(id => !ids.includes(id)) : [...new Set([...v, ...ids])])
  }
  const toggle = id => setSelected(v => v.includes(id) ? v.filter(x => x !== id) : [...v, id])

  const submit = async e => {
    e.preventDefault(); setStatus(null)
    if (!selected.length || !subject.trim() || !body.trim()) return setStatus({ bad:true, text:'Selecciona destinatarios, asunto y mensaje.' })
    if (correosHabilitados === false) return setStatus({ bad:true, text:'El envío de correos está desactivado. Un administrador puede activarlo en Configuración.' })
    setSaving(true)
    try {
      const targets = students.filter(s => selected.includes(s.id))
      const draft = await guardarBorradorCorreo({ subject, body, studentIds:selected, includeStudent, includeTutor })
      // La notificación dentro de SIGA llega siempre, haya correo o no.
      await crearNotificaciones({ students:targets, title:subject, body })
      const r = await enviarCorreo(draft.id)
      if (!r.ok) {
        setStatus({ bad:true, text:`Se envió la notificación dentro de SIGA, pero no el correo: ${r.message}` })
      } else {
        const partes = [`${r.enviados} correo(s) enviado(s)`]
        if (r.omitidos) partes.push(`${r.omitidos} sin enviar (sin correo o sin cupo)`)
        if (r.fallidos) partes.push(`${r.fallidos} con error${r.motivoFallo ? `: ${r.motivoFallo}` : ''}`)
        setStatus({ bad: r.enviados === 0, text: `${partes.join(' · ')}. Notificación entregada dentro de SIGA.` })
        if (r.enviados > 0) { setSubject(''); setBody(''); setSelected([]) }
      }
      refrescarEnvios()
    } catch (err) { setStatus({ bad:true, text:err?.message ?? 'No se pudo guardar el envío.' }) }
    setSaving(false)
  }

  if (!isAdmin) return <Navigate to="/admin" replace />

  return (
    <div className="w-full space-y-5">
      <div>
        <h1 className="page-title">Enviar correos</h1>
        <p className="text-sm mt-1" style={{ color:'var(--t3)' }}>
          Cada envío llega como notificación dentro de SIGA y por correo a los alumnos (su correo personal), a sus tutores o a ambos.
        </p>
      </div>

      {/* Pestañas: redactar un mensaje libre, o avisar de algo nuevo en la hoja o en materiales. */}
      <div role="tablist" aria-label="Tipo de envío" className="grid grid-cols-2 gap-1 p-1 rounded-xl sm:w-fit"
        style={{ background:'var(--soft-bg)', border:'1px solid var(--card-border)' }}>
        {[
          { id:'redactar', label:'Redactar', Icono: PenLine },
          { id:'notificaciones', label:'Notificaciones', Icono: BellRing, cuenta: sugerenciasVisibles.length },
        ].map(({ id, label, Icono, cuenta }) => {
          const activa = pestana === id
          return (
            <button key={id} type="button" role="tab" aria-selected={activa} onClick={() => setPestana(id)}
              className="flex items-center justify-center gap-2 rounded-lg px-4 min-h-10 text-sm font-semibold transition-colors"
              style={activa ? { background:'var(--accent)', color:'var(--accent-contrast)' } : { color:'var(--t2)' }}>
              <Icono size={15}/> {label}
              {!!cuenta && (
                <span className="min-w-5 h-5 px-1.5 rounded-full text-[11px] font-bold tabular-nums flex items-center justify-center"
                  style={activa ? { background:'var(--accent-contrast)', color:'var(--accent)' } : { background:'var(--accent)', color:'var(--accent-contrast)' }}>
                  {cuenta}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {correosHabilitados === false && <AvisoCorreosApagados/>}

      {/* Cupo del día: tope de seguridad diario (Configuración). */}
      {cupo && (
        <div className="card p-3 sm:p-4 flex items-center gap-3">
          <Mail size={18} style={{ color:'var(--accent)' }} className="flex-shrink-0"/>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-semibold" style={{ color:'var(--t1)' }}>Correos de hoy</span>
              <span className="tabular-nums" style={{ color: restante === 0 ? 'var(--bad)' : 'var(--t2)' }}>{cupo.enviados} de {cupo.limite}</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background:'var(--soft-bg)' }}>
              <div className="h-full rounded-full" style={{ width:`${Math.min(100, (cupo.enviados / Math.max(1, cupo.limite)) * 100)}%`,
                background: restante === 0 ? 'var(--bad)' : cupo.enviados / cupo.limite > .8 ? 'var(--warn)' : 'var(--good)' }}/>
            </div>
          </div>
        </div>
      )}

      {status && (
        <div role={status.bad ? 'alert' : 'status'} className="flex gap-2 rounded-xl p-3"
          style={{ background: status.bad ? 'var(--bad-soft)' : 'var(--good-soft)',
                   border: `1px solid ${status.bad ? 'var(--bad-line)' : 'var(--good-line)'}`,
                   color: status.bad ? 'var(--bad)' : 'var(--good)' }}>
          {status.bad ? <AlertTriangle size={16}/> : <CheckCircle2 size={16}/>}
          <span className="text-sm">{status.text}</span>
        </div>
      )}

      {pestana === 'notificaciones' && (
        <AvisosSugeridos sugerencias={sugerencias === null ? null : sugerenciasVisibles} groups={groups}
          sucursal={sucursal} setSucursal={setSucursal} opcionesSucursal={opcionesConTodas} nombreDe={nombreDe}
          onEnviar={setAvisoAbierto} onDescartar={descartar}/>
      )}

      {avisoAbierto && (
        <AvisoCorreoModal titulo={avisoAbierto.titulo} contexto={avisoAbierto.detalle} alumnos={avisoAbierto.alumnos}
          asuntoInicial={avisoAbierto.asunto} mensajeInicial={avisoAbierto.mensaje}
          tipo={avisoAbierto.tipo} refId={avisoAbierto.refId} groupId={avisoAbierto.groupId}
          onEnviado={() => { quitarSugerencias([avisoAbierto.clave]); refrescarEnvios() }}
          onClose={() => setAvisoAbierto(null)}/>
      )}

      {pestana === 'redactar' && <>
      <BarraFiltros
        filtros={[
          { id:'sucursal', label:'Sucursal', value:sucursal, onChange:v => { setSucursal(v); setGrupo('') },
            porDefecto:sucursal, options:opcionesConTodas },
          { id:'grupo', label:'Grupo', tipo:'grupo', value:grupo, onChange:v => setGrupo(v || primerGrupo), porDefecto:primerGrupo,
            grupos:gruposEnSucursal, query:buscaGrupo, onQuery:setBuscaGrupo, nombreDe },
        ]}
        busqueda={{ value: query, onChange: setQuery, placeholder: 'Buscar alumno…',
          coincidencias: delGrupo.map(s => ({ id: s.id, label: s.name, sub: s.personalEmail || 'sin correo personal' })),
          onElegir: id => setSelected(v => v.includes(id) ? v : [...v, id]) }}
        resumen={`${selected.length} seleccionado(s)`}/>

      <form onSubmit={submit} className="grid lg:grid-cols-[minmax(0,340px)_1fr] gap-4">
        <section className="card p-5 space-y-3 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h2 className="section-title flex items-center gap-2"><Users size={16}/> Destinatarios</h2>
            <button type="button" className="btn-secondary text-xs py-2" onClick={toggleTodos} disabled={!visibles.length}>
              {all ? 'Quitar todos' : `Todos (${visibles.length})`}
            </button>
          </div>
          {/* La caja crece con el grupo y, pasado el tamaño de antes, hace scroll
              en vez de "Mostrar más": un grupo se revisa de un vistazo. */}
          <div className="max-h-[26rem] overflow-y-auto overscroll-contain pr-1 space-y-2.5">
          {visibles.length === 0 && (
            <p className="text-sm py-8 text-center" style={{ color:'var(--t3)' }}>
              {grupo ? (query.trim() ? 'Ningún alumno coincide con la búsqueda.' : 'Este grupo aún no tiene alumnos.') : 'No hay grupos en esta sucursal.'}
            </p>
          )}
          {visibles.map(s => (
              <NeonCheckbox key={s.id} className="w-full items-start"
                checked={selected.includes(s.id)} onChange={() => toggle(s.id)}
                label={<span className="text-sm min-w-0" style={{ color:'var(--t1)' }}>{s.name}
                  <small className="block truncate" style={{ color:'var(--t3)' }}>
                    {s.personalEmail || s.email} · {s.tutor?.email || 'Tutor sin correo'}
                  </small></span>}/>
          ))}
          </div>
        </section>

        <section className="card p-5 space-y-4 min-w-0">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color:'var(--t3)' }}>¿A quién se le envía?</p>
            <SelectorAudiencia valor={audiencia} onChange={setAudiencia}
              conteo={selected.length ? { conAlumno: conCorreoAlumno, conTutor: conCorreoTutor } : undefined}/>
          </div>
          <div>
            <label htmlFor="correo-asunto" className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color:'var(--t3)' }}>Asunto</label>
            <input id="correo-asunto" className="input-field" value={subject} onChange={e => setSubject(e.target.value)}/>
          </div>
          <div>
            <label htmlFor="correo-mensaje" className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color:'var(--t3)' }}>Mensaje</label>
            <textarea id="correo-mensaje" className="input-field min-h-56 resize-y" value={body} onChange={e => setBody(e.target.value)}/>
          </div>
          {selected.length > 0 && (
            <p className="text-xs" style={{ color:'var(--t2)' }}>
              Saldrán <b>{correosPrevistos}</b> correo(s):
              {includeStudent && <> {conCorreoAlumno} de {elegidos.length} alumnos tienen correo personal</>}
              {includeStudent && includeTutor && ' ·'}
              {includeTutor && <> {conCorreoTutor} de {elegidos.length} tutores tienen correo</>}.
              {restante !== null && correosPrevistos > restante && (
                <b style={{ color:'var(--bad)' }}> Solo quedan {restante} hoy: el resto no se enviará.</b>
              )}
            </p>
          )}
          <button className="btn-primary" disabled={saving}><Send size={14}/>{saving ? 'Enviando…' : 'Confirmar envío'}</button>
        </section>
      </form>
      </>}

      {/* Historial reciente */}
      <section className="card p-5 space-y-3">
        <h2 className="section-title flex items-center gap-2"><History size={16}/> Últimos envíos</h2>
        <ProgressiveList items={envios} className="space-y-1.5" sizes={{ mobile:5, tablet:5, desktop:5 }}
          emptyLabel="Todavía no se ha enviado ningún correo.">
          {e => {
            const Icono = e.estado === 'enviado' ? CheckCircle2 : e.estado === 'fallido' ? XCircle : MinusCircle
            const color = e.estado === 'enviado' ? 'var(--good)' : e.estado === 'fallido' ? 'var(--bad)' : 'var(--t3)'
            return (
              <div key={e.id} className="flex items-center gap-2.5 rounded-xl px-3 py-2" style={{ border:'1px solid var(--divider)' }}>
                <Icono size={15} className="flex-shrink-0" style={{ color }}/>
                <div className="min-w-0 flex-1">
                  <p className="text-sm truncate" style={{ color:'var(--t1)' }}>{e.asunto || '(sin asunto)'}</p>
                  <p className="text-[11px] truncate" style={{ color:'var(--t3)' }}>
                    {e.tipo === 'tutor' ? 'Tutor' : 'Alumno'} · {e.destinatario}{e.motivo ? ` · ${e.motivo}` : ''}
                  </p>
                </div>
                <span className="text-[10px] tabular-nums flex-shrink-0" style={{ color:'var(--t3)' }}>
                  {new Date(e.fecha).toLocaleString('es-MX', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}
                </span>
              </div>
            )
          }}
        </ProgressiveList>
      </section>
    </div>
  )
}
