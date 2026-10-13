/*
 * Alta masiva de alumnos de un grupo.
 *
 * 1. Se descarga una plantilla .xlsx del grupo (hoja "Alumnos" + hoja
 *    "Instrucciones"). Se comparte, se llena en Google Sheets y se descarga
 *    como .xlsx o .csv.
 * 2. Se sube el archivo: se leen las filas, se validan y se muestran.
 * 3. Se dan de alta una por una (mismo camino que el alta manual) y se
 *    entrega un Excel con las credenciales generadas.
 *
 * El usuario de acceso (correo @siga.mx) y la contraseña los genera el
 * sistema: el alumno nunca los elige.
 */
import { createStudent } from './supabaseData'
import { generarUsuario, generarPassword, DOMINIO_CORREO } from './credentials'
import { areasParaInstituciones } from './areas'

const sinAcentos = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '')
const normalizar = s => sinAcentos(s).toLowerCase().replace(/\*/g, '').replace(/\(.*?\)/g, '').replace(/[^a-z0-9]+/g, ' ').trim()

/** Columnas de la plantilla. `alias`: otros títulos que también se aceptan al leer. */
export function columnasPlantilla(grupo) {
  const universidad = grupo?.curso === 'universidad'
  return [
    { clave: 'nombre',        titulo: 'Nombre completo *',        ancho: 34, alias: ['nombre', 'nombre del alumno', 'alumno', 'nombre completo del alumno'] },
    { clave: 'correoPersonal', titulo: 'Correo personal',          ancho: 30, alias: ['correo', 'email', 'correo electronico', 'correo del alumno'] },
    { clave: 'whatsapp',      titulo: 'WhatsApp del alumno',      ancho: 18, alias: ['whatsapp', 'telefono', 'celular', 'telefono del alumno', 'celular del alumno'] },
    { clave: 'tutorNombre',   titulo: 'Nombre del tutor',         ancho: 30, alias: ['tutor', 'nombre tutor', 'padre o tutor', 'nombre del padre o tutor'] },
    { clave: 'tutorCorreo',   titulo: 'Correo del tutor',         ancho: 30, alias: ['correo tutor', 'email tutor'] },
    { clave: 'tutorTelefono', titulo: 'Teléfono del tutor',       ancho: 18, alias: ['telefono tutor', 'celular tutor'] },
    { clave: 'tutorWhatsapp', titulo: 'WhatsApp del tutor',       ancho: 18, alias: ['whatsapp tutor'] },
    ...(universidad ? [{ clave: 'area', titulo: 'Área (1 a 4)', ancho: 12, alias: ['area', 'area de examen'] }] : []),
  ]
}

const nombreArchivo = s => sinAcentos(s).replace(/[^\w-]+/g, '_').replace(/_+/g, '_')

/** Descarga la plantilla .xlsx del grupo. */
export async function descargarPlantilla(grupo, nombreSucursal = '') {
  const XLSX = await import('xlsx')
  const cols = columnasPlantilla(grupo)
  const wb = XLSX.utils.book_new()

  // Hoja 1: solo encabezados. Sin fila de ejemplo: se colaría como alumno.
  const ws = XLSX.utils.aoa_to_sheet([cols.map(c => c.titulo)])
  ws['!cols'] = cols.map(c => ({ wch: c.ancho }))
  XLSX.utils.book_append_sheet(wb, ws, 'Alumnos')

  const areas = grupo?.curso === 'universidad'
    ? areasParaInstituciones(grupo.instituciones ?? []).map(a => [`  ${a.id} = ${a.label.replace(/^Área \d+ — /, '')}`])
    : []
  const instrucciones = [
    [`Plantilla de alta de alumnos — ${grupo.name}${nombreSucursal ? ` (${nombreSucursal})` : ''}`],
    [''],
    ['Cómo llenarla'],
    ['1. Sube este archivo a Google Drive y ábrelo con Google Sheets (o compártelo así como está).'],
    ['2. Cada alumno escribe sus datos en UNA fila de la hoja "Alumnos". No cambies los títulos de la primera fila.'],
    ['3. Solo "Nombre completo" es obligatorio; los demás datos ayudan a contactar al alumno y a su tutor.'],
    ['4. Cuando estén todos, descarga el archivo (Archivo → Descargar → Microsoft Excel o CSV).'],
    ['5. En SIGA: Grupos → tarjeta del grupo → "Alta masiva" → sube el archivo.'],
    [''],
    ['Notas'],
    ['• El usuario de acceso (correo @' + DOMINIO_CORREO + ') y la contraseña los genera SIGA; no se piden aquí.'],
    ['• Escribe los teléfonos a 10 dígitos, sin espacios ni guiones.'],
    ...(areas.length ? [['• Área: escribe solo el número.'], ...areas] : []),
  ]
  const wi = XLSX.utils.aoa_to_sheet(instrucciones)
  wi['!cols'] = [{ wch: 110 }]
  XLSX.utils.book_append_sheet(wb, wi, 'Instrucciones')

  XLSX.writeFile(wb, `Plantilla_alumnos_${nombreArchivo(grupo.name)}.xlsx`)
}

const correoValido = v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)
const telefono = v => String(v ?? '').replace(/\D/g, '')

/**
 * Lee el archivo lleno (.xlsx, .xls o .csv) y devuelve las filas validadas:
 * [{ fila, datos, errores:[], avisos:[] }]. Las filas vacías se ignoran.
 */
