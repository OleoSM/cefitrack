-- La lista de Pagos muestra la foto que subió el alumno (como en el resto del
-- panel). Solo se agrega la columna foto_path al final de la vista.
create or replace view public.v_pagos_resumen with (security_invoker = true) as
 SELECT s.id AS student_id, s.name AS student_name, s.email AS student_email, s.group_id,
    g.name AS group_name, g.sucursal, g.institucion, s.avatar, s.pago_estado,
    p.id AS plan_id, p.concepto, p.total, p.modalidad, p.mensualidades, p.inicio, p.notas,
    COALESCE(m.pagado, 0::numeric) AS pagado,
    CASE WHEN p.total IS NULL THEN NULL::numeric ELSE p.total - COALESCE(m.pagado, 0::numeric) END AS saldo,
    CASE WHEN p.total IS NULL THEN NULL::numeric ELSE LEAST(100::numeric, round(COALESCE(m.pagado, 0::numeric) / p.total * 100::numeric, 1)) END AS porcentaje,
    COALESCE(m.movimientos, 0::bigint) AS movimientos,
    m.ultimo_pago,
    COALESCE(m.liquidado_de_contado, false) AS liquidado_de_contado,
    p.inscripcion,
    COALESCE(m.inscripcion_pagada, 0::numeric) AS inscripcion_pagada,
    p.dia_limite,
    s.foto_path
   FROM students s
     LEFT JOIN groups g ON g.id = s.group_id
     LEFT JOIN planes_pago p ON p.student_id = s.id AND p.activo
     LEFT JOIN LATERAL ( SELECT sum(pg.monto) FILTER (WHERE NOT pg.es_inscripcion) AS pagado,
            sum(pg.monto) FILTER (WHERE pg.es_inscripcion) AS inscripcion_pagada,
            count(*) AS movimientos, max(pg.fecha) AS ultimo_pago,
            bool_or(pg.cubre_total) AS liquidado_de_contado
           FROM pagos pg WHERE pg.plan_id = p.id AND pg.anulado_at IS NULL) m ON true;
