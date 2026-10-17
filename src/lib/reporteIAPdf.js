import { jsPDF } from 'jspdf'

/*
 * PDF del reporte con IA (alumno o grupo), con la identidad de SIGA: banda
 * azul marino con el logo, acentos guinda y dorado, tarjetas de datos clave,
 * barras de nivel 1-5 y pie con "uso interno". Se arma con jsPDF a mano (sin
 * capturar la pantalla) para que salga nítido y en A4 igual en cualquier tema.
 */
const C = {
  marino: '#1B2F5E', guinda: '#7A1A33', dorado: '#F2B33D', cielo: '#EAF0FA',
  texto: '#0F172A', suave: '#475569', tenue: '#94A3B8', linea: '#E2E8F0', fondo: '#F8FAFC',
  bien: '#15803D', info: '#1D4ED8', aviso: '#B45309', mal: '#B91C1C',
}
const NIVEL = {
  sobresaliente: ['Sobresaliente', C.bien], bueno: ['Bueno', C.info],
  en_desarrollo: ['En desarrollo', C.aviso], en_riesgo: ['En riesgo', C.mal],
}
const PARA = { docente: 'DOCENTE', alumno: 'ALUMNO', tutor: 'TUTOR' }
const colorNivel = n => n >= 4 ? C.bien : n === 3 ? C.info : n === 2 ? C.aviso : C.mal

const W = 210, M = 16, ANCHO = W - M * 2, PIE = 282

// Helvetica de jsPDF solo trae WinAnsi: se cambian los pocos signos que la IA
// usa y no existen ahí (flechas, ≈, comillas tipográficas raras).
const limpio = s => String(s ?? '')
  .replace(/[→⇒]/g, '->').replace(/[≈∼]/g, '~').replace(/[≥]/g, '>=').replace(/[≤]/g, '<=')
  .replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/ /g, ' ')
  .replace(/[^\x20-\x7E -ÿ–—…€·]/g, '')

const slug = s => (s || 'reporte').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_')
const fecha = f => new Date(f).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })

// El logo original es grande (~1.4 MB en el PDF): se reduce a 480 px de ancho.
async function cargarImagen(url, ancho = 480) {
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    const lienzo = document.createElement('canvas')
    lienzo.width = ancho
    lienzo.height = Math.round(ancho * img.naturalHeight / img.naturalWidth)
    const ctx = lienzo.getContext('2d')
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, lienzo.width, lienzo.height)
    ctx.drawImage(img, 0, 0, lienzo.width, lienzo.height)
    return lienzo.toDataURL('image/jpeg', 0.92)
  } catch { return null }
}

