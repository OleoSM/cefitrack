import { useState, useEffect, useMemo } from 'react'
import { Brush, Check, Sparkles, UserRound, Palette, X } from 'lucide-react'
import { useStudentTheme, CARD_COLORS, esColorClaro } from '../../context/StudentThemeContext'
import AppearancePicker from '../../components/ui/AppearancePicker'
import { useStudentData } from '../../hooks/useStudentData'
import { setStudentAvatar, fetchAvatares } from '../../lib/supabaseData'
import ProgressiveList from '../../components/ui/ProgressiveList'
import ModalPortal from '../../components/ui/ModalPortal'

const GRUPOS_COLOR = ['Institucional', 'Oscuros', 'Claros', 'Temáticos']

/* Cabecera común de las dos ventanas. */
function CabeceraModal({ titulo, onClose }) {
  return (
    <div className="flex items-center justify-between px-5 py-4 sticky top-0 z-10"
      style={{ borderBottom: '1px solid var(--divider)', background: 'var(--panel-bg)' }}>
      <h2 className="text-sm font-bold" style={{ color: 'var(--t1)' }}>{titulo}</h2>
      <button onClick={onClose} className="p-1.5 rounded-lg transition-colors"
        style={{ color: 'var(--t3)' }}
        onMouseEnter={e => e.currentTarget.style.color = 'var(--t1)'}
        onMouseLeave={e => e.currentTarget.style.color = 'var(--t3)'}>
        <X size={16}/>
      </button>
    </div>
  )
}

