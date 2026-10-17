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

export async function subirDocumento(studentId, documentType, file) {
  if (!studentId || !DOCUMENT_TYPES.some(type => type.id === documentType)) {
    throw new Error('El alumno o el tipo de documento no es válido.')
  }
  if (!file || typeof file.name !== 'string' || typeof file.size !== 'number') {
    throw new Error('Selecciona un archivo válido para subirlo.')
  }
  if (file.size <= 0) throw new Error('El archivo está vacío.')
  if (file.size > 10 * 1024 * 1024) throw new Error('El archivo no puede superar 10 MB.')
  const ext = (file.name.split('.').pop() || 'bin').toLowerCase()
  const mimeByExtension = {
    pdf:'application/pdf', jpg:'image/jpeg', jpeg:'image/jpeg', png:'image/png', webp:'image/webp',
  }
  const contentType = mimeByExtension[ext]
  if (!contentType) throw new Error('Formato no permitido. Usa PDF, JPG, PNG o WEBP.')
  const path = `${studentId}/${documentType}.${ext}`
  const { error: uploadError } = await supabase.storage.from('expedientes')
    .upload(path, file, { upsert: true, contentType })
  if (uploadError) throw uploadError
  const { data, error } = await supabase.from('student_documents').upsert({
    student_id: studentId, document_type: documentType, storage_path: path,
    file_name: file.name, mime_type: contentType, status: 'entregado',
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
