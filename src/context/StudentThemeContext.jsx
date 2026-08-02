import { createContext, useContext, useState } from 'react'

/* ── Apariencias disponibles en el portal del alumno ─────────────────
   ipn  → Guinda Politécnico #881126, resto blanco
   unam → Azul UNAM #003366, resto blanco con destellos dorados #CC9933 */
export const APPEARANCES = [
  { id: 'default', label: 'Por defecto' },
  { id: 'ipn',     label: 'Identidad Politécnica' },
  { id: 'unam',    label: 'Identidad Universitaria' },
]

export const TOKENS = {
  default: {
    light: false,
    mainBg: '#070b16', mainBgImage: 'none',
    sideBg: 'rgba(5,5,10,.82)', sideBorder: 'rgba(255,255,255,.07)',
    topBg: 'rgba(8,8,15,.80)', bottomBg: 'rgba(8,8,15,.92)',
    navActive: '#fbbf24',
    sideT1: 'rgba(255,255,255,.92)', sideT2: 'rgba(255,255,255,.62)', sideT3: 'rgba(255,255,255,.38)',
    t1: 'rgba(255,255,255,.88)', t2: 'rgba(255,255,255,.55)',
    t3: 'rgba(255,255,255,.35)', t4: 'rgba(255,255,255,.22)',
    cardBg: 'rgba(255,255,255,.05)', cardBorder: 'rgba(255,255,255,.08)',
    softBg: 'rgba(255,255,255,.05)', divider: 'rgba(255,255,255,.07)',
    grid: 'rgba(255,255,255,.06)', axis: 'rgba(255,255,255,.35)',
    tooltipBg: 'rgba(10,10,20,.92)', tooltipBorder: 'rgba(255,255,255,.12)', tooltipText: 'rgba(255,255,255,.80)',
    accent: '#fbbf24', good: '#34d399', info: '#60a5fa', warn: '#fbbf24', bad: '#f87171',
    goodSoft: 'rgba(52,211,153,.14)', infoSoft: 'rgba(96,165,250,.14)',
    warnSoft: 'rgba(251,191,36,.14)',  badSoft: 'rgba(248,113,113,.14)',
    goodLine: 'rgba(52,211,153,.30)', infoLine: 'rgba(96,165,250,.30)',
    warnLine: 'rgba(251,191,36,.30)',  badLine: 'rgba(248,113,113,.30)',
    ddBg: 'rgba(255,255,255,.07)', ddPanel: '#12121e',
    panelBg: 'rgba(8,8,15,.96)', headerBg: 'rgba(5,5,10,.70)',
  },
  ipn: {
    light: true,
    mainBg: '#ffffff', mainBgImage: 'none',
    sideBg: '#881126', sideBorder: 'rgba(255,255,255,.14)',
    topBg: '#881126', bottomBg: '#881126',
    navActive: '#ffffff',
    sideT1: 'rgba(255,255,255,.95)', sideT2: 'rgba(255,255,255,.70)', sideT3: 'rgba(255,255,255,.45)',
    t1: '#1a0b10', t2: '#423338', t3: '#6f5d63', t4: '#a89a9e',
    cardBg: '#ffffff', cardBorder: 'rgba(136,17,38,.26)',
    softBg: 'rgba(136,17,38,.055)', divider: 'rgba(136,17,38,.16)',
    grid: 'rgba(0,0,0,.07)', axis: '#a5979b',
    tooltipBg: '#ffffff', tooltipBorder: 'rgba(136,17,38,.20)', tooltipText: '#3f3237',
    accent: '#881126', good: '#1f6b55', info: '#2b5f9e', warn: '#9a5a0d', bad: '#a52f2a',
    goodSoft: '#e2f1ea', infoSoft: '#e4ecf8', warnSoft: '#fbeedb', badSoft: '#fae7e5',
    goodLine: '#b6ddcd', infoLine: '#bcd2ee', warnLine: '#eed4ac', badLine: '#eec4c0',
    ddBg: '#ffffff', ddPanel: '#ffffff',
    panelBg: '#ffffff', headerBg: '#f4ecee',
  },
  unam: {
    light: true,
    mainBg: '#ffffff',
    mainBgImage: 'radial-gradient(720px at 96% -6%, rgba(204,153,51,.16), transparent 60%), radial-gradient(520px at -4% 104%, rgba(204,153,51,.10), transparent 55%)',
    sideBg: '#003366', sideBorder: 'rgba(204,153,51,.28)',
    topBg: '#003366', bottomBg: '#003366',
    navActive: '#CC9933',
    sideT1: 'rgba(255,255,255,.95)', sideT2: 'rgba(255,255,255,.72)', sideT3: 'rgba(255,255,255,.48)',
    t1: '#08192e', t2: '#2b4260', t3: '#5a7189', t4: '#9aabbe',
    cardBg: '#ffffff', cardBorder: 'rgba(0,51,102,.24)',
    softBg: 'rgba(0,51,102,.055)', divider: 'rgba(0,51,102,.14)',
    grid: 'rgba(0,51,102,.08)', axis: '#8ba0b8',
    tooltipBg: '#ffffff', tooltipBorder: 'rgba(0,51,102,.18)', tooltipText: '#0f2440',
    accent: '#003366', good: '#1f6b55', info: '#2b5f9e', warn: '#8c6417', bad: '#a52f2a',
    goodSoft: '#e2f1ea', infoSoft: '#e4ecf8', warnSoft: '#f8eeda', badSoft: '#fae7e5',
    goodLine: '#b6ddcd', infoLine: '#bcd2ee', warnLine: '#e8d3a8', badLine: '#eec4c0',
    gold: '#CC9933',
    ddBg: '#ffffff', ddPanel: '#ffffff',
    panelBg: '#ffffff', headerBg: '#eef3f9',
  },
}

