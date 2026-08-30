import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Warp } from '@paper-design/shaders-react'
import { Settings2, Check } from 'lucide-react'
import {
  useGroupColors,
  GRADIENT_PALETTES,
  SOLID_PALETTES,
  MATE_PALETTES,
  SHADER_CONFIG,
} from '../../hooks/useGroupColors'
import { logoInstitucion, estiloLogo } from '../../lib/instituciones'
import { useAdminTheme } from '../../context/AdminThemeContext'

/* ── Fondo del grupo ───────────────────────────────────────────────────────
   Dos capas: el degradado CSS abajo y el shader `Warp` animado encima.

   El shader abre un contexto WebGL por tarjeta y el navegador mantiene unos 16
   vivos; con 28 grupos empezaba a matar los más antiguos («Too many active
   WebGL contexts») y la tarjeta que perdía el suyo se quedaba gris. Ponerle un
   tope tampoco valía: unas se animaban y otras no, siendo todas lo mismo.

   La salida es montarlo SÓLO en las tarjetas que están en pantalla. Nunca hay
   más de un puñado a la vista, así que ninguna se queda sin contexto y el
   comportamiento es idéntico para todas: cada una se anima cuando se la mira.
   Y como el degradado va debajo, aunque un contexto se pierda la tarjeta
   conserva su color en vez de volverse gris.

   Las manchas radiales del degradado no son un `linear-gradient` plano: el
   degradado recto se lee como una banda diagonal, mientras que las manchas
   acompañan al shader —color concentrado en unos puntos, difuminado en el
   resto— y el relevo entre uno y otro no se nota. */

/* `rootMargin` generoso: el shader arranca antes de que la tarjeta entre, así
   no se ve "encenderse" al llegar a ella. */
function useEnPantalla(ref) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const nodo = ref.current
    if (!nodo) return undefined
    if (typeof IntersectionObserver === 'undefined') { setVisible(true); return undefined }
    const obs = new IntersectionObserver(
      ([entrada]) => setVisible(entrada.isIntersecting),
      { rootMargin: '200px 0px' },
    )
    obs.observe(nodo)
    return () => obs.disconnect()
  }, [ref])
  return visible
}

function fondoDegradado(colors) {
  const [profundo, medio, sombra, claro] = colors
  return [
    `radial-gradient(ellipse 80% 65% at 12% 18%, ${claro} 0%, transparent 62%)`,
    `radial-gradient(ellipse 75% 70% at 88% 28%, ${medio} 0%, transparent 60%)`,
    `radial-gradient(ellipse 90% 80% at 70% 95%, ${sombra} 0%, transparent 66%)`,
    `linear-gradient(150deg, ${profundo} 0%, ${sombra} 55%, ${profundo} 100%)`,
  ].join(', ')
}

/* ── Picker portal — fuera del overflow:hidden de la tarjeta ── */
/* Cuantos colores se ofrecen de entrada en cada seccion. El resto llega con
   "Ver mas": treinta y dos muestras de golpe son un muro de color en el que no
   se distingue nada, y la eleccion real casi siempre esta entre las primeras.
   Si el grupo ya usa una que esta mas abajo, su seccion arranca desplegada
   para que se vea cual esta puesta. */
const VISIBLES_POR_SECCION = 3

