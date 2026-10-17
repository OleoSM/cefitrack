// Asistente de SIGA (Claude Haiku) — admins y sub-admins con el apartado "ia",
// SOLO lectura. Los alumnos nunca llegan aquí.
//
// Dos modos:
// · Chat (`{ mensajes }`): preguntas libres con herramientas de consulta.
// · Reporte (`{ accion:'reporte', tipo:'alumno'|'grupo', id }`): competencias,
//   habilidades, fortalezas, áreas de mejora y recomendaciones en JSON fijo.
//   Las métricas se calculan en metricas.ts; el modelo solo las interpreta.
//   Cada reporte se guarda en `reportes_ia` para no pagarlo dos veces.
//
// · La API key (ANTHROPIC_API_KEY) solo existe aquí, como secreto.
// · Las herramientas consultan con el cliente DEL USUARIO: la RLS aplica.
// · Tope de gasto mensual (`configuracion.asistente_limite_usd`, US$2 por
//   defecto): antes de cada consulta se revisa y, al alcanzarlo, deja de
//   responder hasta el mes siguiente.
// · Ahorro: Haiku, respuestas cortas, caché de instrucciones y herramientas,
//   solo los últimos mensajes de la conversación y datos mínimos por alumno
//   (nunca teléfonos, correos, firmas ni documentos).
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { metricasAlumno, metricasGrupo } from './metricas.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

// US$ por millón de tokens (clase Haiku). Estimación para el tope: el cobro
// real lo hace Anthropic; si cambian sus precios, se ajusta aquí.
const PRECIO = { entrada: 1, salida: 5, cacheEscritura: 1.25, cacheLectura: 0.1 }
const MAX_VUELTAS = 4

const TOOLS = [
  {
    name: 'buscar_alumnos',
    description: 'Lista alumnos con sus indicadores (asistencia %, promedio, tareas, pago, garantía, expediente). Filtra por texto del nombre, grupo, sucursal o un criterio.',
    input_schema: {
      type: 'object',
      properties: {
        texto: { type: 'string', description: 'Parte del nombre del alumno' },
        grupo: { type: 'string', description: 'Nombre (o parte) del grupo' },
        sucursal: { type: 'string', description: 'Nombre (o parte) de la sucursal' },
        criterio: { type: 'string', enum: ['asistencia_baja', 'promedio_bajo', 'debe_pago', 'garantia_pendiente', 'expediente_pendiente', 'en_riesgo'] },
        limite: { type: 'integer', description: 'Máximo de alumnos (por defecto 25, máximo 60)' },
      },
    },
  },
  {
    name: 'resumen_grupos',
    description: 'Resumen por grupo: alumnos, asistencia y promedio medios, alumnos en riesgo. Opcionalmente de una sucursal.',
    input_schema: { type: 'object', properties: { sucursal: { type: 'string' } } },
  },
  {
    name: 'adeudos',
    description: 'Alumnos con saldo pendiente de pago (total, pagado, saldo). Opcionalmente por sucursal o grupo.',
    input_schema: { type: 'object', properties: { sucursal: { type: 'string' }, grupo: { type: 'string' } } },
  },
  {
    name: 'perfil_alumno',
    description: 'Perfil académico detallado de UN alumno: promedio y posición en su grupo, asistencia, promedio por materia y por tipo (tareas, simulacros, exámenes) comparado con el grupo, tendencias y el último reporte de IA guardado. Úsalo para analizar competencias, habilidades o hacer el reporte de un alumno.',
    input_schema: { type: 'object', properties: { nombre: { type: 'string', description: 'Nombre (o parte) del alumno' } }, required: ['nombre'] },
  },
  {
    name: 'perfil_grupo',
    description: 'Perfil académico de UN grupo: promedio y aprobados por materia, asistencia, alumnos ordenados por promedio con su materia más baja y alumnos en riesgo. Úsalo para el reporte de un grupo.',
    input_schema: { type: 'object', properties: { grupo: { type: 'string', description: 'Nombre (o parte) del grupo' } }, required: ['grupo'] },
  },
]

