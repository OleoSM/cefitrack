import { useEffect, useMemo, useState } from 'react'
import { Check, Palette, X } from 'lucide-react'
import { useStudentTheme, CARD_COLORS, esColorClaro } from '../../context/StudentThemeContext'
import { setStudentAvatar, fetchAvatares } from '../../lib/supabaseData'
import ProgressiveList from '../../components/ui/ProgressiveList'

/**
 * Selectores de avatar y de color del alumno.
 *
 * Viven aquí, y no dentro de una pantalla, porque Configuración y Mi QR
 * ofrecían lo mismo con dos interfaces distintas (una con categorías y
 * "mostrar más", otra con cinco destacados y un sello "PRO"). Ahora las dos
 * pantallas usan estas mismas piezas.
 */

const GRUPOS_COLOR = ['Institucional', 'Oscuros', 'Claros', 'Temáticos']

/** Catálogo de avatares (viene de la BD: añadir avatares es insertar filas). */
export function useAvatares() {
  const [avatares, setAvatares] = useState([])
  useEffect(() => { fetchAvatares().then(setAvatares).catch(() => {}) }, [])
  return avatares
}

/** Cabecera común de las ventanas de personalización. */
export function CabeceraModal({ titulo, onClose }) {
  return (
    <div className="flex items-center justify-between gap-3 pl-5 pr-2 py-2 sticky top-0 z-10"
      style={{ borderBottom: '1px solid var(--divider)', background: 'var(--panel-bg)' }}>
      <h2 className="text-sm font-bold" style={{ color: 'var(--t1)' }}>{titulo}</h2>
      <button type="button" onClick={onClose} aria-label="Cerrar"
        className="min-w-11 min-h-11 flex items-center justify-center rounded-xl transition-colors"
        style={{ color: 'var(--t3)' }}
        onMouseEnter={e => { e.currentTarget.style.color = 'var(--t1)' }}
        onMouseLeave={e => { e.currentTarget.style.color = 'var(--t3)' }}>
        <X size={16}/>
      </button>
    </div>
  )
}

