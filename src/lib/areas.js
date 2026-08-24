/**
 * Áreas del examen de admisión a universidad.
 *
 * Sólo aplican a los grupos de universidad: ECOEMS no se divide así, y ofrecer
 * la elección allí sería pedir un dato que no existe. El número (1-4) es lo que
 * se guarda en `students.universidad_area`; las etiquetas viven aquí para que
 * la hoja de calificaciones, el alta de alumnos y el portal del alumno digan
 * exactamente lo mismo.
 */
export const AREAS_UNIVERSIDAD = [
  { id: 1, corto: 'Área 1', label: 'Área 1 — Físico-Matemáticas e Ingenierías' },
  { id: 2, corto: 'Área 2', label: 'Área 2 — Ciencias Biológicas, Químicas y de la Salud' },
  { id: 3, corto: 'Área 3', label: 'Área 3 — Ciencias Sociales' },
  { id: 4, corto: 'Área 4', label: 'Área 4 — Humanidades y Artes' },
]

export const areaDe = n => AREAS_UNIVERSIDAD.find(a => a.id === Number(n)) ?? null
