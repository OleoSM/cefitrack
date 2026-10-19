-- Interruptor general del envío de correos. Apagado por defecto: lo enciende
-- o apaga un admin desde Configuración. Las Edge Functions enviar-correo y
-- avisos-auto lo consultan y, apagado, rechazan cualquier envío (423
-- correos_deshabilitados); avisos-auto solo permite la vista previa.
alter table public.configuracion add column if not exists correos_habilitados boolean not null default false;
