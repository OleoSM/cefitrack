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
    /* Relleno mate: color pleno y opaco pensado para llevar texto blanco
       encima. Aquí no valen los semánticos de arriba —son neón— porque el
       blanco sobre ellos no llega al contraste mínimo. */
    goodSolid: '#18795F', infoSolid: '#2F6BB0',
    warnSolid: '#9C6210',  badSolid: '#B23A33',
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
    /* Relleno mate: en las identidades claras coincide con el semántico,
       que ya es sólido y profundo. */
    goodSolid: '#1F6B55', infoSolid: '#2B5F9E',
    warnSolid: '#9A5A0D',  badSolid: '#A52F2A',
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
    /* Relleno mate: en las identidades claras coincide con el semántico,
       que ya es sólido y profundo. */
    goodSolid: '#1F6B55', infoSolid: '#2B5F9E',
    warnSolid: '#8C6417',  badSolid: '#A52F2A',
    gold: '#CC9933',
    ddBg: '#ffffff', ddPanel: '#ffffff',
    panelBg: '#ffffff', headerBg: '#eef3f9',
  },
}

/* Colores de la tarjeta de presentación de "Mi Panel".
   `grad` puede ser un color plano o un degradado; `grupo` ordena el selector.
   Además del catálogo, el alumno puede elegir cualquier color con la rueda:
   en ese caso `cardColor` guarda el hex y no un id. */
export const CARD_COLORS = [
  /* ── Institucional ── */
  { id: 'siga',      label: 'SIGA Navy',  grupo: 'Institucional', grad: 'linear-gradient(135deg, rgba(30,58,110,.95) 0%, rgba(24,46,87,.85) 70%, rgba(161,28,51,.45) 100%)' },
  { id: 'guinda',    label: 'Guinda IPN', grupo: 'Institucional', grad: 'linear-gradient(135deg, #881126 0%, #5a0b19 100%)' },
  { id: 'unam',      label: 'Azul UNAM',  grupo: 'Institucional', grad: 'linear-gradient(135deg, #003366 0%, #00284f 72%, rgba(204,153,51,.55) 100%)' },

  /* ── Oscuros ── */
  { id: 'guinda-solido', label: 'Guinda',    grupo: 'Oscuros', grad: '#4D0B1D' },
  { id: 'granate',       label: 'Granate',   grupo: 'Oscuros', grad: '#681126' },
  { id: 'rojo',          label: 'Rojo',      grupo: 'Oscuros', grad: '#78182B' },
  { id: 'marino',        label: 'Marino',    grupo: 'Oscuros', grad: '#12345A' },
  { id: 'petroleo',      label: 'Petróleo',  grupo: 'Oscuros', grad: '#064B60' },
  { id: 'bosque',        label: 'Bosque',    grupo: 'Oscuros', grad: '#17502D' },
  { id: 'verdemar',      label: 'Verde mar', grupo: 'Oscuros', grad: '#075348' },
  { id: 'morado',        label: 'Morado',    grupo: 'Oscuros', grad: '#48245F' },
  { id: 'ciruela',       label: 'Ciruela',   grupo: 'Oscuros', grad: '#5E1948' },
  { id: 'cafe',          label: 'Café',      grupo: 'Oscuros', grad: '#633515' },
  { id: 'grafito',       label: 'Grafito',   grupo: 'Oscuros', grad: '#2A2D33' },
  { id: 'medianoche',    label: 'Medianoche',grupo: 'Oscuros', grad: '#0F1B2E' },

  /* ── Claros ──
     El texto de la tarjeta se calcula por luminancia, así que sobre estos
     sale oscuro automáticamente. */
  { id: 'arena',     label: 'Arena',    grupo: 'Claros', grad: '#E8D9BE' },
  { id: 'menta',     label: 'Menta',    grupo: 'Claros', grad: '#CFE8DA' },
  { id: 'cielo',     label: 'Cielo',    grupo: 'Claros', grad: '#CFE0F2' },
  { id: 'lavanda',   label: 'Lavanda',  grupo: 'Claros', grad: '#DED3EE' },
  { id: 'durazno',   label: 'Durazno',  grupo: 'Claros', grad: '#F5D9C8' },
  { id: 'perla',     label: 'Perla',    grupo: 'Claros', grad: '#E9E9EC' },

  /* ── Temáticos ──
     Combinaciones con carácter. Los nombres evocan un registro, no una obra:
     son paletas de color, no reproducciones de nada. */
  { id: 'guerra',    label: 'Colores de guerra', grupo: 'Temáticos', grad: 'linear-gradient(135deg, #1A0505 0%, #7A1010 55%, #C6A03C 100%)' },
  { id: 'militar',   label: 'Militar',           grupo: 'Temáticos', grad: 'linear-gradient(135deg, #3B4526 0%, #5A6B35 50%, #2B331C 100%)' },
  { id: 'saiyajin',  label: 'Saiyajin',          grupo: 'Temáticos', grad: 'linear-gradient(135deg, #E8641A 0%, #1D4FA8 100%)' },
  { id: 'ninja',     label: 'Ninja',             grupo: 'Temáticos', grad: 'linear-gradient(135deg, #14161A 0%, #E2661B 100%)' },
  { id: 'arachnido', label: 'Arácnido',          grupo: 'Temáticos', grad: 'linear-gradient(135deg, #B3122A 0%, #123A8C 100%)' },
  { id: 'aztec',     label: 'Azteca',            grupo: 'Temáticos', grad: 'linear-gradient(135deg, #0E5C55 0%, #C6A03C 60%, #7A1010 100%)' },
  { id: 'volcan',    label: 'Volcán',            grupo: 'Temáticos', grad: 'linear-gradient(135deg, #1A1A1A 0%, #6B1B0E 55%, #F07316 100%)' },
  { id: 'oceano',    label: 'Océano',            grupo: 'Temáticos', grad: 'linear-gradient(135deg, #04223A 0%, #0B6E8C 60%, #35C3D6 100%)' },
  { id: 'galaxia',   label: 'Galaxia',           grupo: 'Temáticos', grad: 'linear-gradient(135deg, #17103A 0%, #4A2472 55%, #A93380 100%)' },
  { id: 'oro',       label: 'Oro',               grupo: 'Temáticos', grad: 'linear-gradient(135deg, #3B2A08 0%, #A6820F 55%, #E6B33D 100%)' },
]

