// Envía por Resend el correo de un borrador de "Enviar correos".
//
// Seguridad:
//  · Exige sesión (verify_jwt) y, con el cliente DEL USUARIO, comprueba que
//    tenga el apartado "correos" y que pueda ver el borrador.
//  · Los alumnos se leen también con el cliente del usuario: la RLS solo le
//    devuelve los de sus grupos, así que no puede escribir a alumnos ajenos
//    aunque meta sus ids a mano.
//  · La API key (RESEND_API_KEY) solo existe aquí, como secreto.
//
// Interruptor general: si `configuracion.correos_habilitados` está apagado
// (lo controla un admin en Configuración), no sale ningún correo.
// Cupo: respeta `configuracion.correo_limite_diario` (tope de seguridad diario).
// Lo que no cabe se registra como "omitido" para mandarlo otro día.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

const escapar = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
const correoValido = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)
// Dominios reservados para ejemplos y pruebas (RFC 2606) y el de acceso
// interno @siga.mx: no son buzones reales y Resend los rechaza.
const esDeEjemplo = (v: string) => /@(.+\.)?(example\.(com|org|net)|test|invalid|example|localhost|siga\.mx)$/i.test(v)

// La plataforma y la ilustración del encabezado (public/correo/ del frontend).
// PNG y no SVG: Gmail y Outlook no muestran SVG.
const PLATAFORMA = 'https://siga.cefimat.com'
const ENCABEZADO = `${PLATAFORMA}/correo/encabezado-aviso.png`

