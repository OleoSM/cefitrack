import { useState, useCallback, useEffect } from 'react'
import { useAdminTheme } from '../context/AdminThemeContext'
import { supabase } from '../lib/supabaseClient'
import { aRgb, tintaSobre, contraste } from '../lib/color'
import { nombreCanal } from '../lib/realtime'

/*
 * Cada paleta tiene:
 *   id, name, type ('gradient' | 'solid')
 *   accent   — color principal para avatar, barra, glow
 *   colors   — array de 4 colores para el Warp (solo en gradient)
 *   bg       — fondo sólido (solo en solid)
 *   light    — el MISMO matiz en versión sólida profunda, para IPN y UNAM:
 *              { accent, bg, colors? }
 *
 * El color cambia de naturaleza según el tema, no de identidad:
 *   · tema oscuro  → neón, con el shader de humo en movimiento
 *   · IPN / UNAM   → color sólido y opaco, sin degradado ni alfa
 * El grupo "océano" sigue siendo el azulado en los dos; lo que cambia es que
 * un neón sobre página blanca se lava y un sólido profundo sobre fondo casi
 * negro se pierde. Ver la regla de color al inicio de src/index.css.
 */
export const COLOR_PALETTES = [
  /* ── Degradados ── */
  {
    id:'ocean',    name:'Océano',    type:'gradient', accent:'hsl(190,100%,55%)',
    colors:['hsl(210,100%,20%)','hsl(190,100%,55%)','hsl(200,90%,32%)','hsl(185,100%,68%)'],
    light:{ accent:'#064B60', bg:'#064B60',
             colors:['#CFE4EA','#A8D2DC','#E3F0F3','#BEDCE4'] },
  },
  {
    id:'forest',   name:'Bosque',    type:'gradient', accent:'hsl(130,70%,50%)',
    colors:['hsl(140,80%,16%)','hsl(120,70%,50%)','hsl(150,90%,26%)','hsl(130,80%,63%)'],
    light:{ accent:'#17502D', bg:'#17502D',
             colors:['#CDE4D3','#A9D3B4','#E2F0E6','#BCDCC5'] },
  },
  {
    id:'sunset',   name:'Atardecer', type:'gradient', accent:'hsl(38,100%,58%)',
    colors:['hsl(20,100%,26%)','hsl(40,100%,58%)','hsl(10,90%,36%)','hsl(50,100%,70%)'],
    light:{ accent:'#633515', bg:'#633515',
             colors:['#F0DEC0','#E6C99B','#F6EBD8','#EBD4AE'] },
  },
  {
    id:'aurora',   name:'Aurora',    type:'gradient', accent:'hsl(300,85%,58%)',
    colors:['hsl(270,100%,26%)','hsl(300,90%,58%)','hsl(290,80%,36%)','hsl(320,100%,70%)'],
    light:{ accent:'#5E1948', bg:'#5E1948',
             colors:['#E4D0E2','#D3B2D0','#EFE2EE','#DBC1D9'] },
  },
  {
    id:'fire',     name:'Fuego',     type:'gradient', accent:'hsl(25,100%,55%)',
    colors:['hsl(0,100%,26%)','hsl(30,100%,55%)','hsl(15,90%,34%)','hsl(45,100%,68%)'],
    light:{ accent:'#78182B', bg:'#78182B',
             colors:['#EFD8CB','#E4BCA6','#F5E6DD','#EACAB9'] },
  },
  {
    id:'cosmos',   name:'Cosmos',    type:'gradient', accent:'hsl(258,100%,62%)',
    colors:['hsl(240,100%,14%)','hsl(260,100%,62%)','hsl(250,80%,28%)','hsl(270,80%,74%)'],
    light:{ accent:'#48245F', bg:'#48245F',
             colors:['#D6D1EC','#BBB3DF','#E4E1F2','#C9C2E6'] },
  },
  {
    id:'arctic',   name:'Ártico',    type:'gradient', accent:'hsl(194,80%,68%)',
    colors:['hsl(200,60%,16%)','hsl(194,80%,68%)','hsl(205,50%,28%)','hsl(190,70%,83%)'],
    light:{ accent:'#12345A', bg:'#12345A',
             colors:['#CCE4E9','#A5D1DA','#E1EFF2','#BADBE2'] },
  },
  {
    id:'rose',     name:'Rosa',      type:'gradient', accent:'hsl(348,90%,62%)',
    colors:['hsl(330,80%,20%)','hsl(350,90%,62%)','hsl(340,80%,34%)','hsl(360,80%,74%)'],
    light:{ accent:'#681126', bg:'#681126',
             colors:['#EFD1D8','#E3AFBB','#F4E0E4','#E9C0C9'] },
  },
  {
    id:'emerald',  name:'Esmeralda', type:'gradient', accent:'hsl(160,85%,48%)',
    colors:['hsl(170,100%,14%)','hsl(160,85%,48%)','hsl(150,80%,24%)','hsl(165,90%,65%)'],
    light:{ accent:'#075348', bg:'#075348',
             colors:['#CBE5DC','#A4D4C5','#E0F0EA','#B8DCD1'] },
  },
  {
    id:'gold',     name:'Dorado',    type:'gradient', accent:'hsl(45,100%,55%)',
    colors:['hsl(35,90%,18%)','hsl(45,100%,55%)','hsl(40,95%,30%)','hsl(50,100%,72%)'],
    light:{ accent:'#5A4508', bg:'#5A4508',
             colors:['#EDE0BB','#E1CE93','#F3EBD3','#E7D7A7'] },
  },

  /* ── Colores sólidos ── */
  { id:'solid-blue',    name:'Azul',     type:'solid', accent:'#3b82f6', bg:'#1e3a5f', light:{ accent:'#12345A', bg:'#12345A' } },
  { id:'solid-green',   name:'Verde',    type:'solid', accent:'#22c55e', bg:'#14532d', light:{ accent:'#17502D', bg:'#17502D' } },
  { id:'solid-amber',   name:'Ámbar',    type:'solid', accent:'#f59e0b', bg:'#78350f', light:{ accent:'#633515', bg:'#633515' } },
  { id:'solid-red',     name:'Rojo',     type:'solid', accent:'#ef4444', bg:'#7f1d1d', light:{ accent:'#78182B', bg:'#78182B' } },
  { id:'solid-purple',  name:'Violeta',  type:'solid', accent:'#a855f7', bg:'#3b0764', light:{ accent:'#48245F', bg:'#48245F' } },
  { id:'solid-pink',    name:'Rosa',     type:'solid', accent:'#ec4899', bg:'#500724', light:{ accent:'#5E1948', bg:'#5E1948' } },
  { id:'solid-cyan',    name:'Cian',     type:'solid', accent:'#06b6d4', bg:'#164e63', light:{ accent:'#064B60', bg:'#064B60' } },
  { id:'solid-indigo',  name:'Índigo',   type:'solid', accent:'#6366f1', bg:'#1e1b4b', light:{ accent:'#2A2A5F', bg:'#2A2A5F' } },
  { id:'solid-teal',    name:'Teal',     type:'solid', accent:'#14b8a6', bg:'#134e4a', light:{ accent:'#075348', bg:'#075348' } },
  { id:'solid-orange',  name:'Naranja',  type:'solid', accent:'#f97316', bg:'#7c2d12', light:{ accent:'#6B3410', bg:'#6B3410' } },
  { id:'solid-slate',   name:'Gris',     type:'solid', accent:'#94a3b8', bg:'#1e293b', light:{ accent:'#2F3A47', bg:'#2F3A47' } },
  { id:'solid-white',   name:'Blanco',   type:'solid', accent:'#e2e8f0', bg:'#334155', light:{ accent:'#3A3F47', bg:'#3A3F47' } },

  /* ── Sólidos institucionales ──
     Color pleno: sin degradado, sin alfa, sin sombra de color. Los hex de
     `light` son los que pidió el equipo, en el registro de #4d0b1d, y se usan
     COMO FONDO con texto blanco encima en IPN y UNAM.

     El tema oscuro recibe el mismo matiz más luminoso: un #4d0b1d sobre el
     fondo #070b16 casi no se separa, y la tarjeta se perdería igual que antes
     se perdía sobre blanco — el problema sería el mismo, sólo que invertido. */
  { id:'mate-guinda',   name:'Guinda',    type:'solid', mate:true, accent:'#9E1D3C', bg:'#9E1D3C', light:{ accent:'#4D0B1D', bg:'#4D0B1D' } },
  { id:'mate-granate',  name:'Granate',   type:'solid', mate:true, accent:'#B02546', bg:'#B02546', light:{ accent:'#681126', bg:'#681126' } },
  { id:'mate-rojo',     name:'Rojo',      type:'solid', mate:true, accent:'#C4304C', bg:'#C4304C', light:{ accent:'#78182B', bg:'#78182B' } },
  { id:'mate-marino',   name:'Marino',    type:'solid', mate:true, accent:'#2C6BA8', bg:'#2C6BA8', light:{ accent:'#12345A', bg:'#12345A' } },
  { id:'mate-petroleo', name:'Petróleo',  type:'solid', mate:true, accent:'#1286A0', bg:'#1286A0', light:{ accent:'#064B60', bg:'#064B60' } },
  { id:'mate-bosque',   name:'Bosque',    type:'solid', mate:true, accent:'#2E8A50', bg:'#2E8A50', light:{ accent:'#17502D', bg:'#17502D' } },
  { id:'mate-verdemar', name:'Verde mar', type:'solid', mate:true, accent:'#14907E', bg:'#14907E', light:{ accent:'#075348', bg:'#075348' } },
  { id:'mate-morado',   name:'Morado',    type:'solid', mate:true, accent:'#8248A8', bg:'#8248A8', light:{ accent:'#48245F', bg:'#48245F' } },
  { id:'mate-ciruela',  name:'Ciruela',   type:'solid', mate:true, accent:'#A93380', bg:'#A93380', light:{ accent:'#5E1948', bg:'#5E1948' } },
  { id:'mate-cafe',     name:'Café',      type:'solid', mate:true, accent:'#A85F2A', bg:'#A85F2A', light:{ accent:'#633515', bg:'#633515' } },
]

