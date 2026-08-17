import { useEffect, useMemo, useState } from 'react'
import { Mail, Send, Users, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { fetchStudents } from '../../lib/supabaseData'
import { crearNotificaciones, guardarBorradorCorreo } from '../../lib/comunicacionesData'

export default function EnviarCorreos() {
  const [students, setStudents] = useState([])
  const [selected, setSelected] = useState([])
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [includeStudent, setIncludeStudent] = useState(true)
  const [includeTutor, setIncludeTutor] = useState(true)
  const [status, setStatus] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchStudents().then(setStudents).catch(() => setStatus({ bad:true, text:'No se cargaron los alumnos.' })) }, [])
  const all = useMemo(() => students.length > 0 && selected.length === students.length, [students, selected])
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

  return <div className="space-y-5 max-w-5xl">
    <div><h1 className="page-title flex items-center gap-2"><Mail size={22}/> Enviar correos</h1>
      <p className="text-sm mt-1" style={{color:'var(--t3)'}}>El administrador confirma cada envío. Mientras Resend está pendiente, se entrega la notificación interna y se conserva el correo en cola.</p></div>
    {status && <div className="flex gap-2 rounded-xl p-3" style={{background:status.bad?'var(--bad-soft)':'var(--good-soft)',color:status.bad?'var(--bad)':'var(--good)'}}>
      {status.bad?<AlertTriangle size={16}/>:<CheckCircle2 size={16}/>}<span className="text-sm">{status.text}</span></div>}
    <form onSubmit={submit} className="grid lg:grid-cols-[300px_1fr] gap-4">
      <section className="card p-4 max-h-[65vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-3"><b className="text-sm flex gap-2"><Users size={16}/> Destinatarios</b>
          <button type="button" className="text-xs" style={{color:'var(--info)'}} onClick={()=>setSelected(all?[]:students.map(s=>s.id))}>{all?'Quitar todos':'Todos'}</button></div>
        <div className="space-y-2">{students.map(s=><label key={s.id} className="flex gap-2 items-start text-sm cursor-pointer">
          <input type="checkbox" checked={selected.includes(s.id)} onChange={()=>toggle(s.id)}/><span>{s.name}<small className="block" style={{color:'var(--t3)'}}>{s.personalEmail||s.email} · {s.tutor?.email||'Tutor sin correo'}</small></span>
        </label>)}</div>
      </section>
      <section className="card p-5 space-y-4">
        <div className="flex gap-5 text-sm"><label><input type="checkbox" checked={includeStudent} onChange={e=>setIncludeStudent(e.target.checked)}/> Alumno</label>
          <label><input type="checkbox" checked={includeTutor} onChange={e=>setIncludeTutor(e.target.checked)}/> Tutor</label></div>
        <div><label className="block text-xs font-bold mb-1">Asunto</label><input className="input-field" value={subject} onChange={e=>setSubject(e.target.value)}/></div>
        <div><label className="block text-xs font-bold mb-1">Mensaje</label><textarea className="input-field min-h-56 resize-y" value={body} onChange={e=>setBody(e.target.value)}/></div>
        <button className="btn-primary" disabled={saving}><Send size={15}/>{saving?'Guardando…':'Confirmar envío'}</button>
      </section>
    </form>
  </div>
}
