// Métricas académicas de un alumno o de un grupo, calculadas AQUÍ y no por el
// modelo: los números salen de la hoja de calificaciones y de Pasar Lista, y
// la IA solo los interpreta. Así nunca inventa una calificación y cada reporte
// cuesta menos (le llega un resumen compacto, no las celdas crudas).
//
// Todo se lee con el cliente DEL USUARIO: la RLS acota a sus grupos.
// Escala: calificaciones de 0 a 10, redondeadas a un decimal.
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2'

type Col = { id: string, materia: string, nombre: string, tipo: string, cal_max: number, formato: string,
  cuenta_en_promedio: boolean, created_at: string, orden: number, materia_orden: number }
type Valor = { student_id: string, columna_id: string, valor: string }

const r1 = (n: number | null) => n == null || Number.isNaN(n) ? null : Math.round(n * 10) / 10
const media = (xs: number[]) => xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null
// Guía y análisis son casillas (entregó / no entregó), no calificaciones.
const ES_CHECK = (c: Col) => c.formato === 'check'
const NOMBRE_TIPO: Record<string, string> = {
  tarea: 'tareas', actividad: 'actividades', general: 'actividades', digital: 'exámenes digitales',
  simulacro: 'simulacros', examen: 'exámenes',
}

/** Valor de una celda en escala 0-10; NP cuenta como 0 y "no entregado". */
function nota(c: Col, v: string | undefined): { n: number | null, np: boolean } {
  if (v == null || v === '') return { n: null, np: false }
  if (v === 'NP') return { n: 0, np: true }
  const x = Number(v)
  if (Number.isNaN(x)) return { n: null, np: false }
  return { n: (x / (Number(c.cal_max) || 10)) * 10, np: false }
}

/** "sube" / "baja" / "estable" comparando la primera y la segunda mitad. */
function tendencia(serie: number[]) {
  if (serie.length < 4) return null
  const m = Math.floor(serie.length / 2)
  const d = (media(serie.slice(m)) ?? 0) - (media(serie.slice(0, m)) ?? 0)
  return d >= 0.7 ? 'sube' : d <= -0.7 ? 'baja' : 'estable'
}

async function hojaDelGrupo(db: SupabaseClient, groupId: string) {
  const [{ data: cols }, { data: vals }, { data: sesiones }] = await Promise.all([
    db.from('registro_columnas')
      .select('id, materia, nombre, tipo, cal_max, formato, cuenta_en_promedio, created_at, orden, materia_orden')
      .eq('group_id', groupId),
    db.from('registro_valores').select('student_id, columna_id, valor, registro_columnas!inner(group_id)')
      .eq('registro_columnas.group_id', groupId),
    db.from('attendance_sessions').select('id').eq('group_id', groupId),
  ])
  const ids = (sesiones ?? []).map((s: any) => s.id)
  const { data: registros } = ids.length
    ? await db.from('attendance_records').select('student_id, session_id, status').in('session_id', ids)
    : { data: [] }
  const columnas = ((cols ?? []) as Col[])
    .sort((a, b) => a.materia_orden - b.materia_orden || a.orden - b.orden || a.created_at.localeCompare(b.created_at))
  const celda: Record<string, Record<string, string>> = {}
  for (const v of (vals ?? []) as Valor[]) (celda[v.student_id] ??= {})[v.columna_id] = v.valor
  return { columnas, celda, sesiones: ids.length, registros: (registros ?? []) as any[] }
}

