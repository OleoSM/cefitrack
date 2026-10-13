-- Foto de perfil del alumno (se toma en "Mi QR"). Son fotos de MENORES:
-- bucket privado y solo las ven el propio alumno y el personal que gestiona a
-- ese alumno (más estricto que `expedientes`, que lee todo el personal).
alter table public.students add column if not exists foto_path text;
alter table public.students add column if not exists foto_actualizada timestamptz;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos-perfil', 'fotos-perfil', false, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.puede_foto_de(p_carpeta text) returns boolean
language sql stable security definer set search_path = public as $$
  select p_carpeta is not null and (p_carpeta = public.mi_student_id() or public.puede_gestionar_alumno(p_carpeta))
$$;
revoke execute on function public.puede_foto_de(text) from public, anon;
grant execute on function public.puede_foto_de(text) to authenticated;

drop policy if exists "fotos perfil lectura" on storage.objects;
create policy "fotos perfil lectura" on storage.objects for select to authenticated
  using (bucket_id = 'fotos-perfil' and public.puede_foto_de((storage.foldername(name))[1]));
drop policy if exists "fotos perfil alta" on storage.objects;
create policy "fotos perfil alta" on storage.objects for insert to authenticated
  with check (bucket_id = 'fotos-perfil' and public.puede_foto_de((storage.foldername(name))[1]));
drop policy if exists "fotos perfil reemplazo" on storage.objects;
create policy "fotos perfil reemplazo" on storage.objects for update to authenticated
  using (bucket_id = 'fotos-perfil' and public.puede_foto_de((storage.foldername(name))[1]))
  with check (bucket_id = 'fotos-perfil' and public.puede_foto_de((storage.foldername(name))[1]));
drop policy if exists "fotos perfil borrado" on storage.objects;
create policy "fotos perfil borrado" on storage.objects for delete to authenticated
  using (bucket_id = 'fotos-perfil' and public.puede_foto_de((storage.foldername(name))[1]));

create or replace function public.set_foto_perfil(p_student_id text, p_path text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.puede_foto_de(p_student_id) then raise exception 'forbidden'; end if;
  if p_path is not null and split_part(p_path, '/', 1) <> p_student_id then raise exception 'ruta_invalida'; end if;
  update public.students set foto_path = p_path, foto_actualizada = now() where id = p_student_id;
  if not found then raise exception 'student_not_found'; end if;
end $$;
revoke execute on function public.set_foto_perfil(text, text) from public, anon;
grant execute on function public.set_foto_perfil(text, text) to authenticated;
