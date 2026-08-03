import { useState } from 'react'
import { Brush, Check, Sparkles, UserRound } from 'lucide-react'
import { useStudentTheme, CARD_COLORS } from '../../context/StudentThemeContext'
import AppearancePicker from '../../components/ui/AppearancePicker'
import { useStudentData } from '../../hooks/useStudentData'
import { AVATARES_POR_GRUPO, rutaAvatar } from '../../lib/avatares'
import { setStudentAvatar } from '../../lib/supabaseData'

export default function StudentSettings() {
  const { appearance, setAppearance, cardColor, setCardColor, t, card } = useStudentTheme()
  const { student: s, group: grp, setStudent } = useStudentData()

  /* El avatar se pinta al instante y se guarda después: esperar a la red para
     mostrar la elección haría que el selector se sintiera lento. */
  const [errorAvatar, setErrorAvatar] = useState(null)
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

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Configuración</h1>
        <p className="text-sm mt-1" style={{ color: t.t3 }}>
          Personaliza la apariencia de tu portal.
        </p>
      </div>

      <AppearancePicker appearance={appearance} setAppearance={setAppearance} t={t} title="Apariencia" />

      {/* ── Avatar ──────────────────────────────────────────────
          Catálogo cerrado: se elige, no se sube. La misma lista está
          validada en la base, así que no basta con tocar la petición. */}
      <div className="card p-5 space-y-4">
        <h2 className="section-title flex items-center gap-2"><UserRound size={15}/> Tu avatar</h2>
        <p className="text-xs -mt-2" style={{ color: t.t3 }}>
          Aparece en tu panel y en tu credencial. Toca el que ya tienes para quitarlo.
        </p>

        {errorAvatar && (
          <p className="text-xs font-semibold" style={{ color:'var(--bad)' }}>{errorAvatar}</p>
        )}

        {Object.entries(AVATARES_POR_GRUPO).map(([grupo, items]) => (
          <div key={grupo}>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-2"
              style={{ color: t.t3 }}>{grupo}</p>
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-2.5">
              {items.map(a => {
                const activo = s?.avatar === a.id
                return (
                  <button key={a.id} type="button" onClick={() => elegirAvatar(a.id)}
                    title={a.nombre}
                    className="flex flex-col items-center gap-1 rounded-xl p-1.5 transition-all active:scale-95"
                    style={{
                      background: activo ? t.softBg : 'transparent',
                      border: activo ? `2px solid ${t.accent}` : '1px solid transparent',
                    }}>
                    <img src={rutaAvatar(a.id)} alt={a.nombre}
                      className="w-full aspect-square rounded-full"/>
                    <span className="text-[9px] font-semibold leading-none truncate w-full text-center"
                      style={{ color: activo ? t.t1 : t.t3 }}>{a.nombre}</span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* ── Color de la tarjeta de presentación ────────────────── */}
      <div className="card p-5 space-y-4">
        <h2 className="section-title flex items-center gap-2"><Brush size={15}/> Tarjeta de presentación</h2>
        <p className="text-xs -mt-2" style={{ color: t.t3 }}>
          Elige el color de la tarjeta con tu nombre que aparece en “Mi Panel”.
        </p>

        {/* Vista previa en vivo */}
        <div className="rounded-2xl p-5 text-white kw" style={{ background: card.grad, border: '1px solid rgba(255,255,255,.10)' }}>
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-white/15 flex items-center justify-center text-base font-bold flex-shrink-0">
              {s?.name.split(' ').slice(0, 2).map(n => n[0]).join('') ?? 'AL'}
            </div>
            <div className="min-w-0">
              <p className="text-xs text-white/50">Vista previa</p>
              <p className="font-bold truncate">{s?.name ?? 'Alumno'}</p>
              <p className="text-xs text-white/40 truncate">{grp?.name} — {grp?.subject}</p>
            </div>
            <Sparkles size={16} className="ml-auto text-white/30 flex-shrink-0"/>
          </div>
        </div>

        {/* Dos bloques: los degradados y los de color plano. En IPN y UNAM los
            degradados se desvanecen contra el fondo blanco y se leen como
            transparentes, así que ahí se recomiendan los sólidos. */}
        {[
          { titulo: 'Degradados', items: CARD_COLORS.filter(c => !c.mate) },
          { titulo: t.light ? 'Sólidos · recomendados' : 'Sólidos', items: CARD_COLORS.filter(c => c.mate) },
        ].map(({ titulo, items }) => (
        <div key={titulo}>
        <p className="text-[10px] font-bold uppercase tracking-widest mb-2 mt-3"
          style={{ color: t.light && titulo.includes('recomendados') ? t.accent : t.t3 }}>{titulo}</p>
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-2.5">
          {items.map(c => {
            const active = cardColor === c.id
            return (
              <button key={c.id} onClick={() => setCardColor(c.id)}
                className="flex flex-col items-center gap-1.5 rounded-xl p-2 transition-all active:scale-95"
                style={{
                  background: active ? (t.light ? `${t.accent}0d` : 'rgba(255,255,255,.08)') : 'transparent',
                  border: active ? `1.5px solid ${t.accent}` : `1.5px solid ${t.cardBorder}`,
                }}>
                <div className="w-full h-9 rounded-lg relative overflow-hidden" style={{ background: c.grad }}>
                  {active && (
                    <span className="absolute inset-0 flex items-center justify-center">
                      <Check size={14} className="text-white drop-shadow"/>
                    </span>
                  )}
                </div>
                <span className="text-[9.5px] font-semibold leading-none text-center" style={{ color: t.t3 }}>{c.label}</span>
              </button>
            )
          })}
        </div>
        </div>
        ))}
      </div>
    </div>
  )
}
