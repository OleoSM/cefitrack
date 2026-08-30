-- Al recrear la vista se perdió `security_invoker`, y sin él la vista consulta
-- con los permisos de su dueño: cualquier usuario autenticado —incluido un
-- alumno— habría leído los pagos de TODOS. Con el invocador activo se aplican
-- las políticas de `students`, `planes_pago` y `pagos` como en el resto del panel.
alter view public.v_pagos_resumen set (security_invoker = on);
