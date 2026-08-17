import { supabase } from './supabaseClient'

export const DOCUMENT_TYPES = [
  { id: 'curp', label: 'CURP' },
  { id: 'ine_tutor', label: 'INE del tutor' },
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
  const ext = (file.name.split('.').pop() || 'bin').toLowerCase()
  const path = `${studentId}/${documentType}.${ext}`
  const { error: uploadError } = await supabase.storage.from('expedientes')
    .upload(path, file, { upsert: true, contentType: file.type })
  if (uploadError) throw uploadError
  const { data, error } = await supabase.from('student_documents').upsert({
    student_id: studentId, document_type: documentType, storage_path: path,
    file_name: file.name, mime_type: file.type, status: 'entregado',
    rejection_reason: null, validated_by: null, validated_at: null, updated_at: new Date().toISOString(),
  }, { onConflict: 'student_id,document_type' }).select().single()
  if (error) throw error
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

export async function guardarGarantia(studentId, firmaAlumno, firmaTutor) {
  const { data, error } = await supabase.rpc('guardar_garantia', {
    p_student_id: studentId, p_aceptada: true,
    p_firma_alumno: firmaAlumno, p_firma_tutor: firmaTutor,
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
