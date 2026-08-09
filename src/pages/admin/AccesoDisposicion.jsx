import { useState, useEffect, useCallback } from 'react'
import { Navigate } from 'react-router-dom'
import {
  ShieldCheck, UserPlus, ChevronDown, ChevronRight, Building2, KeyRound, X, Search,
  UserMinus, UserCheck, AlertTriangle,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import {
  fetchCuentas, createSubAdmin, fetchGroups,
  fetchSubAdminAccess, grantSubAdminAccess, revokeSubAdminAccess,
  desactivarSubAdmin, reactivarSubAdmin,
} from '../../lib/supabaseData'
import { generarPassword } from '../../lib/credentials'
import ProgressiveList from '../../components/ui/ProgressiveList'
import { NeonCheckbox } from '../../components/ui/NeonCheckbox'
import ModalPortal from '../../components/ui/ModalPortal'

// Las sucursales salen de los grupos reales; antes estaban escritas a mano
// y no reflejaban las que existen en la base.

export default function AccesoDisposicion() {
  const { currentUser } = useAuth()
  const isAdmin = currentUser?.role === 'admin'

  const [staff, setStaff]             = useState([])
  const [groups, setGroups]           = useState([])
  const [accessByUser, setAccessByUser] = useState({})
  const [loading, setLoading]         = useState(true)
  const [expanded, setExpanded]       = useState(new Set())

  // Sucursales derivadas de los grupos existentes en BD.
  const sucursales = [...new Set(groups.map(g => g.sucursal).filter(Boolean))].sort()

  const [form, setForm] = useState({ name: '', email: '' })
  const [creating, setCreating] = useState(false)
  const [createdCreds, setCreatedCreds] = useState(null)
  const [formError, setFormError] = useState(null)
  const [errorAcceso, setErrorAcceso] = useState(null)

  /* Baja y reincorporación. Ninguna de las dos se ejecuta sin pasar por el
     modal: retirar a alguien le corta la sesión en el acto y le quita todos sus
     accesos, así que no puede ser el resultado de un clic mal puesto. */
  const [confirmacion, setConfirmacion] = useState(null) // { modo, id, name, email, accesos }
  const [procesando, setProcesando]     = useState(false)
  const [aviso, setAviso]               = useState(null) // { tono: 'good'|'bad', texto }

  /* La lista pasó de seis a treinta y ocho cuentas al incluir a los alumnos:
     sin acotar no hay forma de encontrar a nadie. */
  const [rolFiltro, setRolFiltro] = useState('todos')
  const [busqueda, setBusqueda] = useState('')
  const [grupoFiltro, setGrupoFiltro] = useState('todos')

  const conteo = {
    admin:     staff.filter(a => a.role === 'admin').length,
    sub_admin: staff.filter(a => a.role === 'sub_admin').length,
    student:   staff.filter(a => a.role === 'student').length,
    retiradas: staff.filter(a => a.activo === false).length,
  }
  const filtradas = staff.filter(a => {
    const q = busqueda.trim().toLowerCase()
    const porRol = rolFiltro === 'todos'
      || (rolFiltro === 'retiradas' ? a.activo === false : a.role === rolFiltro)
    return porRol
      && (rolFiltro !== 'student' || grupoFiltro === 'todos' || a.grupoId === grupoFiltro)
      && (q === '' || a.name.toLowerCase().includes(q) || (a.email ?? '').toLowerCase().includes(q))
  })

  const refreshAccess = useCallback(async (userId) => {
    const rows = await fetchSubAdminAccess(userId)
    setAccessByUser(prev => ({ ...prev, [userId]: rows }))
  }, [])

  const loadAll = useCallback(async () => {
    setLoading(true)
    const [personal, grps] = await Promise.all([fetchCuentas(), fetchGroups()])
    setStaff(personal)
    setGroups(grps)
    // Los administradores no tienen filas de acceso: su alcance es total por
    // rol. Las cuentas retiradas tampoco: la baja se las quitó todas.
    const entries = await Promise.all(
      personal.filter(a => a.role === 'sub_admin' && a.activo !== false)
        .map(a => fetchSubAdminAccess(a.id).then(rows => [a.id, rows])))
    setAccessByUser(Object.fromEntries(entries))
    setLoading(false)
  }, [])

  useEffect(() => { if (isAdmin) loadAll() }, [isAdmin, loadAll])

  if (!isAdmin) return <Navigate to="/admin" replace />

  const toggleExpanded = (userId, sucursal) => {
    const key = `${userId}:${sucursal}`
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  const toggleWholeBranch = async (userId, sucursal) => {
    const rows = accessByUser[userId] ?? []
    const wholeRow = rows.find(r => r.sucursal === sucursal && r.groupId == null)
    setErrorAcceso(null)
    try {
      if (wholeRow) {
        await revokeSubAdminAccess(wholeRow.id)
      } else {
        const perGroupRows = rows.filter(r => r.sucursal === sucursal && r.groupId != null)
        await Promise.all(perGroupRows.map(r => revokeSubAdminAccess(r.id)))
        await grantSubAdminAccess(userId, sucursal, null)
      }
      await refreshAccess(userId)
    } catch (err) {
      setErrorAcceso(`No se pudo cambiar el acceso a ${sucursal}. ${err?.message ?? ''}`)
    }
  }

  const toggleGroup = async (userId, sucursal, groupId) => {
    const rows = accessByUser[userId] ?? []
    const wholeRow = rows.find(r => r.sucursal === sucursal && r.groupId == null)
    const groupRow = rows.find(r => r.sucursal === sucursal && r.groupId === groupId)
    setErrorAcceso(null)
    try {
      if (groupRow) {
        await revokeSubAdminAccess(groupRow.id)
      } else {
        if (wholeRow) await revokeSubAdminAccess(wholeRow.id)
        await grantSubAdminAccess(userId, sucursal, groupId)
      }
      await refreshAccess(userId)
    } catch (err) {
      setErrorAcceso(`No se pudo cambiar el acceso al grupo. ${err?.message ?? ''}`)
    }
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    setFormError(null)
    const name  = form.name.trim()
    const email = form.email.trim().toLowerCase()
    if (!name || !email) return
    setCreating(true)
    const password = generarPassword()
    const res = await createSubAdmin({ name, email, password })
    setCreating(false)
    if (!res.ok) { setFormError(res.message); return }
    setCreatedCreds({ name: res.user.name, email: res.user.email, password })
    setForm({ name: '', email: '' })
    loadAll()
  }

  /* ── Baja / reincorporación ───────────────────────────────────────────── */

  const pedirBaja = (cuenta) => {
    setAviso(null)
    setConfirmacion({
      modo: 'baja',
      id: cuenta.id, name: cuenta.name, email: cuenta.email,
      accesos: (accessByUser[cuenta.id] ?? []).length,
    })
  }

  const pedirAlta = (cuenta) => {
    setAviso(null)
    setConfirmacion({ modo: 'alta', id: cuenta.id, name: cuenta.name, email: cuenta.email })
  }

  const ejecutarConfirmacion = async () => {
    if (!confirmacion) return
    const { modo, id, name } = confirmacion
    setProcesando(true)
    const res = modo === 'baja'
      ? await desactivarSubAdmin(id)
      : await reactivarSubAdmin(id)
    setProcesando(false)
    setConfirmacion(null)

    if (!res.ok) { setAviso({ tono: 'bad', texto: res.message }); return }

    setAviso(modo === 'baja'
      ? {
          tono: 'good',
          texto: `${name} ya no puede entrar. Se le retiraron ${res.accesosRetirados} acceso(s) `
               + `y su correo quedó liberado como ${res.email}.`,
        }
      : {
          tono: 'good',
          texto: `${name} vuelve a entrar con ${res.email}. Sus accesos se conceden de nuevo aquí abajo.`,
        })
    await loadAll()
  }

  return (
    <div className="space-y-5">

      <div>
        <h1 className="page-title flex items-center gap-2"><ShieldCheck size={22}/> Acceso y Disposición</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--t3)' }}>
          Todas las cuentas con acceso a la plataforma. Los administradores ven todo, a los sub-admins se les asigna sucursal o grupos, y cada alumno ve solo lo suyo.
        </p>
      </div>

      {/* ── Crear sub-admin ─────────────────────────────────── */}
      <div className="card p-5 space-y-3">
        <h2 className="section-title flex items-center gap-2"><UserPlus size={16}/> Crear sub-admin</h2>
        <form onSubmit={handleCreate} className="flex flex-col sm:flex-row gap-2.5">
          <input type="text" placeholder="Nombre completo" value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            className="flex-1 text-sm rounded-lg py-2.5 px-3 outline-none"
            style={{ background: 'var(--soft-bg)', border: '1px solid var(--card-border)', color: 'var(--t1)' }}/>
          <input type="email" placeholder="correo@cefimat.mx" value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            className="flex-1 text-sm rounded-lg py-2.5 px-3 outline-none"
            style={{ background: 'var(--soft-bg)', border: '1px solid var(--card-border)', color: 'var(--t1)' }}/>
          <button type="submit" disabled={creating}
            className="flex items-center justify-center gap-2 text-sm font-bold px-4 py-2.5 rounded-xl transition-all active:scale-95 disabled:opacity-40"
            style={{ background:'white', color:'black' }}>
            <UserPlus size={14}/> {creating ? 'Creando…' : 'Crear'}
          </button>
        </form>
        {formError && <p className="text-xs font-semibold" style={{ color:'var(--bad)' }}>{formError}</p>}

        {createdCreds && (
          <div className="flex items-start gap-3 rounded-xl p-3.5"
            style={{ background:'var(--good-soft)', border:'1px solid var(--good-line)' }}>
            <KeyRound size={16} className="mt-0.5 flex-shrink-0" style={{ color:'var(--good)' }}/>
            <div className="flex-1 text-xs" style={{ color: 'var(--t2)' }}>
              <p className="font-bold mb-1" style={{ color:'var(--good)' }}>Sub-admin creado — guarda estas credenciales, no se mostrarán de nuevo:</p>
              <p><strong>{createdCreds.name}</strong> — {createdCreds.email}</p>
              <p>Contraseña: <span className="font-mono font-bold">{createdCreds.password}</span></p>
            </div>
            <button onClick={() => setCreatedCreds(null)} className="flex-shrink-0" style={{ color: 'var(--t3)' }}>
              <X size={14}/>
            </button>
          </div>
        )}
      </div>

      {/* ── Lista de cuentas ────────────────────────────────── */}
      <div className="card p-5 space-y-3">
        <h2 className="section-title flex items-center gap-2"><Building2 size={16}/> Cuentas y accesos</h2>

        {errorAcceso && (
          <div className="flex items-start gap-2 rounded-lg px-3 py-2"
            style={{ background:'var(--bad-soft)', border:'1px solid var(--bad-line)' }}>
            <span className="text-xs" style={{ color:'var(--bad)' }}>{errorAcceso}</span>
          </div>
        )}

        {aviso && (
          <div className="flex items-start gap-2 rounded-lg px-3 py-2"
            style={{
              background: aviso.tono === 'good' ? 'var(--good-soft)' : 'var(--bad-soft)',
              border: `1px solid ${aviso.tono === 'good' ? 'var(--good-line)' : 'var(--bad-line)'}`,
            }}>
            <span className="text-xs flex-1"
              style={{ color: aviso.tono === 'good' ? 'var(--good)' : 'var(--bad)' }}>
              {aviso.texto}
            </span>
            <button onClick={() => setAviso(null)} style={{ color:'var(--t3)' }}><X size={13}/></button>
          </div>
        )}

        {loading && <p className="text-sm" style={{ color: 'var(--t3)' }}>Cargando…</p>}

        {/* Filtros */}
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[180px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color:'var(--t4)' }}/>
            <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre o correo…" className="input-field pl-9 text-sm"/>
          </div>
          <select value={rolFiltro} onChange={e => setRolFiltro(e.target.value)}
            className="input-field text-sm w-auto">
            {[['todos', `Todos (${staff.length})`],
              ['admin', `Administradores (${conteo.admin})`],
              ['sub_admin', `Sub-admins (${conteo.sub_admin})`],
              ['student', `Alumnos (${conteo.student})`],
              ['retiradas', `Retiradas (${conteo.retiradas})`]].map(([v, l]) =>
                <option key={v} value={v}>{l}</option>)}
          </select>
          {rolFiltro === 'student' && (
            <select value={grupoFiltro} onChange={e => setGrupoFiltro(e.target.value)}
              className="input-field text-sm w-auto">
              <option value="todos">Todos los grupos</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          )}
        </div>

        <p className="text-[11px]" style={{ color:'var(--t3)' }}>
          {filtradas.length} de {staff.length} cuentas
          {conteo.retiradas > 0 && ` · ${conteo.retiradas} retirada(s)`}
        </p>

        <ProgressiveList items={filtradas} className="space-y-3"
          sizes={{ mobile: 5, tablet: 10, desktop: 15 }}
          emptyLabel="Ninguna cuenta coincide con el filtro.">
          {a => {
            const rows = accessByUser[a.id] ?? []
            const esAdmin = a.role === 'admin'
            const esAlumno = a.role === 'student'
            const retirada = a.activo === false
            return (
              <div key={a.id} className="rounded-xl p-3.5 space-y-2.5"
                style={{
                  background: 'var(--card-bg)',
                  border: '1px solid var(--divider)',
                  opacity: retirada ? 0.72 : 1,
                }}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--t1)' }}>{a.name}</p>
                    <p className="text-xs truncate" style={{ color: 'var(--t3)' }}>{a.email}</p>
                  </div>
                  <span className="badge flex-shrink-0"
                    style={retirada
                      ? { background:'var(--soft-bg)', color:'var(--t3)', border:'1px solid var(--divider)' }
                      : esAdmin
                        ? { background:'var(--good)', color:'#fff', border:'1px solid var(--good)' }
                        : esAlumno
                          ? { background:'var(--soft-bg)', color:'var(--t2)', border:'1px solid var(--divider)' }
                          : { background:'var(--info)', color:'#fff', border:'1px solid var(--info)' }}>
                    {retirada ? 'Retirada' : esAdmin ? 'Administrador' : esAlumno ? 'Alumno' : 'Sub-admin'}
                  </span>
                </div>

                {/* Una cuenta retirada no se esconde: se muestra tal cual quedó,
                    para que conste quién fue dado de baja y se pueda deshacer. */}
                {retirada ? (
                  <div className="space-y-2.5">
                    <p className="text-xs" style={{ color: 'var(--t3)' }}>
                      Sin acceso a la plataforma. No puede iniciar sesión y sus sucursales y
                      grupos le fueron retirados. Su correo original quedó libre para volver
                      a darse de alta.
                    </p>
                    <button onClick={() => pedirAlta(a)}
                      className="w-full sm:w-auto flex items-center justify-center gap-2 text-xs font-bold px-3 py-2 rounded-lg transition-all active:scale-95"
                      style={{ background:'var(--soft-bg)', border:'1px solid var(--card-border)', color:'var(--t2)' }}>
                      <UserCheck size={13}/> Reincorporar
                    </button>
                  </div>
                ) : esAdmin ? (
                  /* El alcance del administrador viene de su rol, no de filas de
                     acceso: mostrarle casillas sugeriría que se le puede recortar. */
                  <p className="text-xs" style={{ color: 'var(--t3)' }}>
                    Acceso total a todas las sucursales y grupos.
                  </p>
                ) : esAlumno ? (
                  /* El alumno sólo ve lo suyo: no hay nada que conceder ni
                     recortar, así que se muestra a qué grupo pertenece. */
                  <p className="text-xs" style={{ color: 'var(--t3)' }}>
                    {a.grupoNombre
                      ? <>Grupo <strong style={{ color:'var(--t2)' }}>{a.grupoNombre}</strong>
                          {a.sucursal ? ` · ${a.sucursal}` : ''} · sólo ve su propia información.</>
                      : 'Sin grupo asignado.'}
                  </p>
                ) : (
                <div className="space-y-1.5">
                  {sucursales.map(suc => {
                    const wholeChecked = rows.some(r => r.sucursal === suc && r.groupId == null)
                    const groupRows = rows.filter(r => r.sucursal === suc && r.groupId != null)
                    const sucGroups = groups.filter(g => g.sucursal === suc)
                    const key = `${a.id}:${suc}`
                    const isExpanded = expanded.has(key)
                    return (
                      <div key={suc} className="rounded-lg overflow-hidden"
                        style={{ background: 'var(--card-bg)', border: '1px solid var(--divider)' }}>
                        <div className="flex items-center gap-2.5 px-3 py-2">
                          <button onClick={() => toggleExpanded(a.id, suc)} style={{ color: 'var(--t3)' }}>
                            {isExpanded ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
                          </button>
                          <NeonCheckbox className="flex-1"
                            checked={wholeChecked}
                            onChange={() => toggleWholeBranch(a.id, suc)}
                            label={<>
                              {suc}
                              {wholeChecked && <span className="text-xs font-normal" style={{ color:'var(--good)' }}> · toda la sucursal</span>}
                              {!wholeChecked && groupRows.length > 0 && (
                                <span className="text-xs font-normal" style={{ color:'var(--warn)' }}> · {groupRows.length} grupo(s)</span>
                              )}
                            </>}/>
                        </div>
                        {isExpanded && (
                          <div className="px-3 pb-2.5 pl-9 space-y-1.5">
                            {sucGroups.length === 0 && (
                              <p className="text-xs" style={{ color: 'var(--t3)' }}>Sin grupos en esta sucursal.</p>
                            )}
                            {sucGroups.map(g => {
                              const checked = wholeChecked || groupRows.some(r => r.groupId === g.id)
                              return (
                                <NeonCheckbox key={g.id}
                                  checked={checked}
                                  onChange={() => toggleGroup(a.id, suc, g.id)}
                                  label={<span className="text-xs font-normal">{g.name} — {g.subject}</span>}/>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}

                  {/* La baja va al final y en tono de peligro: es la única acción
                      de esta tarjeta que no se deshace con otro clic. */}
                  <button onClick={() => pedirBaja(a)}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 text-xs font-bold px-3 py-2 rounded-lg transition-all active:scale-95 mt-1"
                    style={{ background:'var(--bad-soft)', border:'1px solid var(--bad-line)', color:'var(--bad)' }}>
                    <UserMinus size={13}/> Dar de baja
                  </button>
                </div>
                )}
              </div>
            )
          }}
        </ProgressiveList>
      </div>

      {/* ── Confirmación ───────────────────────────────────── */}
      {confirmacion && (
        <ModalPortal maxWidth="max-w-sm" onClose={() => !procesando && setConfirmacion(null)}>
          <div className="p-6 space-y-4">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center mx-auto"
              style={confirmacion.modo === 'baja'
                ? { background:'var(--bad-soft)', border:'1px solid var(--bad-line)' }
                : { background:'var(--good-soft)', border:'1px solid var(--good-line)' }}>
              {confirmacion.modo === 'baja'
                ? <AlertTriangle size={20} style={{ color:'var(--bad)' }}/>
                : <UserCheck size={20} style={{ color:'var(--good)' }}/>}
            </div>

            <div className="text-center">
              <h2 className="text-base font-bold mb-1" style={{ color: 'var(--t1)' }}>
                {confirmacion.modo === 'baja' ? '¿Dar de baja a este sub-admin?' : '¿Reincorporar esta cuenta?'}
              </h2>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--t2)' }}>
                <strong style={{ color: 'var(--t1)' }}>{confirmacion.name}</strong>
                {' — '}{confirmacion.email}
              </p>
            </div>

            <ul className="text-xs space-y-1.5 rounded-xl p-3" style={{ background:'var(--soft-bg)', color:'var(--t2)' }}>
              {confirmacion.modo === 'baja' ? <>
                <li>· Deja de poder iniciar sesión de inmediato y se cierra su sesión abierta.</li>
                <li>· Se le retiran sus {confirmacion.accesos} acceso(s) de sucursal o grupo.</li>
                <li>· Su correo queda libre para darlo de alta de nuevo.</li>
                <li>· La cuenta no se borra: seguirá aquí como retirada y podrás reincorporarla.</li>
              </> : <>
                <li>· Vuelve a poder iniciar sesión con su correo y contraseña originales.</li>
                <li>· Sus accesos NO regresan: hay que concedérselos otra vez.</li>
              </>}
            </ul>

            <div className="flex gap-3">
              <button onClick={() => setConfirmacion(null)} disabled={procesando}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-40"
                style={{ background: 'var(--soft-bg)', color: 'var(--t2)' }}>
                Cancelar
              </button>
              <button onClick={ejecutarConfirmacion} disabled={procesando}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-40"
                style={confirmacion.modo === 'baja'
                  ? { background:'var(--bad-soft)', border:'1px solid var(--bad-line)', color:'var(--bad)' }
                  : { background:'var(--good-soft)', border:'1px solid var(--good-line)', color:'var(--good)' }}>
                {procesando
                  ? 'Aplicando…'
                  : confirmacion.modo === 'baja' ? 'Sí, dar de baja' : 'Sí, reincorporar'}
              </button>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  )
}
