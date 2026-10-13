import { useState } from 'react'
import { FileSpreadsheet, X, Download, Upload, CheckCircle2, AlertTriangle, XCircle, Users, Share2 } from 'lucide-react'
import ModalPortal from '../ui/ModalPortal'
import { descargarPlantilla, leerArchivoAlumnos, importarAlumnos, columnasPlantilla } from '../../lib/plantillaAlumnos'
import { exportCredencialesExcel } from '../../lib/credentials'

/**
 * Alta masiva de alumnos en un grupo: plantilla → se llena en Google Sheets →
 * se sube → se revisa → se dan de alta todos → credenciales en Excel.
 * Pasos: inicio | revisar | importando | listo
 */
export default function AltaMasivaModal({ grupo, nombreSucursal = '', correosUsados = [], onClose, onTerminado }) {
  const [paso, setPaso] = useState('inicio')
  const [filas, setFilas] = useState([])
  const [error, setError] = useState('')
  const [leyendo, setLeyendo] = useState(false)
  const [avance, setAvance] = useState({ hechos: 0, total: 0 })
  const [resultados, setResultados] = useState([])
  const [descargando, setDescargando] = useState(false)

  const validas = filas.filter(f => f.errores.length === 0)
  const conError = filas.length - validas.length
  const cols = columnasPlantilla(grupo)

  const bajarPlantilla = async () => {
    setDescargando(true); setError('')
    try { await descargarPlantilla(grupo, nombreSucursal) }
    catch { setError('No se pudo generar la plantilla.') }
    finally { setDescargando(false) }
  }

  const subir = async e => {
    const file = e.target.files?.[0]; e.target.value = ''
    if (!file) return
    setLeyendo(true); setError('')
    try { setFilas(await leerArchivoAlumnos(file, grupo)); setPaso('revisar') }
    catch (err) { setError(err?.message || 'No se pudo leer el archivo.') }
    finally { setLeyendo(false) }
  }

  const importar = async () => {
    setPaso('importando'); setAvance({ hechos: 0, total: validas.length })
    const res = await importarAlumnos(grupo, validas, { correosUsados, alAvanzar: (hechos, total) => setAvance({ hechos, total }) })
    setResultados(res); setPaso('listo')
    if (res.some(r => r.ok)) onTerminado?.()
  }

  const creados = resultados.filter(r => r.ok)
  const descargarCredenciales = () => exportCredencialesExcel(
    creados.map(r => ({ nombre: r.nombre, grupo: grupo.name, usuario: r.usuario, password: r.password })),
    `Credenciales_${grupo.name.replace(/[^\w-]+/g, '_')}`)

  const trabajando = paso === 'importando'

  return (
    <ModalPortal maxWidth="max-w-2xl" onClose={() => !trabajando && onClose()}>
      <div className="flex items-center justify-between gap-3 px-5 py-3.5" style={{ borderBottom: '1px solid var(--divider)' }}>
        <h2 className="flex items-center gap-2 text-sm font-bold min-w-0" style={{ color: 'var(--t1)' }}>
          <FileSpreadsheet size={15} style={{ color: 'var(--accent)' }}/>
          <span className="truncate">Alta masiva — {grupo.name}</span>
        </h2>
        <button type="button" onClick={onClose} disabled={trabajando} aria-label="Cerrar"
          className="w-11 h-11 flex items-center justify-center rounded-lg" style={{ color: 'var(--t3)' }}><X size={15}/></button>
      </div>

      <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
        {paso === 'inicio' && (
          <>
            <ol className="space-y-3">
              {[
                { n: 1, Icono: Download, titulo: 'Descarga la plantilla del grupo',
                  texto: `Excel con las columnas: ${cols.map(c => c.titulo.replace(' *', '')).join(', ')}.`,
                  accion: <button type="button" onClick={bajarPlantilla} disabled={descargando} className="btn-primary min-h-11">
                    <Download size={14}/> {descargando ? 'Generando…' : 'Descargar plantilla'}</button> },
                { n: 2, Icono: Share2, titulo: 'Compártela con tu grupo',
                  texto: 'Súbela a Google Drive, ábrela con Google Sheets y comparte el enlace con permiso de edición. Cada alumno llena una fila.' },
                { n: 3, Icono: Upload, titulo: 'Descárgala llena y súbela aquí',
                  texto: 'En Google Sheets: Archivo → Descargar → Microsoft Excel (.xlsx) o CSV. Revisarás cada fila antes de dar de alta.',
                  accion: (
                    <label className="btn-secondary min-h-11 cursor-pointer">
                      <Upload size={14}/> {leyendo ? 'Leyendo…' : 'Subir archivo lleno'}
                      <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={subir} disabled={leyendo}/>
                    </label>
                  ) },
              ].map(({ n, Icono, titulo, texto, accion }) => (
                <li key={n} className="flex gap-3 rounded-xl p-3" style={{ background: 'var(--soft-bg)', border: '1px solid var(--card-border)' }}>
                  <span className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold"
                    style={{ background: 'var(--accent)', color: 'var(--accent-contrast)' }}>{n}</span>
                  <div className="min-w-0 flex-1 space-y-2">
                    <p className="flex items-center gap-1.5 text-sm font-bold" style={{ color: 'var(--t1)' }}><Icono size={14}/> {titulo}</p>
                    <p className="text-xs" style={{ color: 'var(--t3)' }}>{texto}</p>
                    {accion}
                  </div>
                </li>
              ))}
            </ol>
            <p className="text-[11px]" style={{ color: 'var(--t3)' }}>
              El usuario de acceso y la contraseña de cada alumno los genera SIGA. Al terminar podrás descargarlos en Excel para entregarlos.
            </p>
          </>
        )}

        {paso === 'revisar' && (
          <>
            <div className="grid grid-cols-3 gap-2 text-center">
              {[['Filas leídas', filas.length, 'var(--t1)'], ['Listas para alta', validas.length, 'var(--good)'], ['Con error', conError, conError ? 'var(--bad)' : 'var(--t3)']].map(([t, n, c]) => (
                <div key={t} className="rounded-xl p-2.5" style={{ background: 'var(--soft-bg)', border: '1px solid var(--card-border)' }}>
                  <p className="text-xl font-bold tabular-nums" style={{ color: c }}>{n}</p>
                  <p className="text-[10px] font-semibold" style={{ color: 'var(--t3)' }}>{t}</p>
                </div>
              ))}
            </div>
            {conError > 0 && (
              <p className="text-xs" style={{ color: 'var(--t2)' }}>
                Las filas con error <b>no se darán de alta</b>. Corrígelas en el archivo y vuelve a subirlo, o continúa solo con las válidas.
              </p>
            )}
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--card-border)' }}>
              <div className="max-h-[45vh] overflow-y-auto divide-y" style={{ borderColor: 'var(--divider)' }}>
                {filas.map(f => {
                  const estado = f.errores.length ? 'error' : f.avisos.length ? 'aviso' : 'ok'
                  const Icono = estado === 'error' ? XCircle : estado === 'aviso' ? AlertTriangle : CheckCircle2
                  const color = estado === 'error' ? 'var(--bad)' : estado === 'aviso' ? 'var(--warn)' : 'var(--good)'
                  return (
                    <div key={f.fila} className="flex items-start gap-2.5 px-3 py-2" style={{ borderTop: '1px solid var(--divider)' }}>
                      <span className="text-[10px] tabular-nums w-10 flex-shrink-0 pt-0.5" style={{ color: 'var(--t3)' }}>Fila {f.fila}</span>
                      <Icono size={15} className="flex-shrink-0 mt-0.5" style={{ color }}/>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold truncate" style={{ color: 'var(--t1)' }}>{f.datos.nombre || '(sin nombre)'}</p>
                        <p className="text-[11px] truncate" style={{ color: 'var(--t3)' }}>
                          {[f.datos.correoPersonal, f.datos.whatsapp, f.datos.tutorNombre && `Tutor: ${f.datos.tutorNombre}`, f.datos.area && `Área ${f.datos.area}`].filter(Boolean).join(' · ') || 'Sin datos de contacto'}
                        </p>
                        {[...f.errores, ...f.avisos].map(m => (
                          <p key={m} className="text-[11px] font-semibold" style={{ color: f.errores.includes(m) ? 'var(--bad)' : 'var(--warn)' }}>{m}</p>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
            {error && <p role="alert" className="text-xs font-semibold" style={{ color: 'var(--bad)' }}>{error}</p>}
            <div className="flex flex-col sm:flex-row gap-2">
              <label className="btn-secondary min-h-11 justify-center cursor-pointer sm:flex-1">
                <Upload size={14}/> Subir otro archivo
                <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={subir}/>
              </label>
              <button type="button" onClick={importar} disabled={validas.length === 0} className="btn-primary min-h-11 justify-center sm:flex-1">
                <Users size={14}/> Dar de alta {validas.length} alumno{validas.length !== 1 ? 's' : ''}
              </button>
            </div>
          </>
        )}

        {paso === 'importando' && (
          <div role="status" className="py-6 space-y-3 text-center">
            <p className="text-sm font-semibold" style={{ color: 'var(--t1)' }}>Dando de alta {avance.hechos} de {avance.total}…</p>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--soft-bg)' }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${(avance.hechos / Math.max(1, avance.total)) * 100}%`, background: 'var(--accent)' }}/>
            </div>
            <p className="text-xs" style={{ color: 'var(--t3)' }}>No cierres esta ventana.</p>
          </div>
        )}

        {paso === 'listo' && (
          <>
            <div className="flex items-center gap-2 p-3 rounded-xl text-sm font-semibold"
              style={creados.length ? { background: 'var(--good-soft)', border: '1px solid var(--good-line)', color: 'var(--good)' } : { background: 'var(--bad-soft)', border: '1px solid var(--bad-line)', color: 'var(--bad)' }}>
              {creados.length ? <CheckCircle2 size={16}/> : <XCircle size={16}/>}
              {creados.length} alumno{creados.length !== 1 ? 's' : ''} dado{creados.length !== 1 ? 's' : ''} de alta
              {resultados.length - creados.length > 0 && ` · ${resultados.length - creados.length} con problema`}
            </div>
            {resultados.filter(r => !r.ok).map(r => (
              <p key={r.fila} className="text-xs" style={{ color: 'var(--bad)' }}>Fila {r.fila} · {r.nombre}: {r.message}</p>
            ))}
            {creados.length > 0 && (
              <>
                <p className="text-xs" style={{ color: 'var(--t2)' }}>
                  Descarga las credenciales para entregárselas. También puedes consultarlas después en <b>Acceso y Disposición</b>.
                </p>
                <button type="button" onClick={descargarCredenciales} className="btn-primary w-full justify-center min-h-11">
                  <Download size={14}/> Descargar credenciales (Excel)
                </button>
              </>
            )}
            <button type="button" onClick={onClose} className="btn-secondary w-full justify-center min-h-11">Cerrar</button>
          </>
        )}

        {error && paso === 'inicio' && <p role="alert" className="text-xs font-semibold" style={{ color: 'var(--bad)' }}>{error}</p>}
      </div>
    </ModalPortal>
  )
}
