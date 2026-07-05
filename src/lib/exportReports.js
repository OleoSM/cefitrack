import * as XLSX from 'xlsx'

const todayFile = () => new Date()
  .toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' })
  .replace(/\//g, '-')

const cap = t => t ? t.charAt(0).toUpperCase() + t.slice(1) : ''

/* Reporte de aprovechamiento hasta el momento — para compartir con el tutor */
export function exportStudentReport({ student, group, evals = [], attendance = [], sims = [] }) {
  const wb = XLSX.utils.book_new()

  const resumen = [
    ['REPORTE DE APROVECHAMIENTO — SIGA CEFIMAT'],
    [],
    ['Alumno',                 student.name],
    ['Correo',                 student.email],
    ['Grupo',                  group ? `${group.name} — ${group.subject}` : ''],
    ['Tutor',                  student.tutor?.name ?? ''],
    ['Contacto del tutor',     [student.tutor?.email, student.tutor?.phone].filter(Boolean).join('  ·  ')],
    [],
    ['Promedio general',       student.avgGrade],
    ['Asistencia',             `${student.attendanceRate}%`],
    ['Tareas entregadas',      `${student.assignmentsDone}/${student.assignmentsTotal}`],
    ['Lugar en el grupo',      `#${student.rank}`],
    ['Términos y condiciones', student.termsStatus === 'firmado' ? `Firmado (${student.signedAt ?? ''})` : 'Pendiente de firma'],
    [],
    ['Fecha del reporte',      new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })],
  ]
  const wsResumen = XLSX.utils.aoa_to_sheet(resumen)
  wsResumen['!cols'] = [{ wch: 24 }, { wch: 46 }]
  XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen')

  if (evals.length) {
    const ws = XLSX.utils.json_to_sheet(evals.map(e => ({
      Fecha: e.fecha, Materia: e.materia, Tipo: e.tipo,
      'Calificación': e.calificacion, 'Máx.': e.calMax, Periodo: e.periodo,
    })))
    ws['!cols'] = [{ wch: 12 }, { wch: 18 }, { wch: 16 }, { wch: 12 }, { wch: 6 }, { wch: 10 }]
    XLSX.utils.book_append_sheet(wb, ws, 'Evaluaciones')
  }

  if (attendance.length) {
    const ws = XLSX.utils.json_to_sheet(attendance.map(a => ({
      Fecha: a.date, Estado: cap(a.status), Hora: a.time ?? '',
    })))
    ws['!cols'] = [{ wch: 12 }, { wch: 14 }, { wch: 8 }]
    XLSX.utils.book_append_sheet(wb, ws, 'Asistencias')
  }

  if (sims.length) {
    const ws = XLSX.utils.json_to_sheet(sims.map(s => ({
      Folio: s.folio ?? '', Modalidad: cap(s.modalidad), Fecha: s.fecha,
      Aciertos: s.aciertos, Total: s.total, 'Duración': s.duracion,
    })))
    ws['!cols'] = [{ wch: 8 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 8 }, { wch: 12 }]
    XLSX.utils.book_append_sheet(wb, ws, 'Simulacros')
  }

  XLSX.writeFile(wb, `Reporte_${student.name.replace(/\s+/g, '_')}_${todayFile()}.xlsx`)
}

/* Reporte mensual individual (tarjetas del tab Reportes) */
export function exportMonthlyReport(student, report) {
  const rows = [
    [`REPORTE MENSUAL — ${report.mes.toUpperCase()}`],
    [],
    ['Alumno',            student.name],
    ['Generado por',      report.generadoPor],
    [],
    ['Promedio',          report.promedio],
    ['Asistencia',        `${report.asistencia}%`],
    ['Tareas entregadas', `${report.tareasEntregadas}/${report.tareasTotal}`],
    [],
    ['Fortalezas'],
    ...report.fortalezas.map(f => ['', f]),
    [],
    ['Áreas de mejora'],
    ...report.areas.map(a => ['', a]),
    [],
    ['Comentario del docente'],
    ['', report.comentario],
  ]
  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = [{ wch: 22 }, { wch: 80 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Reporte')
  XLSX.writeFile(wb, `Reporte_${report.mes.replace(/\s+/g, '_')}_${student.name.replace(/\s+/g, '_')}.xlsx`)
}
