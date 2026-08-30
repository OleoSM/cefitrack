import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { useSucursales } from './useSucursales'

/**
 * La sucursal en la que se está trabajando, compartida por todas las vistas.
 *
 * Dos problemas que resuelve:
 *
 *  1. Cada pantalla arrancaba en «todas las sucursales», así que lo primero que
 *     veía cualquiera era la lista entera —28 grupos y 500 evaluaciones de
 *     cinco sedes— y tenía que acotar otra vez en cada página. Ahora arranca en
 *     UNA sucursal: la que se estuviera usando, o la primera a la que se tiene
 *     acceso. «Todas» sigue estando, pero se elige a propósito.
 *
 *  2. La elección no viajaba entre vistas: acotabas en Grupos, entrabas a Pasar
 *     Lista y volvías a empezar. El valor vive en un almacén de módulo y se
 *     guarda en el navegador, así que se mantiene al navegar y al recargar.
 *
 * Es preferencia de VISTA, no dato del centro: por eso va en `localStorage` y no
 * en la base. Dos administradores pueden estar mirando sedes distintas a la vez
 * sin estorbarse — al revés que el color del grupo, que sí es de todos.
 */
const CLAVE = 'siga_sucursal_activa'
export const TODAS = 'todas'

let valor = null
const oyentes = new Set()

function leer() {
  if (valor !== null) return valor
  try { valor = localStorage.getItem(CLAVE) } catch { valor = null }
  return valor
}

function escribir(next) {
  valor = next
  try { localStorage.setItem(CLAVE, next) } catch { /* modo privado */ }
  oyentes.forEach(fn => fn(next))
}

export function useSucursalActiva() {
  const { currentUser, allowedSucursales } = useAuth()
  const { sucursales: catalogo, nombreDe } = useSucursales()
  const esAdmin = currentUser?.role === 'admin'

  const [elegida, setElegida] = useState(leer)

  useEffect(() => {
    const sync = next => setElegida(next)
    oyentes.add(sync)
    return () => { oyentes.delete(sync) }
  }, [])

  /* El administrador alcanza el catálogo entero; el sub-admin, sólo donde
     tiene acceso concedido. Mientras el catálogo viaja la lista está vacía. */
  const opciones = useMemo(
    () => catalogo.filter(s => esAdmin || allowedSucursales.includes(s.id)),
    [catalogo, esAdmin, allowedSucursales],
  )

  /* Si no hay nada elegido —primera vez— o lo elegido ya no está a su alcance
     —le retiraron el acceso, o se cerró la sede—, se cae a la primera
     disponible en vez de dejar la vista en un filtro que no existe. */
  useEffect(() => {
    if (!opciones.length) return
    const valida = elegida === TODAS || opciones.some(s => s.id === elegida)
    if (!valida) escribir(opciones[0].id)
  }, [opciones, elegida])

  const sucursal = elegida ?? (opciones[0]?.id ?? TODAS)

  const setSucursal = useCallback(next => escribir(next), [])

  return {
    sucursal,
    setSucursal,
    opciones,
    nombreDe,
    esTodas: sucursal === TODAS,
    /* Para los <select>: «Todas» al final, porque es la excepción y no el
       punto de partida. */
    opcionesConTodas: [
      ...opciones.map(s => ({ value: s.id, label: s.nombre })),
      { value: TODAS, label: esAdmin ? 'Todas las sucursales' : 'Todas mis sucursales' },
    ],
  }
}

/** ¿Cae este grupo dentro de la sucursal activa? */
export const enSucursal = (grupo, sucursal) =>
  sucursal === TODAS || grupo?.sucursal === sucursal
