import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, Plus, Save, AlertCircle, RefreshCw, Eye, EyeOff, Building2, Wallet, Flag, ListPlus, Download, Copy, Check } from 'lucide-react'
import { altaAlumnoConPago, updateStudent } from '../../lib/supabaseData'
import { METODOS, METODO_LABEL } from '../../lib/pagosData'
import { useAuth } from '../../context/AuthContext'
import { NeonCheckbox } from '../ui/NeonCheckbox'
import { todayISO } from '../../lib/fecha'
import { generarPassword, generarUsuario, DOMINIO_CORREO, exportCredencialesExcel } from '../../lib/credentials'
import { useSucursales } from '../../hooks/useSucursales'
import { areasParaInstituciones } from '../../lib/areas'
import ModalPortal from '../ui/ModalPortal'

/**
 * Alta y edición de alumnos. En el alta se crea también su cuenta de acceso:
 * el usuario ES el correo (así funciona el login) y la contraseña se puede
 * escribir a mano o generar.
 *
 * El pago inicial es opcional: si no se registra importe se avisa (hay que
 * confirmar con un segundo clic) y el alumno queda marcado "sin pagos" en la
 * lista. Su cuenta se crea igual y puede entrar. Lo que sí se captura se guarda
 * junto en el servidor. Después lleva a Pagos con el alumno abierto, si quien
 * da el alta tiene ese apartado.
 *
 * Modo tanda ("Seguir añadiendo"): tras cada alta el formulario se limpia
 * (conserva grupo y sucursal), no se va a Pagos y el alumno se suma a una
 * lista con sus credenciales, que se descarga en Excel al terminar.
 */
const CLAVE_TANDA = 'siga_alta_seguir_anadiendo'
const PAGO_VACIO = mes => ({ total: '', modalidad: 'mensualidades', mensualidades: '6', inicio: mes,
  monto: '', metodo: 'efectivo', esInscripcion: false, referencia: '' })