function ColorPicker({ anchorRef, groupId, activeId, onSelect, onClose }) {
  const { isLight } = useGroupColors()
  const pickerRef = useRef(null)
  const [pos, setPos] = useState({ top:0, left:0 })
  const [expandidas, setExpandidas] = useState(() => ({
    gradient: GRADIENT_PALETTES.findIndex(p => p.id === activeId) >= VISIBLES_POR_SECCION,
    solid:    SOLID_PALETTES.findIndex(p => p.id === activeId)    >= VISIBLES_POR_SECCION,
    mate:     MATE_PALETTES.findIndex(p => p.id === activeId)     >= VISIBLES_POR_SECCION,
  }))
  const recortar = (lista, clave) =>
    expandidas[clave] ? lista : lista.slice(0, VISIBLES_POR_SECCION)
  const VerMas = ({ lista, clave }) => {
    const ocultas = lista.length - VISIBLES_POR_SECCION
    if (ocultas <= 0) return null
    return (
      <button type="button" onClick={() => setExpandidas(e => ({ ...e, [clave]: !e[clave] }))}
        className="mt-2 w-full min-h-9 rounded-lg text-[10px] font-bold transition-colors"
        style={{ background:'var(--soft-bg)', border:'1px solid var(--card-border)', color:'var(--t2)' }}>
        {expandidas[clave] ? 'Ver menos' : `Ver ${ocultas} más`}
      </button>
    )
  }

  /* Posicionar bajo el botón */
  useEffect(() => {
    if (!anchorRef.current) return
    const r = anchorRef.current.getBoundingClientRect()
    const scrollY = window.scrollY || document.documentElement.scrollTop
    setPos({
      top:  r.bottom + scrollY + 8,
      left: Math.max(8, r.right - 280),
    })
  }, [anchorRef])

  /* Cerrar al hacer clic fuera */
  useEffect(() => {
    const handler = e => {
      if (
        pickerRef.current && !pickerRef.current.contains(e.target) &&
        anchorRef.current && !anchorRef.current.contains(e.target)
      ) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [anchorRef, onClose])

  return createPortal(
    <div
      ref={pickerRef}
      style={{
        position:   'absolute',
        top:        pos.top,
        left:       pos.left,
        width:      280,
        zIndex:     9999,
        background: 'var(--panel-bg)',
        backdropFilter: 'blur(28px)',
        WebkitBackdropFilter: 'blur(28px)',
        border:     '1px solid var(--card-border)',
        borderRadius: 20,
        boxShadow:  '0 24px 64px rgba(0,0,0,.28), 0 4px 16px rgba(0,0,0,.14)',
        padding:    16,
      }}>

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-bold" style={{ color:'var(--t1)' }}>
          Apariencia del grupo
        </p>
        <button onClick={onClose}
          className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold transition-colors"
          style={{ color:'var(--t3)', background:'var(--soft-bg)' }}
          onMouseEnter={e => e.currentTarget.style.color='var(--t1)'}
          onMouseLeave={e => e.currentTarget.style.color='var(--t3)'}>
          ✕
        </button>
      </div>

      {/* ── Degradados ── */}
      <p className="text-[9px] font-bold uppercase tracking-widest mb-2"
        style={{ color:'var(--t3)' }}>
        Degradados
      </p>
      <div className="grid grid-cols-3 gap-1.5">
        {recortar(GRADIENT_PALETTES, 'gradient').map(p => (
          <button
            key={p.id}
            onClick={() => { onSelect(p.id); onClose() }}
            title={p.name}
            className="relative group flex flex-col items-center gap-1">
            {/* Swatch 2×2 */}
            <div
              className={`w-11 h-11 rounded-xl overflow-hidden transition-all duration-150 ${
                activeId === p.id
                  ? 'ring-2 ring-white ring-offset-2 ring-offset-[color:var(--card-bg)] scale-105'
                  : 'opacity-65 hover:opacity-100 hover:scale-105'
              }`}
              style={{ display:'grid', gridTemplateColumns:'1fr 1fr' }}>
              {p.colors.map((c, i) => <div key={i} style={{ background:c }} />)}
            </div>
            {activeId === p.id && (
              <span className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-white flex items-center justify-center">
                <Check size={9} className="text-black" strokeWidth={3}/>
              </span>
            )}
            <span className="text-[8px] font-medium leading-none"
              style={{ color: activeId === p.id ? 'var(--t1)' : 'var(--t3)' }}>
              {p.name}
            </span>
          </button>
        ))}
      </div>
      <VerMas lista={GRADIENT_PALETTES} clave="gradient"/>

      {/* Divider */}
      <div className="my-3 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      {/* ── Colores sólidos ── */}
      <p className="text-[9px] font-bold uppercase tracking-widest mb-2"
        style={{ color:'var(--t3)' }}>
        Colores sólidos
      </p>
      <div className="grid grid-cols-3 gap-1.5">
        {recortar(SOLID_PALETTES, 'solid').map(p => (
          <button
            key={p.id}
            onClick={() => { onSelect(p.id); onClose() }}
            title={p.name}
            className="relative group flex flex-col items-center gap-1">
            <div
              className={`w-9 h-9 rounded-full transition-all duration-150 ${
                activeId === p.id
                  ? 'ring-2 ring-white ring-offset-2 ring-offset-[color:var(--card-bg)] scale-110'
                  : 'opacity-70 hover:opacity-100 hover:scale-110'
              }`}
              style={{ background: p.accent }} />
            {activeId === p.id && (
              <span className="absolute top-0 right-0 w-3.5 h-3.5 rounded-full bg-white flex items-center justify-center">
                <Check size={8} className="text-black" strokeWidth={3.5}/>
              </span>
            )}
          </button>
        ))}
      </div>

      <VerMas lista={SOLID_PALETTES} clave="solid"/>

      {/* ── Mate ── */}
      <div className="my-3 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      <p className="text-[9px] font-bold uppercase tracking-widest mb-2"
        style={{ color:'var(--t3)' }}>
        Mate {isLight && <span style={{ color:'var(--accent)' }}>· recomendados</span>}
      </p>
      <div className="grid grid-cols-3 gap-1.5">
        {recortar(MATE_PALETTES, 'mate').map(p => (
          <button
            key={p.id}
            onClick={() => { onSelect(p.id); onClose() }}
            title={p.name}
            className="relative group flex flex-col items-center gap-1">
            <div
              className={`w-9 h-9 rounded-full transition-all duration-150 ${
                activeId === p.id
                  ? 'ring-2 ring-white ring-offset-2 ring-offset-[color:var(--card-bg)] scale-110'
                  : 'opacity-70 hover:opacity-100 hover:scale-110'
              }`}
              style={{ background: isLight ? p.light.accent : p.accent }} />
            {activeId === p.id && (
              <span className="absolute top-0 right-0 w-3.5 h-3.5 rounded-full bg-white flex items-center justify-center">
                <Check size={8} className="text-black" strokeWidth={3.5}/>
              </span>
            )}
          </button>
        ))}
      </div>

      <VerMas lista={MATE_PALETTES} clave="mate"/>

      {/* Footer hint */}
      <p className="mt-3 text-[9px] text-center" style={{ color:'var(--t4)' }}>
        El color se guarda automáticamente
      </p>
    </div>,
    document.body
  )
}

/* ── GroupShaderCard ───────────────────────────────────────── */
export default function GroupShaderCard({
  group,
  onClick,
  children,
  footer,
  showPicker = true,
  className = '',
}) {
  const { getColors, getAccent, getSurface, isLight, getPaletteId, getPalette, setGroupPalette } = useGroupColors()
  const [open, setOpen] = useState(false)
  const btnRef = useRef(null)

  const palette   = getPalette(group.id)
  const colors    = getColors(group.id)
  const accent    = getAccent(group.id)
  const surface   = getSurface(group.id)
  const activeId  = getPaletteId(group.id)
  const cardRef   = useRef(null)
  /* «Reducir movimiento» apaga el shader del todo: es un bucle a pantalla
     completa detrás de cada tarjeta, justo lo que estorba a quien lo pide. El
     degradado de debajo conserva el color, así que no se pierde nada más. */
  const { sinMovimiento } = useAdminTheme()
  const enPantalla = useEnPantalla(cardRef) && !sinMovimiento
  const letter    = group.name.split(' ')[1] ?? group.name[0]
  /* La inicial es el respaldo: si el grupo tiene institución, manda su escudo.
     Una "V" no dice nada; el escudo identifica el grupo de un vistazo. */
  const logo      = logoInstitucion(group.institucion)
  /* UNIVERSIDAD es una sola vertiente: cuando el grupo es de universidad se
     pinta el icono conjunto (UNAM + UAM + IPN) en vez del escudo suelto de la
     primera institucion de su lista, que no representaba al grupo entero. */
  const curso     = group.curso ?? (group.institucion === 'ecoems' ? 'ecoems' : group.institucion ? 'universidad' : null)
  /* Con una sola institución manda su escudo —dice a qué aspira el grupo—; con
     varias, o con ninguna, manda el emblema conjunto de Universidad. */
  const escudo = (curso === 'universidad' && (group.instituciones?.length ?? 0) !== 1)
    ? { src:'/logos/universidad-informe-transparente.png', alt:'Universidad — UNAM, UAM e IPN', compuesto:true }
    : logo

  return (
    /* Sin overflow-hidden en el root — lo ponemos solo en el shader layer */
    <div ref={cardRef} className={`relative rounded-2xl ${className}`}
      style={{
        border: `1px solid ${isLight ? surface : 'var(--card-border)'}`,
        boxShadow: 'var(--card-shadow)',
        overflow: 'visible',
        /* En claro la tarjeta se pinta ENTERA del color del grupo, igual que
           en oscuro se pinta entera con el shader. Con el color de fondo, la
           escala de texto tiene que invertirse: se redefinen las variables en
           este ámbito y todo lo anidado —cabecera, métricas, pie— las hereda
           sin tener que saber nada del tema. */
        ...(isLight ? {
          '--t1': '#ffffff',
          '--t2': 'rgba(255,255,255,.82)',
          '--t3': 'rgba(255,255,255,.62)',
          '--t4': 'rgba(255,255,255,.45)',
          '--divider': 'rgba(255,255,255,.20)',
          '--card-border': 'rgba(255,255,255,.24)',
          '--soft-bg': 'rgba(255,255,255,.12)',
          '--card-bg': 'rgba(255,255,255,.10)',
        } : {}),
      }}>

      {/* ── Fondo ───────────────────────────────────────────────
          En identidad clara no se usa el shader: sobre página blanca el velo
          negro que necesita convertía la tarjeta en un bloque oscuro.

          Tampoco se usa un tinte que degrada a blanco: eso era lo que se veía
          "transparente". El fondo es la superficie normal de tarjeta, opaca, y
          el color del grupo se afirma en una franja lateral sólida. */}
      <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
        {/* Filo de acento pegado al borde izquierdo. Antes era una barra
            suelta dentro de la cabecera, a media altura y separada del borde:
            se leía como un elemento más compitiendo con el avatar en vez de
            como el distintivo del grupo. */}
        {!isLight && (
          <div className="absolute left-0 top-0 bottom-0 w-[3px] z-10"
            style={{ background: accent }} />
        )}
        {isLight ? (
          <div className="absolute inset-0" style={{ background: surface }} />
        ) : palette.type === 'gradient' ? (
          <>
            <div className="absolute inset-0" style={{ background: fondoDegradado(colors) }} />
            {/* El shader va en su propia capa posicionada: suelto y sin
                posicionar quedaría por DEBAJO del degradado, porque un
                elemento `absolute` se pinta sobre uno estático. */}
            {enPantalla && (
              <div className="absolute inset-0">
                <Warp style={{ width:'100%', height:'100%' }} colors={colors} {...SHADER_CONFIG} />
              </div>
            )}
            {/* El velo mantiene legible el texto encima del color. */}
            <div className="absolute inset-0" style={{ background:'rgba(0,0,0,.72)' }} />
          </>
        ) : (
          /* Sólido: fondo + glow sutil del color de acento */
          <div className="absolute inset-0" style={{
            background: `linear-gradient(135deg, ${palette.bg} 0%, #08080f 100%)`,
          }}>
            <div className="absolute inset-0" style={{
              background: `radial-gradient(ellipse 70% 70% at 80% 50%, ${accent}18 0%, transparent 70%)`,
            }} />
          </div>
        )}
      </div>

      {/* ── Contenido ──────────────────────────────────────── */}
      <div className="relative z-10 flex flex-col">

        {/* Header */}
        <div
          role={onClick ? 'button' : undefined}
          tabIndex={onClick ? 0 : undefined}
          onClick={onClick}
          onKeyDown={onClick ? e => e.key === 'Enter' && onClick() : undefined}
          className={`flex items-center gap-3 sm:gap-4 p-3 sm:p-5 ${onClick ? 'cursor-pointer select-none' : ''}`}>

          {/* Avatar: escudo de la vertiente, o la inicial si no tiene.
              En universidad va el icono conjunto UNAM+UAM+IPN, que es lo que
              el grupo persigue realmente. */}
          <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center text-white font-bold text-base sm:text-lg flex-shrink-0"
            style={{
              // Con escudo no hay recuadro: se pinta en silueta blanca sobre el
              // color del grupo. El fondo blanco de antes se recortaba contra
              // la tarjeta y se veía como un parche.
              background: escudo ? 'transparent' : (isLight ? 'rgba(255,255,255,.18)' : accent),
              border: (!escudo && isLight) ? '1px solid rgba(255,255,255,.35)' : 'none',
              boxShadow: (escudo || isLight) ? 'none' : `0 0 20px ${accent}50` }}>
            {/* Un solo camino para todos los escudos: misma caja, mismo
                `object-contain`, sin escalas por institución. Antes el emblema
                de universidad salía a 34 px en unas tarjetas y a 26 en otras, y
                cada logo llevaba su propio factor (.9 el IPN, 1.16 la UAM…):
                puestas en columna, ninguna tarjeta medía igual que la de al
                lado aunque todas fueran lo mismo. */}
            {escudo
              ? <img src={escudo.src} alt={escudo.alt}
                  className="w-full h-full object-contain"
                  style={escudo.compuesto
                    /* El emblema conjunto es un montaje de tres y no admite la
                       silueta blanca: se queda con sus colores y se separa del
                       fondo con un halo. */
                    ? { filter:'drop-shadow(0 0 1px rgba(255,255,255,.95)) drop-shadow(0 0 3px rgba(255,255,255,.6))' }
                    : estiloLogo(true)}/>
              : letter}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0 overflow-hidden">{children}</div>

          {/* Controls — stopPropagation para no disparar onClick del header */}
          <div className="flex items-center gap-1.5 flex-shrink-0"
            onClick={e => e.stopPropagation()}
            onKeyDown={e => e.stopPropagation()}>

            {showPicker && (
              <button
                ref={btnRef}
                onClick={e => { e.stopPropagation(); setOpen(o => !o) }}
                aria-label="Cambiar apariencia del grupo"
                title="Cambiar apariencia"
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200"
                style={{
                  background: open ? 'var(--soft-bg)' : 'var(--soft-bg)',
                  border:     `1px solid ${open ? 'var(--card-border)' : 'var(--card-border)'}`,
                  color:      open ? 'var(--t1)' : 'var(--t2)',
                }}
                onMouseEnter={e => { e.currentTarget.style.background='var(--soft-bg)'; e.currentTarget.style.color='var(--t1)' }}
                onMouseLeave={e => { if (!open) { e.currentTarget.style.background='var(--soft-bg)'; e.currentTarget.style.color='var(--t2)' } }}>
                <Settings2 size={14} />
              </button>
            )}

          </div>
        </div>

        {footer && (
          <div className="px-3 sm:px-5 pb-3 sm:pb-5">{footer}</div>
        )}
      </div>

      {/* Picker renderizado en document.body via portal */}
      {open && (
        <ColorPicker
          anchorRef={btnRef}
          groupId={group.id}
          activeId={activeId}
          onSelect={pid => setGroupPalette(group.id, pid)}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  )
}
