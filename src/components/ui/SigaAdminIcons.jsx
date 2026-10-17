// src/components/ui/SigaAdminIcons.jsx
//
// Iconos propios del PANEL DE ADMINISTRACIÓN de SIGA. Misma gramática que
// SigaKpiIcons y lucide (24×24, trazo redondo, 1.75, currentColor).
// Primera versión generada con Codex (solo lectura) y revisada a mano: se
// simplificaron Alumno (la cara se encimaba con la cabeza), Cobros (el signo
// de pesos eran 6 trazos ilegibles a 16 px y la flecha cruzaba el billete) y
// Ajustes (el control deslizante se encimaba con el engrane).
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

export const IconPanel = make('IconPanel', <>
  <rect x="3" y="3" width="8" height="8" rx="1.5" />
  <rect x="13" y="3" width="8" height="8" rx="1.5" />
  <rect x="3" y="13" width="8" height="8" rx="1.5" />
  <rect x="13" y="13" width="8" height="8" rx="1.5" />
  <path d="M15 18v-2M18 18v-3M15 18h4" />
</>)

export const IconGrupos2 = make('IconGrupos2', <>
  <path d="M3 4h18v8H3z" />
  <path d="M5 12v2M19 12v2M3 14h18" />
  <circle cx="6" cy="17" r="1.5" />
  <circle cx="12" cy="17" r="1.5" />
  <circle cx="18" cy="17" r="1.5" />
  <path d="M4.5 21v-1a1.5 1.5 0 0 1 3 0v1M10.5 21v-1a1.5 1.5 0 0 1 3 0v1M16.5 21v-1a1.5 1.5 0 0 1 3 0v1" />
</>)

export const IconAlumno = make('IconAlumno', <>
  <path d="m3 6 9-4 9 4-9 4Z" />
  <path d="M21 6v4" />
  <circle cx="12" cy="14" r="3" />
  <path d="M6.5 22a5.5 5.5 0 0 1 11 0" />
</>)

export const IconHojaCalificaciones = make('IconHojaCalificaciones', <>
  <path d="M5 3h10l4 4v14H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
  <path d="M15 3v4h4" />
  <path d="M7 10h3M7 13h3M7 16h3M7 19h3M12 10v9M15 11h3M15 14h3M15 17h3" />
  <path d="m13 7 1 1 2-2" />
</>)

export const IconPasarLista = make('IconPasarLista', <>
  <rect x="5" y="4" width="15" height="17" rx="2" />
  <path d="M9 4V3h7v1M9 9h7M9 14h7M9 18h7" />
  <path d="m6.5 9 1 1 2-2M6.5 14l1 1 2-2M6.5 18l1 1 2-2" />
</>)

export const IconExamen = make('IconExamen', <>
  <path d="M5 3h10l4 4v10" />
  <path d="M15 3v4h4M5 7v14h10" />
  <rect x="7.5" y="9" width="2.5" height="2.5" rx=".4" />
  <path d="m8 10.2.7.7 1-1.2" />
  <rect x="12" y="9" width="3" height="2.5" rx=".4" />
  <rect x="7.5" y="14" width="2.5" height="2.5" rx=".4" />
  <path d="M12 15.2h3" />
  <path d="m15 19 5-5 2 2-5 5-2 .5Z" />
</>)

/* Materiales: carpeta con un reloj — archivos que se borran solos al vencer. */
export const IconMateriales = make('IconMateriales', <>
  <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v2" />
  <path d="M3 7v11a2 2 0 0 0 2 2h7" />
  <circle cx="17.5" cy="16.5" r="4.5" />
  <path d="M17.5 14.2v2.3l1.6 1" />
</>)

export const IconPodio = make('IconPodio', <>
  <path d="M3 20h18" />
  <path d="M4 20v-5h5v5M9.5 20V9h5v11M15 20v-7h5v7" />
  <path d="m12 2 .9 1.8 2 .3-1.5 1.4.4 2-1.8-.9-1.8.9.4-2-1.5-1.4 2-.3Z" />
</>)

