/*
 * Días de descanso obligatorio en México (Ley Federal del Trabajo, art. 74),
 * más las fechas propias que administración añada en Configuración.
 *
 * Es la referencia mientras no lleguen los informes con el calendario escolar
 * de CEFIMAT: entonces se cargan como fechas propias y conviven con estas.
 */
import { loadSettings } from './settings'

const iso = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`

/** n-ésimo lunes (1 = primero) de un mes (1–12). */
function enesimoLunes(y, m, n) {
  const d = new Date(y, m - 1, 1)
  const primero = 1 + ((8 - d.getDay()) % 7)   // día del primer lunes
  return primero + (n - 1) * 7
}

/** Festivos oficiales de un año: [{ fecha, titulo, tipo: 'feriado', oficial: true }]. */
export function feriadosOficiales(y) {
  const lista = [
    [iso(y, 1, 1), 'Año Nuevo'],
    [iso(y, 2, enesimoLunes(y, 2, 1)), 'Día de la Constitución'],
    [iso(y, 3, enesimoLunes(y, 3, 3)), 'Natalicio de Benito Juárez'],
    [iso(y, 5, 1), 'Día del Trabajo'],
    [iso(y, 9, 16), 'Día de la Independencia'],
    [iso(y, 11, enesimoLunes(y, 11, 3)), 'Día de la Revolución'],
    [iso(y, 12, 25), 'Navidad'],
  ]
  // Transmisión del Poder Ejecutivo Federal: 1 de octubre cada seis años (2024, 2030…).
  if ((y - 2024) % 6 === 0) lista.push([iso(y, 10, 1), 'Transmisión del Poder Ejecutivo'])
  return lista.map(([fecha, titulo]) => ({ fecha, titulo, tipo: 'feriado', oficial: true }))
}

/**
 * Mapa fecha → [eventos] para los años indicados: oficiales + los de
 * Configuración (`settings.calendario`).
 */
export function eventosCalendario(anios, propios = loadSettings().calendario ?? []) {
  const mapa = new Map()
  const meter = ev => { if (!mapa.has(ev.fecha)) mapa.set(ev.fecha, []); mapa.get(ev.fecha).push(ev) }
  for (const y of anios) feriadosOficiales(y).forEach(meter)
  for (const ev of propios) if (ev?.fecha && anios.includes(+ev.fecha.slice(0, 4))) meter({ ...ev, tipo: ev.tipo ?? 'evento' })
  return mapa
}

export const TIPOS_EVENTO = [
  { id: 'feriado', label: 'Día sin clases', tono: 'bad' },
  { id: 'inicio',  label: 'Inicio / fin de curso', tono: 'good' },
  { id: 'evento',  label: 'Evento', tono: 'info' },
]
export const tonoEvento = tipo => TIPOS_EVENTO.find(t => t.id === tipo)?.tono ?? 'info'
