import { Palette, Brush, Check, Sparkles } from 'lucide-react'
import { useStudentTheme, APPEARANCES, CARD_COLORS } from '../../context/StudentThemeContext'
import Dropdown from '../../components/ui/Dropdown'
import { useAuth } from '../../context/AuthContext'
import { getStudentById, getGroupById } from '../../data/mockData'

const APPEARANCE_DESC = {
  default: 'Tema oscuro original de SIGA CEFIMAT.',
  ipn:     'Guinda Politécnico (#881126) en menú y barra superior, contenido en blanco.',
  unam:    'Azul UNAM (#003366) en menú y barra superior, contenido blanco con destellos dorados (#CC9933).',
}

export default function StudentSettings() {
  const { currentUser } = useAuth()
  const { appearance, setAppearance, cardColor, setCardColor, t, card } = useStudentTheme()
  const s   = getStudentById(currentUser?.studentId)
  const grp = getGroupById(s?.groupId)

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h1 className="page-title">Configuración</h1>
        <p className="text-sm mt-1" style={{ color: t.t3 }}>
          Personaliza la apariencia de tu portal.
        </p>
      </div>

      {/* ── Apariencia ─────────────────────────────────────────── */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="section-title flex items-center gap-2"><Palette size={15}/> Apariencia</h2>
          <Dropdown
            value={appearance}
            onChange={setAppearance}
            options={APPEARANCES.map(a => ({ value: a.id, label: a.label }))}
            align="right"
          />
        </div>
        <p className="text-xs leading-relaxed" style={{ color: t.t3 }}>
          {APPEARANCE_DESC[appearance]}
        </p>

        {/* Muestras de las tres identidades */}
        <div className="grid grid-cols-3 gap-2.5">
          {APPEARANCES.map(a => {
            const preview = {
              default: { side: '#0a0a14', main: '#070b16', bar: '#fbbf24' },
              ipn:     { side: '#881126', main: '#ffffff', bar: '#ffffff' },
              unam:    { side: '#003366', main: '#ffffff', bar: '#CC9933' },
            }[a.id]
            const active = appearance === a.id
            return (
              <button key={a.id} onClick={() => setAppearance(a.id)}
                className="rounded-xl overflow-hidden text-left transition-all active:scale-95"
                style={{ border: active ? `2px solid ${t.accent}` : `1px solid ${t.cardBorder}` }}>
                <div className="flex h-14">
                  <div className="w-1/3" style={{ background: preview.side }}>
                    <div className="w-4 h-0.5 mt-3 ml-1.5 rounded-full" style={{ background: preview.bar }}/>
                    <div className="w-5 h-0.5 mt-1 ml-1.5 rounded-full bg-white/30"/>
                    <div className="w-4 h-0.5 mt-1 ml-1.5 rounded-full bg-white/20"/>
                  </div>
                  <div className="flex-1 p-1.5" style={{ background: preview.main }}>
                    <div className="w-full h-2 rounded"
                      style={{ background: a.id === 'default' ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.06)' }}/>
                    <div className="w-2/3 h-2 rounded mt-1"
                      style={{ background: a.id === 'default' ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.04)' }}/>
                  </div>
                </div>
                <div className="px-2 py-1.5 flex items-center justify-between"
                  style={{ background: t.light ? '#fff' : 'rgba(255,255,255,.04)' }}>
                  <span className="text-[10px] font-bold truncate" style={{ color: t.t2 }}>{a.label}</span>
                  {active && <Check size={11} style={{ color: t.accent }}/>}
                </div>
              </button>
            )
          })}
        </div>
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