/** Sólidas y opacas: las recomendadas para IPN y UNAM. */
export const MATE_PALETTES = COLOR_PALETTES.filter(p => p.mate)

export const GRADIENT_PALETTES = COLOR_PALETTES.filter(p => p.type === 'gradient')
/* Las mate son sólidas, pero van en su propia sección del selector. */
export const SOLID_PALETTES    = COLOR_PALETTES.filter(p => p.type === 'solid' && !p.mate)

/* ── Color de letra de la tarjeta ─────────────────────────────────────────
   Con algunos fondos el blanco fijo no se leía. "Automático" elige blanco u
   oscuro por contraste; el resto lo fija quien personaliza el grupo. */
export const TINTAS = [
  { id:'auto',     name:'Automático' },
  { id:'blanco',   name:'Blanco',   hex:'#FFFFFF' },
  { id:'hueso',    name:'Hueso',    hex:'#F4ECDD' },
  { id:'amarillo', name:'Amarillo', hex:'#FFE7A0' },
  { id:'celeste',  name:'Celeste',  hex:'#CDEBFF' },
  { id:'negro',    name:'Negro',    hex:'#0B0B10', oscura:true },
  { id:'grafito',  name:'Grafito',  hex:'#262B36', oscura:true },
]

/* Variables de texto y bordes que hereda todo lo que va dentro de la tarjeta.
   Los niveles secundarios son la misma tinta más tenue; los bordes y rellenos
   suaves van en blanco o negro translúcido según la tinta sea clara u oscura. */
