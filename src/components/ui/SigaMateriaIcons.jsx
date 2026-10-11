// src/components/ui/SigaMateriaIcons.jsx
//
// Iconos de MATERIAS de SIGA. Misma gramática que SigaKpiIcons y lucide:
// 24×24, trazo redondo, sin rellenos, stroke="currentColor", 1.75 por defecto.
// Primera versión generada con Codex (solo lectura) y revisada a mano: se
// corrigieron Matemáticas A (le faltaba el ÷), el microscopio de Ciencias
// biológicas B (arco deforme) y Historia B (salía un libro idéntico al
// genérico; ahora es un reloj de arena).
//
// Las familias con dos variantes (A/B) sirven para que dos materias de la
// misma familia —Álgebra y Geometría— no muestren el mismo dibujo.
import { forwardRef } from 'react'

function make(name, children) {
  const Icon = forwardRef(function SigaIcon(
    { size = 24, strokeWidth = 1.75, className, ...rest },
    ref,
  ) {
    return (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
        focusable="false"
        {...rest}
      >
        {children}
      </svg>
    )
  })
  Icon.displayName = name
  return Icon
}

export const IconMatematicasA = make('IconMatematicasA', <>
  <path d="M7 4v5M4.5 6.5h5M15.5 6.5h5" />
  <path d="m4.5 15 5 5M9.5 15l-5 5" />
  <path d="M15.5 17.5h5M18 15h.01M18 20h.01" />
</>)

export const IconMatematicasB = make('IconMatematicasB', <>
  <path d="M5 20 12 5l7 15" />
  <path d="M8 14h8" />
  <path d="M9.5 16a4 4 0 0 1 5-5" />
  <path d="M4 20h16" />
</>)

export const IconCienciasBiologicasA = make('IconCienciasBiologicasA', <>
  <path d="M20 4C10 4 4 8 4 15a5 5 0 0 0 5 5c7 0 11-6 11-16Z" />
  <path d="M4.5 19.5 17 7" />
  <path d="m9 15-1-4M12 12l4 1" />
</>)

export const IconCienciasBiologicasB = make('IconCienciasBiologicasB', <>
  <path d="M6 18h8" />
  <path d="M3 22h18" />
  <path d="M14 22a7 7 0 1 0 0-14h-1" />
  <path d="M9 14h2" />
  <path d="M9 12a2 2 0 0 1-2-2V6h6v4a2 2 0 0 1-2 2Z" />
  <path d="M12 6V3a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v3" />
</>)

export const IconCienciasSocialesA = make('IconCienciasSocialesA', <>
  <circle cx="12" cy="7" r="3" />
  <circle cx="5" cy="10" r="2" />
  <circle cx="19" cy="10" r="2" />
  <path d="M6 21v-1a6 6 0 0 1 12 0v1" />
  <path d="M2 20v-1a3 3 0 0 1 3-3M22 20v-1a3 3 0 0 0-3-3" />
</>)

export const IconCienciasSocialesB = make('IconCienciasSocialesB', <>
  <path d="M12 4v15M5 7h14M8 7 4 14h8L8 7ZM16 7l-4 7h8l-4-7Z" />
  <path d="M8 19h8M6 21h12" />
</>)

export const IconHistoriaA = make('IconHistoriaA', <>
  <path d="M3 9h18L12 4 3 9Z" />
  <path d="M5 20h14M4 22h16" />
  <path d="M6 10v9M10 10v9M14 10v9M18 10v9" />
</>)

export const IconHistoriaB = make('IconHistoriaB', <>
  <path d="M5 22h14M5 2h14" />
  <path d="M17 22v-4.17a2 2 0 0 0-.59-1.42L12 12l-4.41 4.41A2 2 0 0 0 7 17.83V22" />
  <path d="M7 2v4.17a2 2 0 0 0 .59 1.42L12 12l4.41-4.41A2 2 0 0 0 17 6.17V2" />
</>)

export const IconFisica = make('IconFisica', <>
  <circle cx="12" cy="12" r="1" />
  <ellipse cx="12" cy="12" rx="9" ry="4" />
  <ellipse cx="12" cy="12" rx="9" ry="4" transform="rotate(60 12 12)" />
  <ellipse cx="12" cy="12" rx="9" ry="4" transform="rotate(120 12 12)" />
</>)

