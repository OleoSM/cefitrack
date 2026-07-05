/**
 * FlipCard — giro 3D entre anverso y reverso (CSS puro, sin dependencias).
 * Adaptación del patrón flip-card de 21st.dev al stack del proyecto.
 * - Desktop: gira al pasar el cursor (hoverFlip).
 * - Móvil: se controla con la prop `flipped` (botón externo).
 */
import { useState } from 'react'

export default function FlipCard({ front, back, flipped, onFlip, hoverFlip = true, width, height, className = '' }) {
  const [hovered, setHovered] = useState(false)
  const isFlipped = flipped || (hoverFlip && hovered)

  return (
    <div className={`flip-outer ${className}`} style={{ width, height }}
      onMouseEnter={() => hoverFlip && setHovered(true)}
      onMouseLeave={() => hoverFlip && setHovered(false)}
      onClick={onFlip}
      role="button" tabIndex={0} aria-pressed={isFlipped}>
      <div className={`flip-inner ${isFlipped ? 'is-flipped' : ''}`} style={{ width, height }}>
        <div className="flip-face flip-front">{front}</div>
        <div className="flip-face flip-back">{back}</div>
      </div>
    </div>
  )
}
