-- La garantía del curso requiere solamente la firma del alumno.
create or replace function public.recalcular_acceso_alumno(p_student_id text)
returns text language plpgsql security definer set search_path = public as $$
declare v_ready boolean; v_state text;
begin
  select s.terms_status = 'firmado'
    and s.garantia_aceptada
    and s.garantia_firma_alumno is not null
    and s.garantia_estado = 'validada'
    and (select count(*) = 2 from public.student_documents d
         where d.student_id=s.id and d.document_type in ('curp','ine_tutor') and d.status='validado')
  into v_ready from public.students s where s.id=p_student_id;
  v_state := case when coalesce(v_ready,false) then 'activo' else 'pendiente' end;
  update public.students set acceso_estado=v_state where id=p_student_id and acceso_estado is distinct from v_state;
  return v_state;
end $$;

create or replace function public.guardar_garantia(
  p_student_id text, p_aceptada boolean, p_firma_alumno text, p_firma_tutor text default null
) returns text language plpgsql security definer set search_path=public as $$
begin
  if not public.es_personal() and p_student_id is distinct from (select public.mi_student_id()) then raise exception 'forbidden'; end if;
  if not coalesce(p_aceptada,false) or p_firma_alumno not like 'data:image/png;base64,%' then raise exception 'garantia_incompleta'; end if;
  update public.students set garantia_aceptada=true, garantia_firma_alumno=p_firma_alumno,
    garantia_firma_tutor=null, garantia_estado='entregada' where id=p_student_id;
  return public.recalcular_acceso_alumno(p_student_id);
end $$;

create or replace function public.validar_garantia(p_student_id text)
returns text language plpgsql security definer set search_path=public as $$
begin
  if not public.es_personal() then raise exception 'forbidden'; end if;
  update public.students set garantia_estado='validada' where id=p_student_id
    and garantia_aceptada and garantia_firma_alumno is not null;
  if not found then raise exception 'garantia_incompleta'; end if;
  return public.recalcular_acceso_alumno(p_student_id);
end $$;

-- La tabla es `attendance_records`, no `attendance`: con el nombre equivocado
-- la migracion entera abortaba y ni siquiera llegaban a crearse las funciones
-- de garantia de arriba.
update public.attendance_records set status='ausente' where status='justificado';
alter table public.attendance_records drop constraint if exists attendance_records_status_check;
alter table public.attendance_records add constraint attendance_records_status_check
  check (status in ('presente','tardanza','ausente'));

revoke execute on function public.recalcular_acceso_alumno(text),
  public.guardar_garantia(text,boolean,text,text), public.validar_garantia(text) from public, anon;
grant execute on function public.guardar_garantia(text,boolean,text,text),
  public.validar_garantia(text) to authenticated;