export const IconQuimica = make('IconQuimica', <>
  <path d="M9 3h6M10 3v6l-5.5 9.5A2.3 2.3 0 0 0 6.5 22h11a2.3 2.3 0 0 0 2-3.5L14 9V3" />
  <path d="M7 16h10" />
  <path d="M9 13h.01M12 11h.01M15 14h.01" />
</>)

export const IconGeografia = make('IconGeografia', <>
  <circle cx="12" cy="12" r="9" />
  <path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />
</>)

export const IconEspanol = make('IconEspanol', <>
  <path d="M12 6.5C9 4 5.5 4 3 5v15c3-1 6.5-1 9 1.5 2.5-2.5 6-2.5 9-1.5V5c-2.5-1-6-1-9 1.5Z" />
  <path d="M12 7v14M5.5 9H9M5.5 12H9M15 9h3.5M15 12h3.5" />
</>)

export const IconIngles = make('IconIngles', <>
  <path d="M4 5h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-8l-5 3v-3H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />
  <path d="M7 11h.01M12 11h.01M17 11h.01" />
  <path d="M7 14h4M13 14h4" />
</>)

export const IconComputacion = make('IconComputacion', <>
  <rect x="3" y="4" width="18" height="13" rx="2" />
  <path d="m9 8-3 2.5L9 13M15 8l3 2.5-3 2.5M12 8l-1 5" />
  <path d="M12 17v4M8 21h8" />
</>)

export const IconCivismo = make('IconCivismo', <>
  <path d="M12 3 20 6v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6l8-3Z" />
  <path d="m12 7 1.4 2.8 3.1.5-2.2 2.2.5 3.1-2.8-1.5-2.8 1.5.5-3.1-2.2-2.2 3.1-.5L12 7Z" />
</>)

export const IconFilosofia = make('IconFilosofia', <>
  <path d="M12 3a8 8 0 0 0-4 14.9V21l4-2a8 8 0 1 0 0-16Z" />
  <path d="M10 9a2 2 0 1 1 3.5 1.3c-.9 1-1.5 1.2-1.5 2.7M12 16h.01" />
</>)

export const IconMateria = make('IconMateria', <>
  <path d="M5 4h14v16H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />
  <path d="M7 4v16M19 4v16M10 8h6M10 12h6" />
  <path d="m15 16 2 2 2-2" />
</>)

export const MATERIA_ICONS = {
  matematicas: [IconMatematicasA, IconMatematicasB],
  cienciasBiologicas: [IconCienciasBiologicasA, IconCienciasBiologicasB],
  cienciasSociales: [IconCienciasSocialesA, IconCienciasSocialesB],
  historia: [IconHistoriaA, IconHistoriaB],
  fisica: [IconFisica],
  quimica: [IconQuimica],
  geografia: [IconGeografia],
  espanol: [IconEspanol],
  ingles: [IconIngles],
  computacion: [IconComputacion],
  civismo: [IconCivismo],
  filosofia: [IconFilosofia],
  generica: [IconMateria],
}

export function claveMateria(nombre) {
  const texto = String(nombre ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

  if (/matem|algebra|calculo|geometr|trigono|aritm/.test(texto)) return 'matematicas'
  if (/fisic/.test(texto)) return 'fisica'
  if (/quimic/.test(texto)) return 'quimica'
  if (/biolog|ciencias de la vida|ecolog|anatom/.test(texto)) return 'cienciasBiologicas'
  if (/histor/.test(texto)) return 'historia'
  if (/geograf/.test(texto)) return 'geografia'
  if (/social|sociolog|econom/.test(texto)) return 'cienciasSociales'
  if (/espanol|lectura|redacc|literat|comprension/.test(texto)) return 'espanol'
  if (/ingles|idioma/.test(texto)) return 'ingles'
  if (/comput|inform|tecnolog/.test(texto)) return 'computacion'
  if (/civic|etic|civism|formacion/.test(texto)) return 'civismo'
  if (/filosof|logica/.test(texto)) return 'filosofia'
  return 'generica'
}

export function iconoMateria(nombre, variante = 0) {
  const lista = MATERIA_ICONS[claveMateria(nombre)]
  return lista[variante % lista.length]
}