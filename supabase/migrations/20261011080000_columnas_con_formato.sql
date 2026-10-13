-- Columnas de la hoja de Calificaciones con FORMATO.
-- Antes toda columna era una calificación numérica que contaba para el
-- promedio. Ahora hay actividades que no son evaluaciones:
--   · calificacion — número de 0 a cal_max. Puede o no contar para el promedio.
--   · check        — hecho / no hecho ('1' / '0'). Nunca cuenta.
--   · valor        — texto o número libre, o una de las `opciones`. Nunca cuenta.
-- Solo una calificación que cuenta genera fila en `evaluations` (y por tanto
-- afecta el promedio, el ranking y el portal del alumno).

alter table public.registro_columnas
  add column if not exists formato text not null default 'calificacion',
  add column if not exists cuenta_en_promedio boolean not null default true,
  add column if not exists opciones jsonb,
  add column if not exists descripcion text;

do $$ begin
  alter table public.registro_columnas
    add constraint registro_columnas_formato_check check (formato in ('calificacion','check','valor'));
exception when duplicate_object then null; end $$;

-- ── Escribir una celda según el formato de su columna ───────────────────────
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

  -- Vaciar la celda: igual en todos los formatos.
  if v_clean = '' then
    delete from public.registro_valores where student_id = p_student_id and columna_id = p_columna_id;
    perform public.set_celda_registro(p_student_id, p_columna_id, null);
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
    -- calificacion
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

  -- Solo una calificación numérica que cuenta va a `evaluations`.
  perform public.set_celda_registro(p_student_id, p_columna_id,
    case when col.formato = 'calificacion' and col.cuenta_en_promedio and v_guardar <> 'NP'
         then v_num end);
end $$;

-- ── Configurar una columna (el lápiz) ────────────────────────────────────────
-- p_limpiar: si se cambia el formato y la columna ya tiene valores, hay que
-- confirmarlo explícitamente; esos valores se borran (no tienen sentido en el
-- formato nuevo).
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
  v_afectados text[];
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

  select count(*), array_agg(distinct student_id) into v_n, v_afectados
  from registro_valores where columna_id = col.id;

  if p_formato <> col.formato and v_n > 0 then
    if not coalesce(p_limpiar, false) then raise exception 'tiene_valores:%', v_n; end if;
    delete from registro_valores where columna_id = col.id;
    delete from evaluations where columna_id = col.id;
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

  -- Sincronizar `evaluations` con la nueva configuración.
  if col.formato = 'calificacion' and col.cuenta_en_promedio then
    for r in select student_id, valor from registro_valores
             where columna_id = col.id and valor ~ '^[0-9]+(\.[0-9]+)?$' loop
      perform public.set_celda_registro(r.student_id, col.id, r.valor::numeric);
    end loop;
  else
    delete from evaluations where columna_id = col.id;
  end if;

  if v_afectados is not null then
    perform public.recalc_student_grade(s) from unnest(v_afectados) s;
  end if;
  return col;
end $$;
revoke execute on function public.configurar_columna_registro(uuid,text,text,numeric,text,boolean,jsonb,text,boolean) from public, anon;
grant  execute on function public.configurar_columna_registro(uuid,text,text,numeric,text,boolean,jsonb,text,boolean) to authenticated;
