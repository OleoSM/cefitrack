create or replace function public.login_user(p_email text, p_password text)
returns table (id text, name text, email text, role text, student_id text)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  return query
  select u.id, u.name, u.email, u.role, u.student_id
  from users u
  where u.email = p_email
    and u.password_hash = extensions.crypt(p_password, u.password_hash);
end;
$$;

update users set password_hash = extensions.crypt('123456', extensions.gen_salt('bf'));
