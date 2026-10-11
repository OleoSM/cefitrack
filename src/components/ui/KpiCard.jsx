// src/components/ui/KpiCard.jsx
import { ArrowUpRight, ArrowDownRight, ArrowRight, HelpCircle } from 'lucide-react'
import { Pista } from './Ayuda'

/**
 * KpiCard — tarjeta de indicador de SIGA.
 *
 * Jerarquía fija, de arriba abajo:
 *   1. Rótulo (qué se mide) + ficha del icono
 *   2. Valor (+ unidad opcional)
 *   3. Contexto (`sub`: "de 32 alumnos", "Sin lista pasada hoy"…)
 *   4. Pie anclado abajo: delta / pill de estado / flecha de navegación
 *
 * El pie va con `mt-auto` y la tarjeta con `h-full`: en una fila de la
 * rejilla todas miden lo mismo y sus pies quedan a la misma altura aunque
 * unas lleven pill y otras no.
 *
 * COLOR — sólo tokens. Nada de hex aquí:
 *   · variant="solid" (por defecto): fondo pleno var(--<tono>-solid), texto
 *     blanco opaco. Es el color identificador de la regla 2-bis: sin alfa,
 *     sin degradado. Los cinco rellenos pasan 4.5:1 con blanco en las tres
 *     identidades (el más bajo, --good-solid oscuro, da 5.3:1).
 *   · variant="surface": superficie de tarjeta (--card-bg/--card-border) con
 *     la ficha del icono en el relleno sólido. Para filas densas o cuando hay
 *     muchas tarjetas en pantalla y cuatro bloques de color competirían.
 *   Cada identidad publica sus rellenos desde AdminLayout/StudentLayout, así
 *   que la tarjeta ya no necesita el hook de tema ni la prop `light`.
 *
 * El texto blanco va con la clase `text-white`, nunca con un rgba inline:
 * la red de seguridad de index.css ([data-stheme-light] main [style*="color:
 * rgba(255, 255, 255"]) lo repintaba de gris sobre el relleno en IPN/UNAM.
 * `kw` exime además a toda la tarjeta de ese parche.
 */

const RELLENO = {
  neutral: 'var(--neutral-solid)',
  good:    'var(--good-solid)',
  info:    'var(--info-solid)',
  warn:    'var(--warn-solid)',
  bad:     'var(--bad-solid)',
}

/* Semánticos de tinta para la variante surface (en IPN/UNAM son pastel
   sólido; en oscuro, los del tema). */
const TINTA = {
  neutral: { fg: 'var(--t2)',  bg: 'var(--soft-bg)',   line: 'var(--card-border)' },
  good:    { fg: 'var(--good)', bg: 'var(--good-soft)', line: 'var(--good-line)' },
  info:    { fg: 'var(--info)', bg: 'var(--info-soft)', line: 'var(--info-line)' },
  warn:    { fg: 'var(--warn)', bg: 'var(--warn-soft)', line: 'var(--warn-line)' },
  bad:     { fg: 'var(--bad)',  bg: 'var(--bad-soft)',  line: 'var(--bad-line)' },
}

const FLECHA = { up: ArrowUpRight, down: ArrowDownRight, flat: ArrowRight }

/* Lectura semántica de un delta: subir no siempre es bueno (bajar el
   adeudo o los retardos es una mejora). `positive` lo decide quien llama;
   si no lo dice, se asume que subir es bueno. */
function toneDelta({ direction = 'flat', positive, tone }) {
  if (tone) return tone
  if (direction === 'flat') return 'neutral'
  const mejora = positive ?? (direction === 'up')
  return mejora ? 'good' : 'bad'
}

/** Chip opaco del pie. En `solid` es una ficha blanca con texto en el color
    del estado; en `surface`, el par soft/line del semántico. */
function Chip({ solid, tone, icon: Icon, children, title }) {
  const style = solid
    ? { color: RELLENO[tone] ?? RELLENO.neutral }
    : { color: TINTA[tone].fg, background: TINTA[tone].bg, border: `1px solid ${TINTA[tone].line}` }
  return (
    <span title={title}
      className={`inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 sm:px-2.5 sm:py-1
                  text-[10px] sm:text-xs font-bold leading-tight ${solid ? 'bg-white' : ''}`}
      style={style}>
      {Icon && <Icon className="w-3 h-3 flex-shrink-0" aria-hidden="true" />}
      <span className="truncate">{children}</span>
    </span>
  )
}