export default function StudentFormModal({
  student = null, groups, defaultGroupId = null, onClose, onSaved,
}) {
  const editing = !!student
  const navigate = useNavigate()
  const { puedeVer } = useAuth()
  const hoyMes = todayISO().slice(0, 7)   // mes actual en hora de México
  const [pago, setPago] = useState(() => PAGO_VACIO(hoyMes))
  const setP = (k, v) => { setPago(p => ({ ...p, [k]: v })); setAvisoSinPago(false) }
  // Alta sin importe: el primer clic avisa, el segundo confirma.
  const [avisoSinPago, setAvisoSinPago] = useState(false)
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
  const [seguir, setSeguirState] = useState(() => {
    try { return localStorage.getItem(CLAVE_TANDA) === '1' } catch { return false }
  })
  const setSeguir = v => {
    setSeguirState(v)
    try { localStorage.setItem(CLAVE_TANDA, v ? '1' : '0') } catch { /* sin storage */ }
  }
  const [tanda, setTanda] = useState([])          // altas de esta tanda: { nombre, grupo, usuario, password, sinPago }
  const [copiado, setCopiado] = useState(false)
  const [showPass, setShowPass] = useState(true)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState(null)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // Descargar es opcional: las credenciales se consultan después en Acceso y Disposición.
  const cerrar = () => { if (!saving) onClose() }
  const descargarTanda = () => exportCredencialesExcel([...tanda].reverse(), `Credenciales_alta_${todayISO()}`)
  const copiarTanda = () => {
    navigator.clipboard?.writeText([...tanda].reverse()
      .map(t => `${t.nombre}\nUsuario: ${t.usuario}\nContraseña: ${t.password}`).join('\n\n'))
    setCopiado(true); setTimeout(() => setCopiado(false), 1800)
  }

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

      const conTotal = pago.total !== ''
      const conMonto = Number(pago.monto) > 0
      const pagoListo = conTotal ? {
        total: Number(pago.total), modalidad: pago.modalidad,
        mensualidades: pago.modalidad === 'contado' ? 1 : Number(pago.mensualidades) || 1,
        inicio: pago.inicio ? `${pago.inicio}-01` : null, monto: conMonto ? Number(pago.monto) : null,
        metodo: pago.metodo, esInscripcion: pago.esInscripcion, referencia: pago.referencia.trim(),
      } : null
      if (!editing) {
        if (conTotal && !(pagoListo.total >= 0)) { setError('El total del curso no es válido.'); return }
        if (conMonto && !conTotal) { setError('Para registrar el primer importe escribe también el total del curso.'); return }
        if (!conMonto && !avisoSinPago) { setAvisoSinPago(true); return }
      }

      const res = editing
        ? await updateStudent({ id: student.id, name: form.name, email: form.email, groupId: form.groupId, tutor, sucursal, ...extra })
        : await altaAlumnoConPago({ name: form.name, email: form.email, groupId: form.groupId, password: form.password, tutor, sucursal, ...extra, pago: pagoListo })

      if (!res.ok) { setError(res.message); return }
      const cred = editing ? null : { nombre: form.name, usuario: form.email, password: form.password }
      if (!editing && seguir) {
        setTanda(t => [{ ...cred, grupo: selectedGroup?.name ?? '', sinPago: !conMonto }, ...t])
        setAvisoSinPago(false)
        setPago(PAGO_VACIO(hoyMes))
        setForm(f => ({ ...f, name: '', email: '', personalEmail: '', whatsapp: '', password: generarPassword(),
          tutorName: '', tutorEmail: '', tutorPhone: '', tutorWhatsapp: '', universidadArea: '' }))
        await onSaved?.(null)
        return
      }
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
    <ModalPortal onClose={saving ? undefined : cerrar} maxWidth="max-w-lg" scrollable>
        <div className="flex items-center justify-between px-6 py-4 sticky top-0 z-10"
          style={{ borderBottom: '1px solid var(--divider)', background:'var(--panel-bg)' }}>
          <h2 className="text-sm font-bold" style={{ color: 'var(--t1)' }}>
            {editing ? `Editar alumno — ${student.name}` : 'Nuevo Alumno'}
          </h2>
          <button type="button" onClick={cerrar} disabled={saving} aria-label="Cerrar formulario"
            className="w-11 h-11 flex items-center justify-center rounded-lg transition-colors disabled:opacity-40"
            style={{ color: 'var(--t3)' }}
            onMouseEnter={e => e.currentTarget.style.color='var(--t1)'}
            onMouseLeave={e => e.currentTarget.style.color='var(--t3)'}>
            <X size={15}/>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {!editing && (
            <NeonCheckbox checked={seguir} onChange={e => setSeguir(e.target.checked)}
              label={<span className="text-xs" style={{ color: 'var(--t1)' }}>
                <strong>Seguir añadiendo:</strong> al guardar, limpia el formulario para el siguiente alumno (sin ir a Pagos)
              </span>}/>
          )}

          {tanda.length > 0 && (
            <div className="rounded-xl p-3 space-y-2" style={{ background: 'var(--good-soft)', border: '1px solid var(--good-line)' }}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-2 text-xs font-bold" style={{ color: 'var(--t1)' }}>
                  <ListPlus size={14} style={{ color: 'var(--good)' }}/> Añadidos en esta tanda: {tanda.length}
                </p>
                <div className="flex gap-2">
                  <button type="button" onClick={copiarTanda} className="btn-secondary min-h-9 text-xs py-1">
                    {copiado ? <><Check size={12}/> Copiado</> : <><Copy size={12}/> Copiar</>}
                  </button>
                  <button type="button" onClick={descargarTanda} className="btn-secondary min-h-9 text-xs py-1">
                    <Download size={12}/> Excel
                  </button>
                </div>
              </div>
              <ul className="max-h-40 overflow-y-auto space-y-1">
                {tanda.map(t => (
                  <li key={t.usuario} className="flex flex-wrap items-center gap-x-2 text-[11px]" style={{ color: 'var(--t2)' }}>
                    {t.sinPago && <Flag size={11} aria-label="Sin pagos" style={{ color: 'var(--bad)' }}/>}
                    <span className="font-semibold" style={{ color: 'var(--t1)' }}>{t.nombre}</span>
                    <span className="font-mono break-all">{t.usuario}</span>
                    <span className="font-mono font-bold" style={{ color: 'var(--warn)' }}>{t.password}</span>
                  </li>
                ))}
              </ul>
              <p className="text-[10px]" style={{ color: 'var(--t3)' }}>
                Descargarlas es opcional: también puedes consultarlas después en Acceso y Disposición.
              </p>
            </div>
          )}

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
                Podrás consultarla después en Acceso y Disposición.
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

          {/* La matrícula se asigna sola al dar de alta y no cambia nunca. */}
          {editing ? (
            <div className="rounded-xl px-3 py-2.5 text-xs space-y-1" style={{ background:'var(--soft-bg)', border:'1px solid var(--card-border)', color:'var(--t2)' }}>
              <p>Matrícula <strong className="font-mono" style={{ color:'var(--t1)' }}>{student.matricula ?? '—'}</strong> · se conserva aunque cambies su grupo o sucursal.</p>
              {form.groupId && form.groupId !== student.groupId && (
                <p style={{ color:'var(--t3)' }}>
                  Al cambiarlo de grupo, su promedio se calcula con la hoja del grupo nuevo. Sus calificaciones y asistencias
                  del grupo anterior quedan guardadas y vuelven a aparecer si regresa.
                </p>
              )}
            </div>
          ) : (
            <p className="text-[10px]" style={{ color:'var(--t4)' }}>La matrícula (4 dígitos) se asigna automáticamente al guardar.</p>
          )}

          {grupoElegido?.curso === 'universidad' && <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{color:'var(--t3)'}}>Área universitaria <span style={{textTransform:'none',letterSpacing:0,fontWeight:500}}>(opcional)</span></label>
            {/* Opcional (pedido 2026-11-08): se puede asignar después, al editar o en Registrar. */}
            <select value={form.universidadArea} onChange={e=>set('universidadArea',e.target.value)} className="input-field">
              <option value="">Sin área por ahora</option>
              {areasDisponibles.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
            </select>
          </div>}

          {/* Pago inicial: opcional en el alta. */}
          {!editing && (
            <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--soft-bg)', border: '1px solid var(--card-border)' }}>
              <p className="flex items-center gap-2 text-xs font-bold" style={{ color: 'var(--t1)' }}>
                <Wallet size={14} style={{ color: 'var(--accent)' }}/> Pago inicial <span style={{ color: 'var(--t3)' }}>· opcional</span>
              </p>
              <p className="text-[11px] -mt-1" style={{ color: 'var(--t3)' }}>
                Si aún no paga, déjalo vacío: el alumno puede entrar igual y queda marcado como "sin pagos" en la lista.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--t3)' }}>Total del curso ($)</span>
                  <input type="number" min="0" step="0.01" inputMode="decimal" value={pago.total}
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
                  <input type="number" min="0" step="0.01" inputMode="decimal" value={pago.monto}
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


          {avisoSinPago && !error && (
            <div role="alert" className="flex items-start gap-2 rounded-lg px-3 py-2"
              style={{ background:'var(--warn-soft)', border:'1px solid var(--warn-line)' }}>
              <Flag size={13} className="mt-0.5 shrink-0" style={{ color:'var(--warn)' }}/>
              <span className="text-xs" style={{ color:'var(--t1)' }}>
                No registraste ningún pago. El alumno podrá entrar a SIGA, pero quedará marcado como <strong>sin pagos</strong> hasta
                que registres uno en Pagos. Pulsa de nuevo para darlo de alta así.
              </span>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-lg px-3 py-2"
              style={{ background:'var(--bad-soft)', border:'1px solid var(--bad-line)' }}>
              <AlertCircle size={13} className="mt-0.5 shrink-0" style={{ color:'var(--bad)' }}/>
              <span className="text-xs" style={{ color:'var(--bad)' }}>{error}</span>
            </div>
          )}

          <div className="sticky bottom-0 -mx-6 -mb-6 px-6 py-4 flex flex-col-reverse sm:flex-row gap-3"
            style={{background:'var(--panel-bg)',borderTop:'1px solid var(--divider)'}}>
            <button type="button" onClick={cerrar} disabled={saving} className="btn-secondary min-h-11 flex-1 justify-center disabled:opacity-40">{tanda.length ? 'Terminar' : 'Cancelar'}</button>
            <button type="submit" disabled={saving} className="btn-primary min-h-11 flex-1 justify-center">
              {editing ? <Save size={14}/> : <Plus size={14}/>}
              {saving ? 'Guardando…' : editing ? 'Guardar cambios'
                : Number(pago.monto) > 0 ? 'Crear alumno y registrar pago'
                : avisoSinPago ? 'Crear sin pago de todos modos' : 'Crear alumno'}
            </button>
          </div>
        </form>
    </ModalPortal>
  )
}
