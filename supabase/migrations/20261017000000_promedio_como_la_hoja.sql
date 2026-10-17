-- Auditoría 2026-10-17: students.avg_grade promediaba TODAS las evaluaciones,
-- incluidas las huérfanas (sin columna, de julio/agosto) y las de otro grupo.
-- Alex Itzayan aparecía con 7.1 (hoja: 8.6) y Alan Mateo con 7.6 (hoja: 8.5),
-- con su semáforo y su lugar en el top afectados. Ahora usa el mismo criterio
-- que la hoja: columnas de calificación del grupo actual que cuentan.
create or replace function public.recalc_student_grade(p_student_id text) returns void
language plpgsql security definer set search_path = public as $$
declare v_avg numeric;
begin
  select round(avg(e.calificacion / nullif(e.cal_max, 0) * 10), 1) into v_avg
  from evaluations e
  join registro_columnas c on c.id = e.columna_id
  join students s on s.id = e.student_id and s.group_id = c.group_id
  where e.student_id = p_student_id and c.formato = 'calificacion' and c.cuenta_en_promedio;
  update students s
  set avg_grade = v_avg,
      status = case
        when v_avg is null then s.status
        when v_avg >= 8.5 then 'excellent'
        when v_avg >= 7.5 then 'good'
        when v_avg >= 7.0 then 'warning'
        when v_avg >= 6.0 then 'at-risk'
        else 'critical' end
  where s.id = p_student_id;
  perform recalc_student_tasks(p_student_id);
end $$;

select public.recalc_student_grade(id) from students;
