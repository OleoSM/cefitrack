import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

/* Tras cada despliegue, una pestaña que seguía abierta tiene la versión
   anterior y, al cambiar de pantalla, pide archivos (chunks) que ya no
   existen: la pantalla se quedaba en blanco con "Failed to fetch dynamically
   imported module". Vite avisa con `vite:preloadError`; se recarga la página
   UNA vez para tomar la versión nueva (la marca evita un ciclo de recargas
   si el problema fuera otro). */
const CLAVE_RECARGA = 'siga_recarga_version'
window.addEventListener('vite:preloadError', (e) => {
  e.preventDefault()
  let ultima = 0
  try { ultima = Number(sessionStorage.getItem(CLAVE_RECARGA)) || 0 } catch { /* sin storage */ }
  if (Date.now() - ultima < 30_000) return
  try { sessionStorage.setItem(CLAVE_RECARGA, String(Date.now())) } catch { /* sin storage */ }
  window.location.reload()
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
