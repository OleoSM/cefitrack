/*
 * Permisos por alumno: qué apartados de su portal puede ver (Pagos,
 * Materiales —todos o con algunos ocultos—, Desempeño y Rankings).
 * Sin registro = todo permitido. El servidor los aplica también (RLS).
 */
import { supabase } from './supabaseClient'

export const PERMISOS_POR_DEFECTO = { verPagos: true, verMateriales: true, verDesempeno: true, verRankings: true, materialesOcultos: [] }

const mapear = r => r ? {
  verPagos: r.ver_pagos, verMateriales: r.ver_materiales, verDesempeno: r.ver_desempeno,
  verRankings: r.ver_rankings, materialesOcultos: r.materiales_ocultos ?? [],
} : { ...PERMISOS_POR_DEFECTO }

/** Permisos de un alumno (personal) o los propios (alumno). */
export async function fetchPermisosAlumno(studentId) {
  const { data, error } = await supabase.from('permisos_alumno')
    .select('ver_pagos, ver_materiales, ver_desempeno, ver_rankings, materiales_ocultos')
    .eq('student_id', studentId).maybeSingle()
  if (error) throw error
  return mapear(data)
}

export async function guardarPermisosAlumno(studentId, p) {
  const { error } = await supabase.rpc('guardar_permisos_alumno', {
    p_student_id: studentId, p_ver_pagos: p.verPagos, p_ver_materiales: p.verMateriales,
    p_ver_desempeno: p.verDesempeno, p_ver_rankings: p.verRankings, p_materiales_ocultos: p.materialesOcultos,
  })
  if (error) return { ok: false, message: error.message?.includes('forbidden') ? 'No puedes cambiar los permisos de este alumno.' : 'No se pudieron guardar los permisos.' }
  return { ok: true }
}

/** Último reporte de IA del alumno, sin las partes internas (lo arma el servidor). */
export async function fetchMiDesempeno() {
  const { data, error } = await supabase.rpc('mi_desempeno')
  if (error) throw error
  return data ?? null
}

/** Planes y pagos del propio alumno (la RLS solo devuelve los suyos y si tiene el apartado). */
export async function fetchMisPagos(studentId) {
  const [{ data: planes, error: e1 }, { data: pagos, error: e2 }] = await Promise.all([
    supabase.from('planes_pago').select('id, concepto, total, modalidad, mensualidades, inicio, activo, inscripcion')
      .eq('student_id', studentId).order('created_at', { ascending: false }),
    supabase.from('pagos').select('id, plan_id, monto, metodo, fecha, periodo, cubre_total, concepto, es_inscripcion')
      .eq('student_id', studentId).order('fecha', { ascending: false }),
  ])
  if (e1 || e2) throw e1 ?? e2
  return { planes: planes ?? [], pagos: pagos ?? [] }
}
