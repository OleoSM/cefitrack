import { useState, useEffect, useCallback, useMemo } from 'react'
import { Navigate } from 'react-router-dom'
import {
  Wallet, Plus, Trash2, Pencil, X,
  CreditCard, WalletCards, Banknote, ArrowLeftRight, CheckCircle2, AlertTriangle,
  StickyNote, Ticket,
} from 'lucide-react'
import KpiCard, { KpiGrid } from '../../components/ui/KpiCard'
import { IconPagos, IconAdeudos } from '../../components/ui/SigaKpiIcons'
import ConfirmDialog from '../../components/admin/ConfirmDialog'
import { todayISO } from '../../lib/fecha'
import { useAuth } from '../../context/AuthContext'
import { useSucursales } from '../../hooks/useSucursales'
import BarraFiltros from '../../components/ui/BarraFiltros'
import { useSucursalActiva, TODAS } from '../../hooks/useSucursalActiva'
import {
  DataTable, DataTableRow, DataTableAvatar, DataTableBar, SkeletonRows,
} from '../../components/ui/DataTable'
import { NeonCheckbox } from '../../components/ui/NeonCheckbox'
import ProgressiveList from '../../components/ui/ProgressiveList'
import ModalPortal from '../../components/ui/ModalPortal'
import {
  fetchResumenPagos, fetchPagos, guardarPlan, registrarPago, borrarPago,
  METODOS, METODO_LABEL, METODO_LABEL_CORTO, METODO_COLOR, mxn, etiquetaMes, claveMes,
  calendarioPlan, pagosSinMes, estadoDe, ESTADO_LABEL, ESTADO_COLOR,
} from '../../lib/pagosData'

/*
 * Pagos — qué debe cada alumno, cuánto lleva pagado y con qué medio.
 *
 * Decisiones que conviene no deshacer sin leer antes:
 *
 *  · Los <select> son nativos con `.input-field` y no `ui/Dropdown`. Aquel
 *    componente se pinta con los tokens del portal del ALUMNO —fuera de su
 *    provider cae siempre al tema oscuro— así que en las identidades claras
 *    (IPN/UNAM) desplegaría un panel negro sobre página blanca. Es el mismo
 *    motivo por el que Registrar.jsx tampoco lo reutiliza. El resto del panel
 *    de administración usa `.input-field`, que sí tiene override claro.
 *
 *  · Sucursal y grupo van como BOTONES y no como desplegable: se piden a diario
 *    y un desplegable esconde cuántas opciones hay. El resto de filtros, que se
 *    tocan de vez en cuando, sí son selects.
 *
 *  · Las sucursales NO están escritas a mano: salen de los grupos que existen
 *    en la base, y su nombre para mostrar sale del catálogo `sucursales`
 *    y esta pantalla debe seguirlo sin tocar código.
 */

/* Los iconos de forma de pago se declaran una vez: aparecen en la tabla, en el
   calendario, en la lista de movimientos y en el formulario. */
const METODO_ICON = {
  /* Crédito y débito comparten color por ser la misma familia, así que el
     icono es lo que los separa de un vistazo: la tarjeta para el crédito y
     la terminal para el débito, que es como se cobra en mostrador. */
  tarjeta_credito: CreditCard,
  tarjeta_debito: WalletCards,
  efectivo: Banknote,
  transferencia: ArrowLeftRight,
}

const COLUMNS = [
  { key: 'alumno',  label: 'Alumno',   className: 'flex-grow min-w-[110px] sm:min-w-[130px]' },
  { key: 'grupo',   label: 'Grupo',    className: 'w-28 hidden lg:flex' },
  { key: 'total',   label: 'Total',    className: 'w-24 hidden xl:flex' },
  { key: 'pagado',  label: 'Pagado',   className: 'w-28 hidden sm:flex' },
  { key: 'avance',  label: 'Avance',   className: 'w-24 sm:w-40' },
  { key: 'formas',  label: 'Formas',   className: 'w-24 hidden xl:flex' },
  { key: 'estado',  label: 'Estado',   className: 'w-28 hidden md:flex' },
  { key: 'accion',  label: '',         className: 'w-10 flex justify-end' },
]

/* El color del avance sigue el mismo criterio que el resto del panel: verde
   cuando está resuelto, ámbar mientras avanza, rojo cuando no ha empezado. */
const colorAvance = pct =>
  pct == null ? 'var(--t3)' : pct >= 100 ? 'var(--good)' : pct > 0 ? 'var(--warn)' : 'var(--bad)'

const iniciales = n => (n ?? '?').trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase()

/* ── Insignia de forma de pago ───────────────────────────────────────────────
   Color pleno y opaco con texto blanco encima: es un identificador, y la regla
   de color prohíbe el alfa en ellos. */
function MetodoBadge({ metodo, compacto = false }) {
  const Icon = METODO_ICON[metodo]
  return (
    <span className="badge" style={{ background: METODO_COLOR[metodo], color: '#fff' }}>
      <Icon size={11} />
      {!compacto && METODO_LABEL_CORTO[metodo]}
    </span>
  )
}

