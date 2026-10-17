import { useEffect, useMemo, useState } from 'react'
import { X, ShieldCheck, Wallet, FolderOpen, Sparkles, Trophy, Search, Eye, EyeOff, Save } from 'lucide-react'
import ModalPortal from '../ui/ModalPortal'
import ProgressiveList from '../ui/ProgressiveList'
import { NeonCheckbox } from '../ui/NeonCheckbox'
import { SkeletonBlock } from '../ui/DataTable'
import { fetchPermisosAlumno, guardarPermisosAlumno, PERMISOS_POR_DEFECTO } from '../../lib/permisosAlumno'
import { fetchMateriales } from '../../lib/materialesData'

/*
 * "Permisos" de un alumno: qué apartados de su portal ve y qué materiales
 * concretos se le ocultan. Listas con los primeros 5 y "Mostrar más".
 * El servidor aplica lo mismo (no basta con ocultarlo en pantalla).
 */
const APARTADOS = [
  { clave: 'verPagos',      label: 'Pagos',      Icono: Wallet,     detalle: 'Ver su plan, sus pagos y su saldo.' },
  { clave: 'verMateriales', label: 'Materiales', Icono: FolderOpen, detalle: 'Ver y descargar materiales. Abajo puedes ocultar algunos en concreto.' },
  { clave: 'verDesempeno',  label: 'Desempeño',  Icono: Sparkles,   detalle: 'Ver su reporte con IA (sin las notas internas).' },
  { clave: 'verRankings',   label: 'Rankings',   Icono: Trophy,     detalle: 'Ver su lugar en el grupo.' },
]
const fecha = f => new Date(f).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })

export default function PermisosAlumnoModal({ student, groups, onClose }) {
  const grupo = groups.find(g => g.id === student.groupId)
  const [p, setP] = useState(null)
  const [mats, setMats] = useState(null)
  const [q, setQ] = useState('')
  const [filtro, setFiltro] = useState('todos')   // todos | visibles | ocultos
  const [guardando, setGuardando] = useState(false)
  const [aviso, setAviso] = useState(null)

  useEffect(() => {
    fetchPermisosAlumno(student.id).then(setP).catch(() => setP({ ...PERMISOS_POR_DEFECTO }))
    fetchMateriales().then(lista => setMats(lista.filter(m => grupo && (
      m.grupos.includes(grupo.id) || m.sucursales.includes(grupo.sucursal) || m.cursos.includes(grupo.curso)))))
      .catch(() => setMats([]))
  }, [student.id, grupo])

  const ocultos = useMemo(() => new Set(p?.materialesOcultos ?? []), [p])
  const matsVisibles = useMemo(() => (mats ?? []).filter(m =>
    (!q.trim() || m.titulo.toLowerCase().includes(q.trim().toLowerCase()))
    && (filtro === 'todos' || (filtro === 'ocultos') === ocultos.has(m.id))), [mats, q, filtro, ocultos])

  const alternarMaterial = id => setP(v => ({ ...v,
    materialesOcultos: v.materialesOcultos.includes(id) ? v.materialesOcultos.filter(x => x !== id) : [...v.materialesOcultos, id] }))

  const guardar = async () => {
    setGuardando(true); setAviso(null)
    const r = await guardarPermisosAlumno(student.id, p)
    setGuardando(false)
    setAviso(r.ok ? { bad: false, text: 'Permisos guardados. El alumno los verá al recargar su portal.' } : { bad: true, text: r.message })
  }

  return (
    <ModalPortal maxWidth="max-w-xl" onClose={() => !guardando && onClose()} scrollable>
      <div className="flex items-center justify-between gap-3 px-5 py-3.5 sticky top-0 z-10" style={{ borderBottom: '1px solid var(--divider)', background: 'var(--panel-bg)' }}>
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-bold" style={{ color: 'var(--t1)' }}>
            <ShieldCheck size={15} style={{ color: 'var(--accent)' }}/> Permisos de {student.name}
          </h2>
          <p className="text-[11px] mt-0.5 truncate" style={{ color: 'var(--t3)' }}>Qué puede ver en su portal. {grupo ? grupo.name : ''}</p>
        </div>
        <button type="button" onClick={onClose} disabled={guardando} aria-label="Cerrar"
          className="w-11 h-11 flex items-center justify-center rounded-lg flex-shrink-0" style={{ color: 'var(--t3)' }}><X size={15}/></button>
      </div>

      <div className="p-5 space-y-5">
        {!p ? <SkeletonBlock className="h-40"/> : (
          <>
            <section className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--t3)' }}>Apartados de su portal</p>
              <ProgressiveList items={APARTADOS} className="space-y-1.5" sizes={{ mobile: 5, tablet: 5, desktop: 5 }}>
                {a => (
                  <div key={a.clave} className="flex items-center gap-3 rounded-xl px-3 py-2.5" style={{ border: '1px solid var(--divider)' }}>
                    <a.Icono size={16} className="flex-shrink-0" style={{ color: p[a.clave] ? 'var(--accent)' : 'var(--t3)' }}/>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold" style={{ color: 'var(--t1)' }}>{a.label}</p>
                      <p className="text-[11px]" style={{ color: 'var(--t3)' }}>{a.detalle}</p>
                    </div>
                    <NeonCheckbox checked={p[a.clave]} onChange={e => setP(v => ({ ...v, [a.clave]: e.target.checked }))}
                      label={<span className="text-xs" style={{ color: 'var(--t2)' }}>{p[a.clave] ? 'Visible' : 'Oculto'}</span>}/>
                  </div>
                )}
              </ProgressiveList>
            </section>

            <section className="space-y-2" style={{ opacity: p.verMateriales ? 1 : 0.5 }}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--t3)' }}>Materiales uno por uno</p>
                <span className="text-[11px]" style={{ color: 'var(--t3)' }}>{ocultos.size} oculto(s)</span>
              </div>
              {!p.verMateriales && <p className="text-[11px]" style={{ color: 'var(--warn)' }}>El apartado Materiales está oculto: no verá ninguno.</p>}
              <div className="flex flex-col sm:flex-row gap-2">
                <label className="relative flex-1">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--t3)' }}/>
                  <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar material…" className="input-field pl-9 min-h-10" aria-label="Buscar material"/>
                </label>
                <select value={filtro} onChange={e => setFiltro(e.target.value)} className="input-field min-h-10 sm:w-40" aria-label="Filtrar">
                  <option value="todos">Todos</option>
                  <option value="visibles">Visibles</option>
                  <option value="ocultos">Ocultos</option>
                </select>
              </div>
              {mats === null ? <SkeletonBlock className="h-24"/> : (
                <ProgressiveList items={matsVisibles} className="space-y-1.5" sizes={{ mobile: 5, tablet: 5, desktop: 5 }}
                  emptyLabel={mats.length ? 'Ningún material coincide.' : 'No hay materiales vigentes para su grupo.'}>
                  {m => {
                    const oculto = ocultos.has(m.id)
                    return (
                      <div key={m.id} className="flex items-center gap-3 rounded-xl px-3 py-2" style={{ border: '1px solid var(--divider)' }}>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm truncate" style={{ color: oculto ? 'var(--t3)' : 'var(--t1)' }}>{m.titulo}</p>
                          <p className="text-[11px]" style={{ color: 'var(--t3)' }}>Hasta el {fecha(m.expiraEn)}</p>
                        </div>
                        <button type="button" onClick={() => alternarMaterial(m.id)} disabled={!p.verMateriales}
                          className="btn-secondary text-xs min-h-9" aria-pressed={!oculto}>
                          {oculto ? <><EyeOff size={13}/> Oculto</> : <><Eye size={13}/> Visible</>}
                        </button>
                      </div>
                    )
                  }}
                </ProgressiveList>
              )}
            </section>

            {aviso && <p role={aviso.bad ? 'alert' : 'status'} className="text-sm" style={{ color: aviso.bad ? 'var(--bad)' : 'var(--good)' }}>{aviso.text}</p>}
            <div className="flex flex-col-reverse sm:flex-row gap-2">
              <button type="button" onClick={onClose} disabled={guardando} className="btn-secondary flex-1 justify-center min-h-11">Cerrar</button>
              <button type="button" onClick={guardar} disabled={guardando} className="btn-primary flex-1 justify-center min-h-11">
                <Save size={14}/> {guardando ? 'Guardando…' : 'Guardar permisos'}
              </button>
            </div>
          </>
        )}
      </div>
    </ModalPortal>
  )
}
