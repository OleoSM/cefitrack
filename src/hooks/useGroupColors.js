import { useState, useCallback } from 'react'
import { useAdminTheme } from '../context/AdminThemeContext'

/*
 * Cada paleta tiene:
 *   id, name, type ('gradient' | 'solid')
 *   accent   — color principal para avatar, barra, glow
 *   colors   — array de 4 colores para el Warp (solo en gradient)
 *   bg       — fondo sólido (solo en solid)
 *   light    — variante pastel mate para las identidades claras (IPN/UNAM):
 *              { accent, bg, colors? }
 *
 * Los valores base son neón a propósito: solo se usan en el tema oscuro.
 * En IPN y UNAM está prohibido el neón, así que ahí se sirve `light`.
 * Ver la regla de color al inicio de src/index.css.
 */
export const COLOR_PALETTES = [
  /* ── Degradados ── */
  {
    id:'ocean',    name:'Océano',    type:'gradient', accent:'hsl(190,100%,55%)',
    colors:['hsl(210,100%,20%)','hsl(190,100%,55%)','hsl(200,90%,32%)','hsl(185,100%,68%)'],
    light:{ accent:'#1F6B7D', bg:'#EAF3F6',
             colors:['#CFE4EA','#A8D2DC','#E3F0F3','#BEDCE4'] },
  },
  {
    id:'forest',   name:'Bosque',    type:'gradient', accent:'hsl(130,70%,50%)',
    colors:['hsl(140,80%,16%)','hsl(120,70%,50%)','hsl(150,90%,26%)','hsl(130,80%,63%)'],
    light:{ accent:'#2F6B41', bg:'#EAF3EC',
             colors:['#CDE4D3','#A9D3B4','#E2F0E6','#BCDCC5'] },
  },
  {
    id:'sunset',   name:'Atardecer', type:'gradient', accent:'hsl(38,100%,58%)',
    colors:['hsl(20,100%,26%)','hsl(40,100%,58%)','hsl(10,90%,36%)','hsl(50,100%,70%)'],
    light:{ accent:'#8A5A12', bg:'#F8F1E4',
             colors:['#F0DEC0','#E6C99B','#F6EBD8','#EBD4AE'] },
  },
  {
    id:'aurora',   name:'Aurora',    type:'gradient', accent:'hsl(300,85%,58%)',
    colors:['hsl(270,100%,26%)','hsl(300,90%,58%)','hsl(290,80%,36%)','hsl(320,100%,70%)'],
    light:{ accent:'#7A3474', bg:'#F3EAF2',
             colors:['#E4D0E2','#D3B2D0','#EFE2EE','#DBC1D9'] },
  },
  {
    id:'fire',     name:'Fuego',     type:'gradient', accent:'hsl(25,100%,55%)',
    colors:['hsl(0,100%,26%)','hsl(30,100%,55%)','hsl(15,90%,34%)','hsl(45,100%,68%)'],
    light:{ accent:'#93441F', bg:'#F7EDE7',
             colors:['#EFD8CB','#E4BCA6','#F5E6DD','#EACAB9'] },
  },
  {
    id:'cosmos',   name:'Cosmos',    type:'gradient', accent:'hsl(258,100%,62%)',
    colors:['hsl(240,100%,14%)','hsl(260,100%,62%)','hsl(250,80%,28%)','hsl(270,80%,74%)'],
    light:{ accent:'#4F3F96', bg:'#ECEAF7',
             colors:['#D6D1EC','#BBB3DF','#E4E1F2','#C9C2E6'] },
  },
  {
    id:'arctic',   name:'Ártico',    type:'gradient', accent:'hsl(194,80%,68%)',
    colors:['hsl(200,60%,16%)','hsl(194,80%,68%)','hsl(205,50%,28%)','hsl(190,70%,83%)'],
    light:{ accent:'#276B7A', bg:'#E9F3F5',
             colors:['#CCE4E9','#A5D1DA','#E1EFF2','#BADBE2'] },
  },
  {
    id:'rose',     name:'Rosa',      type:'gradient', accent:'hsl(348,90%,62%)',
    colors:['hsl(330,80%,20%)','hsl(350,90%,62%)','hsl(340,80%,34%)','hsl(360,80%,74%)'],
    light:{ accent:'#96334A', bg:'#F7EAED',
             colors:['#EFD1D8','#E3AFBB','#F4E0E4','#E9C0C9'] },
  },
  {
    id:'emerald',  name:'Esmeralda', type:'gradient', accent:'hsl(160,85%,48%)',
    colors:['hsl(170,100%,14%)','hsl(160,85%,48%)','hsl(150,80%,24%)','hsl(165,90%,65%)'],
    light:{ accent:'#1F6B57', bg:'#E8F3EF',
             colors:['#CBE5DC','#A4D4C5','#E0F0EA','#B8DCD1'] },
  },
  {
    id:'gold',     name:'Dorado',    type:'gradient', accent:'hsl(45,100%,55%)',
    colors:['hsl(35,90%,18%)','hsl(45,100%,55%)','hsl(40,95%,30%)','hsl(50,100%,72%)'],
    light:{ accent:'#85631A', bg:'#F6F1DF',
             colors:['#EDE0BB','#E1CE93','#F3EBD3','#E7D7A7'] },
  },

  /* ── Colores sólidos ── */
  { id:'solid-blue',    name:'Azul',     type:'solid', accent:'#3b82f6', bg:'#1e3a5f', light:{ accent:'#2B5F9E', bg:'#E7EEF7' } },
  { id:'solid-green',   name:'Verde',    type:'solid', accent:'#22c55e', bg:'#14532d', light:{ accent:'#2F6B41', bg:'#E9F3EC' } },
  { id:'solid-amber',   name:'Ámbar',    type:'solid', accent:'#f59e0b', bg:'#78350f', light:{ accent:'#8A5A12', bg:'#F7F0E1' } },
  { id:'solid-red',     name:'Rojo',     type:'solid', accent:'#ef4444', bg:'#7f1d1d', light:{ accent:'#A03A32', bg:'#F8EAE8' } },
  { id:'solid-purple',  name:'Violeta',  type:'solid', accent:'#a855f7', bg:'#3b0764', light:{ accent:'#5D3E90', bg:'#EEE9F6' } },
  { id:'solid-pink',    name:'Rosa',     type:'solid', accent:'#ec4899', bg:'#500724', light:{ accent:'#94356B', bg:'#F6E9F1' } },
  { id:'solid-cyan',    name:'Cian',     type:'solid', accent:'#06b6d4', bg:'#164e63', light:{ accent:'#1C6474', bg:'#E6F2F4' } },
  { id:'solid-indigo',  name:'Índigo',   type:'solid', accent:'#6366f1', bg:'#1e1b4b', light:{ accent:'#3F4595', bg:'#E9EAF6' } },
  { id:'solid-teal',    name:'Teal',     type:'solid', accent:'#14b8a6', bg:'#134e4a', light:{ accent:'#1B6659', bg:'#E5F1EF' } },
  { id:'solid-orange',  name:'Naranja',  type:'solid', accent:'#f97316', bg:'#7c2d12', light:{ accent:'#90501C', bg:'#F7EEE5' } },
  { id:'solid-slate',   name:'Gris',     type:'solid', accent:'#94a3b8', bg:'#1e293b', light:{ accent:'#4A5768', bg:'#EEF0F3' } },
  { id:'solid-white',   name:'Blanco',   type:'solid', accent:'#e2e8f0', bg:'#334155', light:{ accent:'#5A6270', bg:'#F1F2F4' } },

  /* ── Sólidos formales ──
     Color pleno, sin degradado y sin alfa. El MISMO valor en tema oscuro y en
     IPN/UNAM: son lo bastante oscuros para contrastar contra blanco y lo
     bastante claros para leerse sobre negro. Las paletas de arriba se apoyan
     en pasteles muy claros para la identidad clara, y sobre página blanca eso
     se percibe como transparencia; estas no. */
  { id:'mate-rojo',     name:'Rojo',     type:'solid', mate:true, accent:'#C0392B', bg:'#C0392B', light:{ accent:'#B03227', bg:'#B03227' } },
  { id:'mate-guinda',   name:'Guinda',   type:'solid', mate:true, accent:'#8E1F3D', bg:'#8E1F3D', light:{ accent:'#821B37', bg:'#821B37' } },
  { id:'mate-azul',     name:'Azul',     type:'solid', mate:true, accent:'#1F4E79', bg:'#1F4E79', light:{ accent:'#1B466D', bg:'#1B466D' } },
  { id:'mate-verde',    name:'Verde',    type:'solid', mate:true, accent:'#1E7A4C', bg:'#1E7A4C', light:{ accent:'#1A6B43', bg:'#1A6B43' } },
  { id:'mate-teal',     name:'Teal',     type:'solid', mate:true, accent:'#17706B', bg:'#17706B', light:{ accent:'#146360', bg:'#146360' } },
  { id:'mate-ambar',    name:'Ámbar',    type:'solid', mate:true, accent:'#B87400', bg:'#B87400', light:{ accent:'#A66900', bg:'#A66900' } },
  { id:'mate-naranja',  name:'Naranja',  type:'solid', mate:true, accent:'#C25A1E', bg:'#C25A1E', light:{ accent:'#AF501A', bg:'#AF501A' } },
  { id:'mate-morado',   name:'Morado',   type:'solid', mate:true, accent:'#5B3A8E', bg:'#5B3A8E', light:{ accent:'#513380', bg:'#513380' } },
  { id:'mate-pizarra',  name:'Pizarra',  type:'solid', mate:true, accent:'#3D4A5C', bg:'#3D4A5C', light:{ accent:'#354152', bg:'#354152' } },
  { id:'mate-grafito',  name:'Grafito',  type:'solid', mate:true, accent:'#4A4A4A', bg:'#4A4A4A', light:{ accent:'#404040', bg:'#404040' } },
]

/** Sólidas y opacas: las recomendadas para IPN y UNAM. */
export const MATE_PALETTES = COLOR_PALETTES.filter(p => p.mate)

export const GRADIENT_PALETTES = COLOR_PALETTES.filter(p => p.type === 'gradient')
/* Las mate son sólidas, pero van en su propia sección del selector. */
export const SOLID_PALETTES    = COLOR_PALETTES.filter(p => p.type === 'solid' && !p.mate)

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

function load() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') } catch { return {} }
}

export function useGroupColors() {
  const [saved, setSaved] = useState(load)
  const { t } = useAdminTheme()
  const claro = !!t?.light          // IPN o UNAM

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

  /** True si la identidad activa es clara — lo usan las tarjetas con shader. */
  const isLight = claro

  const setGroupPalette = useCallback((groupId, paletteId) => {
    setSaved(prev => {
      const next = { ...prev, [groupId]: paletteId }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  return { getColors, getAccent, getSurface, isLight, getPaletteId, getPalette, setGroupPalette }
}
