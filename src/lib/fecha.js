// Fecha "de hoy" en la hora de México, no en UTC.
// `new Date().toISOString()` da la fecha UTC: a partir de las 18:00 en
// México ya es el día siguiente, y las listas, pagos y evaluaciones quedaban
// fechados con el día de mañana.
const ZONA = 'America/Mexico_City'

/** 'YYYY-MM-DD' del día actual en México. */
export const todayISO = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: ZONA }).format(new Date())
