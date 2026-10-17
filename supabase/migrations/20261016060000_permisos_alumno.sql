-- Permisos por alumno (pedido 2026-10-16): desde el panel del admin, junto a
-- cada alumno, "Permisos" decide qué puede ver en su portal: Pagos,
-- Materiales (todos o algunos ocultos uno por uno), Desempeño (reporte con
-- IA) y Rankings. Sin fila = todo permitido. Se aplica también en el
-- servidor: RLS de pagos/planes, puede_ver_material y reportes_ia.

create table if not exists public.permisos_alumno (
  student_id         text primary key references public.students(id) on delete cascade,
  ver_pagos          boolean not null default true,
  ver_materiales     boolean not null default true,
  ver_desempeno      boolean not null default true,
  ver_rankings       boolean not null default true,
  materiales_ocultos uuid[]  not null default '{}',
  updated_by         uuid default auth.uid(),
  updated_at         timestamptz not null default now()
);
alter table public.permisos_alumno enable row level security;
drop policy if exists "ver permisos alumno" on public.permisos_alumno;
create policy "ver permisos alumno" on public.permisos_alumno for select to authenticated
  using (student_id = (select public.mi_student_id()) or public.puede_gestionar_alumno(student_id));
revoke insert, update, delete on public.permisos_alumno from anon, authenticated;

-- ¿El alumno (sesión actual) tiene permitido este apartado? Para el personal, siempre true.
create or replace function public.alumno_puede(p_apartado text) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when public.auth_role() <> 'student' then true
    else coalesce((select case p_apartado
                     when 'pagos' then ver_pagos when 'materiales' then ver_materiales
                     when 'desempeno' then ver_desempeno when 'rankings' then ver_rankings else true end
                   from permisos_alumno where student_id = public.mi_student_id()), true)
  end
$$;

create or replace function public.guardar_permisos_alumno(p_student_id text, p_ver_pagos boolean, p_ver_materiales boolean,
  p_ver_desempeno boolean, p_ver_rankings boolean, p_materiales_ocultos uuid[])
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.puede_gestionar_alumno(p_student_id) then raise exception 'forbidden'; end if;
  insert into permisos_alumno (student_id, ver_pagos, ver_materiales, ver_desempeno, ver_rankings, materiales_ocultos, updated_by, updated_at)
  values (p_student_id, p_ver_pagos, p_ver_materiales, p_ver_desempeno, p_ver_rankings, coalesce(p_materiales_ocultos, '{}'), auth.uid(), now())
  on conflict (student_id) do update set ver_pagos = excluded.ver_pagos, ver_materiales = excluded.ver_materiales,
    ver_desempeno = excluded.ver_desempeno, ver_rankings = excluded.ver_rankings,
    materiales_ocultos = excluded.materiales_ocultos, updated_by = excluded.updated_by, updated_at = now();
end $$;

-- Materiales: el alumno no ve los ocultos ni ninguno si se le quitó el apartado.
create or replace function public.puede_ver_material(p_id uuid) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare m materiales; g groups; v_sid text; v_perm permisos_alumno;
begin
  select * into m from materiales where id = p_id;
  if not found then return false; end if;
  if public.es_admin() then return true; end if;
  if public.auth_role() = 'sub_admin' then
    if not public.tiene_apartado('materiales') then return false; end if;
    return m.creado_por = auth.uid()
      or exists (select 1 from mis_grupos() x where x.group_id = any(m.grupos))
      or exists (select 1 from sub_admin_access a where a.user_id = auth.uid() and a.sucursal = any(m.sucursales));
  end if;
  if now() < m.visible_desde or now() >= m.expira_en then return false; end if;
  v_sid := public.mi_student_id();
  if v_sid is null then return false; end if;
  select * into v_perm from permisos_alumno where student_id = v_sid;
  if found and (not v_perm.ver_materiales or p_id = any(v_perm.materiales_ocultos)) then return false; end if;
  select gr.* into g from students s join groups gr on gr.id = s.group_id where s.id = v_sid;
  if not found then return false; end if;
  return g.id = any(m.grupos) or g.sucursal = any(m.sucursales)
      or coalesce(g.curso, case when g.institucion = 'ecoems' then 'ecoems' else 'universidad' end) = any(m.cursos);
end $$;

-- Pagos y planes: el alumno solo los ve si tiene el apartado.
alter policy "leer pagos" on public.pagos using (
  public.es_admin()
  or (student_id = public.mi_student_id() and public.alumno_puede('pagos'))
  or (public.tiene_apartado('pagos') and exists (select 1 from students s where s.id = pagos.student_id and public.puede_ver_grupo(s.group_id))));
alter policy "leer planes de pago" on public.planes_pago using (
  public.es_admin()
  or (student_id = public.mi_student_id() and public.alumno_puede('pagos'))
  or (public.tiene_apartado('pagos') and exists (select 1 from students s where s.id = planes_pago.student_id and public.puede_ver_grupo(s.group_id))));

-- Desempeño: el alumno NO lee reportes_ia directamente (trae alertas y notas
-- internas). mi_desempeno() le devuelve solo su último reporte sin lo interno:
-- sin alertas, sin métricas crudas y solo recomendaciones para alumno o tutor.
create or replace function public.mi_desempeno() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r reportes_ia; v_sid text := public.mi_student_id();
begin
  if v_sid is null or not public.alumno_puede('desempeno') then return null; end if;
  select * into r from reportes_ia where tipo = 'alumno' and student_id = v_sid order by created_at desc limit 1;
  if not found then return null; end if;
  return jsonb_build_object(
    'fecha', r.created_at,
    'nivel_general', r.contenido->'nivel_general',
    'resumen', r.contenido->'resumen',
    'competencias', r.contenido->'competencias',
    'habilidades', r.contenido->'habilidades',
    'fortalezas', r.contenido->'fortalezas',
    'areas_mejora', r.contenido->'areas_mejora',
    'recomendaciones', coalesce((select jsonb_agg(x) from jsonb_array_elements(r.contenido->'recomendaciones') x
                                  where x->>'para' in ('alumno', 'tutor')), '[]'::jsonb),
    'promedio', r.metricas->'resumen'->'promedio',
    'asistencia', r.metricas->'resumen'->'asistencia'->'porcentaje');
end $$;

revoke execute on function public.alumno_puede(text), public.mi_desempeno(), public.guardar_permisos_alumno(text, boolean, boolean, boolean, boolean, uuid[]) from public, anon;
grant execute on function public.alumno_puede(text), public.mi_desempeno(), public.guardar_permisos_alumno(text, boolean, boolean, boolean, boolean, uuid[]) to authenticated;
