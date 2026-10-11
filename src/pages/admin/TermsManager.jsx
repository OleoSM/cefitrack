import { useState, useEffect, useCallback, useRef } from 'react'
import AvatarAlumno from '../../components/ui/AvatarAlumno'
import { fetchStudents, fetchGroups, resetTerms } from '../../lib/supabaseData'
import {
  CheckCircle2, Clock, FileText, Trash2, Upload, Check, X, PenLine,
  AlertTriangle, Eye, RefreshCw, ShieldCheck,
} from 'lucide-react'
import KpiCard, { KpiGrid } from '../../components/ui/KpiCard'
import { DataTable, DataTableRow, SkeletonRows } from '../../components/ui/DataTable'
import { IconExpediente } from '../../components/ui/SigaKpiIcons'
import { DANGER_BTN_STYLE } from '../../components/admin/ConfirmDialog'
import ProgressiveList from '../../components/ui/ProgressiveList'
import ModalPortal from '../../components/ui/ModalPortal'
import BarraFiltros from '../../components/ui/BarraFiltros'
import { useSucursales } from '../../hooks/useSucursales'
import { useSucursalActiva, TODAS } from '../../hooks/useSucursalActiva'
import {
  fetchDocumentosAlumnos, validarDocumento, validarGarantia,
  fetchTerminosActivo, publicarTerminos, urlDocumento,
} from '../../lib/expedienteData'

/* Un documento se valida VIÉNDOLO. Antes la celda era un botón con el texto
   del estado que aprobaba de un clic sin abrir el archivo: no era validación,
   era un interruptor. Ahora la celda ofrece ver, aprobar y rechazar por
   separado, y el rechazo exige motivo porque el alumno lo va a leer. */
function estiloEstado(estado) {
  if (estado === 'validado' || estado === 'validada')
    return { background:'var(--good-soft)', color:'var(--good)', border:'1px solid var(--good-line)' }
  if (estado === 'rechazado')
    return { background:'var(--bad-soft)', color:'var(--bad)', border:'1px solid var(--bad-line)' }
  if (estado === 'entregado' || estado === 'entregada')
    return { background:'var(--warn-soft)', color:'var(--warn)', border:'1px solid var(--warn-line)' }
  return { background:'var(--soft-bg)', color:'var(--t3)', border:'1px solid var(--divider)' }
}

function CeldaDocumento({ etiqueta, doc, onVer, onAprobar, onRechazar, ocupado }) {
  const trabajando = ocupado === doc?.id
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <span className="lg:hidden text-[10px] font-bold uppercase tracking-wider w-20 flex-shrink-0"
        style={{ color:'var(--t3)' }}>{etiqueta}</span>
      {!doc
        ? <span className="text-[11px] font-bold px-2 py-1 rounded-full" style={estiloEstado(null)}>Sin entregar</span>
        : (
          <>
            <span className="text-[11px] font-bold px-2 py-1 rounded-full flex-shrink-0" style={estiloEstado(doc.status)}>
              {doc.status === 'validado' ? 'Validado' : doc.status === 'rechazado' ? 'Rechazado' : 'Por revisar'}
            </span>
            <button title="Ver documento" onClick={() => onVer(doc)}
              className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background:'var(--info-soft)', color:'var(--info)' }}>
              <Eye size={12}/>
            </button>
            {doc.status !== 'validado' && (
              <button title="Aprobar" disabled={trabajando} onClick={() => onAprobar(doc)}
                className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 disabled:opacity-40"
                style={{ background:'var(--good-soft)', color:'var(--good)' }}>
                <Check size={12}/>
              </button>
            )}
            {doc.status !== 'rechazado' && (
              <button title="Rechazar" disabled={trabajando} onClick={() => onRechazar({ doc, motivo:'' })}
                className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 disabled:opacity-40"
                style={{ background:'var(--bad-soft)', color:'var(--bad)' }}>
                <X size={12}/>
              </button>
            )}
          </>
        )}
    </div>
  )
}