/* ── Reportes: salida estructurada (herramienta forzada) ── */
const NIVEL = { type: 'string', enum: ['sobresaliente', 'bueno', 'en_desarrollo', 'en_riesgo'] }
const COMPETENCIA = {
  type: 'object', required: ['nombre', 'nivel', 'evidencia'],
  properties: {
    nombre: { type: 'string', description: 'Competencia académica, p. ej. "Razonamiento matemático", "Comprensión lectora", "Pensamiento científico"' },
    nivel: { type: 'integer', minimum: 1, maximum: 5, description: '1 = inicial, 5 = dominio' },
    evidencia: { type: 'string', description: 'Dato concreto de las métricas que lo respalda (una oración)' },
  },
}
const REPORTE_ALUMNO = {
  name: 'entregar_reporte',
  description: 'Entrega el reporte del alumno.',
  input_schema: {
    type: 'object',
    required: ['resumen', 'nivel_general', 'competencias', 'habilidades', 'fortalezas', 'areas_mejora', 'recomendaciones', 'alertas'],
    properties: {
      resumen: { type: 'string', description: '2 o 3 oraciones con el panorama general' },
      nivel_general: NIVEL,
      competencias: { type: 'array', minItems: 3, maxItems: 6, items: COMPETENCIA },
      habilidades: {
        type: 'array', minItems: 2, maxItems: 5, description: 'Habilidades de estudio y socioemocionales observables: constancia, puntualidad, responsabilidad en entregas, desempeño en examen, mejora continua…',
        items: { type: 'object', required: ['nombre', 'nivel', 'evidencia'], properties: { nombre: { type: 'string' }, nivel: { type: 'integer', minimum: 1, maximum: 5 }, evidencia: { type: 'string' } } },
      },
      fortalezas: { type: 'array', maxItems: 4, items: { type: 'string' } },
      areas_mejora: { type: 'array', maxItems: 4, items: { type: 'string' } },
      recomendaciones: {
        type: 'array', minItems: 2, maxItems: 5,
        items: { type: 'object', required: ['para', 'texto'], properties: { para: { type: 'string', enum: ['docente', 'alumno', 'tutor'] }, texto: { type: 'string' } } },
      },
      alertas: { type: 'array', maxItems: 3, items: { type: 'string' }, description: 'Solo riesgos reales (asistencia, garantía, caída fuerte). Vacío si no hay.' },
    },
  },
}
const REPORTE_GRUPO = {
  name: 'entregar_reporte',
  description: 'Entrega el reporte del grupo.',
  input_schema: {
    type: 'object',
    required: ['resumen', 'nivel_general', 'competencias', 'materias_criticas', 'alumnos_riesgo', 'destacados', 'recomendaciones'],
    properties: {
      resumen: { type: 'string', description: '2 o 3 oraciones con el panorama del grupo' },
      nivel_general: NIVEL,
      competencias: { type: 'array', minItems: 3, maxItems: 6, items: COMPETENCIA },
      materias_criticas: { type: 'array', maxItems: 4, items: { type: 'object', required: ['materia', 'motivo'], properties: { materia: { type: 'string' }, motivo: { type: 'string' } } } },
      alumnos_riesgo: { type: 'array', maxItems: 8, items: { type: 'object', required: ['nombre', 'motivo'], properties: { nombre: { type: 'string' }, motivo: { type: 'string' } } } },
      destacados: { type: 'array', maxItems: 5, items: { type: 'object', required: ['nombre', 'motivo'], properties: { nombre: { type: 'string' }, motivo: { type: 'string' } } } },
      recomendaciones: { type: 'array', minItems: 2, maxItems: 5, items: { type: 'string' } },
    },
  },
}
const sinRef = (m: any) => { const { _ref, ...resto } = m ?? {}; return resto }

type Cliente = ReturnType<typeof createClient>
const contiene = (a: string | null | undefined, b: string) => (a ?? '').toLowerCase().includes(b.toLowerCase())

async function catalogo(db: Cliente) {
  const [{ data: grupos }, { data: sucursales }] = await Promise.all([
    db.from('groups').select('id, name, sucursal, curso'),
    db.from('sucursales').select('id, nombre'),
  ])
  const nombreSuc = Object.fromEntries((sucursales ?? []).map((s: any) => [s.id, s.nombre]))
  return { grupos: grupos ?? [], nombreSuc }
}

