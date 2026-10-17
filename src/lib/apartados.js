/*
 * Apartados del panel de administración que un admin puede abrir o cerrar a
 * cada sub-admin. Las claves son las mismas que en la base
 * (`apartados_catalogo()`); si se añade una aquí, hay que añadirla allí.
 *
 * El Dashboard siempre se ve. "Acceso y Disposición" nunca se delega: con él
 * un sub-admin podría darse permisos a sí mismo.
 */
export const APARTADOS = [
  { clave: 'grupos',         label: 'Grupos',          ruta: '/admin/grupos',        detalle: 'Ver y gestionar sus grupos.' },
  { clave: 'alumnos',        label: 'Alumnos',         ruta: '/admin/alumnos',       detalle: 'Expedientes de los alumnos de sus grupos.' },
  { clave: 'calificaciones', label: 'Calificaciones',  ruta: '/admin/registrar',     detalle: 'Capturar y editar la hoja de calificaciones.' },
  { clave: 'asistencias',    label: 'Pasar lista',     ruta: '/admin/asistencias',   detalle: 'Tomar asistencia.' },
  { clave: 'evaluaciones',   label: 'Exámenes',        ruta: '/admin/evaluaciones',  detalle: 'Exámenes y simulacros.' },
  { clave: 'materiales',     label: 'Materiales',      ruta: '/admin/materiales',    detalle: 'Subir solucionarios y guías que se borran solos al vencer.' },
  { clave: 'pagos',          label: 'Pagos',           ruta: '/admin/pagos',         detalle: 'Planes de pago y cobros de sus alumnos.', sensible: true },
  { clave: 'correos',        label: 'Enviar correos',  ruta: '/admin/correos',       detalle: 'Mandar avisos a los alumnos de sus grupos.', sensible: true },
  { clave: 'terminos',       label: 'T&C / Firmas',    ruta: '/admin/terminos',      detalle: 'Términos, firmas y documentos.' },
  { clave: 'configuracion',  label: 'Configuración',   ruta: '/admin/configuracion', detalle: 'Ajustes generales de la plataforma.' },
  { clave: 'rankings',       label: 'Rankings',        ruta: '/admin/rankings',      detalle: 'Tablas de posiciones.' },
  // Sin ruta propia: el asistente flotante y los botones de reporte del perfil y del grupo.
  { clave: 'ia',             label: 'Asistente IA',    ruta: null,                   detalle: 'Reportes de competencias y habilidades con IA (consume saldo).', sensible: true },
]

/** Lo que recibe un sub-admin si nadie lo ha personalizado. */
export const APARTADOS_POR_DEFECTO = APARTADOS.filter(a => !a.sensible).map(a => a.clave)

export const TODOS_LOS_APARTADOS = APARTADOS.map(a => a.clave)

/** Clave del apartado al que pertenece una ruta, o null si no es delegable
 *  (Dashboard: siempre visible). La ruta más larga gana: /admin/configuracion/acceso
 *  no cae en "configuracion" porque se controla aparte (solo admin). */
export function apartadoDeRuta(pathname) {
  if (pathname.startsWith('/admin/configuracion/acceso')) return null
  // Notificaciones es parte del apartado de correos.
  if (pathname.startsWith('/admin/notificaciones')) return 'correos'
  const a = APARTADOS.find(x => pathname === x.ruta || pathname.startsWith(x.ruta + '/'))
  return a?.clave ?? null
}

export const etiquetaApartado = clave => APARTADOS.find(a => a.clave === clave)?.label ?? clave
