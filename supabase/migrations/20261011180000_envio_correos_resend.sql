-- Envío real de correos con Resend (Edge Function `enviar-correo`).
-- La API key vive como secreto de la función (RESEND_API_KEY), nunca en el
-- navegador. Aquí: el registro de cada envío, el cupo diario (capa gratis de
-- Resend: 100 al día / 3,000 al mes) y el remitente, ambos configurables para
-- cuando se pase a la capa de pago.

alter table public.configuracion
  add column if not exists correo_limite_diario integer not null default 100,
  add column if not exists correo_remitente text not null default 'SIGA CEFIMAT <onboarding@resend.dev>';

do $$ begin
  alter table public.configuracion add constraint configuracion_correo_limite check (correo_limite_diario between 1 and 100000);
exception when duplicate_object then null; end $$;

create table if not exists public.email_envios (
  id           uuid primary key default gen_random_uuid(),
  draft_id     uuid references public.email_drafts(id) on delete cascade,
  student_id   text references public.students(id) on delete set null,
  destinatario text not null,
  tipo         text not null check (tipo in ('alumno','tutor')),
  estado       text not null check (estado in ('enviado','fallido','omitido')),
  motivo       text,
  proveedor_id text,
  enviado_por  uuid,
  created_at   timestamptz not null default now()
);
create index if not exists email_envios_dia_idx on public.email_envios (created_at) where estado = 'enviado';
alter table public.email_envios enable row level security;
drop policy if exists "ver envios" on public.email_envios;
create policy "ver envios" on public.email_envios for select to authenticated
  using (public.es_admin() or (public.tiene_apartado('correos') and enviado_por = (select auth.uid())));
-- Solo la Edge Function (service_role) escribe.
revoke insert, update, delete on public.email_envios from anon, authenticated;

-- Cupo del día (hora de México): cuántos se han enviado y el límite.
create or replace function public.cupo_correos_hoy() returns table(enviados integer, limite integer)
language sql stable security definer set search_path = public as $$
  select (select count(*)::int from email_envios
           where estado = 'enviado'
             and created_at >= (date_trunc('day', now() at time zone 'America/Mexico_City') at time zone 'America/Mexico_City')),
         (select correo_limite_diario from configuracion limit 1)
$$;
revoke execute on function public.cupo_correos_hoy() from public, anon;
grant execute on function public.cupo_correos_hoy() to authenticated, service_role;