/**
 * ¿El color de fondo es claro? Se usa para decidir si el texto de la tarjeta
 * va oscuro o blanco. Con degradados se toma el primer color que aparezca:
 * es una aproximación, pero los degradados del catálogo arrancan oscuros.
 */
export function esColorClaro(valor = '') {
  const hex = (valor.match(/#([0-9a-f]{6}|[0-9a-f]{3})/i) ?? [])[0]
  if (!hex) return false
  const h = hex.length === 4
    ? '#' + [...hex.slice(1)].map(c => c + c).join('')
    : hex
  const r = parseInt(h.slice(1, 3), 16)
  const g = parseInt(h.slice(3, 5), 16)
  const b = parseInt(h.slice(5, 7), 16)
  // Luminancia relativa ponderada por la sensibilidad del ojo a cada canal.
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.6
}

const APP_KEY  = 'siga_student_appearance'
const CARD_KEY = 'siga_student_card'

const Ctx = createContext(null)

export function StudentThemeProvider({ children }) {
  const [appearance, setAppearanceState] = useState(() => localStorage.getItem(APP_KEY) || 'default')
  const [cardColor, setCardColorState]   = useState(() => localStorage.getItem(CARD_KEY) || 'siga')

  const setAppearance = id => { setAppearanceState(id); localStorage.setItem(APP_KEY, id) }
  const setCardColor  = id => { setCardColorState(id);  localStorage.setItem(CARD_KEY, id) }

  const t    = TOKENS[appearance] ?? TOKENS.default
  const card = cardColor?.startsWith('#')
    ? { id: cardColor, label: 'Personalizado', grad: cardColor, grupo: 'Personalizado' }
    : (CARD_COLORS.find(c => c.id === cardColor) ?? CARD_COLORS[0])

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
