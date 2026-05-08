import { useState, useRef } from 'react'
import { Upload, FileText, CheckCircle, X, Download, AlertCircle, Users } from 'lucide-react'
import { importHistory } from '../../data/mockData'
import clsx from 'clsx'

const CSV_TEMPLATE = `nombre,email,grupo,tutor_nombre,tutor_email,tutor_telefono
Ana García López,ana.garcia@edutrack.mx,g1,Carmen López,carmen@gmail.com,555-0101
Carlos Martínez,carlos.mtz@edutrack.mx,g2,Roberto Martínez,roberto@gmail.com,555-0102`

const CSV_HEADERS = ['nombre','email','grupo','tutor_nombre','tutor_email','tutor_telefono']

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
  const [drag, setDrag]       = useState(false)
  const [file, setFile]       = useState(null)
  const [preview, setPreview] = useState(null)
  const [error, setError]     = useState('')
  const [importing, setImporting] = useState(false)
  const [done, setDone]       = useState(false)
  const [history, setHistory] = useState(importHistory)
  const inputRef = useRef()

  const processFile = f => {
    setError('')
    setDone(false)
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

  const handleDrop = e => {
    e.preventDefault(); setDrag(false)
    const f = e.dataTransfer.files[0]
    if (f) processFile(f)
  }

  const handleInput = e => { if (e.target.files[0]) processFile(e.target.files[0]) }

  const handleImport = async () => {
    setImporting(true)
    await new Promise(r => setTimeout(r, 1500))
    setImporting(false)
    setDone(true)
    setHistory(h => [
      { id:`imp${Date.now()}`, fecha:new Date().toISOString().split('T')[0], archivo:file.name, alumnos:preview.length, estado:'completado' },
      ...h
    ])
  }

  const reset = () => { setFile(null); setPreview(null); setError(''); setDone(false) }

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="card p-5">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-navy-100 flex items-center justify-center flex-shrink-0">
            <Upload size={22} className="text-navy-700"/>
          </div>
          <div className="flex-1">
            <h2 className="text-base font-bold text-slate-900">Importar Lista de Alumnos</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Sube un archivo CSV con la lista de alumnos para registrarlos automáticamente en el sistema.
              El sistema detecta duplicados y solo agrega alumnos nuevos.
            </p>
          </div>
          <button onClick={downloadTemplate} className="btn-secondary flex-shrink-0">
            <Download size={14}/> Descargar plantilla
          </button>
        </div>

        {/* CSV format guide */}
        <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-200">
          <p className="text-xs font-semibold text-slate-600 mb-2">Formato requerido del CSV:</p>
          <div className="flex flex-wrap gap-2">
            {CSV_HEADERS.map(h => (
              <code key={h} className="text-[11px] bg-white border border-slate-200 text-slate-700 px-2 py-0.5 rounded-md font-mono">
                {h}
              </code>
            ))}
          </div>
          <p className="text-[11px] text-slate-400 mt-2">El campo "grupo" acepta: g1, g2, g3</p>
        </div>
      </div>

      {/* Upload zone */}
      {!preview && !done && (
        <div
          className={clsx(
            'border-2 border-dashed rounded-2xl p-10 text-center transition-all cursor-pointer',
            drag ? 'border-navy-400 bg-navy-50' : 'border-slate-200 hover:border-navy-300 hover:bg-slate-50'
          )}
          onClick={() => inputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDrag(true) }}
          onDragLeave={() => setDrag(false)}
          onDrop={handleDrop}
        >
          <input ref={inputRef} type="file" accept=".csv" className="hidden" onChange={handleInput}/>
          <div className={`w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center ${drag ? 'bg-navy-100' : 'bg-slate-100'}`}>
            <Upload size={28} className={drag ? 'text-navy-600' : 'text-slate-400'}/>
          </div>
          <p className="font-semibold text-slate-700 text-base">
            {drag ? 'Suelta el archivo aquí' : 'Arrastra tu archivo CSV aquí'}
          </p>
          <p className="text-sm text-slate-400 mt-1">o haz clic para seleccionarlo</p>
          <p className="text-xs text-slate-300 mt-3">Solo archivos .csv</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3">
          <AlertCircle size={16}/>
          <span className="text-sm">{error}</span>
          <button onClick={reset} className="ml-auto"><X size={15}/></button>
        </div>
      )}

      {/* Preview */}
      {preview && !done && (
        <div className="card overflow-hidden">
          <div className="px-5 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText size={16} className="text-slate-500"/>
              <h3 className="font-semibold text-slate-800">{file?.name}</h3>
              <span className="badge bg-blue-100 text-blue-700">{preview.length} alumnos</span>
            </div>
            <button onClick={reset} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-200 transition-colors">
              <X size={15}/>
            </button>
          </div>

          <div className="overflow-x-auto max-h-72">
            <table className="w-full">
              <thead className="sticky top-0 bg-slate-50 border-b border-slate-100">
                <tr>
                  {CSV_HEADERS.map(h=><th key={h} className="table-header">{h}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {preview.map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50/50">
                    {CSV_HEADERS.map(h=>(
                      <td key={h} className={`table-cell ${!row[h]?'text-red-400 italic':'text-slate-700'}`}>
                        {row[h] || '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-between">
            <p className="text-xs text-slate-500">
              Se agregarán <strong>{preview.length}</strong> alumnos al sistema.
            </p>
            <div className="flex gap-2">
              <button onClick={reset} className="btn-secondary">Cancelar</button>
              <button onClick={handleImport} disabled={importing} className="btn-primary">
                {importing
                  ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Importando…</>
                  : <><Users size={15}/>Confirmar importación</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success */}
      {done && (
        <div className="card p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={32} className="text-emerald-600"/>
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-1">¡Importación exitosa!</h3>
          <p className="text-slate-500 text-sm">
            Se registraron <strong>{preview?.length}</strong> alumnos correctamente en el sistema.
          </p>
          <button onClick={reset} className="btn-primary mx-auto mt-4">Importar otro archivo</button>
        </div>
      )}

      {/* History */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
          <h3 className="section-title">Historial de Importaciones</h3>
        </div>
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="table-header">Archivo</th>
              <th className="table-header">Fecha</th>
              <th className="table-header">Alumnos</th>
              <th className="table-header">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {history.map(h => (
              <tr key={h.id} className="hover:bg-slate-50/50">
                <td className="table-cell">
                  <div className="flex items-center gap-2">
                    <FileText size={14} className="text-slate-400"/>
                    <span className="text-sm font-mono text-slate-700">{h.archivo}</span>
                  </div>
                </td>
                <td className="table-cell text-slate-500 text-xs">{h.fecha}</td>
                <td className="table-cell"><span className="font-semibold text-slate-800">{h.alumnos}</span></td>
                <td className="table-cell">
                  <span className="badge bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <CheckCircle size={11}/> {h.estado}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