/** Rejilla de avatares con filtro por categoría. */
export function SeccionAvatar({ student, setStudent, avatares }) {
  const [categoria, setCategoria] = useState('todas')
  const [error, setError] = useState(null)

  const categorias = useMemo(() => [...new Set(avatares.map(a => a.categoria))], [avatares])
  const visibles = useMemo(
    () => categoria === 'todas' ? avatares : avatares.filter(a => a.categoria === categoria),
    [avatares, categoria])

  /* Se pinta al instante y se guarda después: esperar a la red para mostrar la
     elección haría que el selector se sintiera lento. Tocar el que ya se tiene
     lo quita. */
  const elegir = async id => {
    const previo = student?.avatar ?? null
    const nuevo = previo === id ? null : id
    setStudent(prev => prev ? { ...prev, avatar: nuevo } : prev)
    setError(null)
    try { await setStudentAvatar(student.id, nuevo) }
    catch {
      setStudent(prev => prev ? { ...prev, avatar: previo } : prev)
      setError('No se pudo guardar tu avatar. Intenta de nuevo.')
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-xs" style={{ color: 'var(--t3)' }}>
        Aparece en tu panel y en tu credencial. Toca el que ya tienes para quitarlo.
      </p>
      {error && (
        <p role="alert" className="rounded-xl p-3 text-xs font-semibold"
          style={{ background: 'var(--bad-soft)', border: '1px solid var(--bad-line)', color: 'var(--bad)' }}>{error}</p>
      )}

      <div className="flex gap-1.5 flex-wrap">
        {[{ id: 'todas', nombre: `Todos (${avatares.length})` },
          ...categorias.map(c => ({ id: c, nombre: c }))].map(c => {
          const activo = categoria === c.id
          return (
            <button key={c.id} type="button" onClick={() => setCategoria(c.id)} aria-pressed={activo}
              className="min-h-11 px-3.5 rounded-full text-xs font-semibold transition-colors"
              style={{
                background: activo ? 'var(--accent)' : 'var(--soft-bg)',
                color: activo ? 'var(--accent-contrast)' : 'var(--t2)',
                border: `1px solid ${activo ? 'var(--accent)' : 'var(--card-border)'}`,
              }}>
              {c.nombre}
            </button>
          )
        })}
      </div>

      <ProgressiveList items={visibles}
        className="grid grid-cols-4 sm:grid-cols-6 gap-2.5"
        sizes={{ mobile: 12, tablet: 18, desktop: 24 }}
        emptyLabel="No hay avatares en esta categoría.">
        {a => {
          const activo = student?.avatar === a.id
          return (
            <button key={a.id} type="button" onClick={() => elegir(a.id)}
              title={a.nombre} aria-pressed={activo}
              className="relative flex flex-col items-center gap-1 rounded-xl p-1.5 transition-all active:scale-95"
              style={{
                background: activo ? 'var(--soft-bg)' : 'transparent',
                border: activo ? '2px solid var(--accent)' : '1px solid transparent',
              }}>
              <img src={a.src} alt={a.nombre} loading="lazy"
                className="w-full aspect-square rounded-full object-cover"/>
              <span className="text-[9px] font-semibold leading-none truncate w-full text-center"
                style={{ color: activo ? 'var(--t1)' : 'var(--t3)' }}>{a.nombre}</span>
              {activo && (
                <span className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full flex items-center justify-center"
                  style={{ background: 'var(--accent)', color: 'var(--accent-contrast)', border: '2px solid var(--panel-bg)' }}>
                  <Check size={10}/>
                </span>
              )}
            </button>
          )
        }}
      </ProgressiveList>
    </div>
  )
}

/** Paletas del catálogo + color libre con la rueda del sistema. */
export function SeccionColor() {
  const { cardColor, setCardColor, card } = useStudentTheme()
  const esPersonalizado = cardColor?.startsWith('#')
  const [colorLibre, setColorLibre] = useState(esPersonalizado ? cardColor : '#4D0B1D')
  const tarjetaClara = esColorClaro(card.grad)

  return (
    <div className="space-y-4">
      <div className="rounded-2xl p-4 kw" style={{
        background: card.grad, color: tarjetaClara ? '#0f172a' : '#ffffff',
        border: `1px solid ${tarjetaClara ? 'rgba(15,23,42,.14)' : 'rgba(255,255,255,.10)'}`,
      }}>
        <p className="text-xs" style={{ opacity: .6 }}>Vista previa</p>
        <p className="font-bold truncate">{card.label}</p>
      </div>

      {/* Color libre: `input type=color` abre la rueda del sistema, que en
          teléfono es la nativa y ya sabe usar todo el mundo. */}
      <div className="flex items-center gap-3 flex-wrap">
        <label className="min-h-11 flex items-center gap-2 px-3 rounded-xl text-xs font-bold cursor-pointer"
          style={{ background: 'var(--soft-bg)', border: '1px solid var(--card-border)', color: 'var(--t2)' }}>
          <Palette size={14}/>
          Elegir cualquier color
          <input type="color" value={colorLibre}
            onChange={e => { setColorLibre(e.target.value); setCardColor(e.target.value) }}
            className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent p-0"/>
        </label>
        {esPersonalizado && (
          <span className="text-xs font-mono px-2.5 py-1.5 rounded-lg"
            style={{ background: 'var(--soft-bg)', color: 'var(--t2)' }}>{cardColor}</span>
        )}
      </div>

      {GRUPOS_COLOR.map(grupo => {
        const items = CARD_COLORS.filter(c => c.grupo === grupo)
        if (items.length === 0) return null
        return (
          <div key={grupo}>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-2"
              style={{ color: 'var(--t3)' }}>{grupo}</p>
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2.5">
              {items.map(c => {
                const active = cardColor === c.id
                return (
                  <button key={c.id} type="button" onClick={() => setCardColor(c.id)} aria-pressed={active}
                    className="flex flex-col items-center gap-1.5 rounded-xl p-2 transition-all active:scale-95"
                    style={{
                      background: active ? 'var(--soft-bg)' : 'transparent',
                      border: `1.5px solid ${active ? 'var(--accent)' : 'var(--card-border)'}`,
                    }}>
                    <div className="w-full h-9 rounded-lg relative overflow-hidden" style={{ background: c.grad }}>
                      {active && (
                        <span className="absolute inset-0 flex items-center justify-center">
                          {/* Palomita legible sobre el propio color de la muestra. */}
                          <Check size={14} style={{ color: esColorClaro(c.grad) ? '#0f172a' : '#ffffff' }}/>
                        </span>
                      )}
                    </div>
                    <span className="text-[9.5px] font-semibold leading-none text-center"
                      style={{ color: 'var(--t3)' }}>{c.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
