/*
 * QR de un grupo entero, para imprimir o repartir: PDF (cuadrícula en hojas
 * carta) o ZIP con un PNG por alumno. El contenido de cada QR es el mismo que
 * el de "Mi QR" del alumno y el que lee el escáner de Pasar lista.
 */
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { QRCodeSVG } from 'qrcode.react'

export const QR_PREFIX = 'EDUTRACK:'
export const valorQR = studentId => `${QR_PREFIX}${studentId}`

/** PNG (dataURL) del QR de un alumno, con su nombre debajo si se pide. */
async function pngQR(student, { lado = 600, conNombre = true, grupo = '' } = {}) {
  let svg = renderToStaticMarkup(createElement(QRCodeSVG, {
    value: valorQR(student.id), size: lado, level: 'H', fgColor: '#0f172a', bgColor: '#ffffff',
  }))
  // qrcode.react no declara el espacio de nombres. Dentro de la página da
  // igual, pero cargado como imagen (Blob image/svg+xml) un SVG sin xmlns
  // FALLA, y con él toda la descarga del grupo.
  if (!svg.includes('xmlns=')) svg = svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"')
  const img = new Image()
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
  await new Promise((ok, mal) => { img.onload = ok; img.onerror = mal; img.src = url })
  const margen = Math.round(lado * 0.08)
  const pie = conNombre ? Math.round(lado * 0.22) : 0
  const c = document.createElement('canvas')
  c.width = lado + margen * 2
  c.height = lado + margen * 2 + pie
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height)
  ctx.drawImage(img, margen, margen, lado, lado)
  URL.revokeObjectURL(url)
  if (conNombre) {
    ctx.fillStyle = '#0f172a'; ctx.textAlign = 'center'
    ctx.font = `bold ${Math.round(lado * 0.065)}px system-ui, sans-serif`
    ctx.fillText(recortar(ctx, student.name, c.width - margen * 2), c.width / 2, lado + margen * 1.6 + lado * 0.05)
    if (grupo) {
      ctx.fillStyle = '#475569'; ctx.font = `${Math.round(lado * 0.045)}px system-ui, sans-serif`
      ctx.fillText(grupo, c.width / 2, lado + margen * 1.6 + lado * 0.13)
    }
  }
  return c.toDataURL('image/png')
}

function recortar(ctx, texto, ancho) {
  if (ctx.measureText(texto).width <= ancho) return texto
  let t = texto
  while (t.length > 3 && ctx.measureText(t + '…').width > ancho) t = t.slice(0, -1)
  return t + '…'
}

const nombreArchivo = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '_').replace(/_+/g, '_')

function descargar(href, nombre) {
  const a = document.createElement('a')
  a.href = href; a.download = nombre
  document.body.appendChild(a); a.click(); a.remove()
}

/** PDF tamaño carta: 3 × 4 QR por hoja, con nombre y grupo. */
export async function descargarPdfGrupo(grupo, alumnos, onAvance) {
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ unit: 'mm', format: 'letter', compress: true })
  const COLS = 3, FILAS = 4, M = 12
  const anchoCelda = (215.9 - M * 2) / COLS
  const altoCelda = (279.4 - M * 2 - 10) / FILAS
  // La imagen es el QR con margen (1.16 × lado) más el pie con el nombre (0.22 × lado).
  const proporcion = (1.16 + 0.22) / 1.16
  const imgAlto = Math.min(altoCelda - 4, (anchoCelda - 4) * proporcion)
  const imgAncho = imgAlto / proporcion
  const titulo = `${grupo.name}${grupo.subject ? ` — ${grupo.subject}` : ''}`
  for (let i = 0; i < alumnos.length; i++) {
    const enHoja = i % (COLS * FILAS)
    if (i > 0 && enHoja === 0) pdf.addPage()
    if (enHoja === 0) {
      pdf.setFontSize(10); pdf.setTextColor(71, 85, 105)
      pdf.text(`QR de asistencia · ${titulo}`, M, M - 3)
    }
    const png = await pngQR(alumnos[i], { lado: 480, conNombre: true })
    const col = enHoja % COLS, fila = Math.floor(enHoja / COLS)
    const x = M + col * anchoCelda + (anchoCelda - imgAncho) / 2
    const y = M + 4 + fila * altoCelda + (altoCelda - imgAlto) / 2
    pdf.addImage(png, 'PNG', x, y, imgAncho, imgAlto)
    onAvance?.(i + 1, alumnos.length)
  }
  pdf.save(`QR_${nombreArchivo(grupo.name)}.pdf`)
}

/** ZIP con un PNG por alumno (nombre del archivo = nombre del alumno). */
export async function descargarZipGrupo(grupo, alumnos, onAvance) {
  const { default: JSZip } = await import('jszip')
  const zip = new JSZip()
  const usados = new Set()
  for (let i = 0; i < alumnos.length; i++) {
    const a = alumnos[i]
    const png = await pngQR(a, { lado: 600, conNombre: true, grupo: grupo.name })
    let base = nombreArchivo(a.name) || a.id
    if (usados.has(base)) base = `${base}_${a.id}`
    usados.add(base)
    zip.file(`${base}.png`, png.split(',')[1], { base64: true })
    onAvance?.(i + 1, alumnos.length)
  }
  const blob = await zip.generateAsync({ type: 'blob' })
  const url = URL.createObjectURL(blob)
  descargar(url, `QR_${nombreArchivo(grupo.name)}.zip`)
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