/** Indicadores de UN alumno con su hoja (sin comparación con el grupo). */
function calcular(columnas: Col[], celda: Record<string, string>) {
  const porMateria: Record<string, { notas: number[], serie: number[], np: number, sin: number, total: number,
    porTipo: Record<string, number[]>, checks: { hechos: number, total: number } }> = {}
  const porTipo: Record<string, number[]> = {}
  const todas: number[] = []
  let guias = { hechas: 0, total: 0 }, analisis = { hechos: 0, total: 0 }
  for (const c of columnas) {
    const v = celda[c.id]
    if (ES_CHECK(c)) {
      if (c.tipo === 'guia') { guias.total++; if (v === '1') guias.hechas++ }
      else if (c.tipo === 'analisis') { analisis.total++; if (v === '1') analisis.hechos++ }
      continue
    }
    const m = porMateria[c.materia] ??= { notas: [], serie: [], np: 0, sin: 0, total: 0, porTipo: {}, checks: { hechos: 0, total: 0 } }
    m.total++
    const { n, np } = nota(c, v)
    if (np) m.np++
    if (n == null) { m.sin++; continue }
    m.serie.push(n)
    if (!c.cuenta_en_promedio) continue
    m.notas.push(n); todas.push(n)
    ;(m.porTipo[c.tipo] ??= []).push(n)
    ;(porTipo[c.tipo] ??= []).push(n)
  }
  return { porMateria, porTipo, promedio: media(todas), guias, analisis }
}

function asistenciaDe(registros: any[], studentId: string, sesiones: number) {
  const mios = registros.filter(r => r.student_id === studentId)
  const cuenta = (s: string) => mios.filter(r => r.status === s).length
  const presentes = cuenta('presente'), tardanzas = cuenta('tardanza')
  const faltas = Math.max(0, sesiones - presentes - tardanzas)
  return { sesiones, presentes, tardanzas, faltas,
    porcentaje: sesiones ? r1(((presentes + tardanzas) / sesiones) * 100) : null }
}

const AREA: Record<number, string> = { 1: 'Área 1 (Físico-Matemáticas e Ingenierías)', 2: 'Área 2 (Biológicas y de la Salud)',
  3: 'Área 3 (Sociales)', 4: 'Área 4 (Humanidades y Artes)' }

async function contexto(db: SupabaseClient, groupId: string) {
  const [{ data: g }, { data: alumnos }] = await Promise.all([
    db.from('groups').select('id, name, sucursal, curso, institucion, instituciones').eq('id', groupId).maybeSingle(),
    db.from('students').select('id, name, group_id, universidad_area, garantia_estado, status').eq('group_id', groupId),
  ])
  const { data: suc } = g ? await db.from('sucursales').select('nombre').eq('id', g.sucursal).maybeSingle() : { data: null }
  return { grupo: g, sucursal: suc?.nombre ?? g?.sucursal ?? '', alumnos: alumnos ?? [] }
}

/** Métricas completas de un alumno, comparadas con su grupo. null si no lo puede ver. */
export async function metricasAlumno(db: SupabaseClient, studentId: string) {
  const { data: a } = await db.from('students').select('id, group_id').eq('id', studentId).maybeSingle()
  if (!a?.group_id) return null
  const [ctx, hoja] = await Promise.all([contexto(db, a.group_id), hojaDelGrupo(db, a.group_id)])
  const yo = ctx.alumnos.find((x: any) => x.id === studentId)
  if (!yo || !ctx.grupo) return null

  const mio = calcular(hoja.columnas, hoja.celda[studentId] ?? {})
  const delGrupo = ctx.alumnos.map((x: any) => ({ id: x.id, ...calcular(hoja.columnas, hoja.celda[x.id] ?? {}) }))
  const conPromedio = delGrupo.filter(x => x.promedio != null).sort((p, q) => (q.promedio ?? 0) - (p.promedio ?? 0))
  const posicion = conPromedio.findIndex(x => x.id === studentId)
  const mediaGrupo = (f: (x: ReturnType<typeof calcular>) => number[] | undefined) =>
    r1(media(delGrupo.map(x => media(f(x) ?? [])).filter((v): v is number => v != null)))

  const materias = Object.entries(mio.porMateria).map(([materia, m]) => ({
    materia,
    promedio: r1(media(m.notas)),
    promedio_grupo: mediaGrupo(x => x.porMateria[materia]?.notas),
    calificadas: m.total - m.sin, total: m.total, no_presento: m.np,
    tendencia: tendencia(m.serie),
    ultimas: m.serie.slice(-3).map(r1),
    por_tipo: Object.fromEntries(Object.entries(m.porTipo).map(([t, xs]) => [NOMBRE_TIPO[t] ?? t, r1(media(xs))])),
  }))
  const tipos = Object.fromEntries(Object.entries(mio.porTipo).map(([t, xs]) => [NOMBRE_TIPO[t] ?? t,
    { alumno: r1(media(xs)), grupo: mediaGrupo(x => x.porTipo[t]) }]))
  const asistencia = asistenciaDe(hoja.registros, studentId, hoja.sesiones)
  const asistGrupo = media(ctx.alumnos.map((x: any) => asistenciaDe(hoja.registros, x.id, hoja.sesiones).porcentaje)
    .filter((v: number | null): v is number => v != null))

  return {
    alumno: {
      nombre: (yo as any).name, grupo: ctx.grupo.name, sucursal: ctx.sucursal,
      curso: ctx.grupo.curso === 'ecoems' ? 'ECOEMS (bachillerato)' : 'Examen de admisión a universidad',
      area: (yo as any).universidad_area ? AREA[(yo as any).universidad_area] ?? null : null,
      garantia: (yo as any).garantia_estado ?? null,
    },
    resumen: {
      promedio: r1(mio.promedio), promedio_grupo: mediaGrupo(x => x.promedio == null ? [] : [x.promedio]),
      posicion: posicion >= 0 ? `${posicion + 1} de ${conPromedio.length}` : null,
      asistencia, asistencia_grupo: r1(asistGrupo),
      guias_entregadas: mio.guias.total ? `${mio.guias.hechas} de ${mio.guias.total}` : null,
      analisis_entregados: mio.analisis.total ? `${mio.analisis.hechos} de ${mio.analisis.total}` : null,
    },
    por_tipo: tipos,
    materias,
    _ref: { groupId: a.group_id },
  }
}

