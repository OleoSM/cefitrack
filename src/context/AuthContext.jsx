import { createContext, useContext, useState } from 'react'
import { loginWithDb } from '../lib/supabaseData'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null)

  const login = async (email, password) => {
    const res = await loginWithDb(email, password)
    if (!res.ok) return { ok: false, message: res.message }
    setCurrentUser(res.user)
    return { ok: true, role: res.user.role }
  }

  const logout = () => setCurrentUser(null)

  return (
    <AuthContext.Provider value={{ currentUser, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
