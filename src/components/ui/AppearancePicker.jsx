import { Palette, Check } from 'lucide-react'
import { APPEARANCES } from '../../context/StudentThemeContext'

/* El logo oficial identifica la identidad mucho antes que un rectángulo de
   color. Se muestran sin recolorear ni deformar, como pide su ficha. */
const PREVIEW = {
  default: { side: '#0a0a14', main: '#070b16', bar: 'var(--warn)', logo: null },
  ipn:     { side: '#881126', main: '#ffffff', bar: '#ffffff', logo: '/logos/instituciones/ipn.webp', alt: 'IPN' },
  unam:    { side: '#003366', main: '#ffffff', bar: '#CC9933', logo: '/logos/instituciones/unam.svg', alt: 'UNAM' },
}

const APPEARANCE_DESC = {
  default: 'Tema oscuro original de SIGA CEFIMAT.',
  ipn:     'Guinda Politécnico (#881126) en menú y barra superior, contenido en blanco.',
  unam:    'Azul UNAM (#003366) en menú y barra superior, contenido blanco con destellos dorados (#CC9933).',
}

/** Selector de identidad institucional (Default / IPN / UNAM), reutilizado en Configuración de alumno y de admin. */
export default function AppearancePicker({ appearance, setAppearance, t, title = 'Identidad institucional' }) {
  return (
    <div className="card p-5 space-y-4">
      <h2 className="section-title flex items-center gap-2"><Palette size={15}/> {title}</h2>
      <p className="text-xs leading-relaxed" style={{ color: t.t3 }}>
        {APPEARANCE_DESC[appearance]}
      </p>

      <div className="grid grid-cols-3 gap-2.5">
        {APPEARANCES.map(a => {
          const preview = PREVIEW[a.id]
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
                <div className="flex-1 p-1.5 flex items-center justify-center" style={{ background: preview.main }}>
                  {preview.logo ? (
                    <img src={preview.logo} alt={preview.alt}
                      className="max-h-8 w-auto object-contain" />
                  ) : (
                    <div className="w-full">
                      <div className="w-full h-2 rounded" style={{ background:'var(--card-border)' }}/>
                      <div className="w-2/3 h-2 rounded mt-1" style={{ background:'var(--soft-bg)' }}/>
                    </div>
                  )}
                </div>
              </div>
              <div className="px-2 py-1.5 flex items-center justify-between"
                style={{ background: 'var(--card-bg)' }}>
                <span className="text-[10px] font-bold truncate" style={{ color: t.t2 }}>{a.label}</span>
                {active && <Check size={11} style={{ color: t.accent }}/>}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
