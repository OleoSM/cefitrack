-- ════════════════════════════════════════════════════════════════════════════
--  NOMENCLATURA DE SUCURSALES Y TURNOS
--  APROBADA Y APLICADA el 2026-08-09.
--
--  Estuvo en supabase/pendientes/ mientras se revisaba, para que la CLI no la
--  ejecutara por accidente. Aprobada, se movió aquí.
-- ════════════════════════════════════════════════════════════════════════════
--
--  EL PROBLEMA
--  ───────────
--  Hoy `sucursal` vale 'CN1' | 'CN2' | 'CN3' y significa SUCURSAL. En la
--  nomenclatura nueva, CN-1 / CN-2 / CN-3 son HORARIOS de ECOEMS dentro de la
--  sucursal Neza 1, y las sucursales pasan a ser cuatro con nombre propio.
--  Las mismas cadenas significan cosas distintas, así que una conversión
--  automática 'CN1' → 'CN-1' habría etiquetado mal a los 40 alumnos. El mapeo
--  de abajo es el que confirmó el usuario, grupo por grupo.
--
--  EL MODELO
--  ─────────
--  Dos catálogos en vez de una lista de cadenas sueltas:
--    · `sucursales`  — las cuatro plazas, con su administración responsable.
--    · `turnos`      — el código horario dentro de una sucursal y un nivel.
--
--  Por qué catálogo y no un CHECK más largo: los códigos SE REPITEN ENTRE
--  SUCURSALES. Arenal y Neza 1 usan ambas UN-1 y UN-2 para universidad. Un
--  CHECK sobre una sola columna no puede expresar "UN-1 de Arenal" frente a
--  "UN-1 de Neza 1"; la clave única (sucursal_id, codigo) sí.
--
--  `groups.sucursal` y `students.sucursal` siguen siendo TEXT y conservan su
--  nombre: las ocho funciones que las atraviesan —create_group, update_group,
--  create_student, update_student, grant_sub_admin_access, list_cuentas,
--  mis_grupos, puede_sucursal— las pasan como texto sin interpretarlas, así
--  que siguen funcionando sin tocarlas. Lo que cambia es el dominio de valores:
--  de un CHECK a una clave foránea contra el catálogo.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. Catálogo de sucursales ───────────────────────────────────────────────
create table if not exists public.sucursales (
  id             text primary key,
  nombre         text not null,
  administracion text,                                   -- responsable, en texto
  admin_id       uuid references public.profiles(id),    -- y su cuenta, si la tiene
  orden          int  not null default 0,
  activa         boolean not null default true,
  created_at     timestamptz not null default now()
);

comment on table  public.sucursales is
  'Las cuatro plazas. Sustituye a la lista CN1/CN2/CN3, que mezclaba sucursal y horario.';
comment on column public.sucursales.admin_id is
  'Administración responsable. Es informativo: hoy TODOS los admin ven todas las sucursales (decisión del usuario, 2026-08-08). Si mañana se quiere restringir, este es el gancho.';

insert into public.sucursales (id, nombre, administracion, orden) values
  ('neza1',      'Neza 1',     'Dayan Everardo Torres',      1),
  ('arenal',     'Arenal',     'Dayan Everardo Torres',      2),
  ('neza2',      'Neza 2',     'Ivan Armando Cazarez Rios',  3),
  ('churubusco', 'Churubusco', 'Ivan Armando Cazarez Rios',  4)
on conflict (id) do nothing;

-- Enlaza cada sucursal con la cuenta de su responsable, por correo.
update public.sucursales s
   set admin_id = p.id
  from public.profiles p
 where p.role = 'admin'
   and ((s.administracion ilike 'Dayan%' and p.email = 'dayan.everardo@siga.mx')
     or (s.administracion ilike 'Ivan%'  and p.email = 'ivan.cazarez@siga.mx'));

-- ── 2. Catálogo de turnos ───────────────────────────────────────────────────
create table if not exists public.turnos (
  id          text primary key,          -- '<sucursal>-<codigo>', p. ej. 'neza1-CN-1'
  sucursal_id text not null references public.sucursales(id) on delete restrict,
  codigo      text not null,             -- 'CN-1', 'UN-2', 'CH-4'…
  nivel       text not null check (nivel in ('ecoems','universidad')),
  dias        text not null check (dias  in ('L-V','SAB')),
  hora_inicio time not null,
  hora_fin    time not null,
  orden       int  not null default 0,
  activo      boolean not null default true,
  unique (sucursal_id, codigo)
);

comment on table public.turnos is
  'Código horario dentro de una sucursal y un nivel. Los códigos se repiten entre sucursales (UN-1 existe en Neza 1 y en Arenal), por eso la unicidad es (sucursal_id, codigo) y no codigo a secas.';

