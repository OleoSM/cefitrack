import { useState, useRef } from 'react'
import { Upload, FileText, CheckCircle, X, Download, AlertCircle, Users, KeyRound } from 'lucide-react'
import { importHistory, users } from '../../data/mockData'
import { DataTable, DataTableRow } from '../../components/ui/DataTable'
import { generarCredenciales, exportCredencialesExcel } from '../../lib/credentials'

const CSV_TEMPLATE = `nombre,email,grupo,contacto_nombre,contacto_email,contacto_telefono
Ana García López,ana.garcia@edutrack.mx,g1,Carmen López,carmen@gmail.com,555-0101
Carlos Martínez,carlos.mtz@edutrack.mx,g2,Roberto Martínez,roberto@gmail.com,555-0102`

const CSV_HEADERS = ['nombre','email','grupo','contacto_nombre','contacto_email','contacto_telefono']

function parseCSV(text) {
  const lines = text.trim().split('\n')
  const headers = lines[0].split(',').map(h => h.trim())
  return lines.slice(1).map(line => {
    const vals = line.split(',').map(v => v.trim())
    return Object.fromEntries(headers.map((h, i) => [h, vals[i] || '']))
  }).filter(r => r.nombre)
}

function downloadTemplate() {
  const blob = new Blob([CSV_TEMPLATE], { type:'text/csv' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'plantilla_alumnos.csv'
  a.click()
}

export default function ImportStudents() {
  const [drag, setDrag]           = useState(false)
  const [file, setFile]           = useState(null)
  const [preview, setPreview]     = useState(null)
  const [error, setError]         = useState('')
  const [importing, setImporting] = useState(false)
  const [done, setDone]           = useState(false)
  const [history, setHistory]     = useState(importHistory)
  const [creds, setCreds]         = useState(null)
  const inputRef = useRef()

  const processFile = f => {
    setError(''); setDone(false)
    if (!f.name.endsWith('.csv')) { setError('Solo se aceptan archivos .csv'); return }
    setFile(f)
    const reader = new FileReader()
    reader.onload = e => {
      try {
        const parsed = parseCSV(e.target.result)
        if (parsed.length === 0) { setError('El archivo está vacío o mal formateado.'); return }
        setPreview(parsed)
      } catch { setError('Error al leer el archivo. Verifica el formato.') }
    }
    reader.readAsText(f)
  }

  const handleDrop = e => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) processFile(f) }
  const handleInput = e => { if (e.target.files[0]) processFile(e.target.files[0]) }

  const handleImport = async () => {
    setImporting(true)
    await new Promise(r => setTimeout(r, 1500))

    // Credenciales predefinidas por el sistema — el alumno no puede crear contraseña
    const generated = generarCredenciales(preview)
    generated.forEach((c, i) => {
      users.push({
        id: `u-imp-${Date.now()}-${i}`,
        name: c.nombre,
        email: c.email || c.usuario,
        usuario: c.usuario,
        password: c.password,
        role: 'student',
      })
    })
    setCreds(generated)

    setImporting(false); setDone(true)
    setHistory(h => [
      { id:`imp${Date.now()}`, fecha:new Date().toISOString().split('T')[0], archivo:file.name, alumnos:preview.length, estado:'completado' },
      ...h
    ])
  }

  const reset = () => { setFile(null); setPreview(null); setError(''); setDone(false); setCreds(null) }

  return (
    <div className="max-w-4xl space-y-6">

      {/* ── Header card ─────────────────────────────────────── */}
      <div className="card p-5">
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background:'rgba(255,255,255,.08)', border:'1px solid rgba(255,255,255,.10)' }}>
            <Upload size={20} style={{ color:'rgba(255,255,255,.60)' }}/>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold" style={{ color:'rgba(255,255,255,.90)' }}>
              Importar Lista de Alumnos
            </h2>
            <p className="text-sm mt-0.5" style={{ color:'rgba(255,255,255,.45)' }}>
              Sube un archivo CSV para registrar alumnos automáticamente. El sistema detecta duplicados.
            </p>
          </div>
          <button onClick={downloadTemplate} className="btn-secondary flex-shrink-0">
            <Download size={13}/> Descargar plantilla
          </button>
        </div>

        {/* Formato CSV */}
        <div className="mt-4 p-3 rounded-xl"
          style={{ background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.07)' }}>
          <p className="text-[10px] font-bold uppercase tracking-widest mb-2"
            style={{ color:'rgba(255,255,255,.30)' }}>
            Formato requerido del CSV
          </p>
          <div className="flex flex-wrap gap-1.5">
            {CSV_HEADERS.map(h => (
              <code key={h}
                className="text-[11px] font-mono px-2 py-0.5 rounded-md"
                style={{ background:'rgba(255,255,255,.07)', border:'1px solid rgba(255,255,255,.10)', color:'rgba(255,255,255,.65)' }}>
                {h}
              </code>
            ))}
          </div>
          <p className="text-[11px] mt-2" style={{ color:'rgba(255,255,255,.28)' }}>
            El campo "grupo" acepta: g1, g2, g3
          </p>
        </div>
      </div>

      {/* ── Dropzone ────────────────────────────────────────── */}
      {!preview && !done && (
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDrag(true) }}
          onDragLeave={() => setDrag(false)}
          onDrop={handleDrop}
          className="rounded-2xl p-10 text-center cursor-pointer transition-all duration-200"
          style={{
            border: `2px dashed ${drag ? 'rgba(255,255,255,.35)' : 'rgba(255,255,255,.12)'}`,
            background: drag ? 'rgba(255,255,255,.06)' : 'rgba(255,255,255,.02)',
          }}
          onMouseEnter={e => { if (!drag) e.currentTarget.style.background = 'rgba(255,255,255,.04)' }}
          onMouseLeave={e => { if (!drag) e.currentTarget.style.background = 'rgba(255,255,255,.02)' }}>
          <input ref={inputRef} type="file" accept=".csv" className="hidden" onChange={handleInput}/>
          <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center transition-all"
            style={{ background: drag ? 'rgba(255,255,255,.12)' : 'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.10)' }}>
            <Upload size={26} style={{ color: drag ? 'rgba(255,255,255,.80)' : 'rgba(255,255,255,.35)' }}/>
          </div>
          <p className="font-semibold text-base" style={{ color:'rgba(255,255,255,.75)' }}>
            {drag ? 'Suelta el archivo aquí' : 'Arrastra tu archivo CSV aquí'}
          </p>
          <p className="text-sm mt-1" style={{ color:'rgba(255,255,255,.35)' }}>o haz clic para seleccionarlo</p>
          <p className="text-xs mt-3" style={{ color:'rgba(255,255,255,.20)' }}>Solo archivos .csv</p>
        </div>
      )}

      {/* ── Error ───────────────────────────────────────────── */}
      {error && (
        <div className="flex items-center gap-3 rounded-xl px-4 py-3"
          style={{ background:'rgba(239,68,68,.10)', border:'1px solid rgba(239,68,68,.22)', color:'rgba(252,165,165,.90)' }}>
          <AlertCircle size={15} className="flex-shrink-0"/>
          <span className="text-sm flex-1">{error}</span>
          <button onClick={reset}
            className="p-1 rounded-lg transition-colors"
            style={{ color:'rgba(252,165,165,.60)' }}
            onMouseEnter={e => e.currentTarget.style.color='rgba(252,165,165,.90)'}
            onMouseLeave={e => e.currentTarget.style.color='rgba(252,165,165,.60)'}>
            <X size={14}/>
          </button>
        </div>
      )}

      {/* ── Preview ─────────────────────────────────────────── */}
      {preview && !done && (
        <div className="card overflow-hidden">
          {/* Header del preview */}
          <div className="px-5 py-3.5 flex items-center justify-between"
            style={{ borderBottom:'1px solid rgba(255,255,255,.07)', background:'rgba(255,255,255,.03)' }}>
            <div className="flex items-center gap-2.5 min-w-0">
              <FileText size={14} style={{ color:'rgba(255,255,255,.40)', flexShrink:0 }}/>
              <span className="text-sm font-semibold truncate" style={{ color:'rgba(255,255,255,.80)' }}>
                {file?.name}
              </span>
              <span className="badge bg-blue-500/15 text-blue-400 border border-blue-500/25 flex-shrink-0">
                {preview.length} alumnos
              </span>
            </div>
            <button onClick={reset}
              className="p-1.5 rounded-lg transition-colors flex-shrink-0"
              style={{ color:'rgba(255,255,255,.35)' }}
              onMouseEnter={e => { e.currentTarget.style.color='rgba(255,255,255,.75)'; e.currentTarget.style.background='rgba(255,255,255,.08)' }}
              onMouseLeave={e => { e.currentTarget.style.color='rgba(255,255,255,.35)'; e.currentTarget.style.background='transparent' }}>
              <X size={14}/>
            </button>
          </div>

          {/* Tabla preview */}
          <div className="max-h-72 overflow-y-auto">
            <DataTable
              columns={CSV_HEADERS.map(h => ({
                key: h, label: h,
                className: h === 'nombre' || h === 'email' ? 'flex-grow min-w-[140px]' : 'w-32',
              }))}>
              {preview.map((row, i) => (
                <DataTableRow key={i}
                  cells={CSV_HEADERS.map(h => ({
                    className: h === 'nombre' || h === 'email' ? 'flex-grow min-w-[140px]' : 'w-32',
                    content: (
                      <span className="text-xs font-mono truncate"
                        style={{ color: row[h] ? 'rgba(255,255,255,.70)' : 'rgba(248,113,113,.80)', fontStyle: row[h] ? 'normal' : 'italic' }}>
                        {row[h] || '—'}
                      </span>
                    ),
                  }))}
                />
              ))}
            </DataTable>
          </div>

          {/* Footer del preview */}
          <div className="px-5 py-3.5 flex items-center justify-between gap-3"
            style={{ borderTop:'1px solid rgba(255,255,255,.07)' }}>
            <p className="text-xs" style={{ color:'rgba(255,255,255,.38)' }}>
              Se agregarán <span className="font-bold" style={{ color:'rgba(255,255,255,.70)' }}>{preview.length}</span> alumnos al sistema.
            </p>
            <div className="flex gap-2 flex-shrink-0">
              <button onClick={reset} className="btn-secondary text-sm py-2">Cancelar</button>
              <button onClick={handleImport} disabled={importing} className="btn-primary text-sm py-2">
                {importing
                  ? <><span className="w-3.5 h-3.5 border-2 border-black/20 border-t-black/70 rounded-full animate-spin"/>Importando…</>
                  : <><Users size={14}/>Confirmar</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Éxito + credenciales generadas ──────────────────── */}
      {done && (
        <div className="card p-8">
          <div className="text-center">
            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ background:'rgba(52,211,153,.12)', border:'1px solid rgba(52,211,153,.25)' }}>
              <CheckCircle size={28} className="text-emerald-400"/>
            </div>
            <h3 className="text-base font-bold mb-1" style={{ color:'rgba(255,255,255,.90)' }}>
              ¡Importación exitosa!
            </h3>
            <p className="text-sm" style={{ color:'rgba(255,255,255,.45)' }}>
              Se registraron{' '}
              <span className="font-bold" style={{ color:'rgba(255,255,255,.75)' }}>{preview?.length}</span>{' '}
              alumnos y se generaron sus credenciales de acceso.
            </p>
          </div>

          {/* Credenciales generadas */}
          {creds && (
            <div className="mt-6 rounded-xl overflow-hidden"
              style={{ border:'1px solid rgba(255,255,255,.08)' }}>
              <div className="px-4 py-3 flex items-center justify-between"
                style={{ background:'rgba(255,255,255,.04)', borderBottom:'1px solid rgba(255,255,255,.07)' }}>
                <div className="flex items-center gap-2">
                  <KeyRound size={14} style={{ color:'#fbbf24' }}/>
                  <span className="text-sm font-bold" style={{ color:'rgba(255,255,255,.85)' }}>
                    Credenciales generadas
                  </span>
                </div>
                <button onClick={() => exportCredencialesExcel(creds, `Credenciales_${file?.name?.replace(/\.csv$/i,'') ?? 'Alumnos'}`)}
                  className="flex items-center gap-2 text-xs font-bold px-3 py-2 rounded-xl transition-all active:scale-95"
                  style={{ background:'rgba(16,185,129,.12)', border:'1px solid rgba(16,185,129,.25)', color:'#10b981' }}
                  onMouseEnter={e => e.currentTarget.style.background='rgba(16,185,129,.22)'}
                  onMouseLeave={e => e.currentTarget.style.background='rgba(16,185,129,.12)'}>
                  <Download size={12}/> Descargar Excel de credenciales
                </button>
              </div>
              <div className="max-h-64 overflow-y-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{ borderBottom:'1px solid rgba(255,255,255,.06)' }}>
                      {['Alumno','Usuario','Contraseña'].map(h => (
                        <th key={h} className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-widest"
                          style={{ color:'rgba(255,255,255,.24)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {creds.map(c => (
                      <tr key={c.usuario} style={{ borderBottom:'1px solid rgba(255,255,255,.04)' }}>
                        <td className="px-4 py-2.5 text-sm" style={{ color:'rgba(255,255,255,.78)' }}>{c.nombre}</td>
                        <td className="px-4 py-2.5 text-xs font-mono" style={{ color:'rgba(255,255,255,.60)' }}>{c.usuario}</td>
                        <td className="px-4 py-2.5 text-xs font-mono font-bold" style={{ color:'#fbbf24' }}>{c.password}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="px-4 py-2.5 text-[11px]"
                style={{ background:'rgba(251,191,36,.06)', borderTop:'1px solid rgba(255,255,255,.06)', color:'rgba(255,255,255,.40)' }}>
                Las credenciales las asigna el sistema — los alumnos no pueden crear ni cambiar su contraseña.
                Descarga el Excel y entrégalas de forma segura; también quedan guardadas en la plataforma.
              </p>
            </div>
          )}

          <button onClick={reset} className="btn-primary mx-auto mt-6">
            Importar otro archivo
          </button>
        </div>
      )}

      {/* ── Historial ───────────────────────────────────────── */}
      <div>
        <h3 className="section-title mb-3">Historial de Importaciones</h3>
        <DataTable
          columns={[
            { key:'archivo', label:'Archivo', className:'flex-grow min-w-[160px]' },
            { key:'fecha',   label:'Fecha',   className:'w-28' },
            { key:'alumnos', label:'Alumnos', className:'w-24' },
            { key:'estado',  label:'Estado',  className:'w-28' },
          ]}
          isEmpty={history.length === 0}
          emptyText="Sin importaciones previas.">
          {history.map(h => (
            <DataTableRow key={h.id} cells={[
              {
                className: 'flex-grow min-w-[160px]',
                content: (
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText size={13} style={{ color:'rgba(255,255,255,.30)', flexShrink:0 }}/>
                    <span className="text-sm font-mono truncate" style={{ color:'rgba(255,255,255,.70)' }}>{h.archivo}</span>
                  </div>
                ),
              },
              {
                className: 'w-28',
                content: <span className="text-xs font-mono" style={{ color:'rgba(255,255,255,.40)' }}>{h.fecha}</span>,
              },
              {
                className: 'w-24',
                content: <span className="font-bold text-sm" style={{ color:'rgba(255,255,255,.82)' }}>{h.alumnos}</span>,
              },
              {
                className: 'w-28',
                content: (
                  <span className="badge bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    <CheckCircle size={10}/> {h.estado}
                  </span>
                ),
              },
            ]}/>
          ))}
        </DataTable>
      </div>

    </div>
  )
}
