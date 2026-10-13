-- Asistente con IA (Claude Haiku) solo para administradores.
-- La API key vive como secreto de la Edge Function `asistente`
-- (ANTHROPIC_API_KEY). Aquí: el tope de gasto mensual (por defecto US$2),
-- el modelo y el registro de cada consulta con su costo estimado.
alter table public.configuracion
  add column if not exists asistente_limite_usd numeric(8,2) not null default 2.00,
  add column if not exists asistente_modelo text not null default 'claude-haiku-5-5';

create table if not exists public.asistente_uso (
  id              uuid primary key default gen_random_uuid(),
  usuario         uuid,
  modelo          text not null,
  tokens_entrada  integer not null default 0,
  tokens_salida   integer not null default 0,
  tokens_cache_escritura integer not null default 0,
  tokens_cache_lectura   integer not null default 0,
  costo_usd       numeric(10,6) not null default 0,
  created_at      timestamptz not null default now()
);
create index if not exists asistente_uso_mes_idx on public.asistente_uso (created_at);
alter table public.asistente_uso enable row level security;
drop policy if exists "admin ve uso asistente" on public.asistente_uso;
create policy "admin ve uso asistente" on public.asistente_uso for select to authenticated using (public.es_admin());
revoke insert, update, delete on public.asistente_uso from anon, authenticated;

-- Gasto del mes en curso (hora de México) frente al tope.
create or replace function public.gasto_asistente_mes() returns table(usado numeric, limite numeric, consultas integer)
language sql stable security definer set search_path = public as $$
  select coalesce(sum(costo_usd), 0)::numeric(10,4),
         (select asistente_limite_usd from configuracion limit 1),
         count(*)::int
  from asistente_uso
  where created_at >= (date_trunc('month', now() at time zone 'America/Mexico_City') at time zone 'America/Mexico_City')
$$;
revoke execute on function public.gasto_asistente_mes() from public, anon;
grant execute on function public.gasto_asistente_mes() to authenticated, service_role;
