/*
 * Fotos de perfil de los alumnos (bucket privado `fotos-perfil`).
 *
 * Son fotos de menores: nunca hay URL pública. Se piden URLs firmadas de una
 * hora, y en lote — una lista de 40 alumnos hace UNA petición, no 40 —, y se
 * guardan en memoria hasta poco antes de caducar.
 */
import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

const BUCKET = 'fotos-perfil'
const DURACION = 3600
const cache = new Map()        // path -> { url, vence }
const enEspera = new Map()     // path -> [resolve]
let temporizador = null

async function vaciar() {
  temporizador = null
  const lote = new Map(enEspera); enEspera.clear()
  const paths = [...lote.keys()]
  let filas = []
  try {
    const { data } = await supabase.storage.from(BUCKET).createSignedUrls(paths, DURACION)
    filas = data ?? []
  } catch { /* sin permiso o sin red: se queda con las iniciales */ }
  const vence = Date.now() + (DURACION - 120) * 1000
  for (const p of paths) {
    const url = filas.find(f => f.path === p)?.signedUrl ?? null
    if (url) cache.set(p, { url, vence })
    lote.get(p).forEach(r => r(url))
  }
}

/** URL firmada de una foto (o null si no se puede ver). */
export function urlFoto(path) {
  if (!path) return Promise.resolve(null)
  const c = cache.get(path)
  if (c && c.vence > Date.now()) return Promise.resolve(c.url)
  return new Promise(resolve => {
    if (!enEspera.has(path)) enEspera.set(path, [])
    enEspera.get(path).push(resolve)
    temporizador ??= setTimeout(vaciar, 30)
  })
}

export function useFotoUrl(path) {
  const [url, setUrl] = useState(() => {
    const c = path && cache.get(path)
    return c && c.vence > Date.now() ? c.url : null
  })
  useEffect(() => {
    let vivo = true
    if (!path) { setUrl(null); return undefined }
    urlFoto(path).then(u => { if (vivo) setUrl(u) })
    return () => { vivo = false }
  }, [path])
  return url
}

/** Recorta al centro y reduce a un cuadrado JPEG de `lado` px. */
export async function prepararFoto(fuente, lado = 512) {
  const img = fuente instanceof HTMLCanvasElement || fuente instanceof HTMLVideoElement ? fuente : await cargarImagen(fuente)
  const w = img.videoWidth || img.naturalWidth || img.width
  const h = img.videoHeight || img.naturalHeight || img.height
  const m = Math.min(w, h)
  const c = document.createElement('canvas')
  c.width = lado; c.height = lado
  const ctx = c.getContext('2d')
  ctx.drawImage(img, (w - m) / 2, (h - m) / 2, m, m, 0, 0, lado, lado)
  return new Promise(ok => c.toBlob(ok, 'image/jpeg', 0.86))
}

function cargarImagen(file) {
  return new Promise((ok, mal) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); ok(img) }
    img.onerror = () => { URL.revokeObjectURL(url); mal(new Error('No se pudo leer la imagen.')) }
    img.src = url
  })
}

/** Sube la foto del alumno y la deja como su foto de perfil. Devuelve el path. */
export async function guardarFoto(studentId, blob) {
  if (!blob || blob.size > 2 * 1024 * 1024) throw new Error('La foto no puede pasar de 2 MB.')
  // Nombre con marca de tiempo: así la URL cambia y nadie ve la foto vieja en caché.
  const path = `${studentId}/foto-${Date.now()}.jpg`
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg', upsert: false })
  if (error) throw new Error('No se pudo subir la foto.')
  const { data: previas } = await supabase.storage.from(BUCKET).list(studentId)
  const { error: e2 } = await supabase.rpc('set_foto_perfil', { p_student_id: studentId, p_path: path })
  if (e2) throw new Error('No se pudo guardar la foto.')
  // Las anteriores ya no se usan: fuera, para no acumular fotos de menores.
  const viejas = (previas ?? []).map(f => `${studentId}/${f.name}`).filter(p => p !== path)
  if (viejas.length) await supabase.storage.from(BUCKET).remove(viejas).catch(() => {})
  return path
}

/** Quita la foto (el alumno, o el personal si no es adecuada). */
export async function quitarFoto(studentId) {
  const { error } = await supabase.rpc('set_foto_perfil', { p_student_id: studentId, p_path: null })
  if (error) throw new Error('No se pudo quitar la foto.')
  const { data } = await supabase.storage.from(BUCKET).list(studentId)
  const todas = (data ?? []).map(f => `${studentId}/${f.name}`)
  if (todas.length) await supabase.storage.from(BUCKET).remove(todas).catch(() => {})
}