insert into public.turnos (id, sucursal_id, codigo, nivel, dias, hora_inicio, hora_fin, orden) values
  -- ── Neza 1 ──
  ('neza1-CN-1', 'neza1', 'CN-1', 'ecoems',      'L-V', '08:30', '10:00', 1),
  ('neza1-CN-2', 'neza1', 'CN-2', 'ecoems',      'L-V', '15:00', '16:30', 2),
  ('neza1-CN-3', 'neza1', 'CN-3', 'ecoems',      'L-V', '16:30', '18:00', 3),
  ('neza1-CN-4', 'neza1', 'CN-4', 'ecoems',      'SAB', '08:00', '14:00', 4),
  ('neza1-UN-1', 'neza1', 'UN-1', 'universidad', 'L-V', '10:00', '12:00', 5),
  ('neza1-UN-2', 'neza1', 'UN-2', 'universidad', 'L-V', '18:00', '20:00', 6),
  ('neza1-UN-3', 'neza1', 'UN-3', 'universidad', 'SAB', '08:00', '14:00', 7),

  -- ── Arenal ── (el usuario no listó turnos sabatinos para esta plaza)
  ('arenal-CP-1', 'arenal', 'CP-1', 'ecoems',      'L-V', '08:30', '10:00', 1),
  ('arenal-CP-2', 'arenal', 'CP-2', 'ecoems',      'L-V', '15:00', '16:30', 2),
  ('arenal-CP-3', 'arenal', 'CP-3', 'ecoems',      'L-V', '16:30', '18:00', 3),
  ('arenal-UN-1', 'arenal', 'UN-1', 'universidad', 'L-V', '10:00', '12:00', 4),
  ('arenal-UN-2', 'arenal', 'UN-2', 'universidad', 'L-V', '18:00', '20:00', 5),

  -- ── Neza 2 ──
  ('neza2-CC-1', 'neza2', 'CC-1', 'ecoems',      'L-V', '08:30', '10:00', 1),
  ('neza2-CC-2', 'neza2', 'CC-2', 'ecoems',      'L-V', '15:00', '16:30', 2),
  ('neza2-CC-3', 'neza2', 'CC-3', 'ecoems',      'L-V', '16:30', '18:00', 3),
  ('neza2-CC-4', 'neza2', 'CC-4', 'ecoems',      'SAB', '08:00', '14:00', 4),
  ('neza2-UC-1', 'neza2', 'UC-1', 'universidad', 'L-V', '10:00', '12:00', 5),
  ('neza2-UC-2', 'neza2', 'UC-2', 'universidad', 'L-V', '18:00', '20:00', 6),
  ('neza2-UC-3', 'neza2', 'UC-3', 'universidad', 'SAB', '08:00', '14:00', 7),

  -- ── Churubusco ── (el usuario no listó sabatino de universidad)
  ('churubusco-CH-1', 'churubusco', 'CH-1', 'ecoems',      'L-V', '08:30', '10:00', 1),
  ('churubusco-CH-2', 'churubusco', 'CH-2', 'ecoems',      'L-V', '15:00', '16:30', 2),
  ('churubusco-CH-3', 'churubusco', 'CH-3', 'ecoems',      'L-V', '16:30', '18:00', 3),
  ('churubusco-CH-4', 'churubusco', 'CH-4', 'ecoems',      'SAB', '08:00', '14:00', 4),
  ('churubusco-UH-1', 'churubusco', 'UH-1', 'universidad', 'L-V', '10:00', '12:00', 5),
  ('churubusco-UH-2', 'churubusco', 'UH-2', 'universidad', 'L-V', '18:00', '20:00', 6)
on conflict (id) do nothing;

-- ── 3. Soltar los CHECK viejos ──────────────────────────────────────────────
-- Se sueltan ANTES de migrar los datos: si no, el UPDATE los violaría.
alter table public.groups           drop constraint if exists groups_sucursal_check;
alter table public.students         drop constraint if exists students_sucursal_check;
alter table public.sub_admin_access drop constraint if exists sub_admin_access_sucursal_check;

-- ── 4. Columna de turno en los grupos ───────────────────────────────────────
alter table public.groups add column if not exists turno_id text references public.turnos(id);
comment on column public.groups.turno_id is
  'Turno del catálogo. Nulo mientras no se le asigne uno: hay grupos cuyo horario real no coincide con ningún turno de la tabla.';

-- ── 5. Migración de los datos existentes ────────────────────────────────────
-- Mapeo confirmado por el usuario: las cuatro sucursales son Neza 1, Neza 2,
-- Arenal y Churubusco, y por ahora TODOS los grupos dependen de Neza 1.
update public.groups set sucursal = 'neza1' where id in ('g1','g13','g14','g15');

