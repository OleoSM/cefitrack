import { logoInstitucion, estiloLogo } from '../../lib/instituciones'

/**
 * Icono de la vertiente de un grupo.
 *
 * UNIVERSIDAD no tiene escudo propio: es la unión de UNAM, UAM e IPN. Antes
 * cada grupo mostraba el escudo de UNA sola —la primera de su lista—, así que
 * dos grupos de la misma vertiente parecían cosas distintas y ninguno decía
 * "universidad". Aquí los tres escudos se pintan juntos y solapados: es un
 * solo icono, y se lee como una sola vertiente.
 *
 * Cuando el grupo apunta a una única institución se muestra sólo esa: superponer
 * escudos que el grupo no persigue diría algo falso.
 */
const UNIVERSIDAD = ['unam', 'uam', 'ipn']

export default function IconoCurso({ curso, instituciones = [], size = 20, sobreColor = false, className = '' }) {
  if (curso === 'universidad') {
    return <span className={`inline-flex flex-shrink-0 overflow-visible ${className}`}
      style={{width:size,height:size}}>
      <img src="/logos/universidad-informe-transparente.png" alt="Universidad: UNAM, UAM e IPN"
        className="w-full h-full object-contain"
        style={{transform:'scale(1.82)',transformOrigin:'center',filter:sobreColor?'brightness(0) invert(1)':undefined}}/>
    </span>
  }
  const escudos = curso === 'ecoems'
    ? ['ecoems']
    : (instituciones.length ? instituciones.filter(i => UNIVERSIDAD.includes(i)) : UNIVERSIDAD)

  if (!escudos.length) return null

  /* El solape es proporcional al tamaño: a 16 px tres escudos separados no
     caben en una celda de filtro, y separados del todo dejan de leerse como
     un grupo. */
  const solape = escudos.length > 1 ? Math.round(size * 0.3) : 0

  return (
    <span className={`inline-flex items-center flex-shrink-0 ${className}`}
      style={{ height: size }}
      title={curso === 'ecoems' ? 'ECOEMS' : `Universidad — ${escudos.map(e => e.toUpperCase()).join(', ')}`}>
      {escudos.map((id, i) => {
        const logo = logoInstitucion(id)
        if (!logo) return null
        return (
          <img key={id} src={logo.src} alt={i === 0 ? logo.alt : ''} aria-hidden={i > 0}
            className="object-contain"
            style={{
              height: size, width: size,
              marginLeft: i === 0 ? 0 : -solape,
              zIndex: escudos.length - i,
              ...estiloLogo(sobreColor),
            }}/>
        )
      })}
    </span>
  )
}
