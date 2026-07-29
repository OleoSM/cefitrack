import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { QRCodeSVG } from 'qrcode.react'
import { getTargetSchool } from '../../data/mockData'
import { useStudentData } from '../../hooks/useStudentData'
import { Download, Shield, Printer, Info, AlertTriangle, Pencil, Maximize2, RotateCw, X, ChevronDown } from 'lucide-react'
import FlipCard from '../../components/ui/FlipCard'
import { useStudentTheme } from '../../context/StudentThemeContext'

const QR_PREFIX = 'EDUTRACK:'
const FONT = "'Plus Jakarta Sans', Manrope, system-ui, -apple-system, sans-serif"
const CW = 600, CH = 950   // canvas dimensions (portrait)

/* ════════════════════════════════════════════════════════════════
   AVATARS — educational icons (emoji rendered on canvas)
════════════════════════════════════════════════════════════════ */
const AVATARS = [
  { id:'cap',     emoji:'🎓', label:'Birrete'    },
  { id:'books',   emoji:'📚', label:'Libros'     },
  { id:'atom',    emoji:'⚛️', label:'Átomo'      },
  { id:'pencil',  emoji:'✏️', label:'Lápiz'      },
  { id:'flask',   emoji:'🧪', label:'Química'    },
  { id:'rocket',  emoji:'🚀', label:'Cohete'     },
  { id:'star',    emoji:'⭐', label:'Estrella'   },
  { id:'bulb',    emoji:'💡', label:'Idea'       },
  { id:'scope',   emoji:'🔭', label:'Telescopio' },
  { id:'brain',   emoji:'🧠', label:'Cerebro'    },
  { id:'compass', emoji:'📐', label:'Geometría'  },
  { id:'target',  emoji:'🎯', label:'Meta'       },
]

/* ════════════════════════════════════════════════════════════════
   COLOR THEMES — QR always black on white regardless of theme
════════════════════════════════════════════════════════════════ */
const THEMES = [
  {
    id:'default', name:'Predeterminado', best:true, swatch:'#0f172a',
    cardBg:'#ffffff', headerBg:'#0f172a', headerText:'#ffffff', headerSub:'rgba(255,255,255,0.48)',
    accent:'#2563eb', nameColor:'#0f172a', subColor:'#475569', yearColor:'#64748b',
    footerBg:'#f1f5f9', footerText:'#475569', labelColor:'#2563eb', valueColor:'#0f172a',
  },
  {
    id:'navy', name:'Azul Marino', best:false, swatch:'#1e3a6e',
    cardBg:'#f8faff', headerBg:'#1e3a6e', headerText:'#ffffff', headerSub:'rgba(255,255,255,0.52)',
    accent:'#3b82f6', nameColor:'#1e3a6e', subColor:'#3b82f6', yearColor:'#3b82f6',
    footerBg:'#e8efff', footerText:'#3b5998', labelColor:'#3b82f6', valueColor:'#1e3a6e',
  },
  {
    id:'green', name:'Verde', best:false, swatch:'#14532d',
    cardBg:'#f0fdf4', headerBg:'#14532d', headerText:'#ffffff', headerSub:'rgba(255,255,255,0.52)',
    accent:'#16a34a', nameColor:'#14532d', subColor:'#16a34a', yearColor:'#16a34a',
    footerBg:'#dcfce7', footerText:'#166534', labelColor:'#16a34a', valueColor:'#14532d',
  },
  {
    id:'purple', name:'Violeta', best:false, swatch:'#3b0764',
    cardBg:'#faf5ff', headerBg:'#3b0764', headerText:'#ffffff', headerSub:'rgba(255,255,255,0.52)',
    accent:'#9333ea', nameColor:'#3b0764', subColor:'#9333ea', yearColor:'#9333ea',
    footerBg:'#f3e8ff', footerText:'#7e22ce', labelColor:'#9333ea', valueColor:'#3b0764',
  },
  {
    id:'red', name:'Rojo', best:false, swatch:'#7f1d1d',
    cardBg:'#fff5f5', headerBg:'#7f1d1d', headerText:'#ffffff', headerSub:'rgba(255,255,255,0.52)',
    accent:'#dc2626', nameColor:'#7f1d1d', subColor:'#dc2626', yearColor:'#dc2626',
    footerBg:'#fee2e2', footerText:'#991b1b', labelColor:'#dc2626', valueColor:'#7f1d1d',
  },
  {
    id:'teal', name:'Teal', best:false, swatch:'#134e4a',
    cardBg:'#f0fdfa', headerBg:'#134e4a', headerText:'#ffffff', headerSub:'rgba(255,255,255,0.52)',
    accent:'#0d9488', nameColor:'#134e4a', subColor:'#0d9488', yearColor:'#0d9488',
    footerBg:'#ccfbf1', footerText:'#0f766e', labelColor:'#0d9488', valueColor:'#134e4a',
  },
  {
    id:'dark', name:'Oscuro', best:false, swatch:'#1e293b',
    cardBg:'#1e293b', headerBg:'#0f172a', headerText:'#ffffff', headerSub:'rgba(255,255,255,0.42)',
    accent:'#60a5fa', nameColor:'#f1f5f9', subColor:'#94a3b8', yearColor:'#94a3b8',
    footerBg:'#0f172a', footerText:'#64748b', labelColor:'#60a5fa', valueColor:'#e2e8f0',
  },
  {
    id:'amber', name:'Dorado', best:false, swatch:'#78350f',
    cardBg:'#fffbeb', headerBg:'#78350f', headerText:'#ffffff', headerSub:'rgba(255,255,255,0.52)',
    accent:'#d97706', nameColor:'#78350f', subColor:'#d97706', yearColor:'#d97706',
    footerBg:'#fef3c7', footerText:'#92400e', labelColor:'#d97706', valueColor:'#78350f',
  },
]

