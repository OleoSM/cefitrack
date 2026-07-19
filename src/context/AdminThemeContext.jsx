import { createContext, useContext, useState } from 'react'
import { TOKENS } from './StudentThemeContext'

const APP_KEY = 'siga_admin_appearance'
const Ctx = createContext(null)

export function AdminThemeProvider({ children }) {
  const [appearance, setAppearanceState] = useState(() => localStorage.getItem(APP_KEY) || 'default')
  const setAppearance = id => { setAppearanceState(id); localStorage.setItem(APP_KEY, id) }
  const t = TOKENS[appearance] ?? TOKENS.default

  return (
    <Ctx.Provider value={{ appearance, setAppearance, t }}>
      {children}
    </Ctx.Provider>
  )
}

/* Fallback a tokens oscuros si se usa fuera del provider */
export const useAdminTheme = () => useContext(Ctx) ?? {
  appearance: 'default', t: TOKENS.default, setAppearance: () => {},
}
