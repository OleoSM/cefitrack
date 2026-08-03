import { useState, useEffect, useCallback } from 'react'
import { Navigate } from 'react-router-dom'
import {
  ShieldCheck, UserPlus, ChevronDown, ChevronRight, Building2, KeyRound, CheckCircle2, X, Search,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import {
  fetchCuentas, createSubAdmin, fetchGroups,
  fetchSubAdminAccess, grantSubAdminAccess, revokeSubAdminAccess,
} from '../../lib/supabaseData'
import { generarPassword } from '../../lib/credentials'
import ProgressiveList from '../../components/ui/ProgressiveList'

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

  /* La lista pasó de seis a treinta y ocho cuentas al incluir a los alumnos:
     sin acotar no hay forma de encontrar a nadie. */
  const [rolFiltro, setRolFiltro] = useState('todos')
  const [busqueda, setBusqueda] = useState('')
  const [grupoFiltro, setGrupoFiltro] = useState('todos')

  const conteo = {
    admin:     staff.filter(a => a.role === 'admin').length,
    sub_admin: staff.filter(a => a.role === 'sub_admin').length,
    student:   staff.filter(a => a.role === 'student').length,
  }
  const filtradas = staff.filter(a => {
    const q = busqueda.trim().toLowerCase()
    return (rolFiltro === 'todos' || a.role === rolFiltro)
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
    // Los administradores no tienen filas de acceso: su alcance es total por rol.
    const entries = await Promise.all(
      personal.filter(a => a.role === 'sub_admin')
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
    if (!form.name.trim() || !form.email.trim()) return
    setCreating(true)
    const password = generarPassword()
    const res = await createSubAdmin({ name: form.name.trim(), email: form.email.trim(), password })
    setCreating(false)
    if (!res.ok) { setFormError(res.message); return }
    setCreatedCreds({ name: res.user.name, email: res.user.email, password })
    setForm({ name: '', email: '' })
    loadAll()
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

      {/* ── Lista de sub-admins ─────────────────────────────── */}
      <div className="card p-5 space-y-3">
        <h2 className="section-title flex items-center gap-2"><Building2 size={16}/> Cuentas y accesos</h2>

        {errorAcceso && (
          <div className="flex items-start gap-2 rounded-lg px-3 py-2"
            style={{ background:'var(--bad-soft)', border:'1px solid var(--bad-line)' }}>
            <span className="text-xs" style={{ color:'var(--bad)' }}>{errorAcceso}</span>
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
              ['student', `Alumnos (${conteo.student})`]].map(([v, l]) =>
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
        </p>

        <ProgressiveList items={filtradas} className="space-y-3"
          sizes={{ mobile: 5, tablet: 10, desktop: 15 }}
          emptyLabel="Ninguna cuenta coincide con el filtro.">
          {a => {
            const rows = accessByUser[a.id] ?? []
            const esAdmin = a.role === 'admin'
            const esAlumno = a.role === 'student'
            return (
              <div key={a.id} className="rounded-xl p-3.5 space-y-2.5"
                style={{ background: 'var(--card-bg)', border: '1px solid var(--divider)' }}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--t1)' }}>{a.name}</p>
                    <p className="text-xs truncate" style={{ color: 'var(--t3)' }}>{a.email}</p>
                  </div>
                  <span className="badge flex-shrink-0"
                    style={esAdmin
                      ? { background:'var(--good)', color:'#fff', border:'1px solid var(--good)' }
                      : esAlumno
                        ? { background:'var(--soft-bg)', color:'var(--t2)', border:'1px solid var(--divider)' }
                        : { background:'var(--info)', color:'#fff', border:'1px solid var(--info)' }}>
                    {esAdmin ? 'Administrador' : esAlumno ? 'Alumno' : 'Sub-admin'}
                  </span>
                </div>

                {/* El alcance del administrador viene de su rol, no de filas de
                    acceso: mostrarle casillas sugeriría que se le puede recortar. */}
                {esAdmin ? (
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
                          <label className="flex items-center gap-2 flex-1 cursor-pointer text-sm"
                            style={{ color: wholeChecked || groupRows.length ? 'var(--t1)' : 'var(--t2)' }}>
                            <input type="checkbox" checked={wholeChecked} onChange={() => toggleWholeBranch(a.id, suc)}
                              className="accent-emerald-500"/>
                            {suc} {wholeChecked && <span className="text-xs" style={{ color:'var(--good)' }}>· toda la sucursal</span>}
                            {!wholeChecked && groupRows.length > 0 && (
                              <span className="text-xs" style={{ color:'var(--warn)' }}>· {groupRows.length} grupo(s)</span>
                            )}
                          </label>
                        </div>
                        {isExpanded && (
                          <div className="px-3 pb-2.5 pl-9 space-y-1">
                            {sucGroups.length === 0 && (
                              <p className="text-xs" style={{ color: 'var(--t3)' }}>Sin grupos en esta sucursal.</p>
                            )}
                            {sucGroups.map(g => {
                              const checked = wholeChecked || groupRows.some(r => r.groupId === g.id)
                              return (
                                <label key={g.id} className="flex items-center gap-2 text-xs cursor-pointer"
                                  style={{ color: 'var(--t2)' }}>
                                  <input type="checkbox" checked={checked}
                                    onChange={() => toggleGroup(a.id, suc, g.id)}
                                    className="accent-emerald-500"/>
                                  {g.name} — {g.subject}
                                </label>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
                )}
              </div>
            )
          }}
        </ProgressiveList>
      </div>
    </div>
  )
}
