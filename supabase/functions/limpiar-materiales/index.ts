// Borra los materiales vencidos: el archivo del bucket privado `materiales` y
// su fila. La llama pg_cron cada hora (job "limpiar-materiales") con la clave
// que guarda Vault en la cabecera `x-limpieza`; sin esa clave responde 401.
// Solo borra lo que ya venció, así que repetirla no tiene efectos dañinos.
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

  const { data: vencidos, error } = await supabase
    .from('materiales')
    .select('id, storage_path')
    .lte('expira_en', new Date().toISOString())
    .limit(500)
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 })
  if (!vencidos?.length) return Response.json({ ok: true, borrados: 0 })

  // Primero el archivo; la fila solo se borra si su archivo ya no está.
  const { error: errStorage } = await supabase.storage.from('materiales').remove(vencidos.map(m => m.storage_path))
  if (errStorage) return Response.json({ ok: false, error: errStorage.message }, { status: 500 })

  const { error: errFilas } = await supabase.from('materiales').delete().in('id', vencidos.map(m => m.id))
  if (errFilas) return Response.json({ ok: false, error: errFilas.message }, { status: 500 })

  return Response.json({ ok: true, borrados: vencidos.length })
})
