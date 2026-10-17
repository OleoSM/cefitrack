-- PENDIENTE DE APROBACIÓN (no aplicado). Programa los avisos automáticos de
-- la Edge Function `avisos-auto` cuando CEFIMAT dé el visto bueno.
-- Mientras tanto se disparan a mano en Notificaciones → Automáticos.
-- Horas en UTC: México centro = UTC-6 → 14:00 UTC = 8:00 a. m.

-- Recordatorios de entrega (2 días antes) y materiales por vencer: diario, 8:00.
select cron.schedule('avisos-recordatorios', '0 14 * * *', $$
  select net.http_post(
    url := 'https://dvtbvmqqlmohbygoicsg.supabase.co/functions/v1/avisos-auto',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-tarea', (select decrypted_secret from vault.decrypted_secrets where name = 'limpieza_materiales')),
    body := '{"accion":"recordatorios"}'::jsonb)
$$);

-- Top mensual: el día 1 de cada mes, 9:00 (manda el del mes que terminó).
select cron.schedule('avisos-top-mensual', '0 15 1 * *', $$
  select net.http_post(
    url := 'https://dvtbvmqqlmohbygoicsg.supabase.co/functions/v1/avisos-auto',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-tarea', (select decrypted_secret from vault.decrypted_secrets where name = 'limpieza_materiales')),
    body := '{"accion":"top_mensual"}'::jsonb)
$$);

-- Para apagarlos:  select cron.unschedule('avisos-recordatorios'); select cron.unschedule('avisos-top-mensual');
