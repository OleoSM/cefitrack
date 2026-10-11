// Estado del expediente del alumno (Términos y Condiciones + documentos).
// Una sola fuente de verdad para la página de Términos (asistente paso a paso)
// y para el indicador del menú lateral, que antes solo miraba si había firma.
//
// Valores en BD:
//   student_documents.status: 'entregado' | 'validado' | 'rechazado'
//   students.garantia_estado: 'pendiente' | 'entregada' | 'validada'
//   students.acceso_estado:   'pendiente' | 'activo'
//   students.terms_status:    'pendiente' | 'firmado'

/** Estado de un documento subido: 'falta' | 'entregado' | 'validado' | 'rechazado'. */
export const estadoDoc = d => (!d ? 'falta' : d.status === 'validado' ? 'validado' : d.status === 'rechazado' ? 'rechazado' : 'entregado')

const ok = e => e === 'entregado' || e === 'validado'

/**
 * `lectura` = { tc, priv }: si el alumno ya marcó como leídos los dos textos
 * (vive en el navegador; una vez firmado se dan por leídos).
 *
 * Devuelve:
 *  - estado: 'aceptado' (acceso activo) | 'error' (algo rechazado, debe volver
 *    a subirlo) | 'revision' (todo entregado, falta que lo valide
 *    administración) | 'alerta' (le falta entregar algo)
 *  - pasos: [{ id, estado: 'hecho'|'rechazado'|'pendiente', motivo? }] en el
 *    orden del asistente
 *  - docs: { curp, ine, garantia, terminos } con el registro de cada uno
 */
export function estadoExpediente(student, documentos = [], lectura = {}) {
  if (!student) return { estado: 'alerta', pasos: [], docs: {}, hechos: 0, total: 5 }
  const doc = tipo => documentos.find(d => d.document_type === tipo) ?? null
  const docs = { curp: doc('curp'), ine: doc('ine_tutor'), garantia: doc('garantia'), terminos: doc('terminos') }
  const e = Object.fromEntries(Object.entries(docs).map(([k, d]) => [k, estadoDoc(d)]))

  const firmado = student.termsStatus === 'firmado'
  // Firmar a mano y subir el PDF también cuenta como firma entregada.
  const firmaOk = firmado || ok(e.terminos)
  const garantiaOk = student.garantiaEstado === 'entregada' || student.garantiaEstado === 'validada' || ok(e.garantia)

  const motivoDe = d => d?.rejection_reason || null
  const pasos = [
    { id: 'tc',   estado: (lectura.tc || firmaOk) ? 'hecho' : 'pendiente' },
    { id: 'priv', estado: (lectura.priv || firmaOk) ? 'hecho' : 'pendiente' },
    {
      id: 'docs',
      estado: (e.curp === 'rechazado' || e.ine === 'rechazado') ? 'rechazado'
        : (ok(e.curp) && ok(e.ine)) ? 'hecho' : 'pendiente',
      motivo: motivoDe(e.curp === 'rechazado' ? docs.curp : e.ine === 'rechazado' ? docs.ine : null),
    },
    {
      id: 'garantia',
      estado: garantiaOk ? 'hecho' : e.garantia === 'rechazado' ? 'rechazado' : 'pendiente',
      motivo: e.garantia === 'rechazado' ? motivoDe(docs.garantia) : null,
    },
    {
      id: 'firma',
      estado: firmaOk ? 'hecho' : e.terminos === 'rechazado' ? 'rechazado' : 'pendiente',
      motivo: e.terminos === 'rechazado' ? motivoDe(docs.terminos) : null,
    },
  ]

  const hayRechazo = pasos.some(p => p.estado === 'rechazado')
  const entregadoTodo = firmaOk && ok(e.curp) && ok(e.ine) && garantiaOk
  const estado = student.accesoEstado === 'activo' ? 'aceptado'
    : hayRechazo ? 'error'
    : entregadoTodo ? 'revision'
    : 'alerta'

  return { estado, pasos, docs, hechos: pasos.filter(p => p.estado === 'hecho').length, total: pasos.length }
}

/** Lectura de T&C y Aviso por alumno, guardada en el navegador. */
const claveLectura = id => `siga_tc_lectura_${id}`
export function leerLectura(id) {
  try { return JSON.parse(localStorage.getItem(claveLectura(id)) || '{}') } catch { return {} }
}
export function guardarLectura(id, lectura) {
  try { localStorage.setItem(claveLectura(id), JSON.stringify(lectura)) } catch { /* modo privado */ }
}