export const IconFirma = make('IconFirma', <>
  <path d="M5 3h10l4 4v8" />
  <path d="M15 3v4h4M5 7v14h8" />
  <path d="M8 11h7M8 14h4" />
  <path d="m12 19 6-6 2 2-6 6-3 1Z" />
</>)

export const IconCobros = make('IconCobros', <>
  <rect x="2" y="9" width="16" height="11" rx="2" />
  <circle cx="10" cy="14.5" r="2.5" />
  <path d="M5.5 14.5h.01M14.5 14.5h.01" />
  <path d="m16 7 5-5M17 2h4v4" />
</>)

export const IconCorreoMasivo = make('IconCorreoMasivo', <>
  <rect x="3" y="7" width="16" height="13" rx="2" />
  <path d="m4 9 7 5 7-5" />
  <path d="M7 4h13a2 2 0 0 1 2 2v10" />
</>)

export const IconAjustes = make('IconAjustes', <>
  <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" />
  <circle cx="12" cy="12" r="7" />
  <circle cx="12" cy="12" r="2.5" />
</>)

export const IconAcceso = make('IconAcceso', <>
  <path d="M12 2 20 5v6c0 5-3.5 8.5-8 11-4.5-2.5-8-6-8-11V5Z" />
  <circle cx="11" cy="11" r="2" />
  <path d="M13 11h5v2h-2v2h-2v-2h-1" />
</>)

// Medidor: consumo de la API de IA y de correos.
export const IconConsumo = make('IconConsumo', <>
  <path d="M4 17a8 8 0 1 1 16 0" />
  <path d="M12 17l3.5-5" />
  <circle cx="12" cy="17" r="1.4" />
  <path d="M7 14h.01M9 10h.01M12 9h.01" />
  <path d="M4 21h16" />
</>)

export const IconCuenta = make('IconCuenta', <>
  <rect x="3" y="4" width="18" height="16" rx="2" />
  <circle cx="8" cy="10" r="2" />
  <path d="M5 16a3 3 0 0 1 6 0M14 8h4M14 11h4" />
  <rect x="14" y="14" width="6" height="5" rx="1" />
  <path d="M15.5 14v-1a1.5 1.5 0 0 1 3 0v1" />
</>)

export const IconReporte = make('IconReporte', <>
  <path d="M5 3h10l4 4v7" />
  <path d="M15 3v4h4M5 7v14h10" />
  <path d="M8 17v-3M11 17v-5M14 17v-2" />
  <path d="M18 13v8M15.5 18.5 18 21l2.5-2.5" />
</>)

export const IconResumen = make('IconResumen', <>
  <rect x="3" y="4" width="18" height="16" rx="2" />
  <path d="M6 15h3l2-5 3 7 2-4h2" />
  <path d="M6 8h2M16 8h2" />
</>)

export const IconQrAlumno = make('IconQrAlumno', <>
  <path d="M3 8V4a1 1 0 0 1 1-1h4M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H4a1 1 0 0 1-1-1v-4" />
  <rect x="5.5" y="5.5" width="4" height="4" rx=".5" />
  <rect x="14.5" y="5.5" width="4" height="4" rx=".5" />
  <rect x="5.5" y="14.5" width="4" height="4" rx=".5" />
  <path d="M14.5 14.5h4v2.5" />
  <circle cx="18" cy="18" r="1.5" />
  <path d="M15.5 21a2.5 2.5 0 0 1 5 0" />
</>)

export const ADMIN_ICONS = {
  panel: IconPanel,
  grupos: IconGrupos2,
  alumno: IconAlumno,
  hojaCalificaciones: IconHojaCalificaciones,
  pasarLista: IconPasarLista,
  examen: IconExamen,
  podio: IconPodio,
  firma: IconFirma,
  cobros: IconCobros,
  correoMasivo: IconCorreoMasivo,
  ajustes: IconAjustes,
  acceso: IconAcceso,
  cuenta: IconCuenta,
  reporte: IconReporte,
  resumen: IconResumen,
  qrAlumno: IconQrAlumno,
}