export async function leerArchivoAlumnos(file, grupo) {
  const XLSX = await import('xlsx')
  // El CSV de Google Sheets es UTF-8 sin BOM: leído como bytes, los acentos de
  // los títulos ("Teléfono", "Área") se corrompen y la columna no se reconoce.
  const esCsv = /\.csv$/i.test(file.name) || file.type === 'text/csv'
  const libro = esCsv
    ? XLSX.read(await file.text(), { type: 'string' })
    : XLSX.read(await file.arrayBuffer(), { type: 'array' })
  const hoja = libro.Sheets.Alumnos ?? libro.Sheets[libro.SheetNames[0]]
  if (!hoja) throw new Error('El archivo no tiene hojas.')
  const matriz = XLSX.utils.sheet_to_json(hoja, { header: 1, defval: '', raw: false })
  if (!matriz.length) throw new Error('El archivo está vacío.')

  const cols = columnasPlantilla(grupo)
  // Se reconoce cada columna por su título (tolerante a acentos, mayúsculas y *).
  const encabezados = matriz[0].map(normalizar)
  const indice = {}
  for (const c of cols) {
    const opciones = [normalizar(c.titulo), ...c.alias.map(normalizar)]
    const i = encabezados.findIndex(h => opciones.includes(h))
    if (i >= 0) indice[c.clave] = i
  }
  if (indice.nombre === undefined) {
    throw new Error('No se encontró la columna "Nombre completo". Usa la plantilla sin cambiar los títulos de la primera fila.')
  }

  const areasValidas = grupo?.curso === 'universidad' ? areasParaInstituciones(grupo.instituciones ?? []).map(a => a.id) : []
  const vistos = new Map()
  const filas = []
  matriz.slice(1).forEach((r, k) => {
    const val = clave => indice[clave] === undefined ? '' : String(r[indice[clave]] ?? '').trim()
    const datos = Object.fromEntries(cols.map(c => [c.clave, val(c.clave)]))
    if (Object.values(datos).every(v => v === '')) return
    datos.nombre = datos.nombre.replace(/\s+/g, ' ')
    const errores = [], avisos = []
    if (datos.nombre.length < 3) errores.push('Falta el nombre completo')
    else if (datos.nombre.split(' ').length < 2) avisos.push('El nombre parece incompleto (falta apellido)')
    for (const [c, etq] of [['correoPersonal', 'Correo personal'], ['tutorCorreo', 'Correo del tutor']]) {
      if (datos[c] && !correoValido(datos[c])) errores.push(`${etq} no válido`)
    }
    for (const [c, etq] of [['whatsapp', 'WhatsApp'], ['tutorTelefono', 'Teléfono del tutor'], ['tutorWhatsapp', 'WhatsApp del tutor']]) {
      if (!datos[c]) continue
      const d = telefono(datos[c])
      if (d.length < 10) avisos.push(`${etq} con menos de 10 dígitos`)
      datos[c] = d
    }
    if (areasValidas.length && datos.area) {
      const n = Number(datos.area.replace(/\D/g, ''))
      if (!areasValidas.includes(n)) { avisos.push('Área no válida: se dejará sin área'); datos.area = '' }
      else datos.area = String(n)
    }
    const clave = normalizar(datos.nombre)
    if (clave && vistos.has(clave)) avisos.push(`Nombre repetido (también en la fila ${vistos.get(clave)})`)
    else vistos.set(clave, k + 2)
    filas.push({ fila: k + 2, datos, errores, avisos })
  })
  if (!filas.length) throw new Error('No hay alumnos en el archivo: la hoja "Alumnos" está vacía.')
  return filas
}

/**
 * Da de alta las filas válidas en el grupo, una por una. `correosUsados`:
 * correos de acceso ya existentes (para no repetir usuario).
 * Devuelve [{ fila, ok, nombre, usuario?, password?, message? }].
 */
export async function importarAlumnos(grupo, filas, { correosUsados = [], alAvanzar } = {}) {
  const usados = new Set(correosUsados.map(c => String(c).toLowerCase().split('@')[0]))
  const resultados = []
  for (let i = 0; i < filas.length; i++) {
    const { fila, datos } = filas[i]
    const password = generarPassword()
    let res = null, email = ''
    // Si el usuario ya existía en otra parte de la plataforma, se prueba el siguiente.
    for (let intento = 0; intento < 6; intento++) {
      email = `${generarUsuario(datos.nombre, usados)}@${DOMINIO_CORREO}`
      res = await createStudent({
        name: datos.nombre, email, groupId: grupo.id, password, sucursal: grupo.sucursal ?? null,
        tutor: { name: datos.tutorNombre || null, email: datos.tutorCorreo || null,
                 phone: datos.tutorTelefono || null, whatsapp: datos.tutorWhatsapp || datos.tutorTelefono || null },
        personalEmail: datos.correoPersonal || null, whatsapp: datos.whatsapp || null,
        universidadArea: grupo.curso === 'universidad' && datos.area ? Number(datos.area) : null,
      })
      if (res.ok || !String(res.message).includes('ya está registrado')) break
    }
    resultados.push(res.ok
      ? { fila, ok: true, nombre: datos.nombre, usuario: email, password }
      : { fila, ok: false, nombre: datos.nombre, message: res.message })
    alAvanzar?.(i + 1, filas.length)
  }
  return resultados
}
