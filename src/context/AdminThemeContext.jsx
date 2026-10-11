import { createContext, useContext, useState, useEffect } from 'react'
import { TOKENS } from './StudentThemeContext'

const APP_KEY = 'siga_admin_appearance'
const MOV_KEY = 'siga_a11y_movimiento'
const TXT_KEY = 'siga_a11y_texto'
const Ctx = createContext(null)

const leer = (clave, porDefecto) => {
  try { return localStorage.getItem(clave) || porDefecto } catch { return porDefecto }
}

/* ── Accesibilidad ─────────────────────────────────────────────────────────
   Hook propio para que lo use también la vista del alumno (que no vive bajo
   AdminThemeProvider): mismas claves de localStorage, así la preferencia es
   de la persona y del navegador, no de un panel. */
export function useAccesibilidadEstado() {
  const [movimiento, setMovimientoState] = useState(() => leer(MOV_KEY, 'normal'))
  const [texto, setTextoState] = useState(() => leer(TXT_KEY, 'normal'))
  const setMovimiento = v => { setMovimientoState(v); try { localStorage.setItem(MOV_KEY, v) } catch { /* privado */ } }
  const setTexto      = v => { setTextoState(v);      try { localStorage.setItem(TXT_KEY, v) } catch { /* privado */ } }
  useEffect(() => {
    const raiz = document.documentElement
    raiz.dataset.movimiento = movimiento
    raiz.dataset.texto = texto
    return () => { delete raiz.dataset.movimiento; delete raiz.dataset.texto }
  }, [movimiento, texto])
  return { movimiento, setMovimiento, texto, setTexto }
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
  /* Los atributos van en <html> y no en el contenedor del panel: el tamaño de
     texto se escala con `rem`, que se mide contra la raíz, y los portales
     (modales, menús) cuelgan de <body>, fuera de cualquier contenedor. */
  const { movimiento, setMovimiento, texto, setTexto } = useAccesibilidadEstado()

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
