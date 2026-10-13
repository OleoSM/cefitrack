-- Hoja de Calificaciones: prerrequisitos entre columnas, "cuenta para la
-- garantía" por columna, bloque de examen (Guía → Examen → Análisis) y orden
-- de TODOS los bloques de la hoja por grupo.
--
-- Prerrequisito: una columna puede depender de otra del mismo grupo. Si el
-- requisito no se cumple, la celda SE CAPTURA pero NO cuenta para el promedio
-- (no genera fila en `evaluations`); la hoja la marca "Falta …". Cumplido:
--   · requisito tipo check        → palomita ('1')
--   · requisito tipo calificación → un número (y >= requisito_min si se fijó)
--   · requisito tipo valor        → cualquier valor capturado

alter table public.registro_columnas
  add column if not exists requisito_id uuid references public.registro_columnas(id) on delete set null,
  add column if not exists requisito_min numeric,
  add column if not exists cuenta_garantia boolean not null default true;

create or replace function public.requisito_cumplido(p_student_id text, p_columna_id uuid) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare col registro_columnas; req registro_columnas; v text; n numeric;
begin
  select * into col from registro_columnas where id = p_columna_id;
  if not found or col.requisito_id is null then return true; end if;
  select * into req from registro_columnas where id = col.requisito_id;
  if not found then return true; end if;
  select valor into v from registro_valores where student_id = p_student_id and columna_id = req.id;
  if v is null or trim(v) = '' then return false; end if;
  if req.formato = 'check' then return v = '1'; end if;
  if req.formato = 'valor' then return true; end if;
  if upper(trim(v)) = 'NP' then return false; end if;
  begin n := replace(v, ',', '.')::numeric; exception when others then return false; end;
  return col.requisito_min is null or n >= col.requisito_min;
end $$;
revoke execute on function public.requisito_cumplido(text, uuid) from public, anon;
grant execute on function public.requisito_cumplido(text, uuid) to authenticated;

-- Recalcula si la celda cuenta para el promedio y, en cadena, las columnas que
-- dependen de ella (Guía → Examen → Análisis). Uso interno.
create or replace function public.sincronizar_celda_columna(p_student_id text, p_columna_id uuid, p_profundidad int default 0)
returns void language plpgsql security definer set search_path = public as $$
declare col registro_columnas; v text; n numeric; dep uuid;
begin
  if p_profundidad > 10 then return; end if;
  select * into col from registro_columnas where id = p_columna_id;
  if not found then return; end if;
  select valor into v from registro_valores where student_id = p_student_id and columna_id = p_columna_id;
  n := null;
  if col.formato = 'calificacion' and col.cuenta_en_promedio and v is not null and upper(trim(v)) <> 'NP' then
    begin n := replace(v, ',', '.')::numeric; exception when others then n := null; end;
    if n is not null and not public.requisito_cumplido(p_student_id, p_columna_id) then n := null; end if;
  end if;
  perform public.set_celda_registro(p_student_id, p_columna_id, n);
  for dep in select id from registro_columnas where requisito_id = p_columna_id loop
    perform public.sincronizar_celda_columna(p_student_id, dep, p_profundidad + 1);
  end loop;
end $$;
revoke execute on function public.sincronizar_celda_columna(text, uuid, int) from public, anon, authenticated;

-- set_valor_registro: igual que antes, pero el paso a `evaluations` lo decide
-- sincronizar_celda_columna (respeta prerrequisitos y arrastra dependientes).
create or replace function public.set_valor_registro(p_student_id text, p_columna_id uuid, p_valor text)
returns void language plpgsql security definer set search_path = public as $$
declare
  col public.registro_columnas;
  v_raw text := trim(coalesce(p_valor, ''));
  v_clean text := upper(trim(coalesce(p_valor, '')));
  v_num numeric;
  v_guardar text;
begin
  select * into col from public.registro_columnas where id = p_columna_id;
  if not found then raise exception 'columna_inexistente'; end if;
  if not public.es_admin() and not public.puede_ver_grupo(col.group_id) then raise exception 'forbidden'; end if;

  if v_clean = '' then
    delete from public.registro_valores where student_id = p_student_id and columna_id = p_columna_id;
    perform public.sincronizar_celda_columna(p_student_id, p_columna_id);
    return;
  end if;

  if col.formato = 'check' then
    v_guardar := case when v_clean in ('1','SI','SÍ','TRUE','X','✓') then '1'
                      when v_clean in ('0','NO','FALSE') then '0' end;
    if v_guardar is null then raise exception 'valor_check_invalido'; end if;
  elsif col.formato = 'valor' then
    if length(v_raw) > 60 then raise exception 'valor_muy_largo'; end if;
    if col.opciones is not null and jsonb_array_length(col.opciones) > 0
       and not exists (select 1 from jsonb_array_elements_text(col.opciones) o where lower(o) = lower(v_raw)) then
      raise exception 'valor_no_permitido';
    end if;
    v_guardar := v_raw;
  else
    if v_clean = 'NP' then
      v_guardar := 'NP';
    else
      begin v_num := replace(v_clean, ',', '.')::numeric;
      exception when invalid_text_representation then raise exception 'invalid_grade'; end;
      if v_num < 0 or v_num > col.cal_max then raise exception 'fuera_de_rango'; end if;
      v_guardar := v_num::text;
    end if;
  end if;

  insert into public.registro_valores(student_id, columna_id, valor, updated_by)
  values (p_student_id, p_columna_id, v_guardar, (select auth.uid()))
  on conflict (student_id, columna_id) do update
    set valor = excluded.valor, updated_at = now(), updated_by = (select auth.uid());

  perform public.sincronizar_celda_columna(p_student_id, p_columna_id);
