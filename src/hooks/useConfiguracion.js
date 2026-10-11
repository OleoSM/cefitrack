import { useEffect, useState } from 'react'
import { loadSettings, syncSettings, EVENTO_SETTINGS } from '../lib/settings'

/**
 * Configuración global (pesos del promedio, tolerancia…) que se mantiene al
 * día. Arranca con la copia local y se actualiza cuando llega la de la BD,
 * así los cálculos que dependen de los pesos (ranking, promedio ponderado)
 * no se quedan con valores viejos tras iniciar sesión.
 */
export function useConfiguracion() {
  const [settings, setSettings] = useState(loadSettings)
  useEffect(() => {
    let vivo = true
    const alCambiar = e => { if (vivo) setSettings(e.detail ?? loadSettings()) }
    window.addEventListener(EVENTO_SETTINGS, alCambiar)
    syncSettings().then(s => { if (vivo) setSettings(s) }).catch(() => {})
    return () => { vivo = false; window.removeEventListener(EVENTO_SETTINGS, alCambiar) }
  }, [])
  return settings
}
