alter table groups add column sucursal text check (sucursal in ('CN1','CN2','CN3'));
alter table students add column sucursal text check (sucursal in ('CN1','CN2','CN3'));

update groups set sucursal = case id when 'g1' then 'CN1' when 'g2' then 'CN2' when 'g3' then 'CN3' end;
update students s set sucursal = g.sucursal from groups g where g.id = s.group_id;

alter table users drop constraint users_role_check;
alter table users add constraint users_role_check check (role = any (array['admin','student','sub_admin']));

create table sub_admin_access (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references users(id) on delete cascade,
  sucursal text not null check (sucursal in ('CN1','CN2','CN3')),
  group_id text references groups(id) on delete cascade,
  created_at timestamptz not null default now()
);
create unique index sub_admin_access_branch_uidx on sub_admin_access(user_id, sucursal) where group_id is null;
create unique index sub_admin_access_group_uidx on sub_admin_access(user_id, sucursal, group_id) where group_id is not null;

alter table sub_admin_access enable row level security;
create policy "dev all sub_admin_access" on sub_admin_access for all using (true) with check (true);

create or replace function create_user_with_password(p_name text, p_email text, p_password text, p_role text)
returns table(id text, name text, email text, role text)
language plpgsql security definer set search_path to 'public','extensions' as $$
begin
  if p_role not in ('admin','student','sub_admin') then
    raise exception 'invalid role';
  end if;
  return query
  insert into users (name, email, password_hash, role)
  values (p_name, p_email, extensions.crypt(p_password, extensions.gen_salt('bf')), p_role)
  returning users.id, users.name, users.email, users.role;
end;
$$;

create or replace function list_sub_admins()
returns table(id text, name text, email text, created_at timestamptz)
language sql security definer set search_path to 'public','extensions' as $$
  select id, name, email, created_at from users where role = 'sub_admin' order by created_at;
$$;
