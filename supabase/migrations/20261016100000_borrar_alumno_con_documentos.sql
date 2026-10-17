-- No se podía eliminar a ningún alumno que hubiera subido un documento de su
-- expediente: student_documents.uploaded_by apunta a su cuenta (auth.users)
-- sin regla de borrado, y delete_student borraba la cuenta primero.
-- 1) Los vínculos "quién lo hizo" hacia auth.users pasan a ON DELETE SET NULL
--    (el registro se conserva; solo se pierde el autor de una cuenta borrada).
-- 2) delete_student borra primero al alumno (y en cascada su expediente) y
--    después su cuenta de acceso.

alter table public.student_documents alter column uploaded_by drop not null;
alter table public.terms_documents   alter column uploaded_by drop not null;

alter table public.student_documents drop constraint student_documents_uploaded_by_fkey,
  add constraint student_documents_uploaded_by_fkey foreign key (uploaded_by) references auth.users(id) on delete set null;
alter table public.student_documents drop constraint student_documents_validated_by_fkey,
  add constraint student_documents_validated_by_fkey foreign key (validated_by) references auth.users(id) on delete set null;
alter table public.terms_documents drop constraint terms_documents_uploaded_by_fkey,
  add constraint terms_documents_uploaded_by_fkey foreign key (uploaded_by) references auth.users(id) on delete set null;
alter table public.registro_valores drop constraint registro_valores_updated_by_fkey,
  add constraint registro_valores_updated_by_fkey foreign key (updated_by) references auth.users(id) on delete set null;
alter table public.notifications drop constraint notifications_created_by_fkey,
  add constraint notifications_created_by_fkey foreign key (created_by) references auth.users(id) on delete set null;
alter table public.email_drafts drop constraint email_drafts_created_by_fkey,
  add constraint email_drafts_created_by_fkey foreign key (created_by) references auth.users(id) on delete set null;

create or replace function public.delete_student(p_id text) returns void
language plpgsql security definer set search_path = public as $$
declare v_cuentas uuid[];
begin
  if not public.puede_dar_altas() then raise exception 'sin_permiso_altas'; end if;
  if not public.puede_gestionar_alumno(p_id) then raise exception 'forbidden'; end if;
  select array_agg(pr.id) into v_cuentas from public.profiles pr where pr.student_id = p_id;
  delete from users where student_id = p_id;
  delete from students where id = p_id;              -- en cascada: expediente, notas, pagos…
  delete from auth.users where id = any(coalesce(v_cuentas, '{}'));
end $$;
