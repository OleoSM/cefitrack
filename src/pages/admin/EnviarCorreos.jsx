import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Send, Users, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { fetchStudents, fetchGroups } from '../../lib/supabaseData'
import { crearNotificaciones, guardarBorradorCorreo } from '../../lib/comunicacionesData'
import { useAuth } from '../../context/AuthContext'
import { NeonCheckbox } from '../../components/ui/NeonCheckbox'
import BarraFiltros from '../../components/ui/BarraFiltros'
import ProgressiveList from '../../components/ui/ProgressiveList'
import { useSucursales } from '../../hooks/useSucursales'
import { useSucursalActiva, TODAS } from '../../hooks/useSucursalActiva'

export default function EnviarCorreos() {
  const { currentUser } = useAuth()
  const isAdmin = currentUser?.role === 'admin'
  const { nombreDe } = useSucursales()
  const { sucursal, setSucursal, opcionesConTodas } = useSucursalActiva()
  const [groups, setGroups] = useState([])
  const [grupo, setGrupo] = useState('todos')
  const [buscaGrupo, setBuscaGrupo] = useState('')
  const [query, setQuery] = useState('')
  const [students, setStudents] = useState([])
  const [selected, setSelected] = useState([])
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [includeStudent, setIncludeStudent] = useState(true)
  const [includeTutor, setIncludeTutor] = useState(true)
  const [status, setStatus] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    Promise.all([fetchStudents(), fetchGroups()])
      .then(([sts, grs]) => { setStudents(sts); setGroups(grs) })
      .catch(() => setStatus({ bad:true, text:'No se cargaron los alumnos.' }))
  }, [])

  const gruposEnSucursal = sucursal === TODAS ? groups : groups.filter(g => g.sucursal === sucursal)
  const visibles = useMemo(() => {
    const ids = new Set(gruposEnSucursal.map(g => g.id))
    const q = query.trim().toLocaleLowerCase('es-MX')
    return students.filter(s => ids.has(s.groupId)
      && (grupo === 'todos' || s.groupId === grupo)
      && (!q || `${s.name} ${s.email ?? ''}`.toLocaleLowerCase('es-MX').includes(q)))
  }, [students, gruposEnSucursal, grupo, query])
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
    setSaving(true)
    try {
      const targets = students.filter(s => selected.includes(s.id))
      await guardarBorradorCorreo({ subject, body, studentIds:selected, includeStudent, includeTutor })
      await crearNotificaciones({ students:targets, title:subject, body })
      setStatus({ text:'Notificación enviada. El correo quedó pendiente hasta configurar Resend.' })
      setSubject(''); setBody(''); setSelected([])
    } catch (err) { setStatus({ bad:true, text:err?.message ?? 'No se pudo guardar el envío.' }) }
    setSaving(false)
  }

  if (!isAdmin) return <Navigate to="/admin" replace />

  return (
    <div className="w-full space-y-5">
      <div>
        <h1 className="page-title">Enviar correos</h1>
        <p className="text-sm mt-1" style={{ color:'var(--t3)' }}>
          El administrador confirma cada envío. Mientras Resend está pendiente, se entrega la notificación interna y se conserva el correo en cola.
        </p>
      </div>

      {status && (
        <div role={status.bad ? 'alert' : 'status'} className="flex gap-2 rounded-xl p-3"
          style={{ background: status.bad ? 'var(--bad-soft)' : 'var(--good-soft)',
                   border: `1px solid ${status.bad ? 'var(--bad-line)' : 'var(--good-line)'}`,
                   color: status.bad ? 'var(--bad)' : 'var(--good)' }}>
          {status.bad ? <AlertTriangle size={16}/> : <CheckCircle2 size={16}/>}
          <span className="text-sm">{status.text}</span>
        </div>
      )}

      <BarraFiltros
        filtros={[
          { id:'sucursal', label:'Sucursal', value:sucursal, onChange:v => { setSucursal(v); setGrupo('todos') },
            porDefecto:sucursal, options:opcionesConTodas },
          { id:'grupo', label:'Grupo', tipo:'grupo', value:grupo, onChange:setGrupo, porDefecto:'todos',
            grupos:gruposEnSucursal, query:buscaGrupo, onQuery:setBuscaGrupo, nombreDe },
        ]}
        busqueda={{ value: query, onChange: setQuery, placeholder: 'Buscar alumno…' }}
        resumen={`${selected.length} seleccionado(s)`}/>

      <form onSubmit={submit} className="grid lg:grid-cols-[minmax(0,340px)_1fr] gap-4">
        <section className="card p-5 space-y-3 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h2 className="section-title flex items-center gap-2"><Users size={16}/> Destinatarios</h2>
            <button type="button" className="btn-secondary text-xs py-2" onClick={toggleTodos} disabled={!visibles.length}>
              {all ? 'Quitar todos' : `Todos (${visibles.length})`}
            </button>
          </div>
          <ProgressiveList items={visibles} className="space-y-2.5" emptyLabel="Ningún alumno coincide con el filtro.">
            {s => (
              <NeonCheckbox key={s.id} className="w-full items-start"
                checked={selected.includes(s.id)} onChange={() => toggle(s.id)}
                label={<span className="text-sm min-w-0" style={{ color:'var(--t1)' }}>{s.name}
                  <small className="block truncate" style={{ color:'var(--t3)' }}>
                    {s.personalEmail || s.email} · {s.tutor?.email || 'Tutor sin correo'}
                  </small></span>}/>
            )}
          </ProgressiveList>
        </section>

        <section className="card p-5 space-y-4 min-w-0">
          <div className="flex flex-wrap gap-5">
            <NeonCheckbox checked={includeStudent} onChange={e => setIncludeStudent(e.target.checked)}
              label={<span className="text-sm" style={{ color:'var(--t1)' }}>Alumno</span>}/>
            <NeonCheckbox checked={includeTutor} onChange={e => setIncludeTutor(e.target.checked)}
              label={<span className="text-sm" style={{ color:'var(--t1)' }}>Tutor</span>}/>
          </div>
          <div>
            <label htmlFor="correo-asunto" className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color:'var(--t3)' }}>Asunto</label>
            <input id="correo-asunto" className="input-field" value={subject} onChange={e => setSubject(e.target.value)}/>
          </div>
          <div>
            <label htmlFor="correo-mensaje" className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color:'var(--t3)' }}>Mensaje</label>
            <textarea id="correo-mensaje" className="input-field min-h-56 resize-y" value={body} onChange={e => setBody(e.target.value)}/>
          </div>
          <button className="btn-primary" disabled={saving}><Send size={14}/>{saving ? 'Guardando…' : 'Confirmar envío'}</button>
        </section>
      </form>
    </div>
  )
}
