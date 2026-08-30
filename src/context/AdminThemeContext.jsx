import { createContext, useContext, useState, useEffect } from 'react'
import { TOKENS } from './StudentThemeContext'

const APP_KEY = 'siga_admin_appearance'
const MOV_KEY = 'siga_a11y_movimiento'
const TXT_KEY = 'siga_a11y_texto'
const Ctx = createContext(null)

const leer = (clave, porDefecto) => {
  try { return localStorage.getItem(clave) || porDefecto } catch { return porDefecto }
}

export function AdminThemeProvider({ children }) {
  const [appearance, setAppearanceState] = useState(() => leer(APP_KEY, 'default'))
  const setAppearance = id => { setAppearanceState(id); localStorage.setItem(APP_KEY, id) }

  /* ── Accesibilidad ───────────────────────────────────────────────────────
     Dos ajustes, no una lista: son los que de verdad estorban en esta
     aplicación. El movimiento, porque el fondo de cada grupo es un shader
     animado y las páginas entran con una transición —incómodo para quien es
     sensible al movimiento, y caro en un equipo modesto—. Y el tamaño del
     texto, porque las hojas de calificaciones y asistencia son densas y se
     leen a diario. */
  const [movimiento, setMovimientoState] = useState(() => leer(MOV_KEY, 'normal'))
  const [texto, setTextoState] = useState(() => leer(TXT_KEY, 'normal'))

  const setMovimiento = v => { setMovimientoState(v); localStorage.setItem(MOV_KEY, v) }
  const setTexto      = v => { setTextoState(v);      localStorage.setItem(TXT_KEY, v) }

  /* Los atributos van en <html> y no en el contenedor del panel: el tamaño de
     texto se escala con `rem`, que se mide contra la raíz, y los portales
     (modales, menús) cuelgan de <body>, fuera de cualquier contenedor. */
  useEffect(() => {
    const raiz = document.documentElement
    raiz.dataset.movimiento = movimiento
    raiz.dataset.texto = texto
    return () => { delete raiz.dataset.movimiento; delete raiz.dataset.texto }
  }, [movimiento, texto])

  const t = TOKENS[appearance] ?? TOKENS.default

  return (
    <Ctx.Provider value={{
      appearance, setAppearance, t,
      movimiento, setMovimiento, texto, setTexto,
      /* Atajo para quien sólo necesita saber si puede animar. */
      sinMovimiento: movimiento === 'reducido',
    }}>
      {children}
    </Ctx.Provider>
  )
}

/* Fallback a tokens oscuros si se usa fuera del provider */
export const useAdminTheme = () => useContext(Ctx) ?? {
  appearance: 'default', t: TOKENS.default, setAppearance: () => {},
  movimiento: 'normal', setMovimiento: () => {},
  texto: 'normal', setTexto: () => {},
  sinMovimiento: false,
}
