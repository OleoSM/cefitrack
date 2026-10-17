import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, Plus, Save, AlertCircle, RefreshCw, Eye, EyeOff, Building2, Wallet } from 'lucide-react'
import { altaAlumnoConPago, updateStudent } from '../../lib/supabaseData'
import { METODOS, METODO_LABEL } from '../../lib/pagosData'
import { useAuth } from '../../context/AuthContext'
import { NeonCheckbox } from '../ui/NeonCheckbox'
import { todayISO } from '../../lib/fecha'
import { generarPassword, generarUsuario, DOMINIO_CORREO } from '../../lib/credentials'
import { useSucursales } from '../../hooks/useSucursales'
import { areasParaInstituciones } from '../../lib/areas'
import ModalPortal from '../ui/ModalPortal'

/**
 * Alta y edición de alumnos. En el alta se crea también su cuenta de acceso:
 * el usuario ES el correo (así funciona el login) y la contraseña se puede
 * escribir a mano o generar.
 *
 * Alta obligatoria con pago: no se puede crear un alumno sin su plan de pago
 * y su primer importe (todo se guarda junto en el servidor). Después lleva a
 * Pagos con el alumno abierto, si quien da el alta tiene ese apartado.
 */
export default function StudentFormModal({
  student = null, groups, defaultGroupId = null, onClose, onSaved,
}) {
  const editing = !!student
  const navigate = useNavigate()
  const { puedeVer } = useAuth()
  const hoyMes = todayISO().slice(0, 7)   // mes actual en hora de México
  const [pago, setPago] = useState({ total: '', modalidad: 'mensualidades', mensualidades: '6', inicio: hoyMes,
    monto: '', metodo: 'efectivo', esInscripcion: false, referencia: '' })
  const setP = (k, v) => setPago(p => ({ ...p, [k]: v }))
  const { sucursales: catalogoSucursales, nombreDe } = useSucursales()

  /* El alumno pertenece a la sucursal DE SU GRUPO: `sucursal` no se elige, se
     deriva. Este filtro existe sólo para acotar la lista de grupos, que con
     todas las sedes abiertas es demasiado larga para encontrar el correcto. */
  const [sucursalFiltro, setSucursalFiltro] = useState(() => {
    const inicial = student?.groupId ?? defaultGroupId
    return groups.find(g => g.id === inicial)?.sucursal ?? 'todas'
  })
  const [cursoFiltro, setCursoFiltro] = useState(() => {
    const inicial = student?.groupId ?? defaultGroupId
    return groups.find(g => g.id === inicial)?.curso ?? 'ecoems'
  })

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

      const pagoListo = {
        total: Number(pago.total), modalidad: pago.modalidad,
        mensualidades: pago.modalidad === 'contado' ? 1 : Number(pago.mensualidades) || 1,
        inicio: pago.inicio ? `${pago.inicio}-01` : null, monto: Number(pago.monto),
        metodo: pago.metodo, esInscripcion: pago.esInscripcion, referencia: pago.referencia.trim(),
      }
      if (!editing) {
        if (pago.total === '' || !(pagoListo.total >= 0)) { setError('Escribe el total del curso (0 si es beca completa).'); return }
        if (pago.monto === '' || (pagoListo.total > 0 && !(pagoListo.monto > 0))) { setError('Registra el primer importe: es obligatorio para dar de alta.'); return }
      }

      const res = editing
        ? await updateStudent({ id: student.id, name: form.name, email: form.email, groupId: form.groupId, tutor, sucursal, ...extra })
        : await altaAlumnoConPago({ name: form.name, email: form.email, groupId: form.groupId, password: form.password, tutor, sucursal, ...extra, pago: pagoListo })

      if (!res.ok) { setError(res.message); return }
      const cred = editing ? null : { nombre: form.name, usuario: form.email, password: form.password }
      // Tras el alta, a Pagos con el alumno abierto (las credenciales se muestran allá).
      if (!editing && puedeVer('pagos') && res.student?.id) {
        await onSaved?.(null)
        onClose()
        navigate('/admin/pagos', { state: { abrirAlumno: res.student.id, cred } })
        return
      }
      await onSaved?.(cred)
      onClose()
    } catch (err) {
      setError(err?.message || 'No fue posible guardar el alumno. Intenta nuevamente.')
    } finally {
      setSaving(false)
    }
  }

  const gruposVisibles = groups.filter(g =>
    g.curso === cursoFiltro && (sucursalFiltro === 'todas' || g.sucursal === sucursalFiltro))
  const grupoElegido = groups.find(g => g.id === form.groupId) ?? null
  const areasDisponibles = areasParaInstituciones(grupoElegido?.instituciones ?? [])

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
          style={{ borderBottom: '1px solid var(--divider)', background:'var(--panel-bg)' }}>
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

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{color:'var(--t3)'}}>Curso</label>
            <div className="grid grid-cols-2 gap-2">
              {[['ecoems','ECOEMS'],['universidad','Universidad']].map(([id,label]) => (
                <button key={id} type="button" onClick={() => {
                  setCursoFiltro(id)
                  if (groups.find(g => g.id === form.groupId)?.curso !== id) set('groupId','')
                  if (id === 'ecoems') set('universidadArea','')
                }} className="min-h-11 rounded-xl text-xs font-bold"
                  style={{background:cursoFiltro===id?'var(--accent)':'var(--soft-bg)',color:cursoFiltro===id?'var(--accent-contrast)':'var(--t2)',border:'1px solid var(--card-border)'}}>
                  {label}
                </button>
              ))}
            </div>
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5"
                style={{ color: 'var(--t3)' }}>Sucursal</label>
              <select value={sucursalFiltro} className="input-field"
                onChange={e => {
                  const suc = e.target.value
                  setSucursalFiltro(suc)
                  // Si el grupo elegido es de otra sede, deja de ser válido.
                  if (suc !== 'todas' && groups.find(g => g.id === form.groupId)?.sucursal !== suc) set('groupId', '')
                }}>
                <option value="todas">Todas las sucursales</option>
                {catalogoSucursales.map(x => <option key={x.id} value={x.id}>{x.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5"
                style={{ color: 'var(--t3)' }}>Grupo</label>
              {/* Sin grupo el alumno no aparecería en ninguna lista filtrada, así que es obligatorio. */}
              <select required value={form.groupId} onChange={e => set('groupId', e.target.value)} className="input-field">
                <option value="">Seleccionar grupo…</option>
                {gruposVisibles.map(g => <option key={g.id} value={g.id}>{g.name} — {g.subject}</option>)}
              </select>
            </div>
          </div>

          {grupoElegido && (
            <p className="flex items-center gap-1.5 text-[10px] -mt-1" style={{ color:'var(--t4)' }}>
              <Building2 size={11}/>
              El alumno queda registrado en <strong style={{ color:'var(--t3)' }}>
                {grupoElegido.sucursal ? nombreDe(grupoElegido.sucursal) : 'la sucursal del grupo'}
              </strong>, la sucursal de {grupoElegido.name}.
            </p>
          )}

          {grupoElegido?.curso === 'universidad' && <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{color:'var(--t3)'}}>Área universitaria</label>
            <select required value={form.universidadArea} onChange={e=>set('universidadArea',e.target.value)} className="input-field">
              <option value="">Seleccionar área…</option>
              {areasDisponibles.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
            </select>
          </div>}

          {/* Pago inicial: obligatorio en el alta. */}
          {!editing && (
            <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--soft-bg)', border: '1px solid var(--card-border)' }}>
              <p className="flex items-center gap-2 text-xs font-bold" style={{ color: 'var(--t1)' }}>
                <Wallet size={14} style={{ color: 'var(--accent)' }}/> Pago inicial <span style={{ color: 'var(--bad)' }}>· obligatorio</span>
              </p>
              <p className="text-[11px] -mt-1" style={{ color: 'var(--t3)' }}>
                No se puede dar de alta a un alumno sin registrar su plan de pago y su primer importe.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--t3)' }}>Total del curso ($)</span>
                  <input required type="number" min="0" step="0.01" inputMode="decimal" value={pago.total}
                    onChange={e => setP('total', e.target.value)} className="input-field" placeholder="Ej. 9000"/>
                </label>
                <label className="block">
                  <span className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--t3)' }}>Modalidad</span>
                  <select value={pago.modalidad} onChange={e => setP('modalidad', e.target.value)} className="input-field">
                    <option value="mensualidades">Mensualidades</option>
                    <option value="contado">Contado</option>
                  </select>
                </label>
                {pago.modalidad === 'mensualidades' && (
                  <label className="block">
                    <span className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--t3)' }}>Número de mensualidades</span>
                    <input type="number" min="1" max="24" value={pago.mensualidades} onChange={e => setP('mensualidades', e.target.value)} className="input-field"/>
                  </label>
                )}
                <label className="block">
                  <span className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--t3)' }}>Mes de inicio</span>
                  <input type="month" value={pago.inicio} onChange={e => setP('inicio', e.target.value)} className="input-field"/>
                </label>
                <label className="block">
                  <span className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--t3)' }}>Primer importe ($)</span>
                  <input required type="number" min="0" step="0.01" inputMode="decimal" value={pago.monto}
                    onChange={e => setP('monto', e.target.value)} className="input-field" placeholder="Ej. 1500"/>
                </label>
                <label className="block">
                  <span className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--t3)' }}>Forma de pago</span>
                  <select value={pago.metodo} onChange={e => setP('metodo', e.target.value)} className="input-field">
                    {METODOS.map(m => <option key={m} value={m}>{METODO_LABEL[m]}</option>)}
                  </select>
                </label>
              </div>
              <NeonCheckbox checked={pago.esInscripcion} onChange={e => setP('esInscripcion', e.target.checked)}
                label={<span className="text-xs" style={{ color: 'var(--t1)' }}>Este primer importe es la inscripción (no cuenta como mensualidad)</span>}/>
              <label className="block">
                <span className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--t3)' }}>Referencia (opcional)</span>
                <input value={pago.referencia} onChange={e => setP('referencia', e.target.value)} className="input-field" placeholder="Folio, número de transferencia…"/>
              </label>
            </div>
          )}

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
              <AlertCircle size={13} className="mt-0.5 shrink-0" style={{ color:'var(--bad)' }}/>
              <span className="text-xs" style={{ color:'var(--bad)' }}>{error}</span>
            </div>
          )}

          <div className="sticky bottom-0 -mx-6 -mb-6 px-6 py-4 flex flex-col-reverse sm:flex-row gap-3"
            style={{background:'var(--panel-bg)',borderTop:'1px solid var(--divider)'}}>
            <button type="button" onClick={onClose} disabled={saving} className="btn-secondary min-h-11 flex-1 justify-center disabled:opacity-40">Cancelar</button>
            <button type="submit" disabled={saving} className="btn-primary min-h-11 flex-1 justify-center">
              {editing ? <Save size={14}/> : <Plus size={14}/>}
              {saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear alumno y registrar pago'}
            </button>
          </div>
        </form>
    </ModalPortal>
  )
}
