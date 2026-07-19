import { createContext, useContext, useState } from 'react'
import { loginWithDb, fetchSubAdminAccess } from '../lib/supabaseData'

const AuthContext = createContext(null)

const SUCURSALES = ['CN1', 'CN2', 'CN3']
const SESSION_KEY = 'edutrack_session'

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

  const login = async (email, password) => {
    const res = await loginWithDb(email, password)
    if (!res.ok) return { ok: false, message: res.message }
    let user = res.user
    if (user.role === 'sub_admin') {
      const access = await fetchSubAdminAccess(user.id)
      user = { ...user, access }
    }
    persist(user)
    return { ok: true, role: user.role }
  }

  const logout = () => persist(null)

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
