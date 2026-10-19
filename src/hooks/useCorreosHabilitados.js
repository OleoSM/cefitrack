import { useEffect, useState } from 'react'
import { fetchCorreosHabilitados } from '../lib/comunicacionesData'

/*
 * Interruptor general del envío de correos (`configuracion.correos_habilitados`).
 * Se consulta una vez y se comparte entre pantallas; al cambiarlo desde
 * Configuración, `avisarCambioCorreos` actualiza a todas las que están abiertas.
 * La regla de verdad está en el servidor: con el interruptor apagado las
 * funciones de envío rechazan cualquier correo aunque la pantalla se equivoque.
 */
let valor = null            // null = aún no se sabe
let consulta = null
const oyentes = new Set()

export function avisarCambioCorreos(nuevo) {
  valor = nuevo
  oyentes.forEach(fn => fn(nuevo))
}

export function useCorreosHabilitados() {
  const [habilitados, setHabilitados] = useState(valor)
  useEffect(() => {
    oyentes.add(setHabilitados)
    if (valor === null) {
      consulta ??= fetchCorreosHabilitados().then(v => { avisarCambioCorreos(v); return v })
        .catch(() => { consulta = null; return null })
    } else setHabilitados(valor)
    return () => { oyentes.delete(setHabilitados) }
  }, [])
  return habilitados
}
