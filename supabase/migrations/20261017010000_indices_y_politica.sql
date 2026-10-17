-- Auditoría 2026-10-17 (rendimiento): índices para los vínculos más usados en
-- filtros y uniones, y política de sub_admin_access sin reevaluar auth.uid()
-- por cada fila.
create index if not exists students_group_id_idx on public.students (group_id);
create index if not exists attendance_records_student_idx on public.attendance_records (student_id);
create index if not exists evaluations_columna_idx on public.evaluations (columna_id);
create index if not exists email_envios_draft_idx on public.email_envios (draft_id);
create index if not exists email_envios_student_idx on public.email_envios (student_id);
create index if not exists avisos_enviados_draft_idx on public.avisos_enviados (draft_id);
create index if not exists registro_columnas_requisito_idx on public.registro_columnas (requisito_id);
create index if not exists materiales_columna_idx on public.materiales (columna_id);
create index if not exists sub_admin_access_user_idx on public.sub_admin_access (user_id);

alter policy "leer accesos" on public.sub_admin_access
  using (public.es_admin() or user_id = (select auth.uid()));
