import { useState } from 'react'
import { X, Plus, Save, AlertCircle, RefreshCw, Eye, EyeOff } from 'lucide-react'
import { createStudent, updateStudent } from '../../lib/supabaseData'
import { generarPassword, generarUsuario, DOMINIO_CORREO } from '../../lib/credentials'
import ModalPortal from '../ui/ModalPortal'

/**
 * Alta y edición de alumnos. En el alta se crea también su cuenta de acceso:
 * el usuario ES el correo (así funciona el login) y la contraseña se puede
 * escribir a mano o generar.
 */
export default function StudentFormModal({
  student = null, groups, defaultGroupId = null, onClose, onSaved,
}) {
  const editing = !!student

  const [form, setForm] = useState({
    name:        student?.name ?? '',
    email:       student?.email ?? '',
    personalEmail: student?.personalEmail ?? '',
    whatsapp:    student?.whatsapp ?? '',
    password:    editing ? '' : generarPassword(),
    groupId:     student?.groupId ?? defaultGroupId ?? (groups[0]?.id ?? ''),
    tutorName:   student?.tutor?.name ?? '',
    tutorEmail:  student?.tutor?.email ?? '',
    tutorPhone:  student?.tutor?.phone ?? '',
    tutorWhatsapp: student?.tutor?.whatsapp ?? student?.tutor?.phone ?? '',
    universidadArea: student?.universidadArea ?? '',
  })
  const [showPass, setShowPass] = useState(true)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState(null)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // Sugiere el correo a partir del nombre mientras no se haya escrito uno.
  const sugerirCorreo = () => {
    if (editing || form.email.trim() || !form.name.trim()) return
    set('email', `${generarUsuario(form.name)}@${DOMINIO_CORREO}`)
  }

  const handleSubmit = async e => {
    e.preventDefault()
    setSaving(true); setError(null)
    try {
      const sucursal = groups.find(g => g.id === form.groupId)?.sucursal ?? null
      const selectedGroup = groups.find(g => g.id === form.groupId)
      const tutor = { name: form.tutorName || null, email: form.tutorEmail || null, phone: form.tutorPhone || null, whatsapp: form.tutorWhatsapp || null }
      const extra = { personalEmail:form.personalEmail || null, whatsapp:form.whatsapp || null,
        universidadArea:selectedGroup?.curso === 'universidad' ? Number(form.universidadArea)||null : null }

      const res = editing
        ? await updateStudent({ id: student.id, name: form.name, email: form.email, groupId: form.groupId, tutor, sucursal, ...extra })
        : await createStudent({ name: form.name, email: form.email, groupId: form.groupId, password: form.password, tutor, sucursal, ...extra })

      if (!res.ok) { setError(res.message); return }
      await onSaved?.(editing ? null : { nombre: form.name, usuario: form.email, password: form.password })
      onClose()
    } catch (err) {
      setError(err?.message || 'No fue posible guardar el alumno. Intenta nuevamente.')
    } finally {
      setSaving(false)
    }
  }

  const campo = (label, key, props = {}) => (
    <div>
      <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5"
        style={{ color: 'var(--t3)' }}>{label}</label>
      <input value={form[key]} onChange={e => set(key, e.target.value)} className="input-field" {...props}/>
    </div>
  )

  return (
    <ModalPortal onClose={saving ? undefined : onClose} maxWidth="max-w-lg" scrollable>
        <div className="flex items-center justify-between px-6 py-4 sticky top-0 z-10"
          style={{ borderBottom: '1px solid var(--card-border)', background:'var(--card-bg)' }}>
          <h2 className="text-sm font-bold" style={{ color: 'var(--t1)' }}>
            {editing ? `Editar alumno — ${student.name}` : 'Nuevo Alumno'}
          </h2>
          <button type="button" onClick={onClose} disabled={saving} aria-label="Cerrar formulario"
            className="w-11 h-11 flex items-center justify-center rounded-lg transition-colors disabled:opacity-40"
            style={{ color: 'var(--t3)' }}
            onMouseEnter={e => e.currentTarget.style.color='var(--t1)'}
            onMouseLeave={e => e.currentTarget.style.color='var(--t3)'}>
            <X size={15}/>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {campo('Nombre completo', 'name', { required:true, placeholder:'Ej. Ana García López', onBlur: sugerirCorreo })}

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5"
              style={{ color: 'var(--t3)' }}>Usuario (correo de acceso)</label>
            <input required type="email" value={form.email} onChange={e => set('email', e.target.value)}
              placeholder={`ana.garcia@${DOMINIO_CORREO}`} className="input-field"/>
            <p className="text-[10px] mt-1" style={{ color: 'var(--t4)' }}>
              Con este correo inicia sesión el alumno.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {campo('Correo personal', 'personalEmail', { type:'email', placeholder:'alumno@gmail.com' })}
            {campo('WhatsApp del alumno', 'whatsapp', { type:'tel', placeholder:'55 0000 0000' })}
          </div>

          {!editing && (
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5"
                style={{ color: 'var(--t3)' }}>Contraseña</label>
              <div className="flex flex-wrap sm:flex-nowrap gap-2">
                <input required type={showPass ? 'text' : 'password'} value={form.password}
                  onChange={e => set('password', e.target.value)} className="input-field flex-[1_1_180px] min-w-0 font-mono"/>
                <button type="button" onClick={() => setShowPass(v => !v)} title="Mostrar/ocultar"
                  className="btn-secondary min-w-11 min-h-11 px-3">
                  {showPass ? <EyeOff size={14}/> : <Eye size={14}/>}
                </button>
                <button type="button" onClick={() => set('password', generarPassword())} title="Generar otra"
                  className="btn-secondary min-w-11 min-h-11 px-3">
                  <RefreshCw size={14}/>
                </button>
              </div>
              <p className="text-[10px] mt-1" style={{ color: 'var(--t4)' }}>
                Anótala antes de guardar: después se almacena cifrada y ya no puede consultarse.
              </p>
            </div>
          )}

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5"
              style={{ color: 'var(--t3)' }}>Grupo</label>
            {/* Sin grupo el alumno no aparecería en ninguna lista filtrada, así que es obligatorio. */}
            <select required value={form.groupId} onChange={e => set('groupId', e.target.value)} className="input-field">
              <option value="">Seleccionar grupo…</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.name} — {g.subject}</option>)}
            </select>
          </div>

          {groups.find(g=>g.id===form.groupId)?.curso === 'universidad' && <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{color:'var(--t3)'}}>Área universitaria</label>
            <select required value={form.universidadArea} onChange={e=>set('universidadArea',e.target.value)} className="input-field">
              <option value="">Seleccionar área…</option>{[1,2,3,4].map(n=><option key={n} value={n}>Área {n}</option>)}
            </select>
          </div>}

          <div className="pt-2" style={{ borderTop: '1px solid var(--divider)' }}>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-3 mt-2"
              style={{ color: 'var(--t4)' }}>Contacto del tutor (opcional)</p>
            <div className="space-y-3">
              {campo('Nombre del tutor', 'tutorName', { placeholder:'Ej. Carmen López' })}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {campo('Correo', 'tutorEmail', { type:'email', placeholder:'carmen@gmail.com' })}
                {campo('Teléfono', 'tutorPhone', { placeholder:'555-0101' })}
              </div>
              {campo('WhatsApp del tutor', 'tutorWhatsapp', { type:'tel', placeholder:'55 0000 0000' })}
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg px-3 py-2"
              style={{ background:'var(--bad-soft)', border:'1px solid var(--bad-line)' }}>
              <AlertCircle size={13} className="mt-0.5 shrink-0 text-red-400"/>
              <span className="text-xs text-red-400">{error}</span>
            </div>
          )}

          <div className="sticky bottom-0 -mx-6 -mb-6 px-6 py-4 flex flex-col-reverse sm:flex-row gap-3"
            style={{background:'var(--panel-bg)',borderTop:'1px solid var(--divider)'}}>
            <button type="button" onClick={onClose} disabled={saving} className="btn-secondary min-h-11 flex-1 justify-center disabled:opacity-40">Cancelar</button>
            <button type="submit" disabled={saving} className="btn-primary min-h-11 flex-1 justify-center">
              {editing ? <Save size={14}/> : <Plus size={14}/>}
              {saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear alumno'}
            </button>
          </div>
        </form>
    </ModalPortal>
  )
}