export default function KpiCard({
  icon: Icon,
  value,
  label,
  sub,                    // contexto, una línea
  pill,                   // { icon?, text, tone? } — juicio rápido ("Dar seguimiento")
  tone = 'neutral',       // 'neutral' | 'good' | 'info' | 'warn' | 'bad'
  onClick,
  className = '',
  light: _light,          // DEPRECADA: se acepta y se ignora (los tokens ya
                          // llegan por CSS). Retirarla de los consumidores.
  // ── nuevas, opcionales ──
  unit,                   // sufijo pequeño del valor: '%', '/ 10', 'MXN'
  delta,                  // { value:'+3', direction:'up'|'down'|'flat', positive?:bool, tone?, label?:'vs. semana pasada' }
  variant = 'solid',      // 'solid' | 'surface'
  children,               // contenido libre bajo el contexto (p. ej. desglose)
  info,                   // explicación al pasar el ratón por la etiqueta
}) {
  const t = RELLENO[tone] ? tone : 'neutral'
  const solid = variant !== 'surface'
  const Root = onClick ? 'button' : 'div'
  const dTone = delta ? toneDelta(delta) : null
  const DIcon = delta ? FLECHA[delta.direction ?? 'flat'] : null

  const rootStyle = solid
    ? { background: RELLENO[t], boxShadow: 'var(--card-shadow)' }
    : { background: 'var(--card-bg)', border: '1px solid var(--card-border)', boxShadow: 'var(--card-shadow)' }

  const c1 = solid ? 'text-white' : ''          // valor y rótulo
  const s1 = solid ? undefined : { color: 'var(--t1)' }
  const s2 = solid ? undefined : { color: 'var(--t2)' }
  const s3 = solid ? undefined : { color: 'var(--t3)' }

  return (
    <Root
      data-kpi-card
      data-tone={t}
      data-variant={solid ? 'solid' : 'surface'}
      {...(onClick ? { type: 'button', onClick } : {})}
      className={`kw relative w-full h-full min-w-0 flex flex-col text-left
                  rounded-2xl p-3 sm:p-4 lg:p-5 min-h-[112px] sm:min-h-[148px]
                  transition-transform duration-200
                  ${onClick ? 'cursor-pointer hover:-translate-y-0.5 active:scale-[.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:[outline-color:var(--accent)]' : ''}
                  ${className}`}
      style={rootStyle}>

      {/* 1 · Rótulo + icono */}
      <div className="flex items-start justify-between gap-2">
        <p data-kpi-label
          className={`min-w-0 text-[11px] sm:text-sm font-semibold leading-tight line-clamp-2 ${c1}`}
          style={s2}>
          {/* `info`: qué es este número y cómo se calcula. Se nota que hay
              explicación por el icono "?" y el cursor de ayuda. */}
          {info ? (
            <Pista texto={info} className="inline-flex items-center gap-1">
              {label}
              <HelpCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5 flex-shrink-0 opacity-75" aria-hidden="true"/>
            </Pista>
          ) : label}
        </p>
        {Icon && (
          <span data-kpi-icon aria-hidden="true"
            className={`w-7 h-7 sm:w-9 sm:h-9 lg:w-10 lg:h-10 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0 ${solid ? 'bg-white' : 'text-white'}`}
            style={solid ? { color: RELLENO[t] } : { background: RELLENO[t] }}>
            <Icon className="w-4 h-4 sm:w-5 sm:h-5" strokeWidth={1.75} />
          </span>
        )}
      </div>

      {/* 2 · Valor. Sin truncar: una cifra cortada con "…" miente. */}
      {value !== undefined && value !== null && (
        <p data-kpi-value
          className={`mt-1.5 sm:mt-3 font-bold leading-none tracking-tight tabular-nums [overflow-wrap:anywhere]
                      text-[clamp(1.375rem,6.5vw,1.875rem)] sm:text-3xl lg:text-4xl ${c1}`}
          style={s1}>
          {value}
          {unit && (
            <span className={`ml-1 align-baseline text-xs sm:text-base font-semibold ${c1}`} style={s3}>{unit}</span>
          )}
        </p>
      )}

      {/* 3 · Contexto. Visible también en teléfono: "de 32 alumnos" es dato. */}
      {sub && (
        <p data-kpi-sub title={typeof sub === 'string' ? sub : undefined}
          className={`mt-1 text-[10px] sm:text-xs font-medium leading-snug truncate ${c1}`}
          style={s3}>
          {sub}
        </p>
      )}

      {children && <div className={`mt-2 min-w-0 ${c1}`}>{children}</div>}

      {/* 4 · Pie: anclado abajo para alinear la fila */}
      {(delta || pill?.text || onClick) && (
        <div className="mt-auto pt-2 sm:pt-3 flex items-center gap-1.5 min-w-0">
          {delta && (
            <Chip solid={solid} tone={dTone} icon={DIcon} title={delta.label}>
              {delta.value}
              {delta.label && <span className="hidden sm:inline font-medium"> {delta.label}</span>}
            </Chip>
          )}
          {pill?.text && (
            <Chip solid={solid} tone={RELLENO[pill.tone] ? pill.tone : t} icon={pill.icon}>
              {pill.text}
            </Chip>
          )}
          {onClick && (
            <ArrowUpRight data-kpi-arrow aria-hidden="true"
              className={`ml-auto w-4 h-4 flex-shrink-0 ${c1}`} style={s3} />
          )}
        </div>
      )}
    </Root>
  )
}

/* Rejilla estándar de indicadores. Siempre dos columnas en teléfono
   (index.css ya lo fuerza con [data-kpi-grid] ≤ 700 px). Las clases van
   escritas completas para que Tailwind las genere. */
const COLS = {
  2: 'grid-cols-2',
  3: 'grid-cols-2 sm:grid-cols-3',
  4: 'grid-cols-2 lg:grid-cols-4',
}

export function KpiGrid({ cols = 4, className = '', children }) {
  return (
    <div data-kpi-grid
      className={`grid ${COLS[cols] ?? COLS[4]} gap-2.5 sm:gap-4 items-stretch ${className}`}>
      {children}
    </div>
  )
}