async function ejecutar(db: Cliente, nombre: string, entrada: any) {
  const { grupos, nombreSuc } = await catalogo(db)
  const gruposFiltrados = grupos.filter((g: any) =>
    (!entrada.grupo || contiene(g.name, entrada.grupo)) &&
    (!entrada.sucursal || contiene(nombreSuc[g.sucursal] ?? g.sucursal, entrada.sucursal)))
  const grupoDe = Object.fromEntries(grupos.map((g: any) => [g.id, g]))

  if (nombre === 'buscar_alumnos' || nombre === 'resumen_grupos') {
    let q = db.from('students').select('id, name, group_id, attendance_rate, avg_grade, assignments_done, assignments_total, pago_estado, garantia_estado, terms_status, acceso_estado, status')
    if (entrada.grupo || entrada.sucursal) q = q.in('group_id', gruposFiltrados.map((g: any) => g.id))
    if (entrada.texto) q = q.ilike('name', `%${entrada.texto}%`)
    const { data, error } = await q.limit(500)
    if (error) return { error: 'No se pudieron leer los alumnos' }
    const alumnos = data ?? []

    if (nombre === 'resumen_grupos') {
      return gruposFiltrados.map((g: any) => {
        const del = alumnos.filter((a: any) => a.group_id === g.id)
        const media = (k: string) => {
          const v = del.map((a: any) => a[k]).filter((x: any) => x != null)
          return v.length ? +(v.reduce((s: number, x: number) => s + Number(x), 0) / v.length).toFixed(1) : null
        }
        return { grupo: g.name, sucursal: nombreSuc[g.sucursal] ?? g.sucursal, curso: g.curso, alumnos: del.length,
          asistencia_media: media('attendance_rate'), promedio_medio: media('avg_grade'),
          en_riesgo: del.filter((a: any) => ['critical', 'warning', 'at-risk'].includes(a.status)).length }
      }).filter((r: any) => r.alumnos > 0 || entrada.grupo)
    }

    const criterio: Record<string, (a: any) => boolean> = {
      asistencia_baja: a => a.attendance_rate != null && Number(a.attendance_rate) < 90,
      promedio_bajo: a => a.avg_grade != null && Number(a.avg_grade) < 7,
      // Valores reales de students.pago_estado: 'En adeudo' | 'Al corriente' | 'Liquidado'.
      debe_pago: a => /adeudo/i.test(a.pago_estado ?? ''),
      garantia_pendiente: a => a.garantia_estado !== 'validada',
      expediente_pendiente: a => a.acceso_estado !== 'activo',
      en_riesgo: a => ['critical', 'warning', 'at-risk'].includes(a.status),
    }
    const filtro = criterio[entrada.criterio] ?? (() => true)
    const limite = Math.min(60, Math.max(1, entrada.limite ?? 25))
    const lista = alumnos.filter(filtro)
    return {
      total: lista.length,
      alumnos: lista.slice(0, limite).map((a: any) => ({
        nombre: a.name, grupo: grupoDe[a.group_id]?.name ?? '—',
        sucursal: nombreSuc[grupoDe[a.group_id]?.sucursal] ?? '—',
        asistencia: a.attendance_rate, promedio: a.avg_grade,
        tareas: a.assignments_total ? `${a.assignments_done ?? 0}/${a.assignments_total}` : null,
        pago: a.pago_estado, garantia: a.garantia_estado, expediente: a.acceso_estado, terminos: a.terms_status,
      })),
    }
  }

  if (nombre === 'adeudos') {
    let q = db.from('v_pagos_resumen').select('student_name, group_id, sucursal, total, pagado, saldo').gt('saldo', 0)
    if (entrada.grupo || entrada.sucursal) q = q.in('group_id', gruposFiltrados.map((g: any) => g.id))
    const { data, error } = await q.order('saldo', { ascending: false }).limit(60)
    if (error) return { error: 'No se pudieron leer los pagos' }
    return {
      total_alumnos: data?.length ?? 0,
      saldo_total: +(data ?? []).reduce((s: number, r: any) => s + Number(r.saldo ?? 0), 0).toFixed(2),
      alumnos: (data ?? []).map((r: any) => ({ nombre: r.student_name, grupo: grupoDe[r.group_id]?.name ?? '—',
        sucursal: nombreSuc[r.sucursal] ?? r.sucursal, total: r.total, pagado: r.pagado, saldo: r.saldo })),
    }
  }
  if (nombre === 'perfil_alumno') {
    const { data } = await db.from('students').select('id, name, group_id').ilike('name', `%${entrada.nombre ?? ''}%`).limit(6)
    if (!data?.length) return { error: 'No encontré a ese alumno (o no está en tus grupos).' }
    if (data.length > 1) return { varios: data.map((a: any) => ({ nombre: a.name, grupo: grupoDe[a.group_id]?.name ?? '—' })), nota: 'Pide que aclare cuál.' }
    const m = await metricasAlumno(db, data[0].id)
    if (!m) return { error: 'No se pudieron leer sus datos.' }
    const { data: ultimo } = await db.from('reportes_ia').select('contenido, created_at').eq('student_id', data[0].id)
      .order('created_at', { ascending: false }).limit(1).maybeSingle()
    return { ...sinRef(m), ultimo_reporte: ultimo ? { fecha: ultimo.created_at, resumen: ultimo.contenido?.resumen } : null }
  }

  if (nombre === 'perfil_grupo') {
    const candidatos = grupos.filter((x: any) => contiene(x.name, entrada.grupo ?? ''))
    if (!candidatos.length) return { error: 'No encontré ese grupo (o no es tuyo).' }
    const exacto = candidatos.find((x: any) => x.name.toLowerCase() === String(entrada.grupo).toLowerCase())
    if (!exacto && candidatos.length > 1) return { varios: candidatos.slice(0, 8).map((x: any) => x.name), nota: 'Pide que aclare cuál.' }
    const m = await metricasGrupo(db, (exacto ?? candidatos[0]).id)
    return m ? sinRef(m) : { error: 'No se pudieron leer los datos del grupo.' }
  }
  return { error: 'Herramienta desconocida' }
}

