-- La firma digital pertenece al expediente del alumno. Se guarda como PNG
-- transparente para poder mostrarla nuevamente y estampar el PDF oficial.
alter table public.students
  add column if not exists signature_data_url text;

do $$
declare v_table text;
begin
  foreach v_table in array array['students', 'groups'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public' and tablename = v_table
    ) then
      execute format('alter publication supabase_realtime add table public.%I', v_table);
    end if;
  end loop;
end
$$;

-- Sustituye el RPC anterior, que sólo marcaba el estado y aceptaba cualquier
-- student_id, por una operación ligada al alumno de la sesión.
drop function if exists public.sign_terms(text);

create function public.sign_terms(p_student_id text, p_signature_data_url text)
returns table(terms_status text, signed_at timestamptz, signature_data_url text)
language plpgsql
security definer
set search_path = public
as $$
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
         signature_data_url = p_signature_data_url
   where s.id = p_student_id
  returning s.terms_status, s.signed_at, s.signature_data_url;
end;
$$;

revoke all on function public.sign_terms(text, text) from public;
grant execute on function public.sign_terms(text, text) to authenticated;

-- Al invalidar la aceptación también se elimina la firma asociada.
create or replace function public.reset_terms(p_student_id text)
returns table(terms_status text, signed_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not public.es_admin() and not public.puede_ver_grupo(
    (select group_id from public.students where id = p_student_id)
  ) then
    raise exception 'forbidden';
  end if;

  return query
  update public.students s
     set terms_status = 'pendiente', signed_at = null, signature_data_url = null
   where s.id = p_student_id
  returning s.terms_status, s.signed_at;
end;
$$;
