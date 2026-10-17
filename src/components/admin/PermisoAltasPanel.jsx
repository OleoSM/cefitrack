import { useCallback, useEffect, useMemo, useState } from 'react'
import { UserCheck, Crown, Search } from 'lucide-react'
import { fetchListaPermisoAltas, setPermisoAltas } from '../../lib/supabaseData'
import { useAuth } from '../../context/AuthContext'
import { NeonCheckbox } from '../ui/NeonCheckbox'
import ProgressiveList from '../ui/ProgressiveList'
import { SkeletonBlock } from '../ui/DataTable'

/*
 * "Altas y bajas de alumnos" en Acceso y Disposición.
 * Quién puede dar de alta o de baja alumnos. Solo algunos admins pueden
 * cambiarlo; el resto lo ve en solo lectura. Nadie aparece con privilegios
 * extra: todos los super admins llevan la misma corona.
 * Los super admins lo tienen por defecto; los sub-admins, solo si se lo dan.
 */
export default function PermisoAltasPanel() {
  const { esDueno } = useAuth()
  const [lista, setLista] = useState(null)
  const [q, setQ] = useState('')
  const [rol, setRol] = useState('todos')
  const [guardando, setGuardando] = useState(null)
  const [aviso, setAviso] = useState(null)

  const cargar = useCallback(() => {
    fetchListaPermisoAltas().then(setLista).catch(() => setLista([]))
  }, [])
  useEffect(() => { cargar() }, [cargar])

  const visibles = useMemo(() => (lista ?? []).filter(p =>
    (rol === 'todos' || p.rol === rol)
    && (!q.trim() || `${p.nombre} ${p.email}`.toLowerCase().includes(q.trim().toLowerCase()))), [lista, q, rol])

  const cambiar = async (p, puede) => {
    setGuardando(p.userId); setAviso(null)
    const r = await setPermisoAltas(p.userId, puede)
    setGuardando(null)
    if (!r.ok) return setAviso({ bad: true, text: r.message })
    setLista(v => v.map(x => x.userId === p.userId ? { ...x, puede, personalizado: true } : x))
    setAviso({ bad: false, text: `${p.nombre}: ${puede ? 'ahora puede' : 'ya no puede'} dar de alta y de baja alumnos.` })
  }

  return (
    <div className="card p-5 space-y-3">
      <div>
        <h2 className="section-title flex items-center gap-2"><UserCheck size={16}/> Altas y bajas de alumnos</h2>
        <p className="text-xs mt-1" style={{ color: 'var(--t3)' }}>
          Quién puede dar de alta o de baja alumnos. Toda alta exige registrar el primer pago.
          {esDueno ? ' Puedes cambiar este permiso a cualquier admin o sub-admin.' : ''}
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <label className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--t3)' }}/>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar persona…" className="input-field pl-9 min-h-10" aria-label="Buscar persona"/>
        </label>
        <select value={rol} onChange={e => setRol(e.target.value)} className="input-field min-h-10 sm:w-48" aria-label="Rol">
          <option value="todos">Todos los roles</option>
          <option value="admin">Super admins</option>
          <option value="sub_admin">Sub-admins</option>
        </select>
      </div>

      {aviso && (
        <p role={aviso.bad ? 'alert' : 'status'} className="text-sm" style={{ color: aviso.bad ? 'var(--bad)' : 'var(--good)' }}>{aviso.text}</p>
      )}

      {lista === null ? (
        <div className="space-y-2">{[0, 1, 2].map(i => <SkeletonBlock key={i} className="h-12"/>)}</div>
      ) : (
        <ProgressiveList items={visibles} className="space-y-1.5" sizes={{ mobile: 5, tablet: 5, desktop: 5 }}
          emptyLabel="Nadie coincide con la búsqueda.">
          {p => (
            <div key={p.userId} className="flex items-center gap-3 rounded-xl px-3 py-2 min-w-0" style={{ border: '1px solid var(--divider)' }}>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate flex items-center gap-1.5" style={{ color: 'var(--t1)' }}>
                  {p.rol === 'admin' && <Crown size={13} style={{ color: 'var(--warn)' }}/>} {p.nombre}
                </p>
                <p className="text-[11px] truncate" style={{ color: 'var(--t3)' }}>
                  {p.rol === 'admin' ? 'Super admin' : 'Sub-admin'} · {p.email}
                </p>
              </div>
              {esDueno && !p.esDueno ? (
                <NeonCheckbox checked={p.puede} disabled={guardando === p.userId}
                  onChange={e => cambiar(p, e.target.checked)}
                  label={<span className="text-xs" style={{ color: 'var(--t2)' }}>{p.puede ? 'Puede' : 'No puede'}</span>}/>
              ) : (
                <span className="text-xs font-semibold" style={{ color: p.puede ? 'var(--good)' : 'var(--t3)' }}>{p.puede ? 'Puede' : 'No puede'}</span>
              )}
            </div>
          )}
        </ProgressiveList>
      )}
    </div>
  )
}
