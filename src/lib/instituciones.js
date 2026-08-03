/**
 * Logos oficiales de las instituciones a las que apuntan los alumnos.
 *
 * Las claves son el campo `tipo` del catálogo de escuelas (`schools` en
 * mockData). `uam` todavía no aparece en el catálogo, pero el logo está en el
 * repositorio y queda mapeado para cuando se añadan sus carreras.
 *
 * Los archivos se usan tal cual: sin recolorear, recortar ni deformar, como
 * pide su ficha en public/logos/instituciones/README.md. Por eso todos los
 * consumidores los pintan con `object-contain` y alto fijo.
 */
const LOGOS = {
  unam:   { src: '/logos/instituciones/unam.svg',   alt: 'UNAM' },
  ipn:    { src: '/logos/instituciones/ipn.webp',   alt: 'IPN' },
  uam:    { src: '/logos/instituciones/uam.png',    alt: 'UAM' },
  ecoems: { src: '/logos/instituciones/ecoems.png', alt: 'ECOEMS' },
}

/** Devuelve { src, alt } del logo, o null si la institución no tiene uno. */
export const logoInstitucion = tipo => LOGOS[tipo] ?? null

/**
 * Deduce la institución cuando sólo se tiene el nombre de la escuela.
 * Las de ECOEMS se llaman "CCH (UNAM)" o "CECyT / CETIS (IPN)", así que el
 * paréntesis manda sobre el prefijo: quien busca CCH va por la UNAM.
 */
export function tipoDesdeNombre(nombre = '') {
  const n = nombre.toUpperCase()
  if (n.includes('(UNAM)')) return 'unam'
  if (n.includes('(IPN)'))  return 'ipn'
  if (n.startsWith('UNAM')) return 'unam'
  if (n.startsWith('IPN'))  return 'ipn'
  if (n.startsWith('UAM'))  return 'uam'
  return null
}

/** Catálogo para selectores. El orden es el de uso real en el centro. */
export const INSTITUCIONES = [
  { id: 'unam',   alt: 'UNAM' },
  { id: 'ipn',    alt: 'IPN' },
  { id: 'uam',    alt: 'UAM' },
  { id: 'ecoems', alt: 'ECOEMS' },
]
