import { Check, AlertTriangle } from 'lucide-react'
import { useGroupColors, TINTAS } from '../../hooks/useGroupColors'

/**
 * Elegir el color de letra de la tarjeta de un grupo. Cada opción se pinta
 * como un "Aa" sobre el fondo real del grupo, así se ve antes de elegir si se
 * lee; las que quedan por debajo de 4.5:1 (WCAG AA) llevan aviso.
 *
 * `paletteId` permite previsualizar sobre una paleta aún sin guardar.
 */
export default function SelectorTinta({ groupId, paletteId, valor, onChange }) {
  const { resolverTinta, fondoDeLectura } = useGroupColors()
  const fondo = fondoDeLectura(groupId, paletteId)
  const elegida = resolverTinta(groupId, valor, paletteId)

  return (
    <div>
      <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
        {TINTAS.map(op => {
          const t = resolverTinta(groupId, op.id, paletteId)
          const activo = valor === op.id
          const bajo = t.contraste != null && t.contraste < 4.5
          return (
            <button key={op.id} type="button" onClick={() => onChange(op.id)}
              aria-pressed={activo} title={`${op.name}${bajo ? ' — se lee poco' : ''}`}
              data-sin-zoom
              className="relative flex flex-col items-center gap-1 rounded-xl p-1 transition-transform active:scale-95">
              <span className="w-full h-10 rounded-lg flex items-center justify-center text-base font-black"
                style={{
                  background: t.velaClara ? '#E8E8EE' : fondo, color: t.hex,
                  border: activo ? '2px solid var(--accent)' : '1px solid var(--card-border)',
                  boxShadow: activo ? '0 0 0 2px var(--panel-bg)' : 'none',
                }}>
                Aa
              </span>
              <span className="text-[10px] font-semibold leading-none flex items-center gap-0.5"
                style={{ color: activo ? 'var(--t1)' : 'var(--t3)' }}>
                {bajo && <AlertTriangle size={9} style={{ color: 'var(--warn)' }}/>}
                {op.name}
              </span>
              {activo && (
                <span className="absolute top-0 right-0 w-4 h-4 rounded-full flex items-center justify-center"
                  style={{ background: 'var(--accent)', color: 'var(--accent-contrast)' }}>
                  <Check size={9} strokeWidth={3}/>
                </span>
              )}
            </button>
          )
        })}
      </div>
      <p className="text-[10px] mt-1.5" style={{ color: elegida.contraste != null && elegida.contraste < 4.5 ? 'var(--warn)' : 'var(--t3)' }}>
        {elegida.contraste == null ? '' : elegida.contraste < 4.5
          ? `Contraste ${elegida.contraste.toFixed(1)}:1 — puede costar leerlo. Prueba otra opción.`
          : `Contraste ${elegida.contraste.toFixed(1)}:1 — se lee bien.`}
      </p>
    </div>
  )
}
