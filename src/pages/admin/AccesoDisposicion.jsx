import { useState, useEffect, useCallback } from 'react'
import { Navigate } from 'react-router-dom'
import {
  UserPlus, ChevronDown, ChevronRight, Building2, KeyRound, X,
  UserMinus, UserCheck, AlertTriangle, RefreshCw, } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useSucursales } from '../../hooks/useSucursales'
import {
  fetchCuentas, fetchGroups, fetchApartadosPersonal, setApartadosPersonal,
  fetchSubAdminAccess, grantSubAdminAccess, revokeSubAdminAccess,
  desactivarSubAdmin, reactivarSubAdmin,
} from '../../lib/supabaseData'
import { APARTADOS, APARTADOS_POR_DEFECTO, etiquetaApartado } from '../../lib/apartados'
import ProgressiveList from '../../components/ui/ProgressiveList'
import { NeonCheckbox } from '../../components/ui/NeonCheckbox'
import ModalPortal from '../../components/ui/ModalPortal'
import { SkeletonBlock } from '../../components/ui/DataTable'
import { DANGER_BTN_STYLE } from '../../components/admin/ConfirmDialog'
import CredentialsPanel from '../../components/admin/CredentialsPanel'
import AccesoCuentaModal from '../../components/admin/AccesoCuentaModal'
import AltaPersonalModal from '../../components/admin/AltaPersonalModal'
import BarraFiltros from '../../components/ui/BarraFiltros'
import { useSucursalActiva, TODAS } from '../../hooks/useSucursalActiva'

// Las sucursales salen del catálogo oficial. Una sede sin grupos también debe
// aparecer para que se pueda conceder acceso antes de abrir su primer grupo.

