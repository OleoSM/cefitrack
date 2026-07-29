-- Piloto docente: escritura real de grupos, alumnos y calificaciones.
-- Mismo diseño que el resto del proyecto: RLS solo-lectura + RPCs SECURITY DEFINER.

-- ─── IDs autogenerados ───────────────────────────────────────────────────────
-- groups/students usaban ids de texto sembrados a mano (g1..g3, s1..s7).
-- Se agregan secuencias para que las altas nuevas sigan el mismo formato legible.
create sequence if not exists group_id_seq start with 4;
create sequence if not exists student_id_seq start with 8;

alter table groups   alter column id set default 'g' || nextval('group_id_seq');
alter table students alter column id set default 's' || nextval('student_id_seq');

-- ─── CALIFICACIONES ──────────────────────────────────────────────────────────
create table if not exists evaluations (
  id            uuid primary key default gen_random_uuid(),
  student_id    text not null references students(id) on delete cascade,
  materia       text not null,
  tipo          text not null,
  calificacion  numeric(4,2) not null check (calificacion >= 0),
  cal_max       numeric(4,2) not null default 10 check (cal_max > 0),
  fecha         date not null default current_date,
  periodo       text,
  created_at    timestamptz not null default now(),
  constraint calificacion_no_excede_max check (calificacion <= cal_max)
);

create index if not exists evaluations_student_idx on evaluations (student_id);
create index if not exists evaluations_materia_idx on evaluations (student_id, materia);

alter table evaluations enable row level security;
create policy "read evaluations" on evaluations for select using (true);

-- Mantiene students.avg_grade y students.status en sync con las evaluaciones.
-- avg_grade se normaliza a escala 10 para que grupos con distinta cal_max sean comparables.
create or replace function public.recalc_student_grade(p_student_id text)
returns void
language plpgsql security definer set search_path = public as $$
declare v_avg numeric;
begin
  select round(avg(calificacion / cal_max * 10), 1) into v_avg
  from evaluations where student_id = p_student_id;

  update students s
  set avg_grade = v_avg,
      status = case
        when v_avg is null then s.status
        when v_avg >= 8.5 then 'excellent'
        when v_avg >= 7.5 then 'good'
        when v_avg >= 7.0 then 'warning'
        when v_avg >= 6.0 then 'at-risk'
        else 'critical'
      end
  where s.id = p_student_id;
end;
$$;

create or replace function public.evaluations_sync_avg()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform recalc_student_grade(coalesce(new.student_id, old.student_id));
  if tg_op = 'UPDATE' and new.student_id is distinct from old.student_id then
    perform recalc_student_grade(old.student_id);
  end if;
  return null;
end;
$$;

drop trigger if exists evaluations_sync_avg_trg on evaluations;
create trigger evaluations_sync_avg_trg
after insert or update or delete on evaluations
for each row execute function public.evaluations_sync_avg();

-- Alta/edición de una evaluación. p_id null → inserta.
create or replace function public.upsert_evaluation(
  p_id uuid, p_student_id text, p_materia text, p_tipo text,
  p_calificacion numeric, p_cal_max numeric default 10,
  p_fecha date default current_date, p_periodo text default null
)
returns table(id uuid, student_id text, materia text, tipo text,
              calificacion numeric, cal_max numeric, fecha date, periodo text)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
begin
  if not exists (select 1 from students s where s.id = p_student_id) then
    raise exception 'student_not_found';
  end if;

  if p_id is null then
    return query
    insert into evaluations (student_id, materia, tipo, calificacion, cal_max, fecha, periodo)
    values (p_student_id, p_materia, p_tipo, p_calificacion, p_cal_max, p_fecha, p_periodo)
    returning evaluations.id, evaluations.student_id, evaluations.materia, evaluations.tipo,
              evaluations.calificacion, evaluations.cal_max, evaluations.fecha, evaluations.periodo;
  else
    return query
    update evaluations e
    set student_id = p_student_id, materia = p_materia, tipo = p_tipo,
        calificacion = p_calificacion, cal_max = p_cal_max,
        fecha = p_fecha, periodo = p_periodo
    where e.id = p_id
    returning e.id, e.student_id, e.materia, e.tipo,
              e.calificacion, e.cal_max, e.fecha, e.periodo;
  end if;
end;
$$;

-- Captura masiva: un arreglo jsonb de evaluaciones (toda la lista de un grupo de una vez).
create or replace function public.upsert_evaluations_bulk(p_rows jsonb)
returns integer
language plpgsql security definer set search_path = public as $$
declare r jsonb; v_count integer := 0;
begin
  for r in select * from jsonb_array_elements(p_rows) loop
    perform upsert_evaluation(
      nullif(r->>'id','')::uuid,
      r->>'studentId',
      r->>'materia',
      r->>'tipo',
      (r->>'calificacion')::numeric,
      coalesce((r->>'calMax')::numeric, 10),
      coalesce((r->>'fecha')::date, current_date),
      r->>'periodo'
    );
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