const RESP = 'Es responsabilidad del alumno imprimir a color, enmicar y portar la credencial en todo momento'

/* ════════════════════════════════════════════════════════════════
   CANVAS HELPERS
════════════════════════════════════════════════════════════════ */
function rRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

function wrapText(ctx, text, x, y, maxW, lh) {
  const words = text.split(' ')
  let line = ''
  const lines = []
  for (const w of words) {
    const test = line + w + ' '
    if (ctx.measureText(test).width > maxW && line) { lines.push(line.trim()); line = w + ' ' }
    else line = test
  }
  if (line.trim()) lines.push(line.trim())
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * lh))
  return lines.length * lh
}

function fitText(ctx, text, maxW, maxSize, minSize = 12) {
  let size = maxSize
  ctx.font = `bold ${size}px ${FONT}`
  while (ctx.measureText(text).width > maxW && size > minSize) {
    size -= 1; ctx.font = `bold ${size}px ${FONT}`
  }
  return size
}

/* ════════════════════════════════════════════════════════════════
   FRONT CANVAS
════════════════════════════════════════════════════════════════ */
async function buildFront(student, grp, svgString, theme, emoji) {
  await document.fonts.ready
  const canvas = document.createElement('canvas')
  canvas.width = CW; canvas.height = CH
  const ctx = canvas.getContext('2d')

  // Card bg
  ctx.fillStyle = theme.cardBg
  ctx.fillRect(0, 0, CW, CH)

  // ── Header (0 → 155) ───────────────────────────────────────
  ctx.fillStyle = theme.headerBg
  ctx.fillRect(0, 0, CW, 155)

  // Avatar circle
  ctx.fillStyle = 'rgba(255,255,255,0.15)'
  ctx.beginPath(); ctx.arc(56, 77, 40, 0, Math.PI * 2); ctx.fill()
  ctx.font = '36px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText(emoji, 56, 79)

  // CEFIMAT title
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = theme.headerText
  ctx.font = `bold 22px ${FONT}`
  ctx.fillText('CEFIMAT', 112, 67)
  ctx.fillStyle = theme.headerSub
  ctx.font = `500 11px ${FONT}`
  ctx.fillText('Centro de Física y Matemáticas', 112, 88)

  // SIGA badge (right)
  ctx.textAlign = 'right'
  ctx.fillStyle = 'rgba(255,255,255,0.18)'
  ctx.font = `bold 9px ${FONT}`
  ctx.fillText('SIGA CEFIMAT', CW - 20, 66)
  ctx.font = `400 9px ${FONT}`
  ctx.fillText('Gestión Académica', CW - 20, 80)

  // Accent underline
  ctx.fillStyle = theme.accent
  ctx.fillRect(0, 151, CW, 4)

  // ── Name (155 → 235) ───────────────────────────────────────
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  fitText(ctx, student.name, CW - 80, 22)
  ctx.fillStyle = theme.nameColor
  ctx.fillText(student.name, CW / 2, 194)
  const nw = Math.min(ctx.measureText(student.name).width, CW - 80)
  ctx.fillStyle = theme.accent
  ctx.fillRect(CW / 2 - nw / 2, 208, nw, 3)

  // ── QR area (235 → 730) ────────────────────────────────────
  const qrSize = 326, qrPad = 16
  const qrBoxX = (CW - qrSize - qrPad * 2) / 2
  const qrBoxY = 234

  // White QR container (always white, QR is always B&W)
  ctx.shadowColor = 'rgba(0,0,0,0.16)'; ctx.shadowBlur = 20; ctx.shadowOffsetY = 8
  ctx.fillStyle = '#ffffff'
  rRect(ctx, qrBoxX, qrBoxY, qrSize + qrPad * 2, qrSize + qrPad * 2, 14)
  ctx.fill()
  ctx.shadowBlur = 0; ctx.shadowOffsetY = 0

  await new Promise(resolve => {
    const blob = new Blob([svgString], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => { ctx.drawImage(img, qrBoxX + qrPad, qrBoxY + qrPad, qrSize, qrSize); URL.revokeObjectURL(url); resolve() }
    img.onerror = resolve; img.src = url
  })

  // Subtle label under QR
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillStyle = theme.subColor
  ctx.font = `500 10.5px ${FONT}`
  ctx.fillText('CREDENCIAL ESTUDIANTIL · SIGA CEFIMAT', CW / 2, qrBoxY + qrSize + qrPad * 2 + 22)

  // ── Year pill (740 → 805) ──────────────────────────────────
  const pillY = qrBoxY + qrSize + qrPad * 2 + 46
  ctx.fillStyle = `${theme.accent}1a`
  rRect(ctx, CW / 2 - 72, pillY, 144, 38, 19); ctx.fill()
  ctx.strokeStyle = `${theme.accent}45`; ctx.lineWidth = 1
  rRect(ctx, CW / 2 - 72, pillY, 144, 38, 19); ctx.stroke()
  ctx.fillStyle = theme.accent
  ctx.font = `bold 15px ${FONT}`
  ctx.fillText('2025 – 2026', CW / 2, pillY + 19)

  // ── Footer (828 → CH) ──────────────────────────────────────
  const ftY = CH - 122
  ctx.fillStyle = theme.footerBg
  ctx.fillRect(0, ftY, CW, CH - ftY)
  ctx.fillStyle = `${theme.accent}35`; ctx.fillRect(0, ftY, CW, 1)

  ctx.fillStyle = theme.footerText
  ctx.font = `400 11px ${FONT}`
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'
  wrapText(ctx, RESP, CW / 2, ftY + 30, CW - 64, 18)

  return canvas
}

/* ════════════════════════════════════════════════════════════════
   BACK CANVAS
════════════════════════════════════════════════════════════════ */
async function buildBack(student, grp, theme, emoji, targetSchool) {
  await document.fonts.ready
  const canvas = document.createElement('canvas')
  canvas.width = CW; canvas.height = CH
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = theme.cardBg
  ctx.fillRect(0, 0, CW, CH)

  // ── Header (0 → 115) ───────────────────────────────────────
  ctx.fillStyle = theme.headerBg
  ctx.fillRect(0, 0, CW, 115)
  ctx.fillStyle = theme.accent; ctx.fillRect(0, 111, CW, 4)

  ctx.font = '28px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText(emoji, CW / 2, 40)
  ctx.fillStyle = theme.headerText
  ctx.font = `bold 15px ${FONT}`; ctx.textBaseline = 'alphabetic'
  ctx.fillText('CEFIMAT', CW / 2, 78)
  ctx.fillStyle = theme.headerSub
  ctx.font = `400 10px ${FONT}`
  ctx.fillText('Centro de Física y Matemáticas', CW / 2, 96)

  // ── Info fields (125 → 800) ────────────────────────────────
  const fields = [
    ['GRUPO',            grp?.name          ?? '—'],
    ['TUTOR A CARGO',   student.tutor?.name ?? '—'],
    ['ESCUELA OBJETIVO', targetSchool?.nombre ?? '—'],
    ['TELÉFONO TUTOR',  student.tutor?.phone ?? '—'],
  ]

  const iX = 48, stepH = 148
  let fy = 132

  fields.forEach(([label, value]) => {
    // Field bg card
    ctx.fillStyle = `${theme.accent}0d`
    rRect(ctx, iX - 10, fy - 6, CW - (iX - 10) * 2, 108, 10); ctx.fill()

    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'
    ctx.fillStyle = theme.labelColor
    ctx.font = `bold 9.5px ${FONT}`
    ctx.fillText(label, iX, fy + 16)

    // Auto-fit value
    fitText(ctx, value, CW - iX * 2 - 20, 22, 14)
    ctx.fillStyle = theme.valueColor
    ctx.fillText(value, iX, fy + 50)

    // Dotted divider
    ctx.strokeStyle = `${theme.accent}22`; ctx.lineWidth = 1
    ctx.setLineDash([5, 5])
    ctx.beginPath(); ctx.moveTo(iX, fy + 80); ctx.lineTo(CW - iX, fy + 80); ctx.stroke()
    ctx.setLineDash([])

    fy += stepH
  })

  // ── Footer (792 → CH) ──────────────────────────────────────
  const ftY = CH - 158
  ctx.fillStyle = theme.footerBg; ctx.fillRect(0, ftY, CW, CH - ftY)
  ctx.fillStyle = `${theme.accent}35`; ctx.fillRect(0, ftY, CW, 1)

  // Warning icon (triangle char)
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = theme.accent
  ctx.font = `bold 16px ${FONT}`
  ctx.fillText('⚠', CW / 2, ftY + 30)

  ctx.fillStyle = theme.footerText
  ctx.font = `400 11px ${FONT}`
  wrapText(ctx, RESP, CW / 2, ftY + 50, CW - 64, 18)

  // Print tip
  ctx.fillStyle = theme.labelColor
  ctx.font = `500 9.5px ${FONT}`
  ctx.fillText('Imprimir · Recortar · Enmicar', CW / 2, CH - 18)

  return canvas
}

/* ════════════════════════════════════════════════════════════════
   PREVIEW COMPONENTS (HTML — for real-time interaction)
════════════════════════════════════════════════════════════════ */
function FrontCard({ student, qrValue, theme, avatar }) {
  return (
    <div style={{ width: 230, background: theme.cardBg, borderRadius: 14, overflow: 'hidden', boxShadow: '0 18px 48px rgba(0,0,0,0.32), 0 2px 8px rgba(0,0,0,0.18)', flexShrink: 0, border: `1px solid rgba(0,0,0,0.06)`, fontFamily: FONT }}>
      {/* Header */}
      <div style={{ background: theme.headerBg, padding: '12px 11px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
          {avatar.emoji}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ color: theme.headerText, fontWeight: 800, fontSize: 13, margin: 0, letterSpacing: '-0.01em' }}>CEFIMAT</p>
          <p style={{ color: theme.headerSub, fontSize: 8.5, margin: '1px 0 0' }}>Centro de Física y Matemáticas</p>
        </div>
        <p style={{ color: 'rgba(255,255,255,0.18)', fontSize: 8, flexShrink: 0 }}>SIGA</p>
      </div>
      {/* Accent stripe */}
      <div style={{ height: 3, background: theme.accent }}/>
      {/* Name */}
      <div style={{ padding: '10px 11px 5px', textAlign: 'center', background: theme.cardBg }}>
        <p style={{ color: theme.nameColor, fontWeight: 700, fontSize: 11, margin: 0, lineHeight: 1.3 }}>{student.name}</p>
        <div style={{ width: 44, height: 2, background: theme.accent, margin: '4px auto 0', borderRadius: 1 }}/>
      </div>
      {/* QR — always B&W white container */}
      <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0', background: theme.cardBg }}>
        <div style={{ padding: 7, background: '#ffffff', borderRadius: 8, boxShadow: '0 2px 12px rgba(0,0,0,0.14)' }}>
          <QRCodeSVG value={qrValue} size={122} level="H" fgColor="#0f172a" bgColor="#ffffff"/>
        </div>
      </div>
      {/* Subtext */}
      <p style={{ color: theme.subColor, fontSize: 7.5, textAlign: 'center', margin: '0 0 4px', opacity: 0.7, letterSpacing: '0.06em' }}>
        CREDENCIAL ESTUDIANTIL · SIGA CEFIMAT
      </p>
      {/* Year pill */}
      <div style={{ display: 'flex', justifyContent: 'center', padding: '3px 0 9px' }}>
        <span style={{ background: `${theme.accent}1a`, border: `1px solid ${theme.accent}42`, color: theme.accent, fontSize: 10, fontWeight: 700, padding: '3px 11px', borderRadius: 12 }}>
          2025 – 2026
        </span>
      </div>
      {/* Footer */}
      <div style={{ background: theme.footerBg, padding: '7px 11px', borderTop: `1px solid ${theme.accent}28` }}>
        <p style={{ color: theme.footerText, fontSize: 6.8, textAlign: 'center', lineHeight: 1.55, margin: 0 }}>{RESP}</p>
      </div>
    </div>
  )
}

function BackCard({ student, grp, theme, avatar, targetSchool }) {
  const fields = [
    ['GRUPO',            grp?.name          ?? '—'],
    ['TUTOR A CARGO',   student.tutor?.name ?? '—'],
    ['ESCUELA OBJETIVO', targetSchool?.nombre ?? '—'],
    ['TELÉFONO TUTOR',  student.tutor?.phone ?? '—'],
  ]
  return (
    <div style={{ width: 230, background: theme.cardBg, borderRadius: 14, overflow: 'hidden', boxShadow: '0 18px 48px rgba(0,0,0,0.32), 0 2px 8px rgba(0,0,0,0.18)', flexShrink: 0, border: `1px solid rgba(0,0,0,0.06)`, fontFamily: FONT }}>
      {/* Header */}
      <div style={{ background: theme.headerBg, padding: '10px 12px', textAlign: 'center' }}>
        <span style={{ fontSize: 22 }}>{avatar.emoji}</span>
        <p style={{ color: theme.headerText, fontWeight: 700, fontSize: 11, margin: '3px 0 0' }}>CEFIMAT</p>
        <p style={{ color: theme.headerSub, fontSize: 8, margin: '1px 0 0' }}>Centro de Física y Matemáticas</p>
      </div>
      <div style={{ height: 3, background: theme.accent }}/>
      {/* Info fields */}
      <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 6, background: theme.cardBg }}>
        {fields.map(([label, value]) => (
          <div key={label} style={{ paddingBottom: 6, borderBottom: `1px dashed ${theme.accent}28` }}>
            <p style={{ color: theme.labelColor, fontSize: 7.5, fontWeight: 700, margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</p>
            <p style={{ color: theme.valueColor, fontSize: 12.5, fontWeight: 600, margin: '2px 0 0', lineHeight: 1.2 }}>{value}</p>
          </div>
        ))}
      </div>
      {/* Footer */}
      <div style={{ background: theme.footerBg, padding: '7px 11px', borderTop: `1px solid ${theme.accent}28` }}>
        <p style={{ color: theme.accent, fontSize: 8.5, textAlign: 'center', fontWeight: 700, margin: '0 0 3px' }}>⚠</p>
        <p style={{ color: theme.footerText, fontSize: 6.8, textAlign: 'center', lineHeight: 1.55, margin: 0 }}>{RESP}</p>
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════════════════════════════ */
export default function MyQR() {
  const { t: tt } = useStudentTheme()
  const { student, group: grp } = useStudentData()
  const targetSchool = student ? getTargetSchool(student.id) : null
  const qrRef   = useRef(null)

  const [busy, setBusy] = useState(false)
  const [flipped, setFlipped] = useState(false)      // reverso visible
  const [editOpen, setEditOpen] = useState(false)    // panel de personalización (lápiz)
  const [qrModal, setQrModal] = useState(false)      // QR ampliado en pantalla completa
  const [howOpen, setHowOpen] = useState(false)      // instrucciones colapsables

  const [selectedAvatar, setSelectedAvatar] = useState(
    () => localStorage.getItem('cred_avatar') ?? 'cap'
  )
  const [selectedTheme, setSelectedTheme] = useState(
    () => localStorage.getItem('cred_theme') ?? 'default'
  )

  if (!student) return (
    <p className="text-sm" style={{ color:'rgba(255,255,255,.40)' }}>Perfil no disponible.</p>
  )

  const avatar    = AVATARS.find(a => a.id === selectedAvatar) ?? AVATARS[0]
  const theme     = THEMES.find(t => t.id === selectedTheme) ?? THEMES[0]
  const qrValue   = `${QR_PREFIX}${student.id}`

  const pickAvatar = (id) => { setSelectedAvatar(id); localStorage.setItem('cred_avatar', id) }
  const pickTheme  = (id) => { setSelectedTheme(id);  localStorage.setItem('cred_theme', id) }

  const getSvg = () => {
    const svg = qrRef.current?.querySelector('svg')
    return svg ? new XMLSerializer().serializeToString(svg) : null
  }

  const handleDownloadPNG = async () => {
    const svgStr = getSvg(); if (!svgStr || busy) return
    setBusy(true)
    const canvas = await buildFront(student, grp, svgStr, theme, avatar.emoji)
    const link = document.createElement('a')
    link.download = `Credencial_Frente_${student.name.replace(/\s+/g,'_')}.png`
    link.href = canvas.toDataURL('image/png', 1.0); link.click()
    setBusy(false)
  }

  const handleExportPDF = async () => {
    const svgStr = getSvg(); if (!svgStr || busy) return
    setBusy(true)
    const [frontCanvas, backCanvas] = await Promise.all([
      buildFront(student, grp, svgStr, theme, avatar.emoji),
      buildBack(student, grp, theme, avatar.emoji, targetSchool),
    ])
    const fUrl = frontCanvas.toDataURL('image/png', 1.0)
    const bUrl = backCanvas.toDataURL('image/png', 1.0)

    const win = window.open('', '_blank', 'width=1040,height=740')
    if (!win) { setBusy(false); return }
    win.document.write(`<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8">
<title>Credencial CEFIMAT — ${student.name}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#e2e8f0;font-family:system-ui,sans-serif;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:32px;gap:20px}
.cards{display:flex;gap:28px;align-items:flex-start;justify-content:center;flex-wrap:wrap}
.cw{display:flex;flex-direction:column;align-items:center;gap:6px}
img{width:296px;border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,0.18)}
.lbl{font-size:11px;color:#64748b;font-weight:600;letter-spacing:0.05em;text-transform:uppercase}
.btn{background:#0f172a;color:#fff;border:none;padding:12px 28px;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:8px}
.btn:hover{background:#1e293b}
.notice{font-size:11px;color:#64748b;text-align:center;max-width:640px;line-height:1.6;background:#fff;padding:12px 20px;border-radius:8px;border:1px solid #e2e8f0}
.tip{font-size:11px;color:#94a3b8;text-align:center}
@media print{body{background:#fff;padding:0;justify-content:flex-start;gap:0;min-height:auto}.cards{padding:6mm;gap:8mm;justify-content:center}.btn,.notice,.tip{display:none}img{width:65mm;border-radius:0;box-shadow:none}}
</style></head><body>
<div class="cards">
  <div class="cw"><img src="${fUrl}" alt="Frente"/><p class="lbl">Frente</p></div>
  <div class="cw"><img src="${bUrl}" alt="Reverso"/><p class="lbl">Reverso</p></div>
</div>
<button class="btn" onclick="window.print()">
  <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6z"/></svg>
  Imprimir / Guardar como PDF
</button>
<p class="notice">⚠️ ${RESP}</p>
<p class="tip">Imprimir en papel fotográfico o cartulina · Recortar · Enmicar ambos lados</p>
</body></html>`)
    win.document.close(); setBusy(false)
  }

  /* ── UI ─────────────────────────────────────────────────────── */
  return (
    <div className="max-w-4xl mx-auto space-y-5">

      {/* Header */}
      <div>
        <h1 className="page-title">Mi Código QR</h1>
        <p className="text-sm mt-1" style={{ color: tt.t3 }}>
          Muestra este código al docente para registrar tu asistencia.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">

        {/* ══ Columna izquierda: QR en vivo + descargas ══════════ */}
        <div className="space-y-4">
          <div className="card p-5 flex flex-col items-center">
            <div className="w-full flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <img src="/logo.jpeg" alt="" className="w-7 h-7 rounded-full object-cover"
                  style={{ border: '1px solid rgba(255,255,255,.20)' }}/>
                <span className="text-sm font-bold" style={{ color: tt.t1 }}>SIGA CEFIMAT</span>
              </div>
              <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
                style={{ background:'rgba(16,185,129,.14)', border:'1px solid rgba(16,185,129,.25)', color:'#10b981' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"/>
                Activo
              </span>
            </div>

            <div ref={qrRef} className="relative group p-4 rounded-2xl"
              style={{ background:'#ffffff', boxShadow:'0 4px 24px rgba(0,0,0,0.30)' }}>
              <QRCodeSVG value={qrValue} size={196} level="H" includeMargin={false} fgColor="#0f172a" bgColor="#ffffff"/>
            </div>

            <button onClick={() => setQrModal(true)}
              className="mt-3 flex items-center gap-2 text-xs font-bold px-3.5 py-2 rounded-xl transition-all active:scale-95"
              style={{ background: tt.softBg, border: `1px solid ${tt.cardBorder}`, color: tt.t2 }}>
              <Maximize2 size={13}/> Ampliar
            </button>

            <div className="mt-3 text-center">
              <p className="font-display text-lg font-bold tracking-tight" style={{ color: tt.t1 }}>{student.name}</p>
              <p className="text-xs mt-0.5" style={{ color: tt.t3 }}>{grp?.name} · {grp?.subject}</p>
            </div>
          </div>

          {/* Descargas */}
          <div className="card p-5 space-y-3">
            <p className="text-sm font-bold" style={{ color: tt.t1 }}>Descargar credencial</p>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={handleDownloadPNG} disabled={busy}
                className="btn-secondary justify-center text-sm py-3 disabled:opacity-50">
                <Download size={14}/> Frente (PNG)
              </button>
              <button onClick={handleExportPDF} disabled={busy}
                className="btn-primary justify-center text-sm py-3 disabled:opacity-50">
                <Printer size={14}/> Ambos (PDF)
              </button>
            </div>
            <div className="rounded-xl p-3 flex items-start gap-2.5"
              style={{ background:'rgba(251,191,36,.07)', border:'1px solid rgba(251,191,36,.22)' }}>
              <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" style={{ color:'#d97706' }}/>
              <p className="text-[11px] leading-relaxed" style={{ color: tt.t2 }}>{RESP}</p>
            </div>
          </div>
        </div>

        {/* ══ Columna derecha: credencial premium con flip ═══════ */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-bold" style={{ color: tt.t1 }}>Tu credencial</p>
              <p className="text-[11px] mt-0.5 hidden lg:block" style={{ color: tt.t4 }}>
                Pasa el cursor para ver el reverso
              </p>
            </div>
            <div className="flex items-center gap-2">
              {/* Girar (móvil y desktop) */}
              <button onClick={() => setFlipped(f => !f)}
                title="Girar credencial"
                className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl transition-all active:scale-95"
                style={{ background: tt.softBg, border: `1px solid ${tt.cardBorder}`, color: tt.t2 }}>
                <RotateCw size={13}/> Girar
              </button>
              {/* Lápiz: editar credencial */}
              <button onClick={() => setEditOpen(o => !o)}
                title="Personalizar credencial"
                className="flex items-center justify-center w-9 h-9 rounded-xl transition-all active:scale-95"
                style={{
                  background: editOpen ? tt.accent : tt.softBg,
                  border: `1px solid ${editOpen ? tt.accent : tt.cardBorder}`,
                  color: editOpen ? '#fff' : tt.t2,
                }}>
                <Pencil size={14}/>
              </button>
            </div>
          </div>

          {/* Flip card */}
          <div className="flex justify-center py-2">
            <FlipCard
              width={230} height={392}
              flipped={flipped}
              hoverFlip
              front={<FrontCard student={student} qrValue={qrValue} theme={theme} avatar={avatar}/>}
              back={<BackCard student={student} grp={grp} theme={theme} avatar={avatar} targetSchool={targetSchool}/>}
            />
          </div>
          <p className="text-center text-[10px] mt-2" style={{ color: tt.t4 }}>
            Vista previa — el PDF impreso será de mayor resolución
          </p>

          {/* Panel de personalización (se abre con el lápiz) */}
          {editOpen && (
            <div className="mt-4 pt-4 space-y-4 animate-fade-in" style={{ borderTop: `1px solid ${tt.divider}` }}>
              <div className="space-y-2">
                <p className="text-xs font-semibold" style={{ color: tt.t2 }}>Avatar</p>
                <div className="grid grid-cols-6 gap-1.5">
                  {AVATARS.map(av => (
                    <button key={av.id} onClick={() => pickAvatar(av.id)} title={av.label}
                      className="flex items-center justify-center rounded-lg py-2 transition-all active:scale-90"
                      style={{
                        background: selectedAvatar === av.id ? tt.softBg : 'transparent',
                        border: selectedAvatar === av.id ? `1.5px solid ${tt.accent}` : `1.5px solid ${tt.cardBorder}`,
                      }}>
                      <span style={{ fontSize: 19 }}>{av.emoji}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold" style={{ color: tt.t2 }}>Color de la credencial</p>
                <div className="grid grid-cols-8 gap-1.5">
                  {THEMES.map(th => (
                    <button key={th.id} onClick={() => pickTheme(th.id)} title={th.name}
                      className="relative h-8 rounded-lg transition-all active:scale-95"
                      style={{
                        background: th.swatch,
                        border: selectedTheme === th.id ? `2px solid ${tt.accent}` : '1px solid rgba(0,0,0,.15)',
                        boxShadow: selectedTheme === th.id ? `0 0 0 2px ${tt.cardBg}` : 'none',
                      }}>
                      {th.best && (
                        <span className="absolute -top-1.5 -right-1 bg-emerald-500 text-white text-[6.5px] font-bold px-1 rounded">QR✓</span>
                      )}
                    </button>
                  ))}
                </div>
                {THEMES.find(th => th.id === selectedTheme)?.best && (
                  <p className="text-[11px]" style={{ color: '#10b981' }}>
                    Este color garantiza la mejor legibilidad del QR al escanearlo.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ══ ¿Cómo funciona? (colapsable) ══ */}
      <div className="card overflow-hidden">
        <button onClick={() => setHowOpen(o => !o)}
          className="w-full px-5 py-3.5 flex items-center justify-between text-left">
          <span className="text-sm font-bold flex items-center gap-2" style={{ color: tt.t1 }}>
            <Info size={14} style={{ color: tt.t3 }}/> ¿Cómo funciona?
          </span>
          <ChevronDown size={15} className="transition-transform duration-200"
            style={{ color: tt.t3, transform: howOpen ? 'rotate(180deg)' : 'none' }}/>
        </button>
        {howOpen && (
          <div className="px-5 pb-5 space-y-3 animate-fade-in" style={{ borderTop: `1px solid ${tt.divider}` }}>
            <ol className="space-y-2.5 pt-4">
              {[
                'Personaliza tu avatar y color con el botón del lápiz.',
                'Descarga tu credencial (PDF con ambos lados) e imprímela en color.',
                'Recórtala y lamínala (enmícala) para mayor durabilidad.',
                'Porta tu gafete en todo momento durante las clases.',
                'Si no traes el gafete, muestra este QR digital al docente.',
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold mt-0.5"
                    style={{ background: tt.softBg, color: tt.t2 }}>
                    {i + 1}
                  </span>
                  <span style={{ color: tt.t2 }}>{step}</span>
                </li>
              ))}
            </ol>
            <div className="flex items-start gap-2.5 rounded-xl p-3"
              style={{ background: tt.softBg, border: `1px solid ${tt.cardBorder}` }}>
              <Shield size={13} className="flex-shrink-0 mt-0.5" style={{ color: tt.t3 }}/>
              <p className="text-[11px] leading-relaxed" style={{ color: tt.t3 }}>
                Tu código QR está vinculado únicamente a tu identidad escolar. Solo el docente tiene acceso al escáner de asistencia.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ══ Modal: QR en pantalla completa ══ */}
      {qrModal && createPortal(
        <div className="kw fixed inset-0 z-[9999] flex flex-col items-center justify-center p-6"
          style={{ background: 'rgba(0,0,0,.92)', backdropFilter: 'blur(8px)' }}
          onClick={() => setQrModal(false)}>
          <button onClick={() => setQrModal(false)} aria-label="Cerrar"
            className="absolute top-5 right-5 p-2.5 rounded-xl text-white/60 hover:text-white transition-colors"
            style={{ background: 'rgba(255,255,255,.08)' }}>
            <X size={20}/>
          </button>
          <div className="p-6 rounded-3xl bg-white animate-scale-in" onClick={e => e.stopPropagation()}>
            <QRCodeSVG value={qrValue} size={Math.min(window.innerWidth - 100, 380)} level="H" fgColor="#0f172a" bgColor="#ffffff"/>
          </div>
          <p className="font-display text-white text-xl font-bold mt-5">{student.name}</p>
          <p className="text-white/40 text-sm mt-1">{grp?.name} · Muestra este código al docente</p>
        </div>,
        document.body,
      )}
    </div>
  )
}
