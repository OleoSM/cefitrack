// Asistente de SIGA (Claude Haiku) — SOLO administradores, SOLO lectura.
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
]

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
  return { error: 'Herramienta desconocida' }
}

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
  const { data: esAdmin } = await usuario.rpc('es_admin')
  if (esAdmin !== true) return json({ ok: false, error: 'solo_admin' }, 403)

  const { data: g } = await admin.rpc('gasto_asistente_mes')
  const gasto = Array.isArray(g) ? g[0] : g
  const usado = Number(gasto?.usado ?? 0), limite = Number(gasto?.limite ?? 2)
  if (usado >= limite) return json({ ok: false, error: 'limite_alcanzado', gasto: { usado, limite } }, 402)

  let entrada: any = {}
  try { entrada = await req.json() } catch { /* vacío */ }
  // Solo los últimos 6 mensajes, recortados: la conversación larga es lo que más cuesta.
  const historial = (Array.isArray(entrada.mensajes) ? entrada.mensajes : [])
    .filter((m: any) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-6).map((m: any) => ({ role: m.role, content: m.content.slice(0, 1500) }))
  if (!historial.length || historial[historial.length - 1].role !== 'user') return json({ ok: false, error: 'sin_pregunta' }, 400)

  const { data: conf } = await admin.from('configuracion').select('asistente_modelo').limit(1).maybeSingle()
  const modelo = conf?.asistente_modelo || 'claude-haiku-5-5'
  const hoy = new Date().toLocaleDateString('es-MX', { timeZone: 'America/Mexico_City', dateStyle: 'full' })

  const system = [{
    type: 'text',
    cache_control: { type: 'ephemeral' },
    text: `Eres el asistente de SIGA, la plataforma de CEFIMAT (escuela de preparación para exámenes ECOEMS y de universidad en México). Respondes SOLO a administradores, en español de México, de forma breve y directa (máximo ~120 palabras o una lista corta).
Reglas:
- Usa las herramientas para obtener datos reales; nunca inventes cifras ni nombres. Si no hay datos, dilo.
- Solo consultas: no puedes modificar nada. Si te piden una acción (calificar, cobrar, enviar correos), indica en qué pantalla de SIGA se hace.
- Garantía: requiere 90 % de asistencia, todos los simulacros, todas las tareas y mínimo 80 % en cada una.
- Usa la menor cantidad de llamadas posible. Si la lista es larga, da el total y los primeros casos.
- No pidas ni muestres datos de contacto (teléfonos, correos) ni contraseñas.
Hoy es ${hoy}.`,
  }]
  const tools = TOOLS.map((t, i) => i === TOOLS.length - 1 ? { ...t, cache_control: { type: 'ephemeral' } } : t)

  const mensajes: any[] = [...historial]
  const uso = { entrada: 0, salida: 0, cacheEscritura: 0, cacheLectura: 0 }
  let respuesta = ''

  for (let vuelta = 0; vuelta < MAX_VUELTAS; vuelta++) {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: modelo, max_tokens: 600, system, tools, messages: mensajes }),
    })
    const cuerpo = await r.json().catch(() => ({}))
    if (!r.ok) {
      const msg = String(cuerpo?.error?.message ?? `HTTP ${r.status}`)
      const clave = r.status === 401 ? 'api_key_invalida' : /credit|balance|billing/i.test(msg) ? 'sin_saldo' : 'error_modelo'
      return json({ ok: false, error: clave, detalle: msg.slice(0, 200) }, 502)
    }
    const u = cuerpo.usage ?? {}
    uso.entrada += u.input_tokens ?? 0
    uso.salida += u.output_tokens ?? 0
    uso.cacheEscritura += u.cache_creation_input_tokens ?? 0
    uso.cacheLectura += u.cache_read_input_tokens ?? 0

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

  const costo = (uso.entrada * PRECIO.entrada + uso.salida * PRECIO.salida
    + uso.cacheEscritura * PRECIO.cacheEscritura + uso.cacheLectura * PRECIO.cacheLectura) / 1_000_000
  await admin.from('asistente_uso').insert({
    usuario: user.id, modelo, tokens_entrada: uso.entrada, tokens_salida: uso.salida,
    tokens_cache_escritura: uso.cacheEscritura, tokens_cache_lectura: uso.cacheLectura, costo_usd: costo,
  })

  return json({
    ok: true,
    respuesta: respuesta || 'No pude completar la respuesta. Intenta con una pregunta más concreta.',
    costo: +costo.toFixed(5),
    gasto: { usado: +(usado + costo).toFixed(4), limite },
  })
})
