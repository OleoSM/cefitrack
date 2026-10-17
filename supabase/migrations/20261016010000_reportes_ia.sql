-- Asistente de IA: reportes de alumno y de grupo (competencias, habilidades,
-- fortalezas, áreas de mejora y recomendaciones).
--
-- · Nuevo apartado delegable "ia": el admin (super) lo tiene siempre; un
--   sub-admin solo si un admin se lo da en Acceso y Disposición. No entra en
--   los apartados por defecto (cuesta dinero). Los alumnos nunca.
-- · `reportes_ia` guarda cada reporte generado para no pagar dos veces por el
--   mismo. Solo la Edge Function `asistente` escribe (service role); se lee con
--   el apartado y sobre grupos que el usuario puede ver.

create or replace function public.apartados_catalogo() returns text[]
language sql immutable set search_path = public as $$
  select array['grupos','alumnos','calificaciones','asistencias','evaluaciones','materiales',
               'pagos','correos','terminos','configuracion','rankings','ia']
$$;

create table if not exists public.reportes_ia (
  id          uuid primary key default gen_random_uuid(),
  tipo        text not null check (tipo in ('alumno','grupo')),
  student_id  text references public.students(id) on delete cascade,
  -- En los de alumno, su grupo al generarlo: así la RLS decide quién lo ve.
  group_id    text not null references public.groups(id) on delete cascade,
  contenido   jsonb not null,
  metricas    jsonb not null,
  modelo      text not null,
  costo_usd   numeric(10,5) not null default 0,
  creado_por  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  check (tipo = 'grupo' or student_id is not null)
);
create index if not exists reportes_ia_alumno_idx on public.reportes_ia (student_id, created_at desc);
create index if not exists reportes_ia_grupo_idx on public.reportes_ia (group_id, created_at desc);
alter table public.reportes_ia enable row level security;

drop policy if exists "ver reportes ia" on public.reportes_ia;
create policy "ver reportes ia" on public.reportes_ia for select to authenticated
  using (public.tiene_apartado('ia') and public.puede_ver_grupo(group_id));
revoke insert, update, delete on public.reportes_ia from anon, authenticated;
