-- Las notificaciones existian como tabla y como panel, pero nadie las creaba:
-- el panel siempre estaba vacio. Estos disparadores las emiten desde los
-- eventos reales, que es lo unico que las hace llegar en tiempo real.

create or replace function public.emitir_notificacion(
  p_student_id text, p_title text, p_body text, p_event_type text
) returns void language plpgsql security definer set search_path=public as $$
begin
  insert into public.notifications(recipient_student_id, title, body, event_type, created_by)
  values (p_student_id, p_title, p_body, p_event_type, auth.uid());
end $$;
revoke execute on function public.emitir_notificacion(text,text,text,text) from public, anon, authenticated;

create or replace function public.trg_notificar_documento()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_nombre text; v_doc text;
begin
  select name into v_nombre from public.students where id = new.student_id;
  v_doc := case new.document_type when 'curp' then 'CURP'
                                  when 'ine_tutor' then 'INE del tutor'
                                  when 'garantia' then 'garantia firmada'
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
drop trigger if exists notificar_documento on public.student_documents;
create trigger notificar_documento after insert or update on public.student_documents
for each row execute function public.trg_notificar_documento();

create or replace function public.trg_notificar_expediente_alumno()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.terms_status = 'firmado' and old.terms_status is distinct from 'firmado' then
    perform public.emitir_notificacion(new.id, 'Terminos firmados',
      new.name || ' firmo los terminos y condiciones.', 'terminos_firmados');
  end if;
  if new.garantia_estado is distinct from old.garantia_estado then
    if new.garantia_estado = 'entregada' then
      perform public.emitir_notificacion(new.id, 'Garantia entregada',
        new.name || ' entrego la garantia firmada. Falta validarla.', 'garantia_entregada');
    elsif new.garantia_estado = 'validada' then
      perform public.emitir_notificacion(new.id, 'Garantia validada',
        'La garantia de ' || new.name || ' quedo validada.', 'garantia_validada');
    end if;
  end if;
  if new.acceso_estado = 'activo' and old.acceso_estado is distinct from 'activo' then
    perform public.emitir_notificacion(new.id, 'Acceso activado',
      new.name || ' completo su expediente: documentos, firma y garantia validados.', 'acceso_activado');
  end if;
  return new;
end $$;
drop trigger if exists notificar_expediente_alumno on public.students;
create trigger notificar_expediente_alumno after update of terms_status, garantia_estado, acceso_estado
on public.students for each row execute function public.trg_notificar_expediente_alumno();

create or replace function public.trg_notificar_pago()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_nombre text;
begin
  select name into v_nombre from public.students where id = new.student_id;
  perform public.emitir_notificacion(new.student_id, 'Pago registrado',
    coalesce(v_nombre,'Un alumno') || ' — ' || coalesce(new.concepto,'Pago de curso')
    || ' por $' || to_char(new.monto,'FM999G999D00') || '.', 'pago_registrado');
  return new;
end $$;
drop trigger if exists notificar_pago on public.pagos;
create trigger notificar_pago after insert on public.pagos
for each row execute function public.trg_notificar_pago();

revoke execute on function public.trg_notificar_documento(), public.trg_notificar_expediente_alumno(),
  public.trg_notificar_pago() from public, anon, authenticated;
