import { jsPDF } from 'jspdf'

const OFFICIAL_TERMS_URL = '/docs/terminos-condiciones-ecoems-universidad.pdf'

const MARGIN = 18
const LINE_H = 5.2
const PAGE_W = 210
const PAGE_BOTTOM = 280

function slug(s) {
  return (s || 'alumno').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
}

function addWrappedText(doc, text, y, { fontSize = 9.5, color = '#334155' } = {}) {
  doc.setFontSize(fontSize)
  doc.setTextColor(color)
  const lines = doc.splitTextToSize(text, PAGE_W - MARGIN * 2)
  for (const line of lines) {
    if (y > PAGE_BOTTOM) { doc.addPage(); y = MARGIN }
    doc.text(line, MARGIN, y)
    y += LINE_H
  }
  return y
}

function buildBaseDoc({ studentName, tcText, privText }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor('#0f172a')
  doc.text('CEFIMAT — Términos y Condiciones', MARGIN, 22)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor('#475569')
  doc.text(`Alumno: ${studentName}`, MARGIN, 30)
  doc.text(`Generado: ${new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })}`, MARGIN, 35)

  // Mismo orden que el asistente del alumno: primero privacidad, luego términos.
  let y = 45
  doc.setFont('helvetica', 'bold')
  y = addWrappedText(doc, 'AVISO DE PRIVACIDAD', y, { fontSize: 11, color: '#0f172a' })
  doc.setFont('helvetica', 'normal')
  y = addWrappedText(doc, privText, y + 2, { fontSize: 9 }) + 6

  doc.setFont('helvetica', 'bold')
  y = addWrappedText(doc, 'TÉRMINOS Y CONDICIONES', y, { fontSize: 11, color: '#0f172a' })
  doc.setFont('helvetica', 'normal')
  y = addWrappedText(doc, tcText, y + 2, { fontSize: 9 }) + 10

  return { doc, y }
}

/**
 * La firma se dibuja en el canvas con trazo blanco (tema oscuro); sobre el
 * PDF blanco sería invisible. Recolorea cada pixel con alfa a tinta oscura.
 */
function darkenSignature(dataUrl) {
  return new Promise(resolve => {
    const img = new Image()
    img.onload = () => {
      const c = document.createElement('canvas')
      c.width = img.width
      c.height = img.height
      const ctx = c.getContext('2d')
      ctx.drawImage(img, 0, 0)
      const px = ctx.getImageData(0, 0, c.width, c.height)
      const d = px.data
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] > 0) { d[i] = 15; d[i + 1] = 23; d[i + 2] = 42 } // #0f172a
      }
      ctx.putImageData(px, 0, 0)
      resolve(c.toDataURL('image/png'))
    }
    img.onerror = () => resolve(dataUrl)
    img.src = dataUrl
  })
}

export async function downloadStampedPdf({ studentName, tcText, privText, signatureDataUrl, signedAt, termsPdfUrl = OFFICIAL_TERMS_URL }) {
  if (!signatureDataUrl) throw new Error('signature_required')

  const { PDFDocument, rgb, StandardFonts } = await import('pdf-lib')
  const source = await fetch(termsPdfUrl)
  if (!source.ok) throw new Error('terms_pdf_unavailable')
  const pdf = await PDFDocument.load(await source.arrayBuffer())
  const pages = pdf.getPages()
  const page = pages[pages.length - 1]
  const inked = await darkenSignature(signatureDataUrl)
  const signature = await pdf.embedPng(inked)
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const tinta = rgb(0.18, 0.22, 0.29)

  /* Campos del ALUMNO (columna izquierda) en la última página del T&C 2027
     (carta, 4 páginas, publicado el 2026-11-18). Medidos sobre ese PDF: la
     columna derecha es la del contratante/tutor. Si se publica un T&C con
     otra maqueta, estas coordenadas hay que volver a medirlas. */
  const CAJA_FIRMA = { x: 58, y: 188, w: 160, h: 26 }   // sobre la línea de «Firma del alumno»
  const escala = Math.min(CAJA_FIRMA.w / signature.width, CAJA_FIRMA.h / signature.height)
  page.drawImage(signature, {
    x: CAJA_FIRMA.x, y: CAJA_FIRMA.y,
    width: signature.width * escala, height: signature.height * escala,
  })
  page.drawText(studentName, { x: 56, y: 284, size: 9, font, color: tinta })   // «Nombre del alumno»
  const fecha = new Date(signedAt ?? Date.now())
    .toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
  page.drawText(fecha, { x: 56, y: 108, size: 9, font, color: tinta })         // «Fecha»

  const bytes = await pdf.save()
  const blob = new Blob([bytes], { type:'application/pdf' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${slug(studentName)}_terminos_firmados.pdf`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function downloadBlankPdf({ studentName, tcText, privText }) {
  const { doc, y } = buildBaseDoc({ studentName, tcText, privText })
  let sigY = y
  if (sigY > 245) { doc.addPage(); sigY = MARGIN }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor('#0f172a')
  doc.text('Firma del alumno (firmar a mano):', MARGIN, sigY)
  sigY += 6

  doc.setDrawColor('#94a3b8')
  doc.rect(MARGIN, sigY, 70, 24)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor('#94a3b8')
  doc.text('Firma', MARGIN + 2, sigY + 24 + 4)

  doc.save(`${slug(studentName)}_terminos_para_firmar.pdf`)
}
