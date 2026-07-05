import * as XLSX from 'xlsx'

// Credenciales asignadas por el sistema: el alumno NUNCA crea ni cambia su contraseña.

const normalize = s => s.toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z\s]/g, '')

export function generarUsuario(nombre, usados = new Set()) {
  const parts = normalize(nombre).trim().split(/\s+/)
  const base = [parts[0], parts[1] ?? ''].filter(Boolean).join('.')
  let user = base, i = 2
  while (usados.has(user)) user = `${base}${i++}`
  usados.add(user)
  return user
}

export function generarPassword(len = 8) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789' // sin caracteres ambiguos (0/O, 1/l/I)
  const rnd = new Uint32Array(len)
  crypto.getRandomValues(rnd)
  let out = ''
  for (let i = 0; i < len; i++) out += chars[rnd[i] % chars.length]
  return out
}

export function generarCredenciales(rows) {
  const usados = new Set()
  return rows.map(r => ({
    nombre:   r.nombre,
    grupo:    r.grupo ?? '',
    email:    r.email ?? '',
    usuario:  generarUsuario(r.nombre, usados),
    password: generarPassword(),
  }))
}

export function exportCredencialesExcel(creds, archivo = 'Credenciales_Alumnos') {
  const rows = creds.map((c, i) => ({
    '#':                 i + 1,
    'Nombre del Alumno': c.nombre,
    'Grupo':             c.grupo,
    'Usuario':           c.usuario,
    'Contraseña':        c.password,
  }))
  const ws = XLSX.utils.json_to_sheet(rows)
  ws['!cols'] = [{ wch: 4 }, { wch: 34 }, { wch: 8 }, { wch: 24 }, { wch: 14 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Credenciales')
  XLSX.writeFile(wb, `${archivo}.xlsx`)
}
