-- Comprobante de examen UNAM: opcional (como el de ECOEMS), no bloquea el expediente.
alter table public.student_documents drop constraint student_documents_document_type_check;
alter table public.student_documents add constraint student_documents_document_type_check
  check (document_type = any (array['curp','ine_tutor','garantia','terminos','comprobante_ecoems','comprobante_unam']));
