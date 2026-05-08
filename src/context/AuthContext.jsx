import { createContext, useContext, useState } from 'react'
import { users } from '../data/mockData'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null)

  const login = (email, password) => {
    const user = users.find(u => u.email === email && u.password === password)
    if (!user) return { ok: false, message: 'Correo o contraseña incorrectos.' }
    setCurrentUser(user)
    return { ok: true, role: user.role }
  }

  const logout = () => setCurrentUser(null)

  return (
    <AuthContext.Provider value={{ currentUser, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
