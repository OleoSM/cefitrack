// Avisos automáticos por correo (y notificación dentro de SIGA):
//  · accion 'recordatorios': actividades con fecha de entrega en los próximos
//    2 días (a quien aún no la entrega) y materiales que se borran en menos de
//    2 días. Cada uno se avisa UNA vez (avisos_enviados).
//  · accion 'top_mensual': a cada alumno, el Top 10 de su grupo del mes y su
//    lugar (puntaje: 50 % promedio + 30 % asistencia + 20 % racha).
//
// Quién la llama:
//  · un admin desde "Notificaciones" (JWT + es_admin), con `vistaPrevia: true`
//    para ver qué saldría sin mandar nada;
//  · una tarea programada (pg_cron) con la cabecera `x-tarea` = secreto de Vault.
//    La tarea NO está programada todavía: se activa cuando CEFIMAT lo apruebe.
//
// Respeta el cupo diario de correos (lo que no cabe queda como "omitido").
import { createClient } from 'jsr:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-tarea',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

const PLATAFORMA = 'https://siga.cefimat.com'
const ENCABEZADO = `${PLATAFORMA}/correo/encabezado-aviso.png`
const ZONA = 'America/Mexico_City'
const escapar = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
const correoValido = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) && !/@(.+\.)?(example\.(com|org|net)|test|invalid|example|localhost|siga\.mx)$/i.test(v)
const hoyMx = () => new Date(new Date().toLocaleString('en-US', { timeZone: ZONA }))
const isoDia = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const fechaLarga = (f: string) => new Date(f).toLocaleString('es-MX', { timeZone: ZONA, weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
const diaLargo = (f: string) => new Date(`${f}T12:00:00`).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })

// Misma plantilla que enviar-correo (encabezado ilustrado + botón a SIGA).
function plantillaHtml(asunto: string, cuerpoHtml: string, saludo: string) {
  return `<!doctype html><html><body style="margin:0;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">
      <tr><td style="background:#1B2F5E;color:#ffffff;padding:14px 24px;font-size:16px;font-weight:bold;letter-spacing:.5px">SIGA <span style="color:#F2B33D">CEFIMAT</span></td></tr>
      <tr><td style="padding:0;line-height:0"><a href="${PLATAFORMA}" target="_blank"><img src="${ENCABEZADO}" width="560" alt="SIGA CEFIMAT" style="display:block;width:100%;max-width:560px;height:auto;border:0"></a></td></tr>
      <tr><td style="padding:24px;font-size:15px;line-height:1.55">
        <h1 style="font-size:18px;margin:0 0 16px;color:#1B2F5E">${escapar(asunto)}</h1>
        <p style="margin:0 0 14px">${escapar(saludo)}</p>
        ${cuerpoHtml}
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 6px"><tr><td style="background:#7A1A33;border-radius:10px">
          <a href="${PLATAFORMA}" target="_blank" style="display:inline-block;padding:13px 26px;color:#ffffff;font-size:15px;font-weight:bold;text-decoration:none">Entrar a SIGA</a>
        </td></tr></table>
        <p style="margin:8px 0 0;font-size:12px;color:#64748b">O copia este enlace: <a href="${PLATAFORMA}" style="color:#1B2F5E">siga.cefimat.com</a></p>
      </td></tr>
      <tr><td style="padding:14px 24px;background:#f8fafc;color:#64748b;font-size:12px">Mensaje enviado por CEFIMAT desde SIGA. Dudas o comentarios: revísalo con tu profesor en turno.</td></tr>
    </table>
  </td></tr></table></body></html>`
}
const parrafos = (t: string) => escapar(t).split(/\n{2,}/).map(p => `<p style="margin:0 0 14px">${p.replace(/\n/g, '<br>')}</p>`).join('')

