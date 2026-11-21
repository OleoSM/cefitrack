-- Regla de negocio (2026-11-20): un T&C nuevo obliga a TODOS a firmar de nuevo.
--
-- · students.terms_version guarda qué versión del T&C firmó el alumno.
-- · Al publicar (activar) una versión nueva del T&C, las firmas vigentes se
--   ARCHIVAN en firmas_terminos_historial (no se pierde la evidencia) y el
--   alumno vuelve a "pendiente".

alter table public.students add column if not exists terms_version integer;

create table if not exists public.firmas_terminos_historial (
  id                 uuid primary key default gen_random_uuid(),
  student_id         text not null,
  version            integer,
  signed_at          timestamptz,
  signature_data_url text,
  archivada_at       timestamptz not null default now(),
  motivo             text not null default 'nueva_version'
);
create index if not exists firmas_terminos_historial_alumno_idx on public.firmas_terminos_historial (student_id);
alter table public.firmas_terminos_historial enable row level security;
drop policy if exists firmas_terminos_historial_select on public.firmas_terminos_historial;
create policy firmas_terminos_historial_select on public.firmas_terminos_historial
  for select to authenticated
  using (public.es_admin()
         or student_id = public.mi_student_id()
         or public.puede_ver_grupo((select group_id from public.students where id = student_id)));

create or replace function public.sign_terms(p_student_id text, p_signature_data_url text)
 RETURNS TABLE(terms_status text, signed_at timestamp with time zone, signature_data_url text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if auth.uid() is null or public.mi_student_id() is distinct from p_student_id then
    raise exception 'forbidden';
  end if;
  if p_signature_data_url is null
     or p_signature_data_url not like 'data:image/png;base64,%'
     or length(p_signature_data_url) > 1000000 then
    raise exception 'invalid_signature';
  end if;
  return query
  update public.students s
     set terms_status = 'firmado',
         signed_at = now(),
         signature_data_url = p_signature_data_url,
         terms_version = (select d.version from public.terms_documents d where d.tipo = 'tyc' and d.is_active limit 1)
   where s.id = p_student_id
  returning s.terms_status, s.signed_at, s.signature_data_url;
end;
$function$;

create or replace function public.trg_tyc_nueva_version()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.tipo <> 'tyc' or not new.is_active then return new; end if;
  if tg_op = 'UPDATE' and old.is_active then return new; end if;

  insert into firmas_terminos_historial (student_id, version, signed_at, signature_data_url)
  select s.id, s.terms_version, s.signed_at, s.signature_data_url
    from students s
   where s.terms_status = 'firmado' and s.terms_version is distinct from new.version;

  update students
     set terms_status = 'pendiente', signed_at = null, signature_data_url = null, terms_version = null
   where terms_status = 'firmado' and terms_version is distinct from new.version;

  return new;
end;
$$;

drop trigger if exists tyc_nueva_version on public.terms_documents;
create trigger tyc_nueva_version
  after insert or update of is_active on public.terms_documents
  for each row execute function public.trg_tyc_nueva_version();
