-- Avisos por correo ya enviados sobre algo concreto (una actividad nueva, un
-- material nuevo o por vencer). Sirve para no sugerir dos veces el mismo aviso
-- en la pestaña "Notificaciones" de Enviar correos.
create table if not exists public.avisos_enviados (
  id          uuid primary key default gen_random_uuid(),
  tipo        text not null check (tipo in ('actividad','material_nuevo','material_vence')),
  ref_id      text not null,
  group_id    text references public.groups(id) on delete cascade,
  draft_id    uuid references public.email_drafts(id) on delete set null,
  audiencia   text not null check (audiencia in ('ambos','alumnos','tutores')),
  enviado_por uuid default auth.uid(),
  created_at  timestamptz not null default now()
);
create index if not exists avisos_enviados_ref_idx on public.avisos_enviados (tipo, ref_id);
alter table public.avisos_enviados enable row level security;

drop policy if exists "ver avisos" on public.avisos_enviados;
create policy "ver avisos" on public.avisos_enviados for select to authenticated
  using (public.tiene_apartado('correos'));
drop policy if exists "registrar aviso" on public.avisos_enviados;
create policy "registrar aviso" on public.avisos_enviados for insert to authenticated
  with check (public.tiene_apartado('correos') and enviado_por = (select auth.uid())
              and (group_id is null or public.puede_ver_grupo(group_id)));
revoke update, delete on public.avisos_enviados from anon, authenticated;

-- "Descartar" una sugerencia: queda registrada sin enviar nada.
alter table public.avisos_enviados add column if not exists descartado boolean not null default false;