type Uso = { entrada: number, salida: number, cacheEscritura: number, cacheLectura: number }
const costoDe = (u: Uso) => (u.entrada * PRECIO.entrada + u.salida * PRECIO.salida
  + u.cacheEscritura * PRECIO.cacheEscritura + u.cacheLectura * PRECIO.cacheLectura) / 1_000_000

/** Una llamada a la API de Anthropic. Suma el consumo en `uso`; lanza { clave, detalle } si falla. */
async function llamarModelo(apiKey: string, cuerpoPeticion: unknown, uso: Uso) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify(cuerpoPeticion),
  })
  const cuerpo = await r.json().catch(() => ({}))
  if (!r.ok) {
    const msg = String(cuerpo?.error?.message ?? `HTTP ${r.status}`)
    throw { clave: r.status === 401 ? 'api_key_invalida' : /credit|balance|billing/i.test(msg) ? 'sin_saldo' : 'error_modelo', detalle: msg.slice(0, 200) }
  }
  const u = cuerpo.usage ?? {}
  uso.entrada += u.input_tokens ?? 0
  uso.salida += u.output_tokens ?? 0
  uso.cacheEscritura += u.cache_creation_input_tokens ?? 0
  uso.cacheLectura += u.cache_read_input_tokens ?? 0
  return cuerpo
}

