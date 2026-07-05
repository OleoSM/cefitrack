// ─── USUARIOS ─────────────────────────────────────────────────────────────────
export const users = [
  { id: 'u1', name: 'Prof. Mario Sánchez Vega', email: 'admin@edutrack.mx', password: '123456', role: 'admin' },
  { id: 'u2', name: 'Ana García López',         email: 'ana.garcia@edutrack.mx', password: '123456', role: 'student', studentId: 's1' },
  { id: 'u3', name: 'Carlos Martínez H.',       email: 'carlos.mtz@edutrack.mx', password: '123456', role: 'student', studentId: 's2' },
]

// ─── GRUPOS ───────────────────────────────────────────────────────────────────
export const groups = [
  { id: 'g1', name: 'Grupo A', subject: 'Matemáticas Avanzadas', schedule: 'Lun / Mié / Vie  08:00 – 09:30', room: 'Aula 201', studentCount: 7,  avgGrade: 8.2, attendanceRate: 91, color: '#3b82f6' },
  { id: 'g2', name: 'Grupo B', subject: 'Física Aplicada',       schedule: 'Mar / Jue         09:00 – 11:00', room: 'Lab 102',  studentCount: 7,  avgGrade: 7.8, attendanceRate: 87, color: '#10b981' },
  { id: 'g3', name: 'Grupo C', subject: 'Química General',       schedule: 'Lun / Mié         11:00 – 12:30', room: 'Lab 305', studentCount: 6,  avgGrade: 8.5, attendanceRate: 93, color: '#f59e0b' },
]

