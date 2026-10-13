import { logoInstitucion } from '../../lib/instituciones'

/**
 * Emblema de la vertiente UNIVERSIDAD: los escudos de UNAM, IPN y UAM unidos
 * en un triángulo (UNAM arriba, IPN y UAM abajo), cada uno en su medallón
 * blanco con sus colores oficiales.
 *
 * Sustituye a la imagen montada de antes. El medallón blanco es lo que hace
 * legible cada escudo sobre cualquier color de grupo —en silueta blanca, el
 * trazo fino de la UAM desaparecía— y el triángulo de fondo los ata como un
 * solo icono.
 *
 * `size` es el lado del cuadrado que ocupa, en px.
 */
const POSICIONES = [
  { id: 'unam', x: 0.5,  y: 0.27 },
  { id: 'ipn',  x: 0.27, y: 0.72 },
  { id: 'uam',  x: 0.73, y: 0.72 },
]

/* La UAM es apaisada (2.45:1): dentro del círculo necesita menos margen para
   pesar lo mismo que los escudos más cuadrados. */
const RELLENO = { unam: 0.16, ipn: 0.16, uam: 0.1 }

export default function EmblemaUniversidad({ size = 48, className = '', title = 'Universidad — UNAM, IPN y UAM' }) {
  const d = size * 0.52              // diámetro de cada medallón
  return (
    <span role="img" aria-label={title} title={title}
      className={`relative inline-block flex-shrink-0 ${className}`}
      style={{ width: size, height: size }}>
      {/* Triángulo que une los tres centros. */}
      <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full" aria-hidden="true">
        <polygon points={POSICIONES.map(p => `${p.x * 100},${p.y * 100}`).join(' ')}
          fill="rgba(255,255,255,.16)" stroke="rgba(255,255,255,.85)" strokeWidth="5" strokeLinejoin="round"/>
      </svg>
      {POSICIONES.map(p => {
        const logo = logoInstitucion(p.id)
        const pad = d * RELLENO[p.id]
        return (
          <span key={p.id} aria-hidden="true"
            className="absolute rounded-full flex items-center justify-center overflow-hidden"
            style={{
              width: d, height: d, left: p.x * size - d / 2, top: p.y * size - d / 2,
              background: '#ffffff', padding: pad,
              boxShadow: '0 0 0 1.5px rgba(0,0,0,.18), 0 1px 3px rgba(0,0,0,.25)',
            }}>
            <img src={logo.src} alt="" className="w-full h-full object-contain" draggable={false}/>
          </span>
        )
      })}
    </span>
  )
}