type Alumno = { id: string, name: string, personal_email: string | null, tutor_email: string | null, tutor_name: string | null, group_id: string }
type Envio = { alumno: Alumno, asunto: string, html: string, texto: string, tutor: boolean }

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ ok: false, error: 'metodo' }, 405)
  const url = Deno.env.get('SUPABASE_URL')!
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })

  // ── Autorización: tarea programada (secreto) o admin con sesión ──
  let autor: string | null = null
  const secreto = req.headers.get('x-tarea')
  if (secreto) {
    const { data: ok } = await admin.rpc('verificar_secreto_limpieza', { p_secreto: secreto })
    if (ok !== true) return json({ ok: false, error: 'no_autorizado' }, 401)
  } else {
    const usuario = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } }, auth: { persistSession: false },
    })
    const { data: { user } } = await usuario.auth.getUser()
    if (!user) return json({ ok: false, error: 'sin_sesion' }, 401)
    const { data: esAdmin } = await usuario.rpc('es_admin')
    if (esAdmin !== true) return json({ ok: false, error: 'solo_admin' }, 403)
    autor = user.id
  }

  let entrada: any = {}
  try { entrada = await req.json() } catch { /* vacío */ }
  // La tarea programada siempre envía; un admin puede pedir solo la vista previa.
  const vistaPrevia = !secreto && entrada.vistaPrevia === true
  const accion = entrada.accion
  // Interruptor general de correos (Configuración): apagado, solo se permite la vista previa.
  const { data: interruptor } = await admin.from('configuracion').select('correos_habilitados').limit(1).maybeSingle()
  if (!vistaPrevia && interruptor?.correos_habilitados !== true) return json({ ok: false, error: 'correos_deshabilitados' }, 423)

  const { data: avisados } = await admin.from('avisos_enviados').select('tipo, ref_id')
  const yaAvisado = new Set((avisados ?? []).map((a: any) => `${a.tipo}:${a.ref_id}`))
  const campos = 'id, name, personal_email, tutor_email, tutor_name, group_id'

  // Lista de "lotes": cada uno es un aviso con sus correos y su registro.
  type Lote = { tipo: string, refId: string, groupId: string | null, titulo: string, detalle: string, envios: Envio[], alumnos: Alumno[], cuerpo: string }
  const lotes: Lote[] = []

  if (accion === 'recordatorios') {
    const hoy = hoyMx(); const en2 = new Date(hoy); en2.setDate(hoy.getDate() + 2)
    const { data: cols } = await admin.from('registro_columnas').select('id, group_id, materia, nombre, tipo, formato, fecha_entrega')
      .gte('fecha_entrega', isoDia(hoy)).lte('fecha_entrega', isoDia(en2))
    for (const c of cols ?? []) {
      if (yaAvisado.has(`recordatorio_actividad:${c.id}`)) continue
      const [{ data: alumnos }, { data: valores }, { data: g }] = await Promise.all([
        admin.from('students').select(campos).eq('group_id', c.group_id),
        admin.from('registro_valores').select('student_id, valor').eq('columna_id', c.id),
        admin.from('groups').select('name').eq('id', c.group_id).maybeSingle(),
      ])
      // En columnas de casilla (sí/no) solo "1" es entregado; un "0" es "no entregó".
      const entregado = (v: any) => v.valor !== null && v.valor !== '' && !(c.formato === 'check' && v.valor !== '1')
      const entregaron = new Set((valores ?? []).filter(entregado).map((v: any) => v.student_id))
      const pendientes = (alumnos ?? []).filter((a: any) => !entregaron.has(a.id)) as Alumno[]
      if (!pendientes.length) continue
      const asunto = `Recordatorio: «${c.nombre}» se entrega el ${diaLargo(c.fecha_entrega)}`
      const cuerpo = `Te recordamos que la ${c.tipo === 'examen' ? 'evaluación' : 'actividad'} «${c.nombre}»${c.materia ? ` de ${c.materia}` : ''} se entrega el ${diaLargo(c.fecha_entrega)} y aún no aparece como entregada.\n\nSi ya la entregaste, no te preocupes: tu profesor la capturará pronto.`
      lotes.push({ tipo: 'recordatorio_actividad', refId: c.id, groupId: c.group_id, titulo: `${c.nombre} · ${g?.name ?? ''}`,
        detalle: `Entrega ${diaLargo(c.fecha_entrega)} · ${pendientes.length} pendiente(s)`, alumnos: pendientes, cuerpo,
        envios: pendientes.flatMap(a => [true, false].map(tutor => ({ alumno: a, tutor, asunto, html: parrafos(cuerpo), texto: cuerpo }))) })
    }

    const ahora = new Date(); const en48 = new Date(ahora.getTime() + 2 * 864e5)
    const { data: mats } = await admin.from('materiales').select('id, titulo, expira_en, visible_desde, grupos, sucursales, cursos')
      .gt('expira_en', ahora.toISOString()).lte('expira_en', en48.toISOString()).lte('visible_desde', ahora.toISOString())
    if (mats?.length) {
      const [{ data: grupos }, { data: todos }, { data: permisos }] = await Promise.all([
        admin.from('groups').select('id, sucursal, curso, institucion'),
        admin.from('students').select(campos),
        admin.from('permisos_alumno').select('student_id, ver_materiales, materiales_ocultos'),
      ])
      const gDe = Object.fromEntries((grupos ?? []).map((g: any) => [g.id, g]))
      const pDe = Object.fromEntries((permisos ?? []).map((p: any) => [p.student_id, p]))
      for (const m of mats) {
        if (yaAvisado.has(`material_vence:${m.id}`)) continue
        const alumnos = ((todos ?? []) as Alumno[]).filter(a => {
          const g = gDe[a.group_id]; const p = pDe[a.id]
          if (!g || (p && (!p.ver_materiales || (p.materiales_ocultos ?? []).includes(m.id)))) return false
          const curso = g.curso ?? (g.institucion === 'ecoems' ? 'ecoems' : 'universidad')
          return (m.grupos ?? []).includes(g.id) || (m.sucursales ?? []).includes(g.sucursal) || (m.cursos ?? []).includes(curso)
        })
        if (!alumnos.length) continue
        const asunto = `Último aviso: «${m.titulo}» se borra pronto`
        const cuerpo = `El material «${m.titulo}» estará disponible en SIGA solo hasta el ${fechaLarga(m.expira_en)}.\n\nSi lo necesitas, descárgalo antes de esa fecha desde la sección "Materiales".`
        lotes.push({ tipo: 'material_vence', refId: m.id, groupId: null, titulo: m.titulo,
          detalle: `Se borra ${fechaLarga(m.expira_en)} · ${alumnos.length} alumno(s)`, alumnos, cuerpo,
          envios: alumnos.map(a => ({ alumno: a, tutor: false, asunto, html: parrafos(cuerpo), texto: cuerpo })) })
      }
    }
  } else if (accion === 'top_mensual') {
    const hoy = hoyMx()
    const mes = new Date(hoy.getFullYear(), hoy.getMonth() - (hoy.getDate() <= 7 ? 1 : 0), 1)
    const etiquetaMes = mes.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
    const claveMes = `${mes.getFullYear()}-${String(mes.getMonth() + 1).padStart(2, '0')}`
    const { data: grupos } = await admin.from('groups').select('id, name')
    for (const g of grupos ?? []) {
      const ref = `${claveMes}:${g.id}`
      if (yaAvisado.has(`top_mensual:${ref}`)) continue
      const [{ data: ranking }, { data: alumnos }] = await Promise.all([
        admin.rpc('ranking_mensual', { p_group_id: g.id }),
        admin.from('students').select(campos).eq('group_id', g.id),
      ])
      if (!ranking?.length || !alumnos?.length) continue
      const top = ranking.slice(0, 10)
      const tabla = `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;margin:6px 0 16px;font-size:14px">
        ${top.map((r: any) => `<tr><td style="padding:7px 8px;border-bottom:1px solid #e2e8f0;width:34px;font-weight:bold;color:${r.posicion <= 3 ? '#7A1A33' : '#1B2F5E'}">#${r.posicion}</td>
          <td style="padding:7px 8px;border-bottom:1px solid #e2e8f0">${escapar(r.nombre)}</td>
          <td style="padding:7px 8px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:bold">${r.puntaje}</td></tr>`).join('')}
      </table>`
      const asunto = `Top del mes de ${etiquetaMes} — ${g.name}`
      const envios: Envio[] = (alumnos as Alumno[]).map(a => {
        const mio = ranking.find((r: any) => r.student_id === a.id)
        const lugar = mio ? `Tu lugar: <b>#${mio.posicion} de ${ranking.length}</b> con ${mio.puntaje} puntos (promedio ${mio.promedio}, asistencia ${mio.asistencia} %, racha de ${mio.racha} clases).` : ''
        const html = `<p style="margin:0 0 14px">Este es el Top 10 de tu grupo en ${escapar(etiquetaMes)}. El puntaje combina tu promedio (50 %), tu asistencia (30 %) y tu racha de clases seguidas (20 %).</p>
          ${tabla}<p style="margin:0 0 14px">${lugar}</p><p style="margin:0 0 14px">¡Sigue así! Cada clase cuenta para tu racha.</p>`
        const texto = `Top 10 de ${g.name} en ${etiquetaMes}:\n${top.map((r: any) => `#${r.posicion} ${r.nombre} — ${r.puntaje}`).join('\n')}\n\n${mio ? `Tu lugar: #${mio.posicion} de ${ranking.length} (${mio.puntaje} puntos).` : ''}`
        return { alumno: a, tutor: false, asunto, html, texto }
      })
      lotes.push({ tipo: 'top_mensual', refId: ref, groupId: g.id, titulo: `${g.name} · ${etiquetaMes}`,
        detalle: `Top: ${top.slice(0, 3).map((r: any) => r.nombre.split(' ')[0]).join(', ')}… · ${alumnos.length} alumno(s)`,
        alumnos: alumnos as Alumno[], cuerpo: `Top del mes de ${etiquetaMes}`, envios })
    }
  } else {
    return json({ ok: false, error: 'accion_invalida' }, 400)
  }

  // Destinatarios reales (con correo válido, sin repetir por lote).
  const destinos = (l: Lote) => {
    const vistos = new Set<string>()
    return l.envios.flatMap(e => {
      const c = ((e.tutor ? e.alumno.tutor_email : e.alumno.personal_email) ?? '').trim().toLowerCase()
      if (!c || !correoValido(c) || vistos.has(c)) return []
      vistos.add(c)
      const saludo = e.tutor ? `Hola${e.alumno.tutor_name ? ' ' + e.alumno.tutor_name.split(' ')[0] : ''}, le escribimos sobre ${e.alumno.name}:` : `Hola ${e.alumno.name.split(' ')[0]}:`
      return [{ ...e, correo: c, saludo }]
    })
  }

  if (vistaPrevia) {
    return json({ ok: true, vistaPrevia: true, lotes: lotes.map(l => ({ tipo: l.tipo, titulo: l.titulo, detalle: l.detalle, alumnos: l.alumnos.length, correos: destinos(l).length })) })
  }

  const apiKey = Deno.env.get('RESEND_API_KEY')
  if (!apiKey) return json({ ok: false, error: 'falta_api_key' }, 503)
  const { data: conf } = await admin.from('configuracion').select('correo_remitente').limit(1).maybeSingle()
  const from = conf?.correo_remitente || 'SIGA CEFIMAT <onboarding@resend.dev>'
  const { data: cupoFila } = await admin.rpc('cupo_correos_hoy')
  const cupo = Array.isArray(cupoFila) ? cupoFila[0] : cupoFila
  let restante = Math.max(0, (cupo?.limite ?? 100) - (cupo?.enviados ?? 0))
  const resumen = { avisos: 0, enviados: 0, omitidos: 0, fallidos: 0 }

  for (const l of lotes) {
    const lista = destinos(l)
    const { data: draft } = await admin.from('email_drafts').insert({
      subject: l.envios[0]?.asunto ?? l.titulo, body: l.cuerpo, student_ids: l.alumnos.map(a => a.id),
      include_student: true, include_tutor: l.envios.some(e => e.tutor), status: 'pending', created_by: autor,
    }).select('id').single()
    const aEnviar = lista.slice(0, restante); const sinCupo = lista.slice(restante)
    restante -= aEnviar.length
    const registros: Record<string, unknown>[] = []
    for (let i = 0; i < aEnviar.length; i += 100) {
      const lote = aEnviar.slice(i, i + 100)
      const resp = await fetch('https://api.resend.com/emails/batch', {
        method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(lote.map(d => ({ from, to: [d.correo], subject: d.asunto, html: plantillaHtml(d.asunto, d.html, d.saludo),
          text: `${d.saludo}\n\n${d.texto}\n\nEntra a SIGA: ${PLATAFORMA}\n\n— CEFIMAT (SIGA)` }))),
      })
      const cuerpo = await resp.json().catch(() => ({}))
      lote.forEach((d, k) => registros.push({ draft_id: draft?.id, student_id: d.alumno.id, destinatario: d.correo, tipo: d.tutor ? 'tutor' : 'alumno',
        enviado_por: autor, ...(resp.ok ? { estado: 'enviado', proveedor_id: cuerpo?.data?.[k]?.id ?? null }
          : { estado: 'fallido', motivo: String(cuerpo?.message ?? `HTTP ${resp.status}`).slice(0, 300) }) }))
    }
    for (const d of sinCupo) registros.push({ draft_id: draft?.id, student_id: d.alumno.id, destinatario: d.correo, tipo: d.tutor ? 'tutor' : 'alumno',
      estado: 'omitido', motivo: 'Cupo diario agotado', enviado_por: autor })
    if (registros.length) await admin.from('email_envios').insert(registros)
    // Notificación dentro de SIGA para cada alumno del lote.
    await admin.from('notifications').insert(l.alumnos.map(a => ({ recipient_student_id: a.id, title: l.envios[0]?.asunto ?? l.titulo,
      body: l.envios.find(e => e.alumno.id === a.id)?.texto ?? l.cuerpo, event_type: l.tipo, created_by: autor })))
    await admin.from('avisos_enviados').insert({ tipo: l.tipo, ref_id: l.refId, group_id: l.groupId, draft_id: draft?.id, audiencia: 'ambos', enviado_por: autor })
    const env = registros.filter(r => r.estado === 'enviado').length
    await admin.from('email_drafts').update({ status: env > 0 ? 'sent' : 'failed', sent_at: env > 0 ? new Date().toISOString() : null }).eq('id', draft?.id)
    resumen.avisos++; resumen.enviados += env
    resumen.omitidos += registros.filter(r => r.estado === 'omitido').length
    resumen.fallidos += registros.filter(r => r.estado === 'fallido').length
  }
  return json({ ok: true, ...resumen })
})
