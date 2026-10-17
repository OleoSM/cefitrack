import { useEffect, useState } from 'react'
import { Wallet, CheckCircle2, Clock, Receipt } from 'lucide-react'
import { useStudentData } from '../../hooks/useStudentData'
import { fetchMisPagos } from '../../lib/permisosAlumno'
import { METODO_LABEL, mxn } from '../../lib/pagosData'
import ProgressiveList from '../../components/ui/ProgressiveList'
import { SkeletonBlock } from '../../components/ui/DataTable'
import { BotonAyuda } from '../../components/ui/Ayuda'

/*
 * Mis pagos: cómo va el alumno con su plan (total, pagado, saldo y
 * mensualidades). Solo lectura. El admin puede ocultar este apartado desde
 * "Permisos" del alumno; entonces el servidor tampoco devuelve los datos.
 */
const mesLargo = f => new Date(`${String(f).slice(0, 10)}T12:00:00`).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
const fechaCorta = f => new Date(`${String(f).slice(0, 10)}T12:00:00`).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })

function resumenPlan(plan, pagos) {
  const delPlan = pagos.filter(p => p.plan_id === plan.id)
  const curso = delPlan.filter(p => !p.es_inscripcion)
  const pagado = curso.reduce((s, p) => s + Number(p.monto ?? 0), 0)
  const total = Number(plan.total ?? 0)
  const liquidado = curso.some(p => p.cubre_total) || pagado >= total
  const meses = plan.modalidad === 'contado' ? 1 : plan.mensualidades
  const inicio = new Date(`${plan.inicio}T12:00:00`)
  const periodosPagados = new Set(curso.map(p => String(p.periodo ?? '').slice(0, 7)))
  const calendario = Array.from({ length: meses }, (_, i) => {
    const d = new Date(inicio); d.setMonth(inicio.getMonth() + i)
    const clave = d.toISOString().slice(0, 7)
    return { clave, fecha: `${clave}-01`, pagado: liquidado || periodosPagados.has(clave) }
  })
  return { delPlan, pagado, total, saldo: Math.max(0, total - pagado), liquidado, mensualidad: meses ? total / meses : total, calendario }
}

export default function MisPagos() {
  const { student, loading: cargandoAlumno } = useStudentData()
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!student?.id) return
    fetchMisPagos(student.id).then(setDatos).catch(() => setError('No se pudieron cargar tus pagos.'))
  }, [student?.id])

  return (
    <div className="w-full space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="page-title">Mis pagos</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--t3)' }}>Cómo vas con tu plan de pagos del curso.</p>
        </div>
        <BotonAyuda titulo="Mis pagos">
          <p>Aquí ves el total de tu curso, lo que ya pagaste y lo que te falta.</p>
          <p>Si algún pago no aparece, revísalo en tu sucursal con el comprobante.</p>
        </BotonAyuda>
      </div>

      {error && <p role="alert" className="text-sm" style={{ color: 'var(--bad)' }}>{error}</p>}

      {(cargandoAlumno || (!datos && !error)) ? (
        <div className="space-y-3">{[0, 1].map(i => <SkeletonBlock key={i} className="h-28"/>)}</div>
      ) : datos && datos.planes.length === 0 ? (
        <div className="card p-8 text-center space-y-2">
          <Wallet size={32} className="mx-auto" style={{ color: 'var(--t3)' }}/>
          <p className="text-sm" style={{ color: 'var(--t2)' }}>Aún no hay un plan de pagos registrado.</p>
          <p className="text-xs" style={{ color: 'var(--t3)' }}>Si ya pagaste, pregunta en tu sucursal.</p>
        </div>
      ) : datos && datos.planes.map(plan => {
        const r = resumenPlan(plan, datos.pagos)
        const pct = r.total > 0 ? Math.min(100, (r.pagado / r.total) * 100) : 100
        return (
          <div key={plan.id} className="space-y-4">
            <div className="card p-4 sm:p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="section-title flex items-center gap-2"><Wallet size={16}/> {plan.concepto || 'Curso'}</h2>
                <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                  style={r.liquidado ? { background: 'var(--good-soft)', color: 'var(--good)' } : { background: 'var(--warn-soft)', color: 'var(--warn)' }}>
                  {r.liquidado ? 'Liquidado' : `Te faltan ${mxn(r.saldo)}`}
                </span>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                {[['Total del curso', mxn(r.total)], ['Pagado', mxn(r.pagado)], ['Saldo', mxn(r.saldo)],
                  [plan.modalidad === 'contado' ? 'Modalidad' : 'Mensualidad', plan.modalidad === 'contado' ? 'Contado' : mxn(r.mensualidad)]].map(([k, v]) => (
                  <div key={k} className="rounded-xl px-3 py-2.5" style={{ background: 'var(--soft-bg)' }}>
                    <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--t3)' }}>{k}</p>
                    <p className="text-lg font-bold tabular-nums" style={{ color: 'var(--t1)' }}>{v}</p>
                  </div>
                ))}
              </div>
              <div>
                <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--soft-bg)' }} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: r.liquidado ? 'var(--good)' : 'var(--accent)' }}/>
                </div>
                <p className="text-[11px] mt-1" style={{ color: 'var(--t3)' }}>{Math.round(pct)} % pagado</p>
              </div>
              {plan.modalidad !== 'contado' && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--t3)' }}>Mensualidades</p>
                  <ProgressiveList items={r.calendario} className="grid grid-cols-1 sm:grid-cols-2 gap-1.5" sizes={{ mobile: 5, tablet: 6, desktop: 6 }}>
                    {m => (
                      <div key={m.clave} className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ border: '1px solid var(--divider)' }}>
                        {m.pagado ? <CheckCircle2 size={15} style={{ color: 'var(--good)' }}/> : <Clock size={15} style={{ color: 'var(--t3)' }}/>}
                        <span className="text-sm capitalize flex-1" style={{ color: 'var(--t1)' }}>{mesLargo(m.fecha)}</span>
                        <span className="text-xs font-semibold" style={{ color: m.pagado ? 'var(--good)' : 'var(--t3)' }}>{m.pagado ? 'Pagada' : 'Pendiente'}</span>
                      </div>
                    )}
                  </ProgressiveList>
                </div>
              )}
            </div>

            <div className="card p-4 sm:p-5 space-y-3">
              <h2 className="section-title flex items-center gap-2"><Receipt size={16}/> Pagos registrados</h2>
              <ProgressiveList items={r.delPlan} className="space-y-1.5" sizes={{ mobile: 5, tablet: 5, desktop: 5 }} emptyLabel="Todavía no hay pagos registrados.">
                {p => (
                  <div key={p.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5" style={{ border: '1px solid var(--divider)' }}>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold" style={{ color: 'var(--t1)' }}>{p.concepto || (p.es_inscripcion ? 'Inscripción' : 'Pago')}</p>
                      <p className="text-[11px]" style={{ color: 'var(--t3)' }}>{fechaCorta(p.fecha)} · {METODO_LABEL[p.metodo] ?? p.metodo}</p>
                    </div>
                    <span className="text-sm font-bold tabular-nums" style={{ color: 'var(--good)' }}>{mxn(p.monto)}</span>
                  </div>
                )}
              </ProgressiveList>
            </div>
          </div>
        )
      })}
    </div>
  )
}
