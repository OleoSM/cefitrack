-- Pantalla "Uso y consumo" (solo admin): gasto de IA y correos enviados.
-- Agrega en la base (no en el navegador): email_envios crece ~100 filas al día
-- y PostgREST corta las respuestas en 1000 filas.
create or replace function public.uso_consumo() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  zona   constant text := 'America/Mexico_City';
  inicio timestamptz := date_trunc('month', now() at time zone zona) at time zone zona;
  hace30 timestamptz := (date_trunc('day', now() at time zone zona) - interval '29 days') at time zone zona;
  cupo   record;
begin
  if not public.es_admin() then raise exception 'solo_admin'; end if;
  select * into cupo from public.cupo_correos_hoy() limit 1;

  return jsonb_build_object(
    'config', (select jsonb_build_object(
        'asistente_limite_usd', asistente_limite_usd, 'asistente_modelo', coalesce(asistente_modelo, 'claude-haiku-5-5'),
        'correo_limite_diario', correo_limite_diario, 'correo_remitente', correo_remitente)
      from configuracion limit 1),

    'ia_mes', (select jsonb_build_object(
        'costo', coalesce(sum(costo_usd), 0), 'consultas', count(*),
        'tokens_entrada', coalesce(sum(tokens_entrada), 0), 'tokens_salida', coalesce(sum(tokens_salida), 0),
        'tokens_cache', coalesce(sum(tokens_cache_lectura + tokens_cache_escritura), 0))
      from asistente_uso where created_at >= inicio),
    'ia_total', (select jsonb_build_object('costo', coalesce(sum(costo_usd), 0), 'consultas', count(*), 'desde', min(created_at))
      from asistente_uso),
    'reportes_mes', (select jsonb_build_object(
        'alumno', count(*) filter (where tipo = 'alumno'), 'grupo', count(*) filter (where tipo = 'grupo'),
        'costo', coalesce(sum(costo_usd), 0))
      from reportes_ia where created_at >= inicio),
    'ia_dias', (select coalesce(jsonb_agg(jsonb_build_object('dia', dia, 'costo', costo, 'consultas', n) order by dia), '[]'::jsonb)
      from (select to_char(created_at at time zone zona, 'YYYY-MM-DD') dia, sum(costo_usd) costo, count(*) n
            from asistente_uso where created_at >= hace30 group by 1) t),
    'ia_usuarios', (select coalesce(jsonb_agg(jsonb_build_object('nombre', nombre, 'consultas', n, 'costo', costo) order by costo desc), '[]'::jsonb)
      from (select coalesce(p.name, p.email, 'Cuenta eliminada') nombre, count(*) n, sum(u.costo_usd) costo
            from asistente_uso u left join profiles p on p.id = u.usuario
            where u.created_at >= inicio group by 1) t),

    'correos_hoy', jsonb_build_object('enviados', coalesce(cupo.enviados, 0), 'limite', coalesce(cupo.limite, 100)),
    'correos_mes', (select jsonb_build_object(
        'enviados', count(*) filter (where estado = 'enviado'), 'fallidos', count(*) filter (where estado = 'fallido'),
        'omitidos', count(*) filter (where estado = 'omitido'),
        'a_alumnos', count(*) filter (where estado = 'enviado' and tipo = 'alumno'),
        'a_tutores', count(*) filter (where estado = 'enviado' and tipo = 'tutor'),
        'mensajes', count(distinct draft_id))
      from email_envios where created_at >= inicio),
    'correos_total', (select jsonb_build_object('enviados', count(*) filter (where estado = 'enviado')) from email_envios),
    'correos_dias', (select coalesce(jsonb_agg(jsonb_build_object('dia', dia, 'enviados', e, 'fallidos', f, 'omitidos', o) order by dia), '[]'::jsonb)
      from (select to_char(created_at at time zone zona, 'YYYY-MM-DD') dia,
                   count(*) filter (where estado = 'enviado') e, count(*) filter (where estado = 'fallido') f,
                   count(*) filter (where estado = 'omitido') o
            from email_envios where created_at >= hace30 group by 1) t),
    'correos_motivos', (select coalesce(jsonb_agg(jsonb_build_object('motivo', motivo, 'estado', estado, 'n', n) order by n desc), '[]'::jsonb)
      from (select coalesce(motivo, 'Sin detalle') motivo, estado, count(*) n
            from email_envios where created_at >= inicio and estado <> 'enviado'
            group by 1, 2 order by 3 desc limit 6) t),
    'correos_usuarios', (select coalesce(jsonb_agg(jsonb_build_object('nombre', nombre, 'enviados', n, 'mensajes', m) order by n desc), '[]'::jsonb)
      from (select coalesce(p.name, p.email, 'Cuenta eliminada') nombre, count(*) filter (where e.estado = 'enviado') n,
                   count(distinct e.draft_id) m
            from email_envios e left join profiles p on p.id = e.enviado_por
            where e.created_at >= inicio group by 1) t)
  );
end $$;
revoke execute on function public.uso_consumo() from public, anon;
grant execute on function public.uso_consumo() to authenticated;
