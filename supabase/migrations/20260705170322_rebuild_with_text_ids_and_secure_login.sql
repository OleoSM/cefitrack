drop table if exists attendance_records;
drop table if exists attendance_sessions;
drop table if exists users;
drop table if exists students;
drop table if exists groups;

create extension if not exists pgcrypto;

-- ids are text and match the ones already used by the frontend's mock data
-- (g1/g2/g3, s1..s20) so pages not yet migrated off mockData keep working
-- by id when cross-referencing (StudentProfile, useGroupColors defaults, etc).
create table groups (
  id text primary key,
  name text not null,
  subject text not null,
  schedule text,
  room text,
  color text,
  created_at timestamptz not null default now()
);

create table students (
  id text primary key,
  name text not null,
  email text unique not null,
  group_id text references groups(id) on delete set null,
  tutor_name text,
  tutor_email text,
  tutor_phone text,
  attendance_rate numeric,
  avg_grade numeric,
  assignments_done int,
  assignments_total int,
  rank int,
  status text,
  terms_status text default 'pendiente',
  signed_at timestamptz,
  wa_added boolean default false,
  created_at timestamptz not null default now()
);

create table users (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  email text unique not null,
  password_hash text not null,
  role text not null check (role in ('admin','student')),
  student_id text references students(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  group_id text not null references groups(id) on delete cascade,
  session_date date not null,
  token text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create table attendance_records (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references attendance_sessions(id) on delete cascade,
  student_id text not null references students(id) on delete cascade,
  status text not null check (status in ('presente','tardanza','ausente','justificado')),
  scanned_at timestamptz not null default now(),
  unique (session_id, student_id)
);

alter table groups enable row level security;
alter table students enable row level security;
alter table users enable row level security;
alter table attendance_sessions enable row level security;
alter table attendance_records enable row level security;

-- Roster data: fine to read publicly at this dev stage (no sensitive auth data).
create policy "dev read groups" on groups for select using (true);
create policy "dev read students" on students for select using (true);
create policy "dev all attendance_sessions" on attendance_sessions for all using (true) with check (true);
create policy "dev all attendance_records" on attendance_records for all using (true) with check (true);

-- users table: NO direct select policy. Nobody can read password_hash directly
-- (anon or authenticated) — the only way in is the SECURITY DEFINER RPC below.

-- Secure login: verifies password against the bcrypt hash server-side and
-- returns only the safe fields the frontend needs, never the hash itself.
create or replace function public.login_user(p_email text, p_password text)
returns table (id text, name text, email text, role text, student_id text)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select u.id, u.name, u.email, u.role, u.student_id
  from users u
  where u.email = p_email
    and u.password_hash = crypt(p_password, u.password_hash);
end;
$$;

revoke all on function public.login_user(text, text) from public;
grant execute on function public.login_user(text, text) to anon, authenticated;
