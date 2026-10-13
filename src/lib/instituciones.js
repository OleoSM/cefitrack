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
  // Apaisado (530×216): en caja cuadrada queda diminuto. `ancho` pide una caja
  // más ancha que alta para que pese lo mismo que los demás escudos.
  uam:    { src: '/logos/instituciones/uam.png',    alt: 'UAM', ancho: 1.6 },
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

/**
 * Estilo para pintar un escudo sobre fondo de color.
 *
 * `brightness(0) invert(1)` lo aplasta a silueta blanca. Es lo que se hace con
 * un escudo sobre color —los originales son guinda o azul oscuro y sobre un
 * fondo del mismo registro desaparecen—, y evita el recuadro blanco que antes
 * se recortaba contra la tarjeta y se veía como un parche pegado.
 *
 * Sobre fondo claro se devuelve el logo intacto, con sus colores oficiales.
 */
export const estiloLogo = sobreColor =>
  sobreColor ? { filter: 'brightness(0) invert(1)' } : undefined

/**
 * Silueta en el color de letra de la tarjeta (blanco u oscuro). `oscura`
 * aplasta a negro; si no, a blanco. Un halo fino del color contrario separa
 * el escudo del fondo cuando este se le parece.
 */
export const estiloLogoTinta = oscura => ({
  filter: oscura
    ? 'brightness(0) drop-shadow(0 0 .5px rgba(255,255,255,.6))'
    : 'brightness(0) invert(1) drop-shadow(0 0 .5px rgba(0,0,0,.35))',
})
