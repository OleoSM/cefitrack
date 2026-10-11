import { BotonAyuda } from '../../components/ui/Ayuda'
import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { QRCodeSVG } from 'qrcode.react'
import { logoInstitucion, tipoDesdeNombre } from '../../lib/instituciones'
import { useStudentData } from '../../hooks/useStudentData'
import { Download, Shield, Info, AlertTriangle, Pencil, Maximize2, RotateCw, X, ChevronDown, Check } from 'lucide-react'
import FlipCard from '../../components/ui/FlipCard'
import ModalPortal from '../../components/ui/ModalPortal'
import { useStudentTheme } from '../../context/StudentThemeContext'
import { CARD_COLORS, esColorClaro } from '../../context/StudentThemeContext'
import { jsPDF } from 'jspdf'
import { useSucursales } from '../../hooks/useSucursales'
import { estadoPerfil } from './EstadoPagina'
import { CabeceraModal, SeccionAvatar, SeccionColor, useAvatares } from './Personalizar'

const QR_PREFIX = 'EDUTRACK:'
const FONT = "'Plus Jakarta Sans', Manrope, system-ui, -apple-system, sans-serif"
const CW = 600, CH = 950   // canvas dimensions (portrait)
const cycleStart = new Date().getMonth() >= 7 ? new Date().getFullYear() : new Date().getFullYear() - 1
const SCHOOL_CYCLE = `${cycleStart} – ${cycleStart + 1}`
const studentFolio = id => `CEF-${String(id ?? '').replace(/-/g,'').slice(-8).toUpperCase().padStart(8,'0')}`

/* ════════════════════════════════════════════════════════════════
   TEMA DE LA CREDENCIAL — derivado del color que eligió el alumno
════════════════════════════════════════════════════════════════ */
const credentialTheme = color => {
  const hexes = color.grad.match(/#[0-9a-f]{6}/gi) ?? []
  const primary = hexes[0] ?? '#12345A'
  const accent = hexes[1] ?? primary
  const light = esColorClaro(primary)
  const headerText = light ? '#0f172a' : '#ffffff'
  // El color elegido identifica cabecera y acentos. Los tonos oscuros no se
  // propagan al cuerpo completo: así la credencial no se convierte en una
  // mancha azul/guinda y el QR conserva suficiente aire visual.
  const bodyBg = light ? primary : '#ffffff'
  const bodyText = '#0f172a'
  const bodySub = '#475569'
  return {
    id: color.id, name: color.label, swatch: color.grad, best: color.grupo === 'Institucional',
    cardBg:bodyBg, headerBg:primary, headerText,
    headerSub:light ? 'rgba(15,23,42,.62)' : 'rgba(255,255,255,.65)',
    accent, nameColor:bodyText, subColor:bodySub, yearColor:bodySub,
    footerBg:light ? primary : '#f8fafc', footerText:bodySub,
    labelColor:bodyText, valueColor:bodyText,
  }
}

const CREDENTIAL_THEMES = CARD_COLORS.map(credentialTheme)

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

function securityPattern(ctx, color) {
  ctx.save()
  ctx.globalAlpha = .045
  ctx.strokeStyle = color
  ctx.lineWidth = 1
  for (let x = -CH; x < CW + CH; x += 34) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + CH, CH); ctx.stroke()
  }
  ctx.globalAlpha = .03
  ctx.fillStyle = color
  ctx.font = `bold 72px ${FONT}`
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  for (let y = 230; y < CH; y += 190) ctx.fillText('CEFIMAT', CW / 2, y)
  ctx.restore()
}

async function drawAvatar(ctx, src, x, y, size, fallback = 'AL') {
  ctx.save()
  ctx.beginPath(); ctx.arc(x, y, size / 2, 0, Math.PI * 2); ctx.clip()
  ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(x-size/2, y-size/2, size, size)
  if (src) {
    await new Promise(resolve => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => { ctx.drawImage(img, x-size/2, y-size/2, size, size); resolve() }
      img.onerror = resolve
      img.src = src
    })
  } else {
    ctx.fillStyle = '#ffffff'; ctx.font = `bold ${Math.round(size*.32)}px ${FONT}`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(fallback, x, y)
  }
  ctx.restore()
}