create or replace function public.delete_evaluation(p_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from evaluations where id = p_id;
end;
$$;

-- ─── GRUPOS ──────────────────────────────────────────────────────────────────
create or replace function public.create_group(
  p_name text, p_subject text, p_schedule text default null,
  p_room text default null, p_color text default '#3b82f6', p_sucursal text default null
)
returns table(id text, name text, subject text, schedule text, room text, color text, sucursal text)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
begin
  return query
  insert into groups (name, subject, schedule, room, color, sucursal)
  values (p_name, p_subject, p_schedule, p_room, p_color, p_sucursal)
  returning groups.id, groups.name, groups.subject, groups.schedule,
            groups.room, groups.color, groups.sucursal;
end;
$$;

create or replace function public.update_group(
  p_id text, p_name text, p_subject text, p_schedule text default null,
  p_room text default null, p_color text default null, p_sucursal text default null
)
returns void
language plpgsql security definer set search_path = public as $$
begin
  update groups
  set name = p_name, subject = p_subject, schedule = p_schedule,
      room = p_room, color = coalesce(p_color, color), sucursal = p_sucursal
  where id = p_id;
  if not found then raise exception 'group_not_found'; end if;
end;
$$;

-- Se bloquea el borrado si el grupo tiene alumnos: evita perder historial por accidente.
create or replace function public.delete_group(p_id text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from students s where s.group_id = p_id) then
    raise exception 'group_has_students';
  end if;
  delete from groups where id = p_id;
end;
$$;

-- ─── ALUMNOS ─────────────────────────────────────────────────────────────────
-- Crea el alumno y su cuenta de acceso en una sola transacción.
create or replace function public.create_student(
  p_name text, p_email text, p_group_id text, p_password text,
  p_tutor_name text default null, p_tutor_email text default null,
  p_tutor_phone text default null, p_sucursal text default null
)
returns table(id text, name text, email text, group_id text)
language plpgsql security definer set search_path = public, extensions as $$
#variable_conflict use_column
declare v_student_id text;
begin
  if p_group_id is not null and not exists (select 1 from groups g where g.id = p_group_id) then
    raise exception 'group_not_found';
  end if;
  if exists (select 1 from users u where lower(u.email) = lower(p_email)) then
    raise exception 'email_already_exists';
  end if;

  insert into students (name, email, group_id, tutor_name, tutor_email, tutor_phone, sucursal)
  values (p_name, p_email, p_group_id, p_tutor_name, p_tutor_email, p_tutor_phone, p_sucursal)
  returning students.id into v_student_id;

  insert into users (id, name, email, password_hash, role, student_id)
  values (v_student_id, p_name, p_email,
          extensions.crypt(p_password, extensions.gen_salt('bf')), 'student', v_student_id);

  return query
  select s.id, s.name, s.email, s.group_id from students s where s.id = v_student_id;
end;
$$;

create or replace function public.update_student(
  p_id text, p_name text, p_email text, p_group_id text,
  p_tutor_name text default null, p_tutor_email text default null,
  p_tutor_phone text default null, p_sucursal text default null
)
returns void
language plpgsql security definer set search_path = public as $$
begin
  update students
  set name = p_name, email = p_email, group_id = p_group_id,
      tutor_name = p_tutor_name, tutor_email = p_tutor_email,
      tutor_phone = p_tutor_phone, sucursal = p_sucursal
  where id = p_id;
  if not found then raise exception 'student_not_found'; end if;

  update users set name = p_name, email = p_email where student_id = p_id;
end;
$$;

-- Borra alumno + cuenta. Las evaluaciones y asistencias caen por cascade.
create or replace function public.delete_student(p_id text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from users where student_id = p_id;
  delete from students where id = p_id;
end;
$$;

-- Reseteo de contraseña (para reponer credenciales de un alumno en el piloto).
create or replace function public.reset_student_password(p_student_id text, p_password text)
returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  update users
  set password_hash = extensions.crypt(p_password, extensions.gen_salt('bf'))
  where student_id = p_student_id;
  if not found then raise exception 'user_not_found'; end if;
end;
$$;

-- ─── PERMISOS ────────────────────────────────────────────────────────────────
revoke all on function public.recalc_student_grade(text) from public;
revoke all on function public.upsert_evaluation(uuid, text, text, text, numeric, numeric, date, text) from public;
revoke all on function public.upsert_evaluations_bulk(jsonb) from public;
revoke all on function public.delete_evaluation(uuid) from public;
revoke all on function public.create_group(text, text, text, text, text, text) from public;
revoke all on function public.update_group(text, text, text, text, text, text, text) from public;
revoke all on function public.delete_group(text) from public;
revoke all on function public.create_student(text, text, text, text, text, text, text, text) from public;
revoke all on function public.update_student(text, text, text, text, text, text, text, text) from public;
revoke all on function public.delete_student(text) from public;
revoke all on function public.reset_student_password(text, text) from public;

grant execute on function public.upsert_evaluation(uuid, text, text, text, numeric, numeric, date, text) to anon, authenticated;
grant execute on function public.upsert_evaluations_bulk(jsonb) to anon, authenticated;
grant execute on function public.delete_evaluation(uuid) to anon, authenticated;
grant execute on function public.create_group(text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.update_group(text, text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.delete_group(text) to anon, authenticated;
grant execute on function public.create_student(text, text, text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.update_student(text, text, text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.delete_student(text) to anon, authenticated;
grant execute on function public.reset_student_password(text, text) to anon, authenticated;