export default function StudentSettings() {
  const { appearance, setAppearance, cardColor, setCardColor, t, card } = useStudentTheme()
  const { student: s, group: grp, setStudent } = useStudentData()

  /* Las dos rejillas ocupaban la pantalla entera y había que recorrerlas para
     llegar a cualquier otro ajuste. Viven en su propia ventana: aquí queda lo
     que el alumno tiene puesto y el botón para cambiarlo. */
  const [modal, setModal] = useState(null)   // 'avatar' | 'color' | null

  /* ── Color ── */
  const esPersonalizado = cardColor?.startsWith('#')
  const [colorLibre, setColorLibre] = useState(esPersonalizado ? cardColor : '#4D0B1D')
  const tarjetaClara = esColorClaro(card.grad)
  const tinta = tarjetaClara ? '#0f172a' : '#ffffff'

  /* ── Avatar. El catálogo viene de la BD: añadir avatares es insertar filas,
     sin tocar esta pantalla ni volver a desplegar. ── */
  const [avatares, setAvatares] = useState([])
  const [categoria, setCategoria] = useState('todas')
  const [errorAvatar, setErrorAvatar] = useState(null)
  useEffect(() => { fetchAvatares().then(setAvatares).catch(() => {}) }, [])

  const categorias = useMemo(() => [...new Set(avatares.map(a => a.categoria))], [avatares])
  const visibles = useMemo(
    () => categoria === 'todas' ? avatares : avatares.filter(a => a.categoria === categoria),
    [avatares, categoria])
  const avatarActual = avatares.find(a => a.id === s?.avatar) ?? null

  /* Se pinta al instante y se guarda después: esperar a la red para mostrar la
     elección haría que el selector se sintiera lento. */
  const elegirAvatar = async id => {
    const previo = s?.avatar ?? null
    const nuevo = previo === id ? null : id
    setStudent(prev => prev ? { ...prev, avatar: nuevo } : prev)
    setErrorAvatar(null)
    try { await setStudentAvatar(s.id, nuevo) }
    catch {
      setStudent(prev => prev ? { ...prev, avatar: previo } : prev)
      setErrorAvatar('No se pudo guardar tu avatar. Intenta de nuevo.')
    }
  }

  const iniciales = s?.name.split(' ').slice(0, 2).map(n => n[0]).join('') ?? 'AL'

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Configuración</h1>
        <p className="text-sm mt-1" style={{ color: t.t3 }}>
          Personaliza la apariencia de tu portal.
        </p>
      </div>

      <AppearancePicker appearance={appearance} setAppearance={setAppearance} t={t} title="Apariencia" />

      {/* ── Resumen: qué tengo puesto y cómo cambiarlo ────────── */}
      <div className="card p-5 space-y-4">
        <h2 className="section-title flex items-center gap-2"><Brush size={15}/> Tu presentación</h2>

        {/* Vista previa: la tinta se decide por la luminancia del fondo, así que
            un color claro no deja el nombre en blanco sobre blanco. */}
        <div className="rounded-2xl p-5 kw" style={{
          background: card.grad,
          color: tinta,
          border: `1px solid ${tarjetaClara ? 'rgba(15,23,42,.14)' : 'rgba(255,255,255,.10)'}`,
        }}>
          <div className="flex items-center gap-3.5">
            {avatarActual ? (
              <img src={avatarActual.src} alt=""
                className="w-12 h-12 rounded-2xl object-cover flex-shrink-0"/>
            ) : (
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-base font-bold flex-shrink-0"
                style={{ background: tarjetaClara ? 'rgba(15,23,42,.10)' : 'rgba(255,255,255,.15)' }}>
                {iniciales}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-xs" style={{ opacity:.55 }}>Vista previa</p>
              <p className="font-bold truncate">{s?.name ?? 'Alumno'}</p>
              <p className="text-xs truncate" style={{ opacity:.45 }}>{grp?.name} — {grp?.subject}</p>
            </div>
            <Sparkles size={16} className="ml-auto flex-shrink-0" style={{ opacity:.35 }}/>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <button onClick={() => setModal('avatar')}
            className="flex items-center gap-3 p-3 rounded-xl transition-colors text-left active:scale-[.99]"
            style={{ background: t.softBg, border: `1px solid ${t.cardBorder}` }}>
            {avatarActual
              ? <img src={avatarActual.src} alt="" className="w-9 h-9 rounded-full flex-shrink-0"/>
              : <span className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: t.cardBorder, color: t.t2 }}><UserRound size={16}/></span>}
            <span className="min-w-0">
              <span className="block text-xs font-bold" style={{ color: t.t1 }}>Personalizar avatar</span>
              <span className="block text-[11px] truncate" style={{ color: t.t3 }}>
                {avatarActual ? avatarActual.nombre : 'Sin avatar · usas tus iniciales'}
              </span>
            </span>
          </button>

          <button onClick={() => setModal('color')}
            className="flex items-center gap-3 p-3 rounded-xl transition-colors text-left active:scale-[.99]"
            style={{ background: t.softBg, border: `1px solid ${t.cardBorder}` }}>
            <span className="w-9 h-9 rounded-full flex-shrink-0"
              style={{ background: card.grad, border: `1px solid ${t.cardBorder}` }}/>
            <span className="min-w-0">
              <span className="block text-xs font-bold" style={{ color: t.t1 }}>Personalizar color</span>
              <span className="block text-[11px] truncate" style={{ color: t.t3 }}>{card.label}</span>
            </span>
          </button>
        </div>
      </div>

      {/* ══ Ventana: avatar ══════════════════════════════════════ */}
      {modal === 'avatar' && (
        <ModalPortal onClose={() => setModal(null)} maxWidth="max-w-2xl" scrollable>
          <CabeceraModal titulo="Elige tu avatar" onClose={() => setModal(null)}/>
          <div className="p-5 space-y-4">
            <p className="text-xs" style={{ color: t.t3 }}>
              Aparece en tu panel y en tu credencial. Toca el que ya tienes para quitarlo.
            </p>
            {errorAvatar && (
              <p className="text-xs font-semibold" style={{ color:'var(--bad)' }}>{errorAvatar}</p>
            )}

            <div className="flex gap-1.5 flex-wrap">
              {[{ id:'todas', nombre:`Todos (${avatares.length})` },
                ...categorias.map(c => ({ id:c, nombre:c }))].map(c => {
                const activo = categoria === c.id
                return (
                  <button key={c.id} type="button" onClick={() => setCategoria(c.id)}
                    className="px-3 py-1.5 rounded-full text-xs font-semibold transition-colors"
                    style={{
                      background: activo ? t.accent : t.softBg,
                      color: activo ? '#ffffff' : t.t2,
                      border: `1px solid ${activo ? t.accent : t.cardBorder}`,
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
                const activo = s?.avatar === a.id
                return (
                  <button key={a.id} type="button" onClick={() => elegirAvatar(a.id)}
                    title={a.nombre}
                    className="flex flex-col items-center gap-1 rounded-xl p-1.5 transition-all active:scale-95"
                    style={{
                      background: activo ? t.softBg : 'transparent',
                      border: activo ? `2px solid ${t.accent}` : '1px solid transparent',
                    }}>
                    <img src={a.src} alt={a.nombre} loading="lazy"
                      className="w-full aspect-square rounded-full object-cover"/>
                    <span className="text-[9px] font-semibold leading-none truncate w-full text-center"
                      style={{ color: activo ? t.t1 : t.t3 }}>{a.nombre}</span>
                  </button>
                )
              }}
            </ProgressiveList>
          </div>
        </ModalPortal>
      )}

      {/* ══ Ventana: color ═══════════════════════════════════════ */}
      {modal === 'color' && (
        <ModalPortal onClose={() => setModal(null)} maxWidth="max-w-2xl" scrollable>
          <CabeceraModal titulo="Color de tu tarjeta" onClose={() => setModal(null)}/>
          <div className="p-5 space-y-4">
            <div className="rounded-2xl p-4 kw" style={{
              background: card.grad, color: tinta,
              border: `1px solid ${tarjetaClara ? 'rgba(15,23,42,.14)' : 'rgba(255,255,255,.10)'}`,
            }}>
              <p className="text-xs" style={{ opacity:.55 }}>Vista previa</p>
              <p className="font-bold truncate">{s?.name ?? 'Alumno'}</p>
            </div>

            {/* Color libre: `input type=color` abre la rueda del sistema, que en
                teléfono es la nativa y ya sabe usar todo el mundo. */}
            <div className="flex items-center gap-3 flex-wrap">
              <label className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold cursor-pointer"
                style={{ background: t.softBg, border: `1px solid ${t.cardBorder}`, color: t.t2 }}>
                <Palette size={14}/>
                Elegir cualquier color
                <input type="color" value={colorLibre}
                  onChange={e => { setColorLibre(e.target.value); setCardColor(e.target.value) }}
                  className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent p-0"/>
              </label>
              {esPersonalizado && (
                <span className="text-xs font-mono px-2.5 py-1.5 rounded-lg"
                  style={{ background: t.softBg, color: t.t2 }}>{cardColor}</span>
              )}
            </div>

            {GRUPOS_COLOR.map(grupo => {
              const items = CARD_COLORS.filter(c => c.grupo === grupo)
              if (items.length === 0) return null
              return (
                <div key={grupo}>
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-2"
                    style={{ color: t.t3 }}>{grupo}</p>
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2.5">
                    {items.map(c => {
                      const active = cardColor === c.id
                      return (
                        <button key={c.id} onClick={() => setCardColor(c.id)}
                          className="flex flex-col items-center gap-1.5 rounded-xl p-2 transition-all active:scale-95"
                          style={{
                            background: active ? t.softBg : 'transparent',
                            border: `1.5px solid ${active ? t.accent : t.cardBorder}`,
                          }}>
                          <div className="w-full h-9 rounded-lg relative overflow-hidden" style={{ background: c.grad }}>
                            {active && (
                              <span className="absolute inset-0 flex items-center justify-center">
                                <Check size={14} style={{ color: esColorClaro(c.grad) ? '#0f172a' : '#ffffff' }}/>
                              </span>
                            )}
                          </div>
                          <span className="text-[9.5px] font-semibold leading-none text-center"
                            style={{ color: t.t3 }}>{c.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </ModalPortal>
      )}
    </div>
  )
}