-- El turno se asigna SOLO donde el horario coincide de verdad con uno del
-- catálogo. Los otros dos quedan en null a propósito: inventarles un turno
-- sería fabricar un dato que nadie ha decidido, y encima uno que después
-- nadie distinguiría de un dato real.
--   g1  ipn    'Lunes a Viernes 10:00 a 12:00' → UN-1, coincide exacto
--   g15 ecoems '3 a 4:30'                      → CN-2, coincide, y el grupo ya
--                                                se llamaba "CN-2 (2027)"
--   g13 unam   'Lunes/Viernes 10:00 a 1:00'    → NULL. Ningún turno de
--                                                universidad termina a la 1:00.
--   g14 unam   'Lunes a Viernes 16:00 - 18:00' → NULL. Grupo de PRUEBA, y no
--                                                hay turno de 16:00 a 18:00.
update public.groups set turno_id = 'neza1-UN-1' where id = 'g1';
update public.groups set turno_id = 'neza1-CN-2' where id = 'g15';

-- El alumno hereda la sucursal de su grupo. Es la fuente de verdad: la columna
-- propia de `students` venía de un alta manual y podía discrepar.
update public.students s
   set sucursal = g.sucursal
  from public.groups g
 where g.id = s.group_id;

-- Alumnos sin grupo: no los hay hoy, pero la red de seguridad evita que la
-- clave foránea del paso 6 falle si aparece alguno entre la revisión y la
-- ejecución.
update public.students set sucursal = 'neza1'
 where group_id is null and sucursal is not null;

-- Accesos de sub-admin: la única fila existente (Uriel, CN1) es de Neza 1.
update public.sub_admin_access set sucursal = 'neza1'
 where sucursal in ('CN1','CN2','CN3');

-- ── 6. Integridad referencial en lugar de CHECK ─────────────────────────────
alter table public.groups
  add constraint groups_sucursal_fkey
  foreign key (sucursal) references public.sucursales(id) on delete restrict;

alter table public.students
  add constraint students_sucursal_fkey
  foreign key (sucursal) references public.sucursales(id) on delete restrict;

alter table public.sub_admin_access
  add constraint sub_admin_access_sucursal_fkey
  foreign key (sucursal) references public.sucursales(id) on delete restrict;

-- ── 7. Lectura de los catálogos ─────────────────────────────────────────────
-- Son catálogos, no datos personales: cualquiera autenticado los lee, nadie los
-- escribe desde el cliente. Se mantienen con migraciones o desde el panel.
alter table public.sucursales enable row level security;
alter table public.turnos     enable row level security;

drop policy if exists sucursales_lectura on public.sucursales;
create policy sucursales_lectura on public.sucursales
  for select to authenticated using (true);

drop policy if exists turnos_lectura on public.turnos;
create policy turnos_lectura on public.turnos
  for select to authenticated using (true);

grant select on public.sucursales, public.turnos to authenticated;


-- ════════════════════════════════════════════════════════════════════════════
--  COMPROBACIONES tras aplicar (deben devolver 0 filas cada una)
-- ════════════════════════════════════════════════════════════════════════════
-- select * from public.groups   where sucursal not in (select id from public.sucursales);
-- select * from public.students where sucursal not in (select id from public.sucursales);
-- select * from public.groups g left join public.turnos t on t.id = g.turno_id
--   where g.turno_id is not null and t.sucursal_id <> g.sucursal;   -- turno de otra plaza
--
--  Y el reparto debe quedar así:
-- select s.nombre, s.administracion, count(g.id) as grupos
--   from public.sucursales s left join public.groups g on g.sucursal = s.id
--  group by 1,2 order by s.orden;
--
-- ════════════════════════════════════════════════════════════════════════════
--  VUELTA ATRÁS
-- ════════════════════════════════════════════════════════════════════════════
-- begin;
--   alter table public.groups           drop constraint groups_sucursal_fkey;
--   alter table public.students         drop constraint students_sucursal_fkey;
--   alter table public.sub_admin_access drop constraint sub_admin_access_sucursal_fkey;
--   update public.groups   set sucursal = case id when 'g1' then 'CN2' else 'CN1' end
--     where id in ('g1','g13','g14','g15');
--   update public.students s set sucursal = g.sucursal from public.groups g where g.id = s.group_id;
--   update public.sub_admin_access set sucursal = 'CN1' where sucursal = 'neza1';
--   alter table public.groups   add constraint groups_sucursal_check
--     check (sucursal = any (array['CN1','CN2','CN3']));
--   alter table public.students add constraint students_sucursal_check
--     check (sucursal = any (array['CN1','CN2','CN3']));
--   alter table public.sub_admin_access add constraint sub_admin_access_sucursal_check
--     check (sucursal = any (array['CN1','CN2','CN3']));
--   alter table public.groups drop column turno_id;
--   drop table public.turnos;
--   drop table public.sucursales;
-- commit;
--
--  OJO: la vuelta atrás restaura la sucursal de los GRUPOS, pero la de los
--  alumnos se recalcula desde su grupo. Si algún alumno tenía una sucursal que
--  no coincidía con la de su grupo, ese dato ya no se recupera. Hoy no hay
--  ninguno en esa situación; si la revisión tarda, conviene volver a mirarlo.
