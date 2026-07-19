create extension if not exists pgcrypto;

create table groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  subject text not null,
  schedule text,
  room text,
  color text,
  created_at timestamptz not null default now()
);

create table students (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text unique not null,
  group_id uuid references groups(id) on delete set null,
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
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text unique not null,
  password text not null,
  role text not null check (role in ('admin','student')),
  student_id uuid references students(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  session_date date not null,
  token text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create table attendance_records (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references attendance_sessions(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  status text not null check (status in ('presente','tardanza','ausente','justificado')),
  scanned_at timestamptz not null default now(),
  unique (session_id, student_id)
);

alter table groups enable row level security;
alter table students enable row level security;
alter table users enable row level security;
alter table attendance_sessions enable row level security;
alter table attendance_records enable row level security;

-- Dev-stage permissive policies: app has no auth wired to Supabase yet.
-- Tighten these (scope to auth.uid()) once real authentication is connected.
create policy "dev read groups" on groups for select using (true);
create policy "dev read students" on students for select using (true);
create policy "dev read users" on users for select using (true);
create policy "dev all attendance_sessions" on attendance_sessions for all using (true) with check (true);
create policy "dev all attendance_records" on attendance_records for all using (true) with check (true);