const INSTRUCCIONES_REPORTE = `Eres el analista académico de CEFIMAT (escuela de preparación para los exámenes ECOEMS y de admisión a universidad en México). Recibes métricas YA CALCULADAS de la plataforma SIGA y redactas un reporte para uso INTERNO de los administradores y docentes (los alumnos no lo ven).
Reglas:
- Basa todo en las métricas recibidas. No inventes cifras, materias ni hechos; cita los números que respaldan cada afirmación.
- Escala de calificaciones de 0 a 10; aprobatorio desde 6. "promedio_grupo" sirve para comparar.
- Competencias: académicas, inferidas de las materias y del tipo de evaluación (p. ej. matemáticas → razonamiento matemático; simulacros → desempeño en examen tipo admisión). Incluye SOLO las que una materia o un tipo de evaluación de las métricas respalde directamente: si no hay materia de matemáticas, no evalúes razonamiento matemático. Mejor 3 competencias bien sustentadas que 6 supuestas.
- Habilidades: hábitos observables (asistencia, puntualidad por tardanzas, entregas, constancia, tendencia).
- Si hay pocos datos (pocas calificaciones o sin asistencia), dilo en el resumen y no exageres los niveles.
- Garantía de CEFIMAT: requiere 90 % de asistencia, todos los simulacros, todas las tareas y mínimo 80 % en cada una.
- Español de México, claro y profesional, sin rodeos. Frases cortas.
Entrega el resultado SOLO con la herramienta entregar_reporte.`

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ ok: false, error: 'metodo' }, 405)

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) return json({ ok: false, error: 'falta_api_key' }, 503)

  const url = Deno.env.get('SUPABASE_URL')!
  const usuario = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } }, auth: { persistSession: false },
  })
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })

  const { data: { user } } = await usuario.auth.getUser()
  if (!user) return json({ ok: false, error: 'sin_sesion' }, 401)
  // Admin (super) siempre; sub-admin solo si un admin le delegó el apartado "ia".
  const { data: permitido } = await usuario.rpc('tiene_apartado', { p_apartado: 'ia' })
  if (permitido !== true) return json({ ok: false, error: 'sin_permiso' }, 403)

  const { data: g } = await admin.rpc('gasto_asistente_mes')
  const gasto = Array.isArray(g) ? g[0] : g
  const usado = Number(gasto?.usado ?? 0), limite = Number(gasto?.limite ?? 2)
  if (usado >= limite) return json({ ok: false, error: 'limite_alcanzado', gasto: { usado, limite } }, 402)

  let entrada: any = {}
  try { entrada = await req.json() } catch { /* vacío */ }

  const { data: conf } = await admin.from('configuracion').select('asistente_modelo').limit(1).maybeSingle()
  const modelo = conf?.asistente_modelo || 'claude-haiku-5-5'
  const hoy = new Date().toLocaleDateString('es-MX', { timeZone: 'America/Mexico_City', dateStyle: 'full' })
  const uso: Uso = { entrada: 0, salida: 0, cacheEscritura: 0, cacheLectura: 0 }
  const registrarUso = async () => {
    const costo = costoDe(uso)
    await admin.from('asistente_uso').insert({
      usuario: user.id, modelo, tokens_entrada: uso.entrada, tokens_salida: uso.salida,
      tokens_cache_escritura: uso.cacheEscritura, tokens_cache_lectura: uso.cacheLectura, costo_usd: costo,
    })
    return costo
  }

  /* ── Modo reporte ── */
  if (entrada.accion === 'reporte') {
    const tipo = entrada.tipo === 'grupo' ? 'grupo' : 'alumno'
    const id = String(entrada.id ?? '')
    if (!id) return json({ ok: false, error: 'sin_objetivo' }, 400)
    const metricas = tipo === 'alumno' ? await metricasAlumno(usuario, id) : await metricasGrupo(usuario, id)
    if (!metricas) return json({ ok: false, error: 'no_encontrado' }, 404)
    const herramienta = tipo === 'alumno' ? REPORTE_ALUMNO : REPORTE_GRUPO
    let contenido: any = null
    try {
      const cuerpo = await llamarModelo(apiKey, {
        model: modelo, max_tokens: 2000,
        system: [{ type: 'text', cache_control: { type: 'ephemeral' }, text: `${INSTRUCCIONES_REPORTE}\nHoy es ${hoy}.` }],
        tools: [{ ...herramienta, cache_control: { type: 'ephemeral' } }],
        tool_choice: { type: 'tool', name: 'entregar_reporte' },
        messages: [{ role: 'user', content: `Reporte de ${tipo}. Métricas:\n${JSON.stringify(sinRef(metricas))}` }],
      }, uso)
      contenido = (cuerpo.content ?? []).find((b: any) => b.type === 'tool_use')?.input ?? null
    } catch (e: any) {
      if (uso.entrada || uso.salida) await registrarUso()
      return json({ ok: false, error: e?.clave ?? 'error_modelo', detalle: e?.detalle }, 502)
    }
    const costo = await registrarUso()
    if (!contenido) return json({ ok: false, error: 'error_modelo' }, 502)
    const { data: guardado, error: eG } = await admin.from('reportes_ia').insert({
      tipo, student_id: tipo === 'alumno' ? id : null, group_id: metricas._ref.groupId,
      contenido, metricas: sinRef(metricas), modelo, costo_usd: costo, creado_por: user.id,
    }).select().single()
    if (eG) return json({ ok: false, error: 'no_se_guardo' }, 500)
    return json({ ok: true, reporte: guardado, gasto: { usado: +(usado + costo).toFixed(4), limite } })
  }

  /* ── Modo chat ── */
  // Solo los últimos 6 mensajes, recortados: la conversación larga es lo que más cuesta.
  const historial = (Array.isArray(entrada.mensajes) ? entrada.mensajes : [])
    .filter((m: any) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-6).map((m: any) => ({ role: m.role, content: m.content.slice(0, 1500) }))
  if (!historial.length || historial[historial.length - 1].role !== 'user') return json({ ok: false, error: 'sin_pregunta' }, 400)

  const system = [{
    type: 'text',
    cache_control: { type: 'ephemeral' },
    text: `Eres el asistente de SIGA, la plataforma de CEFIMAT (escuela de preparación para exámenes ECOEMS y de universidad en México). Respondes SOLO a administradores, en español de México, de forma breve y directa (máximo ~150 palabras o una lista corta; un análisis de alumno o grupo puede llegar a ~250).
Reglas:
- Usa las herramientas para obtener datos reales; nunca inventes cifras ni nombres. Si no hay datos, dilo.
- Para competencias, habilidades o el reporte de un alumno usa perfil_alumno; de un grupo, perfil_grupo. Interpreta los números (escala 0-10, aprobatorio 6) comparando con el grupo y cierra con 2 o 3 recomendaciones. Menciona que el reporte completo y guardado se genera con el botón "Reporte con IA" del perfil del alumno o del grupo.
- Solo consultas: no puedes modificar nada. Si te piden una acción (calificar, cobrar, enviar correos), indica en qué pantalla de SIGA se hace.
- Garantía: requiere 90 % de asistencia, todos los simulacros, todas las tareas y mínimo 80 % en cada una.
- Usa la menor cantidad de llamadas posible. Si la lista es larga, da el total y los primeros casos.
- No pidas ni muestres datos de contacto (teléfonos, correos) ni contraseñas.
Hoy es ${hoy}.`,
  }]
  const tools = TOOLS.map((t, i) => i === TOOLS.length - 1 ? { ...t, cache_control: { type: 'ephemeral' } } : t)
  const mensajes: any[] = [...historial]
  let respuesta = ''

  try {
    for (let vuelta = 0; vuelta < MAX_VUELTAS; vuelta++) {
      const cuerpo = await llamarModelo(apiKey, { model: modelo, max_tokens: 900, system, tools, messages: mensajes }, uso)
      const bloques: any[] = cuerpo.content ?? []
      respuesta = bloques.filter(b => b.type === 'text').map(b => b.text).join('\n').trim()
      if (cuerpo.stop_reason !== 'tool_use') break
      mensajes.push({ role: 'assistant', content: bloques })
      const resultados = []
      for (const b of bloques.filter(b => b.type === 'tool_use')) {
        const res = await ejecutar(usuario, b.name, b.input ?? {})
        resultados.push({ type: 'tool_result', tool_use_id: b.id, content: JSON.stringify(res).slice(0, 12000) })
      }
      mensajes.push({ role: 'user', content: resultados })
    }
  } catch (e: any) {
    if (uso.entrada || uso.salida) await registrarUso()
    return json({ ok: false, error: e?.clave ?? 'error_modelo', detalle: e?.detalle }, 502)
  }

  const costo = await registrarUso()
  return json({
    ok: true,
    respuesta: respuesta || 'No pude completar la respuesta. Intenta con una pregunta más concreta.',
    costo: +costo.toFixed(5),
    gasto: { usado: +(usado + costo).toFixed(4), limite },
  })
})