const COLUMNS_TC = [
  { key:'alumno',   label:'Alumno',    className:'flex-grow min-w-[150px]' },
  { key:'firma',    label:'Firma T&C', className:'w-40 hidden sm:flex' },
  { key:'curp',     label:'CURP',      className:'w-52 hidden lg:flex' },
  { key:'ine',      label:'INE tutor', className:'w-52 hidden lg:flex' },
  { key:'garantia', label:'Garantía',  className:'w-52 hidden lg:flex' },
  { key:'acceso',   label:'Acceso',    className:'w-24 flex' },
]

export default function TermsManager() {
  const [list, setList]         = useState([])
  const [grupos, setGrupos]     = useState([])
  /* Esta pantalla no tenía forma de acotar: volcaba los alumnos de las cinco
     sedes juntos y había que buscarlos por nombre uno a uno. */
  const { sucursal, setSucursal, opcionesConTodas } = useSucursalActiva()
  const { nombreDe } = useSucursales()
  const [grupoFiltro, setGrupoFiltro] = useState('todos')
  const [buscaGrupo, setBuscaGrupo]   = useState('')
  const [search, setSearch]     = useState('')
  const [filter, setFilter]     = useState('todos')
  const [preview, setPreview]   = useState(null)   // alumno seleccionado para ver firma
  const [garantiaPreview, setGarantiaPreview] = useState(null)
  const [tcVersion, setTcVersion] = useState(null)
  const [uploadingTerms, setUploadingTerms] = useState(false)
  const [termsError, setTermsError] = useState('')
  const termsInputRef = useRef(null)
  const [confirmReset, setConfirmReset] = useState(null) // id del alumno a resetear
  const [rechazo, setRechazo]   = useState(null)  // { doc, motivo }
  const [ocupado, setOcupado]   = useState(null)  // id de la fila en curso
  const [aviso, setAviso]       = useState('')
  const [loading, setLoading]   = useState(true)
  const [loadError, setLoadError] = useState(null)

  const signed   = list.filter(s => s.termsStatus === 'firmado').length
  const pending  = list.filter(s => s.termsStatus !== 'firmado').length
  const activos  = list.filter(s => s.accesoEstado === 'activo').length
  /* El trabajo pendiente del administrador es lo que llegó y nadie ha mirado.
     Es el número que decide si hay que entrar a esta pantalla hoy. */
  const porRevisar = list.reduce((n, s) =>
    n + (s.documents?.filter(d => d.status === 'entregado').length ?? 0)
      + (s.garantiaEstado === 'entregada' ? 1 : 0), 0)

  const gruposEnSucursal = sucursal === TODAS
    ? grupos
    : grupos.filter(g => g.sucursal === sucursal)
  const idsEnSucursal = new Set(gruposEnSucursal.map(g => g.id))

  const filtered = list.filter(s => {
    if (sucursal !== TODAS && !idsEnSucursal.has(s.groupId)) return false
    if (grupoFiltro !== 'todos' && s.groupId !== grupoFiltro) return false
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase())
    const matchFilter =
        filter === 'todos'      ? true
      : filter === 'firmado'    ? s.termsStatus === 'firmado'
      : filter === 'revisar'    ? (s.documents?.some(d => d.status === 'entregado') || s.garantiaEstado === 'entregada')
      : filter === 'activo'     ? s.accesoEstado === 'activo'
      : s.termsStatus !== 'firmado'
    return matchSearch && matchFilter
  })

  const load = useCallback(async () => {
    try {
      const [students, grs] = await Promise.all([fetchStudents(), fetchGroups()])
      const docs = await fetchDocumentosAlumnos(students.map(s=>s.id))
      setGrupos(grs)
      setList(students.map(s=>({ ...s, documents:docs.filter(d=>d.student_id===s.id) })))
      setLoadError(null)
    } catch (err) {
      setLoadError(err?.message || 'No se pudo cargar el expediente de los alumnos.')
    } finally {
      setLoading(false)
    }
  }, [])

  /* Si al cambiar de sucursal el grupo elegido ya no está, el filtro dejaría
     la lista vacía sin que se entienda por qué. */
  useEffect(() => {
    if (grupoFiltro !== 'todos' && !gruposEnSucursal.some(g => g.id === grupoFiltro)) setGrupoFiltro('todos')
  }, [sucursal, grupoFiltro, gruposEnSucursal])

  const verDocumento = async doc => {
    setAviso('')
    try { window.open(await urlDocumento(doc.storage_path), '_blank', 'noopener') }
    catch (e) { setAviso(e?.message || 'No se pudo abrir el documento.') }
  }

  const aprobarDocumento = async doc => {
    setOcupado(doc.id); setAviso('')
    try { await validarDocumento(doc.id, true); await load() }
    catch (e) { setAviso(e?.message || 'No se pudo validar el documento.') }
    finally { setOcupado(null) }
  }

  const confirmarRechazo = async () => {
    if (!rechazo?.motivo.trim()) return
    setOcupado(rechazo.doc.id); setAviso('')
    try { await validarDocumento(rechazo.doc.id, false, rechazo.motivo.trim()); setRechazo(null); await load() }
    catch (e) { setAviso(e?.message || 'No se pudo rechazar el documento.') }
    finally { setOcupado(null) }
  }

  const aprobarGarantia = async id => {
    setOcupado(id); setAviso('')
    try { await validarGarantia(id); await load() }
    catch (e) { setAviso(e?.message || 'No se pudo validar la garantía.') }
    finally { setOcupado(null) }
  }

  useEffect(() => { load() }, [load])
  useEffect(() => { fetchTerminosActivo().then(setTcVersion).catch(()=>{}) }, [])

  const uploadTerms = async file => {
    if (!file) return
    setUploadingTerms(true)
    setTermsError('')
    try { setTcVersion(await publicarTerminos(file)) }
    catch (error) { setTermsError(error.message || 'No se pudo publicar el documento.') }
    finally {
      setUploadingTerms(false)
      if (termsInputRef.current) termsInputRef.current.value = ''
    }
  }

  const resetSignature = async (id) => {
    setConfirmReset(null)
    if (preview?.id === id) setPreview(null)
    setList(prev => prev.map(s =>
      s.id === id
        ? { ...s, termsStatus:'pendiente', signatureDataUrl:null, signedAt:null }
        : s
    ))
    try { await resetTerms(id) } catch { load() }   // si falla, se recarga el estado real
  }

  return (
    <div className="w-full space-y-5">
      <div>
        <h1 className="page-title">T&C y Firmas</h1>
        <p className="text-sm mt-1" style={{ color:'var(--t3)' }}>
          Administra términos, firmas y documentos de los alumnos.
        </p>
      </div>

      <KpiGrid cols={4}>
        <KpiCard icon={IconExpediente} label="Firmados" value={signed} tone="good"/>
        <KpiCard icon={Clock} label="Sin firmar" value={pending} tone="warn"/>
        <KpiCard icon={AlertTriangle} label="Por revisar" value={porRevisar} tone="warn"
          onClick={() => setFilter('revisar')}/>
        <KpiCard icon={ShieldCheck} label="Acceso activo" value={activos} tone="good"/>
      </KpiGrid>

      {loadError && (
        <div role="alert" className="card p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between"
          style={{ background:'var(--bad-soft)', borderColor:'var(--bad-line)' }}>
          <span className="text-sm" style={{ color:'var(--bad)' }}>{loadError}</span>
          <button onClick={() => { setLoading(true); load() }} className="btn-secondary min-h-11 justify-center">
            <RefreshCw size={14}/> Reintentar
          </button>
        </div>
      )}

      {aviso && (
        <div role="alert" className="flex items-start gap-2 rounded-xl px-3 py-2.5"
          style={{ background:'var(--bad-soft)', border:'1px solid var(--bad-line)' }}>
          <AlertTriangle size={14} style={{ color:'var(--bad)', flexShrink:0, marginTop:1 }}/>
          <span className="text-xs flex-1" style={{ color:'var(--bad)' }}>{aviso}</span>
          <button onClick={() => setAviso('')} aria-label="Cerrar aviso"
            className="w-8 h-8 -my-1 flex items-center justify-center rounded-lg" style={{ color:'var(--t3)' }}><X size={14}/></button>
        </div>
      )}

      {/* Documento T&C — versión activa */}
      <div className="card p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background:'var(--info-soft)', border:'1px solid var(--info-line)' }}>
              <FileText size={18} style={{ color:'var(--info)' }}/>
            </div>
            <div>
              <p className="text-sm font-bold" style={{ color:'var(--t1)' }}>Documento de T&C activo</p>
              <p className="text-xs mt-0.5" style={{ color:'var(--t3)' }}>
                {tcVersion
                  ? `v${tcVersion.version} · ${tcVersion.file_name} · ${new Date(tcVersion.created_at).toLocaleDateString('es-MX')}`
                  : 'Sin documento publicado en Supabase'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <input ref={termsInputRef} type="file" accept="application/pdf" className="hidden"
              onChange={e => uploadTerms(e.target.files?.[0])}/>
            {tcVersion?.url && <a href={tcVersion.url} target="_blank" rel="noreferrer"
              className="btn-secondary text-xs"><Eye size={13}/> Ver PDF</a>}
            <button
              disabled={uploadingTerms}
              className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl font-semibold transition-all active:scale-95"
              style={{ background:'var(--info-soft)', border:'1px solid var(--info-line)', color:'var(--info)' }}
              onClick={() => termsInputRef.current?.click()}>
              <Upload size={13}/> {uploadingTerms ? 'Subiendo…' : 'Actualizar documento'}
            </button>
          </div>
        </div>
        {termsError && <p className="text-xs mt-3" style={{ color:'var(--bad)' }}>{termsError}</p>}
        <div className="mt-3 p-3 rounded-xl text-xs" style={{ background:'var(--warn-soft)', border:'1px solid var(--warn-line)', color:'var(--warn)' }}>
          <AlertTriangle size={12} className="inline mr-1.5 -mt-0.5"/>
          Actualizar el documento <strong>no invalida automáticamente</strong> las firmas existentes. Si el cambio es sustancial, resetea las firmas de los alumnos afectados para que vuelvan a firmar la versión nueva.
        </div>
      </div>

      <BarraFiltros
        filtros={[
          { id:'sucursal', label:'Sucursal', value:sucursal, onChange:setSucursal,
            porDefecto:sucursal, options:opcionesConTodas },
          { id:'grupo', label:'Grupo', tipo:'grupo', value:grupoFiltro, onChange:setGrupoFiltro,
            porDefecto:'todos', grupos:gruposEnSucursal, query:buscaGrupo, onQuery:setBuscaGrupo,
            nombreDe },
          { id:'estado', label:'Estado del expediente', value:filter, onChange:setFilter, porDefecto:'todos',
            options:[
              { value:'todos', label:'Todos' },
              { value:'revisar', label:`Por revisar (${porRevisar})` },
              { value:'firmado', label:'Firmados' },
              { value:'pendiente', label:'Sin firmar' },
              { value:'activo', label:'Acceso activo' },
            ] },
        ]}
        busqueda={{ value: search, onChange: setSearch, placeholder:'Buscar alumno…' }}
        resumen={`${filtered.length} alumno(s)`}/>

      {/* Tabla de alumnos. En pantalla chica las columnas de documentos se
          pliegan dentro de la celda del alumno: se ocultan como columna, no
          como acción, así que validar sigue al alcance en el teléfono. */}
      <DataTable columns={COLUMNS_TC}
        isEmpty={!loading && !loadError && filtered.length === 0}
        emptyIcon={<FileText size={36}/>}
        emptyText="Ningún alumno coincide con el filtro.">
        {loading ? <SkeletonRows/> : (
        <ProgressiveList items={filtered} sizes={{ mobile:5, tablet:10, desktop:15 }}
          emptyLabel="Ningún alumno coincide con el filtro.">
        {s => {
          const isSigned = s.termsStatus === 'firmado'
          const curp = s.documents?.find(d => d.document_type === 'curp')
          const ine  = s.documents?.find(d => d.document_type === 'ine_tutor')
          const gar  = s.documents?.find(d => d.document_type === 'garantia')
          const tyc  = s.documents?.find(d => d.document_type === 'terminos')
          const accesoActivo = s.accesoEstado === 'activo'

          /* Firma T&C — validarla es verla y, si no procede, resetearla.
             Quien firmó en papel entrega un PDF: se ofrece igual que la
             firma digital, porque para administración vale lo mismo. */
          const firma = (
            <div className="flex items-center gap-1">
              <span className="badge text-[10px] px-2 py-1 flex-shrink-0"
                style={isSigned ? estiloEstado('validado') : tyc ? { background:'var(--info-soft)', color:'var(--info)', border:'1px solid var(--info-line)' } : estiloEstado('entregado')}>
                {isSigned ? <CheckCircle2 size={10}/> : <Clock size={10}/>}
                {isSigned ? 'Firmado' : tyc ? 'En papel' : 'Pendiente'}
              </span>
              {tyc && (
                <button title="Ver PDF firmado a mano" aria-label="Ver PDF firmado a mano" onClick={() => verDocumento(tyc)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background:'var(--info-soft)', color:'var(--info)' }}>
                  <FileText size={12}/>
                </button>
              )}
              {isSigned && (
                <>
                  <button title="Ver firma" aria-label="Ver firma" onClick={() => setPreview(s)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-all active:scale-90"
                    style={{ background:'var(--info-soft)', color:'var(--info)' }}>
                    <Eye size={12}/>
                  </button>
                  <button title="Invalidar firma" aria-label="Invalidar firma" onClick={() => setConfirmReset(s.id)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-all active:scale-90"
                    style={{ background:'var(--bad-soft)', color:'var(--bad)' }}>
                    <Trash2 size={12}/>
                  </button>
                </>
              )}
            </div>
          )

          /* Garantía — llega por archivo o por firmas dibujadas */
          const garantia = (
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="lg:hidden text-[10px] font-bold uppercase tracking-wider w-20 flex-shrink-0"
                style={{ color:'var(--t3)' }}>Garantía</span>
              <span className="text-[11px] font-bold px-2 py-1 rounded-full flex-shrink-0"
                style={estiloEstado(s.garantiaEstado)}>
                {s.garantiaEstado === 'validada' ? 'Validada'
                  : s.garantiaEstado === 'entregada' ? 'Entregada' : '—'}
              </span>
              {gar && (
                <button title="Ver garantía subida" aria-label="Ver garantía subida" onClick={() => verDocumento(gar)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background:'var(--info-soft)', color:'var(--info)' }}>
                  <Eye size={12}/>
                </button>
              )}
              {(s.garantiaFirmaAlumno || s.garantiaFirmaTutor) && (
                <button title="Ver firmas de la garantía" aria-label="Ver firmas de la garantía" onClick={() => setGarantiaPreview(s)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background:'var(--soft-bg)', color:'var(--t2)', border:'1px solid var(--card-border)' }}>
                  <PenLine size={12}/>
                </button>
              )}
              {s.garantiaEstado === 'entregada' && (
                <button title="Validar garantía" aria-label="Validar garantía" disabled={ocupado === s.id}
                  onClick={() => aprobarGarantia(s.id)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 disabled:opacity-40"
                  style={{ background:'var(--good-soft)', color:'var(--good)' }}>
                  <Check size={12}/>
                </button>
              )}
            </div>
          )

          const celdaCurp = <CeldaDocumento etiqueta="CURP" doc={curp} onVer={verDocumento}
            onAprobar={aprobarDocumento} onRechazar={setRechazo} ocupado={ocupado}/>
          const celdaIne = <CeldaDocumento etiqueta="INE tutor" doc={ine} onVer={verDocumento}
            onAprobar={aprobarDocumento} onRechazar={setRechazo} ocupado={ocupado}/>

          return (
            <DataTableRow key={s.id} cells={[
              { className: 'flex-grow min-w-[150px]', content: (
                <div className="min-w-0 py-1">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <AvatarAlumno student={s} size={28}
                      style={{ background:'var(--soft-bg)', color:'var(--t2)' }}/>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color:'var(--t1)' }}>{s.name}</p>
                      <p className="text-[10px] truncate" style={{ color:'var(--t3)' }}>
                        {isSigned ? s.signedAt : 'Sin firmar'}
                      </p>
                    </div>
                  </div>
                  <div className="lg:hidden mt-2 space-y-1.5">
                    <div className="sm:hidden">{firma}</div>
                    {celdaCurp}
                    {celdaIne}
                    {garantia}
                  </div>
                </div>
              )},
              { className: 'w-40 hidden sm:flex', content: firma },
              { className: 'w-52 hidden lg:flex', content: celdaCurp },
              { className: 'w-52 hidden lg:flex', content: celdaIne },
              { className: 'w-52 hidden lg:flex', content: garantia },
              { className: 'w-24 flex', content: (
                /* Acceso — lo decide la BD al validar todo el expediente */
                <span className="badge text-[10px] px-2 py-1"
                  style={accesoActivo
                    ? { background:'var(--good-soft)', color:'var(--good)', border:'1px solid var(--good-line)' }
                    : { background:'var(--soft-bg)', color:'var(--t3)', border:'1px solid var(--divider)' }}>
                  {accesoActivo ? <ShieldCheck size={10}/> : <Clock size={10}/>}
                  {accesoActivo ? 'Activo' : 'Pendiente'}
                </span>
              )},
            ]}/>
          )
        }}
        </ProgressiveList>
        )}
      </DataTable>

      {/* Modal: ver firma — por portal, si no se posiciona contra el contenedor de página */}
      {preview && (
        <ModalPortal maxWidth="max-w-sm" onClose={() => setPreview(null)}>
          <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom:'1px solid var(--divider)' }}>
            <h2 className="text-sm font-bold" style={{ color:'var(--t1)' }}>Firma de {preview.name}</h2>
            <button onClick={() => setPreview(null)} aria-label="Cerrar"
              className="w-11 h-11 flex items-center justify-center rounded-lg" style={{ color:'var(--t3)' }}><X size={15}/></button>
          </div>
          <div className="p-5 space-y-4">
            {preview.signatureDataUrl
              ? <img src={preview.signatureDataUrl} alt="Firma" className="w-full rounded-xl" style={{ background:'#ffffff', border:'1px solid var(--card-border)' }}/>
              : <div className="h-28 rounded-xl flex items-center justify-center text-xs" style={{ background:'var(--soft-bg)', border:'1px dashed var(--card-border)', color:'var(--t3)' }}>
                  Firma registrada — preview no disponible en esta sesión
                </div>
            }
            <div className="space-y-1.5 text-xs" style={{ color:'var(--t3)' }}>
              <p><span style={{ color:'var(--t2)' }}>Fecha:</span> {preview.signedAt}</p>
              <p><span style={{ color:'var(--t2)' }}>CURP:</span> {preview.documents?.find(d=>d.document_type==='curp')?.status ?? 'sin entregar'}</p>
              <p><span style={{ color:'var(--t2)' }}>INE tutor:</span> {preview.documents?.find(d=>d.document_type==='ine_tutor')?.status ?? 'sin entregar'}</p>
              <p><span style={{ color:'var(--t2)' }}>Garantía:</span> {preview.garantiaEstado ?? 'pendiente'}</p>
            </div>
            <button
              onClick={() => { setConfirmReset(preview.id); setPreview(null) }}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all"
              style={DANGER_BTN_STYLE}>
              <Trash2 size={14}/> Resetear firma de este alumno
            </button>
          </div>
        </ModalPortal>
      )}


      {/* Modal: firmas de la garantía */}
      {garantiaPreview && (
        <ModalPortal maxWidth="max-w-md" onClose={() => setGarantiaPreview(null)}>
          <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom:'1px solid var(--divider)' }}>
            <h2 className="text-sm font-bold" style={{ color:'var(--t1)' }}>Garantía de {garantiaPreview.name}</h2>
            <button onClick={() => setGarantiaPreview(null)} aria-label="Cerrar"
              className="w-11 h-11 flex items-center justify-center rounded-lg" style={{ color:'var(--t3)' }}><X size={15}/></button>
          </div>
          <div className="p-5 space-y-4">
            {[['Firma del alumno', garantiaPreview.garantiaFirmaAlumno],
              ['Firma del tutor',  garantiaPreview.garantiaFirmaTutor]].map(([etiqueta, firma]) => (
              <div key={etiqueta}>
                <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color:'var(--t3)' }}>{etiqueta}</p>
                {firma
                  ? <img src={firma} alt={etiqueta} className="w-full rounded-xl"
                      style={{ background:'#ffffff', border:'1px solid var(--card-border)' }}/>
                  : <div className="h-20 rounded-xl flex items-center justify-center text-xs"
                      style={{ background:'var(--soft-bg)', border:'1px dashed var(--card-border)', color:'var(--t3)' }}>Sin firma dibujada</div>}
              </div>
            ))}
            {garantiaPreview.garantiaEstado === 'entregada' && (
              <button onClick={() => { aprobarGarantia(garantiaPreview.id); setGarantiaPreview(null) }}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold"
                style={{ background:'var(--good-soft)', border:'1px solid var(--good-line)', color:'var(--good)' }}>
                <Check size={13}/> Validar garantía
              </button>
            )}
          </div>
        </ModalPortal>
      )}

      {/* Modal: rechazar documento — el motivo es obligatorio porque el alumno
          lo va a leer en su portal y necesita saber qué corregir. */}
      {rechazo && (
        <ModalPortal maxWidth="max-w-sm" onClose={() => setRechazo(null)}>
          <div className="p-5 space-y-4">
            <div className="flex items-start gap-3">
              <AlertTriangle size={18} style={{ color:'var(--bad)', flexShrink:0, marginTop:2 }}/>
              <div>
                <p className="font-bold text-sm" style={{ color:'var(--t1)' }}>Rechazar documento</p>
                <p className="text-xs mt-1" style={{ color:'var(--t3)' }}>
                  {rechazo.doc.file_name} — el alumno verá el motivo y podrá volver a subirlo.
                </p>
              </div>
            </div>
            <textarea
              value={rechazo.motivo}
              onChange={e => setRechazo(r => ({ ...r, motivo: e.target.value }))}
              rows={3} autoFocus
              placeholder="Motivo del rechazo (p. ej. la foto está borrosa)"
              className="input-field resize-none"/>
            <div className="flex gap-3">
              <button onClick={() => setRechazo(null)} className="btn-secondary flex-1 justify-center">
                Cancelar
              </button>
              <button onClick={confirmarRechazo} disabled={!rechazo.motivo.trim() || ocupado === rechazo.doc.id}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold disabled:opacity-40"
                style={DANGER_BTN_STYLE}>
                Rechazar
              </button>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Modal: confirmar reset */}
      {confirmReset && (
        <ModalPortal maxWidth="max-w-sm" onClose={() => setConfirmReset(null)}>
          <div className="p-5 space-y-4">
            <div className="flex items-start gap-3">
              <AlertTriangle size={18} style={{ color:'var(--bad)', flexShrink:0, marginTop:2 }}/>
              <div>
                <p className="font-bold text-sm" style={{ color:'var(--t1)' }}>¿Resetear firma?</p>
                <p className="text-xs mt-1" style={{ color:'var(--t3)' }}>
                  Se eliminarán la firma digital, CURP e INE del alumno. Tendrá que volver a firmar.
                  Esta acción no se puede deshacer.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setConfirmReset(null)} className="btn-secondary flex-1 justify-center">
                Cancelar
              </button>
              <button onClick={() => resetSignature(confirmReset)} className="flex-1 py-2.5 rounded-xl text-sm font-bold" style={DANGER_BTN_STYLE}>
                Sí, resetear
              </button>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  )
}