// ─── ALUMNOS ──────────────────────────────────────────────────────────────────
export const students = [
  { id:'s1',  name:'Ana García López',           email:'ana.garcia@edutrack.mx',    groupId:'g1', tutor:{ name:'Carmen López',     email:'carmen.lopez@gmail.com',   phone:'555-0101' }, attendanceRate:95, avgGrade:9.2, assignmentsDone:18, assignmentsTotal:20, rank:1,  status:'excellent', termsStatus:'firmado',   signatureDataUrl:null, signedAt:'31 de mayo de 2026, 09:14', curpDoc:'curp_ana_garcia.pdf',       ineTutorDoc:'ine_carmen_lopez.jpg',      waAdded:true  },
  { id:'s2',  name:'Carlos Martínez Hernández',  email:'carlos.mtz@edutrack.mx',    groupId:'g1', tutor:{ name:'Roberto Martínez', email:'roberto.mtz@gmail.com',    phone:'555-0102' }, attendanceRate:72, avgGrade:6.8, assignmentsDone:12, assignmentsTotal:20, rank:12, status:'at-risk',   termsStatus:'pendiente', signatureDataUrl:null, signedAt:null, curpDoc:null,                        ineTutorDoc:null,                        waAdded:false },
  { id:'s3',  name:'María Rodríguez Sánchez',    email:'maria.rdz@edutrack.mx',     groupId:'g1', tutor:{ name:'Luis Rodríguez',   email:'luis.rdz@gmail.com',       phone:'555-0103' }, attendanceRate:88, avgGrade:8.1, assignmentsDone:17, assignmentsTotal:20, rank:5,  status:'good',      termsStatus:'firmado',   signatureDataUrl:null, signedAt:'28 de mayo de 2026, 11:02', curpDoc:'curp_maria_rdz.pdf',        ineTutorDoc:'ine_luis_rdz.pdf',          waAdded:true  },
  { id:'s4',  name:'José Luis Pérez Torres',     email:'joseluis.pt@edutrack.mx',   groupId:'g1', tutor:{ name:'María Pérez',      email:'maria.perez@gmail.com',    phone:'555-0104' }, attendanceRate:91, avgGrade:7.9, assignmentsDone:16, assignmentsTotal:20, rank:7,  status:'good',      termsStatus:'pendiente', signatureDataUrl:null, signedAt:null, curpDoc:null,                        ineTutorDoc:null,                        waAdded:false },
  { id:'s5',  name:'Laura Domínguez Flores',     email:'laura.df@edutrack.mx',      groupId:'g1', tutor:{ name:'Pedro Domínguez',  email:'pedro.dom@gmail.com',      phone:'555-0105' }, attendanceRate:97, avgGrade:8.9, assignmentsDone:19, assignmentsTotal:20, rank:2,  status:'excellent', termsStatus:'firmado',   signatureDataUrl:null, signedAt:'30 de mayo de 2026, 08:45', curpDoc:'curp_laura_df.pdf',         ineTutorDoc:'ine_pedro_dom.jpg',         waAdded:true  },
  { id:'s6',  name:'Roberto Jiménez Castro',     email:'roberto.jc@edutrack.mx',    groupId:'g1', tutor:{ name:'Elena Castro',     email:'elena.cast@gmail.com',     phone:'555-0106' }, attendanceRate:65, avgGrade:5.9, assignmentsDone:9,  assignmentsTotal:20, rank:18, status:'critical',  termsStatus:'pendiente', signatureDataUrl:null, signedAt:null, curpDoc:null,                        ineTutorDoc:null,                        waAdded:false },
  { id:'s7',  name:'Sofía Morales Gutiérrez',    email:'sofia.mg@edutrack.mx',      groupId:'g1', tutor:{ name:'Ana Gutiérrez',    email:'ana.gut@gmail.com',        phone:'555-0107' }, attendanceRate:85, avgGrade:7.5, assignmentsDone:15, assignmentsTotal:20, rank:9,  status:'good',      termsStatus:'pendiente', signatureDataUrl:null, signedAt:null, curpDoc:'curp_sofia_mg.jpg',         ineTutorDoc:null,                        waAdded:false },
  { id:'s8',  name:'Diego Ramírez Vargas',       email:'diego.rv@edutrack.mx',      groupId:'g2', tutor:{ name:'Jorge Ramírez',    email:'jorge.ram@gmail.com',      phone:'555-0108' }, attendanceRate:93, avgGrade:8.7, assignmentsDone:18, assignmentsTotal:20, rank:3,  status:'excellent', termsStatus:'firmado',   signatureDataUrl:null, signedAt:'25 de mayo de 2026, 14:30', curpDoc:'curp_diego_rv.pdf',         ineTutorDoc:'ine_jorge_ram.pdf',         waAdded:true  },
  { id:'s9',  name:'Valentina Cruz Mendoza',     email:'valentina.cm@edutrack.mx',  groupId:'g2', tutor:{ name:'Sandra Mendoza',   email:'sandra.men@gmail.com',     phone:'555-0109' }, attendanceRate:78, avgGrade:7.2, assignmentsDone:14, assignmentsTotal:20, rank:11, status:'warning',   termsStatus:'pendiente', signatureDataUrl:null, signedAt:null, curpDoc:null,                        ineTutorDoc:null,                        waAdded:false },
  { id:'s10', name:'Andrés López Aguilar',       email:'andres.la@edutrack.mx',     groupId:'g2', tutor:{ name:'Patricia Aguilar', email:'patricia.ag@gmail.com',    phone:'555-0110' }, attendanceRate:90, avgGrade:8.3, assignmentsDone:17, assignmentsTotal:20, rank:4,  status:'excellent', termsStatus:'firmado',   signatureDataUrl:null, signedAt:'29 de mayo de 2026, 10:15', curpDoc:'curp_andres_la.pdf',        ineTutorDoc:'ine_patricia_ag.jpg',       waAdded:true  },
  { id:'s11', name:'Isabela Hernández Ramos',    email:'isabela.hr@edutrack.mx',    groupId:'g2', tutor:{ name:'Marco Hernández',  email:'marco.hern@gmail.com',     phone:'555-0111' }, attendanceRate:82, avgGrade:7.6, assignmentsDone:15, assignmentsTotal:20, rank:8,  status:'good',      termsStatus:'pendiente', signatureDataUrl:null, signedAt:null, curpDoc:'curp_isabela_hr.pdf',       ineTutorDoc:null,                        waAdded:false },
  { id:'s12', name:'Miguel Ángel Torres Reyes',  email:'miguel.tr@edutrack.mx',     groupId:'g2', tutor:{ name:'Rosa Reyes',       email:'rosa.reyes@gmail.com',     phone:'555-0112' }, attendanceRate:68, avgGrade:6.3, assignmentsDone:11, assignmentsTotal:20, rank:15, status:'at-risk',   termsStatus:'pendiente', signatureDataUrl:null, signedAt:null, curpDoc:null,                        ineTutorDoc:null,                        waAdded:false },
  { id:'s13', name:'Fernanda González Medina',   email:'fernanda.gm@edutrack.mx',   groupId:'g2', tutor:{ name:'Carlos González',  email:'carlos.gon@gmail.com',     phone:'555-0113' }, attendanceRate:96, avgGrade:9.0, assignmentsDone:20, assignmentsTotal:20, rank:1,  status:'excellent', termsStatus:'firmado',   signatureDataUrl:null, signedAt:'27 de mayo de 2026, 09:55', curpDoc:'curp_fernanda_gm.pdf',      ineTutorDoc:'ine_carlos_gon.pdf',        waAdded:true  },
  { id:'s14', name:'Alejandro Sánchez Muñoz',    email:'alejandro.sm@edutrack.mx',  groupId:'g2', tutor:{ name:'Isabel Muñoz',     email:'isabel.mun@gmail.com',     phone:'555-0114' }, attendanceRate:87, avgGrade:7.8, assignmentsDone:16, assignmentsTotal:20, rank:6,  status:'good',      termsStatus:'pendiente', signatureDataUrl:null, signedAt:null, curpDoc:null,                        ineTutorDoc:null,                        waAdded:false },
  { id:'s15', name:'Camila Flores Ortiz',        email:'camila.fo@edutrack.mx',     groupId:'g3', tutor:{ name:'Hugo Flores',      email:'hugo.flo@gmail.com',       phone:'555-0115' }, attendanceRate:94, avgGrade:8.8, assignmentsDone:19, assignmentsTotal:20, rank:2,  status:'excellent', termsStatus:'firmado',   signatureDataUrl:null, signedAt:'26 de mayo de 2026, 16:00', curpDoc:'curp_camila_fo.jpg',        ineTutorDoc:'ine_hugo_flo.pdf',          waAdded:true  },
  { id:'s16', name:'Eduardo Martínez Díaz',      email:'eduardo.md@edutrack.mx',    groupId:'g3', tutor:{ name:'Gloria Díaz',      email:'gloria.diaz@gmail.com',    phone:'555-0116' }, attendanceRate:75, avgGrade:6.9, assignmentsDone:13, assignmentsTotal:20, rank:13, status:'at-risk',   termsStatus:'pendiente', signatureDataUrl:null, signedAt:null, curpDoc:null,                        ineTutorDoc:null,                        waAdded:false },
  { id:'s17', name:'Andrea Jiménez Villanueva',  email:'andrea.jv@edutrack.mx',     groupId:'g3', tutor:{ name:'Felipe Jiménez',   email:'felipe.jim@gmail.com',     phone:'555-0117' }, attendanceRate:89, avgGrade:8.2, assignmentsDone:17, assignmentsTotal:20, rank:4,  status:'good',      termsStatus:'firmado',   signatureDataUrl:null, signedAt:'31 de mayo de 2026, 07:30', curpDoc:'curp_andrea_jv.pdf',        ineTutorDoc:'ine_felipe_jim.jpg',        waAdded:false },
  { id:'s18', name:'Ricardo García Moreno',      email:'ricardo.gm@edutrack.mx',    groupId:'g3', tutor:{ name:'Teresa Moreno',    email:'teresa.mor@gmail.com',     phone:'555-0118' }, attendanceRate:60, avgGrade:5.5, assignmentsDone:8,  assignmentsTotal:20, rank:20, status:'critical',  termsStatus:'pendiente', signatureDataUrl:null, signedAt:null, curpDoc:null,                        ineTutorDoc:null,                        waAdded:false },
  { id:'s19', name:'Daniela Pérez Salazar',      email:'daniela.ps@edutrack.mx',    groupId:'g3', tutor:{ name:'Arturo Pérez',     email:'arturo.per@gmail.com',     phone:'555-0119' }, attendanceRate:91, avgGrade:8.6, assignmentsDone:18, assignmentsTotal:20, rank:3,  status:'excellent', termsStatus:'firmado',   signatureDataUrl:null, signedAt:'30 de mayo de 2026, 13:20', curpDoc:'curp_daniela_ps.pdf',       ineTutorDoc:'ine_arturo_per.pdf',        waAdded:true  },
  { id:'s20', name:'Sebastián Ruiz Contreras',   email:'sebastian.rc@edutrack.mx',  groupId:'g3', tutor:{ name:'Martha Contreras', email:'martha.con@gmail.com',     phone:'555-0120' }, attendanceRate:83, avgGrade:7.7, assignmentsDone:15, assignmentsTotal:20, rank:7,  status:'good',      termsStatus:'pendiente', signatureDataUrl:null, signedAt:null, curpDoc:null,                        ineTutorDoc:null,                        waAdded:false },
]

