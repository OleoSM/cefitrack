-- Reseteo de la firma de términos, para que Gestión de T&C escriba en BD
-- en vez de solo en memoria.
create or replace function public.reset_terms(p_student_id text)
returns table(terms_status text, signed_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  return query
  update students s
  set terms_status = 'pendiente', signed_at = null
  where s.id = p_student_id
  returning s.terms_status, s.signed_at;
end;
$$;

revoke all on function public.reset_terms(text) from public;
grant execute on function public.reset_terms(text) to anon, authenticated;