/* Colores de la tarjeta de presentación de "Mi Panel" */
export const CARD_COLORS = [
  { id: 'siga',      label: 'SIGA Navy',  grad: 'linear-gradient(135deg, rgba(30,58,110,.95) 0%, rgba(24,46,87,.85) 70%, rgba(161,28,51,.45) 100%)' },
  { id: 'guinda',    label: 'Guinda',     grad: 'linear-gradient(135deg, #881126 0%, #5a0b19 100%)' },
  { id: 'unam',      label: 'Azul UNAM',  grad: 'linear-gradient(135deg, #003366 0%, #00284f 72%, rgba(204,153,51,.55) 100%)' },
  { id: 'esmeralda', label: 'Esmeralda',  grad: 'linear-gradient(135deg, #065f46 0%, #064e3b 100%)' },
  { id: 'atardecer', label: 'Atardecer',  grad: 'linear-gradient(135deg, #7c2d12 0%, #b45309 100%)' },
  { id: 'violeta',   label: 'Violeta',    grad: 'linear-gradient(135deg, #4c1d95 0%, #2e1065 100%)' },

  /* Sólidos: un color pleno, sin degradado y sin alfa. Los de arriba se
     desvanecen contra el blanco de IPN y UNAM y se leen como transparentes. */
  { id: 'rojo',      label: 'Rojo',      mate: true, grad: '#C0392B' },
  { id: 'guinda-solido', label: 'Guinda sólido', mate: true, grad: '#8E1F3D' },
  { id: 'azul',      label: 'Azul',      mate: true, grad: '#1F4E79' },
  { id: 'verde',     label: 'Verde',     mate: true, grad: '#1E7A4C' },
  { id: 'teal',      label: 'Teal',      mate: true, grad: '#17706B' },
  { id: 'ambar',     label: 'Ámbar',     mate: true, grad: '#B87400' },
  { id: 'morado',    label: 'Morado',    mate: true, grad: '#5B3A8E' },
  { id: 'pizarra',   label: 'Pizarra',   mate: true, grad: '#3D4A5C' },
]

const APP_KEY  = 'siga_student_appearance'
const CARD_KEY = 'siga_student_card'

const Ctx = createContext(null)

export function StudentThemeProvider({ children }) {
  const [appearance, setAppearanceState] = useState(() => localStorage.getItem(APP_KEY) || 'default')
  const [cardColor, setCardColorState]   = useState(() => localStorage.getItem(CARD_KEY) || 'siga')

  const setAppearance = id => { setAppearanceState(id); localStorage.setItem(APP_KEY, id) }
  const setCardColor  = id => { setCardColorState(id);  localStorage.setItem(CARD_KEY, id) }

  const t    = TOKENS[appearance] ?? TOKENS.default
  const card = CARD_COLORS.find(c => c.id === cardColor) ?? CARD_COLORS[0]

  return (
    <Ctx.Provider value={{ appearance, setAppearance, cardColor, setCardColor, t, card }}>
      {children}
    </Ctx.Provider>
  )
}

/* Fallback a tokens oscuros si se usa fuera del provider */
export const useStudentTheme = () => useContext(Ctx) ?? {
  appearance: 'default', t: TOKENS.default, card: CARD_COLORS[0],
  cardColor: 'siga', setAppearance: () => {}, setCardColor: () => {},
}