export async function descargarReporteIAPdf({ reporte, tipo, nombre, vistaPrevia = false }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const c = reporte.contenido ?? {}
  const m = reporte.metricas ?? {}
  const logo = await cargarImagen('/siga-wordmark.png')
  let y = 0

  const fuente = (estilo = 'normal', tam = 9.5, color = C.texto) => {
    doc.setFont('helvetica', estilo); doc.setFontSize(tam); doc.setTextColor(color)
  }
  const lineas = (txt, ancho, tam) => { doc.setFontSize(tam); return doc.splitTextToSize(limpio(txt), ancho) }
  const altoTexto = (n, tam) => n * tam * 0.42
  const espacio = alto => { if (y + alto > PIE) { doc.addPage(); encabezadoCorto(); } }

  function encabezadoCorto() {
    doc.setFillColor(C.marino); doc.rect(0, 0, W, 12, 'F')
    doc.setFillColor(C.guinda); doc.rect(0, 12, W, 1.2, 'F')
    fuente('bold', 9, '#FFFFFF')
    doc.text(limpio(`Reporte con IA · ${nombre}`), M, 8)
    y = 22
  }

  // Pide sitio para el título Y un primer bloque: así nunca queda huérfano al pie.
  function titulo(txt, color = C.marino) {
    espacio(34)
    doc.setFillColor(color); doc.roundedRect(M, y - 3.6, 1.6, 5, 0.8, 0.8, 'F')
    fuente('bold', 11.5, C.texto); doc.text(limpio(txt), M + 4, y)
    y += 6
  }

  function barra(x, yy, nivel) {
    for (let i = 0; i < 5; i++) {
      doc.setFillColor(i < nivel ? colorNivel(nivel) : C.linea)
      doc.roundedRect(x + i * 5.4, yy, 4.6, 1.8, 0.9, 0.9, 'F')
    }
  }

  // Lista de competencias o habilidades: nombre + barra + evidencia.
  function listaNiveles(items) {
    for (const it of items ?? []) {
      const ev = lineas(it.evidencia, ANCHO - 6, 8.5)
      espacio(8 + altoTexto(ev.length, 8.5))
      doc.setFillColor(C.fondo); doc.setDrawColor(C.linea)
      doc.roundedRect(M, y - 4, ANCHO, 7 + altoTexto(ev.length, 8.5) + 2, 2, 2, 'FD')
      fuente('bold', 10, C.texto); doc.text(limpio(it.nombre), M + 3, y + 0.6)
      barra(W - M - 38, y - 1.2, it.nivel)
      fuente('normal', 7.5, C.tenue); doc.text(`${it.nivel}/5`, W - M - 3, y + 0.6, { align: 'right' })
      fuente('normal', 8.5, C.suave); doc.text(ev, M + 3, y + 5.2)
      y += 7 + altoTexto(ev.length, 8.5) + 4
    }
  }

  // Dos columnas de viñetas (fortalezas / áreas de mejora, riesgo / destacados).
  function dosColumnas(izq, der) {
    const col = (ANCHO - 6) / 2
    const preparar = ({ items }) => (items ?? []).map(t => lineas(t, col - 9, 9))
    const li = preparar(izq), ld = preparar(der)
    const alto = l => 10 + l.reduce((s, x) => s + altoTexto(x.length, 9) + 2.2, 0) + 2
    const h = Math.max(alto(li), alto(ld), 18)
    espacio(h + 4)
    ;[[izq, li, M], [der, ld, M + col + 6]].forEach(([cfg, ls, x]) => {
      doc.setFillColor('#FFFFFF'); doc.setDrawColor(C.linea); doc.roundedRect(x, y - 4, col, h, 2.5, 2.5, 'FD')
      doc.setFillColor(cfg.color); doc.rect(x, y - 4, col, 1.4, 'F')
      fuente('bold', 10, cfg.color); doc.text(limpio(cfg.titulo), x + 4, y + 2.2)
      let yy = y + 8.5
      if (!ls.length) { fuente('normal', 8.5, C.tenue); doc.text('Nada que destacar.', x + 4, yy) }
      for (const l of ls) {
        doc.setFillColor(cfg.color); doc.circle(x + 5, yy - 1.1, 0.8, 'F')
        fuente('normal', 9, C.texto); doc.text(l, x + 8, yy)
        yy += altoTexto(l.length, 9) + 2.2
      }
    })
    y += h + 4
  }

  /* ── Portada: banda con logo ── */
  doc.setFillColor(C.marino); doc.rect(0, 0, W, 44, 'F')
  doc.setFillColor(C.guinda); doc.rect(0, 44, W, 2, 'F')
  doc.setFillColor(C.dorado); doc.rect(0, 46, 46, 1, 'F')
  if (logo) {
    doc.setFillColor('#FFFFFF'); doc.roundedRect(M, 9, 46, 22, 3, 3, 'F')
    doc.addImage(logo, 'JPEG', M + 3, 11, 40, 18)
  }
  fuente('bold', 9, C.dorado)
  doc.text(tipo === 'alumno' ? 'REPORTE DE COMPETENCIAS DEL ALUMNO' : 'REPORTE DE DESEMPEÑO DEL GRUPO', M + 54, 15)
  fuente('bold', 17, '#FFFFFF')
  doc.text(lineas(nombre, ANCHO - 54, 17).slice(0, 2), M + 54, 23)
  const sub = tipo === 'alumno'
    ? [m.alumno?.grupo, m.alumno?.sucursal, m.alumno?.curso].filter(Boolean).join(' · ')
    : [m.grupo?.sucursal, m.grupo?.curso, m.grupo?.alumnos != null ? `${m.grupo.alumnos} alumnos` : null].filter(Boolean).join(' · ')
  fuente('normal', 9, '#CBD5E1'); doc.text(limpio(sub), M + 54, 36)
  y = 56

  /* ── Nivel, fecha y resumen ── */
  const [etiqueta, colorEt] = NIVEL[c.nivel_general] ?? ['Sin nivel', C.suave]
  fuente('bold', 8.5, '#FFFFFF')
  const anchoEt = doc.getTextWidth(etiqueta.toUpperCase()) + 8
  doc.setFillColor(colorEt); doc.roundedRect(M, y - 4.2, anchoEt, 6, 3, 3, 'F')
  doc.text(etiqueta.toUpperCase(), M + 4, y)
  fuente('normal', 8.5, C.suave)
  doc.text(limpio(`Generado el ${fecha(reporte.created_at)}`), M + anchoEt + 4, y)
  y += 7
  const res = lineas(c.resumen, ANCHO - 8, 10)
  doc.setFillColor(C.cielo); doc.roundedRect(M, y - 4, ANCHO, altoTexto(res.length, 10) + 4, 2.5, 2.5, 'F')
  fuente('normal', 10, C.texto); doc.text(res, M + 4, y + 1)
  y += altoTexto(res.length, 10) + 6

  /* ── Datos clave ── */
  const datos = tipo === 'alumno'
    ? [
        ['PROMEDIO', m.resumen?.promedio ?? '—', m.resumen?.promedio_grupo != null ? `Grupo: ${m.resumen.promedio_grupo}` : ''],
        ['POSICIÓN', m.resumen?.posicion ?? '—', 'En su grupo'],
        ['ASISTENCIA', m.resumen?.asistencia?.porcentaje != null ? `${m.resumen.asistencia.porcentaje}%` : '—',
          m.resumen?.asistencia ? `${m.resumen.asistencia.faltas} falta(s) · ${m.resumen.asistencia.tardanzas} retardo(s)` : ''],
        ['GARANTÍA', m.alumno?.garantia ? m.alumno.garantia.charAt(0).toUpperCase() + m.alumno.garantia.slice(1) : '—', m.alumno?.area ? m.alumno.area.split(' (')[0] : ''],
      ]
    : [
        ['PROMEDIO', m.resumen?.promedio ?? '—', 'Del grupo'],
        ['ASISTENCIA', m.resumen?.asistencia != null ? `${m.resumen.asistencia}%` : '—', 'Promedio'],
        ['ALUMNOS', m.grupo?.alumnos ?? '—', ''],
        ['EN RIESGO', m.resumen?.en_riesgo ?? '—', 'Promedio < 7 o asistencia < 80%'],
      ]
  const ancho = (ANCHO - 9) / 4
  datos.forEach(([k, v, s], i) => {
    const x = M + i * (ancho + 3)
    doc.setFillColor('#FFFFFF'); doc.setDrawColor(C.linea); doc.roundedRect(x, y, ancho, 20, 2.5, 2.5, 'FD')
    doc.setFillColor(i % 2 ? C.guinda : C.marino); doc.rect(x, y + 3, 1.2, 14, 'F')
    fuente('bold', 7, C.tenue); doc.text(k, x + 4, y + 5.5)
    fuente('bold', 14, C.texto); doc.text(limpio(String(v)), x + 4, y + 12.5)
    fuente('normal', 6.8, C.suave); doc.text(lineas(s, ancho - 6, 6.8).slice(0, 1), x + 4, y + 17)
  })
  y += 28

  /* ── Alertas ── */
  if (c.alertas?.length) {
    const ls = c.alertas.map(a => lineas(a, ANCHO - 12, 9))
    const h = 9 + ls.reduce((s, l) => s + altoTexto(l.length, 9) + 1.8, 0)
    espacio(h + 4)
    doc.setFillColor('#FEF3C7'); doc.setDrawColor('#FCD34D'); doc.roundedRect(M, y - 4, ANCHO, h, 2.5, 2.5, 'FD')
    fuente('bold', 10, C.aviso); doc.text('Alertas', M + 4, y + 1.5)
    let yy = y + 7
    for (const l of ls) { fuente('normal', 9, C.texto); doc.text('!', M + 5, yy); doc.text(l, M + 9, yy); yy += altoTexto(l.length, 9) + 1.8 }
    y += h + 4
  }

  /* ── Competencias / habilidades ── */
  titulo('Competencias académicas')
  listaNiveles(c.competencias)
  if (tipo === 'alumno') {
    titulo('Habilidades y hábitos', C.guinda)
    listaNiveles(c.habilidades)
    titulo('Fortalezas y áreas de mejora')
    dosColumnas({ titulo: 'Fortalezas', color: C.bien, items: c.fortalezas },
                { titulo: 'Áreas de mejora', color: C.aviso, items: c.areas_mejora })
  } else {
    titulo('Materias y alumnos', C.guinda)
    dosColumnas({ titulo: 'Materias que requieren atención', color: C.aviso, items: (c.materias_criticas ?? []).map(x => `${x.materia}: ${x.motivo}`) },
                { titulo: 'Alumnos en riesgo', color: C.mal, items: (c.alumnos_riesgo ?? []).map(x => `${x.nombre}: ${x.motivo}`) })
    dosColumnas({ titulo: 'Destacados', color: C.bien, items: (c.destacados ?? []).map(x => `${x.nombre}: ${x.motivo}`) },
                { titulo: 'Materias del grupo', color: C.marino, items: (m.materias ?? []).filter(x => x.promedio != null)
                    .map(x => `${x.materia}: ${x.promedio} (${x.aprobados_pct ?? 0}% aprueba)`) })
  }

  /* ── Recomendaciones ── */
  titulo('Recomendaciones')
  for (const r of c.recomendaciones ?? []) {
    const o = typeof r === 'string' ? { texto: r } : r
    const conEtiqueta = !!o.para
    const ls = lineas(o.texto, ANCHO - (conEtiqueta ? 30 : 8), 9.5)
    espacio(altoTexto(ls.length, 9.5) + 6)
    if (conEtiqueta) {
      doc.setFillColor(o.para === 'docente' ? C.marino : o.para === 'tutor' ? C.guinda : C.dorado)
      doc.roundedRect(M, y - 3.6, 22, 5, 2.5, 2.5, 'F')
      fuente('bold', 6.8, o.para === 'alumno' ? C.texto : '#FFFFFF'); doc.text(PARA[o.para] ?? String(o.para).toUpperCase(), M + 11, y - 0.2, { align: 'center' })
    } else {
      doc.setFillColor(C.dorado); doc.circle(M + 2, y - 1.2, 1, 'F')
    }
    fuente('normal', 9.5, C.texto); doc.text(ls, M + (conEtiqueta ? 26 : 6), y)
    y += altoTexto(ls.length, 9.5) + 3.5
  }

  /* ── Pie en todas las páginas ── */
  const total = doc.getNumberOfPages()
  for (let p = 1; p <= total; p++) {
    doc.setPage(p)
    doc.setDrawColor(C.linea); doc.line(M, 287, W - M, 287)
    fuente('normal', 7, C.tenue)
    doc.text('SIGA CEFIMAT · Uso interno. Generado por IA a partir de los datos de SIGA; revísalo antes de usarlo en una decisión.', M, 291)
    doc.text(`${p} / ${total}`, W - M, 291, { align: 'right' })
  }

  // `vistaPrevia`: devuelve la URL del PDF en vez de descargarlo.
  if (vistaPrevia) return doc.output('bloburl')
  doc.save(`reporte_ia_${slug(nombre)}_${new Date(reporte.created_at).toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })}.pdf`)
}
