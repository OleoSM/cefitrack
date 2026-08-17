-- Expediente documental, estructura academica, plantilla base y comunicaciones.
-- Todos los datos expuestos por Data API tienen RLS y grants explicitos.

alter table public.students
  add column if not exists personal_email text,
  add column if not exists whatsapp text,
  add column if not exists tutor_whatsapp text,
  add column if not exists universidad_area smallint,
  add column if not exists garantia_aceptada boolean not null default false,
  add column if not exists garantia_firma_alumno text,
  add column if not exists garantia_firma_tutor text,
  add column if not exists garantia_estado text not null default 'pendiente',
  add column if not exists acceso_estado text not null default 'pendiente';

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'students_universidad_area_check') then
    alter table public.students add constraint students_universidad_area_check
      check (universidad_area is null or universidad_area between 1 and 4);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'students_garantia_estado_check') then
    alter table public.students add constraint students_garantia_estado_check
      check (garantia_estado in ('pendiente','entregada','validada'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'students_acceso_estado_check') then
    alter table public.students add constraint students_acceso_estado_check
      check (acceso_estado in ('pendiente','activo'));
  end if;
end $$;

alter table public.groups
  add column if not exists curso text not null default 'ecoems',
  add column if not exists instituciones text[] not null default '{}';

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'groups_curso_check') then
    alter table public.groups add constraint groups_curso_check check (curso in ('ecoems','universidad'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'groups_instituciones_check') then
    alter table public.groups add constraint groups_instituciones_check
      check (instituciones <@ array['unam','uam','ipn']::text[]);
  end if;
end $$;

update public.groups
set curso = case when institucion = 'ecoems' or institucion is null then 'ecoems' else 'universidad' end,
    instituciones = case when institucion in ('unam','uam','ipn') then array[institucion] else '{}' end;

create table if not exists public.student_documents (
  id uuid primary key default gen_random_uuid(),
  student_id text not null references public.students(id) on delete cascade,
  document_type text not null check (document_type in ('curp','ine_tutor')),
  storage_path text not null,
  file_name text not null,
  mime_type text,
  status text not null default 'entregado' check (status in ('entregado','validado','rechazado')),
  rejection_reason text,
  uploaded_by uuid not null default auth.uid() references auth.users(id),
  validated_by uuid references auth.users(id),
  validated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, document_type)
);
create index if not exists student_documents_student_idx on public.student_documents(student_id);
alter table public.student_documents enable row level security;

create policy "documentos lectura expediente" on public.student_documents for select to authenticated
  using (public.es_personal() or student_id = (select public.mi_student_id()));
create policy "documentos carga expediente" on public.student_documents for insert to authenticated
  with check (public.es_personal() or student_id = (select public.mi_student_id()));
create policy "personal actualiza documentos" on public.student_documents for update to authenticated
  using (public.es_personal()) with check (public.es_personal());
