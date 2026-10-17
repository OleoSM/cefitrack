-- Matrícula de 4 dígitos (1000-9999), única en TODAS las sucursales.
--
-- · Se asigna sola al dar de alta (trigger): toma el siguiente número de una
--   secuencia, así que un número no se reutiliza aunque se borre al alumno.
--   Si la secuencia se agota (>9999), rellena el primer hueco libre.
-- · No cambia nunca: ni al editar al alumno ni al moverlo de grupo o sucursal.
-- · Al cambiar de grupo, la sucursal del alumno se toma del grupo nuevo y su
--   promedio se recalcula (solo cuentan las columnas del grupo actual; las
--   calificaciones del grupo anterior quedan guardadas por si regresa).

alter table public.students add column if not exists matricula smallint;
alter table public.students drop constraint if exists students_matricula_rango;
alter table public.students add constraint students_matricula_rango check (matricula between 1000 and 9999);
create unique index if not exists students_matricula_key on public.students (matricula);

create sequence if not exists public.matricula_seq as smallint minvalue 1000 maxvalue 9999 start 1000 no cycle;

create or replace function public.siguiente_matricula()
returns smallint language plpgsql security definer set search_path to 'public' as $$
declare v smallint;
begin
  -- Un solo alta a la vez elige número: evita que dos altas simultáneas choquen.
  perform pg_advisory_xact_lock(hashtext('matricula_alumno'));
  loop
    begin
      v := nextval('matricula_seq');
    exception when sequence_generator_limit_exceeded then
      select g::smallint into v from generate_series(1000, 9999) g
       where not exists (select 1 from students s where s.matricula = g) order by g limit 1;
      if v is null then raise exception 'sin_matriculas_disponibles'; end if;
      return v;
    end;
    exit when not exists (select 1 from students s where s.matricula = v);
  end loop;
  return v;
end $$;
revoke all on function public.siguiente_matricula() from public, anon, authenticated;

create or replace function public.trg_matricula_alumno()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if tg_op = 'INSERT' then
    if new.matricula is null then new.matricula := siguiente_matricula(); end if;
  else
    -- La matrícula es permanente.
    new.matricula := old.matricula;
    if new.group_id is distinct from old.group_id and new.group_id is not null then
      select g.sucursal into new.sucursal from groups g where g.id = new.group_id;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists matricula_alumno on public.students;
create trigger matricula_alumno before insert or update on public.students
  for each row execute function public.trg_matricula_alumno();

create or replace function public.trg_recalc_cambio_grupo()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  perform recalc_student_grade(new.id);
  return null;
end $$;

drop trigger if exists recalc_cambio_grupo on public.students;
create trigger recalc_cambio_grupo after update of group_id on public.students
  for each row when (new.group_id is distinct from old.group_id)
  execute function public.trg_recalc_cambio_grupo();

-- Alumnos que ya existían (el trigger de UPDATE conservaría el null, por eso
-- se apaga un momento).
alter table public.students disable trigger matricula_alumno;
update public.students s set matricula = public.siguiente_matricula()
 where s.id in (select id from public.students where matricula is null order by created_at, id);
alter table public.students enable trigger matricula_alumno;
alter table public.students alter column matricula set not null;
