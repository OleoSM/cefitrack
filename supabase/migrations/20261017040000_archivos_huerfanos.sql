-- Archivos de expedientes y fotos que ya nadie usa: el alumno se borró, el
-- documento se volvió a subir en otro formato o la foto se cambió. Los borra
-- cada hora la función limpiar-materiales (con la Storage API: un DELETE
-- directo sobre storage.objects no está permitido). Solo los de más de 1 hora,
-- para no tocar una subida que va a medio camino.
create or replace function public.archivos_huerfanos()
returns table(bucket text, ruta text)
language sql stable security definer set search_path to 'public' as $$
  select o.bucket_id, o.name
    from storage.objects o
   where o.bucket_id = 'expedientes'
     and coalesce(o.updated_at, o.created_at) < now() - interval '1 hour'
     and not exists (select 1 from student_documents d where d.storage_path = o.name)
  union all
  select o.bucket_id, o.name
    from storage.objects o
   where o.bucket_id = 'fotos-perfil'
     and coalesce(o.updated_at, o.created_at) < now() - interval '1 hour'
     and not exists (select 1 from students s where s.foto_path = o.name)
$$;
revoke all on function public.archivos_huerfanos() from public, anon, authenticated;
grant execute on function public.archivos_huerfanos() to service_role;