// ─── TENDENCIA MENSUAL (últimos 6 meses) ─────────────────────────────────────
export const monthlyTrend = [
  { mes:'Sep', grupoA:8.0, grupoB:7.6, grupoC:8.3, asistencia:90 },
  { mes:'Oct', grupoA:8.1, grupoB:7.5, grupoC:8.4, asistencia:88 },
  { mes:'Nov', grupoA:7.8, grupoB:7.9, grupoC:8.1, asistencia:85 },
  { mes:'Dic', grupoA:7.5, grupoB:7.2, grupoC:7.8, asistencia:82 },
  { mes:'Ene', grupoA:8.3, grupoB:8.0, grupoC:8.6, asistencia:91 },
  { mes:'Feb', grupoA:8.2, grupoB:7.8, grupoC:8.5, asistencia:90 },
]

// ─── EVALUACIONES ─────────────────────────────────────────────────────────────
const tipos = ['Examen Parcial','Tarea','Proyecto','Examen Final','Quíz','Práctica']
const materias = { g1:['Álgebra','Cálculo','Geometría'], g2:['Mecánica','Termodinámica','Electromagnetismo'], g3:['Orgánica','Inorgánica','Bioquímica'] }
const fechas  = ['2025-09-15','2025-09-28','2025-10-12','2025-10-25','2025-11-08','2025-11-22','2025-12-06','2026-01-20','2026-02-03','2026-02-17']