function plantillaHtml(asunto: string, cuerpo: string, saludo: string) {
  const parrafos = escapar(cuerpo).split(/\n{2,}/).map(p => `<p style="margin:0 0 14px">${p.replace(/\n/g, '<br>')}</p>`).join('')
  return `<!doctype html><html><body style="margin:0;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">
      <tr><td style="background:#1B2F5E;color:#ffffff;padding:14px 24px;font-size:16px;font-weight:bold;letter-spacing:.5px">
        SIGA <span style="color:#F2B33D">CEFIMAT</span>
      </td></tr>
      <tr><td style="padding:0;line-height:0">
        <a href="${PLATAFORMA}" target="_blank"><img src="${ENCABEZADO}" width="560" alt="SIGA CEFIMAT: tienes un aviso nuevo"
          style="display:block;width:100%;max-width:560px;height:auto;border:0"></a>
      </td></tr>
      <tr><td style="padding:24px;font-size:15px;line-height:1.55">
        <h1 style="font-size:18px;margin:0 0 16px;color:#1B2F5E">${escapar(asunto)}</h1>
        <p style="margin:0 0 14px">${escapar(saludo)}</p>
        ${parrafos}
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 6px"><tr>
          <td style="background:#7A1A33;border-radius:10px">
            <a href="${PLATAFORMA}" target="_blank"
              style="display:inline-block;padding:13px 26px;color:#ffffff;font-size:15px;font-weight:bold;text-decoration:none">Entrar a SIGA</a>
          </td>
        </tr></table>
        <p style="margin:8px 0 0;font-size:12px;color:#64748b">O copia este enlace: <a href="${PLATAFORMA}" style="color:#1B2F5E">siga.cefimat.com</a></p>
      </td></tr>
      <tr><td style="padding:14px 24px;background:#f8fafc;color:#64748b;font-size:12px">
        Mensaje enviado por CEFIMAT desde SIGA. Si tienes dudas, comunícate directamente con tu sucursal.
      </td></tr>
    </table>
  </td></tr></table></body></html>`
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ ok: false, error: 'Método no permitido' }, 405)

  const apiKey = Deno.env.get('RESEND_API_KEY')
  if (!apiKey) return json({ ok: false, error: 'falta_api_key' }, 503)

  const url = Deno.env.get('SUPABASE_URL')!
  const usuario = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    auth: { persistSession: false },
  })
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })

  const { data: { user } } = await usuario.auth.getUser()
  if (!user) return json({ ok: false, error: 'sin_sesion' }, 401)
  const { data: permitido } = await usuario.rpc('tiene_apartado', { p_apartado: 'correos' })
  if (permitido !== true) return json({ ok: false, error: 'sin_permiso' }, 403)
  const { data: interruptor } = await admin.from('configuracion').select('correos_habilitados').limit(1).maybeSingle()
  if (interruptor?.correos_habilitados !== true) return json({ ok: false, error: 'correos_deshabilitados' }, 423)

  let draftId = ''
  try { draftId = (await req.json())?.draftId ?? '' } catch { /* cuerpo inválido */ }
  if (!draftId) return json({ ok: false, error: 'falta_borrador' }, 400)

  // Con el cliente del usuario: si no puede verlo, no existe para él.
  const { data: draft } = await usuario.from('email_drafts').select('*').eq('id', draftId).maybeSingle()
  if (!draft) return json({ ok: false, error: 'borrador_no_encontrado' }, 404)
  if (draft.status === 'sent') return json({ ok: false, error: 'ya_enviado' }, 409)

  const { data: alumnos, error: eAl } = await usuario.from('students')
    .select('id, name, personal_email, tutor_email, tutor_name').in('id', draft.student_ids ?? [])
  if (eAl) return json({ ok: false, error: 'no_se_leyeron_alumnos' }, 500)

  // Destinatarios: correo PERSONAL del alumno (el de acceso @siga.mx no es un
  // buzón real) y correo del tutor. Sin repetir direcciones (hermanos).
  type Dest = { student_id: string, destinatario: string, tipo: 'alumno' | 'tutor', saludo: string }
  const destinos: Dest[] = []
  const omitidos: { student_id: string, destinatario: string, tipo: string, motivo: string }[] = []
  const vistos = new Set<string>()
  for (const a of alumnos ?? []) {
    const pares: [boolean, 'alumno' | 'tutor', string | null, string][] = [
      [draft.include_student, 'alumno', a.personal_email, `Hola ${a.name.split(' ')[0]}:`],
      [draft.include_tutor, 'tutor', a.tutor_email, `Hola${a.tutor_name ? ' ' + a.tutor_name.split(' ')[0] : ''}, le escribimos sobre ${a.name}:`],
    ]
    for (const [incluir, tipo, correo, saludo] of pares) {
      if (!incluir) continue
      const c = (correo ?? '').trim().toLowerCase()
      if (!c || !correoValido(c)) { omitidos.push({ student_id: a.id, destinatario: c || '—', tipo, motivo: tipo === 'alumno' ? 'Sin correo personal' : 'Tutor sin correo' }); continue }
      if (esDeEjemplo(c)) { omitidos.push({ student_id: a.id, destinatario: c, tipo, motivo: 'Correo de ejemplo, no real: captura el verdadero' }); continue }
      if (vistos.has(c)) continue
      vistos.add(c)
      destinos.push({ student_id: a.id, destinatario: c, tipo, saludo })
    }
  }

  const { data: cupoFila } = await admin.rpc('cupo_correos_hoy')
  const cupo = Array.isArray(cupoFila) ? cupoFila[0] : cupoFila
  const restante = Math.max(0, (cupo?.limite ?? 100) - (cupo?.enviados ?? 0))
  const aEnviar = destinos.slice(0, restante)
  for (const d of destinos.slice(restante)) omitidos.push({ student_id: d.student_id, destinatario: d.destinatario, tipo: d.tipo, motivo: 'Cupo diario agotado' })

  const { data: conf } = await admin.from('configuracion').select('correo_remitente').limit(1).maybeSingle()
  const from = conf?.correo_remitente || 'SIGA CEFIMAT <onboarding@resend.dev>'

  const registros: Record<string, unknown>[] = []
  // Un correo por destinatario (nadie ve las direcciones de los demás), en lotes de 100.
  for (let i = 0; i < aEnviar.length; i += 100) {
    const lote = aEnviar.slice(i, i + 100)
    const resp = await fetch('https://api.resend.com/emails/batch', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(lote.map(d => ({
        from, to: [d.destinatario], subject: draft.subject,
        html: plantillaHtml(draft.subject, draft.body, d.saludo),
        text: `${d.saludo}\n\n${draft.body}\n\nEntra a SIGA: ${PLATAFORMA}\n\n— CEFIMAT (SIGA)`,
      }))),
    })
    const cuerpo = await resp.json().catch(() => ({}))
    const ids: { id: string }[] = cuerpo?.data ?? []
    // Resend en modo de prueba (sin dominio verificado) responde con un texto
    // genérico que habla de "example.com" aunque el correo sea válido.
    const crudo = String(cuerpo?.message ?? cuerpo?.name ?? `HTTP ${resp.status}`)
    const motivoFallo = /testing email|verify a domain|own email/i.test(crudo)
      ? 'Resend en modo de prueba: sin dominio verificado solo entrega al correo dueño de tu cuenta de Resend'
      : crudo
    lote.forEach((d, k) => registros.push({
      draft_id: draft.id, student_id: d.student_id, destinatario: d.destinatario, tipo: d.tipo, enviado_por: user.id,
      ...(resp.ok
        ? { estado: 'enviado', proveedor_id: ids[k]?.id ?? null }
        : { estado: 'fallido', motivo: motivoFallo.slice(0, 300) }),
    }))
  }
  for (const o of omitidos) registros.push({ draft_id: draft.id, ...o, estado: 'omitido', enviado_por: user.id })
  if (registros.length) await admin.from('email_envios').insert(registros)

  const enviados = registros.filter(r => r.estado === 'enviado').length
  const fallidos = registros.filter(r => r.estado === 'fallido')
  await admin.from('email_drafts').update({ status: enviados > 0 ? 'sent' : 'failed', sent_at: enviados > 0 ? new Date().toISOString() : null }).eq('id', draft.id)

  return json({
    ok: true, enviados, fallidos: fallidos.length, omitidos: omitidos.length,
    motivoFallo: fallidos[0]?.motivo ?? null,
    cupo: { enviados: (cupo?.enviados ?? 0) + enviados, limite: cupo?.limite ?? 100 },
  })
})
