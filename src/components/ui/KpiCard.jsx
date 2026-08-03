import { ArrowUpRight } from 'lucide-react'
import { useAdminTheme } from '../../context/AdminThemeContext'

/* Dorado institucional para el pill. Es fijo a propósito: la tarjeta siempre
   tiene fondo de color, así que no depende de la escala de texto del tema. */
const ORO = '#E6B33D'

/** Birrete de contorno, decorativo. Da carácter sin competir con el dato. */
function Birrete({ color }) {
  return (
    <svg viewBox="0 0 120 100" fill="none" stroke={color} strokeWidth="3"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
      className="absolute right-3 bottom-2 w-24 h-24 pointer-events-none">
      <path d="M60 22 L108 40 L60 58 L12 40 Z" />
      <path d="M28 47 v20 c0 8 14 14 32 14 s32-6 32-14 v-20" />
      <path d="M108 40 v22" />
      <circle cx="108" cy="66" r="4" />
    </svg>
  )
}

/**
 * KpiCard — tarjeta de indicador con identidad institucional.
 *
 * El fondo usa el acento de la identidad activa (guinda en IPN, azul en UNAM,
 * crimson SIGA en el tema oscuro), así que las cuatro comparten color y la
 * lectura la da el icono, el dato y el pill. Reemplaza a las tarjetas planas
 * anteriores, que solo tenían borde y número.
 */
/* Un color por tipo de métrica, de la paleta institucional sólida.
   Antes las cuatro tarjetas iban en el color institucional en IPN/UNAM y
   competían entre sí: cuatro bloques guinda idénticos en fila no dicen nada,
   y hay que leer el rótulo de cada uno para saber qué se está mirando.
   El color aquí es información, no decoración.

   Los tonos profundos son para las identidades claras; sobre el fondo oscuro
   se sirve el mismo matiz más luminoso o la tarjeta se funde con la página. */
const TONOS = {
  neutral: { claro:'#12345A', oscuro:'#2C6BA8' },   // marino
  good:    { claro:'#17502D', oscuro:'#2E8A50' },   // bosque
  info:    { claro:'#064B60', oscuro:'#1286A0' },   // petróleo
  warn:    { claro:'#633515', oscuro:'#A85F2A' },   // café
  bad:     { claro:'#681126', oscuro:'#B02546' },   // granate
}

export default function KpiCard({
  icon: Icon, value, label, sub, pill, tone = 'neutral', onClick, className = '',
}) {
  const { t } = useAdminTheme()
  const par = TONOS[tone] ?? TONOS.neutral
  const accent = t?.light ? par.claro : par.oscuro

  const Root = onClick ? 'button' : 'div'

  return (
    <Root
      onClick={onClick}
      /* En móvil la tarjeta baja de 216 px a 100 px. No es la de escritorio
         encogida: se eliminan el subtítulo, el pill y el birrete, y el icono y
         el dato bajan de 44/36 px a 28/28. Reducirlo todo proporcionalmente
         habría conservado el ruido y perdido legibilidad. */
      className={`relative overflow-hidden rounded-2xl p-3 sm:p-5 text-left w-full
                  h-[100px] sm:h-auto flex flex-col justify-center sm:block
                  transition-transform duration-200 ${onClick ? 'active:scale-[.99] hover:-translate-y-0.5' : ''} ${className}`}
      style={{
        // Color plano: el degradado diagonal aclaraba una esquina y oscurecía
        // la otra, que es justo lo que se leía como "no es un color sólido".
        background: accent,
        boxShadow: '0 1px 3px rgba(15,23,42,.14), 0 6px 16px rgba(15,23,42,.12)',
      }}>

      {/* Adorno: sólo desde sm. En 100 px de alto competiría con el dato. */}
      <div className="hidden sm:block">
        <Birrete color="rgba(255,255,255,.16)" />
        <svg viewBox="0 0 40 40" className="absolute right-[86px] bottom-[74px] w-7 h-7 pointer-events-none"
          fill="none" stroke={ORO} strokeWidth="3.5" strokeLinecap="round" aria-hidden="true">
          <path d="M20 6 v9" /><path d="M7 13 l6 6" /><path d="M33 13 l-6 6" />
        </svg>
      </div>

      <div className="relative flex items-start justify-between">
        <div className="w-7 h-7 sm:w-11 sm:h-11 rounded-lg sm:rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{ background:'#ffffff', boxShadow:'0 2px 8px rgba(0,0,0,.18)' }}>
          {Icon && <Icon className="w-4 h-4 sm:w-[21px] sm:h-[21px]" style={{ color: accent }} />}
        </div>
        {onClick && <ArrowUpRight className="w-4 h-4 sm:w-[18px] sm:h-[18px]" style={{ color:'rgba(255,255,255,.75)' }} />}
      </div>

      <p className="relative text-[28px] sm:text-4xl font-bold mt-1.5 sm:mt-4 leading-none tracking-tight text-white">
        {value}
      </p>
      <p className="relative text-[11px] sm:text-sm font-semibold mt-0.5 sm:mt-1.5 text-white leading-tight">{label}</p>
      {sub && (
        <p className="relative hidden sm:block text-xs mt-0.5" style={{ color:'rgba(255,255,255,.72)' }}>{sub}</p>
      )}

      {pill && (
        <span className="relative hidden sm:inline-flex items-center gap-1.5 mt-3 px-3 py-1 rounded-full text-xs font-bold"
          style={{ background: ORO, color:'#3B2A08' }}>
          {pill.icon && <pill.icon size={12} />}
          {pill.text}
        </span>
      )}
    </Root>
  )
}