export const evaluations = students.flatMap(s => {
  const mats = materias[s.groupId]
  return mats.flatMap((materia, mi) =>
    fechas.slice(0, 6).map((fecha, i) => ({
      id: `ev-${s.id}-${mi}-${i}`,
      studentId: s.id,
      materia,
      tipo: tipos[(mi + i) % tipos.length],
      calificacion: Math.min(10, Math.max(4, +(s.avgGrade + (Math.random() - 0.5) * 2).toFixed(1))),
      calMax: 10,
      fecha,
      periodo: i < 2 ? 'Sep–Oct' : i < 4 ? 'Oct–Nov' : 'Nov–Dic',
    }))
  )
})

// ─── ASISTENCIAS (Mayo 2025 – actual) ────────────────────────────────────────
const attendanceStatuses = ['presente','presente','presente','tardanza','ausente']
export const attendance = students.flatMap(s => {
  const records = []
  for (let d = 1; d <= 28; d++) {
    const date = `2026-04-${String(d).padStart(2,'0')}`
    const dayOfWeek = new Date(date).getDay()
    if (dayOfWeek === 0 || dayOfWeek === 6) continue
    const rand = Math.random()
    let status
    if (s.attendanceRate >= 90) status = rand < 0.92 ? 'presente' : rand < 0.96 ? 'tardanza' : 'ausente'
    else if (s.attendanceRate >= 75) status = rand < 0.78 ? 'presente' : rand < 0.88 ? 'ausente' : 'tardanza'
    else status = rand < 0.60 ? 'presente' : rand < 0.75 ? 'ausente' : rand < 0.88 ? 'tardanza' : 'justificado'
    // Hora determinista basada en día: presente 07:55–08:04, tardanza 08:06–08:24, ausente null
    const time = status === 'ausente' || status === 'justificado'
      ? null
      : status === 'tardanza'
        ? `08:${String(6 + (d % 19)).padStart(2,'0')}`
        : `07:${String(55 + (d % 9)).padStart(2,'0')}`
    records.push({ id:`att-${s.id}-${d}`, studentId:s.id, groupId:s.groupId, date, status, time })
  }
  return records
})

