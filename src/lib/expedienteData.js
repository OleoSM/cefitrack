import { supabase } from './supabaseClient'

export const DOCUMENT_TYPES = [
  { id: 'curp', label: 'CURP' },
  { id: 'ine_tutor', label: 'INE del tutor' },
  { id: 'garantia', label: 'Garantía firmada' },
  { id: 'terminos', label: 'T&C firmados a mano' },
  // Opcional y solo para alumnos de ECOEMS: no bloquea terminar el proceso.
  { id: 'comprobante_ecoems', label: 'Comprobante de inscripción ECOEMS', opcional: true },
  // Opcional y solo para alumnos de universidad que van a la UNAM.
  { id: 'comprobante_unam', label: 'Comprobante de examen UNAM', opcional: true },
]

export async function fetchDocumentos(studentId) {
  const { data, error } = await supabase.from('student_documents').select('*')
    .eq('student_id', studentId).order('document_type')
  if (error) throw error
  return data ?? []
}

export async function fetchDocumentosAlumnos(studentIds) {
  if (!studentIds?.length) return []
  const { data, error } = await supabase.from('student_documents').select('*').in('student_id',studentIds)
  if (error) throw error
  return data ?? []
}

/*
 * Las fotos de documentos (CURP, INE…) se reducen en el teléfono antes de
 * subirlas: lado mayor de 2000 px y JPEG al 82 %. Siguen leyéndose bien y pasan
 * de 3-9 MB a unos 300-600 KB, que es lo que hace rendir el espacio de Storage.
 * Si la foto ya era más ligera que el resultado, se sube la original.
 */
const LADO_MAX = 2000
const MAX_FOTO = 25 * 1024 * 1024   // la original; lo que se sube es mucho menor
const MAX_PDF = 10 * 1024 * 1024

async function leerImagen(file) {
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' }) } catch { /* se intenta con <img> */ }
  }
  return new Promise((ok, mal) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); ok(img) }
    img.onerror = () => { URL.revokeObjectURL(url); mal(new Error('No se pudo leer la imagen. Prueba con otra foto o súbela en PDF.')) }
    img.src = url
  })
}

export async function comprimirFoto(file) {
  const img = await leerImagen(file)
  const w = img.width || img.naturalWidth, h = img.height || img.naturalHeight
  const escala = Math.min(1, LADO_MAX / Math.max(w, h))
  const c = document.createElement('canvas')
  c.width = Math.round(w * escala); c.height = Math.round(h * escala)
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#ffffff'            // un PNG con transparencia no queda negro en JPEG
  ctx.fillRect(0, 0, c.width, c.height)
  ctx.drawImage(img, 0, 0, c.width, c.height)
  img.close?.()
  const blob = await new Promise(ok => c.toBlob(ok, 'image/jpeg', 0.82))
  return blob && blob.size < file.size ? blob : null
}

