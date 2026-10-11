-- Fase A del cierre de seguridad (auditoria 2026-10-10).
-- Estas RPC no las llama el frontend directamente y no verifican a quien llama.
-- El EXECUTE venia concedido a PUBLIC, por eso hay que revocar de public ademas de anon.
-- Las funciones que las usan por dentro son SECURITY DEFINER con dueno postgres,
-- asi que siguen funcionando.
revoke execute on function public.sincronizar_acceso(text, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.reset_password(text, text)                       from public, anon, authenticated;
revoke execute on function public.login_user(text, text)                           from public, anon, authenticated;
revoke execute on function public.set_celda_registro(text, uuid, numeric)          from public, anon, authenticated;
revoke execute on function public.set_attendance_status(uuid, text, text)          from public, anon, authenticated;
revoke execute on function public.list_cuentas()                                   from public, anon, authenticated;
revoke execute on function public.list_sub_admins()                                from public, anon, authenticated;