// ─── REPORTES MENSUALES ───────────────────────────────────────────────────────
export const reports = [
  {
    id:'rpt-s1-feb', studentId:'s1', mes:'Febrero 2026', promedio:9.2, asistencia:96,
    tareasEntregadas:5, tareasTotal:5,
    fortalezas:['Dominio sobresaliente de álgebra lineal','Participación activa en clase','Entrega puntual de todas las tareas'],
    areas:['Podría mejorar en resolución de problemas bajo presión de tiempo'],
    comentario:'Ana continúa siendo la alumna con mayor rendimiento del grupo. Su desempeño en febrero superó expectativas. Se recomienda inscribirla en el programa de tutorías avanzadas.',
    generadoPor:'Prof. Mario Sánchez',
  },
  {
    id:'rpt-s1-ene', studentId:'s1', mes:'Enero 2026', promedio:9.0, asistencia:95,
    tareasEntregadas:4, tareasTotal:5,
    fortalezas:['Excelente comprensión conceptual','Trabajo en equipo destacado'],
    areas:['Faltó una tarea en la segunda semana'],
    comentario:'Inicio de año muy sólido. Ana retomó el ritmo rápidamente después del receso.',
    generadoPor:'Prof. Mario Sánchez',
  },
  {
    id:'rpt-s2-feb', studentId:'s2', mes:'Febrero 2026', promedio:6.8, asistencia:72,
    tareasEntregadas:3, tareasTotal:5,
    fortalezas:['Mejora visible respecto a enero en exámenes parciales'],
    areas:['Asistencia por debajo del 75% mínimo requerido','Dos tareas no entregadas','Dificultades en temas de geometría analítica'],
    comentario:'Carlos requiere atención inmediata. Se contactó al tutor el 15/02. Se recomienda plan de recuperación académica.',
    generadoPor:'Prof. Mario Sánchez',
  },
]

// ─── DATOS ANÁLISIS IA (estático) ─────────────────────────────────────────────
export const aiInsights = [
  {
    studentId:'s2', nombre:'Carlos Martínez H.', riesgo:'alto',
    deficiencias:[
      { materia:'Geometría Analítica', nivel:35, problema:'No comprende transformaciones lineales' },
      { materia:'Álgebra',             nivel:52, problema:'Errores frecuentes en factorización' },
    ],
    recomendaciones:['Sesiones de refuerzo 2x semana','Material de nivelación básica','Comunicar urgencia al tutor'],
    patron:'Inasistencias frecuentes los lunes correlacionan con bajo rendimiento en exámenes semanales.',
  },
  {
    studentId:'s6', nombre:'Roberto Jiménez C.', riesgo:'crítico',
    deficiencias:[
      { materia:'Álgebra',   nivel:28, problema:'No domina operaciones fundamentales' },
      { materia:'Cálculo',   nivel:31, problema:'No entiende concepto de límites' },
      { materia:'Geometría', nivel:40, problema:'Errores en medición y conversión de unidades' },
    ],
    recomendaciones:['Intervención urgente del tutor','Considerar recursar la materia','Evaluación diagnóstica completa'],
    patron:'Patrón de abandono progresivo. 7 ausencias consecutivas la última semana de febrero.',
  },
  {
    studentId:'s12', nombre:'Miguel Ángel Torres', riesgo:'alto',
    deficiencias:[
      { materia:'Termodinámica',    nivel:45, problema:'Confunde conceptos de calor y temperatura' },
      { materia:'Electromagnetismo', nivel:38, problema:'Dificultades con ley de Faraday' },
    ],
    recomendaciones:['Tutorías entre pares con Diego Ramírez','Ejercicios adicionales de práctica'],
    patron:'Rendimiento cae significativamente en semanas con más de 2 evaluaciones simultáneas.',
  },
  {
    studentId:'s16', nombre:'Eduardo Martínez D.', riesgo:'alto',
    deficiencias:[
      { materia:'Química Orgánica', nivel:42, problema:'No identifica grupos funcionales' },
      { materia:'Bioquímica',       nivel:50, problema:'Confunde rutas metabólicas' },
    ],
    recomendaciones:['Material visual adicional (mapas conceptuales)','Práctica de laboratorio extra'],
    patron:'Mejor desempeño en prácticas de laboratorio (7.8) vs. exámenes teóricos (5.9). Aprendizaje kinestésico.',
  },
  {
    studentId:'s18', nombre:'Ricardo García M.', riesgo:'crítico',
    deficiencias:[
      { materia:'Química Orgánica', nivel:22, problema:'Deficiencias desde nivel básico' },
      { materia:'Inorgánica',       nivel:30, problema:'No comprende tabla periódica y enlaces' },
      { materia:'Bioquímica',       nivel:25, problema:'Prerrequisitos no cubiertos' },
    ],
    recomendaciones:['Evaluación diagnóstica','Plan de nivelación desde cero','Reunión urgente con tutor y dirección'],
    patron:'60% de asistencia es el factor principal. Sin asistencia regular, la recuperación es poco viable.',
  },
]