end $$;

-- configurar_columna_registro: al final resincroniza con los prerrequisitos.
create or replace function public.configurar_columna_registro(
  p_columna_id uuid, p_nombre text, p_tipo text, p_cal_max numeric,
  p_formato text, p_cuenta boolean, p_opciones jsonb, p_descripcion text,
  p_limpiar boolean default false)
returns public.registro_columnas language plpgsql security definer set search_path = public as $$
declare
  col public.registro_columnas;
  v_nombre text := trim(coalesce(p_nombre, ''));
  v_cuenta boolean := (p_formato = 'calificacion' and coalesce(p_cuenta, true));
  v_n int;
  v_max numeric;
  r record;
begin
  select * into col from public.registro_columnas where id = p_columna_id;
  if not found then raise exception 'columna_inexistente'; end if;
  if not public.puede_ver_grupo(col.group_id) then raise exception 'forbidden'; end if;
  if col.es_fija then raise exception 'columna_fija'; end if;
  if v_nombre = '' then raise exception 'nombre_vacio'; end if;
  if p_formato not in ('calificacion','check','valor') then raise exception 'formato_invalido'; end if;
  if p_formato = 'calificacion' and (p_cal_max is null or p_cal_max <= 0) then raise exception 'cal_max_invalido'; end if;
  if p_opciones is not null and (jsonb_typeof(p_opciones) <> 'array' or jsonb_array_length(p_opciones) > 20) then
    raise exception 'opciones_invalidas';
  end if;
  if exists (select 1 from registro_columnas x where x.group_id = col.group_id and x.materia = col.materia
             and lower(x.nombre) = lower(v_nombre) and x.id <> col.id) then
    raise exception 'nombre_repetido';
  end if;

  select count(*) into v_n from registro_valores where columna_id = col.id;
  if p_formato <> col.formato and v_n > 0 then
    if not coalesce(p_limpiar, false) then raise exception 'tiene_valores:%', v_n; end if;
    delete from registro_valores where columna_id = col.id;
  elsif p_formato = 'calificacion' then
    select max(valor::numeric) into v_max from registro_valores
     where columna_id = col.id and valor ~ '^[0-9]+(\.[0-9]+)?$';
    if v_max is not null and v_max > p_cal_max then raise exception 'valores_fuera_de_rango:%', v_max; end if;
  end if;

  update registro_columnas set
    nombre = v_nombre, tipo = coalesce(nullif(trim(p_tipo), ''), tipo),
    cal_max = case when p_formato = 'calificacion' then p_cal_max else cal_max end,
    formato = p_formato, cuenta_en_promedio = v_cuenta,
    opciones = case when p_formato = 'valor' then p_opciones end,
    descripcion = nullif(trim(coalesce(p_descripcion, '')), '')
  where id = col.id
  returning * into col;

  for r in select s.id from students s where s.group_id = col.group_id loop
    perform public.sincronizar_celda_columna(r.id, col.id);
  end loop;
  return col;
end $$;

-- Prerrequisito y "cuenta para la garantía" de una columna.
create or replace function public.configurar_requisito_columna(
  p_columna_id uuid, p_requisito_id uuid, p_requisito_min numeric, p_cuenta_garantia boolean)
returns public.registro_columnas language plpgsql security definer set search_path = public as $$
declare col registro_columnas; cur uuid; i int := 0; r record;
begin
  select * into col from registro_columnas where id = p_columna_id;
  if not found then raise exception 'columna_inexistente'; end if;
  if not public.puede_ver_grupo(col.group_id) then raise exception 'forbidden'; end if;
  if p_requisito_id is not null then
    if p_requisito_id = p_columna_id then raise exception 'requisito_propio'; end if;
    if not exists (select 1 from registro_columnas where id = p_requisito_id and group_id = col.group_id) then
      raise exception 'requisito_ajeno';
    end if;
    -- Sin ciclos: subiendo por la cadena del requisito no se debe volver a esta columna.
    cur := p_requisito_id;
    while cur is not null and i < 20 loop
      if cur = p_columna_id then raise exception 'requisito_ciclo'; end if;
      select requisito_id into cur from registro_columnas where id = cur;
      i := i + 1;
    end loop;
  end if;
  if p_requisito_min is not null and p_requisito_min < 0 then raise exception 'requisito_min_invalido'; end if;

  update registro_columnas set requisito_id = p_requisito_id,
    requisito_min = case when p_requisito_id is null then null else p_requisito_min end,
    cuenta_garantia = coalesce(p_cuenta_garantia, true)
  where id = col.id returning * into col;

  for r in select s.id from students s where s.group_id = col.group_id loop
    perform public.sincronizar_celda_columna(r.id, col.id);
  end loop;
  return col;
