import { useCallback, useEffect, useMemo, useState } from 'react'
import { Upload, FileText, Image as ImageIcon, Pencil, Trash2, ExternalLink, Clock, Eye, Search, X, RefreshCw, Mail } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useSucursales } from '../../hooks/useSucursales'
import { fetchGroups, fetchStudents, fetchNombresColumnas } from '../../lib/supabaseData'
import AvisoCorreoModal from '../../components/admin/AvisoCorreoModal'
import { alumnosDeMaterial, plantillaMaterialNuevo, plantillaMaterialVence } from '../../lib/avisosData'
import {
  fetchMateriales, subirMaterial, actualizarMaterial, borrarMaterial, urlMaterial,
  tiempoHasta, tamanoLegible, MAX_BYTES,
} from '../../lib/materialesData'
import ModalPortal from '../../components/ui/ModalPortal'
import ProgressiveList from '../../components/ui/ProgressiveList'
import { NeonCheckbox } from '../../components/ui/NeonCheckbox'
import { SkeletonBlock } from '../../components/ui/DataTable'
import ConfirmDialog from '../../components/admin/ConfirmDialog'
import { BotonAyuda } from '../../components/ui/Ayuda'
import SelectorActividad from '../../components/admin/SelectorActividad'

/*
 * Gestión de materiales — solucionarios, respuestas y guías ligados a una
 * actividad. Cada archivo tiene una ventana: se ve desde "Visible desde" y se
 * BORRA SOLO al llegar "Se borra el" (Edge Function cada hora). Se elige qué
 * grupos, sucursales o cursos lo pueden ver.
 */

const CURSOS = [{ id: 'ecoems', label: 'ECOEMS' }, { id: 'universidad', label: 'Universidad' }]
const fmt = f => new Date(f).toLocaleString('es-MX', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
// <input type="datetime-local"> trabaja en hora local sin zona.
const aLocal = iso => { const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16) }
const deLocal = v => new Date(v).toISOString()