export async function subirDocumento(studentId, documentType, file) {
  if (!studentId || !DOCUMENT_TYPES.some(type => type.id === documentType)) {
    throw new Error('El alumno o el tipo de documento no es válido.')
  }
  if (!file || typeof file.name !== 'string' || typeof file.size !== 'number') {
    throw new Error('Selecciona un archivo válido para subirlo.')
  }
  if (file.size <= 0) throw new Error('El archivo está vacío.')
  let ext = (file.name.split('.').pop() || 'bin').toLowerCase()
  const mimeByExtension = {
    pdf:'application/pdf', jpg:'image/jpeg', jpeg:'image/jpeg', png:'image/png', webp:'image/webp',
  }
  let contentType = mimeByExtension[ext]
  if (!contentType) throw new Error('Formato no permitido. Usa PDF, JPG, PNG o WEBP.')
  const esFoto = contentType.startsWith('image/')
  if (file.size > (esFoto ? MAX_FOTO : MAX_PDF))
    throw new Error(esFoto ? 'La foto no puede superar 25 MB.' : 'El PDF no puede superar 10 MB. Escanéalo con menos resolución o sube fotos.')
  let archivo = file
  if (esFoto) {
    const reducida = await comprimirFoto(file).catch(() => null)
    if (reducida) { archivo = reducida; ext = 'jpg'; contentType = 'image/jpeg' }
    else if (file.size > MAX_PDF) throw new Error('No se pudo reducir la foto. Prueba con otra o súbela en PDF.')
  }
  // Si antes se subió en otro formato (p. ej. foto y ahora PDF), el archivo
  // viejo queda sin uso y la limpieza automática lo borra.
  const path = `${studentId}/${documentType}.${ext}`
  const { error: uploadError } = await supabase.storage.from('expedientes')
    .upload(path, archivo, { upsert: true, contentType })
  if (uploadError) throw uploadError
  const { data, error } = await supabase.from('student_documents').upsert({
    student_id: studentId, document_type: documentType, storage_path: path,
    file_name: archivo === file ? file.name : file.name.replace(/.[^.]+$/, '') + '.jpg', mime_type: contentType, status: 'entregado',
    rejection_reason: null, validated_by: null, validated_at: null, updated_at: new Date().toISOString(),
  }, { onConflict: 'student_id,document_type' }).select().single()
  if (error) {
    if ((error.message ?? '').includes('comprobante_solo_ecoems')) throw new Error('El comprobante de inscripción solo aplica a alumnos de ECOEMS.')
    throw error
  }
  return data
}

export async function urlDocumento(path) {
  const { data, error } = await supabase.storage.from('expedientes').createSignedUrl(path, 300)
  if (error) throw error
  return data.signedUrl
}

export async function validarDocumento(id, aprobado, motivo = null) {
  const { data, error } = await supabase.rpc('validar_documento', {
    p_document_id: id, p_aprobado: aprobado, p_motivo: motivo,
  })
  if (error) throw error
  return data
}

export async function guardarGarantia(studentId, firmaAlumno) {
  const { data, error } = await supabase.rpc('guardar_garantia', {
    p_student_id: studentId, p_aceptada: true,
    p_firma_alumno: firmaAlumno, p_firma_tutor: null,
  })
  if (error) throw error
  return data
}

export async function validarGarantia(studentId) {
  const { data, error } = await supabase.rpc('validar_garantia', { p_student_id: studentId })
  if (error) throw error
  return data
}

export async function fetchTerminosActivo() {
  const { data, error } = await supabase.from('terms_documents').select('*')
    .eq('is_active', true).maybeSingle()
  if (error) throw error
  if (!data) return null
  const { data: signed, error: urlError } = await supabase.storage.from('terminos')
    .createSignedUrl(data.storage_path, 3600)
  if (urlError) throw urlError
  return { ...data, url:signed.signedUrl }
}

export async function publicarTerminos(file) {
  if (file?.type !== 'application/pdf') throw new Error('Solo se permiten archivos PDF.')
  if (file.size > 15 * 1024 * 1024) throw new Error('El PDF no puede superar 15 MB.')
  const { data: current, error: readError } = await supabase.from('terms_documents')
    .select('version').order('version', { ascending:false }).limit(1).maybeSingle()
  if (readError) throw readError
  const version = (current?.version ?? 0) + 1
  const path = `versiones/tyc-v${version}-${Date.now()}.pdf`
  const { error: uploadError } = await supabase.storage.from('terminos')
    .upload(path, file, { contentType:'application/pdf', upsert:false })
  if (uploadError) throw uploadError
  const { error: deactivateError } = await supabase.from('terms_documents')
    .update({ is_active:false }).eq('is_active',true)
  if (deactivateError) throw deactivateError
  const { error } = await supabase.from('terms_documents').insert({
    version, storage_path:path, file_name:file.name, mime_type:file.type, is_active:true,
  })
  if (error) throw error
  return fetchTerminosActivo()
}