/** Métricas de un grupo: por materia, por alumno (compacto) y alertas. */
export async function metricasGrupo(db: SupabaseClient, groupId: string) {
  const [ctx, hoja] = await Promise.all([contexto(db, groupId), hojaDelGrupo(db, groupId)])
  if (!ctx.grupo) return null
  const filas = ctx.alumnos.map((x: any) => {
    const c = calcular(hoja.columnas, hoja.celda[x.id] ?? {})
    const asis = asistenciaDe(hoja.registros, x.id, hoja.sesiones)
    const mats = Object.entries(c.porMateria).map(([m, v]) => ({ m, p: media(v.notas) })).filter(v => v.p != null)
    const debil = mats.sort((p, q) => (p.p ?? 0) - (q.p ?? 0))[0]
    return { id: x.id, nombre: x.name, promedio: r1(c.promedio), asistencia: asis.porcentaje,
      materia_mas_baja: debil ? `${debil.m} (${r1(debil.p)})` : null, porMateria: c.porMateria }
  })
  const materias = [...new Set(hoja.columnas.filter(c => !ES_CHECK(c)).map(c => c.materia))].map(materia => {
    const proms = filas.map(f => media(f.porMateria[materia]?.notas ?? [])).filter((v): v is number => v != null)
    return {
      materia, promedio: r1(media(proms)), alumnos_con_nota: proms.length,
      aprobados_pct: proms.length ? r1((proms.filter(p => p >= 6).length / proms.length) * 100) : null,
      mas_baja: r1(proms.length ? Math.min(...proms) : null), mas_alta: r1(proms.length ? Math.max(...proms) : null),
    }
  })
  const proms = filas.map(f => f.promedio).filter((v): v is number => v != null)
  const asis = filas.map(f => f.asistencia).filter((v): v is number => v != null)
  return {
    grupo: { nombre: ctx.grupo.name, sucursal: ctx.sucursal, alumnos: filas.length, sesiones_de_asistencia: hoja.sesiones,
      curso: ctx.grupo.curso === 'ecoems' ? 'ECOEMS (bachillerato)' : 'Examen de admisión a universidad' },
    resumen: { promedio: r1(media(proms)), asistencia: r1(media(asis)),
      en_riesgo: filas.filter(f => (f.promedio != null && f.promedio < 7) || (f.asistencia != null && f.asistencia < 80)).length },
    materias,
    alumnos: filas.map(({ porMateria: _, id: __, ...f }) => f)
      .sort((p, q) => (q.promedio ?? -1) - (p.promedio ?? -1)),
    _ref: { groupId },
  }
}