end $$;
revoke execute on function public.configurar_requisito_columna(uuid, uuid, numeric, boolean) from public, anon;
grant execute on function public.configurar_requisito_columna(uuid, uuid, numeric, boolean) to authenticated;

-- ── Bloque de examen: Guía de estudio n → Examen n → Análisis de resultados n ──
create or replace function public.agregar_bloque_examen(p_group_id text) returns int
language plpgsql security definer set search_path = public as $$
declare n int; v_mat int; v_ord int; g uuid; e uuid; c constant text := '#0E5E6F';
begin
  if auth.uid() is not null and not public.puede_ver_grupo(p_group_id) then raise exception 'forbidden'; end if;
  if not exists (select 1 from groups where id = p_group_id) then raise exception 'group_not_found'; end if;
  select coalesce(max((regexp_match(nombre, '^Examen ([0-9]+)$'))[1]::int), 0) + 1 into n
    from registro_columnas where group_id = p_group_id and materia = 'Exámenes';
  -- El bloque va el PRIMERO de las materias del grupo.
  select coalesce((select min(materia_orden) from registro_columnas where group_id = p_group_id and materia = 'Exámenes'),
                  (select coalesce(min(materia_orden), 1) - 1 from registro_columnas where group_id = p_group_id))
    into v_mat;
  select coalesce(max(orden), -1) + 1 into v_ord from registro_columnas where group_id = p_group_id and materia = 'Exámenes';

  insert into registro_columnas(group_id, materia, materia_orden, materia_color, nombre, tipo, cal_max, orden, bloque,
                                formato, cuenta_en_promedio, descripcion)
  values (p_group_id, 'Exámenes', v_mat, c, 'Guía de estudio ' || n, 'guia', 10, v_ord, 'examen',
          'check', false, 'Entrega de la guía de estudio. Requisito para que cuente el examen.')
  returning id into g;
  insert into registro_columnas(group_id, materia, materia_orden, materia_color, nombre, tipo, cal_max, orden, bloque,
                                formato, cuenta_en_promedio, requisito_id, descripcion)
  values (p_group_id, 'Exámenes', v_mat, c, 'Examen ' || n, 'examen', 10, v_ord + 1, 'examen',
          'calificacion', true, g, 'Solo cuenta para el promedio si se entregó la guía de estudio.')
  returning id into e;
  insert into registro_columnas(group_id, materia, materia_orden, materia_color, nombre, tipo, cal_max, orden, bloque,
                                formato, cuenta_en_promedio, requisito_id, descripcion)
  values (p_group_id, 'Exámenes', v_mat, c, 'Análisis de resultados ' || n, 'analisis', 10, v_ord + 2, 'examen',
          'check', false, e, 'Resumen de lo que salió bien y mal en el examen.');
  return n;
end $$;
revoke execute on function public.agregar_bloque_examen(text) from public, anon;
grant execute on function public.agregar_bloque_examen(text) to authenticated;

-- Grupos nuevos: plantilla base + primer bloque de examen.
create or replace function public.trg_plantilla_base_grupo() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.asegurar_plantilla_base(new.id);
  perform public.agregar_bloque_examen(new.id);
  return new;
end $$;

-- Grupos actuales: un bloque de examen en cada uno que aún no lo tenga.
do $$ declare g record; begin
  for g in select id from groups where not exists
    (select 1 from registro_columnas c where c.group_id = groups.id and c.materia = 'Exámenes') loop
    perform public.agregar_bloque_examen(g.id);
  end loop;
end $$;

-- ── Orden de TODOS los bloques de la hoja (también los fijos), por grupo ──
-- Tokens: 'pago','garantia','area','asistencia','docs' y 'm:<materia>'.
create table if not exists public.registro_orden_bloques (
  group_id   text primary key references public.groups(id) on delete cascade,
  orden      text[] not null,
  updated_at timestamptz not null default now()
);
alter table public.registro_orden_bloques enable row level security;
drop policy if exists "leer orden de bloques" on public.registro_orden_bloques;
create policy "leer orden de bloques" on public.registro_orden_bloques for select to authenticated
  using (public.puede_ver_grupo(group_id));
revoke insert, update, delete on public.registro_orden_bloques from anon, authenticated;

create or replace function public.guardar_orden_bloques(p_group_id text, p_orden text[]) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.puede_ver_grupo(p_group_id) then raise exception 'forbidden'; end if;
  if p_orden is null or array_length(p_orden, 1) > 200
     or exists (select 1 from unnest(p_orden) t where t !~ '^(pago|garantia|area|asistencia|docs|m:.{1,120})$') then
    raise exception 'orden_invalido';
  end if;
  insert into registro_orden_bloques(group_id, orden, updated_at) values (p_group_id, p_orden, now())
  on conflict (group_id) do update set orden = excluded.orden, updated_at = now();
end $$;
revoke execute on function public.guardar_orden_bloques(text, text[]) from public, anon;
grant execute on function public.guardar_orden_bloques(text, text[]) to authenticated;
