-- Comprobante de inscripción ECOEMS: documento OPCIONAL del expediente, solo
-- para alumnos de grupos ECOEMS. No entra en recalcular_acceso_alumno (no
-- bloquea terminar el proceso).
alter table public.student_documents drop constraint student_documents_document_type_check;
alter table public.student_documents add constraint student_documents_document_type_check
  check (document_type = any (array['curp','ine_tutor','garantia','terminos','comprobante_ecoems']));

create or replace function public.trg_comprobante_solo_ecoems() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.document_type = 'comprobante_ecoems' and not exists (
       select 1 from students s join groups g on g.id = s.group_id
       where s.id = new.student_id and coalesce(g.curso, case when g.institucion = 'ecoems' then 'ecoems' end) = 'ecoems') then
    raise exception 'comprobante_solo_ecoems';
  end if;
  return new;
end $$;
drop trigger if exists comprobante_solo_ecoems on public.student_documents;
create trigger comprobante_solo_ecoems before insert or update of document_type on public.student_documents
  for each row execute function public.trg_comprobante_solo_ecoems();

-- trg_notificar_documento: añade la etiqueta del comprobante (resto igual).
create or replace function public.trg_notificar_documento()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_nombre text; v_doc text;
begin
  select name into v_nombre from public.students where id = new.student_id;
  v_doc := case new.document_type when 'curp' then 'CURP'
                                  when 'ine_tutor' then 'INE del tutor'
                                  when 'garantia' then 'garantia firmada'
                                  when 'comprobante_ecoems' then 'comprobante de inscripcion ECOEMS'
                                  else new.document_type end;
  if tg_op = 'INSERT' then
    perform public.emitir_notificacion(new.student_id,
      'Documento entregado',
      coalesce(v_nombre,'Un alumno') || ' subio su ' || v_doc || '. Falta validarlo.',
      'documento_entregado');
  elsif new.status is distinct from old.status then
    if new.status = 'validado' then
      perform public.emitir_notificacion(new.student_id, 'Documento validado',
        'El ' || v_doc || ' de ' || coalesce(v_nombre,'un alumno') || ' quedo validado.', 'documento_validado');
    elsif new.status = 'rechazado' then
      perform public.emitir_notificacion(new.student_id, 'Documento rechazado',
        'El ' || v_doc || ' de ' || coalesce(v_nombre,'un alumno') || ' fue rechazado'
        || coalesce(': ' || new.rejection_reason, '.'), 'documento_rechazado');
    end if;
  end if;
  return new;
end $$;