export default function AccesoDisposicion() {
  const { sucursales: catalogoSucursales, nombreDe } = useSucursales()
  const { currentUser } = useAuth()
  const isAdmin = currentUser?.role === 'admin'

  const [staff, setStaff]             = useState([])
  const [groups, setGroups]           = useState([])
  const [accessByUser, setAccessByUser] = useState({})
  const [loading, setLoading]         = useState(true)
  const [expanded, setExpanded]       = useState(new Set())

  const sucursales = catalogoSucursales.map(s => s.id)

  const [altaAbierta, setAltaAbierta] = useState(false)
  const [apartadosByUser, setApartadosByUser] = useState({}) // { [userId]: { apartados, personalizado } }
  const [errorAcceso, setErrorAcceso] = useState(null)
  const [loadError, setLoadError]     = useState(null)

  /* Baja y reincorporación. Ninguna de las dos se ejecuta sin pasar por el
     modal: retirar a alguien le corta la sesión en el acto y le quita todos sus
     accesos, así que no puede ser el resultado de un clic mal puesto. */
  const [confirmacion, setConfirmacion] = useState(null) // { modo, id, name, email, accesos }
  const [procesando, setProcesando]     = useState(false)
  // Alta con confirmación, credenciales en ventana propia, confirmación al
  // quitar accesos, consulta de credenciales y bloqueo mientras se aplica.
  const [credNueva, setCredNueva]         = useState(null)  // { nombre, usuario, password }
  const [recienCreado, setRecienCreado]   = useState(null)  // id de la cuenta recién creada
  const [confirmAcceso, setConfirmAcceso] = useState(null)  // { titulo, detalle, ejecutar }
  const [verCred, setVerCred]             = useState(null)  // cuenta cuyo acceso se ve/edita
  const [ocupado, setOcupado]             = useState(null)  // id de la cuenta con un cambio en curso
  const [aviso, setAviso]               = useState(null) // { tono: 'good'|'bad', texto }

  /* La lista pasó de seis a treinta y ocho cuentas al incluir a los alumnos:
     sin acotar no hay forma de encontrar a nadie. */
  const [rolFiltro, setRolFiltro] = useState('todos')
  const [busqueda, setBusqueda] = useState('')
  const [grupoFiltro, setGrupoFiltro] = useState('todos')
  const [buscaGrupo, setBuscaGrupo] = useState('')
  const { sucursal: sucursalFiltro, setSucursal: setSucursalFiltro, opcionesConTodas } = useSucursalActiva()
  const gruposFiltrables = sucursalFiltro === TODAS
    ? groups
    : groups.filter(g => g.sucursal === sucursalFiltro)

  useEffect(() => {
    if (grupoFiltro !== 'todos' && !gruposFiltrables.some(g => g.id === grupoFiltro)) setGrupoFiltro('todos')
  }, [sucursalFiltro, grupoFiltro, gruposFiltrables])

  const conteo = {
    admin:     staff.filter(a => a.role === 'admin').length,
    sub_admin: staff.filter(a => a.role === 'sub_admin').length,
    student:   staff.filter(a => a.role === 'student').length,
    retiradas: staff.filter(a => a.activo === false).length,
  }
  const filtradas = staff.filter(a => {
    const q = busqueda.trim().toLowerCase()
    const porRol = rolFiltro === 'todos'
      || (rolFiltro === 'retiradas' ? a.activo === false : a.role === rolFiltro)
    return porRol
      && (sucursalFiltro === TODAS || a.sucursal === sucursalFiltro
          || (a.role === 'sub_admin' && (accessByUser[a.id] ?? []).some(x => x.sucursal === sucursalFiltro)))
      && (grupoFiltro === 'todos' || a.grupoId === grupoFiltro
          || (a.role === 'sub_admin' && (accessByUser[a.id] ?? []).some(x => x.groupId === grupoFiltro)))
      && (q === '' || a.name.toLowerCase().includes(q) || (a.email ?? '').toLowerCase().includes(q))
  })

  const refreshAccess = useCallback(async (userId) => {
    const rows = await fetchSubAdminAccess(userId)
    setAccessByUser(prev => ({ ...prev, [userId]: rows }))
  }, [])

  const loadAll = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const [personal, grps, aps] = await Promise.all([fetchCuentas(), fetchGroups(), fetchApartadosPersonal()])
      setStaff(personal)
      setGroups(grps)
      setApartadosByUser(aps)
      // Los administradores no tienen filas de acceso: su alcance es total por
      // rol. Las cuentas retiradas tampoco: la baja se las quitó todas.
      const entries = await Promise.all(
        personal.filter(a => a.role === 'sub_admin' && a.activo !== false)
          .map(a => fetchSubAdminAccess(a.id).then(rows => [a.id, rows])))
      setAccessByUser(Object.fromEntries(entries))
    } catch (err) {
      setLoadError(err?.message || 'No se pudieron cargar las cuentas.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { if (isAdmin) loadAll() }, [isAdmin, loadAll])

  // Tras crear un sub-admin (y cerrar la ventana de credenciales) se lleva la
  // vista a su tarjeta y se resalta unos segundos: ahí se le asignan accesos.
  useEffect(() => {
    if (!recienCreado || credNueva) return undefined
    const el = document.querySelector(`[data-cuenta="${recienCreado}"]`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    const t = setTimeout(() => setRecienCreado(null), 6000)
    return () => clearTimeout(t)
  }, [recienCreado, credNueva, staff])

  if (!isAdmin) return <Navigate to="/admin" replace />

  const toggleExpanded = (userId, sucursal) => {
    const key = `${userId}:${sucursal}`
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  const cuentaDe = id => staff.find(a => a.id === id)
  const nombreGrupo = id => { const g = groups.find(x => x.id === id); return g ? `${g.name} — ${g.subject}` : id }

  /* Aplica un cambio de acceso con un único cambio en curso a la vez (las
     casillas se bloquean mientras tanto: un doble clic ya no manda dos
     peticiones contradictorias) y deja un aviso de qué se hizo. */
  const aplicarAcceso = async (userId, fn, textoOk, textoError) => {
    setErrorAcceso(null); setAviso(null)
    setOcupado(userId)
    try {
      await fn()
      await refreshAccess(userId)
      setAviso({ tono: 'good', texto: textoOk })
    } catch (err) {
      setErrorAcceso(`${textoError} ${err?.message ?? ''}`)
    } finally { setOcupado(null) }
  }

  const toggleWholeBranch = (userId, sucursal) => {
    const rows = accessByUser[userId] ?? []
    const wholeRow = rows.find(r => r.sucursal === sucursal && r.groupId == null)
    const nombre = cuentaDe(userId)?.name ?? 'el sub-admin'
    if (wholeRow) {
      // Quitar acceso deja a alguien sin poder trabajar: se confirma.
      setConfirmAcceso({
        userId, nombre, titulo: `¿Quitar ${nombreDe(sucursal)} a ${nombre}?`,
        detalle: 'Dejará de ver los grupos, alumnos, listas y calificaciones de toda esta sucursal.',
        ejecutar: () => aplicarAcceso(userId, () => revokeSubAdminAccess(wholeRow.id),
          `Se quitó ${nombreDe(sucursal)} a ${nombre}.`, `No se pudo quitar el acceso a ${nombreDe(sucursal)}.`),
      })
      return
    }
    const perGroupRows = rows.filter(r => r.sucursal === sucursal && r.groupId != null)
    aplicarAcceso(userId, async () => {
      await Promise.all(perGroupRows.map(r => revokeSubAdminAccess(r.id)))
      await grantSubAdminAccess(userId, sucursal, null)
    }, `${nombre} ahora ve toda la sucursal ${nombreDe(sucursal)}.`, `No se pudo dar acceso a ${nombreDe(sucursal)}.`)
  }

  const toggleGroup = (userId, sucursal, groupId) => {
    const rows = accessByUser[userId] ?? []
    const wholeRow = rows.find(r => r.sucursal === sucursal && r.groupId == null)
    const groupRow = rows.find(r => r.sucursal === sucursal && r.groupId === groupId)
    const nombre = cuentaDe(userId)?.name ?? 'el sub-admin'
    if (groupRow) {
      setConfirmAcceso({
        userId, nombre, titulo: `¿Quitar el grupo ${nombreGrupo(groupId)} a ${nombre}?`,
        detalle: 'Dejará de ver a sus alumnos, sus listas y sus calificaciones.',
        ejecutar: () => aplicarAcceso(userId, () => revokeSubAdminAccess(groupRow.id),
          `Se quitó el grupo ${nombreGrupo(groupId)} a ${nombre}.`, 'No se pudo quitar el acceso al grupo.'),
      })
      return
    }
    if (wholeRow) {
      // Pasar de "toda la sucursal" a un solo grupo RECORTA acceso: se confirma.
      setConfirmAcceso({
        userId, nombre, titulo: `¿Limitar a ${nombre} a un solo grupo?`,
        detalle: `Hoy ve toda ${nombreDe(sucursal)}. Si sigues, solo verá ${nombreGrupo(groupId)} en esa sucursal.`,
        ejecutar: () => aplicarAcceso(userId, async () => {
          await revokeSubAdminAccess(wholeRow.id)
          await grantSubAdminAccess(userId, sucursal, groupId)
        }, `${nombre} ahora solo ve ${nombreGrupo(groupId)} en ${nombreDe(sucursal)}.`, 'No se pudo cambiar el acceso.'),
      })
      return
    }
    aplicarAcceso(userId, () => grantSubAdminAccess(userId, sucursal, groupId),
      `${nombre} ahora ve el grupo ${nombreGrupo(groupId)}.`, 'No se pudo dar acceso al grupo.')
  }

  const abrirCredenciales = (cuenta) => setVerCred(cuenta)

  /* ── Alta de personal (popup de 3 pasos) ── */
  const alCrear = async (user, password) => {
    setAltaAbierta(false)
    // Credenciales en ventana propia con botón de copiar.
    setCredNueva({ nombre: user.name, usuario: user.email, password })
    setRecienCreado(user.id)
    setAviso({ tono: 'good', texto: user.role === 'admin'
      ? `${user.name} ya puede entrar como administrador.`
      : `${user.name} ya puede entrar. Falta asignarle sucursal o grupos en su tarjeta (resaltada abajo).` })
    await loadAll()
  }

  /* ── Apartados del panel de un sub-admin ── */
  const apartadosDe = id => apartadosByUser[id]?.apartados ?? APARTADOS_POR_DEFECTO
  const guardarApartados = async (userId, lista, textoOk) => {
    setErrorAcceso(null); setAviso(null); setOcupado(userId)
    try {
      const nuevos = await setApartadosPersonal(userId, lista)
      setApartadosByUser(prev => ({ ...prev, [userId]: { apartados: nuevos, personalizado: true } }))
      setAviso({ tono: 'good', texto: textoOk })
    } catch (err) {
      setErrorAcceso(err?.message ?? 'No se pudieron guardar los apartados.')
    } finally { setOcupado(null) }
  }
  const toggleApartado = (userId, clave) => {
    const actuales = apartadosDe(userId)
    const nombre = cuentaDe(userId)?.name ?? 'el sub-admin'
    const etiqueta = etiquetaApartado(clave)
    if (actuales.includes(clave)) {
      setConfirmAcceso({
        userId, nombre, titulo: `¿Bloquear ${etiqueta} a ${nombre}?`,
        detalle: `Desaparecerá de su menú y no podrá abrirlo. Lo notará la próxima vez que vuelva a la pestaña o recargue.`,
        ejecutar: () => guardarApartados(userId, actuales.filter(c => c !== clave), `${nombre} ya no ve ${etiqueta}.`),
      })
      return
    }
    guardarApartados(userId, [...actuales, clave], `${nombre} ahora puede abrir ${etiqueta}.`)
  }

  /* ── Baja / reincorporación ───────────────────────────────────────────── */

  const pedirBaja = (cuenta) => {
    setAviso(null)
    setConfirmacion({
      modo: 'baja',
      id: cuenta.id, name: cuenta.name, email: cuenta.email,
      accesos: (accessByUser[cuenta.id] ?? []).length,
    })
  }

  const pedirAlta = (cuenta) => {
    setAviso(null)
    setConfirmacion({ modo: 'alta', id: cuenta.id, name: cuenta.name, email: cuenta.email })
  }

  const ejecutarConfirmacion = async () => {
    if (!confirmacion) return
    const { modo, id, name } = confirmacion
    setProcesando(true)
    const res = modo === 'baja'
      ? await desactivarSubAdmin(id)
      : await reactivarSubAdmin(id)
    setProcesando(false)
    setConfirmacion(null)

    if (!res.ok) { setAviso({ tono: 'bad', texto: res.message }); return }

    setAviso(modo === 'baja'
      ? {
          tono: 'good',
          texto: `${name} ya no puede entrar. Se le retiraron ${res.accesosRetirados} acceso(s) `
               + `y su correo quedó liberado como ${res.email}.`,
        }
      : {
          tono: 'good',
          texto: `${name} vuelve a entrar con ${res.email}. Sus accesos se conceden de nuevo aquí abajo.`,
        })
    await loadAll()
  }

  return (
    <div className="w-full space-y-5">

      <div>
        <h1 className="page-title">Acceso y Disposición</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--t3)' }}>
          Todas las cuentas con acceso a la plataforma. Los administradores ven todo, a los sub-admins se les asigna sucursal o grupos, y cada alumno ve solo lo suyo.
        </p>
      </div>

      {/* ── Registrar personal (solo admin) ── */}
      <div className="card p-5 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div>
          <h2 className="section-title flex items-center gap-2"><UserPlus size={16}/> Registrar personal</h2>
          <p className="text-xs mt-1" style={{ color: 'var(--t3)' }}>
            Da de alta a un administrador o a un sub-admin y elige qué apartados del panel podrá ver.
          </p>
        </div>
        <button type="button" onClick={() => setAltaAbierta(true)} className="btn-primary min-h-11 justify-center">
          <UserPlus size={14}/> Registrar admin o sub-admin
        </button>
      </div>

      {/* ── Lista de cuentas ────────────────────────────────── */}
      <div className="card p-5 space-y-3">
        <h2 className="section-title flex items-center gap-2"><Building2 size={16}/> Cuentas y accesos</h2>

        {errorAcceso && (
          <div className="flex items-start gap-2 rounded-lg px-3 py-2"
            style={{ background:'var(--bad-soft)', border:'1px solid var(--bad-line)' }}>
            <span className="text-xs" style={{ color:'var(--bad)' }}>{errorAcceso}</span>
          </div>
        )}

        {aviso && (
          <div className="flex items-start gap-2 rounded-lg px-3 py-2"
            style={{
              background: aviso.tono === 'good' ? 'var(--good-soft)' : 'var(--bad-soft)',
              border: `1px solid ${aviso.tono === 'good' ? 'var(--good-line)' : 'var(--bad-line)'}`,
            }}>
            <span className="text-xs flex-1"
              style={{ color: aviso.tono === 'good' ? 'var(--good)' : 'var(--bad)' }}>
              {aviso.texto}
            </span>
            <button onClick={() => setAviso(null)} aria-label="Cerrar aviso" className="w-8 h-8 -my-1 flex items-center justify-center rounded-lg" style={{ color:'var(--t3)' }}><X size={14}/></button>
          </div>
        )}

        {loadError && (
          <div role="alert" className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between rounded-xl p-3"
            style={{ background:'var(--bad-soft)', border:'1px solid var(--bad-line)' }}>
            <span className="text-sm" style={{ color:'var(--bad)' }}>{loadError}</span>
            <button onClick={loadAll} className="btn-secondary min-h-11 justify-center"><RefreshCw size={14}/> Reintentar</button>
          </div>
        )}

        <BarraFiltros
          filtros={[
            { id:'rol', label:'Tipo de cuenta', value:rolFiltro, onChange:setRolFiltro, porDefecto:'todos',
              options:[
                { value:'todos', label:`Todos (${staff.length})` },
                { value:'admin', label:`Administradores (${conteo.admin})` },
                { value:'sub_admin', label:`Sub-admins (${conteo.sub_admin})` },
                { value:'student', label:`Alumnos (${conteo.student})` },
                { value:'retiradas', label:`Retiradas (${conteo.retiradas})` },
              ] },
            { id:'sucursal', label:'Sucursal', value:sucursalFiltro, onChange:setSucursalFiltro,
              porDefecto:sucursalFiltro, options:opcionesConTodas },
            { id:'grupo', label:'Grupo', tipo:'grupo', value:grupoFiltro, onChange:setGrupoFiltro,
              porDefecto:'todos', grupos:gruposFiltrables, query:buscaGrupo, onQuery:setBuscaGrupo,
              nombreDe },
          ]}
          busqueda={{ value: busqueda, onChange: setBusqueda, placeholder:'Buscar por nombre o correo…' }}
          resumen={`${filtradas.length} de ${staff.length}`}/>

        {loading ? (
          <div className="space-y-3" role="status" aria-label="Cargando cuentas">
            {[0,1,2].map(i => <SkeletonBlock key={i} className="h-24"/>)}
          </div>
        ) :         <ProgressiveList items={filtradas} className="space-y-3"
          sizes={{ mobile: 5, tablet: 10, desktop: 15 }}
          emptyLabel="Ninguna cuenta coincide con el filtro.">
          {a => {
            const rows = accessByUser[a.id] ?? []
            const esAdmin = a.role === 'admin'
            const esAlumno = a.role === 'student'
            const retirada = a.activo === false
            return (
              <div key={a.id} data-cuenta={a.id} className="rounded-xl p-3.5 space-y-2.5 transition-shadow"
                style={{
                  background: 'var(--card-bg)',
                  border: recienCreado === a.id ? '2px solid var(--accent)' : '1px solid var(--card-border)',
                  boxShadow: recienCreado === a.id ? '0 0 0 4px var(--soft-bg), var(--card-shadow)' : 'var(--card-shadow)',
                  opacity: retirada ? 0.72 : 1,
                }}>
                {recienCreado === a.id && (
                  <p className="text-[11px] font-bold" style={{ color: 'var(--accent)' }}>
                    Cuenta recién creada · asígnale sucursal o grupos aquí abajo
                  </p>
                )}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--t1)' }}>{a.name}</p>
                    <p className="text-xs truncate" style={{ color: 'var(--t3)' }}>{a.email}</p>
                  </div>
                  <span className="badge flex-shrink-0"
                    style={retirada
                      ? { background:'var(--soft-bg)', color:'var(--t3)', border:'1px solid var(--divider)' }
                      : esAdmin
                        ? { background:'var(--good-solid)', color:'#fff', border:'1px solid var(--good-solid)' }
                        : esAlumno
                          ? { background:'var(--soft-bg)', color:'var(--t2)', border:'1px solid var(--divider)' }
                          : { background:'var(--info-solid)', color:'#fff', border:'1px solid var(--info-solid)' }}>
                    {retirada ? 'Retirada' : esAdmin ? 'Administrador' : esAlumno ? 'Alumno' : 'Sub-admin'}
                  </span>
                </div>

                {/* Una cuenta retirada no se esconde: se muestra tal cual quedó,
                    para que conste quién fue dado de baja y se pueda deshacer. */}
                {retirada ? (
                  <div className="space-y-2.5">
                    <p className="text-xs" style={{ color: 'var(--t3)' }}>
                      Sin acceso a la plataforma. No puede iniciar sesión y sus sucursales y
                      grupos le fueron retirados. Su correo original quedó libre para volver
                      a darse de alta.
                    </p>
                    <button onClick={() => pedirAlta(a)}
                      className="btn-secondary text-xs py-2 w-full sm:w-auto justify-center">
                      <UserCheck size={13}/> Reincorporar
                    </button>
                  </div>
                ) : esAdmin ? (
                  /* El alcance del administrador viene de su rol, no de filas de
                     acceso: mostrarle casillas sugeriría que se le puede recortar. */
                  <div>
                    <p className="text-xs" style={{ color: 'var(--t3)' }}>
                      Acceso total a todas las sucursales y grupos.
                    </p>
                    <button type="button" onClick={() => abrirCredenciales(a)}
                      className="btn-secondary text-xs py-2 mt-2.5 justify-center w-full sm:w-auto">
                      <KeyRound size={13}/> {a.id === currentUser?.id ? 'Ver y editar mi acceso' : 'Ver acceso'}
                    </button>
                  </div>
                ) : esAlumno ? (
                  /* El alumno sólo ve lo suyo: no hay nada que conceder ni
                     recortar, así que se muestra a qué grupo pertenece. */
                  <div>
                  <p className="text-xs" style={{ color: 'var(--t3)' }}>
                    {a.grupoNombre
                      ? <>Grupo <strong style={{ color:'var(--t2)' }}>{a.grupoNombre}</strong>
                          {a.sucursal ? ` · ${nombreDe(a.sucursal)}` : ''} · sólo ve su propia información.</>
                      : 'Sin grupo asignado.'}
                  </p>
                    <button type="button" onClick={() => abrirCredenciales(a)}
                      className="btn-secondary text-xs py-2 mt-2.5 justify-center w-full sm:w-auto">
                      <KeyRound size={13}/> Ver y editar acceso
                    </button></div>
                ) : (
                <div className="space-y-1.5">
                  {sucursales.map(suc => {
                    const wholeChecked = rows.some(r => r.sucursal === suc && r.groupId == null)
                    const groupRows = rows.filter(r => r.sucursal === suc && r.groupId != null)
                    const sucGroups = groups.filter(g => g.sucursal === suc)
                    const key = `${a.id}:${suc}`
                    const isExpanded = expanded.has(key)
                    return (
                      <div key={suc} className="rounded-lg overflow-hidden"
                        style={{ background: 'var(--card-bg)', border: '1px solid var(--divider)' }}>
                        <div className="flex items-center gap-2.5 px-3 py-2">
                          <button onClick={() => toggleExpanded(a.id, suc)} aria-label={isExpanded ? 'Plegar grupos' : 'Ver grupos'}
                            className="w-8 h-8 flex items-center justify-center rounded-lg" style={{ color: 'var(--t3)' }}>
                            {isExpanded ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
                          </button>
                          <NeonCheckbox className="flex-1"
                            checked={wholeChecked}
                            disabled={ocupado === a.id}
                            onChange={() => toggleWholeBranch(a.id, suc)}
                            label={<>
                              {nombreDe(suc)}
                              {wholeChecked && <span className="text-xs font-normal" style={{ color:'var(--good)' }}> · toda la sucursal</span>}
                              {!wholeChecked && groupRows.length > 0 && (
                                <span className="text-xs font-normal" style={{ color:'var(--warn)' }}> · {groupRows.length} grupo(s)</span>
                              )}
                            </>}/>
                        </div>
                        {isExpanded && (
                          <div className="px-3 pb-2.5 pl-9 space-y-1.5">
                            {sucGroups.length === 0 && (
                              <p className="text-xs" style={{ color: 'var(--t3)' }}>Sin grupos en esta sucursal.</p>
                            )}
                            {sucGroups.map(g => {
                              const checked = wholeChecked || groupRows.some(r => r.groupId === g.id)
                              return (
                                <NeonCheckbox key={g.id}
                                  checked={checked}
                                  disabled={ocupado === a.id}
                                  onChange={() => toggleGroup(a.id, suc, g.id)}
                                  label={<span className="text-xs font-normal">{g.name} — {g.subject}</span>}/>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}

                  <div className="rounded-lg px-3 py-2.5 space-y-2" style={{ background: 'var(--card-bg)', border: '1px solid var(--divider)' }}>
                    <div className="flex flex-wrap items-baseline justify-between gap-1">
                      <p className="text-xs font-bold" style={{ color: 'var(--t1)' }}>Apartados que puede ver</p>
                      <p className="text-[11px]" style={{ color: 'var(--t3)' }}>
                        {apartadosDe(a.id).length} de {APARTADOS.length}{apartadosByUser[a.id]?.personalizado ? '' : ' · los de siempre'}
                      </p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-x-3 gap-y-1">
                      {APARTADOS.map(ap => (
                        <NeonCheckbox key={ap.clave}
                          checked={apartadosDe(a.id).includes(ap.clave)}
                          disabled={ocupado === a.id}
                          onChange={() => toggleApartado(a.id, ap.clave)}
                          label={<span className="text-xs font-normal">{ap.label}{ap.sensible && <span className="text-[10px] font-bold ml-1" style={{ color: 'var(--warn)' }}>SENSIBLE</span>}</span>}/>
                      ))}
                    </div>
                  </div>

                  {ocupado === a.id && (
                    <p className="text-[11px] font-semibold" role="status" style={{ color: 'var(--t3)' }}>Aplicando cambio…</p>
                  )}
                  <div className="flex flex-col sm:flex-row gap-2 pt-1">
                    <button type="button" onClick={() => abrirCredenciales(a)}
                      className="btn-secondary text-xs py-2 justify-center">
                      <KeyRound size={13}/> Ver y editar acceso
                    </button>
                    {/* La baja va al final y en tono de peligro: es la única
                        acción de esta tarjeta que no se deshace con otro clic. */}
                    <button type="button" onClick={() => pedirBaja(a)}
                      className="flex items-center justify-center gap-2 text-xs font-bold px-3 py-2 rounded-xl sm:ml-auto"
                      style={DANGER_BTN_STYLE}>
                      <UserMinus size={13}/> Dar de baja
                    </button>
                  </div>
                </div>
                )}
              </div>
            )
          }}
        </ProgressiveList>}
      </div>

      {/* ── Confirmación ───────────────────────────────────── */}
      {confirmacion && (
        <ModalPortal maxWidth="max-w-sm" onClose={() => !procesando && setConfirmacion(null)}>
          <div className="p-6 space-y-4">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center mx-auto"
              style={confirmacion.modo === 'baja'
                ? { background:'var(--bad-soft)', border:'1px solid var(--bad-line)' }
                : { background:'var(--good-soft)', border:'1px solid var(--good-line)' }}>
              {confirmacion.modo === 'baja'
                ? <AlertTriangle size={20} style={{ color:'var(--bad)' }}/>
                : <UserCheck size={20} style={{ color:'var(--good)' }}/>}
            </div>

            <div className="text-center">
              <h2 className="text-base font-bold mb-1" style={{ color: 'var(--t1)' }}>
                {confirmacion.modo === 'baja' ? '¿Dar de baja a este sub-admin?' : '¿Reincorporar esta cuenta?'}
              </h2>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--t2)' }}>
                <strong style={{ color: 'var(--t1)' }}>{confirmacion.name}</strong>
                {' — '}{confirmacion.email}
              </p>
            </div>

            <ul className="text-xs space-y-1.5 rounded-xl p-3" style={{ background:'var(--soft-bg)', color:'var(--t2)' }}>
              {confirmacion.modo === 'baja' ? <>
                <li>· Deja de poder iniciar sesión de inmediato y se cierra su sesión abierta.</li>
                <li>· Se le retiran sus {confirmacion.accesos} acceso(s) de sucursal o grupo.</li>
                <li>· Su correo queda libre para darlo de alta de nuevo.</li>
                <li>· La cuenta no se borra: seguirá aquí como retirada y podrás reincorporarla.</li>
              </> : <>
                <li>· Vuelve a poder iniciar sesión con su correo y contraseña originales.</li>
                <li>· Sus accesos NO regresan: hay que concedérselos otra vez.</li>
              </>}
            </ul>

            <div className="flex gap-3">
              <button onClick={() => setConfirmacion(null)} disabled={procesando}
                className="btn-secondary flex-1 justify-center disabled:opacity-40">
                Cancelar
              </button>
              <button onClick={ejecutarConfirmacion} disabled={procesando}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-40"
                style={confirmacion.modo === 'baja'
                  ? DANGER_BTN_STYLE
                  : { background:'var(--good-soft)', border:'1px solid var(--good-line)', color:'var(--good)' }}>
                {procesando
                  ? 'Aplicando…'
                  : confirmacion.modo === 'baja' ? 'Sí, dar de baja' : 'Sí, reincorporar'}
              </button>
            </div>
          </div>
        </ModalPortal>
      )}

      {altaAbierta && (
        <AltaPersonalModal correosUsados={staff.map(a => (a.email ?? '').toLowerCase())}
          onClose={() => setAltaAbierta(false)} onCreado={alCrear}/>
      )}

      {/* ── Credenciales recién generadas (con copiar) ── */}
      {credNueva && <CredentialsPanel cred={credNueva} onClose={() => setCredNueva(null)}/>}

      {/* ── Confirmar recorte de acceso ── */}
      {confirmAcceso && (
        <ModalPortal maxWidth="max-w-sm" onClose={() => setConfirmAcceso(null)}>
          <div className="p-6 space-y-4">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center mx-auto"
              style={{ background:'var(--warn-soft)', border:'1px solid var(--warn-line)' }}>
              <AlertTriangle size={20} style={{ color:'var(--warn)' }}/>
            </div>
            <div className="text-center">
              <h2 className="text-base font-bold mb-1" style={{ color:'var(--t1)' }}>{confirmAcceso.titulo}</h2>
              <p className="text-sm" style={{ color:'var(--t2)' }}>{confirmAcceso.detalle}</p>
              <p className="text-xs mt-2" style={{ color:'var(--t3)' }}>Puedes volver a darle acceso cuando quieras.</p>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setConfirmAcceso(null)} className="btn-secondary flex-1 justify-center">Cancelar</button>
              <button type="button" onClick={() => { const c = confirmAcceso; setConfirmAcceso(null); c.ejecutar() }}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold" style={DANGER_BTN_STYLE}>
                Sí, quitar
              </button>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* ── Ver / editar el acceso de cualquier cuenta ── */}
      {verCred && (
        <AccesoCuentaModal cuenta={verCred} esPropia={verCred.id === currentUser?.id}
          onClose={() => setVerCred(null)} onGuardado={loadAll}/>
      )}
    </div>
  )
}