// ─── DATOS DE RADAR (competencias por alumno) ─────────────────────────────────
export const studentRadar = {
  s1:  [{ comp:'Álgebra',     valor:9.5},{ comp:'Cálculo',       valor:9.0},{ comp:'Geometría',   valor:9.2},{ comp:'Participación',valor:9.8},{ comp:'Tareas',valor:9.0},{ comp:'Asistencia',valor:9.5}],
  s2:  [{ comp:'Álgebra',     valor:5.2},{ comp:'Cálculo',       valor:6.0},{ comp:'Geometría',   valor:4.8},{ comp:'Participación',valor:6.5},{ comp:'Tareas',valor:6.0},{ comp:'Asistencia',valor:7.2}],
  s13: [{ comp:'Mecánica',    valor:9.1},{ comp:'Termodinámica', valor:9.3},{ comp:'Electro',     valor:8.9},{ comp:'Participación',valor:9.5},{ comp:'Tareas',valor:10.0},{ comp:'Asistencia',valor:9.6}],
  s8:  [{ comp:'Mecánica',    valor:8.8},{ comp:'Termodinámica', valor:8.5},{ comp:'Electro',     valor:9.0},{ comp:'Participación',valor:8.7},{ comp:'Tareas',valor:9.0},{ comp:'Asistencia',valor:9.3}],
}

// ─── GRÁFICA RENDIMIENTO POR MATERIA ─────────────────────────────────────────
export const subjectPerformance = [
  { materia:'Álgebra',      promedio:8.1, aprobados:6, reprobados:1 },
  { materia:'Cálculo',      promedio:7.6, aprobados:5, reprobados:2 },
  { materia:'Geometría',    promedio:7.9, aprobados:6, reprobados:1 },
  { materia:'Mecánica',     promedio:8.0, aprobados:6, reprobados:1 },
  { materia:'Termodinámica',promedio:7.4, aprobados:5, reprobados:2 },
  { materia:'Electro',      promedio:7.8, aprobados:5, reprobados:2 },
  { materia:'Org. Química', promedio:8.4, aprobados:5, reprobados:1 },
  { materia:'Inorgánica',   promedio:8.0, aprobados:5, reprobados:1 },
]

