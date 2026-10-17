// Limpieza automática de archivos. La llama pg_cron cada hora (job
// "limpiar-materiales") con la clave que guarda Vault en la cabecera
// `x-limpieza`; sin esa clave responde 401. Repetirla no tiene efectos dañinos.
//
// 1. Materiales vencidos: el archivo del bucket privado `materiales` y su fila.
// 2. Archivos huérfanos de expedientes y fotos de perfil (`archivos_huerfanos()`):
//    de alumnos eliminados, documentos que se volvieron a subir en otro formato
//    o fotos reemplazadas. Así no se acumulan documentos de menores ni espacio.
import { createClient } from 'jsr:@supabase/supabase-js@2'

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('Método no permitido', { status: 405 })

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  })

  const { data: valida, error: errClave } = await supabase.rpc('verificar_secreto_limpieza', {
    p_secreto: req.headers.get('x-limpieza') ?? '',
  })
  if (errClave || valida !== true) return new Response('No autorizado', { status: 401 })

  // ── 1. Materiales vencidos ──
  let borrados = 0
  const { data: vencidos, error } = await supabase
    .from('materiales')
    .select('id, storage_path')
    .lte('expira_en', new Date().toISOString())
    .limit(500)
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 })
  if (vencidos?.length) {
    // Primero el archivo; la fila solo se borra si su archivo ya no está.
    const { error: errStorage } = await supabase.storage.from('materiales').remove(vencidos.map(m => m.storage_path))
    if (errStorage) return Response.json({ ok: false, error: errStorage.message }, { status: 500 })
    const { error: errFilas } = await supabase.from('materiales').delete().in('id', vencidos.map(m => m.id))
    if (errFilas) return Response.json({ ok: false, error: errFilas.message }, { status: 500 })
    borrados = vencidos.length
  }

  // ── 2. Expedientes y fotos huérfanos ──
  const huerfanos: Record<string, number> = {}
  const { data: sueltos, error: errH } = await supabase.rpc('archivos_huerfanos')
  if (errH) return Response.json({ ok: false, borrados, error: errH.message }, { status: 500 })
  const porBucket: Record<string, string[]> = {}
  for (const f of (sueltos ?? []) as { bucket: string, ruta: string }[]) (porBucket[f.bucket] ??= []).push(f.ruta)
  for (const [bucket, rutas] of Object.entries(porBucket)) {
    for (let i = 0; i < rutas.length; i += 500) {
      const { error: e } = await supabase.storage.from(bucket).remove(rutas.slice(i, i + 500))
      if (e) return Response.json({ ok: false, borrados, huerfanos, error: e.message }, { status: 500 })
      huerfanos[bucket] = (huerfanos[bucket] ?? 0) + Math.min(500, rutas.length - i)
    }
  }

  return Response.json({ ok: true, borrados, huerfanos })
})