export default function Pagos() {
  const { sucursales: catalogoSucursales, nombreDe } = useSucursales()
  const { puedeVer } = useAuth()
  // Admin, o sub-admin al que un admin le abrió el apartado (el servidor
  // además lo limita a los alumnos de sus grupos).
  const isAdmin = puedeVer('pagos')

  const [filas, setFilas]       = useState([])
  const [pagos, setPagos]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [errorCarga, setError]  = useState(null)

  const [query, setQuery]       = useState('')
  const { sucursal, setSucursal, opcionesConTodas } = useSucursalActiva()
  const [grupo, setGrupo]       = useState('todos')
  const [buscaGrupo, setBuscaGrupo] = useState('')
  const [estado, setEstado]     = useState('todos')
  const [metodo, setMetodo]     = useState('todos')
  const [orden, setOrden]       = useState('nombre')
  const [soloAdeudo, setSoloAdeudo] = useState(false)

  const [detalle, setDetalle]   = useState(null)   // studentId abierto en el modal

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const resumen = await fetchResumenPagos()
      setFilas(resumen)
      setPagos(await fetchPagos(resumen.map(r => r.planId)))
      setError(null)
    } catch (err) {
      setError(err?.message ?? 'No se pudieron cargar los pagos.')
    }
    setLoading(false)
  }, [])

  useEffect(() => { if (isAdmin) cargar() }, [isAdmin, cargar])

  /* Sucursales y grupos derivados de los datos reales, nunca escritos a mano. */
  const sucursales = useMemo(() => catalogoSucursales.map(s => s.id), [catalogoSucursales])

  const grupos = useMemo(() => {
    const vistos = new Map()
    filas.forEach(f => {
      if (f.groupId && !vistos.has(f.groupId)) {
        vistos.set(f.groupId, { id: f.groupId, name: f.groupName, sucursal: f.sucursal })
      }
    })
    return [...vistos.values()].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
  }, [filas])

  const gruposVisibles = sucursal === TODAS
    ? grupos
    : grupos.filter(g => g.sucursal === sucursal)

  /* Al cambiar de sucursal, un grupo de otra dejaría la lista vacía sin que se
     entienda por qué. Se vuelve a "todos". */
  useEffect(() => {
    if (grupo !== 'todos' && !gruposVisibles.some(g => g.id === grupo)) setGrupo('todos')
  }, [sucursal, grupo, gruposVisibles])

  /* Formas de pago usadas por cada alumno, para el filtro y la columna. */
  const metodosPorPlan = useMemo(() => {
    const mapa = {}
    pagos.forEach(p => {
      mapa[p.planId] ??= new Set()
      mapa[p.planId].add(p.metodo)
    })
    return mapa
  }, [pagos])

  const filtradas = useMemo(() => {
    const q = query.trim().toLowerCase()
    return filas
      .filter(f => {
        const est = estadoDe(f)
        const met = metodosPorPlan[f.planId]
        return (sucursal === TODAS || f.sucursal === sucursal)
          && (grupo === 'todos' || f.groupId === grupo)
          && (estado === 'todos' || est === estado)
          && (metodo === 'todos' || (met && met.has(metodo)))
          && (!soloAdeudo || (f.saldo != null && f.saldo > 0))
          && (q === '' || f.studentName.toLowerCase().includes(q)
              || (f.studentEmail ?? '').toLowerCase().includes(q))
      })
      .sort((a, b) => {
        // Sin plan al final en lugar de romper el orden con nulls.
        const asc = (x, y) => (x ?? Infinity) - (y ?? Infinity)
        const desc = (x, y) => (y ?? -Infinity) - (x ?? -Infinity)
        if (orden === 'avance')  return asc(a.porcentaje, b.porcentaje)
        if (orden === 'saldo')   return desc(a.saldo, b.saldo)
        if (orden === 'reciente') return (b.ultimoPago ?? '').localeCompare(a.ultimoPago ?? '')
        return a.studentName.localeCompare(b.studentName)
      })
  }, [filas, metodosPorPlan, query, sucursal, grupo, estado, metodo, soloAdeudo, orden])

  /* Totales del conjunto FILTRADO, no del global: si se acota a una sucursal,
     los números de arriba tienen que hablar de esa sucursal. */
  const kpis = useMemo(() => {
    const planes = new Set(filtradas.map(f => f.planId).filter(Boolean))
    const total  = filtradas.reduce((s, f) => s + (f.total ?? 0), 0)
    const cobrado = filtradas.reduce((s, f) => s + (f.pagado ?? 0), 0)
    /* Las inscripciones se cobran aparte y NO cuentan en "Cobrado": si se
       sumaran aquí, el desglose por forma de pago no cuadraría con él. Se
       informan por separado. */
    const porMetodo = Object.fromEntries(METODOS.map(m => [m, 0]))
    let inscripciones = 0
    pagos.forEach(p => {
      if (!planes.has(p.planId)) return
      if (p.esInscripcion) inscripciones += p.monto ?? 0
      else porMetodo[p.metodo] += p.monto ?? 0
    })
    return {
      total, cobrado, inscripciones,
      saldo: total - cobrado,
      pct: total > 0 ? Math.min(100, (cobrado / total) * 100) : null,
      porMetodo,
      sinPlan: filtradas.filter(f => !f.planId).length,
    }
  }, [filtradas, pagos])

  const filaAbierta = filas.find(f => f.studentId === detalle) ?? null

  if (!isAdmin) return <Navigate to="/admin" replace />

  return (
    <div className="w-full space-y-5">

      <div>
        <h1 className="page-title">Pagos</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--t3)' }}>
          Qué tan al corriente va cada alumno, mes a mes, y con qué forma de pago. El avance se
          calcula sobre los importes cobrados, así que una liquidación de contado llega al 100 %
          con un solo movimiento.
        </p>
      </div>

      {errorCarga && (
        <div className="flex items-start gap-2 rounded-xl px-3.5 py-2.5"
          style={{ background: 'var(--bad-soft)', border: '1px solid var(--bad-line)' }}>
          <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--bad)' }}/>
          <span className="text-xs" style={{ color: 'var(--bad)' }}>{errorCarga}</span>
        </div>
      )}

      {/* ── Filtros: primero acotar, después los datos ──────────────────── */}
      <BarraFiltros
        filtros={[
          { id:'sucursal', label:'Sucursal', value:sucursal, onChange:setSucursal,
            porDefecto:sucursal, options:opcionesConTodas },
          { id:'grupo', label:'Grupo', tipo:'grupo', value:grupo, onChange:setGrupo,
            porDefecto:'todos', grupos:gruposVisibles, query:buscaGrupo, onQuery:setBuscaGrupo,
            nombreDe },
          { id:'estado', label:'Estado', value:estado, onChange:setEstado, porDefecto:'todos',
            options:[{ value:'todos', label:'Todos' },
              ...Object.entries(ESTADO_LABEL).map(([k, l]) => ({ value:k, label:l }))] },
          { id:'metodo', label:'Forma de pago', value:metodo, onChange:setMetodo, porDefecto:'todos',
            options:[{ value:'todos', label:'Todas' },
              ...METODOS.map(m => ({ value:m, label:METODO_LABEL[m] }))] },
          { id:'orden', label:'Ordenar', value:orden, onChange:setOrden, porDefecto:'nombre',
            options:[{ value:'nombre', label:'Nombre A-Z' }, { value:'avance', label:'Menor avance' },
              { value:'saldo', label:'Mayor saldo' }, { value:'reciente', label:'Pago más reciente' }] },
        ]}
        busqueda={{ value: query, onChange: setQuery, placeholder:'Buscar alumno o correo…' }}
        resumen={`${filtradas.length} alumno(s)`}>
        <NeonCheckbox checked={soloAdeudo} onChange={e => setSoloAdeudo(e.target.checked)}
          label="Sólo con adeudo"/>
      </BarraFiltros>

      {/* ── Totales del conjunto filtrado ───────────────────────────────── */}
      <KpiGrid cols={4}>
        <KpiCard icon={IconPagos} tone="neutral" label="Total del periodo" value={mxn(kpis.total)}
          sub={kpis.sinPlan > 0 ? `${kpis.sinPlan} sin plan asignado` : 'Todos con plan'}/>
        <KpiCard icon={IconPagos} tone="good" label="Cobrado" value={mxn(kpis.cobrado)}
          sub={kpis.pct == null ? '—' : `${kpis.pct.toFixed(1)} % del total`}/>
        <KpiCard icon={IconAdeudos} tone={kpis.saldo > 0 ? 'warn' : 'good'} label="Por cobrar" value={mxn(kpis.saldo)}
          sub={kpis.saldo <= 0 ? 'Sin adeudo' : `${filtradas.filter(f => (f.saldo ?? 0) > 0).length} alumnos`}/>
        <KpiCard variant="surface" icon={Wallet} tone="info" label="Cobrado por forma de pago">
          <div className="space-y-1.5">
            {METODOS.map(m => (
              <div key={m} className="flex items-center justify-between gap-2">
                <MetodoBadge metodo={m}/>
                <span className="text-xs font-bold tabular-nums" style={{ color: 'var(--t1)' }}>
                  {mxn(kpis.porMetodo[m])}
                </span>
              </div>
            ))}
            {kpis.inscripciones > 0 && (
              <p className="text-[11px] pt-1" style={{ color:'var(--t3)', borderTop:'1px solid var(--divider)' }}>
                Inscripciones aparte: <strong style={{ color:'var(--t2)' }}>{mxn(kpis.inscripciones)}</strong>
              </p>
            )}
          </div>
        </KpiCard>
      </KpiGrid>

      {/* ── Tabla ───────────────────────────────────────────────────────── */}
      <DataTable columns={COLUMNS}
        isEmpty={!loading && filtradas.length === 0}
        emptyIcon={<Wallet size={36}/>}
        emptyText="Ningún alumno coincide con el filtro.">
        {loading ? <SkeletonRows/> : (
          <ProgressiveList items={filtradas} emptyLabel="Ningún alumno coincide con el filtro.">
            {f => {
              const est = estadoDe(f)
              const met = [...(metodosPorPlan[f.planId] ?? [])]
              return (
                <DataTableRow key={f.studentId} onClick={() => setDetalle(f.studentId)} cells={[
                  { className: 'flex-grow min-w-[110px] sm:min-w-[130px]', content: (
                    <DataTableAvatar initials={iniciales(f.studentName)} name={f.studentName}
                      avatarSrc={f.avatarSrc}
                      sub={[f.groupName, nombreDe(f.sucursal)].filter(Boolean).join(' · ') || 'Sin grupo'}/>
                  )},
                  { className: 'w-28 hidden lg:flex', content: (
                    <span className="text-xs truncate" style={{ color: 'var(--t2)' }}>
                      {f.groupName ?? '—'}
                    </span>
                  )},
                  { className: 'w-24 hidden xl:flex', content: (
                    <span className="text-xs tabular-nums" style={{ color: 'var(--t2)' }}>
                      {f.total == null ? '—' : mxn(f.total)}
                    </span>
                  )},
                  { className: 'w-28 hidden sm:flex', content: (
                    <span className="text-xs font-semibold tabular-nums" style={{ color: 'var(--t1)' }}>
                      {f.planId ? mxn(f.pagado) : '—'}
                    </span>
                  )},
                  { className: 'w-24 sm:w-40', content: f.planId ? (
                    <DataTableBar value={f.porcentaje ?? 0} max={100}
                      color={colorAvance(f.porcentaje)}
                      label={`${f.porcentaje ?? 0}%`}/>
                  ) : (
                    <span className="text-xs" style={{ color: 'var(--t3)' }}>Sin plan</span>
                  )},
                  { className: 'w-24 hidden xl:flex', content: (
                    <div className="flex gap-1">
                      {met.length === 0
                        ? <span className="text-xs" style={{ color: 'var(--t4)' }}>—</span>
                        : met.map(m => <MetodoBadge key={m} metodo={m} compacto/>)}
                    </div>
                  )},
                  { className: 'w-28 hidden md:flex', content: (
                    <span className="badge" style={{
                      background: 'var(--soft-bg)', color: ESTADO_COLOR[est],
                      border: '1px solid var(--divider)',
                    }}>
                      <span className="badge-dot" style={{ background: ESTADO_COLOR[est] }}/>
                      {ESTADO_LABEL[est]}
                    </span>
                  )},
                  { className: 'w-10 flex justify-end', content: (
                    <span aria-hidden="true" className="w-8 h-8 rounded-xl flex items-center justify-center"
                      style={{ background:'var(--soft-bg)', border:'1px solid var(--card-border)', color:'var(--t2)' }}>
                      <Pencil size={14}/>
                    </span>
                  )},
                ]}/>
              )
            }}
          </ProgressiveList>
        )}
      </DataTable>

      {filaAbierta && (
        <DetalleAlumno
          fila={filaAbierta}
          pagos={pagos.filter(p => p.planId === filaAbierta.planId)}
          onClose={() => setDetalle(null)}
          onCambio={cargar}
        />
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   DETALLE DE UN ALUMNO
   Reúne lo que se pidió en la misma pantalla: el plan, los pagos mes a mes, el
   apartado de avance hasta el 100 % y la forma de pago de cada movimiento.
   ═══════════════════════════════════════════════════════════════════════════ */
function DetalleAlumno({ fila, pagos, onClose, onCambio }) {
  const [editandoPlan, setEditandoPlan] = useState(!fila.planId)
  const [error, setError] = useState(null)
  const [borrarFor, setBorrarFor] = useState(null)

  const calendario = calendarioPlan(fila, pagos)
  const sueltos    = pagosSinMes(fila, pagos)

  const eliminar = async (id) => {
    const res = await borrarPago(id)
    if (!res.ok) return res
    setError(null)
    onCambio()
  }

  return (
    <ModalPortal onClose={onClose} maxWidth="max-w-3xl" scrollable>
      {borrarFor && (
        <ConfirmDialog
          title="Eliminar movimiento"
          message={`Se eliminará el pago de ${mxn(borrarFor.monto)} del ${borrarFor.fecha}.`}
          detail="El avance y el saldo del alumno se recalculan. Esta acción no se puede deshacer."
          onConfirm={() => eliminar(borrarFor.id)}
          onClose={() => setBorrarFor(null)}/>
      )}
      <div className="flex items-start justify-between gap-3 px-5 py-3.5" style={{ borderBottom:'1px solid var(--divider)' }}>
          <div className="min-w-0">
            <h2 className="text-sm font-bold truncate" style={{ color: 'var(--t1)' }}>
              {fila.studentName}
            </h2>
            <p className="text-xs truncate" style={{ color: 'var(--t3)' }}>
              {[fila.groupName, fila.sucursal].filter(Boolean).join(' · ') || 'Sin grupo'}
              {fila.pagoEstado ? ` · nota de Registrar: “${fila.pagoEstado}”` : ''}
            </p>
          </div>
          <button onClick={onClose} aria-label="Cerrar"
            className="w-11 h-11 -my-1 flex items-center justify-center rounded-lg flex-shrink-0" style={{ color: 'var(--t3)' }}>
            <X size={15}/>
          </button>
      </div>
      <div className="p-5 space-y-5">

        {error && (
          <div className="rounded-lg px-3 py-2 text-xs"
            style={{ background: 'var(--bad-soft)', border: '1px solid var(--bad-line)', color: 'var(--bad)' }}>
            {error}
          </div>
        )}

        {/* ── Plan ─────────────────────────────────────────────────────── */}
        {editandoPlan ? (
          <FormPlan fila={fila}
            onCancel={fila.planId ? () => setEditandoPlan(false) : onClose}
            onGuardado={() => { setEditandoPlan(false); onCambio() }}/>
        ) : (
          <div className="rounded-xl p-4 flex flex-wrap items-center gap-x-6 gap-y-2"
            style={{ background: 'var(--soft-bg)', border: '1px solid var(--card-border)' }}>
            <Dato k="Concepto" v={fila.concepto}/>
            <Dato k="Total" v={mxn(fila.total)}/>
            <Dato k="Modalidad" v={fila.modalidad === 'contado'
              ? 'Contado' : `${fila.mensualidades} mensualidades`}/>
            <Dato k="Inicio" v={etiquetaMes(fila.inicio)}/>
            <button onClick={() => setEditandoPlan(true)}
              className="btn-secondary ml-auto text-xs py-1.5 px-3">
              <Pencil size={12}/> Editar plan
            </button>
          </div>
        )}

        {/* Las notas del plan se leen ANTES de cobrar: quien registra necesita
            el contexto (beca, acuerdo de pago, adeudo previo) para no aplicar
            un importe que luego hay que deshacer. */}
        {fila.planId && !editandoPlan && (fila.notas || fila.pagoEstado) && (
          <div className="rounded-xl p-3.5 flex items-start gap-2.5"
            style={{ background: 'var(--warn-soft)', border: '1px solid var(--warn-line)' }}>
            <StickyNote size={15} style={{ color: 'var(--warn)', flexShrink: 0, marginTop: 1 }}/>
            <div className="min-w-0 text-xs" style={{ color: 'var(--t2)' }}>
              <p className="font-bold mb-0.5" style={{ color: 'var(--warn)' }}>Notas del alumno</p>
              {fila.notas && <p className="whitespace-pre-line">{fila.notas}</p>}
              {fila.pagoEstado && (
                <p className="mt-1" style={{ color: 'var(--t3)' }}>
                  Estado en la hoja de calificaciones: “{fila.pagoEstado}”
                </p>
              )}
            </div>
          </div>
        )}

        {fila.planId && !editandoPlan && (
          <>
            <FormInscripcion fila={fila} pagos={pagos}
              onRegistrado={onCambio} onError={setError}/>

            {/* ── Mes a mes ─────────────────────────────────────────────── */}
            <section className="space-y-2">
              <h3 className="section-title">Pagos mes a mes</h3>
              {calendario.length === 0 ? (
                <p className="text-xs" style={{ color: 'var(--t3)' }}>
                  El plan no tiene calendario mensual.
                </p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                  {calendario.map(m => (
                    <div key={m.mes} className="rounded-xl p-3 space-y-1.5"
                      style={{
                        background: 'var(--card-bg)',
                        border: `1px solid ${m.cubierto ? 'var(--good-line)' : 'var(--card-border)'}`, boxShadow: 'var(--card-shadow)',
                      }}>
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-bold" style={{ color: 'var(--t1)' }}>
                          {m.etiqueta}
                        </span>
                        {m.cubierto && <CheckCircle2 size={13} style={{ color: 'var(--good)' }}/>}
                      </div>
                      <p className="text-sm font-bold tabular-nums"
                        style={{ color: m.cubierto ? 'var(--good)' : 'var(--t2)' }}>
                        {mxn(m.porContado ? m.esperado : m.pagado)}
                      </p>
                      <p className="text-[10px]" style={{ color: 'var(--t3)' }}>
                        de {mxn(m.esperado)}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {m.porContado
                          ? <span className="text-[10px] font-semibold" style={{ color: 'var(--good)' }}>
                              Cubierto de contado
                            </span>
                          : m.pagos.map(p => <MetodoBadge key={p.id} metodo={p.metodo} compacto/>)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* ── Movimientos ──────────────────────────────────────────── */}
            <section className="space-y-2">
              <h3 className="section-title">
                Movimientos ({pagos.length})
                {sueltos.length > 0 && (
                  <span className="font-normal" style={{ color: 'var(--t3)' }}>
                    {' '}— {sueltos.length} sin mes asignado
                  </span>
                )}
              </h3>
              {pagos.length === 0 ? (
                <p className="text-xs" style={{ color: 'var(--t3)' }}>Aún no hay pagos registrados.</p>
              ) : (
                <ProgressiveList items={pagos} className="space-y-1.5"
                  sizes={{ mobile: 4, tablet: 8, desktop: 12 }}>
                  {p => (
                    <div key={p.id} className="flex items-center gap-2.5 rounded-lg px-3 py-2"
                      style={{ background: 'var(--card-bg)', border: '1px solid var(--divider)' }}>
                      <MetodoBadge metodo={p.metodo}/>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold tabular-nums" style={{ color: 'var(--t1)' }}>
                          {mxn(p.monto)}
                          {p.cubreTotal && (
                            <span className="ml-2 text-[10px] font-semibold" style={{ color: 'var(--good)' }}>
                              LIQUIDA EL TOTAL
                            </span>
                          )}
                          {p.esInscripcion && (
                            <span className="ml-2 text-[10px] font-semibold" style={{ color: 'var(--warn)' }}>
                              INSCRIPCIÓN
                            </span>
                          )}
                        </p>
                        <p className="text-[11px] truncate" style={{ color: 'var(--t3)' }}>
                          {p.fecha}
                          {p.periodo ? ` · cubre ${etiquetaMes(p.periodo)}` : ' · sin mes asignado'}
                          {` · ${p.concepto}`}
                          {p.referencia ? ` · ref. ${p.referencia}` : ''}
                          {p.nota ? ` · ${p.nota}` : ''}
                          {` · Registro: ${p.registradoPor ?? p.createdByName}`}
                        </p>
                      </div>
                      <button onClick={() => setBorrarFor(p)} title="Eliminar movimiento" aria-label="Eliminar movimiento"
                        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors"
                        style={{ color: 'var(--t3)', background:'var(--soft-bg)', border:'1px solid var(--card-border)' }}
                        onMouseEnter={e => { e.currentTarget.style.color = 'var(--bad)' }}
                        onMouseLeave={e => { e.currentTarget.style.color = 'var(--t3)' }}>
                        <Trash2 size={14}/>
                      </button>
                    </div>
                  )}
                </ProgressiveList>
              )}
            </section>

            <FormPago fila={fila} calendario={calendario}
              onRegistrado={onCambio} onError={setError}/>

            {/* ── Avance, al final, como se pidió ──────────────────────── */}
            <section className="rounded-xl p-4 space-y-2"
              style={{ background: 'var(--soft-bg)', border: '1px solid var(--card-border)' }}>
              <div className="flex items-end justify-between gap-3">
                <h3 className="section-title">Avance de pago</h3>
                <span className="text-2xl font-bold tabular-nums"
                  style={{ color: colorAvance(fila.porcentaje) }}>
                  {fila.porcentaje ?? 0}%
                </span>
              </div>
              <div className="h-3 rounded-full overflow-hidden" style={{ background: 'var(--divider)' }}>
                {/* Color plano de extremo a extremo: la barra representa una
                    cantidad, así que no puede degradarse dentro de sí misma. */}
                <div className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${fila.porcentaje ?? 0}%`, background: colorAvance(fila.porcentaje) }}/>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-x-4 text-xs"
                style={{ color: 'var(--t2)' }}>
                <span>Pagado <strong style={{ color: 'var(--t1)' }}>{mxn(fila.pagado)}</strong> de {mxn(fila.total)}</span>
                <span style={{ color: fila.saldo > 0 ? 'var(--warn)' : 'var(--good)' }}>
                  {fila.saldo > 0 ? `Restan ${mxn(fila.saldo)}` :
                   fila.saldo < 0 ? `A favor ${mxn(-fila.saldo)}` : 'Liquidado'}
                </span>
              </div>
              {fila.liquidadoDeContado && (
                <p className="text-[11px]" style={{ color: 'var(--good)' }}>
                  Liquidado de contado en un solo movimiento.
                </p>
              )}
            </section>
          </>
        )}
      </div>
    </ModalPortal>
  )
}

function Dato({ k, v }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--t3)' }}>{k}</p>
      <p className="text-sm font-semibold" style={{ color: 'var(--t1)' }}>{v ?? '—'}</p>
    </div>
  )
}

/* ── Alta / edición del plan ─────────────────────────────────────────────── */
function FormPlan({ fila, onCancel, onGuardado }) {
  const [f, setF] = useState({
    concepto: fila.concepto ?? 'Curso',
    total: fila.total ?? '',
    modalidad: fila.modalidad ?? 'mensualidades',
    mensualidades: fila.mensualidades ?? 6,
    inicio: fila.inicio ?? claveMes(todayISO()),
    notas: fila.notas ?? '',
    inscripcion: fila.inscripcion ?? '',
  })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)

  const enviar = async (e) => {
    e.preventDefault()
    const total = Number(f.total)
    if (!(total > 0)) { setError('El total debe ser mayor que cero.'); return }
    setGuardando(true)
    const res = await guardarPlan({
      id: fila.planId, studentId: fila.studentId, total,
      modalidad: f.modalidad,
      mensualidades: f.modalidad === 'contado' ? 1 : Number(f.mensualidades),
      inicio: f.inicio, concepto: f.concepto, notas: f.notas || null,
      inscripcion: f.inscripcion === '' ? null : Number(f.inscripcion),
    })
    setGuardando(false)
    if (!res.ok) { setError(res.message); return }
    onGuardado()
  }

  return (
    <form onSubmit={enviar} className="rounded-xl p-4 space-y-3"
      style={{ background: 'var(--soft-bg)', border: '1px solid var(--card-border)' }}>
      <h3 className="section-title">{fila.planId ? 'Editar plan' : 'Crear plan de pago'}</h3>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <Campo label="Concepto" className="col-span-2">
          <input value={f.concepto} onChange={e => setF(v => ({ ...v, concepto: e.target.value }))}
            className="input-field text-sm" placeholder="Curso 2026-A"/>
        </Campo>
        <Campo label="Inscripción">
          <input type="number" min="0" step="0.01" value={f.inscripcion}
            onChange={e => setF(v => ({ ...v, inscripcion: e.target.value }))}
            className="input-field text-sm" placeholder="Aparte del curso"/>
        </Campo>
        <Campo label="Total del curso">
          <input type="number" min="1" step="0.01" value={f.total} required
            onChange={e => setF(v => ({ ...v, total: e.target.value }))}
            className="input-field text-sm" placeholder="12000"/>
        </Campo>
        <Campo label="Modalidad">
          <select value={f.modalidad} className="input-field text-sm"
            onChange={e => setF(v => ({ ...v, modalidad: e.target.value }))}>
            <option value="mensualidades">Mensualidades</option>
            <option value="contado">Contado</option>
          </select>
        </Campo>
        {/* En contado no hay calendario que configurar: el campo estorbaría. */}
        {f.modalidad === 'mensualidades' && (
          <Campo label="Mensualidades">
            <input type="number" min="1" max="36" value={f.mensualidades}
              onChange={e => setF(v => ({ ...v, mensualidades: e.target.value }))}
              className="input-field text-sm"/>
          </Campo>
        )}
        <Campo label="Mes de inicio">
          <input type="month" value={(f.inicio ?? '').slice(0, 7)}
            onChange={e => setF(v => ({ ...v, inicio: `${e.target.value}-01` }))}
            className="input-field text-sm"/>
        </Campo>
        <Campo label="Notas" className="col-span-2 sm:col-span-4">
          <input value={f.notas} onChange={e => setF(v => ({ ...v, notas: e.target.value }))}
            className="input-field text-sm" placeholder="Beca, convenio, descuento…"/>
        </Campo>
      </div>

      {error && <p className="text-xs font-semibold" style={{ color: 'var(--bad)' }}>{error}</p>}

      <div className="flex gap-2">
        <button type="submit" disabled={guardando} className="btn-primary text-sm py-2">
          {guardando ? 'Guardando…' : 'Guardar plan'}
        </button>
        <button type="button" onClick={onCancel} className="btn-secondary text-sm py-2">Cancelar</button>
      </div>
    </form>
  )
}

/* ── Inscripción ─────────────────────────────────────────────────────────────
   Va aparte del pago del curso a propósito: se cobra una sola vez, no cuelga de
   ningún mes y no cuenta contra el total de las mensualidades. Cuando se
   registraba como un movimiento más, inflaba el porcentaje pagado y el saldo
   dejaba de coincidir con lo que faltaba por cobrar del curso. */
function FormInscripcion({ fila, pagos, onRegistrado, onError }) {
  const hoy = todayISO()
  const cobrada = pagos.filter(p => p.esInscripcion)
  const totalCobrado = cobrada.reduce((a, p) => a + (p.monto ?? 0), 0)
  const esperada = fila.inscripcion ?? null
  const liquidada = esperada != null && totalCobrado >= esperada

  const [abierto, setAbierto] = useState(false)
  const [f, setF] = useState({
    monto: '', metodo: 'efectivo', fecha: hoy, referencia: '', nota: '',
    registro: localStorage.getItem('siga_pagos_registro') ?? '',
  })
  const [guardando, setGuardando] = useState(false)

  const enviar = async (e) => {
    e.preventDefault()
    const monto = Number(f.monto)
    if (!(monto > 0)) { onError('El importe de la inscripción debe ser mayor que cero.'); return }
    if (!f.registro.trim()) { onError('Escribe tu nombre en «Registro»: debe constar quién recibió el pago.'); return }
    setGuardando(true)
    const res = await registrarPago({
      planId: fila.planId, monto, metodo: f.metodo, fecha: f.fecha,
      concepto: 'Inscripción', esInscripcion: true,
      referencia: f.referencia || null, nota: f.nota || null,
      registradoPor: f.registro.trim(),
    })
    setGuardando(false)
    if (!res.ok) { onError(res.message); return }
    onError(null)
    localStorage.setItem('siga_pagos_registro', f.registro.trim())
    setF(v => ({ ...v, monto: '', referencia: '', nota: '' }))
    setAbierto(false)
    onRegistrado()
  }

  return (
    <section className="rounded-xl p-4 space-y-3"
      style={{ background: 'var(--soft-bg)', border: '1px solid var(--card-border)' }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="section-title flex items-center gap-2"><Ticket size={14}/> Inscripción</h3>
        <span className="text-xs font-bold px-2.5 py-1 rounded-full"
          style={liquidada
            ? { background:'var(--good-soft)', color:'var(--good)', border:'1px solid var(--good-line)' }
            : totalCobrado > 0
              ? { background:'var(--warn-soft)', color:'var(--warn)', border:'1px solid var(--warn-line)' }
              : { background:'var(--card-bg)', color:'var(--t3)', border:'1px solid var(--divider)' }}>
          {totalCobrado > 0 ? mxn(totalCobrado) : 'Sin cobrar'}
          {esperada != null && ` de ${mxn(esperada)}`}
        </span>
      </div>

      <p className="text-[11px]" style={{ color:'var(--t3)' }}>
        Se registra por separado del curso: no cuenta contra el total del plan ni contra ningún mes.
      </p>

      {!abierto ? (
        <button type="button" onClick={() => setAbierto(true)}
          className="btn-secondary text-xs py-2">
          <Plus size={13}/> Registrar inscripción
        </button>
      ) : (
        <form onSubmit={enviar} className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {METODOS.map(m => {
              const Icon = METODO_ICON[m]
              const activo = f.metodo === m
              return (
                <button key={m} type="button" onClick={() => setF(v => ({ ...v, metodo: m }))}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg transition-all active:scale-95"
                  style={activo
                    ? { background: METODO_COLOR[m], color: '#fff', border: `1px solid ${METODO_COLOR[m]}` }
                    : { background: 'var(--card-bg)', color: 'var(--t2)', border: '1px solid var(--card-border)' }}>
                  <Icon size={13}/> {METODO_LABEL[m]}
                </button>
              )
            })}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <Campo label="Importe">
              <input type="number" min="0.01" step="0.01" value={f.monto} required
                onChange={e => setF(v => ({ ...v, monto: e.target.value }))}
                className="input-field text-sm"
                placeholder={esperada != null ? String(esperada) : '500'}/>
            </Campo>
            <Campo label="Fecha">
              <input type="date" value={f.fecha}
                onChange={e => setF(v => ({ ...v, fecha: e.target.value }))}
                className="input-field text-sm"/>
            </Campo>
            <Campo label="Referencia">
              <input value={f.referencia} onChange={e => setF(v => ({ ...v, referencia: e.target.value }))}
                className="input-field text-sm" placeholder="Folio o autorización"/>
            </Campo>
            <Campo label="Registro">
              <input value={f.registro} onChange={e => setF(v => ({ ...v, registro: e.target.value }))}
                className="input-field text-sm" placeholder="Tu nombre" required/>
            </Campo>
            <Campo label="Nota" className="col-span-2 sm:col-span-4">
              <input value={f.nota} onChange={e => setF(v => ({ ...v, nota: e.target.value }))}
                className="input-field text-sm" placeholder="Opcional"/>
            </Campo>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setAbierto(false)}
              className="btn-secondary text-xs py-2">Cancelar</button>
            <button type="submit" disabled={guardando} className="btn-primary text-sm py-2 ml-auto">
              <Plus size={14}/> {guardando ? 'Guardando…' : 'Registrar inscripción'}
            </button>
          </div>
        </form>
      )}
    </section>
  )
}

/* ── Registro de un movimiento ───────────────────────────────────────────── */
function FormPago({ fila, calendario, onRegistrado, onError }) {
  const hoy = todayISO()
  const primeroPendiente = calendario.find(m => !m.cubierto)?.mes ?? ''

  /* El nombre de quien cobra se recuerda entre movimientos: en un mostrador
     lo normal es que la misma persona registre varios pagos seguidos, y
     volver a teclearlo cada vez invita a dejarlo en blanco. */
  const [f, setF] = useState({
    monto: '', metodo: 'efectivo', fecha: hoy,
    periodo: primeroPendiente, contado: false, concepto:'Pago de curso', referencia: '', nota: '',
    registro: localStorage.getItem('siga_pagos_registro') ?? '',
  })
  const [guardando, setGuardando] = useState(false)

  const enviar = async (e) => {
    e.preventDefault()
    // De contado el importe ES el saldo pendiente: no se acepta otro.
    const monto = f.contado ? Number(fila.saldo) : Number(f.monto)
    if (!(monto > 0)) { onError(f.contado ? 'Este plan no tiene saldo pendiente que liquidar.' : 'El importe debe ser mayor que cero.'); return }
    if (!f.registro.trim()) { onError('Escribe tu nombre en «Registro»: debe constar quién recibió el pago.'); return }
    setGuardando(true)
    const res = await registrarPago({
      planId: fila.planId, monto, metodo: f.metodo, fecha: f.fecha,
      periodo: f.contado ? null : (f.periodo || null),
      cubreTotal: f.contado,
      concepto: f.concepto,
      referencia: f.referencia || null, nota: f.nota || null,
      registradoPor: f.registro.trim(),
    })
    setGuardando(false)
    if (!res.ok) { onError(res.message); return }
    onError(null)
    localStorage.setItem('siga_pagos_registro', f.registro.trim())
    setF(v => ({ ...v, monto: '', referencia: '', nota: '', contado: false }))
    onRegistrado()
  }

  return (
    <form onSubmit={enviar} className="rounded-xl p-4 space-y-3"
      style={{ background: 'var(--soft-bg)', border: '1px solid var(--card-border)' }}>
      <h3 className="section-title flex items-center gap-2"><Plus size={14}/> Registrar pago</h3>

      {/* Forma de pago como botones: son tres y siempre las mismas. */}
      <div>
        <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5"
          style={{ color: 'var(--t3)' }}>Forma de pago</label>
        <div className="flex flex-wrap gap-1.5">
          {METODOS.map(m => {
            const Icon = METODO_ICON[m]
            const activo = f.metodo === m
            return (
              <button key={m} type="button" onClick={() => setF(v => ({ ...v, metodo: m }))}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg transition-all active:scale-95"
                style={activo
                  ? { background: METODO_COLOR[m], color: '#fff', border: `1px solid ${METODO_COLOR[m]}` }
                  : { background: 'var(--card-bg)', color: 'var(--t2)', border: '1px solid var(--card-border)' }}>
                <Icon size={13}/> {METODO_LABEL[m]}
              </button>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <Campo label="Importe">
          <input type="number" min="0.01" step="0.01" required
            value={f.contado ? String(fila.saldo ?? '') : f.monto}
            readOnly={f.contado} aria-readonly={f.contado}
            title={f.contado ? 'De contado se cobra exactamente el saldo pendiente' : undefined}
            onChange={e => setF(v => ({ ...v, monto: e.target.value }))}
            className={`input-field text-sm ${f.contado ? 'opacity-70 cursor-not-allowed' : ''}`} placeholder="2000"/>
        </Campo>
        <Campo label="Concepto de pago">
          <input value={f.concepto} onChange={e=>setF(v=>({...v,concepto:e.target.value}))}
            className="input-field text-sm" placeholder="Inscripción, mensualidad, examen…" required/>
        </Campo>
        <Campo label="Fecha">
          <input type="date" value={f.fecha}
            onChange={e => setF(v => ({ ...v, fecha: e.target.value }))}
            className="input-field text-sm"/>
        </Campo>
        {/* Un pago de contado no cuelga de ningún mes: el selector desaparece
            en vez de quedarse ahí sin efecto. */}
        {!f.contado && (
          <Campo label="Mes que cubre">
            <select value={f.periodo} className="input-field text-sm"
              onChange={e => setF(v => ({ ...v, periodo: e.target.value }))}>
              <option value="">Sin mes (abono)</option>
              {calendario.map(m => (
                <option key={m.mes} value={m.mes}>
                  {m.etiqueta}{m.cubierto ? ' — cubierto' : ''}
                </option>
              ))}
            </select>
          </Campo>
        )}
        <Campo label="Referencia">
          <input value={f.referencia} onChange={e => setF(v => ({ ...v, referencia: e.target.value }))}
            className="input-field text-sm" placeholder="Folio o autorización"/>
        </Campo>
        {/* Quién recibió el dinero. Va escrito a mano y no deducido de la
            sesión: el mostrador se comparte, y el movimiento tiene que poder
            reclamarse a una persona concreta. */}
        <Campo label="Registro">
          <input value={f.registro} onChange={e => setF(v => ({ ...v, registro: e.target.value }))}
            className="input-field text-sm" placeholder="Tu nombre" required/>
        </Campo>
        <Campo label="Nota" className="col-span-2 sm:col-span-4">
          <input value={f.nota} onChange={e => setF(v => ({ ...v, nota: e.target.value }))}
            className="input-field text-sm" placeholder="Opcional"/>
        </Campo>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <NeonCheckbox checked={f.contado}
          label="Pago de contado (liquida el saldo)"
          onChange={e => setF(v => ({ ...v, contado: e.target.checked }))}/>
        <button type="submit" disabled={guardando} className="btn-primary text-sm py-2 ml-auto">
          <Plus size={14}/> {guardando ? 'Guardando…' : 'Registrar'}
        </button>
      </div>
    </form>
  )
}

function Campo({ label, className = '', children }) {
  return (
    <div className={className}>
      <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5"
        style={{ color: 'var(--t3)' }}>{label}</label>
      {children}
    </div>
  )
}
