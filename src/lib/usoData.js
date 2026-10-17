/*
 * "Uso y consumo" (solo admin): gasto de la API de IA y correos enviados.
 * Los totales los calcula la base (RPC `uso_consumo`) para no traer miles de
 * filas al navegador.
 */
import { supabase } from './supabaseClient'

export async function fetchUsoConsumo() {
  const { data, error } = await supabase.rpc('uso_consumo')
  if (error) throw error
  return data
}

/** Topes: gasto mensual de IA (US$) y correos por día. */
export async function guardarTopes({ asistenteLimiteUsd, correoLimiteDiario }) {
  const { error } = await supabase.from('configuracion')
    .update({ asistente_limite_usd: asistenteLimiteUsd, correo_limite_diario: correoLimiteDiario, updated_at: new Date().toISOString() })
    .eq('id', true)
  if (error) return { ok: false, message: 'No se pudieron guardar los topes.' }
  return { ok: true }
}

/** Serie de los últimos 30 días con ceros donde no hubo actividad. */
export function serie30(filas, campos) {
  const por = Object.fromEntries((filas ?? []).map(f => [f.dia, f]))
  const hoy = new Date()
  return Array.from({ length: 30 }, (_, i) => {
    const d = new Date(hoy); d.setDate(hoy.getDate() - 29 + i)
    const clave = d.toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })
    const f = por[clave] ?? {}
    return { dia: clave, etiqueta: d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }),
      ...Object.fromEntries(campos.map(c => [c, Number(f[c] ?? 0)])) }
  })
}
