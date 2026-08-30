/**
 * Áreas del examen de admisión a universidad.
 *
 * Sólo aplican a los grupos de universidad: ECOEMS no se divide así, y ofrecer
 * la elección allí sería pedir un dato que no existe. El número (1-4) es lo que
 * se guarda en `students.universidad_area`; las etiquetas viven aquí para que
 * la hoja de calificaciones, el alta de alumnos y el portal del alumno digan
 * exactamente lo mismo.
 */
const CATALOGO = {
  unam: ['Ciencias Físico-Matemáticas e Ingenierías', 'Ciencias Biológicas, Químicas y de la Salud', 'Ciencias Sociales', 'Humanidades y Artes'],
  ipn: ['Ingeniería y Ciencias Físico Matemáticas', 'Ciencias Médico Biológicas', 'Ciencias Sociales y Administrativas'],
  uam: ['Ciencias Básicas e Ingeniería (CBI)', 'Ciencias Biológicas y de la Salud (CBS)', 'Ciencias Sociales y Humanidades (CSH)', 'Ciencias y Artes para el Diseño (CAD)'],
}

export function areasParaInstituciones(instituciones = []) {
  const ids = instituciones.filter(id => CATALOGO[id])
  const vigentes = ids.length ? ids : ['unam', 'ipn', 'uam']
  return [1, 2, 3, 4].map(id => {
    const detalles = vigentes.flatMap(inst => CATALOGO[inst][id - 1]
      ? [`${inst.toUpperCase()}: ${CATALOGO[inst][id - 1]}`] : [])
    return detalles.length ? { id, corto:`Área ${id}`, label:`Área ${id} — ${detalles.join(' · ')}` } : null
  }).filter(Boolean)
}

export const AREAS_UNIVERSIDAD = areasParaInstituciones()
export const areaDe = (n, instituciones = []) => areasParaInstituciones(instituciones).find(a => a.id === Number(n)) ?? null
