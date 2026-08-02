import { useEffect, useState } from 'react'

/* Mismos cortes que Tailwind, para que el JS y las clases no se contradigan. */
const SM = 640
const LG = 1024

/**
 * Ancho del viewport en categorías, para decidir *cuántos* datos renderizar.
 *
 * Ojo: esto no reemplaza a las clases responsivas. Para mostrar u ocultar algo
 * ya montado, usar `hidden sm:flex` y demás — es más rápido y no re-renderiza.
 * Este hook es para lo que las clases no pueden hacer: no montar el contenido
 * en primer lugar.
 */
export function useBreakpoint() {
  const [w, setW] = useState(() =>
    typeof window === 'undefined' ? LG : window.innerWidth)

  useEffect(() => {
    const onResize = () => setW(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  return { width: w, isMobile: w < SM, isTablet: w >= SM && w < LG, isDesktop: w >= LG }
}

/**
 * Cuántos elementos mostrar de entrada según el ancho. Un teléfono que recibe
 * 32 alumnos de golpe obliga a un scroll interminable antes de poder filtrar.
 */
export function usePageSize({ mobile = 6, tablet = 12, desktop = 24 } = {}) {
  const { isMobile, isTablet } = useBreakpoint()
  return isMobile ? mobile : isTablet ? tablet : desktop
}