export default function Materiales() {
  const { currentUser, puedeVer } = useAuth()
  const esAdmin = currentUser?.role === 'admin'
  const { sucursales: catalogo, nombreDe } = useSucursales()
  // El sub-admin solo comparte con sucursales que tiene COMPLETAS.
  const sucursalesPermitidas = esAdmin
    ? catalogo.map(s => s.id)
    : [...new Set((currentUser?.access ?? []).filter(a => a.groupId == null).map(a => a.sucursal))]

  const [lista, setLista] = useState([])
  const [grupos, setGrupos] = useState([])
  const [nombresAct, setNombresAct] = useState({})
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const [estado, setEstado] = useState('todos')
  const [modal, setModal] = useState(null)       // null | { material? }
  const [borrar, setBorrar] = useState(null)

  const cargar = useCallback(async () => {
    setCargando(true); setError('')
    try {
      const [mats, grps] = await Promise.all([fetchMateriales(), fetchGroups()])
      setLista(mats); setGrupos(grps)
      setNombresAct(await fetchNombresColumnas(mats.map(m => m.columnaId)).catch(() => ({})))
    } catch { setError('No se pudieron cargar los materiales.') }
    finally { setCargando(false) }
  }, [])
  useEffect(() => { cargar() }, [cargar])

  const ahora = Date.now()
  const estadoDe = m => new Date(m.visibleDesde).getTime() > ahora ? 'programado' : 'visible'
  const filtrados = useMemo(() => lista.filter(m =>
    (estado === 'todos' || estadoDe(m) === estado)
    && (q.trim() === '' || `${m.titulo} ${m.fileName} ${nombresAct[m.columnaId] ?? ''}`.toLowerCase().includes(q.trim().toLowerCase()))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [lista, estado, q, nombresAct])
  const conteo = { visible: lista.filter(m => estadoDe(m) === 'visible').length, programado: lista.filter(m => estadoDe(m) === 'programado').length }
  const nombreGrupo = id => grupos.find(g => g.id === id)?.name ?? id

  /* Popup "¿Avisar por correo?": al subir un material nuevo y con el botón
     "Enviar correo" de cada material. Si se borra en menos de 2 días, el
     mensaje es de "último aviso". */
  const [aviso, setAviso] = useState(null)   // { material, alumnos, asunto, mensaje, tipo }
  const ofrecerAviso = async (material, manual = false) => {
    if (!puedeVer('correos')) return
    try {
      const alumnos = alumnosDeMaterial(material, await fetchStudents(), grupos)
      if (!alumnos.length) { if (manual) setError('Ningún alumno puede ver este material todavía.'); return }
      const vence = new Date(material.expiraEn).getTime() - Date.now() < 2 * 864e5
      setAviso({ material, alumnos, tipo: vence ? 'material_vence' : 'material_nuevo',
        ...(vence ? plantillaMaterialVence(material) : plantillaMaterialNuevo({ ...material, actividad: nombresAct[material.columnaId] })) })
    } catch { /* sin aviso: el material ya quedó guardado */ }
  }

  const abrir = async m => {
    try { window.open(await urlMaterial(m), '_blank', 'noopener') } catch (e) { setError(e.message) }
  }

  return (
    <div className="w-full space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="page-title">Gestión de materiales</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--t3)' }}>
            Solucionarios, respuestas y guías de tus actividades. Cada archivo se ve solo en su ventana de tiempo y se borra solo al vencer.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <BotonAyuda titulo="Gestión de materiales">
            <p><b>Para qué sirve:</b> subir la solución de un examen o las respuestas de una tarea para que los alumnos las consulten un tiempo.</p>
            <p><b>Visible desde:</b> antes de esa fecha los alumnos no lo ven (así no sale el solucionario antes del examen).</p>
            <p><b>Se borra el:</b> al llegar esa fecha el archivo se elimina por completo de la plataforma, sin que tengas que hacer nada.</p>
            <p><b>Quién lo ve:</b> los grupos, sucursales {esAdmin && 'o cursos '}que marques.</p>
            <p>PDF o imágenes, hasta 20 MB.</p>
          </BotonAyuda>
          <button type="button" onClick={() => setModal({})} className="btn-primary min-h-11">
            <Upload size={14}/> <span className="hidden sm:inline">Subir material</span>
          </button>
        </div>
      </div>

      {/* Filtros primero */}
      <div className="card p-3 sm:p-4 flex flex-col sm:flex-row gap-2 sm:items-center">
        <div className="flex gap-1.5 overflow-x-auto">
          {[['todos', `Todos (${lista.length})`], ['visible', `Visibles ahora (${conteo.visible})`], ['programado', `Programados (${conteo.programado})`]].map(([v, l]) => (
            <button key={v} type="button" onClick={() => setEstado(v)} aria-pressed={estado === v}
              className="flex-shrink-0 min-h-9 px-3 rounded-full text-xs font-semibold"
              style={estado === v ? { background: 'var(--accent)', color: 'var(--accent-contrast)' } : { background: 'var(--soft-bg)', color: 'var(--t2)', border: '1px solid var(--card-border)' }}>
              {l}
            </button>
          ))}
        </div>
        <label className="relative sm:ml-auto sm:w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--t3)' }}/>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por título o actividad…"
            aria-label="Buscar material" className="input-field w-full min-h-11 !pl-9"/>
        </label>
      </div>

      {error && (
        <div role="alert" className="card p-3 flex items-center justify-between gap-3" style={{ background: 'var(--bad-soft)', borderColor: 'var(--bad-line)' }}>
          <span className="text-sm" style={{ color: 'var(--bad)' }}>{error}</span>
          <button type="button" onClick={cargar} className="btn-secondary min-h-9 text-xs"><RefreshCw size={13}/> Reintentar</button>
        </div>
      )}

      {cargando ? (
        <div className="space-y-3">{[0, 1, 2].map(i => <SkeletonBlock key={i} className="h-24"/>)}</div>
      ) : (
        <ProgressiveList items={filtrados} className="grid gap-3 lg:grid-cols-2" sizes={{ mobile: 5, tablet: 8, desktop: 12 }}
          emptyLabel={lista.length === 0 ? 'Aún no hay materiales. Sube el primero con "Subir material".' : 'Ningún material coincide con el filtro.'}>
          {m => {
            const programado = estadoDe(m) === 'programado'
            const Icono = m.mime === 'application/pdf' ? FileText : ImageIcon
            const alcance = [
              ...m.cursos.map(c => CURSOS.find(x => x.id === c)?.label ?? c),
              ...m.sucursales.map(s => nombreDe(s)),
              ...m.grupos.map(nombreGrupo),
            ]
            const propio = esAdmin || m.creadoPor === currentUser?.id
            return (
              <div key={m.id} className="card p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <span className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 text-white" style={{ background: 'var(--info-solid)' }}>
                    <Icono size={18}/>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold truncate" style={{ color: 'var(--t1)' }}>{m.titulo}</p>
                    <p className="text-[11px] truncate" style={{ color: 'var(--t3)' }}>
                      {m.columnaId && nombresAct[m.columnaId] ? `Actividad: ${nombresAct[m.columnaId]} · ` : ''}{m.fileName} · {tamanoLegible(m.tamano)}
                    </p>
                  </div>
                  <span className="badge text-white flex-shrink-0" style={{ background: programado ? 'var(--warn-solid)' : 'var(--good-solid)' }}>
                    {programado ? 'Programado' : 'Visible'}
                  </span>
                </div>
                {m.descripcion && <p className="text-xs" style={{ color: 'var(--t2)' }}>{m.descripcion}</p>}
                <div className="flex flex-wrap gap-1">
                  {alcance.map((a, i) => (
                    <span key={`${a}-${i}`} className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: 'var(--soft-bg)', color: 'var(--t2)', border: '1px solid var(--card-border)' }}>{a}</span>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]" style={{ color: 'var(--t3)' }}>
                  <span className="flex items-center gap-1"><Eye size={12}/> {programado ? `Visible ${tiempoHasta(m.visibleDesde)}` : `Visible desde ${fmt(m.visibleDesde)}`}</span>
                  <span className="flex items-center gap-1 font-semibold" style={{ color: 'var(--bad)' }}>
                    <Clock size={12}/> Se borra {tiempoHasta(m.expiraEn)} · {fmt(m.expiraEn)}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 pt-1" style={{ borderTop: '1px solid var(--divider)' }}>
                  <button type="button" onClick={() => abrir(m)} className="btn-secondary min-h-9 text-xs mt-2"><ExternalLink size={13}/> Abrir</button>
                  {puedeVer('correos') && <button type="button" onClick={() => ofrecerAviso(m, true)} className="btn-secondary min-h-9 text-xs mt-2"><Mail size={13}/> Enviar correo</button>}
                  {propio && <button type="button" onClick={() => setModal({ material: m })} className="btn-secondary min-h-9 text-xs mt-2"><Pencil size={13}/> Editar</button>}
                  {propio && <button type="button" onClick={() => setBorrar(m)} className="btn-danger min-h-9 text-xs mt-2 sm:ml-auto"><Trash2 size={13}/> Borrar ya</button>}
                </div>
              </div>
            )
          }}
        </ProgressiveList>
      )}

      {modal && (
        <MaterialModal material={modal.material} grupos={grupos} esAdmin={esAdmin}
          sucursalesPermitidas={sucursalesPermitidas} nombreDe={nombreDe}
          onClose={() => setModal(null)} onGuardado={nuevo => { setModal(null); cargar(); if (nuevo) ofrecerAviso(nuevo) }}/>
      )}
      {aviso && (
        <AvisoCorreoModal titulo="¿Avisar a los alumnos por correo?"
          contexto={`${aviso.material.titulo} · ${aviso.alumnos.length} alumno(s) lo pueden ver`} alumnos={aviso.alumnos}
          asuntoInicial={aviso.asunto} mensajeInicial={aviso.mensaje}
          tipo={aviso.tipo} refId={aviso.material.id}
          groupId={aviso.material.grupos.length === 1 && !aviso.material.sucursales.length && !aviso.material.cursos.length ? aviso.material.grupos[0] : null}
          onClose={() => setAviso(null)}/>
      )}
      {borrar && (
        <ConfirmDialog
          title={`¿Borrar "${borrar.titulo}" ahora?`}
          message="Se elimina el archivo de la plataforma antes de su fecha. Los alumnos dejarán de verlo."
          detail="Esta acción no se puede deshacer."
          confirmLabel="Sí, borrar" busyLabel="Borrando…"
          onConfirm={async () => { await borrarMaterial(borrar); await cargar() }}
          onClose={() => setBorrar(null)}/>
      )}
    </div>
  )
}

function MaterialModal({ material, grupos, esAdmin, sucursalesPermitidas, nombreDe, onClose, onGuardado }) {
  const editando = !!material
  const ahora = new Date()
  const [f, setF] = useState(() => ({
    titulo: material?.titulo ?? '', descripcion: material?.descripcion ?? '',
    visibleDesde: aLocal(material?.visibleDesde ?? ahora.toISOString()),
    expiraEn: aLocal(material?.expiraEn ?? new Date(ahora.getTime() + 7 * 864e5).toISOString()),
    grupos: material?.grupos ?? [], sucursales: material?.sucursales ?? [], cursos: material?.cursos ?? [],
    columnaId: material?.columnaId ?? '',
  }))
  const [archivo, setArchivo] = useState(null)
  const [buscaGrupo, setBuscaGrupo] = useState('')
  // "Quién lo ve" se despliega al elegir la actividad (o al compartir sin ella).
  const [sinActividad, setSinActividad] = useState(false)
  // En Grupos se ven los elegidos; "Mostrar todos" despliega la lista entera.
  const [verTodos, setVerTodos] = useState(false)
  // Grupo que se marcó solo por la actividad: si se cambia de actividad, se cambia.
  const [grupoAuto, setGrupoAuto] = useState(null)
  const mostrarQuien = editando || !!f.columnaId || sinActividad
  const gruposElegidos = grupos.filter(g => f.grupos.includes(g.id))
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const set = (k, v) => setF(p => ({ ...p, [k]: v }))
  const alternar = (k, v) => setF(p => ({ ...p, [k]: p[k].includes(v) ? p[k].filter(x => x !== v) : [...p[k], v] }))

  const plazo = dias => {
    const base = new Date(f.visibleDesde || Date.now())
    set('expiraEn', aLocal(new Date(base.getTime() + dias * 864e5).toISOString()))
  }

  const guardar = async () => {
    setError('')
    if (!f.titulo.trim()) return setError('Escribe un título.')
    if (!editando && !archivo) return setError('Elige el archivo.')
    if (!editando && archivo.size > MAX_BYTES) return setError('El archivo no puede pasar de 20 MB.')
    if (new Date(f.expiraEn) <= new Date(f.visibleDesde)) return setError('"Se borra el" debe ser después de "Visible desde".')
    if (new Date(f.expiraEn) <= new Date()) return setError('La fecha de borrado ya pasó.')
    if (f.grupos.length + f.sucursales.length + f.cursos.length === 0) return setError('Elige quién lo puede ver.')
    setGuardando(true)
    const datos = {
      titulo: f.titulo.trim(), descripcion: f.descripcion.trim(), columnaId: f.columnaId || null,
      visibleDesde: deLocal(f.visibleDesde), expiraEn: deLocal(f.expiraEn),
      grupos: f.grupos, sucursales: f.sucursales, cursos: f.cursos,
    }
    const res = editando ? await actualizarMaterial({ id: material.id, ...datos }) : await subirMaterial({ archivo, ...datos })
    setGuardando(false)
    if (!res.ok) return setError(res.message)
    onGuardado(editando ? null : res.material)
  }

  const gruposFiltrados = grupos.filter(g => `${g.name} ${g.subject ?? ''}`.toLowerCase().includes(buscaGrupo.trim().toLowerCase()))
  const etiqueta = t => <span className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--t3)' }}>{t}</span>

  return (
    <ModalPortal maxWidth="max-w-lg" onClose={() => !guardando && onClose()}>
      <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: '1px solid var(--divider)' }}>
        <h2 className="flex items-center gap-2 text-sm font-bold" style={{ color: 'var(--t1)' }}>
          <Upload size={15} style={{ color: 'var(--accent)' }}/> {editando ? 'Editar material' : 'Subir material'}
        </h2>
        <button type="button" onClick={onClose} disabled={guardando} aria-label="Cerrar"
          className="w-11 h-11 flex items-center justify-center rounded-lg" style={{ color: 'var(--t3)' }}><X size={15}/></button>
      </div>
      <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
        {!editando && (
          <label className="block">
            {etiqueta('Archivo (PDF o imagen, máx. 20 MB)')}
            <input type="file" accept=".pdf,image/jpeg,image/png,image/webp" onChange={e => setArchivo(e.target.files?.[0] ?? null)}
              className="input-field w-full min-h-11"/>
            {archivo && <span className="text-[11px]" style={{ color: archivo.size > MAX_BYTES ? 'var(--bad)' : 'var(--t3)' }}>{archivo.name} · {tamanoLegible(archivo.size)}</span>}
          </label>
        )}
        <label className="block">
          {etiqueta('Título')}
          <input value={f.titulo} onChange={e => set('titulo', e.target.value)} maxLength={120} placeholder="Ej. Solucionario Examen 1"
            className="input-field w-full min-h-11"/>
        </label>
        <label className="block">
          {etiqueta('Descripción (opcional)')}
          <textarea value={f.descripcion} onChange={e => set('descripcion', e.target.value)} rows={2} maxLength={300} className="input-field w-full"/>
        </label>

        {/* Actividad a la que pertenece (opcional) */}
        <div>
          {etiqueta('Actividad (opcional)')}
          <SelectorActividad grupos={grupos} nombreDe={nombreDe} columnaId={f.columnaId}
            onElegir={sel => {
              set('columnaId', sel?.columnaId ?? '')
              if (!sel?.grupoId) return
              // Por defecto lo ve el grupo de la actividad. Si antes se había
              // marcado otro grupo por una actividad anterior, se sustituye.
              setF(p => {
                const sinPrevio = grupoAuto && grupoAuto !== sel.grupoId ? p.grupos.filter(x => x !== grupoAuto) : p.grupos
                return { ...p, grupos: sinPrevio.includes(sel.grupoId) ? sinPrevio : [...sinPrevio, sel.grupoId] }
              })
              setGrupoAuto(sel.grupoId)
            }}/>
        </div>

        {/* Ventana de tiempo */}
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block">
            {etiqueta('Visible desde')}
            <input type="datetime-local" value={f.visibleDesde} onChange={e => set('visibleDesde', e.target.value)} className="input-field w-full min-h-11"/>
          </label>
          <label className="block">
            {etiqueta('Se borra el')}
            <input type="datetime-local" value={f.expiraEn} onChange={e => set('expiraEn', e.target.value)} className="input-field w-full min-h-11"/>
          </label>
        </div>
        <div className="flex flex-wrap gap-1.5 -mt-2">
          {[[1, '1 día'], [3, '3 días'], [7, '1 semana'], [14, '2 semanas'], [30, '1 mes']].map(([d, l]) => (
            <button key={d} type="button" onClick={() => plazo(d)} className="min-h-9 px-2.5 rounded-lg text-[11px] font-semibold"
              style={{ background: 'var(--soft-bg)', color: 'var(--t2)', border: '1px solid var(--card-border)' }}>{l}</button>
          ))}
          <span className="text-[11px] self-center" style={{ color: 'var(--t3)' }}>después de que se vuelve visible</span>
        </div>
        <p className="text-[11px] -mt-2" style={{ color: 'var(--bad)' }}>Al llegar "Se borra el", el archivo se elimina por completo y no se puede recuperar.</p>

        {/* Quién lo ve: aparece al elegir la actividad, ya con su grupo marcado. */}
        {!mostrarQuien ? (
          <div className="rounded-xl p-3 flex flex-col sm:flex-row sm:items-center gap-2 justify-between"
            style={{ background: 'var(--soft-bg)', border: '1px dashed var(--card-border)' }}>
            <p className="text-xs" style={{ color: 'var(--t3)' }}>
              Elige la actividad arriba y se compartirá con su grupo. ¿No es de ninguna actividad?
            </p>
            <button type="button" onClick={() => setSinActividad(true)} className="btn-secondary min-h-9 text-xs justify-center flex-shrink-0">
              Compartir sin actividad
            </button>
          </div>
        ) : (
        <div className="rounded-xl p-3 space-y-3" style={{ background: 'var(--soft-bg)', border: '1px solid var(--card-border)' }}>
          {etiqueta('¿Quién lo puede ver?')}
          {esAdmin && (
            <div>
              <p className="text-[11px] font-semibold mb-1" style={{ color: 'var(--t2)' }}>Cursos completos</p>
              <div className="flex flex-wrap gap-x-4">
                {CURSOS.map(c => <NeonCheckbox key={c.id} checked={f.cursos.includes(c.id)} onChange={() => alternar('cursos', c.id)}
                  label={<span className="text-xs">{c.label}</span>}/>)}
              </div>
            </div>
          )}
          {sucursalesPermitidas.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold mb-1" style={{ color: 'var(--t2)' }}>Sucursales completas</p>
              <div className="flex flex-wrap gap-x-4">
                {sucursalesPermitidas.map(s => <NeonCheckbox key={s} checked={f.sucursales.includes(s)} onChange={() => alternar('sucursales', s)}
                  label={<span className="text-xs">{nombreDe(s)}</span>}/>)}
              </div>
            </div>
          )}
          <div>
            <div className="flex items-center justify-between gap-2 mb-1">
              <p className="text-[11px] font-semibold" style={{ color: 'var(--t2)' }}>Grupos {f.grupos.length > 0 && `(${f.grupos.length})`}</p>
              <button type="button" onClick={() => { setVerTodos(v => !v); setBuscaGrupo('') }}
                className="text-[11px] font-semibold min-h-9 px-2 rounded-lg" style={{ color: 'var(--accent)' }}>
                {verTodos ? 'Mostrar solo los elegidos' : `Mostrar todos (${grupos.length})`}
              </button>
            </div>
            {verTodos ? (
              <>
                <input value={buscaGrupo} onChange={e => setBuscaGrupo(e.target.value)} placeholder="Buscar grupo…" aria-label="Buscar grupo"
                  className="input-field w-full min-h-9 mb-1.5"/>
                <div className="max-h-48 overflow-y-auto grid sm:grid-cols-2 gap-x-3">
                  {gruposFiltrados.map(g => <NeonCheckbox key={g.id} checked={f.grupos.includes(g.id)} onChange={() => alternar('grupos', g.id)}
                    label={<span className="text-xs">{g.name}<span style={{ color: 'var(--t3)' }}> · {nombreDe(g.sucursal)}</span></span>}/>)}
                  {gruposFiltrados.length === 0 && <p className="text-xs" style={{ color: 'var(--t3)' }}>Sin grupos con ese nombre.</p>}
                </div>
              </>
            ) : gruposElegidos.length ? (
              <div className="grid sm:grid-cols-2 gap-x-3">
                {gruposElegidos.map(g => <NeonCheckbox key={g.id} checked onChange={() => alternar('grupos', g.id)}
                  label={<span className="text-xs">{g.name}<span style={{ color: 'var(--t3)' }}> · {nombreDe(g.sucursal)}</span>{g.id === grupoAuto && <span className="text-[10px] font-bold ml-1" style={{ color: 'var(--accent)' }}>· de la actividad</span>}</span>}/>)}
              </div>
            ) : (
              <p className="text-xs" style={{ color: 'var(--t3)' }}>Ningún grupo elegido. Pulsa "Mostrar todos" para elegir.</p>
            )}
          </div>
        </div>
        )}

        {error && <p role="alert" className="text-xs font-semibold" style={{ color: 'var(--bad)' }}>{error}</p>}
        <div className="flex gap-3">
          <button type="button" onClick={onClose} disabled={guardando} className="btn-secondary flex-1 justify-center min-h-11">Cancelar</button>
          <button type="button" onClick={guardar} disabled={guardando} className="btn-primary flex-1 justify-center min-h-11">
            {guardando ? (editando ? 'Guardando…' : 'Subiendo…') : (editando ? 'Guardar' : 'Subir')}
          </button>
        </div>
      </div>
    </ModalPortal>
  )
}
