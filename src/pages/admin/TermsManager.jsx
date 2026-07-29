import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { fetchStudents, resetTerms } from '../../lib/supabaseData'
import {
  CheckCircle2, Clock, FileText, Trash2, Upload,
  Shield, AlertTriangle, Search, Eye, RefreshCw,
} from 'lucide-react'
import clsx from 'clsx'

const VERSION_MOCK = { version: '1.0', updatedAt: '31 de mayo de 2026', updatedBy: 'Prof. Mario Sánchez' }

export default function TermsManager() {
  const [list, setList]         = useState([])
  const [search, setSearch]     = useState('')
  const [filter, setFilter]     = useState('todos')
  const [preview, setPreview]   = useState(null)   // alumno seleccionado para ver firma
  const [tcVersion, setTcVersion] = useState(VERSION_MOCK)
  const [confirmReset, setConfirmReset] = useState(null) // id del alumno a resetear

  const signed   = list.filter(s => s.termsStatus === 'firmado').length
  const pending  = list.filter(s => s.termsStatus !== 'firmado').length

  const filtered = list.filter(s => {
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'todos' ? true
      : filter === 'firmado'   ? s.termsStatus === 'firmado'
      : s.termsStatus !== 'firmado'
    return matchSearch && matchFilter
  })

  const load = useCallback(async () => {
    try { setList(await fetchStudents()) } catch { /* lista vacía */ }
  }, [])

  useEffect(() => { load() }, [load])

  const resetSignature = async (id) => {
    setConfirmReset(null)
    if (preview?.id === id) setPreview(null)
    setList(prev => prev.map(s =>
      s.id === id
        ? { ...s, termsStatus:'pendiente', signatureDataUrl:null, signedAt:null, curpDoc:null, ineTutorDoc:null }
        : s
    ))
    try { await resetTerms(id) } catch { load() }   // si falla, se recarga el estado real
  }

  return (
    <div className="max-w-5xl space-y-5">
      <div>
        <h1 className="page-title">Gestión de T&C</h1>
        <p className="text-sm mt-1" style={{ color:'rgba(255,255,255,.38)' }}>
          Administra términos, firmas y documentos de los alumnos.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label:'Total alumnos', value: list.length, color:'rgba(255,255,255,.70)', border:'rgba(255,255,255,.08)' },
          { label:'Firmados',      value: signed,       color:'#34d399',               border:'rgba(52,211,153,.25)' },
          { label:'Pendientes',    value: pending,      color:'#fbbf24',               border:'rgba(251,191,36,.25)' },
        ].map(({ label, value, color, border }) => (
          <div key={label} className="stat-card" style={{ borderColor: border }}>
            <p className="text-2xl sm:text-3xl font-bold" style={{ color }}>{value}</p>
            <p className="text-xs mt-1 font-medium" style={{ color:'rgba(255,255,255,.40)' }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Documento T&C — versión activa */}
      <div className="card p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background:'rgba(96,165,250,.12)', border:'1px solid rgba(96,165,250,.22)' }}>
              <FileText size={18} style={{ color:'#60a5fa' }}/>
            </div>
            <div>
              <p className="text-sm font-bold" style={{ color:'rgba(255,255,255,.85)' }}>Documento de T&C activo</p>
              <p className="text-xs mt-0.5" style={{ color:'rgba(255,255,255,.35)' }}>
                v{tcVersion.version} · Actualizado {tcVersion.updatedAt} · por {tcVersion.updatedBy}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl font-semibold transition-all active:scale-95"
              style={{ background:'rgba(96,165,250,.10)', border:'1px solid rgba(96,165,250,.20)', color:'#60a5fa' }}
              onClick={() => alert('Upload T&C — conectar a backend')}>
              <Upload size={13}/> Actualizar documento
            </button>
          </div>
        </div>
        <div className="mt-3 p-3 rounded-xl text-xs" style={{ background:'rgba(251,191,36,.06)', border:'1px solid rgba(251,191,36,.15)', color:'rgba(251,191,36,.80)' }}>
          <AlertTriangle size={12} className="inline mr-1.5 -mt-0.5"/>
          Actualizar el documento <strong>no invalida automáticamente</strong> las firmas existentes. Si el cambio es sustancial, resetea las firmas de los alumnos afectados para que vuelvan a firmar la versión nueva.
        </div>
      </div>

      {/* Barra de búsqueda + filtro */}
      <div className="flex gap-2">
        <div className="flex-1 flex items-center gap-2 px-3 rounded-xl"
          style={{ background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.09)' }}>
          <Search size={14} style={{ color:'rgba(255,255,255,.30)', flexShrink:0 }}/>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar alumno…"
            className="flex-1 bg-transparent py-2.5 text-sm outline-none"
            style={{ color:'rgba(255,255,255,.80)', caretColor:'white' }}
          />
        </div>
        <select
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="text-xs font-semibold px-3 py-2 rounded-xl appearance-none cursor-pointer"
          style={{ background:'rgba(255,255,255,.07)', border:'1px solid rgba(255,255,255,.11)', color:'rgba(255,255,255,.70)', outline:'none' }}>
          <option value="todos">Todos</option>
          <option value="firmado">Firmados</option>
          <option value="pendiente">Pendientes</option>
        </select>
      </div>

      {/* Tabla de alumnos */}
      <div className="card overflow-hidden">
        {/* Header */}
        <div className="grid gap-4 px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest"
          style={{
            gridTemplateColumns:'1fr 100px 100px 100px 80px',
            color:'rgba(255,255,255,.28)',
            background:'rgba(5,5,10,.60)',
            borderBottom:'1px solid rgba(255,255,255,.07)',
          }}>
          <span>Alumno</span>
          <span className="hidden sm:block">Estado</span>
          <span className="hidden md:block">CURP</span>
          <span className="hidden md:block">INE tutor</span>
          <span>Acciones</span>
        </div>

        {filtered.length === 0 && (
          <div className="py-12 text-center text-sm" style={{ color:'rgba(255,255,255,.25)' }}>
            Sin resultados
          </div>
        )}

        {filtered.map((s, i) => {
          const isSigned = s.termsStatus === 'firmado'
          return (
            <div key={s.id}
              className="grid gap-4 px-4 py-3 items-center transition-colors hover:bg-white/[.025]"
              style={{
                gridTemplateColumns:'1fr 100px 100px 100px 80px',
                borderBottom: i < filtered.length - 1 ? '1px solid rgba(255,255,255,.05)' : 'none',
              }}>

              {/* Nombre */}
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ background:'rgba(255,255,255,.08)', color:'rgba(255,255,255,.60)' }}>
                  {s.name.split(' ').slice(0,2).map(n=>n[0]).join('')}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color:'rgba(255,255,255,.78)' }}>{s.name}</p>
                  {isSigned && (
                    <p className="text-[10px] truncate" style={{ color:'rgba(255,255,255,.28)' }}>{s.signedAt}</p>
                  )}
                </div>
              </div>

              {/* Estado */}
              <div className="hidden sm:flex">
                <span className={clsx(
                  'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold',
                  isSigned
                    ? 'bg-emerald-500/12 text-emerald-400 border border-emerald-500/25'
                    : 'bg-amber-500/12  text-amber-400  border border-amber-500/25'
                )}>
                  {isSigned ? <CheckCircle2 size={11}/> : <Clock size={11}/>}
                  {isSigned ? 'Firmado' : 'Pendiente'}
                </span>
              </div>

              {/* CURP */}
              <div className="hidden md:flex items-center">
                {s.curpDoc
                  ? <span className="text-xs truncate max-w-[90px]" title={s.curpDoc} style={{ color:'#34d399' }}>{s.curpDoc}</span>
                  : <span className="text-xs" style={{ color:'rgba(255,255,255,.22)' }}>—</span>
                }
              </div>

              {/* INE */}
              <div className="hidden md:flex items-center">
                {s.ineTutorDoc
                  ? <span className="text-xs truncate max-w-[90px]" title={s.ineTutorDoc} style={{ color:'#34d399' }}>{s.ineTutorDoc}</span>
                  : <span className="text-xs" style={{ color:'rgba(255,255,255,.22)' }}>—</span>
                }
              </div>

              {/* Acciones */}
              <div className="flex items-center gap-1">
                {isSigned && (
                  <button
                    title="Ver firma"
                    onClick={() => setPreview(s)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center transition-all active:scale-90"
                    style={{ background:'rgba(96,165,250,.10)', color:'#60a5fa' }}
                    onMouseEnter={e => e.currentTarget.style.background='rgba(96,165,250,.18)'}
                    onMouseLeave={e => e.currentTarget.style.background='rgba(96,165,250,.10)'}>
                    <Eye size={13}/>
                  </button>
                )}
                {isSigned && (
                  <button
                    title="Resetear firma"
                    onClick={() => setConfirmReset(s.id)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center transition-all active:scale-90"
                    style={{ background:'rgba(248,113,113,.10)', color:'#f87171' }}
                    onMouseEnter={e => e.currentTarget.style.background='rgba(248,113,113,.18)'}
                    onMouseLeave={e => e.currentTarget.style.background='rgba(248,113,113,.10)'}>
                    <Trash2 size={13}/>
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Modal: ver firma — por portal, si no se posiciona contra el contenedor de página */}
      {preview && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setPreview(null)}>
          <div className="w-full max-w-sm rounded-2xl p-5 space-y-4" style={{ background:'rgba(12,12,20,.97)', border:'1px solid rgba(255,255,255,.12)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="font-bold text-sm" style={{ color:'rgba(255,255,255,.85)' }}>Firma de {preview.name}</p>
              <button onClick={() => setPreview(null)} className="text-xs" style={{ color:'rgba(255,255,255,.35)' }}>✕ Cerrar</button>
            </div>
            {preview.signatureDataUrl
              ? <img src={preview.signatureDataUrl} alt="Firma" className="w-full rounded-xl" style={{ background:'rgba(255,255,255,.03)', border:'1px solid rgba(255,255,255,.07)' }}/>
              : <div className="h-28 rounded-xl flex items-center justify-center text-xs" style={{ background:'rgba(255,255,255,.03)', color:'rgba(255,255,255,.30)' }}>
                  Firma registrada — preview no disponible en esta sesión
                </div>
            }
            <div className="space-y-1.5 text-xs" style={{ color:'rgba(255,255,255,.40)' }}>
              <p><span style={{ color:'rgba(255,255,255,.55)' }}>Fecha:</span> {preview.signedAt}</p>
              <p><span style={{ color:'rgba(255,255,255,.55)' }}>CURP:</span> {preview.curpDoc ?? '—'}</p>
              <p><span style={{ color:'rgba(255,255,255,.55)' }}>INE tutor:</span> {preview.ineTutorDoc ?? '—'}</p>
            </div>
            <button
              onClick={() => { setConfirmReset(preview.id); setPreview(null) }}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold transition-all"
              style={{ background:'rgba(248,113,113,.10)', border:'1px solid rgba(248,113,113,.20)', color:'#f87171' }}>
              <Trash2 size={13}/> Resetear firma de este alumno
            </button>
          </div>
        </div>,
        document.body,
      )}

      {/* Modal: confirmar reset */}
      {confirmReset && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setConfirmReset(null)}>
          <div className="w-full max-w-xs rounded-2xl p-5 space-y-4" style={{ background:'rgba(12,12,20,.97)', border:'1px solid rgba(248,113,113,.20)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              <AlertTriangle size={18} style={{ color:'#f87171', flexShrink:0, marginTop:2 }}/>
              <div>
                <p className="font-bold text-sm" style={{ color:'rgba(255,255,255,.85)' }}>¿Resetear firma?</p>
                <p className="text-xs mt-1" style={{ color:'rgba(255,255,255,.42)' }}>
                  Se eliminarán la firma digital, CURP e INE del alumno. Tendrá que volver a firmar.
                  Esta acción no se puede deshacer.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setConfirmReset(null)} className="flex-1 py-2 rounded-xl text-xs font-semibold" style={{ background:'rgba(255,255,255,.07)', border:'1px solid rgba(255,255,255,.10)', color:'rgba(255,255,255,.60)' }}>
                Cancelar
              </button>
              <button onClick={() => resetSignature(confirmReset)} className="flex-1 py-2 rounded-xl text-xs font-bold" style={{ background:'rgba(248,113,113,.15)', border:'1px solid rgba(248,113,113,.25)', color:'#f87171' }}>
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
