insert into groups (id, name, subject, schedule, room, color) values
  ('g1', 'Grupo A', 'Matemáticas Avanzadas', 'Lun / Mié / Vie  08:00 – 09:30', 'Aula 201', '#3b82f6'),
  ('g2', 'Grupo B', 'Física Aplicada', 'Mar / Jue  09:00 – 11:00', 'Lab 102', '#10b981'),
  ('g3', 'Grupo C', 'Química General', 'Lun / Mié  11:00 – 12:30', 'Lab 305', '#f59e0b');

insert into students (id, name, email, group_id, tutor_name, tutor_email, tutor_phone, attendance_rate, avg_grade, assignments_done, assignments_total, rank, status, terms_status, signed_at, wa_added) values
  ('s1', 'Ana García López',          'ana.garcia@edutrack.mx',   'g1', 'Carmen López',    'carmen.lopez@gmail.com', '555-0101', 95, 9.2, 18, 20, 1,  'excellent', 'firmado',   '2026-05-31 09:14', true),
  ('s2', 'Carlos Martínez Hernández', 'carlos.mtz@edutrack.mx',   'g1', 'Roberto Martínez','roberto.mtz@gmail.com', '555-0102', 72, 6.8, 12, 20, 12, 'at-risk',   'pendiente', null,        false),
  ('s3', 'María Rodríguez Sánchez',   'maria.rdz@edutrack.mx',    'g1', 'Luis Rodríguez',  'luis.rdz@gmail.com',    '555-0103', 88, 8.1, 17, 20, 5,  'good',      'firmado',   '2026-05-28 11:02', true),
  ('s4', 'José Luis Pérez Torres',    'joseluis.pt@edutrack.mx',  'g1', 'María Pérez',     'maria.perez@gmail.com', '555-0104', 91, 7.9, 16, 20, 7,  'good',      'pendiente', null,        false),
  ('s5', 'Laura Domínguez Flores',    'laura.df@edutrack.mx',     'g1', 'Pedro Domínguez', 'pedro.dom@gmail.com',   '555-0105', 97, 8.9, 19, 20, 2,  'excellent', 'firmado',   '2026-05-30 08:45', true),
  ('s6', 'Roberto Jiménez Castro',    'roberto.jc@edutrack.mx',   'g1', 'Elena Castro',    'elena.cast@gmail.com',  '555-0106', 65, 5.9, 9,  20, 18, 'critical',  'pendiente', null,        false),
  ('s7', 'Sofía Morales Gutiérrez',   'sofia.mg@edutrack.mx',     'g1', 'Ana Gutiérrez',   'ana.gut@gmail.com',     '555-0107', 85, 7.5, 15, 20, 9,  'good',      'pendiente', null,        false);

insert into users (id, name, email, password_hash, role, student_id) values
  ('u1', 'Prof. Mario Sánchez Vega', 'admin@edutrack.mx', crypt('123456', gen_salt('bf')), 'admin', null);

insert into users (id, name, email, password_hash, role, student_id)
select s.id, s.name, s.email, crypt('123456', gen_salt('bf')), 'student', s.id
from students s
where s.group_id = 'g1';
