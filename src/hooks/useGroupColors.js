import { useState, useCallback } from 'react'

/*
 * Cada paleta tiene:
 *   id, name, type ('gradient' | 'solid')
 *   accent   — color principal para avatar, barra, glow
 *   colors   — array de 4 colores para el Warp (solo en gradient)
 *   bg       — fondo sólido (solo en solid)
 */
export const COLOR_PALETTES = [
  /* ── Degradados ── */
  {
    id:'ocean',    name:'Océano',    type:'gradient', accent:'hsl(190,100%,55%)',
    colors:['hsl(210,100%,20%)','hsl(190,100%,55%)','hsl(200,90%,32%)','hsl(185,100%,68%)'],
  },
  {
    id:'forest',   name:'Bosque',    type:'gradient', accent:'hsl(130,70%,50%)',
    colors:['hsl(140,80%,16%)','hsl(120,70%,50%)','hsl(150,90%,26%)','hsl(130,80%,63%)'],
  },
  {
    id:'sunset',   name:'Atardecer', type:'gradient', accent:'hsl(38,100%,58%)',
    colors:['hsl(20,100%,26%)','hsl(40,100%,58%)','hsl(10,90%,36%)','hsl(50,100%,70%)'],
  },
  {
    id:'aurora',   name:'Aurora',    type:'gradient', accent:'hsl(300,85%,58%)',
    colors:['hsl(270,100%,26%)','hsl(300,90%,58%)','hsl(290,80%,36%)','hsl(320,100%,70%)'],
  },
  {
    id:'fire',     name:'Fuego',     type:'gradient', accent:'hsl(25,100%,55%)',
    colors:['hsl(0,100%,26%)','hsl(30,100%,55%)','hsl(15,90%,34%)','hsl(45,100%,68%)'],
  },
  {
    id:'cosmos',   name:'Cosmos',    type:'gradient', accent:'hsl(258,100%,62%)',
    colors:['hsl(240,100%,14%)','hsl(260,100%,62%)','hsl(250,80%,28%)','hsl(270,80%,74%)'],
  },
  {
    id:'arctic',   name:'Ártico',    type:'gradient', accent:'hsl(194,80%,68%)',
    colors:['hsl(200,60%,16%)','hsl(194,80%,68%)','hsl(205,50%,28%)','hsl(190,70%,83%)'],
  },
  {
    id:'rose',     name:'Rosa',      type:'gradient', accent:'hsl(348,90%,62%)',
    colors:['hsl(330,80%,20%)','hsl(350,90%,62%)','hsl(340,80%,34%)','hsl(360,80%,74%)'],
  },
  {
    id:'emerald',  name:'Esmeralda', type:'gradient', accent:'hsl(160,85%,48%)',
    colors:['hsl(170,100%,14%)','hsl(160,85%,48%)','hsl(150,80%,24%)','hsl(165,90%,65%)'],
  },
  {
    id:'gold',     name:'Dorado',    type:'gradient', accent:'hsl(45,100%,55%)',
    colors:['hsl(35,90%,18%)','hsl(45,100%,55%)','hsl(40,95%,30%)','hsl(50,100%,72%)'],
  },

  /* ── Colores sólidos ── */
  { id:'solid-blue',    name:'Azul',     type:'solid', accent:'#3b82f6', bg:'#1e3a5f' },
  { id:'solid-green',   name:'Verde',    type:'solid', accent:'#22c55e', bg:'#14532d' },
  { id:'solid-amber',   name:'Ámbar',    type:'solid', accent:'#f59e0b', bg:'#78350f' },
  { id:'solid-red',     name:'Rojo',     type:'solid', accent:'#ef4444', bg:'#7f1d1d' },
  { id:'solid-purple',  name:'Violeta',  type:'solid', accent:'#a855f7', bg:'#3b0764' },
  { id:'solid-pink',    name:'Rosa',     type:'solid', accent:'#ec4899', bg:'#500724' },
  { id:'solid-cyan',    name:'Cian',     type:'solid', accent:'#06b6d4', bg:'#164e63' },
  { id:'solid-indigo',  name:'Índigo',   type:'solid', accent:'#6366f1', bg:'#1e1b4b' },
  { id:'solid-teal',    name:'Teal',     type:'solid', accent:'#14b8a6', bg:'#134e4a' },
  { id:'solid-orange',  name:'Naranja',  type:'solid', accent:'#f97316', bg:'#7c2d12' },
  { id:'solid-slate',   name:'Gris',     type:'solid', accent:'#94a3b8', bg:'#1e293b' },
  { id:'solid-white',   name:'Blanco',   type:'solid', accent:'#e2e8f0', bg:'#334155' },
]

export const GRADIENT_PALETTES = COLOR_PALETTES.filter(p => p.type === 'gradient')
export const SOLID_PALETTES    = COLOR_PALETTES.filter(p => p.type === 'solid')

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

  const getPalette = useCallback((groupId) => {
    const pid = saved[groupId] ?? DEFAULTS[groupId] ?? 'ocean'
    return COLOR_PALETTES.find(p => p.id === pid) ?? COLOR_PALETTES[0]
  }, [saved])

  const getPaletteId = useCallback((groupId) => getPalette(groupId).id, [getPalette])

  /* Devuelve el array de 4 colores (para el Warp) o 4 veces el bg (solid) */
  const getColors = useCallback((groupId) => {
    const p = getPalette(groupId)
    return p.type === 'gradient'
      ? p.colors
      : [p.bg, p.accent, p.bg, p.accent]
  }, [getPalette])

  const getAccent = useCallback((groupId) => getPalette(groupId).accent, [getPalette])

  const setGroupPalette = useCallback((groupId, paletteId) => {
    setSaved(prev => {
      const next = { ...prev, [groupId]: paletteId }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  return { getColors, getAccent, getPaletteId, getPalette, setGroupPalette }
}
