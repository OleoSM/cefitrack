/*
 * Gestión de materiales: archivos ligados a una actividad, con fecha de
 * visibilidad y de borrado automático (ver migración 20261011160000).
 */
import { supabase } from './supabaseClient'

const BUCKET = 'materiales'
export const MAX_BYTES = 20 * 1024 * 1024
const TIPOS = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }

const MENSAJES = {
  forbidden: 'No tienes permiso para gestionar materiales.',
  ruta_invalida: 'Ruta de archivo no válida.',
  tipo_invalido: 'Solo se permiten PDF e imágenes (JPG, PNG, WEBP).',
  archivo_grande: 'El archivo no puede pasar de 20 MB.',
  ya_vencido: 'La fecha de borrado ya pasó: elige una futura.',
  fechas_invalidas: 'La fecha de borrado debe ser posterior a la de inicio.',
  sin_alcance: 'Elige al menos un grupo, sucursal o curso que lo pueda ver.',
  curso_invalido: 'Curso no válido.',
  grupo_invalido: 'Uno de los grupos no existe.',
  cursos_solo_admin: 'Solo un administrador puede compartir con un curso completo.',
  grupo_ajeno: 'Uno de los grupos no es tuyo.',
  sucursal_ajena: 'Solo puedes compartir con sucursales que tienes completas.',
  actividad_ajena: 'Esa actividad no es de tus grupos.',
  material_no_encontrado: 'El material ya no existe.',
}
const traducir = (error, porDefecto) => {
  const k = Object.keys(MENSAJES).find(c => (error?.message ?? '').includes(c))
  return k ? MENSAJES[k] : porDefecto
}

const mapear = m => ({
  id: m.id, titulo: m.titulo, descripcion: m.descripcion ?? '', columnaId: m.columna_id,
  path: m.storage_path, fileName: m.file_name, mime: m.mime_type, tamano: Number(m.tamano),
  visibleDesde: m.visible_desde, expiraEn: m.expira_en,
  grupos: m.grupos ?? [], sucursales: m.sucursales ?? [], cursos: m.cursos ?? [],
  creadoPor: m.creado_por, creado: m.created_at,
})

/** Materiales que el usuario puede ver (la RLS decide cuáles). */
export async function fetchMateriales() {
  const { data, error } = await supabase.from('materiales').select('*').order('expira_en')
  if (error) throw error
  return (data ?? []).map(mapear)
}

export async function fetchMaterialesDeColumna(columnaId) {
  if (!columnaId) return []
  const { data, error } = await supabase.from('materiales').select('*').eq('columna_id', columnaId).order('created_at')
  if (error) throw error
  return (data ?? []).map(mapear)
}

/** Sube el archivo y crea el material. Si el alta falla, el archivo se retira. */
export async function subirMaterial({ archivo, titulo, descripcion, columnaId, visibleDesde, expiraEn, grupos, sucursales, cursos }) {
  if (!archivo) return { ok: false, message: 'Elige un archivo.' }
  if (archivo.size > MAX_BYTES) return { ok: false, message: MENSAJES.archivo_grande }
  const ext = (archivo.name.split('.').pop() || '').toLowerCase()
  const mime = TIPOS[ext]
  if (!mime) return { ok: false, message: MENSAJES.tipo_invalido }
  const { data: sesion } = await supabase.auth.getUser()
  const uid = sesion?.user?.id
  if (!uid) return { ok: false, message: 'Tu sesión caducó. Vuelve a entrar.' }
  const limpio = archivo.name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '_').slice(-80)
  const path = `${uid}/${Date.now()}-${limpio}`
  const { error: eUp } = await supabase.storage.from(BUCKET).upload(path, archivo, { contentType: mime, upsert: false })
  if (eUp) return { ok: false, message: 'No se pudo subir el archivo.' }
  const { data, error } = await supabase.rpc('crear_material', {
    p_titulo: titulo, p_descripcion: descripcion || null, p_columna_id: columnaId || null,
    p_path: path, p_file_name: archivo.name, p_mime: mime, p_tamano: archivo.size,
    p_visible_desde: visibleDesde, p_expira_en: expiraEn,
    p_grupos: grupos, p_sucursales: sucursales, p_cursos: cursos,
  })
  if (error) {
    await supabase.storage.from(BUCKET).remove([path]).catch(() => {})
    return { ok: false, message: traducir(error, 'No se pudo guardar el material.') }
  }
  return { ok: true, material: mapear(data) }
}

export async function actualizarMaterial({ id, titulo, descripcion, columnaId, visibleDesde, expiraEn, grupos, sucursales, cursos }) {
  const { data, error } = await supabase.rpc('actualizar_material', {
    p_id: id, p_titulo: titulo, p_descripcion: descripcion || null, p_columna_id: columnaId || null,
    p_visible_desde: visibleDesde, p_expira_en: expiraEn, p_grupos: grupos, p_sucursales: sucursales, p_cursos: cursos,
  })
  if (error) return { ok: false, message: traducir(error, 'No se pudo guardar el material.') }
  return { ok: true, material: mapear(data) }
}

/** Borra el material ya (antes de su fecha): primero la fila, luego el archivo. */
export async function borrarMaterial(material) {
  const { data: path, error } = await supabase.rpc('borrar_material', { p_id: material.id })
  if (error) throw new Error(traducir(error, 'No se pudo borrar el material.'))
  await supabase.storage.from(BUCKET).remove([path ?? material.path]).catch(() => {})
}

/** URL temporal (10 min) para abrir o descargar el archivo. */
export async function urlMaterial(material, descargar = false) {
  const { data, error } = await supabase.storage.from(BUCKET)
    .createSignedUrl(material.path, 600, descargar ? { download: material.fileName } : undefined)
  if (error) throw new Error('No se pudo abrir el archivo.')
  return data.signedUrl
}

/** "en 3 días", "en 5 h", "en 20 min" hasta una fecha. */
export function tiempoHasta(fecha) {
  const ms = new Date(fecha).getTime() - Date.now()
  if (ms <= 0) return 'ya'
  const min = Math.round(ms / 60000)
  if (min < 60) return `en ${min} min`
  const h = Math.round(min / 60)
  if (h < 48) return `en ${h} h`
  return `en ${Math.round(h / 24)} días`
}

export const tamanoLegible = b => b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`
