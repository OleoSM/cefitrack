-- Las notificaciones del expediente llegan con `recipient_student_id` puesto y
-- sin `recipient_user_id`: el admin las VE (la política de lectura le da
-- alcance total) pero la de escritura no le incluía, así que "marcar como
-- leída" no fallaba —simplemente no afectaba a ninguna fila— y el punto rojo
-- volvía a aparecer en cuanto se recargaba el panel.
drop policy if exists "marcar notificacion propia" on public.notifications;
create policy "marcar notificacion propia" on public.notifications for update to authenticated
  using (
    recipient_user_id = (select auth.uid())
    or recipient_student_id = (select public.mi_student_id())
    or public.es_admin()
  )
  with check (
    recipient_user_id = (select auth.uid())
    or recipient_student_id = (select public.mi_student_id())
    or public.es_admin()
  );
