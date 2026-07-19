-- Seed histórico (esquema uuid original). Superseded por 20260705170322,
-- que hace drop/rebuild de todas las tablas con ids text.
insert into groups (id, name, subject, schedule, room, color) values
  ('11111111-1111-1111-1111-111111111111', 'Grupo A', 'Matemáticas Avanzadas', 'Lun / Mié / Vie  08:00 – 09:30', 'Aula 201', '#3b82f6'),
  ('22222222-2222-2222-2222-222222222222', 'Grupo B', 'Física Aplicada', 'Mar / Jue  09:00 – 11:00', 'Lab 102', '#10b981'),
  ('33333333-3333-3333-3333-333333333333', 'Grupo C', 'Química General', 'Lun / Mié  11:00 – 12:30', 'Lab 305', '#f59e0b');

insert into students (id, name, email, group_id, tutor_name, tutor_email, tutor_phone, attendance_rate, avg_grade, assignments_done, assignments_total, rank, status, terms_status, signed_at, wa_added) values
  (gen_random_uuid(), 'Ana García López',          'ana.garcia@edutrack.mx',   '11111111-1111-1111-1111-111111111111', 'Carmen López',    'carmen.lopez@gmail.com', '555-0101', 95, 9.2, 18, 20, 1,  'excellent', 'firmado',   now(), true),
  (gen_random_uuid(), 'Carlos Martínez Hernández', 'carlos.mtz@edutrack.mx',   '11111111-1111-1111-1111-111111111111', 'Roberto Martínez','roberto.mtz@gmail.com', '555-0102', 72, 6.8, 12, 20, 12, 'at-risk',   'pendiente', null,  false),
  (gen_random_uuid(), 'María Rodríguez Sánchez',   'maria.rdz@edutrack.mx',    '11111111-1111-1111-1111-111111111111', 'Luis Rodríguez',  'luis.rdz@gmail.com',    '555-0103', 88, 8.1, 17, 20, 5,  'good',      'firmado',   now(), true),
  (gen_random_uuid(), 'José Luis Pérez Torres',    'joseluis.pt@edutrack.mx',  '11111111-1111-1111-1111-111111111111', 'María Pérez',     'maria.perez@gmail.com', '555-0104', 91, 7.9, 16, 20, 7,  'good',      'pendiente', null,  false),
  (gen_random_uuid(), 'Laura Domínguez Flores',    'laura.df@edutrack.mx',     '11111111-1111-1111-1111-111111111111', 'Pedro Domínguez', 'pedro.dom@gmail.com',   '555-0105', 97, 8.9, 19, 20, 2,  'excellent', 'firmado',   now(), true),
  (gen_random_uuid(), 'Roberto Jiménez Castro',    'roberto.jc@edutrack.mx',   '11111111-1111-1111-1111-111111111111', 'Elena Castro',    'elena.cast@gmail.com',  '555-0106', 65, 5.9, 9,  20, 18, 'critical',  'pendiente', null,  false),
  (gen_random_uuid(), 'Sofía Morales Gutiérrez',   'sofia.mg@edutrack.mx',     '11111111-1111-1111-1111-111111111111', 'Ana Gutiérrez',   'ana.gut@gmail.com',     '555-0107', 85, 7.5, 15, 20, 9,  'good',      'pendiente', null,  false);

insert into users (name, email, password, role, student_id)
select 'Prof. Mario Sánchez Vega', 'admin@edutrack.mx', '123456', 'admin', null
where not exists (select 1 from users where email = 'admin@edutrack.mx');

insert into users (name, email, password, role, student_id)
select s.name, s.email, '123456', 'student', s.id
from students s
where s.group_id = '11111111-1111-1111-1111-111111111111';