function variablesDeTinta(hex, oscura) {
  const [r, g, b] = aRgb(hex)
  const base = oscura ? '0,0,0' : '255,255,255'
  return {
    '--t1': hex,
    '--t2': `rgba(${r},${g},${b},.84)`,
    '--t3': `rgba(${r},${g},${b},.68)`,
    '--t4': `rgba(${r},${g},${b},.5)`,
    '--divider': `rgba(${base},.20)`,
    '--card-border': `rgba(${base},.24)`,
    '--soft-bg': `rgba(${base},.10)`,
    '--card-bg': `rgba(${base},.08)`,
  }
}

/* Config base del Warp shader */
export const SHADER_CONFIG = {
  proportion:       0.38,
  softness:         1.0,
  distortion:       0.18,
  swirl:            0.75,
  swirlIterations:  10,
  shape:            'checks',
  shapeScale:       0.10,
  scale:            1,
  rotation:         0,
  speed:            0.6,
}

const DEFAULTS  = { g1:'ocean', g2:'forest', g3:'sunset' }
const STORAGE_KEY = 'edutrack_group_palettes'
const SEMBRADO_KEY = 'siga_paletas_migradas'

/* ── Almacén compartido ────────────────────────────────────────────────────
   La paleta de un grupo vive en `groups.paleta`, no en localStorage. Guardarla
   en el navegador significaba que cada administrador veía una combinación
   distinta y que lo que uno cambiaba no existía para los demás.

   El almacén es de módulo, no de componente: hay una tarjeta —y por tanto una
   instancia del hook— por grupo, y no tendría sentido que cada una pidiera la
   lista entera. Se carga una vez y todas escuchan los cambios. */
