// Tinta legible sobre un color de fondo arbitrario (acento de grupo, color
// elegido por el alumno…). Los acentos del tema oscuro son hsl() luminosos
// (cian, oro…) y el texto blanco encima no llegaba a 2:1; en IPN/UNAM son
// hex profundos y ahí el blanco sí es correcto. Se decide por contraste WCAG.

const TINTA_OSCURA = '#0f172a'
const TINTA_CLARA  = '#ffffff'

function hslARgb(h, s, l) {
  s /= 100; l /= 100
  const k = n => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return [f(0), f(8), f(4)].map(v => Math.round(v * 255))
}

/** [r,g,b] 0–255 de un '#rgb', '#rrggbb' o 'hsl(h,s%,l%)'; null si no se entiende. */
export function aRgb(color = '') {
  const hex = (color.match(/#([0-9a-f]{6}|[0-9a-f]{3})\b/i) ?? [])[1]
  if (hex) {
    const h = hex.length === 3 ? [...hex].map(c => c + c).join('') : hex
    return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16))
  }
  const m = color.match(/hsla?\(\s*([\d.]+)[\s,]+([\d.]+)%[\s,]+([\d.]+)%/i)
  if (m) return hslARgb(+m[1], +m[2], +m[3])
  return null
}

function luminancia([r, g, b]) {
  const c = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
  return 0.2126 * c(r) + 0.7152 * c(g) + 0.0722 * c(b)
}

/** Razón de contraste WCAG entre dos colores (1–21); null si alguno no se entiende. */
export function contraste(a, b) {
  const ra = aRgb(a), rb = aRgb(b)
  if (!ra || !rb) return null
  const [x, y] = [luminancia(ra), luminancia(rb)].sort((m, n) => n - m)
  return (x + 0.05) / (y + 0.05)
}

/**
 * '#ffffff' o '#0f172a', la que más contraste dé sobre `fondo`.
 * Para valores que no se pueden leer (p. ej. 'var(--x)') devuelve blanco,
 * que es lo correcto sobre los rellenos -solid del sistema.
 */
export function tintaSobre(fondo) {
  const rgb = aRgb(fondo)
  if (!rgb) return TINTA_CLARA
  const L = luminancia(rgb)
  const contraBlanco = 1.05 / (L + 0.05)
  const contraOscuro = (L + 0.05) / (luminancia(aRgb(TINTA_OSCURA)) + 0.05)
  return contraBlanco >= contraOscuro ? TINTA_CLARA : TINTA_OSCURA
}
