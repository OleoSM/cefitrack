import { createContext, useContext, useState, useEffect } from 'react'
import {
  loginWithDb, loginConAuth, sesionActual, cerrarSesion, fetchSubAdminAccess,
} from '../lib/supabaseData'

const AuthContext = createContext(null)

const SUCURSALES = ['CN1', 'CN2', 'CN3']
const SESSION_KEY = 'edutrack_session'

/**
 * Interruptor de la migración a Supabase Auth.
 *
 * Con `VITE_AUTH_LEGACY=1` se vuelve al inicio de sesión anterior contra la
 * tabla `users`. Existe para poder revertir en caliente si algo sale mal: la
 * migración cambia cómo entra TODO el mundo, y la vuelta atrás no debería
 * depender de un despliegue.
 *
 * Cuando la migración se dé por asentada, esto y `loginWithDb` se retiran.
 */
const USAR_LEGACY = import.meta.env.VITE_AUTH_LEGACY === '1'

function readStoredSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const user = JSON.parse(raw)
    return user && user.id && user.role ? user : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(readStoredSession)

  const persist = (user) => {
    setCurrentUser(user)
    try {
      if (user) localStorage.setItem(SESSION_KEY, JSON.stringify(user))
      else localStorage.removeItem(SESSION_KEY)
    } catch {
      // storage no disponible (modo privado); la sesión vive solo en memoria
    }
  }

  /* Con Supabase Auth la sesión la gobierna la librería, no localStorage: al
     recargar hay que preguntarle a ella, o quedaría una sesión "fantasma" en
     la interfaz cuyo token ya caducó y cuyas consultas fallarían. */
  useEffect(() => {
    if (USAR_LEGACY) return
    let vivo = true
    sesionActual()
      .then(async user => {
        if (!vivo) return
        if (!user) { persist(null); return }
        if (user.role === 'sub_admin') {
          const access = await fetchSubAdminAccess(user.id)
          if (vivo) persist({ ...user, access })
        } else {
          persist(user)
        }
      })
      .catch(() => { if (vivo) persist(null) })
    return () => { vivo = false }
  }, [])

  const login = async (email, password) => {
    const res = USAR_LEGACY
      ? await loginWithDb(email, password)
      : await loginConAuth(email, password)
    if (!res.ok) return { ok: false, message: res.message }

    let user = res.user
    if (user.role === 'sub_admin') {
      const access = await fetchSubAdminAccess(user.id)
      user = { ...user, access }
    }
    persist(user)
    return { ok: true, role: user.role }
  }

  const logout = async () => {
    if (!USAR_LEGACY) await cerrarSesion()
    persist(null)
  }

  const allowedSucursales =
    currentUser?.role === 'admin'
      ? SUCURSALES
      : [...new Set((currentUser?.access ?? []).map(a => a.sucursal))]

  const canAccess = (sucursal, groupId) => {
    if (!currentUser) return false
    if (currentUser.role === 'admin') return true
    if (currentUser.role !== 'sub_admin') return false
    return (currentUser.access ?? []).some(
      a => a.sucursal === sucursal && (a.groupId == null || a.groupId === groupId)
    )
  }

  return (
    <AuthContext.Provider value={{ currentUser, login, logout, allowedSucursales, canAccess }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