/* ════════════════════════════════════════════════════════════════
   FRONT CANVAS
════════════════════════════════════════════════════════════════ */
async function buildFront(student, grp, svgString, theme, avatarSrc, branchName) {
  await document.fonts.ready
  const canvas = document.createElement('canvas')
  canvas.width = CW; canvas.height = CH
  const ctx = canvas.getContext('2d')

  // Card bg
  ctx.fillStyle = theme.cardBg
  ctx.fillRect(0, 0, CW, CH)
  securityPattern(ctx, theme.accent)

  // ── Header (0 → 155) ───────────────────────────────────────
  ctx.fillStyle = theme.headerBg
  ctx.fillRect(0, 0, CW, 155)

  await drawAvatar(ctx, avatarSrc, CW / 2, 35, 54, student.name.split(' ').slice(0,2).map(n=>n[0]).join(''))

  // Bloque institucional centrado
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = theme.headerText
  ctx.font = `800 18px ${FONT}`
  ctx.fillText('CEFIMAT', CW / 2, 78)
  ctx.fillStyle = theme.headerSub
  ctx.font = `500 10px ${FONT}`
  ctx.fillText('Centro de Física y Matemáticas', CW / 2, 96)
  ctx.save(); ctx.globalAlpha = 0.14; ctx.fillStyle = theme.headerText
  rRect(ctx, CW / 2 - 48, 106, 96, 27, 14); ctx.fill()
  ctx.globalAlpha = 0.24; ctx.strokeStyle = theme.headerText; ctx.lineWidth = 1
  rRect(ctx, CW / 2 - 48, 106, 96, 27, 14); ctx.stroke()
  ctx.restore()
  ctx.fillStyle = theme.headerText
  ctx.font = `800 8px ${FONT}`
  ctx.fillText('ESTUDIANTE', CW / 2, 124)

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
  ctx.fillStyle = `${theme.nameColor}1a`
  rRect(ctx, CW / 2 - 72, pillY, 144, 38, 19); ctx.fill()
  ctx.strokeStyle = `${theme.nameColor}45`; ctx.lineWidth = 1
  rRect(ctx, CW / 2 - 72, pillY, 144, 38, 19); ctx.stroke()
  ctx.fillStyle = theme.nameColor
  ctx.font = `bold 15px ${FONT}`
  ctx.fillText(SCHOOL_CYCLE, CW / 2, pillY + 19)

  const campusLine = [branchName, grp?.name].filter(Boolean).join(' · ')
  if (campusLine) {
    ctx.fillStyle = theme.subColor
    ctx.font = `600 10.5px ${FONT}`
    ctx.fillText(campusLine.toUpperCase(), CW / 2, pillY + 58)
  }

  // ── Footer (828 → CH) ──────────────────────────────────────
  const ftY = CH - 122
  ctx.fillStyle = theme.footerBg
  ctx.fillRect(0, ftY, CW, CH - ftY)
  ctx.fillStyle = `${theme.accent}35`; ctx.fillRect(0, ftY, CW, 1)

  ctx.fillStyle = theme.footerText
  ctx.font = `400 11px ${FONT}`
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'
  wrapText(ctx, RESP, CW / 2, ftY + 30, CW - 64, 18)
  ctx.fillStyle = theme.labelColor
  ctx.font = `700 9px ${FONT}`
  ctx.fillText(studentFolio(student.id), CW / 2, CH - 14)

  return canvas
}

