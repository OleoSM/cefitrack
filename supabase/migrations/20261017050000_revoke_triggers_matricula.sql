-- Las funciones de trigger de la matrícula no deben poder llamarse por la API.
revoke all on function public.trg_matricula_alumno() from public, anon, authenticated;
revoke all on function public.trg_recalc_cambio_grupo() from public, anon, authenticated;