// ─── TENDENCIA DE NOTAS (alumno s1) ──────────────────────────────────────────
export const studentGradeTrend = {
  s1: [
    { mes:'Sep', algebra:9.0, calculo:8.8, geometria:9.5 },
    { mes:'Oct', algebra:9.2, calculo:9.0, geometria:9.1 },
    { mes:'Nov', algebra:8.8, calculo:9.3, geometria:9.4 },
    { mes:'Dic', algebra:9.5, calculo:9.1, geometria:9.0 },
    { mes:'Ene', algebra:9.1, calculo:9.2, geometria:9.3 },
    { mes:'Feb', algebra:9.3, calculo:9.0, geometria:9.5 },
  ],
  s2: [
    { mes:'Sep', algebra:7.0, calculo:6.5, geometria:6.8 },
    { mes:'Oct', algebra:6.5, calculo:7.0, geometria:6.2 },
    { mes:'Nov', algebra:6.8, calculo:6.3, geometria:5.9 },
    { mes:'Dic', algebra:5.5, calculo:6.8, geometria:5.5 },
    { mes:'Ene', algebra:7.0, calculo:6.5, geometria:6.0 },
    { mes:'Feb', algebra:7.2, calculo:6.8, geometria:6.5 },
  ],
}

// ─── HISTORIAL IMPORTACIONES ──────────────────────────────────────────────────
export const importHistory = [
  { id:'imp1', fecha:'2025-08-28', archivo:'Lista_Inicial_2025B.csv', alumnos:20, estado:'completado' },
  { id:'imp2', fecha:'2025-09-05', archivo:'Ajuste_Grupo_C.csv',      alumnos:2,  estado:'completado' },
]

// ─── ESCUELAS (placeholder — puntajes de corte por definir) ──────────────────
export const schools = [
  { id:'unam-medicina',  nombre:'UNAM — Medicina',                   tipo:'unam', area:9, corte:117 },
  { id:'unam-derecho',   nombre:'UNAM — Derecho',                    tipo:'unam', area:5, corte:108 },
  { id:'unam-psico',     nombre:'UNAM — Psicología',                 tipo:'unam', area:4, corte:95  },
  { id:'unam-ing',       nombre:'UNAM — Ingeniería',                 tipo:'unam', area:1, corte:99  },
  { id:'unam-arq',       nombre:'UNAM — Arquitectura',               tipo:'unam', area:2, corte:92  },
  { id:'unam-economia',  nombre:'UNAM — Economía',                   tipo:'unam', area:3, corte:89  },
  { id:'unam-contaduria',nombre:'UNAM — Contaduría',                 tipo:'unam', area:6, corte:86  },
  { id:'ipn-escom',      nombre:'IPN — ESCOM',                       tipo:'ipn',  area:null, corte:80 },
  { id:'ipn-esime',      nombre:'IPN — ESIME',                       tipo:'ipn',  area:null, corte:77 },
  { id:'ipn-enmh',       nombre:'IPN — ENMH (Medicina)',             tipo:'ipn',  area:null, corte:95 },
  { id:'ecoems-cch',     nombre:'CCH (UNAM)',                        tipo:'ecoems', area:null, corte:55 },
  { id:'ecoems-prepa',   nombre:'ENP (UNAM)',                        tipo:'ecoems', area:null, corte:58 },
  { id:'ecoems-cetis',   nombre:'CECyT / CETIS (IPN)',               tipo:'ecoems', area:null, corte:45 },
]

// ─── SIMULACROS ───────────────────────────────────────────────────────────────
// folio: EX-nn = simulacro presencial · EXD-nn = examen digital (ver src/lib/folios.js)
export const simulacros = [
  { id:'sim-s1-1', studentId:'s1', folio:'EX-01',  modalidad:'presencial', fecha:'2026-03-15', aciertos:72,  total:128, duracion:'2h 10min' },
  { id:'sim-s1-2', studentId:'s1', folio:'EX-02',  modalidad:'presencial', fecha:'2026-04-05', aciertos:88,  total:128, duracion:'2h 05min' },
  { id:'sim-s1-3', studentId:'s1', folio:'EXD-01', modalidad:'digital',    fecha:'2026-04-26', aciertos:97,  total:128, duracion:'2h 12min' },
  { id:'sim-s2-1', studentId:'s2', folio:'EX-01',  modalidad:'presencial', fecha:'2026-03-15', aciertos:45,  total:128, duracion:'2h 18min' },
  { id:'sim-s2-2', studentId:'s2', folio:'EX-02',  modalidad:'presencial', fecha:'2026-04-05', aciertos:53,  total:128, duracion:'2h 20min' },
  { id:'sim-s2-3', studentId:'s2', folio:'EXD-01', modalidad:'digital',    fecha:'2026-04-26', aciertos:61,  total:128, duracion:'2h 14min' },
]

