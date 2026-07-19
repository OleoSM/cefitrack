import { Brush, Check, Sparkles } from 'lucide-react'
import { useStudentTheme, CARD_COLORS } from '../../context/StudentThemeContext'
import AppearancePicker from '../../components/ui/AppearancePicker'
import { useStudentData } from '../../hooks/useStudentData'

export default function StudentSettings() {
  const { appearance, setAppearance, cardColor, setCardColor, t, card } = useStudentTheme()
  const { student: s, group: grp } = useStudentData()

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h1 className="page-title">Configuración</h1>
        <p className="text-sm mt-1" style={{ color: t.t3 }}>
          Personaliza la apariencia de tu portal.
        </p>
      </div>

      <AppearancePicker appearance={appearance} setAppearance={setAppearance} t={t} title="Apariencia" />

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

        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
          {CARD_COLORS.map(c => {
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
                <span className="text-[9.5px] font-semibold leading-none" style={{ color: t.t3 }}>{c.label}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
