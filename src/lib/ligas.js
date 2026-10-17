/*
 * Ligas de SIGA (rachas tipo Duolingo, solo por asistencia).
 *
 * · Cada clase asistida (a tiempo o con retardo) = 1 nivel.
 * · 10 ligas de 10 niveles; cada liga tiene 2 divisiones: I (niveles 1-5 de
 *   la liga) y II (6-10). La insignia cambia cada 10 niveles.
 * · Al pasar el nivel 100 (después de Leyenda II) el alumno es "Leyenda ★":
 *   la insignia lleva una estrella animada y el contador sigue.
 * · La RACHA (clases seguidas sin faltar) se muestra aparte con su llama; una
 *   falta la reinicia, pero no quita niveles.
 * Las insignias (Einstein, mascota de CEFIMAT) viven en public/ligas/.
 */
import { supabase } from './supabaseClient'

// `color`: sobre fondo claro (IPN/UNAM); `oscuro`: sobre el tema oscuro. Ambos
// con contraste ≥3:1 para que la barra de avance no se pierda en la tarjeta.
export const LIGAS = [
  { id: 'bronce',    nombre: 'Bronce',    color: '#B87333', oscuro: '#C98545' },
  { id: 'plata',     nombre: 'Plata',     color: '#7C8A99', oscuro: '#A8B4C2' },
  { id: 'oro',       nombre: 'Oro',       color: '#B07A0A', oscuro: '#E0A526' },
  { id: 'platino',   nombre: 'Platino',   color: '#5F7A94', oscuro: '#8EA3B8' },
  { id: 'esmeralda', nombre: 'Esmeralda', color: '#1F9D63', oscuro: '#2DB877' },
  { id: 'rubi',      nombre: 'Rubí',      color: '#C8304A', oscuro: '#E04F68' },
  { id: 'zafiro',    nombre: 'Zafiro',    color: '#2F6FD6', oscuro: '#5B8FE8' },
  { id: 'diamante',  nombre: 'Diamante',  color: '#1F8FBF', oscuro: '#4FB8E0' },
  { id: 'maestro',   nombre: 'Maestro',   color: '#7B4FC2', oscuro: '#9F7AE0' },
  { id: 'leyenda',   nombre: 'Leyenda',   color: '#7A1A33', oscuro: '#C0405F' },
]
export const NIVELES_POR_LIGA = 10
export const NIVEL_MAXIMO = LIGAS.length * NIVELES_POR_LIGA   // 100

export const insignia = id => `/ligas/${id}.svg`

/** Liga, división y progreso para un número de clases asistidas. */
export function ligaDe(asistencias = 0) {
  const nivel = Math.max(0, asistencias)
  if (nivel === 0) {
    return { nivel: 0, liga: LIGAS[0], division: 'I', etiqueta: 'Sin liga aún', estrella: false,
      progreso: 0, faltan: 1, siguiente: `${LIGAS[0].nombre} I` }
  }
  if (nivel > NIVEL_MAXIMO) {
    return { nivel, liga: LIGAS[LIGAS.length - 1], division: 'II', etiqueta: 'Leyenda ★', estrella: true,
      progreso: 1, faltan: 0, siguiente: null }
  }
  const indice = Math.ceil(nivel / NIVELES_POR_LIGA) - 1          // 0..9
  const enLiga = nivel - indice * NIVELES_POR_LIGA                 // 1..10
  const division = enLiga <= 5 ? 'I' : 'II'
  const finDivision = indice * NIVELES_POR_LIGA + (division === 'I' ? 5 : 10)
  const inicioDivision = finDivision - 5
  const liga = LIGAS[indice]
  const siguiente = division === 'I' ? `${liga.nombre} II`
    : indice + 1 < LIGAS.length ? `${LIGAS[indice + 1].nombre} I` : 'Leyenda ★'
  return { nivel, liga, division, etiqueta: `${liga.nombre} ${division}`, estrella: false,
    // Clases que faltan para la siguiente división (o para "Leyenda ★" tras el nivel 100).
    progreso: (nivel - inicioDivision) / 5, faltan: finDivision - nivel + 1, siguiente }
}

/** Racha del alumno con sesión. */
export async function fetchMiRacha() {
  const { data, error } = await supabase.rpc('mi_racha')
  if (error) throw error
  const r = Array.isArray(data) ? data[0] : data
  return r ? { rachaActual: r.racha_actual, mejorRacha: r.mejor_racha, asistencias: r.asistencias, sesiones: r.sesiones } : null
}

/** Racha de un alumno (personal). */
export async function fetchRachaAlumno(studentId) {
  const { data, error } = await supabase.rpc('racha_alumno', { p_student_id: studentId })
  if (error) throw error
  const r = Array.isArray(data) ? data[0] : data
  return r ? { rachaActual: r.racha_actual, mejorRacha: r.mejor_racha, asistencias: r.asistencias, sesiones: r.sesiones } : null
}
