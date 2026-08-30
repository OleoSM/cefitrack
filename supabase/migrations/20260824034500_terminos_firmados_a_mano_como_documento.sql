-- El portal ofrecía descargar los T&C, firmarlos a mano y volver a subirlos,
-- pero ese PDF no salía del navegador: se perdía al recargar. Ahora es un
-- documento más del expediente, revisable desde T&C / Firmas como los demás.
alter table public.student_documents drop constraint if exists student_documents_document_type_check;
alter table public.student_documents add constraint student_documents_document_type_check
  check (document_type in ('curp','ine_tutor','garantia','terminos'));
