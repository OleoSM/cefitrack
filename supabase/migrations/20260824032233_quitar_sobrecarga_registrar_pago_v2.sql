-- Dos `registrar_pago_v2` con la misma cabecera y distinto número de argumentos
-- dejan a PostgREST eligiendo candidato: en cuanto una llamada omitiera uno de
-- los dos parámetros nuevos, devolvería 300 «could not choose the best
-- candidate function» en vez de registrar el pago. Queda sólo la vigente.
drop function if exists public.registrar_pago_v2(uuid,uuid,numeric,text,date,date,boolean,text,text,text);
