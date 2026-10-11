// src/components/ui/SigaKpiIcons.jsx
//
// Iconos propios de los indicadores de SIGA. Misma gramática que lucide-react
// (lienzo 24×24, trazo redondo, sin rellenos) para convivir con él en la misma
// fila: se intercambian sin que se note el cambio de familia.
//
// Reglas del set:
//   · Sólo trazo: stroke="currentColor", fill="none". El color lo pone quien
//     lo usa (en KpiCard: el token --<tono>-solid sobre la ficha blanca).
//   · Grosor 1.75 por defecto, sobrescribible con `strokeWidth`.
//   · Geometría dentro de 2..22 para que a 16 px no se corte el trazo.
//   · Los puntos se dibujan como `M x yh.01` (convención lucide), no como
//     círculos de radio diminuto que desaparecen al escalar.
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

/* Alumnos: persona al frente y otra detrás. */
export const IconAlumnos = make('IconAlumnos', <>
  <circle cx="9" cy="7" r="3" />
  <path d="M3 20v-1a6 6 0 0 1 12 0v1" />
  <path d="M16 4.2a3 3 0 0 1 0 5.6" />
  <path d="M18 13.5a5 5 0 0 1 3 4.5v2" />
</>)

/* Asistencia: hoja de calendario con palomita. */
export const IconAsistencia = make('IconAsistencia', <>
  <rect x="3" y="5" width="18" height="16" rx="2" />
  <path d="M8 3v4M16 3v4M3 10h18" />
  <path d="m8.5 15.5 2.5 2.5 4.5-4.5" />
</>)

/* Retardos: reloj con signo de alerta a la derecha. */
export const IconRetardos = make('IconRetardos', <>
  <circle cx="10" cy="12" r="8" />
  <path d="M10 7.5V12l3 2" />
  <path d="M21 7v5" />
  <path d="M21 16h.01" />
</>)

/* Faltas: hoja de calendario con aspa. Comparte base con Asistencia. */
export const IconFaltas = make('IconFaltas', <>
  <rect x="3" y="5" width="18" height="16" rx="2" />
  <path d="M8 3v4M16 3v4M3 10h18" />
  <path d="m9.5 13.5 5 5M14.5 13.5l-5 5" />
</>)

/* Promedio: barras desiguales y la línea media que las cruza. */
export const IconPromedio = make('IconPromedio', <>
  <path d="M3 3v18h18" />
  <path d="M7.5 17v-4M12 17V7M16.5 17v-7" />
  <path d="M5.5 11h14" />
</>)

/* Grupos: dos personas detrás y una al frente. */
export const IconGrupos = make('IconGrupos', <>
  <circle cx="6" cy="4.5" r="2" />
  <circle cx="18" cy="4.5" r="2" />
  <path d="M2 11a4 4 0 0 1 8 0M14 11a4 4 0 0 1 8 0" />
  <circle cx="12" cy="14" r="2" />
  <path d="M8 21a4 4 0 0 1 8 0" />
</>)

/* Pagos: tarjeta con palomita de cobro confirmado. */
export const IconPagos = make('IconPagos', <>
  <rect x="2" y="5" width="20" height="14" rx="2" />
  <path d="M2 10h20" />
  <path d="M5.5 15h3" />
  <path d="m13 14.5 2 2 4-4" />
</>)

/* Adeudos: billete con moneda y signo menos. */
export const IconAdeudos = make('IconAdeudos', <>
  <rect x="2" y="5" width="20" height="14" rx="2" />
  <circle cx="12" cy="12" r="3.5" />
  <path d="M10.5 12h3" />
  <path d="M5.5 9v6M18.5 9v6" />
</>)

/* Expediente: documento con esquina doblada sobre una hoja de fondo. */
export const IconExpediente = make('IconExpediente', <>
  <path d="M8 2h7l5 5v12a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Z" />
  <path d="M15 2v5h5" />
  <path d="M4 6v15a1 1 0 0 0 1 1h11" />
  <path d="M10.5 12h6M10.5 16h4" />
</>)

/* Ranking: podio de tres alturas con el 1 encima del central. */
export const IconRanking = make('IconRanking', <>
  <path d="M9 21V10a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v11" />
  <path d="M9 21H3v-6a1 1 0 0 1 1-1h5" />
  <path d="M15 21h6v-4a1 1 0 0 0-1-1h-5" />
  <path d="m11 5 1-1v3" />
</>)

/* Sesión QR: marco de escaneo con módulos de código. */
export const IconSesionQR = make('IconSesionQR', <>
  <path d="M3 7V4a1 1 0 0 1 1-1h3M17 3h3a1 1 0 0 1 1 1v3M21 17v3a1 1 0 0 1-1 1h-3M7 21H4a1 1 0 0 1-1-1v-3" />
  <rect x="6.5" y="6.5" width="4" height="4" rx=".5" />
  <rect x="13.5" y="6.5" width="4" height="4" rx=".5" />
  <rect x="6.5" y="13.5" width="4" height="4" rx=".5" />
  <path d="M13.5 13.5h4v4M13.5 17.5h.01" />
</>)

/* Alumnos en riesgo: persona con triángulo de alerta. */
export const IconRiesgo = make('IconRiesgo', <>
  <circle cx="8" cy="6.5" r="3" />
  <path d="M2.5 20v-1a5.5 5.5 0 0 1 8.2-4.8" />
  <path d="M15 10.8a1.2 1.2 0 0 1 2 0l4.6 8.4a1.2 1.2 0 0 1-1 1.8h-9.2a1.2 1.2 0 0 1-1-1.8Z" />
  <path d="M16 14.5v2.2" />
  <path d="M16 19h.01" />
</>)

/** Mapa por clave semántica, para elegir el icono desde datos. */
export const KPI_ICONS = {
  alumnos:    IconAlumnos,
  asistencia: IconAsistencia,
  retardos:   IconRetardos,
  faltas:     IconFaltas,
  promedio:   IconPromedio,
  grupos:     IconGrupos,
  pagos:      IconPagos,
  adeudos:    IconAdeudos,
  expediente: IconExpediente,
  ranking:    IconRanking,
  sesionQR:   IconSesionQR,
  riesgo:     IconRiesgo,
}