create policy "alumno reemplaza documentos" on public.student_documents for update to authenticated
  using (student_id = (select public.mi_student_id()))
  with check (student_id = (select public.mi_student_id()) and status = 'entregado' and validated_by is null);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('expedientes', 'expedientes', false, 10485760,
        array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = excluded.public,
  file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "expedientes lectura" on storage.objects for select to authenticated
  using (bucket_id = 'expedientes' and
    (public.es_personal() or (storage.foldername(name))[1] = (select public.mi_student_id())));
create policy "expedientes alta" on storage.objects for insert to authenticated
  with check (bucket_id = 'expedientes' and
    (public.es_personal() or (storage.foldername(name))[1] = (select public.mi_student_id())));
create policy "expedientes reemplazo" on storage.objects for update to authenticated
  using (bucket_id = 'expedientes' and
    (public.es_personal() or (storage.foldername(name))[1] = (select public.mi_student_id())))
  with check (bucket_id = 'expedientes' and
    (public.es_personal() or (storage.foldername(name))[1] = (select public.mi_student_id())));

alter table public.registro_columnas
  add column if not exists bloque text not null default 'seccion',
  add column if not exists es_fija boolean not null default false;

create table if not exists public.terms_documents (
  id uuid primary key default gen_random_uuid(),
  version integer not null,
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null default 'application/pdf',
  is_active boolean not null default true,
  uploaded_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);
create unique index if not exists terms_documents_one_active_idx
  on public.terms_documents(is_active) where is_active;
alter table public.terms_documents enable row level security;
create policy "usuarios leen tyc activo" on public.terms_documents for select to authenticated
  using (is_active or public.es_personal());
create policy "personal publica tyc" on public.terms_documents for insert to authenticated
  with check (public.es_personal());
create policy "personal actualiza tyc" on public.terms_documents for update to authenticated
  using (public.es_personal()) with check (public.es_personal());

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('terminos','terminos',false,15728640,array['application/pdf'])
on conflict (id) do update set public=false,file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;
create policy "usuarios leen tyc" on storage.objects for select to authenticated
  using (bucket_id='terminos');
create policy "personal sube tyc" on storage.objects for insert to authenticated
  with check (bucket_id='terminos' and public.es_personal());
create policy "personal reemplaza tyc" on storage.objects for update to authenticated
  using (bucket_id='terminos' and public.es_personal())
  with check (bucket_id='terminos' and public.es_personal());

create table if not exists public.registro_valores (
  student_id text not null references public.students(id) on delete cascade,
  columna_id uuid not null references public.registro_columnas(id) on delete cascade,
  valor text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  primary key(student_id,columna_id)
);
create index if not exists registro_valores_columna_idx on public.registro_valores(columna_id);
alter table public.registro_valores enable row level security;
create policy "leer valores registro" on public.registro_valores for select to authenticated
  using (student_id=(select public.mi_student_id()) or public.es_personal());

insert into public.registro_valores(student_id,columna_id,valor)
select student_id,columna_id,calificacion::text from public.evaluations where columna_id is not null
on conflict(student_id,columna_id) do nothing;

create or replace function public.set_valor_registro(p_student_id text,p_columna_id uuid,p_valor text)
returns void language plpgsql security definer set search_path=public as $$
declare v_group text; v_clean text:=upper(trim(coalesce(p_valor,''))); v_num numeric;
begin
  select group_id into v_group from public.registro_columnas where id=p_columna_id;
  if not public.es_admin() and not public.puede_ver_grupo(v_group) then raise exception 'forbidden'; end if;
  if v_clean='' then
    delete from public.registro_valores where student_id=p_student_id and columna_id=p_columna_id;
    perform public.set_celda_registro(p_student_id,p_columna_id,null);
  elsif v_clean='NP' then
    insert into public.registro_valores(student_id,columna_id,valor,updated_by) values(p_student_id,p_columna_id,'NP',(select auth.uid()))
    on conflict(student_id,columna_id) do update set valor='NP',updated_at=now(),updated_by=(select auth.uid());
    perform public.set_celda_registro(p_student_id,p_columna_id,null);
  else
    begin v_num:=v_clean::numeric; exception when invalid_text_representation then raise exception 'invalid_grade'; end;
    insert into public.registro_valores(student_id,columna_id,valor,updated_by) values(p_student_id,p_columna_id,v_num::text,(select auth.uid()))
    on conflict(student_id,columna_id) do update set valor=excluded.valor,updated_at=now(),updated_by=(select auth.uid());
    perform public.set_celda_registro(p_student_id,p_columna_id,v_num);
  end if;
end $$;
grant select on public.registro_valores to authenticated;
revoke execute on function public.set_valor_registro(text,uuid,text) from public,anon;
grant execute on function public.set_valor_registro(text,uuid,text) to authenticated;

create or replace function public.asegurar_plantilla_base(p_group_id text)
returns void language plpgsql security definer set search_path = public as $$
declare v_specs text[][] := array[
  array['Tareas','Tarea 1','tarea'], array['Tareas','Tarea 2','tarea'], array['Tareas','Tarea 3','tarea'],
  array['Simulacros','Simulacro 1','simulacro'], array['Simulacros','Simulacro 2','simulacro'], array['Simulacros','Simulacro 3','simulacro'],
  array['Examenes digitales','Digital 1','digital'], array['Examenes digitales','Digital 2','digital'],
  array['Examenes digitales','Digital 3','digital'], array['Examenes digitales','Digital 4','digital'],
  array['Examenes digitales','Digital 5','digital'], array['Examen general','Examen general','general']
];
declare v text[]; v_order integer := 0;
begin
  if auth.uid() is not null and not public.puede_ver_grupo(p_group_id) and not public.es_admin() then raise exception 'forbidden'; end if;
  foreach v slice 1 in array v_specs loop
    v_order := v_order + 1;
    if not exists (select 1 from public.registro_columnas where group_id=p_group_id and materia=v[1] and nombre=v[2]) then
      insert into public.registro_columnas(group_id,materia,materia_orden,materia_color,nombre,tipo,cal_max,orden,bloque,es_fija)
      values(p_group_id,v[1],v_order,case v[3] when 'tarea' then '#2B5F9E' when 'simulacro' then '#8A5A12' else '#5D3E90' end,
             v[2],v[3],10,v_order,v[3],true);
    end if;
  end loop;
end $$;

create or replace function public.trg_plantilla_base_grupo()
returns trigger language plpgsql security definer set search_path=public as $$
begin perform public.asegurar_plantilla_base(new.id); return new; end $$;
create trigger plantilla_base_nuevo_grupo after insert on public.groups
for each row execute function public.trg_plantilla_base_grupo();

do $$ declare g record; begin
  for g in select id from public.groups loop perform public.asegurar_plantilla_base(g.id); end loop;
end $$;

create or replace function public.borrar_columna_registro(p_columna_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.registro_columnas where id=p_columna_id and es_fija) then
    raise exception 'fixed_column';
  end if;
  delete from public.registro_columnas where id=p_columna_id;
  if not found then raise exception 'column_not_found'; end if;
end $$;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid references auth.users(id) on delete cascade,
  recipient_student_id text references public.students(id) on delete cascade,
  title text not null,
  body text not null,
  event_type text not null default 'manual',
  read_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_unread_idx on public.notifications(recipient_user_id, read_at);
create index if not exists notifications_student_idx on public.notifications(recipient_student_id);
alter table public.notifications enable row level security;
create policy "notificaciones propias" on public.notifications for select to authenticated
  using (recipient_user_id = (select auth.uid()) or recipient_student_id = (select public.mi_student_id()) or public.es_admin());
create policy "admin crea notificaciones" on public.notifications for insert to authenticated
  with check (public.es_admin() and created_by = (select auth.uid()));
create policy "marcar notificacion propia" on public.notifications for update to authenticated
  using (recipient_user_id = (select auth.uid()) or recipient_student_id = (select public.mi_student_id()))
  with check (recipient_user_id = (select auth.uid()) or recipient_student_id = (select public.mi_student_id()));

create table if not exists public.email_drafts (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  body text not null,
  student_ids text[] not null default '{}',
  include_student boolean not null default true,
  include_tutor boolean not null default true,
  status text not null default 'draft' check(status in ('draft','pending','sent','failed')),
  created_by uuid not null default auth.uid() references auth.users(id),
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.email_drafts enable row level security;
create policy "admin gestiona correos" on public.email_drafts for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

alter table public.pagos add column if not exists concepto text not null default 'Pago de curso';

create or replace function public.registrar_pago_v2(
  p_id uuid, p_plan_id uuid, p_monto numeric, p_metodo text, p_fecha date default null,
  p_periodo date default null, p_cubre_total boolean default false, p_concepto text default 'Pago de curso',
  p_referencia text default null, p_nota text default null
) returns public.pagos language plpgsql security definer set search_path=public as $$
declare v_row public.pagos; v_student text;
begin
  if not public.es_admin() then raise exception 'solo_admin_puede_gestionar_pagos'; end if;
  select student_id into v_student from public.planes_pago where id=p_plan_id;
  if v_student is null then raise exception 'plan_not_found'; end if;
  if p_id is null then
    insert into public.pagos(plan_id,student_id,monto,metodo,fecha,periodo,cubre_total,concepto,referencia,nota,created_by)
    values(p_plan_id,v_student,p_monto,p_metodo,coalesce(p_fecha,current_date),
      case when p_cubre_total then null else date_trunc('month',p_periodo)::date end,
      coalesce(p_cubre_total,false),coalesce(nullif(trim(p_concepto),''),'Pago de curso'),p_referencia,p_nota,(select auth.uid()))
    returning * into v_row;
  else
    update public.pagos set monto=p_monto,metodo=p_metodo,fecha=coalesce(p_fecha,current_date),
      periodo=case when p_cubre_total then null else date_trunc('month',p_periodo)::date end,
      cubre_total=coalesce(p_cubre_total,false),concepto=coalesce(nullif(trim(p_concepto),''),'Pago de curso'),
      referencia=p_referencia,nota=p_nota where id=p_id returning * into v_row;
  end if;
  return v_row;
end $$;
revoke execute on function public.registrar_pago_v2(uuid,uuid,numeric,text,date,date,boolean,text,text,text) from public,anon;
grant execute on function public.registrar_pago_v2(uuid,uuid,numeric,text,date,date,boolean,text,text,text) to authenticated;

create or replace function public.recalcular_acceso_alumno(p_student_id text)
returns text language plpgsql security definer set search_path = public as $$
declare v_ready boolean; v_state text;
begin
  select s.terms_status = 'firmado'
    and s.garantia_aceptada
    and s.garantia_firma_alumno is not null
    and s.garantia_firma_tutor is not null
    and s.garantia_estado = 'validada'
    and (select count(*) = 2 from public.student_documents d
         where d.student_id=s.id and d.document_type in ('curp','ine_tutor') and d.status='validado')
  into v_ready from public.students s where s.id=p_student_id;
  v_state := case when coalesce(v_ready,false) then 'activo' else 'pendiente' end;
  update public.students set acceso_estado=v_state where id=p_student_id and acceso_estado is distinct from v_state;
  return v_state;
end $$;

create or replace function public.trg_recalcular_acceso_documento()
returns trigger language plpgsql security definer set search_path=public as $$
begin perform public.recalcular_acceso_alumno(coalesce(new.student_id,old.student_id)); return coalesce(new,old); end $$;
create trigger recalcular_acceso_documento after insert or update or delete on public.student_documents
for each row execute function public.trg_recalcular_acceso_documento();

create or replace function public.trg_recalcular_acceso_firmas()
returns trigger language plpgsql security definer set search_path=public as $$
begin perform public.recalcular_acceso_alumno(new.id); return new; end $$;
create trigger recalcular_acceso_firmas after update of terms_status, garantia_aceptada,
  garantia_firma_alumno, garantia_firma_tutor, garantia_estado on public.students
for each row execute function public.trg_recalcular_acceso_firmas();

revoke execute on function public.trg_recalcular_acceso_documento(),
  public.trg_recalcular_acceso_firmas(), public.trg_plantilla_base_grupo() from public,anon,authenticated;

create or replace function public.guardar_garantia(
  p_student_id text, p_aceptada boolean, p_firma_alumno text, p_firma_tutor text
) returns text language plpgsql security definer set search_path=public as $$
begin
  if not public.es_personal() and p_student_id is distinct from (select public.mi_student_id()) then raise exception 'forbidden'; end if;
  if not coalesce(p_aceptada,false) or p_firma_alumno not like 'data:image/png;base64,%'
     or p_firma_tutor not like 'data:image/png;base64,%' then raise exception 'garantia_incompleta'; end if;
  update public.students set garantia_aceptada=true, garantia_firma_alumno=p_firma_alumno,
    garantia_firma_tutor=p_firma_tutor, garantia_estado='entregada' where id=p_student_id;
  return public.recalcular_acceso_alumno(p_student_id);
end $$;

create or replace function public.validar_documento(p_document_id uuid, p_aprobado boolean, p_motivo text default null)
returns text language plpgsql security definer set search_path=public as $$
declare v_student text;
begin
  if not public.es_personal() then raise exception 'forbidden'; end if;
  update public.student_documents set status=case when p_aprobado then 'validado' else 'rechazado' end,
    rejection_reason=case when p_aprobado then null else p_motivo end,
    validated_by=(select auth.uid()), validated_at=now(), updated_at=now()
  where id=p_document_id returning student_id into v_student;
  if v_student is null then raise exception 'document_not_found'; end if;
  return public.recalcular_acceso_alumno(v_student);
end $$;

create or replace function public.validar_garantia(p_student_id text)
returns text language plpgsql security definer set search_path=public as $$
begin
  if not public.es_personal() then raise exception 'forbidden'; end if;
  update public.students set garantia_estado='validada' where id=p_student_id
    and garantia_aceptada and garantia_firma_alumno is not null and garantia_firma_tutor is not null;
  if not found then raise exception 'garantia_incompleta'; end if;
  return public.recalcular_acceso_alumno(p_student_id);
end $$;

create or replace function public.actualizar_contacto_alumno(
  p_student_id text, p_personal_email text, p_whatsapp text, p_tutor_whatsapp text, p_universidad_area smallint
) returns void language plpgsql security definer set search_path=public as $$
declare v_group text;
begin
  select group_id into v_group from public.students where id=p_student_id;
  if not public.es_admin() and not public.puede_ver_grupo(v_group) then raise exception 'forbidden'; end if;
  update public.students set personal_email=nullif(trim(p_personal_email),''), whatsapp=nullif(trim(p_whatsapp),''),
    tutor_whatsapp=nullif(trim(p_tutor_whatsapp),''), universidad_area=p_universidad_area where id=p_student_id;
end $$;

create or replace function public.actualizar_clasificacion_grupo(p_group_id text, p_curso text, p_instituciones text[])
returns void language plpgsql security definer set search_path=public as $$
begin
  if p_curso not in ('ecoems','universidad') or not coalesce(p_instituciones,'{}') <@ array['unam','uam','ipn']::text[] then
    raise exception 'classification_invalid';
  end if;
  if not public.es_admin() and not public.puede_ver_grupo(p_group_id) then raise exception 'forbidden'; end if;
  update public.groups set curso=p_curso,
    instituciones=case when p_curso='universidad' then coalesce(p_instituciones,'{}') else '{}' end
  where id=p_group_id;
end $$;

grant select, insert, update on public.student_documents to authenticated;
grant select, insert, update on public.terms_documents to authenticated;
grant select, insert, update on public.notifications to authenticated;
grant select, insert, update, delete on public.email_drafts to authenticated;
grant execute on function public.asegurar_plantilla_base(text) to authenticated;
revoke execute on function public.asegurar_plantilla_base(text) from public, anon;
revoke execute on function public.recalcular_acceso_alumno(text), public.guardar_garantia(text,boolean,text,text),
  public.validar_documento(uuid,boolean,text), public.validar_garantia(text) from public, anon;
grant execute on function public.guardar_garantia(text,boolean,text,text),
  public.validar_documento(uuid,boolean,text), public.validar_garantia(text),
  public.actualizar_contacto_alumno(text,text,text,text,smallint),
  public.actualizar_clasificacion_grupo(text,text,text[]) to authenticated;
revoke execute on function public.actualizar_contacto_alumno(text,text,text,text,smallint),
  public.actualizar_clasificacion_grupo(text,text,text[]) from public, anon;

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='notifications') then
    alter publication supabase_realtime add table public.notifications;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='student_documents') then
    alter publication supabase_realtime add table public.student_documents;
  end if;
end $$;
