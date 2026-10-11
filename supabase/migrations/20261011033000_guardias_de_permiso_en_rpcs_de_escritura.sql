-- Fase B del cierre de seguridad (auditoria 2026-10-10).
-- Las RPC de escritura eran SECURITY DEFINER, ejecutables por anon via PUBLIC
-- y no comprobaban quien llamaba. Se antepone un guardia al cuerpo de cada una
-- (mismo patron que set_valor_registro) y se cierra el EXECUTE a anon.

-- Helper: el admin gestiona a todos; el sub_admin, a los alumnos de sus grupos
-- (o de su sucursal si el alumno aun no tiene grupo).
create or replace function public.puede_gestionar_alumno(p_student_id text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.es_admin()
      or (public.auth_role() = 'sub_admin' and exists (
            select 1 from public.students s
            where s.id = p_student_id
              and (public.puede_ver_grupo(s.group_id)
                   or (s.group_id is null and public.puede_sucursal(s.sucursal)))));
$$;
revoke execute on function public.puede_gestionar_alumno(text) from public, anon;
grant  execute on function public.puede_gestionar_alumno(text) to authenticated;

-- Inyecta el guardia justo despues del unico BEGIN de cada funcion plpgsql.
do $mig$
declare
  r record;
  def text;
  cuerpo text;
begin
  for r in select * from (values
    ('public.upsert_evaluation(uuid,text,text,text,numeric,numeric,date,text)', 'if not public.puede_gestionar_alumno(p_student_id) or (p_id is not null and exists (select 1 from public.evaluations e0 where e0.id = p_id and not public.puede_gestionar_alumno(e0.student_id))) then raise exception ''forbidden''; end if;'),
    ('public.upsert_evaluations_bulk(jsonb)', 'if not public.es_personal() then raise exception ''forbidden''; end if;'),
    ('public.delete_evaluation(uuid)', 'if exists (select 1 from public.evaluations e0 where e0.id = p_id and not public.puede_gestionar_alumno(e0.student_id)) or not public.es_personal() then raise exception ''forbidden''; end if;'),
    ('public.create_group(text,text,text,text,text,text,text)', 'if not (public.es_personal() and public.puede_sucursal(p_sucursal)) then raise exception ''forbidden''; end if;'),
    ('public.update_group(text,text,text,text,text,text,text,text)', 'if not public.puede_ver_grupo(p_id) then raise exception ''forbidden''; end if;'),
    ('public.delete_group(text)', 'if not public.puede_ver_grupo(p_id) then raise exception ''forbidden''; end if;'),
    ('public.create_student(text,text,text,text,text,text,text,text)', 'if not (public.es_personal() and (case when p_group_id is not null then public.puede_ver_grupo(p_group_id) else public.puede_sucursal(p_sucursal) end)) then raise exception ''forbidden''; end if;'),
    ('public.update_student(text,text,text,text,text,text,text,text)', 'if not public.puede_gestionar_alumno(p_id) or (p_group_id is not null and not public.puede_ver_grupo(p_group_id)) then raise exception ''forbidden''; end if;'),
    ('public.delete_student(text)', 'if not public.puede_gestionar_alumno(p_id) then raise exception ''forbidden''; end if;'),
    ('public.reset_student_password(text,text)', 'if not public.puede_gestionar_alumno(p_student_id) then raise exception ''forbidden''; end if;'),
    ('public.set_registro_admin(text,text,text)', 'if not public.puede_gestionar_alumno(p_student_id) then raise exception ''forbidden''; end if;'),
    ('public.set_student_avatar(text,text)', 'if not (p_student_id = public.mi_student_id() or public.puede_gestionar_alumno(p_student_id)) then raise exception ''forbidden''; end if;'),
    ('public.grant_sub_admin_access(text,text,text)', 'if not public.es_admin() then raise exception ''forbidden''; end if;'),
    ('public.revoke_sub_admin_access(uuid)', 'if not public.es_admin() then raise exception ''forbidden''; end if;'),
    ('public.crear_columna_registro(text,text,text,text,numeric,text)', 'if not public.puede_ver_grupo(p_group_id) then raise exception ''forbidden''; end if;'),
    ('public.upsert_attendance_list(text,date,integer,bigint,bigint,bigint,boolean,jsonb)', 'if not public.puede_ver_grupo(p_group_id) then raise exception ''forbidden''; end if;'),
    ('public.create_attendance_session(text,date,integer)', 'if not public.puede_ver_grupo(p_group_id) then raise exception ''forbidden''; end if;'),
    ('public.delete_attendance_list(text,date)', 'if not public.puede_ver_grupo(p_group_id) then raise exception ''forbidden''; end if;'),
    -- El alumno solo puede registrarse a si mismo y el estado lo decide el servidor.
    ('public.register_attendance(text,text,text)', 'if not (p_student_id = public.mi_student_id() or public.es_personal()) then raise exception ''forbidden''; end if; if not public.es_personal() then p_status := null; end if;')
  ) as t(sig, guard)
  loop
    def := pg_get_functiondef(r.sig::regprocedure);
    if position(r.guard in def) > 0 then continue; end if;  -- idempotente
    cuerpo := split_part(def, '$function$', 2);
    if (length(cuerpo) - length(replace(lower(cuerpo), 'begin', ''))) / 5 <> 1 then
      raise exception 'Se esperaba un solo BEGIN en %', r.sig;
    end if;
    execute replace(def, cuerpo, regexp_replace(cuerpo, '\mbegin\M', E'begin\n  ' || r.guard, 'i'));
    execute format('revoke execute on function %s from public, anon', r.sig);
    execute format('grant execute on function %s to authenticated', r.sig);
  end loop;
end
$mig$;

-- Padron de cuentas: solo admin (la pantalla Acceso y Disposicion ya es solo admin).
create or replace function public.list_cuentas_estado()
returns table(id text, name text, email text, role text, grupo_id text, grupo_nombre text, sucursal text, activo boolean, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  if not public.es_admin() then raise exception 'forbidden'; end if;
  return query
  select * from (
    select p.id::text as id, p.name, p.email, p.role,
           null::text as grupo_id, null::text as grupo_nombre, null::text as sucursal,
           coalesce(p.activo, true) as activo, p.created_at
    from profiles p
    where p.role in ('admin','sub_admin')
    union all
    select s.id, s.name, s.email, 'student'::text,
           s.group_id, g.name, coalesce(g.sucursal, s.sucursal), true, now()
    from students s
    left join groups g on g.id = s.group_id
  ) t
  order by case t.role when 'admin' then 0 when 'sub_admin' then 1 else 2 end,
           t.activo desc, t.name;
end $$;
revoke execute on function public.list_cuentas_estado() from public, anon;
grant  execute on function public.list_cuentas_estado() to authenticated;

-- Sin uso en el frontend: se cierran del todo.
revoke execute on function public.list_staff() from public, anon, authenticated;
revoke execute on function public.create_group(text,text,text,text,text,text) from public, anon, authenticated;
revoke execute on function public.update_group(text,text,text,text,text,text,text) from public, anon, authenticated;
