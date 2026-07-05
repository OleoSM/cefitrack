// Punto único de integración para notificaciones por correo.
// Hoy el envío es SIMULADO (no hay backend). Cuando exista un backend
// (p. ej. Supabase Edge Function + Resend/SendGrid), solo se reemplaza
// el cuerpo de esta función — el resto de la app ya la consume.
export function sendNotification(type, recipient, payload = {}) {
  console.info('[SIGA · notificación simulada]', { type, recipient, ...payload })
  return { ok: true, simulated: true }
}

export const NOTIF_EVENTS = [
  { id: 'nuevoExamen',        label: 'Nuevo examen programado',   desc: 'Avisa al alumno y a su tutor cuando se agenda un simulacro o examen.' },
  { id: 'resultadoPublicado', label: 'Resultado publicado',       desc: 'Envía la calificación al tutor cuando se captura un resultado.' },
  { id: 'ausencia',           label: 'Ausencia registrada',       desc: 'Notifica al tutor el mismo día si el alumno faltó a clase.' },
]