/* ════════════════════════════════════════════════════════════════
   BACK CANVAS
════════════════════════════════════════════════════════════════ */
async function buildBack(student, grp, theme, avatarSrc, targetSchool, branchName) {
  await document.fonts.ready
  const canvas = document.createElement('canvas')
  canvas.width = CW; canvas.height = CH
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = theme.cardBg
  ctx.fillRect(0, 0, CW, CH)
  securityPattern(ctx, theme.accent)

  // ── Header homologado con el frente (0 → 155) ──────────────
  ctx.fillStyle = theme.headerBg
  ctx.fillRect(0, 0, CW, 155)
  ctx.fillStyle = theme.accent; ctx.fillRect(0, 151, CW, 4)

  await drawAvatar(ctx, avatarSrc, CW / 2, 35, 54, student.name.split(' ').slice(0,2).map(n=>n[0]).join(''))
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = theme.headerText
  ctx.font = `800 18px ${FONT}`
  ctx.fillText('CEFIMAT', CW / 2, 78)
  ctx.fillStyle = theme.headerSub
  ctx.font = `500 10px ${FONT}`
  ctx.fillText('Centro de Física y Matemáticas', CW / 2, 96)
  ctx.save(); ctx.globalAlpha = 0.14; ctx.fillStyle = theme.headerText
  rRect(ctx, CW / 2 - 48, 106, 96, 27, 14); ctx.fill()
  ctx.globalAlpha = 0.24; ctx.strokeStyle = theme.headerText; ctx.lineWidth = 1
  rRect(ctx, CW / 2 - 48, 106, 96, 27, 14); ctx.stroke()
  ctx.restore()
  ctx.fillStyle = theme.headerText
  ctx.font = `800 8px ${FONT}`
  ctx.fillText('ESTUDIANTE', CW / 2, 124)

  // ── Info fields (125 → 800) ────────────────────────────────
  const fields = [
    ['SEDE · GRUPO',     [branchName, grp?.name].filter(Boolean).join(' · ') || '—'],
    ['TUTOR A CARGO',   student.tutor?.name ?? '—'],
    ['INSTITUCIÓN',      targetSchool?.nombre ?? '—'],
    ['TELÉFONO TUTOR',  student.tutor?.phone ?? '—'],
  ]

  const iX = 48, stepH = 138
  let fy = 170

  fields.forEach(([label, value]) => {
    // Field bg card
    ctx.fillStyle = `${theme.valueColor}0d`
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
  ctx.fillStyle = theme.labelColor
  ctx.font = `bold 16px ${FONT}`
  ctx.fillText('⚠', CW / 2, ftY + 30)

  ctx.fillStyle = theme.footerText
  ctx.font = `400 11px ${FONT}`
  wrapText(ctx, RESP, CW / 2, ftY + 50, CW - 64, 18)

  // Print tip
  ctx.fillStyle = theme.labelColor
  ctx.font = `500 9.5px ${FONT}`
  ctx.fillText('Imprimir · Recortar · Enmicar', CW / 2, CH - 34)
  ctx.font = `700 9px ${FONT}`
  ctx.fillText(studentFolio(student.id), CW / 2, CH - 17)

  return canvas
}

/* ════════════════════════════════════════════════════════════════
   PREVIEW COMPONENTS (HTML — for real-time interaction)
════════════════════════════════════════════════════════════════ */
function FrontCard({ student, grp, branchName, qrValue, theme, avatar }) {
  return (
    <div style={{ width:230, height:392, display:'flex', flexDirection:'column', backgroundColor: theme.cardBg, backgroundImage:`repeating-linear-gradient(45deg, transparent 0 18px, ${theme.accent}08 18px 19px)`, borderRadius: 14, overflow: 'hidden', boxShadow: '0 18px 48px rgba(0,0,0,0.32), 0 2px 8px rgba(0,0,0,0.18)', flexShrink: 0, border: `1px solid rgba(0,0,0,0.06)`, fontFamily: FONT }}>
      {/* Header */}
      <div style={{ height:76, boxSizing:'border-box', background:theme.headerBg, padding:'6px 10px', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
        {avatar?.src
          ? <img src={avatar.src} alt={avatar.nombre} style={{ width:30, height:30, borderRadius:'50%', objectFit:'cover', flexShrink:0 }}/>
          : <div style={{ width:30, height:30, borderRadius:'50%', background:'rgba(255,255,255,.18)', flexShrink:0 }}/>
        }
        <p style={{ color:theme.headerText, fontWeight:800, fontSize:11, margin:'2px 0 0', lineHeight:1 }}>CEFIMAT</p>
        <p style={{ color:theme.headerSub, fontSize:6.5, margin:'2px 0 0', lineHeight:1 }}>Centro de Física y Matemáticas</p>
        <span style={{ color:theme.headerText, background:`${theme.headerText}24`, border:`1px solid ${theme.headerText}38`, borderRadius:999, padding:'2px 6px', marginTop:3, fontSize:5.5, lineHeight:1, fontWeight:800, letterSpacing:'.08em' }}>ESTUDIANTE</span>
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
        <span style={{ background: `${theme.nameColor}1a`, border: `1px solid ${theme.nameColor}42`, color: theme.nameColor, fontSize: 10, fontWeight: 700, padding: '3px 11px', borderRadius: 12 }}>
          {SCHOOL_CYCLE}
        </span>
      </div>
      {(branchName || grp?.name) && <p style={{ color:theme.subColor, fontSize:7, textAlign:'center', fontWeight:700, margin:'-5px 8px 8px', letterSpacing:'.04em' }}>{[branchName, grp?.name].filter(Boolean).join(' · ').toUpperCase()}</p>}
      {/* Footer */}
      <div style={{ background: theme.footerBg, padding: '7px 11px', borderTop: `1px solid ${theme.accent}28`, marginTop:'auto' }}>
        <p style={{ color: theme.footerText, fontSize: 6.8, textAlign: 'center', lineHeight: 1.55, margin: 0 }}>{RESP}</p>
        <p style={{ color:theme.labelColor, fontSize:6.5, textAlign:'center', fontWeight:800, letterSpacing:'.1em', margin:'4px 0 0' }}>{studentFolio(student.id)}</p>
      </div>
    </div>
  )
}

function BackCard({ student, grp, branchName, theme, avatar, targetSchool }) {
  const fields = [
    ['SEDE · GRUPO',     [branchName, grp?.name].filter(Boolean).join(' · ') || '—'],
    ['TUTOR A CARGO',   student.tutor?.name ?? '—'],
    ['INSTITUCIÓN',      targetSchool?.nombre ?? '—'],
    ['TELÉFONO TUTOR',  student.tutor?.phone ?? '—'],
  ]
  return (
    <div style={{ width:230, height:392, display:'flex', flexDirection:'column', backgroundColor: theme.cardBg, backgroundImage:`repeating-linear-gradient(45deg, transparent 0 18px, ${theme.accent}08 18px 19px)`, borderRadius: 14, overflow: 'hidden', boxShadow: '0 18px 48px rgba(0,0,0,0.32), 0 2px 8px rgba(0,0,0,0.18)', flexShrink: 0, border: `1px solid rgba(0,0,0,0.06)`, fontFamily: FONT }}>
      {/* Header */}
      <div style={{ height:76, boxSizing:'border-box', background:theme.headerBg, padding:'6px 10px', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
        {avatar?.src
          ? <img src={avatar.src} alt={avatar.nombre} style={{ width:30, height:30, borderRadius:'50%', objectFit:'cover', flexShrink:0 }}/>
          : <div style={{ width:30, height:30, borderRadius:'50%', background:'rgba(255,255,255,.18)', flexShrink:0 }}/>
        }
        <p style={{ color:theme.headerText, fontWeight:800, fontSize:11, margin:'2px 0 0', lineHeight:1 }}>CEFIMAT</p>
        <p style={{ color:theme.headerSub, fontSize:6.5, margin:'2px 0 0', lineHeight:1 }}>Centro de Física y Matemáticas</p>
        <span style={{ color:theme.headerText, background:`${theme.headerText}24`, border:`1px solid ${theme.headerText}38`, borderRadius:999, padding:'2px 6px', marginTop:3, fontSize:5.5, lineHeight:1, fontWeight:800, letterSpacing:'.08em' }}>ESTUDIANTE</span>
      </div>
      <div style={{ height: 3, background: theme.accent }}/>
      {/* Info fields */}
      <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 6, background: theme.cardBg }}>
        {fields.map(([label, value]) => {
          const logo = label === 'INSTITUCIÓN'
            ? logoInstitucion(targetSchool?.tipo ?? tipoDesdeNombre(targetSchool?.nombre))
            : null
          return (
            <div key={label} style={{ paddingBottom: 6, borderBottom: `1px dashed ${theme.accent}28` }}>
              <p style={{ color: theme.labelColor, fontSize: 7.5, fontWeight: 700, margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</p>
              <div style={{ display:'flex', alignItems:'center', gap: 6, marginTop: 2 }}>
                {logo && (
                  <img src={logo.src} alt={logo.alt} crossOrigin="anonymous"
                    style={{ height: 18, width: 'auto', objectFit:'contain', flexShrink: 0 }}/>
                )}
                <p style={{ color: theme.valueColor, fontSize: 12.5, fontWeight: 600, margin: 0, lineHeight: 1.2 }}>{value}</p>
              </div>
            </div>
          )
        })}
      </div>
      {/* Footer */}
      <div style={{ background: theme.footerBg, padding: '7px 11px', borderTop: `1px solid ${theme.accent}28`, marginTop:'auto' }}>
        <p style={{ color: theme.labelColor, fontSize: 8.5, textAlign: 'center', fontWeight: 700, margin: '0 0 3px' }}>⚠</p>
        <p style={{ color: theme.footerText, fontSize: 6.8, textAlign: 'center', lineHeight: 1.55, margin: 0 }}>{RESP}</p>
        <p style={{ color:theme.labelColor, fontSize:6.5, textAlign:'center', fontWeight:800, letterSpacing:'.1em', margin:'4px 0 0' }}>{studentFolio(student.id)}</p>
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════════════════════════════ */
export default function MyQR() {
  const { t: tt, cardColor, card } = useStudentTheme()
  const { student, group: grp, setStudent, loading, error } = useStudentData()
  const { nombreDe } = useSucursales()
  const branchId = grp?.sucursal ?? student?.sucursal
  const branchName = branchId ? nombreDe(branchId) : ''
  const institution = String(grp?.institucion ?? '').trim()
  const targetSchool = institution
    ? { nombre:institution.toUpperCase(), tipo:tipoDesdeNombre(institution) }
    : null
  const qrRef   = useRef(null)

  const [busy, setBusy] = useState(false)
  const [flipped, setFlipped] = useState(false)      // reverso visible
  const [editOpen, setEditOpen] = useState(false)    // panel de personalización (lápiz)
  const [qrModal, setQrModal] = useState(false)      // QR ampliado en pantalla completa
  const [howOpen, setHowOpen] = useState(false)      // instrucciones colapsables

  const avatares = useAvatares()

  const estado = estadoPerfil({ loading, student, error })
  if (estado) return estado

  const avatar    = avatares.find(a => a.id === student.avatar) ?? null
  // Un color libre (hex de la rueda) también vale para la credencial.
  const theme     = CREDENTIAL_THEMES.find(t => t.id === cardColor) ?? credentialTheme(card)
  const qrValue   = `${QR_PREFIX}${student.id}`

  const getSvg = () => {
    const svg = qrRef.current?.querySelector('svg')
    return svg ? new XMLSerializer().serializeToString(svg) : null
  }

  const handleDownloadPNG = async () => {
    const svgStr = getSvg(); if (!svgStr || busy) return
    setBusy(true)
    const canvas = await buildFront(student, grp, svgStr, theme, avatar?.src, branchName)
    const link = document.createElement('a')
    link.download = `Credencial_Frente_${student.name.replace(/\s+/g,'_')}.png`
    link.href = canvas.toDataURL('image/png', 1.0); link.click()
    setBusy(false)
  }

  const handleExportPDF = async () => {
    const svgStr = getSvg(); if (!svgStr || busy) return
    setBusy(true)
    const [frontCanvas, backCanvas] = await Promise.all([
      buildFront(student, grp, svgStr, theme, avatar?.src, branchName),
      buildBack(student, grp, theme, avatar?.src, targetSchool, branchName),
    ])
    const fUrl = frontCanvas.toDataURL('image/png', 1.0)
    const bUrl = backCanvas.toDataURL('image/png', 1.0)

    const cardW = 54, cardH = 85.6
    const pdf = new jsPDF({ orientation:'portrait', unit:'mm', format:[cardW, cardH], compress:true })
    pdf.setProperties({ title:`Gafete CEFIMAT — ${student.name}`, subject:'Credencial estudiantil CR80' })
    pdf.addImage(fUrl, 'PNG', 0, 0, cardW, cardH, undefined, 'FAST')
    pdf.addPage([cardW, cardH], 'portrait')
    pdf.addImage(bUrl, 'PNG', 0, 0, cardW, cardH, undefined, 'FAST')
    pdf.save(`Gafete_CEFIMAT_${student.name.replace(/\s+/g,'_')}.pdf`)
    setBusy(false)
  }

  /* ── UI ─────────────────────────────────────────────────────── */
  return (
    <div className="w-full space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="page-title">Mi Código QR</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--t3)' }}>
            Muestra este código al docente para registrar tu asistencia.
          </p>
        </div>
        <BotonAyuda titulo="Mi código QR">
          <p>Este código es tu identificación para el pase de lista. Al llegar a clase, muéstralo en la pantalla y tu docente lo escanea.</p>
          <p><b>Consejos:</b> sube el brillo de tu teléfono y usa "Ampliar" para que se lea más rápido.</p>
          <p>También puedes descargar tu credencial para tenerla aunque no tengas internet.</p>
          <p><b>No compartas tu código:</b> quien lo tenga podría registrar asistencia en tu nombre.</p>
        </BotonAyuda>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">

        {/* ══ Columna izquierda: QR en vivo + descargas ══════════ */}
        <div className="space-y-4">
          <div className="card p-5 flex flex-col items-center">
            <div className="w-full flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <img src="/logo.jpeg" alt="" className="w-7 h-7 rounded-full object-cover"
                  style={{ border: '1px solid var(--card-border)' }}/>
                <span className="text-sm font-bold" style={{ color: tt.t1 }}>SIGA CEFIMAT</span>
              </div>
              <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
                style={{ background:'var(--good-soft)', border:'1px solid var(--good-line)', color:'var(--good)' }}>
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background:'var(--good)' }}/>
                Activo
              </span>
            </div>

            <div ref={qrRef} className="relative group p-4 rounded-2xl"
              style={{ background:'#ffffff', boxShadow:'0 4px 24px rgba(0,0,0,0.30)' }}>
              <QRCodeSVG value={qrValue} size={196} level="H" includeMargin={false} fgColor="#0f172a" bgColor="#ffffff"/>
            </div>

            <button onClick={() => setQrModal(true)}
              className="mt-3 min-h-11 flex items-center gap-2 text-xs font-bold px-4 rounded-xl transition-all active:scale-95"
              style={{ background: 'var(--soft-bg)', border: '1px solid var(--card-border)', color: 'var(--t2)' }}>
              <Maximize2 size={13}/> Ampliar
            </button>

            <div className="mt-3 text-center">
              <p className="font-display text-lg font-bold tracking-tight" style={{ color: tt.t1 }}>{student.name}</p>
              <p className="text-xs mt-0.5" style={{ color: tt.t3 }}>{grp?.name} · {grp?.subject}</p>
            </div>
          </div>

          {/* Descargas */}
          <div className="card p-5 space-y-3">
            <h2 className="section-title">Descargar credencial</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button onClick={handleExportPDF} disabled={busy}
                className="btn-primary justify-center text-sm py-3 disabled:opacity-50">
                <Download size={14}/> Descargar gafete PDF
              </button>
              <button onClick={handleDownloadPNG} disabled={busy}
                className="btn-secondary justify-center text-sm py-3 disabled:opacity-50">
                <Download size={14}/> Solo frente PNG
              </button>
            </div>
            <div className="rounded-xl p-3 flex items-start gap-2.5"
              style={{ background:'var(--warn-soft)', border:'1px solid var(--warn-line)' }}>
              <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" style={{ color:'var(--warn)' }}/>
              <p className="text-[11px] leading-relaxed" style={{ color: tt.t2 }}>{RESP}</p>
            </div>
          </div>
        </div>

        {/* ══ Columna derecha: credencial premium con flip ═══════ */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="section-title">Tu credencial</h2>
              <p className="text-[11px] mt-0.5 hidden lg:block" style={{ color: tt.t4 }}>
                Pasa el cursor para ver el reverso
              </p>
            </div>
            <div className="flex items-center gap-2">
              {/* Girar (móvil y desktop) */}
              <button onClick={() => setFlipped(f => !f)}
                title="Girar credencial"
                className="min-h-11 flex items-center gap-1.5 text-xs font-bold px-3 rounded-xl transition-all active:scale-95"
                style={{ background: 'var(--soft-bg)', border: '1px solid var(--card-border)', color: 'var(--t2)' }}>
                <RotateCw size={13}/> Girar
              </button>
              {/* Lápiz: editar credencial */}
              <button onClick={() => setEditOpen(o => !o)}
                title="Personalizar credencial" aria-label="Personalizar credencial"
                className="flex items-center justify-center w-11 h-11 rounded-xl transition-all active:scale-95"
                style={{
                  background: editOpen ? 'var(--accent)' : 'var(--soft-bg)',
                  border: `1px solid ${editOpen ? 'var(--accent)' : 'var(--card-border)'}`,
                  color: editOpen ? 'var(--accent-contrast)' : 'var(--t2)',
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
              front={<FrontCard student={student} grp={grp} branchName={branchName} qrValue={qrValue} theme={theme} avatar={avatar}/>}
              back={<BackCard student={student} grp={grp} branchName={branchName} theme={theme} avatar={avatar} targetSchool={targetSchool}/>}
            />
          </div>
          <p className="text-center text-[10px] mt-2" style={{ color: tt.t4 }}>
            Vista previa — PDF premium CR80 de 54 × 85.6 mm
          </p>

        </div>
      </div>

      {editOpen && (
        <ModalPortal onClose={() => setEditOpen(false)} maxWidth="max-w-2xl" scrollable>
          <CabeceraModal titulo="Personaliza tu gafete" onClose={() => setEditOpen(false)}/>
          <div className="p-4 sm:p-5 space-y-6">
            <section className="space-y-3">
              <h3 className="section-title">Avatar</h3>
              <SeccionAvatar student={student} setStudent={setStudent} avatares={avatares}/>
            </section>
            <section className="space-y-3 pt-5" style={{ borderTop:'1px solid var(--divider)' }}>
              <h3 className="section-title">Color</h3>
              <SeccionColor/>
            </section>
            <button type="button" onClick={() => setEditOpen(false)} className="btn-primary w-full justify-center min-h-11">
              <Check size={15}/> Usar este diseño
            </button>
          </div>
        </ModalPortal>
      )}

      {/* ══ ¿Cómo funciona? (colapsable) ══ */}
      <div className="card overflow-hidden">
        <button onClick={() => setHowOpen(o => !o)}
          className="w-full min-h-11 px-4 sm:px-5 py-3.5 flex items-center justify-between text-left" aria-expanded={howOpen}>
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
            className="absolute top-5 right-5 min-w-11 min-h-11 flex items-center justify-center rounded-xl text-white/60 hover:text-white transition-colors"
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
