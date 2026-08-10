import { useEffect, useState } from 'react'
import { fetchSucursales } from '../lib/supabaseData'

/**
 * Catálogo de sucursales, con su nombre para mostrar.
 *
 * Existe porque `groups.sucursal` y `students.sucursal` guardan un
 * identificador ('neza1'), no el nombre ('Neza 1'). Sin esta traducción la
 * interfaz enseñaría el identificador, que es exactamente lo que se quiso
 * quitar al pasar de CN1/CN2/CN3 a nombres propios.
 *
 * El catálogo tiene cuatro filas y no cambia durante una sesión, así que se
 * pide una vez por carga de página y se comparte entre todos los componentes
 * que lo usen: sin esta caché, cada tabla y cada filtro dispararía su propia
 * consulta para leer lo mismo.
 */
let cache = null
let enVuelo = null

export function useSucursales() {
  const [sucursales, setSucursales] = useState(cache ?? [])

  useEffect(() => {
    if (cache) return
    let vivo = true
    enVuelo = enVuelo ?? fetchSucursales().then(rows => { cache = rows; return rows })
    enVuelo
      .then(rows => { if (vivo) setSucursales(rows) })
      .catch(() => { enVuelo = null })   // se reintenta en el próximo montaje
    return () => { vivo = false }
  }, [])

  /* Si el catálogo aún no llegó, o el identificador no está en él, se devuelve
     el valor crudo en vez de una cadena vacía: es preferible ver 'neza1' a ver
     un hueco donde debería ir la sucursal. */
  const nombreDe = id =>
    id == null ? '' : (sucursales.find(s => s.id === id)?.nombre ?? id)

  return { sucursales, nombreDe }
}