let paletas = {}
let tintas = {}
let carga = null
const oyentes = new Set()
let canal = null

function avisar() { oyentes.forEach(fn => fn({ paletas, tintas })) }

function leerLocalesAntiguas() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') } catch { return {} }
}

/* Migración de una sola vez por navegador: las elecciones que ya existían en
   local se suben para los grupos que aún no tienen color en la base, de modo
   que nadie pierda lo que ya había ajustado. Los fallos se ignoran a
   propósito: un sub-admin no puede escribir en grupos que no le tocan, y eso
   no debe romper la carga. */
async function sembrarDesdeLocal(enBd) {
  if (localStorage.getItem(SEMBRADO_KEY)) return
  localStorage.setItem(SEMBRADO_KEY, '1')
  const locales = leerLocalesAntiguas()
  const pendientes = Object.entries(locales).filter(([id]) => !enBd[id])
  await Promise.all(pendientes.map(([id, pid]) =>
    supabase.rpc('set_paleta_grupo', { p_group_id: id, p_paleta: pid })
      .then(({ error }) => { if (!error) paletas = { ...paletas, [id]: pid } })
      .catch(() => {})))
  if (pendientes.length) avisar()
}

function cargarPaletas() {
  carga ??= supabase.from('groups').select('id, paleta, tinta').then(({ data, error }) => {
    if (error) { carga = null; return paletas }
    paletas = Object.fromEntries(data.filter(g => g.paleta).map(g => [g.id, g.paleta]))
    tintas  = Object.fromEntries(data.filter(g => g.tinta).map(g => [g.id, g.tinta]))
    avisar()
    sembrarDesdeLocal(paletas)
    return paletas
  })
  return carga
}

/* Tiempo real: si otro administrador cambia el color, se ve aquí sin recargar.
   Es el mismo canal para toda la aplicación. */
function escucharCambios() {
  if (canal) return
  /* Nombre único: `supabase.channel()` devuelve el canal existente si el nombre
     se repite, y tras una recarga en caliente (o un segundo montaje) ese canal
     ya está suscrito y añadirle `.on()` lanza un error que tumba la página. */
  canal = supabase.channel(nombreCanal('paletas-de-grupo'))
    .on('postgres_changes', { event:'UPDATE', schema:'public', table:'groups' }, ({ new: fila }) => {
      if (!fila?.id) return
      const nueva  = fila.paleta || undefined
      const nuevaT = fila.tinta || undefined
      if (paletas[fila.id] === nueva && tintas[fila.id] === nuevaT) return
      const copia = { ...paletas }
      if (nueva) copia[fila.id] = nueva; else delete copia[fila.id]
      const copiaT = { ...tintas }
      if (nuevaT) copiaT[fila.id] = nuevaT; else delete copiaT[fila.id]
      paletas = copia; tintas = copiaT
      avisar()
    })
    .subscribe()
}

