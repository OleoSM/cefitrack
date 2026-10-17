import { createContext, useContext, useState, useEffect } from 'react'
import {
  loginWithDb, loginConAuth, sesionActual, cerrarSesion, fetchSubAdminAccess, fetchMisApartados,
} from '../lib/supabaseData'
import { TODOS_LOS_APARTADOS, APARTADOS_POR_DEFECTO } from '../lib/apartados'

const AuthContext = createContext(null)

/* Antes aqui vivia ['CN1','CN2','CN3'] escrito a mano. Esos codigos ya no
   existen: la nomenclatura oficial los usa para los HORARIOS de Neza 1, no
   para las sucursales. La lista se lee del catalogo, que es la unica fuente
   de verdad desde que `groups.sucursal` es clave foranea. */
import { fetchSucursales, fetchPermisosAltas } from '../lib/supabaseData'
import { syncSettings } from '../lib/settings'
import { supabase } from '../lib/supabaseClient'
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

/* Si la consulta de apartados falla, el sub-admin no debe quedarse sin panel:
   recibe los de siempre. El servidor sigue protegiendo Pagos y Correos. */
const apartadosSeguros = () => fetchMisApartados().catch(() => APARTADOS_POR_DEFECTO)
/* Permiso de altas y bajas de alumnos y si es dueño (Dayan / Mauricio). Ante
   un fallo, sin permiso: el servidor lo vuelve a comprobar de todos modos. */
const permisosSeguros = () => fetchPermisosAltas().catch(() => ({ puedeDarAltas: false, esDueno: false }))

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
  const [catalogo, setCatalogo] = useState([])

  /* El catálogo de sucursales sólo hace falta cuando hay sesión: sin ella no
     hay nada que filtrar, y pedirlo en la pantalla de login sería una consulta
     que siempre sobra. */
  useEffect(() => {
    if (!currentUser) { setCatalogo([]); return }
    let vivo = true
    fetchSucursales()
      .then(rows => { if (vivo) setCatalogo(rows) })
      .catch(() => { /* la interfaz cae a lista vacía; no bloquea la sesión */ })
    return () => { vivo = false }
  }, [currentUser?.id])

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
        syncSettings().catch(() => {})
        if (user.role === 'sub_admin') {
          const [access, apartados, permisos] = await Promise.all([fetchSubAdminAccess(user.id), apartadosSeguros(), permisosSeguros()])
          if (vivo) persist({ ...user, access, apartados, ...permisos })
        } else if (user.role === 'admin') {
          const permisos = await permisosSeguros()
          if (vivo) persist({ ...user, ...permisos })
        } else {
          persist(user)
        }
      })
      .catch(() => { if (vivo) persist(null) })
    return () => { vivo = false }
  }, [])

  /* Si Supabase cierra la sesión por su cuenta (token revocado, cuenta
     retirada, cierre en otra pestaña), la interfaz no debe seguir "logueada"
     con consultas que ya fallan. */
  useEffect(() => {
    if (USAR_LEGACY) return
    const { data } = supabase.auth.onAuthStateChange(evento => {
      if (evento === 'SIGNED_OUT') persist(null)
    })
    return () => data?.subscription?.unsubscribe()
  }, [])

  /* Un admin puede cambiar los apartados de un sub-admin mientras este trabaja:
     se vuelven a pedir al regresar a la pestaña, sin obligarle a salir y entrar. */
  useEffect(() => {
    if (currentUser?.role !== 'sub_admin') return undefined
    const alVolver = () => {
      if (document.visibilityState !== 'visible') return
      fetchMisApartados()
        .then(apartados => setCurrentUser(u => {
          if (!u || u.role !== 'sub_admin' || u.apartados?.join() === apartados.join()) return u
          const nuevo = { ...u, apartados }
          try { localStorage.setItem(SESSION_KEY, JSON.stringify(nuevo)) } catch { /* sin storage */ }
          return nuevo
        }))
        .catch(() => {})
    }
    document.addEventListener('visibilitychange', alVolver)
    return () => document.removeEventListener('visibilitychange', alVolver)
  }, [currentUser?.role])

  const login = async (email, password) => {
    const res = USAR_LEGACY
      ? await loginWithDb(email, password)
      : await loginConAuth(email, password)
    if (!res.ok) return { ok: false, message: res.message }

    let user = res.user
    syncSettings().catch(() => {})
    if (user.role === 'sub_admin') {
      const [access, apartados, permisos] = await Promise.all([fetchSubAdminAccess(user.id), apartadosSeguros(), permisosSeguros()])
      user = { ...user, access, apartados, ...permisos }
    } else if (user.role === 'admin') {
      user = { ...user, ...(await permisosSeguros()) }
    }
    persist(user)
    return { ok: true, role: user.role }
  }

  const logout = async () => {
    if (!USAR_LEGACY) await cerrarSesion()
    persist(null)
  }

  /* El administrador alcanza TODAS las sucursales, así que su lista es el
     catálogo entero; el sub-admin, sólo aquellas donde tiene acceso concedido.
     Mientras el catálogo viaja, un admin ve la lista vacía por un instante: es
     preferible a servirle una lista escrita a mano que se quedaría obsoleta la
     próxima vez que se abra una plaza. */
  const allowedSucursales =
    currentUser?.role === 'admin'
      ? catalogo.map(s => s.id)
      : [...new Set((currentUser?.access ?? []).map(a => a.sucursal))]

  const canAccess = (sucursal, groupId) => {
    if (!currentUser) return false
    if (currentUser.role === 'admin') return true
    if (currentUser.role !== 'sub_admin') return false
    return (currentUser.access ?? []).some(
      a => a.sucursal === sucursal && (a.groupId == null || a.groupId === groupId)
    )
  }

  /* Apartados del panel: el admin los tiene todos; el sub-admin, los que le
     concedieron (si la consulta falló, los de siempre). */
  const apartados = currentUser?.role === 'admin'
    ? TODOS_LOS_APARTADOS
    : currentUser?.role === 'sub_admin' ? (currentUser.apartados ?? APARTADOS_POR_DEFECTO) : []
  const puedeVer = clave => clave == null || apartados.includes(clave)
  const puedeDarAltas = !!currentUser?.puedeDarAltas
  const esDueno = !!currentUser?.esDueno

  return (
    <AuthContext.Provider value={{ currentUser, login, logout, allowedSucursales, canAccess, apartados, puedeVer, puedeDarAltas, esDueno }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
