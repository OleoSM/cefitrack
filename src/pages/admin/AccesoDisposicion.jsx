import { useState, useEffect, useCallback } from 'react'
import { Navigate } from 'react-router-dom'
import {
  ShieldCheck, UserPlus, ChevronDown, ChevronRight, Building2, KeyRound, CheckCircle2, X,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import {
  fetchSubAdmins, createSubAdmin, fetchGroups,
  fetchSubAdminAccess, grantSubAdminAccess, revokeSubAdminAccess,
} from '../../lib/supabaseData'
import { generarPassword } from '../../lib/credentials'

const SUCURSALES = ['CN1', 'CN2', 'CN3']

export default function AccesoDisposicion() {
  const { currentUser } = useAuth()
  const isAdmin = currentUser?.role === 'admin'

  const [subAdmins, setSubAdmins]     = useState([])
  const [groups, setGroups]           = useState([])
  const [accessByUser, setAccessByUser] = useState({})
  const [loading, setLoading]         = useState(true)
  const [expanded, setExpanded]       = useState(new Set())

  const [form, setForm] = useState({ name: '', email: '' })
  const [creating, setCreating] = useState(false)
  const [createdCreds, setCreatedCreds] = useState(null)
  const [formError, setFormError] = useState(null)

  const refreshAccess = useCallback(async (userId) => {
    const rows = await fetchSubAdminAccess(userId)
    setAccessByUser(prev => ({ ...prev, [userId]: rows }))
  }, [])

  const loadAll = useCallback(async () => {
    setLoading(true)
    const [admins, grps] = await Promise.all([fetchSubAdmins(), fetchGroups()])
    setSubAdmins(admins)
    setGroups(grps)
    const entries = await Promise.all(admins.map(a => fetchSubAdminAccess(a.id).then(rows => [a.id, rows])))
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
    if (wholeRow) {
      await revokeSubAdminAccess(wholeRow.id)
    } else {
      const perGroupRows = rows.filter(r => r.sucursal === sucursal && r.groupId != null)
      await Promise.all(perGroupRows.map(r => revokeSubAdminAccess(r.id)))
      await grantSubAdminAccess(userId, sucursal, null)
    }
    await refreshAccess(userId)
  }

  const toggleGroup = async (userId, sucursal, groupId) => {
    const rows = accessByUser[userId] ?? []
    const wholeRow = rows.find(r => r.sucursal === sucursal && r.groupId == null)
    const groupRow = rows.find(r => r.sucursal === sucursal && r.groupId === groupId)
    if (groupRow) {
      await revokeSubAdminAccess(groupRow.id)
    } else {
      if (wholeRow) await revokeSubAdminAccess(wholeRow.id)
      await grantSubAdminAccess(userId, sucursal, groupId)
    }
    await refreshAccess(userId)
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
    <div className="max-w-3xl space-y-5">

      <div>
        <h1 className="page-title flex items-center gap-2"><ShieldCheck size={22}/> Acceso y Disposición</h1>
        <p className="text-sm mt-1" style={{ color:'rgba(255,255,255,.38)' }}>
          Administra qué sucursales y grupos puede ver cada sub-admin.
        </p>
      </div>

      {/* ── Crear sub-admin ─────────────────────────────────── */}
      <div className="card p-5 space-y-3">
        <h2 className="section-title flex items-center gap-2"><UserPlus size={16}/> Crear sub-admin</h2>
        <form onSubmit={handleCreate} className="flex flex-col sm:flex-row gap-2.5">
          <input type="text" placeholder="Nombre completo" value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            className="flex-1 text-sm rounded-lg py-2.5 px-3 outline-none"
            style={{ background:'rgba(255,255,255,.07)', border:'1px solid rgba(255,255,255,.12)', color:'rgba(255,255,255,.90)' }}/>
          <input type="email" placeholder="correo@cefimat.mx" value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            className="flex-1 text-sm rounded-lg py-2.5 px-3 outline-none"
            style={{ background:'rgba(255,255,255,.07)', border:'1px solid rgba(255,255,255,.12)', color:'rgba(255,255,255,.90)' }}/>
          <button type="submit" disabled={creating}
            className="flex items-center justify-center gap-2 text-sm font-bold px-4 py-2.5 rounded-xl transition-all active:scale-95 disabled:opacity-40"
            style={{ background:'white', color:'black' }}>
            <UserPlus size={14}/> {creating ? 'Creando…' : 'Crear'}
          </button>
        </form>
        {formError && <p className="text-xs font-semibold" style={{ color:'#f87171' }}>{formError}</p>}

        {createdCreds && (
          <div className="flex items-start gap-3 rounded-xl p-3.5"
            style={{ background:'rgba(16,185,129,.10)', border:'1px solid rgba(16,185,129,.28)' }}>
            <KeyRound size={16} className="mt-0.5 flex-shrink-0" style={{ color:'#10b981' }}/>
            <div className="flex-1 text-xs" style={{ color:'rgba(255,255,255,.80)' }}>
              <p className="font-bold mb-1" style={{ color:'#10b981' }}>Sub-admin creado — guarda estas credenciales, no se mostrarán de nuevo:</p>
              <p><strong>{createdCreds.name}</strong> — {createdCreds.email}</p>
              <p>Contraseña: <span className="font-mono font-bold">{createdCreds.password}</span></p>
            </div>
            <button onClick={() => setCreatedCreds(null)} className="flex-shrink-0" style={{ color:'rgba(255,255,255,.40)' }}>
              <X size={14}/>
            </button>
          </div>
        )}
      </div>

      {/* ── Lista de sub-admins ─────────────────────────────── */}
      <div className="card p-5 space-y-3">
        <h2 className="section-title flex items-center gap-2"><Building2 size={16}/> Sub-admins y sus accesos</h2>

        {loading && <p className="text-sm" style={{ color:'rgba(255,255,255,.40)' }}>Cargando…</p>}
        {!loading && subAdmins.length === 0 && (
          <p className="text-sm" style={{ color:'rgba(255,255,255,.40)' }}>Todavía no hay sub-admins creados.</p>
        )}

        <div className="space-y-3">
          {subAdmins.map(a => {
            const rows = accessByUser[a.id] ?? []
            return (
              <div key={a.id} className="rounded-xl p-3.5 space-y-2.5"
                style={{ background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.07)' }}>
                <div>
                  <p className="text-sm font-semibold" style={{ color:'rgba(255,255,255,.85)' }}>{a.name}</p>
                  <p className="text-xs" style={{ color:'rgba(255,255,255,.35)' }}>{a.email}</p>
                </div>

                <div className="space-y-1.5">
                  {SUCURSALES.map(suc => {
                    const wholeChecked = rows.some(r => r.sucursal === suc && r.groupId == null)
                    const groupRows = rows.filter(r => r.sucursal === suc && r.groupId != null)
                    const sucGroups = groups.filter(g => g.sucursal === suc)
                    const key = `${a.id}:${suc}`
                    const isExpanded = expanded.has(key)
                    return (
                      <div key={suc} className="rounded-lg overflow-hidden"
                        style={{ background:'rgba(255,255,255,.03)', border:'1px solid rgba(255,255,255,.06)' }}>
                        <div className="flex items-center gap-2.5 px-3 py-2">
                          <button onClick={() => toggleExpanded(a.id, suc)} style={{ color:'rgba(255,255,255,.40)' }}>
                            {isExpanded ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
                          </button>
                          <label className="flex items-center gap-2 flex-1 cursor-pointer text-sm"
                            style={{ color: wholeChecked || groupRows.length ? 'rgba(255,255,255,.85)' : 'rgba(255,255,255,.55)' }}>
                            <input type="checkbox" checked={wholeChecked} onChange={() => toggleWholeBranch(a.id, suc)}
                              className="accent-emerald-500"/>
                            {suc} {wholeChecked && <span className="text-xs" style={{ color:'#10b981' }}>· toda la sucursal</span>}
                            {!wholeChecked && groupRows.length > 0 && (
                              <span className="text-xs" style={{ color:'#fbbf24' }}>· {groupRows.length} grupo(s)</span>
                            )}
                          </label>
                        </div>
                        {isExpanded && (
                          <div className="px-3 pb-2.5 pl-9 space-y-1">
                            {sucGroups.length === 0 && (
                              <p className="text-xs" style={{ color:'rgba(255,255,255,.30)' }}>Sin grupos en esta sucursal.</p>
                            )}
                            {sucGroups.map(g => {
                              const checked = wholeChecked || groupRows.some(r => r.groupId === g.id)
                              return (
                                <label key={g.id} className="flex items-center gap-2 text-xs cursor-pointer"
                                  style={{ color:'rgba(255,255,255,.60)' }}>
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
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