export function useGroupColors() {
  const [{ paletas: saved, tintas: savedT }, setSaved] = useState({ paletas, tintas })
  const { t } = useAdminTheme()
  const claro = !!t?.light          // IPN o UNAM

  /* Cada tarjeta usa su propia instancia del hook, así que todas se apuntan al
     mismo almacén: sin esto, cambiar la paleta desde el modal no llegaba a las
     tarjetas ya montadas hasta recargar la página. */
  useEffect(() => {
    cargarPaletas()
    /* El tiempo real es un extra: si falla, los colores siguen cargándose y
       la pantalla no debe caerse por ello. */
    try { escucharCambios() } catch { canal = null }
    const sync = next => setSaved(next)
    oyentes.add(sync)
    return () => { oyentes.delete(sync) }
  }, [])

  const getPalette = useCallback((groupId) => {
    const pid = saved[groupId] ?? DEFAULTS[groupId] ?? 'ocean'
    return COLOR_PALETTES.find(p => p.id === pid) ?? COLOR_PALETTES[0]
  }, [saved])

  const getPaletteId = useCallback((groupId) => getPalette(groupId).id, [getPalette])

  /* Devuelve el array de 4 colores (para el Warp) o 4 veces el bg (solid).
     En identidad clara se sirve la variante pastel. */
  const getColors = useCallback((groupId) => {
    const p = getPalette(groupId)
    if (claro && p.light) {
      return p.type === 'gradient'
        ? p.light.colors
        : [p.light.bg, p.light.accent, p.light.bg, p.light.accent]
    }
    return p.type === 'gradient'
      ? p.colors
      : [p.bg, p.accent, p.bg, p.accent]
  }, [getPalette, claro])

  const getAccent = useCallback((groupId) => {
    const p = getPalette(groupId)
    return claro && p.light ? p.light.accent : p.accent
  }, [getPalette, claro])

  /** Fondo de superficie del grupo: pastel en claro, oscuro en el tema base. */
  const getSurface = useCallback((groupId) => {
    const p = getPalette(groupId)
    if (claro && p.light) return p.light.bg
    return p.type === 'solid' ? p.bg : '#08080f'
  }, [getPalette, claro])

  /* Color sobre el que realmente se lee el texto: en claro la superficie
     sólida; en oscuro, el degradado bajo su velo negro o el sólido del grupo. */
  const fondoDeLectura = useCallback((groupId, paletteId) => {
    const p = (paletteId && COLOR_PALETTES.find(x => x.id === paletteId)) || getPalette(groupId)
    if (claro && p.light) return p.light.bg
    return p.type === 'gradient' ? '#121218' : p.bg
  }, [getPalette, claro])

  const getTintaId = useCallback(groupId => savedT[groupId] ?? 'auto', [savedT])

  /** { id, hex, oscura, contraste, vars } de la tinta del grupo, ya resuelta.
   *  `id` y `paletteId` permiten previsualizar una combinación sin guardar. */
  const resolverTinta = useCallback((groupId, id = getTintaId(groupId), paletteId) => {
    const fondo = fondoDeLectura(groupId, paletteId)
    let t = TINTAS.find(x => x.id === id && x.hex)
    if (!t) {
      // Automático: blanco u oscuro según el fondo de lectura.
      const hex = tintaSobre(fondo) === '#ffffff' ? '#FFFFFF' : '#0B0B10'
      t = { id:'auto', hex, oscura: hex !== '#FFFFFF' }
    }
    /* En el tema oscuro una letra oscura no va sobre el velo negro: la tarjeta
       cambia a un velo claro (ver GroupShaderCard) y se mide contra él. */
    const fondoReal = (!claro && t.oscura) ? '#E8E8EE' : fondo
    return { ...t, id, velaClara: !claro && !!t.oscura, contraste: contraste(t.hex, fondoReal),
      vars: variablesDeTinta(t.hex, !!t.oscura) }
  }, [getTintaId, fondoDeLectura, claro])

  const setGroupTinta = useCallback(async (groupId, tintaId) => {
    tintas = { ...tintas }
    if (tintaId === 'auto') delete tintas[groupId]; else tintas[groupId] = tintaId
    avisar()
    const { error } = await supabase.rpc('set_tinta_grupo', { p_group_id: groupId, p_tinta: tintaId })
    if (error) { carga = null; cargarPaletas() }
  }, [])

  /** True si la identidad activa es clara — lo usan las tarjetas con shader. */
  const isLight = claro

  /* Optimista: la tarjeta cambia de color en el acto y la escritura viaja
     después. Si la base la rechaza se vuelve a leer, que es la única fuente
     de verdad. */
  const setGroupPalette = useCallback(async (groupId, paletteId) => {
    paletas = { ...paletas, [groupId]: paletteId }
    avisar()
    const { error } = await supabase.rpc('set_paleta_grupo', {
      p_group_id: groupId, p_paleta: paletteId,
    })
    if (error) { carga = null; cargarPaletas() }
  }, [])

  return { getColors, getAccent, getSurface, isLight, getPaletteId, getPalette, setGroupPalette,
    getTintaId, resolverTinta, setGroupTinta, fondoDeLectura }
}
