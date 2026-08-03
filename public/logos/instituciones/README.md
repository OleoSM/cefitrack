# Logos institucionales

Archivos de identidad para uso dentro de CEFIMAT. Deben conservarse sin
deformación, recoloración, recorte adicional ni cambios de proporción.

| Archivo | Formato | Fuente |
| --- | --- | --- |
| `unam.svg` | SVG oficial azul | FES Zaragoza, UNAM |
| `ipn.webp` | WebP oficial horizontal | Coordinación de Imagen Institucional, IPN |
| `uam.png` | PNG oficial | Comunicación Social, UAM |
| `ecoems.png` | PNG transparente | Extraído del convenio oficial de creación de ECOEMS publicado por CONALEP |

Uso:

```jsx
<img
  src="/logos/instituciones/unam.svg"
  alt="UNAM"
  className="h-10 w-auto object-contain"
/>
```

Asigne una altura y deje el ancho automático. Incluya siempre el nombre de la
institución en `alt`, salvo cuando el logotipo sea puramente decorativo.
