-- Mantiene sincronizadas las calificaciones y asistencias entre el panel
-- administrativo y el portal del alumno mediante Postgres Changes.
do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'evaluations',
    'attendance_sessions',
    'attendance_records',
    'registro_columnas'
  ]
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = v_table
    ) then
      execute format(
        'alter publication supabase_realtime add table public.%I',
        v_table
      );
    end if;
  end loop;
end
$$;
