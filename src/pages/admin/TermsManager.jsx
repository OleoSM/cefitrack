import { useState, useEffect, useCallback, useRef } from 'react'
import AvatarAlumno from '../../components/ui/AvatarAlumno'
import { createPortal } from 'react-dom'
import { fetchStudents, resetTerms } from '../../lib/supabaseData'
import {
  CheckCircle2, Clock, FileText, Trash2, Upload, Check, X, PenLine,
  Shield, AlertTriangle, Search, Eye, RefreshCw, ShieldCheck,
} from 'lucide-react'
import clsx from 'clsx'
import KpiCard from '../../components/ui/KpiCard'
import ProgressiveList, { FilterBar } from '../../components/ui/ProgressiveList'
import ModalPortal from '../../components/ui/ModalPortal'
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
      <span className="md:hidden text-[10px] font-bold uppercase tracking-wider w-20 flex-shrink-0"
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

export default function TermsManager() {
  const [list, setList]         = useState([])
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

  const signed   = list.filter(s => s.termsStatus === 'firmado').length
  const pending  = list.filter(s => s.termsStatus !== 'firmado').length
  const activos  = list.filter(s => s.accesoEstado === 'activo').length
  /* El trabajo pendiente del administrador es lo que llegó y nadie ha mirado.
     Es el número que decide si hay que entrar a esta pantalla hoy. */
  const porRevisar = list.reduce((n, s) =>
    n + (s.documents?.filter(d => d.status === 'entregado').length ?? 0)
      + (s.garantiaEstado === 'entregada' ? 1 : 0), 0)

  const filtered = list.filter(s => {
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
      const students = await fetchStudents()
      const docs = await fetchDocumentosAlumnos(students.map(s=>s.id))
      setList(students.map(s=>({ ...s, documents:docs.filter(d=>d.student_id===s.id) })))
    } catch { /* lista vacía */ }
  }, [])

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
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Gestión de T&C</h1>
        <p className="text-sm mt-1" style={{ color:'var(--t3)' }}>
          Administra términos, firmas y documentos de los alumnos.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label:'Firmados', value:signed, icon:CheckCircle2, tone:'good' },
          { label:'Sin firmar', value:pending, icon:Clock, tone:'warn' },
          { label:'Por revisar', value:porRevisar, icon:AlertTriangle, tone:'warn' },
          { label:'Acceso activo', value:activos, icon:ShieldCheck, tone:'good' },
        ].map(kpi => (
          <KpiCard key={kpi.label} {...kpi}/>
        ))}
      </div>

      {aviso && (
        <div role="alert" className="flex items-start gap-2 rounded-xl px-3 py-2.5"
          style={{ background:'var(--bad-soft)', border:'1px solid var(--bad-line)' }}>
          <AlertTriangle size={14} style={{ color:'var(--bad)', flexShrink:0, marginTop:1 }}/>
          <span className="text-xs flex-1" style={{ color:'var(--bad)' }}>{aviso}</span>
          <button onClick={() => setAviso('')} style={{ color:'var(--t3)' }}><X size={13}/></button>
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
              style={{ background:'var(--info-soft)', border:'1px solid var(--info-soft)', color:'var(--info)' }}
              onClick={() => termsInputRef.current?.click()}>
              <Upload size={13}/> {uploadingTerms ? 'Subiendo…' : 'Actualizar documento'}
            </button>
          </div>
        </div>
        {termsError && <p className="text-xs mt-3" style={{ color:'var(--bad)' }}>{termsError}</p>}
        <div className="mt-3 p-3 rounded-xl text-xs" style={{ background:'var(--warn-soft)', border:'1px solid var(--warn-soft)', color:'var(--warn-line)' }}>
          <AlertTriangle size={12} className="inline mr-1.5 -mt-0.5"/>
          Actualizar el documento <strong>no invalida automáticamente</strong> las firmas existentes. Si el cambio es sustancial, resetea las firmas de los alumnos afectados para que vuelvan a firmar la versión nueva.
        </div>
      </div>

      {/* Barra de búsqueda + filtro */}
      <FilterBar activos={(search ? 1 : 0) + (filter !== 'todos' ? 1 : 0)}>
        <div className="flex-1 min-w-[180px] flex items-center gap-2 px-3 rounded-xl"
          style={{ background:'var(--soft-bg)', border:'1px solid var(--card-border)' }}>
          <Search size={14} style={{ color:'var(--t3)', flexShrink:0 }}/>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar alumno…"
            className="flex-1 bg-transparent py-2.5 text-sm outline-none"
            style={{ color:'var(--t1)', caretColor:'var(--t1)' }}
          />
        </div>
        <select
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="text-xs font-semibold px-3 py-2 rounded-xl appearance-none cursor-pointer"
          style={{ background:'var(--soft-bg)', border:'1px solid var(--card-border)', color:'var(--t1)', outline:'none' }}>
          <option value="todos">Todos</option>
          <option value="revisar">Por revisar ({porRevisar})</option>
          <option value="firmado">Firmados</option>
          <option value="pendiente">Sin firmar</option>
          <option value="activo">Acceso activo</option>
        </select>
      </FilterBar>

      {/* Tabla de alumnos */}
      <div className="card overflow-hidden">
        {/* Header */}
        <div className="hidden md:grid gap-3 px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest"
          style={{
            gridTemplateColumns:'minmax(0,1.4fr) 110px 1fr 1fr 1fr 110px',
            color:'var(--t3)',
            background:'var(--header-bg)',
            borderBottom:'1px solid var(--divider)',
          }}>
          <span>Alumno</span>
          <span>Firma T&C</span>
          <span>CURP</span>
          <span>INE tutor</span>
          <span>Garantía</span>
          <span>Acceso</span>
        </div>

        <ProgressiveList items={filtered} sizes={{ mobile:5, tablet:10, desktop:15 }}
          emptyLabel="Sin resultados">
        {(s, i) => {
          const isSigned = s.termsStatus === 'firmado'
          const curp = s.documents?.find(d => d.document_type === 'curp')
          const ine  = s.documents?.find(d => d.document_type === 'ine_tutor')
          const gar  = s.documents?.find(d => d.document_type === 'garantia')
          const tyc  = s.documents?.find(d => d.document_type === 'terminos')
          const accesoActivo = s.accesoEstado === 'activo'
          return (
            <div key={s.id}
              className="grid gap-3 px-4 py-3 md:items-center transition-colors hover:bg-white/[.025]"
              style={{
                gridTemplateColumns:'minmax(0,1fr)',
                borderBottom: i < filtered.length - 1 ? '1px solid var(--divider)' : 'none',
              }}>
              <div className="md:grid md:gap-3 md:items-center space-y-2.5 md:space-y-0"
                style={{ gridTemplateColumns:'minmax(0,1.4fr) 110px 1fr 1fr 1fr 110px' }}>

                {/* Nombre */}
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

                {/* Firma T&C — validarla es verla y, si no procede, resetearla.
                    Quien firmó en papel entrega un PDF: se ofrece igual que la
                    firma digital, porque para administración vale lo mismo. */}
                <div className="flex items-center gap-1">
                  <span className={clsx(
                    'inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold',
                    isSigned
                      ? 'bg-emerald-500/12 text-emerald-400 border border-emerald-500/25'
                      : tyc
                        ? 'bg-blue-500/12 text-blue-400 border border-blue-500/25'
                        : 'bg-amber-500/12  text-amber-400  border border-amber-500/25'
                  )}>
                    {isSigned ? <CheckCircle2 size={10}/> : <Clock size={10}/>}
                    {isSigned ? 'Firmado' : tyc ? 'En papel' : 'Pendiente'}
                  </span>
                  {tyc && (
                    <button title="Ver PDF firmado a mano" onClick={() => verDocumento(tyc)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center"
                      style={{ background:'var(--info-soft)', color:'var(--info)' }}>
                      <FileText size={12}/>
                    </button>
                  )}
                  {isSigned && (
                    <>
                      <button title="Ver firma" onClick={() => setPreview(s)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center transition-all active:scale-90"
                        style={{ background:'var(--info-soft)', color:'var(--info)' }}>
                        <Eye size={12}/>
                      </button>
                      <button title="Invalidar firma" onClick={() => setConfirmReset(s.id)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center transition-all active:scale-90"
                        style={{ background:'var(--bad-soft)', color:'var(--bad)' }}>
                        <Trash2 size={12}/>
                      </button>
                    </>
                  )}
                </div>

                <CeldaDocumento etiqueta="CURP" doc={curp} onVer={verDocumento}
                  onAprobar={aprobarDocumento} onRechazar={setRechazo} ocupado={ocupado}/>
                <CeldaDocumento etiqueta="INE tutor" doc={ine} onVer={verDocumento}
                  onAprobar={aprobarDocumento} onRechazar={setRechazo} ocupado={ocupado}/>

                {/* Garantía — llega por archivo o por firmas dibujadas */}
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="md:hidden text-[10px] font-bold uppercase tracking-wider w-20 flex-shrink-0"
                    style={{ color:'var(--t3)' }}>Garantía</span>
                  <span className="text-[11px] font-bold px-2 py-1 rounded-full flex-shrink-0"
                    style={estiloEstado(s.garantiaEstado)}>
                    {s.garantiaEstado === 'validada' ? 'Validada'
                      : s.garantiaEstado === 'entregada' ? 'Entregada' : '—'}
                  </span>
                  {gar && (
                    <button title="Ver garantía subida" onClick={() => verDocumento(gar)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background:'var(--info-soft)', color:'var(--info)' }}>
                      <Eye size={12}/>
                    </button>
                  )}
                  {(s.garantiaFirmaAlumno || s.garantiaFirmaTutor) && (
                    <button title="Ver firmas de la garantía" onClick={() => setGarantiaPreview(s)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background:'var(--soft-bg)', color:'var(--t2)', border:'1px solid var(--card-border)' }}>
                      <PenLine size={12}/>
                    </button>
                  )}
                  {s.garantiaEstado === 'entregada' && (
                    <button title="Validar garantía" disabled={ocupado === s.id}
                      onClick={() => aprobarGarantia(s.id)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 disabled:opacity-40"
                      style={{ background:'var(--good-soft)', color:'var(--good)' }}>
                      <Check size={12}/>
                    </button>
                  )}
                </div>

                {/* Acceso — lo decide la BD al validar todo el expediente */}
                <div className="flex items-center">
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold"
                    style={accesoActivo
                      ? { background:'var(--good-soft)', color:'var(--good)', border:'1px solid var(--good-line)' }
                      : { background:'var(--soft-bg)', color:'var(--t3)', border:'1px solid var(--divider)' }}>
                    {accesoActivo ? <ShieldCheck size={10}/> : <Clock size={10}/>}
                    {accesoActivo ? 'Activo' : 'Pendiente'}
                  </span>
                </div>
              </div>
            </div>
          )
        }}
        </ProgressiveList>
      </div>

      {/* Modal: ver firma — por portal, si no se posiciona contra el contenedor de página */}
      {preview && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setPreview(null)}>
          <div className="w-full max-w-sm rounded-2xl p-5 space-y-4" style={{ background:'var(--panel-bg)', border:'1px solid var(--card-border)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="font-bold text-sm" style={{ color:'var(--t1)' }}>Firma de {preview.name}</p>
              <button onClick={() => setPreview(null)} className="text-xs" style={{ color:'var(--t3)' }}>✕ Cerrar</button>
            </div>
            {preview.signatureDataUrl
              ? <img src={preview.signatureDataUrl} alt="Firma" className="w-full rounded-xl" style={{ background:'var(--card-bg)', border:'1px solid var(--card-border)' }}/>
              : <div className="h-28 rounded-xl flex items-center justify-center text-xs" style={{ background:'var(--card-bg)', color:'var(--t3)' }}>
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
              className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold transition-all"
              style={{ background:'var(--bad-soft)', border:'1px solid var(--bad-soft)', color:'var(--bad)' }}>
              <Trash2 size={13}/> Resetear firma de este alumno
            </button>
          </div>
        </div>,
        document.body,
      )}


      {/* Modal: firmas de la garantía */}
      {garantiaPreview && (
        <ModalPortal maxWidth="max-w-md" onClose={() => setGarantiaPreview(null)}>
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <p className="font-bold text-sm" style={{ color:'var(--t1)' }}>Garantía de {garantiaPreview.name}</p>
              <button onClick={() => setGarantiaPreview(null)} style={{ color:'var(--t3)' }}><X size={14}/></button>
            </div>
            {[['Firma del alumno', garantiaPreview.garantiaFirmaAlumno],
              ['Firma del tutor',  garantiaPreview.garantiaFirmaTutor]].map(([etiqueta, firma]) => (
              <div key={etiqueta}>
                <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color:'var(--t3)' }}>{etiqueta}</p>
                {firma
                  ? <img src={firma} alt={etiqueta} className="w-full rounded-xl"
                      style={{ background:'var(--card-bg)', border:'1px solid var(--card-border)' }}/>
                  : <div className="h-20 rounded-xl flex items-center justify-center text-xs"
                      style={{ background:'var(--card-bg)', color:'var(--t3)' }}>Sin firma dibujada</div>}
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
              className="w-full text-sm rounded-xl py-2.5 px-3 outline-none resize-none"
              style={{ background:'var(--soft-bg)', border:'1px solid var(--card-border)', color:'var(--t1)' }}/>
            <div className="flex gap-2">
              <button onClick={() => setRechazo(null)} className="flex-1 py-2.5 rounded-xl text-xs font-semibold"
                style={{ background:'var(--soft-bg)', border:'1px solid var(--card-border)', color:'var(--t2)' }}>
                Cancelar
              </button>
              <button onClick={confirmarRechazo} disabled={!rechazo.motivo.trim() || ocupado === rechazo.doc.id}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold disabled:opacity-40"
                style={{ background:'var(--bad-soft)', border:'1px solid var(--bad-line)', color:'var(--bad)' }}>
                Rechazar
              </button>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Modal: confirmar reset */}
      {confirmReset && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setConfirmReset(null)}>
          <div className="w-full max-w-xs rounded-2xl p-5 space-y-4" style={{ background:'var(--panel-bg)', border:'1px solid var(--bad-soft)' }} onClick={e => e.stopPropagation()}>
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
            <div className="flex gap-2">
              <button onClick={() => setConfirmReset(null)} className="flex-1 py-2 rounded-xl text-xs font-semibold" style={{ background:'var(--soft-bg)', border:'1px solid var(--card-border)', color:'var(--t2)' }}>
                Cancelar
              </button>
              <button onClick={() => resetSignature(confirmReset)} className="flex-1 py-2 rounded-xl text-xs font-bold" style={{ background:'var(--bad-soft)', border:'1px solid var(--bad-line)', color:'var(--bad)' }}>
                Sí, resetear
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
