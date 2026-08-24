-- "subir tambien la garantia": hasta ahora la garantia solo existia como dos
-- firmas dibujadas en pantalla. Quien la firma en papel no tenia forma de
-- entregarla. Se admite como un tercer documento del expediente, y cualquiera
-- de las dos vias —firma digital o archivo validado— la da por entregada.

alter table public.student_documents drop constraint if exists student_documents_document_type_check;
alter table public.student_documents add constraint student_documents_document_type_check
  check (document_type in ('curp','ine_tutor','garantia'));

create or replace function public.trg_garantia_desde_documento()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.document_type <> 'garantia' then return new; end if;
  if new.status = 'validado' then
    update public.students set garantia_aceptada = true, garantia_estado = 'validada'
      where id = new.student_id and garantia_estado is distinct from 'validada';
  elsif new.status = 'entregado' then
    update public.students set garantia_estado = 'entregada'
      where id = new.student_id and garantia_estado = 'pendiente';
  end if;
  return new;
end $$;
drop trigger if exists garantia_desde_documento on public.student_documents;
create trigger garantia_desde_documento after insert or update on public.student_documents
for each row execute function public.trg_garantia_desde_documento();
revoke execute on function public.trg_garantia_desde_documento() from public, anon, authenticated;

-- El acceso se activa con CURP + INE validados, terminos firmados y garantia
-- validada. La garantia vale por firmas digitales O por archivo validado, pero
-- las firmas ya no son obligatorias si el archivo esta validado.
create or replace function public.recalcular_acceso_alumno(p_student_id text)
returns text language plpgsql security definer set search_path = public as $$
declare v_ready boolean; v_state text;
begin
  select s.terms_status = 'firmado'
    and s.garantia_estado = 'validada'
    and (
      (s.garantia_firma_alumno is not null and s.garantia_firma_tutor is not null)
      or exists (select 1 from public.student_documents d
                 where d.student_id = s.id and d.document_type = 'garantia' and d.status = 'validado')
    )
    and (select count(*) = 2 from public.student_documents d
         where d.student_id=s.id and d.document_type in ('curp','ine_tutor') and d.status='validado')
  into v_ready from public.students s where s.id=p_student_id;
  v_state := case when coalesce(v_ready,false) then 'activo' else 'pendiente' end;
  update public.students set acceso_estado=v_state where id=p_student_id and acceso_estado is distinct from v_state;
  return v_state;
end $$;

-- Validar la garantia por archivo tambien debe poder hacerse sin firmas.
create or replace function public.validar_garantia(p_student_id text)
returns text language plpgsql security definer set search_path=public as $$
begin
  if not public.es_personal() then raise exception 'forbidden'; end if;
  update public.students set garantia_aceptada = true, garantia_estado='validada'
   where id=p_student_id
     and (
       (garantia_firma_alumno is not null and garantia_firma_tutor is not null)
       or exists (select 1 from public.student_documents d
                  where d.student_id = p_student_id and d.document_type='garantia' and d.status in ('entregado','validado'))
     );
  if not found then raise exception 'garantia_incompleta'; end if;
  update public.student_documents set status='validado', validated_by=(select auth.uid()), validated_at=now(), updated_at=now()
   where student_id=p_student_id and document_type='garantia' and status='entregado';
  return public.recalcular_acceso_alumno(p_student_id);
end $$;
revoke execute on function public.validar_garantia(text) from public, anon;
grant execute on function public.validar_garantia(text) to authenticated;
