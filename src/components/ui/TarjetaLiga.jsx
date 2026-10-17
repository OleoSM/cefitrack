import { useEffect, useState } from 'react'
import { Flame, Trophy, X, Layers } from 'lucide-react'
import { ligaDe, insignia, LIGAS, NIVELES_POR_LIGA, fetchMiRacha, fetchRachaAlumno } from '../../lib/ligas'
import { SkeletonBlock } from './DataTable'
import ModalPortal from './ModalPortal'

/* Las 10 ligas con sus niveles; la del alumno, resaltada. */
function ModalLigas({ actual, onClose }) {
  return (
    <ModalPortal maxWidth="max-w-lg" onClose={onClose} scrollable>
      <div className="flex items-center justify-between gap-3 px-5 py-3.5 sticky top-0 z-10" style={{ borderBottom: '1px solid var(--divider)', background: 'var(--panel-bg)' }}>
        <h2 className="text-sm font-bold" style={{ color: 'var(--t1)' }}>Ligas de SIGA</h2>
        <button type="button" onClick={onClose} aria-label="Cerrar" className="w-11 h-11 flex items-center justify-center rounded-lg" style={{ color: 'var(--t3)' }}><X size={15}/></button>
      </div>
      <div className="p-5 space-y-3">
        <p className="text-xs" style={{ color: 'var(--t3)' }}>
          Cada clase a la que asistes suma 1 nivel. Cada liga tiene 10 niveles en dos divisiones (I y II). Después de Leyenda II
          eres <b>Leyenda ★</b>. Tu racha cuenta las clases seguidas sin faltar.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {LIGAS.map((l, i) => (
            <div key={l.id} className="rounded-xl p-2 text-center" style={{ border: `${l.id === actual ? 2 : 1}px solid ${l.id === actual ? 'var(--accent)' : 'var(--divider)'}` }}>
              <img src={insignia(l.id)} alt="" width={56} height={56} className="mx-auto"/>
              <p className="text-xs font-bold mt-1" style={{ color: 'var(--t1)' }}>{l.nombre}</p>
              <p className="text-[10px]" style={{ color: 'var(--t3)' }}>Niveles {i * NIVELES_POR_LIGA + 1}–{(i + 1) * NIVELES_POR_LIGA}</p>
            </div>
          ))}
        </div>
      </div>
    </ModalPortal>
  )
}

/*
 * Tarjeta de liga y racha (portal del alumno y perfil en el panel de admin).
 * Insignia de la liga (Einstein), división (I / II), nivel, barra hacia la
 * siguiente división y la racha de clases seguidas. Después de la liga 10, la
 * insignia lleva una estrella animada (respeta "reducir movimiento").
 * `studentId`: para el personal; sin él, la racha propia del alumno.
 */
export default function TarjetaLiga({ studentId = null, compacta = false }) {
  const [r, setR] = useState(undefined)
  const [verLigas, setVerLigas] = useState(false)
  useEffect(() => {
    const p = studentId ? fetchRachaAlumno(studentId) : fetchMiRacha()
    p.then(x => setR(x ?? { rachaActual: 0, mejorRacha: 0, asistencias: 0, sesiones: 0 })).catch(() => setR(null))
  }, [studentId])

  if (r === undefined) return <SkeletonBlock className={compacta ? 'h-24' : 'h-36'}/>
  if (r === null) return null
  const l = ligaDe(r.asistencias)
  const idx = LIGAS.findIndex(x => x.id === l.liga.id)

  return (
    <div className="card p-4 sm:p-5 flex items-center gap-4 min-w-0">
      <div className="relative flex-shrink-0" style={{ width: compacta ? 64 : 88, height: compacta ? 64 : 88 }}>
        <img src={insignia(l.liga.id)} alt={`Insignia de la liga ${l.liga.nombre}`} width={compacta ? 64 : 88} height={compacta ? 64 : 88}
          style={{ filter: l.nivel === 0 ? 'grayscale(1) opacity(.45)' : 'none' }}/>
        {l.estrella && (
          <img src={insignia('estrella')} alt="" aria-hidden="true" className="estrella-leyenda absolute"
            style={{ width: compacta ? 26 : 34, height: compacta ? 26 : 34, top: -6, right: -6 }}/>
        )}
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <p className="text-base font-bold" style={{ color: 'var(--t1)' }}>{l.etiqueta}</p>
          <p className="text-xs" style={{ color: 'var(--t3)' }}>Nivel {l.nivel}{idx >= 0 && l.nivel > 0 && !l.estrella ? ` · liga ${idx + 1} de ${LIGAS.length}` : ''}</p>
        </div>
        {!l.estrella && (
          <div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--soft-bg)' }} role="progressbar"
              aria-valuenow={Math.round(l.progreso * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Avance hacia la siguiente división">
              <div className="h-full rounded-full" style={{ width: `${l.progreso * 100}%`, background: l.liga.color }}/>
            </div>
            <p className="text-[11px] mt-1" style={{ color: 'var(--t3)' }}>
              {l.faltan === 1 ? 'Te falta 1 clase' : `Te faltan ${l.faltan} clases`} para {l.siguiente}
            </p>
          </div>
        )}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          <span className="flex items-center gap-1 font-semibold" style={{ color: r.rachaActual > 0 ? 'var(--warn)' : 'var(--t3)' }}>
            <Flame size={14}/> Racha de {r.rachaActual} {r.rachaActual === 1 ? 'clase' : 'clases'}
          </span>
          {!compacta && (
            <span className="flex items-center gap-1" style={{ color: 'var(--t3)' }}>
              <Trophy size={13}/> Mejor racha: {r.mejorRacha}
            </span>
          )}
          <button type="button" onClick={() => setVerLigas(true)} className="flex items-center gap-1 font-semibold underline min-h-6" style={{ color: 'var(--t2)' }}>
            <Layers size={13}/> Ver ligas
          </button>
        </div>
      </div>
      {verLigas && <ModalLigas actual={l.nivel ? l.liga.id : null} onClose={() => setVerLigas(false)}/>}
    </div>
  )
}
