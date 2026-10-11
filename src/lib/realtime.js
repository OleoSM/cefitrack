// Nombres únicos para canales de Supabase Realtime.
//
// `supabase.channel(nombre)` DEVUELVE EL CANAL EXISTENTE si ya hay uno con ese
// nombre, y `removeChannel` solo lo saca de la lista cuando el servidor
// confirma la baja (asíncrono). Si una pantalla se vuelve a montar antes —en
// desarrollo React monta cada efecto dos veces (StrictMode); en producción
// basta con entrar, salir y volver rápido— se recibía el canal viejo, ya
// suscrito, y `.on()` lanzaba "cannot add callbacks after subscribe()": la
// pantalla se quedaba sin datos en vivo hasta navegar a otra parte y volver.
// Con un sufijo por montaje cada efecto tiene su propio canal.
export const nombreCanal = base =>
  `${base}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`
