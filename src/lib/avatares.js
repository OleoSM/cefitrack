/**
 * Catálogo cerrado de avatares para el perfil del alumno.
 *
 * Nadie sube imágenes: sólo se elige de esta lista. Los archivos viven en
 * public/avatares y se guarda la CLAVE en la base, no la ruta, para poder
 * cambiar formato o nombre de archivo sin migrar datos.
 *
 * La misma lista está validada en el RPC `set_student_avatar`, así que
 * manipular la petición desde el cliente no permite colar otra cosa.
 */
export const AVATARES = [
  { id: 'einstein',   nombre: 'Einstein',   grupo: 'Ciencia' },
  { id: 'newton',     nombre: 'Newton',     grupo: 'Ciencia' },
  { id: 'darwin',     nombre: 'Darwin',     grupo: 'Ciencia' },
  { id: 'cientifico', nombre: 'Científica', grupo: 'Ciencia' },

  { id: 'hidalgo',    nombre: 'Hidalgo',    grupo: 'Independencia' },
  { id: 'morelos',    nombre: 'Morelos',    grupo: 'Independencia' },
  { id: 'josefa',     nombre: 'Josefa Ortiz', grupo: 'Independencia' },
  { id: 'allende',    nombre: 'Allende',    grupo: 'Independencia' },
  { id: 'guerrero',   nombre: 'Guerrero',   grupo: 'Independencia' },

  { id: 'moctezuma',  nombre: 'Moctezuma',  grupo: 'Historia' },
  { id: 'napoleon',   nombre: 'Napoleón',   grupo: 'Historia' },

  { id: 'burro',      nombre: 'Burro',      grupo: 'Mascotas' },
  { id: 'puma',       nombre: 'Puma',       grupo: 'Mascotas' },
  { id: 'aguila',     nombre: 'Águila',     grupo: 'Mascotas' },
]

/** Ruta del archivo, o null si la clave no está en el catálogo. */
export const rutaAvatar = id =>
  AVATARES.some(a => a.id === id) ? `/avatares/${id}.svg` : null

/** Secciones para el selector, en el orden de la lista. */
export const AVATARES_POR_GRUPO = AVATARES.reduce((acc, a) => {
  ;(acc[a.grupo] ??= []).push(a)
  return acc
}, {})
