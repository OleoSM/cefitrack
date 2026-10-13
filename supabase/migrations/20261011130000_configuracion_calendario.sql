-- Fechas propias del calendario del alumno (inicios de curso, suspensiones,
-- eventos) definidas por administración. Los festivos oficiales de México se
-- calculan en el cliente (src/lib/feriados.js); aquí van los que añada CEFIMAT.
-- Formato: [{ "fecha": "YYYY-MM-DD", "titulo": "...", "tipo": "feriado|inicio|evento" }]
alter table public.configuracion add column if not exists calendario jsonb not null default '[]'::jsonb;
do $$ begin
  alter table public.configuracion add constraint configuracion_calendario_es_lista check (jsonb_typeof(calendario) = 'array');
exception when duplicate_object then null; end $$;