// Escuela objetivo por alumno (targetSchoolId → schools[])
// El alumno lo elige desde su portal; por ahora hardcodeado en mock
const studentTargetSchools = {
  s1: 'unam-medicina',
  s2: 'unam-psico',
}

export const getSimulacrosByStudent = sid => simulacros.filter(s => s.studentId === sid)
export const getLastSimulacro       = sid => {
  const list = simulacros.filter(s => s.studentId === sid).sort((a,b) => b.fecha.localeCompare(a.fecha))
  return list[0] ?? null
}
export const getTargetSchool = sid => {
  const schoolId = studentTargetSchools[sid]
  return schools.find(s => s.id === schoolId) ?? null
}

// ─── ACTIVIDAD RECIENTE ───────────────────────────────────────────────────────
export const recentActivity = [
  { id:1, tipo:'asistencia',   texto:'Lista de asistencia Grupo A registrada',              hora:'Hace 2 horas',  icon:'check-circle' },
  { id:2, tipo:'evaluacion',   texto:'Calificaciones de Examen Parcial Grupo B subidas',    hora:'Hace 4 horas',  icon:'file-text'    },
  { id:3, tipo:'alerta',       texto:'Roberto Jiménez: 7 ausencias consecutivas',           hora:'Hoy 09:15',     icon:'alert-triangle'},
  { id:4, tipo:'reporte',      texto:'Reporte mensual febrero generado para Grupo C',       hora:'Ayer 17:30',    icon:'file-check'   },
  { id:5, tipo:'importacion',  texto:'2 alumnos importados al Grupo C',                    hora:'05/09/2025',    icon:'upload'       },
]

// ─── HELPERS ──────────────────────────────────────────────────────────────────
export const getStudentById   = id => students.find(s => s.id === id)
export const getGroupById     = id => groups.find(g => g.id === id)
export const getStudentsByGroup = gid => students.filter(s => s.groupId === gid)
export const getEvalsByStudent  = sid => evaluations.filter(e => e.studentId === sid)
export const getAttendByStudent = sid => attendance.filter(a => a.studentId === sid)
export const getReportsByStudent= sid => reports.filter(r => r.studentId === sid)
export const getInsightByStudent= sid => aiInsights.find(a => a.studentId === sid)

export const statusConfig = {
  excellent: { label:'Excelente', color:'text-emerald-400', bg:'bg-emerald-500/15',  border:'border-emerald-500/30', dot:'bg-emerald-400' },
  good:      { label:'Bueno',     color:'text-blue-400',    bg:'bg-blue-500/15',     border:'border-blue-500/30',    dot:'bg-blue-400'    },
  warning:   { label:'Atención',  color:'text-amber-400',   bg:'bg-amber-500/15',    border:'border-amber-500/30',   dot:'bg-amber-400'   },
  'at-risk': { label:'En Riesgo', color:'text-orange-400',  bg:'bg-orange-500/15',   border:'border-orange-500/30',  dot:'bg-orange-400'  },
  critical:  { label:'Crítico',   color:'text-red-400',     bg:'bg-red-500/15',      border:'border-red-500/30',     dot:'bg-red-400'     },
}

export const attendanceColors = {
  presente:    { label:'Presente',    bg:'bg-emerald-500/15', text:'text-emerald-400', dot:'bg-emerald-400', border:'border-emerald-500/30' },
  ausente:     { label:'Ausente',     bg:'bg-red-500/15',     text:'text-red-400',     dot:'bg-red-400',     border:'border-red-500/30'     },
  tardanza:    { label:'Tardanza',    bg:'bg-amber-500/15',   text:'text-amber-400',   dot:'bg-amber-400',   border:'border-amber-500/30'   },
  justificado: { label:'Justificado', bg:'bg-blue-500/15',    text:'text-blue-400',    dot:'bg-blue-400',    border:'border-blue-500/30'    },
}
