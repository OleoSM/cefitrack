import { useState } from 'react'
import { UserPlus, X, Eye, EyeOff, Wand2, ShieldCheck, Shield, Check, Ban, AlertTriangle } from 'lucide-react'
import ModalPortal from '../ui/ModalPortal'
import { NeonCheckbox } from '../ui/NeonCheckbox'
import { crearPersonal } from '../../lib/supabaseData'
import { generarPassword } from '../../lib/credentials'
import { APARTADOS, APARTADOS_POR_DEFECTO, TODOS_LOS_APARTADOS } from '../../lib/apartados'

/**
 * Alta de personal (solo admin): administrador o sub-admin.
 * Pasos: datos → accesos → confirmar. Al sub-admin se le eligen los apartados
 * del panel que podrá abrir; el administrador los tiene todos por su rol.
 *
 * `correosUsados`: correos ya presentes en la lista, para avisar antes de enviar.
 * `onCreado(user, password)`: la cuenta existe; el padre muestra credenciales.
 */
export default function AltaPersonalModal({ correosUsados = [], onClose, onCreado }) {
  const [paso, setPaso] = useState('datos')   // datos | accesos | confirmar
  const [rol, setRol] = useState('sub_admin')
  const [nombre, setNombre] = useState('')
  const [correo, setCorreo] = useState('')
  const [password, setPassword] = useState(generarPassword)
  const [mostrar, setMostrar] = useState(false)
  const [apartados, setApartados] = useState(APARTADOS_POR_DEFECTO)
  const [error, setError] = useState('')
  const [creando, setCreando] = useState(false)

  const esAdmin = rol === 'admin'
  const permitidos = esAdmin ? TODOS_LOS_APARTADOS : apartados
  const si = APARTADOS.filter(a => permitidos.includes(a.clave))
  const no = APARTADOS.filter(a => !permitidos.includes(a.clave))

  const alternar = clave => setApartados(prev =>
    prev.includes(clave) ? prev.filter(c => c !== clave) : TODOS_LOS_APARTADOS.filter(c => c === clave || prev.includes(c)))

  const validarDatos = () => {
    setError('')
    const n = nombre.trim().replace(/\s+/g, ' ')
    const c = correo.trim().toLowerCase()
    if (n.length < 3) return setError('Escribe el nombre completo de la persona.')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(c)) return setError('Ese correo no es válido (ej. nombre@cefimat.mx).')
    if (correosUsados.includes(c)) return setError('Ese correo ya pertenece a una cuenta de la lista.')
    if (password.length < 6) return setError('La contraseña debe tener al menos 6 caracteres.')
    setNombre(n); setCorreo(c); setPaso('accesos')
  }

  const crear = async () => {
    setCreando(true); setError('')
    const res = await crearPersonal({ name: nombre, email: correo, password, role: rol, apartados })
    setCreando(false)
    if (!res.ok) { setError(res.message); setPaso('datos'); return }
    onCreado(res.user, password)
  }

  const TarjetaRol = ({ valor, Icono, titulo, texto }) => {
    const activo = rol === valor
    return (
      <button type="button" onClick={() => setRol(valor)} aria-pressed={activo}
        className="flex-1 text-left rounded-xl p-3 min-h-11 transition-colors"
        style={{
          background: activo ? 'var(--accent)' : 'var(--soft-bg)',
          color: activo ? 'var(--accent-contrast)' : 'var(--t1)',
          border: `1px solid ${activo ? 'var(--accent)' : 'var(--card-border)'}`,
        }}>
        <span className="flex items-center gap-2 text-sm font-bold"><Icono size={15}/> {titulo}</span>
        <span className="block text-[11px] mt-1" style={{ opacity: 0.85 }}>{texto}</span>
      </button>
    )
  }

  const Lista = ({ items, ok }) => (
    <ul className="space-y-1">
      {items.map(a => (
        <li key={a.clave} className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--t2)' }}>
          {ok ? <Check size={13} style={{ color: 'var(--good)' }}/> : <Ban size={13} style={{ color: 'var(--bad)' }}/>}
          {a.label}
        </li>
      ))}
      {items.length === 0 && <li className="text-xs" style={{ color: 'var(--t3)' }}>Ninguno</li>}
    </ul>
  )

  const pasos = ['datos', 'accesos', 'confirmar']

  return (
    <ModalPortal maxWidth="max-w-lg" onClose={() => !creando && onClose()}>
      <div className="flex items-center justify-between gap-3 px-5 py-3.5" style={{ borderBottom: '1px solid var(--divider)' }}>
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-bold" style={{ color: 'var(--t1)' }}>
            <UserPlus size={15} style={{ color: 'var(--accent)' }}/> Registrar personal
          </h2>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--t3)' }}>
            Paso {pasos.indexOf(paso) + 1} de 3 · {paso === 'datos' ? 'Datos de la cuenta' : paso === 'accesos' ? 'Qué puede ver' : 'Confirmar'}
          </p>
        </div>
        <button type="button" onClick={onClose} disabled={creando} aria-label="Cerrar"
          className="w-11 h-11 flex items-center justify-center rounded-lg" style={{ color: 'var(--t3)' }}><X size={15}/></button>
      </div>

      <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
        {paso === 'datos' && (
          <>
            <div className="flex flex-col sm:flex-row gap-2">
              <TarjetaRol valor="sub_admin" Icono={Shield} titulo="Sub-admin"
                texto="Ve solo sus sucursales o grupos y los apartados que elijas."/>
              <TarjetaRol valor="admin" Icono={ShieldCheck} titulo="Administrador"
                texto="Ve y controla todo, incluidas las cuentas."/>
            </div>
            <label className="block">
              <span className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--t3)' }}>Nombre completo</span>
              <input value={nombre} onChange={e => setNombre(e.target.value)} className="input-field w-full min-h-11" autoComplete="off"/>
            </label>
            <label className="block">
              <span className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--t3)' }}>Correo (con este entrará)</span>
              <input type="email" value={correo} onChange={e => setCorreo(e.target.value)} placeholder="nombre@cefimat.mx"
                className="input-field w-full min-h-11" autoComplete="off"/>
            </label>
            <div>
              <span className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--t3)' }}>Contraseña</span>
              <div className="flex gap-2">
                <input type={mostrar ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                  aria-label="Contraseña" autoComplete="new-password" className="input-field flex-1 min-h-11 font-mono"/>
                <button type="button" onClick={() => setMostrar(m => !m)} aria-label={mostrar ? 'Ocultar' : 'Mostrar'}
                  className="w-11 min-h-11 flex items-center justify-center rounded-xl flex-shrink-0"
                  style={{ background: 'var(--soft-bg)', border: '1px solid var(--card-border)', color: 'var(--t2)' }}>
                  {mostrar ? <EyeOff size={15}/> : <Eye size={15}/>}
                </button>
              </div>
              <button type="button" onClick={() => { setPassword(generarPassword()); setMostrar(true) }}
                className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold min-h-9 px-2 rounded-lg" style={{ color: 'var(--accent)' }}>
                <Wand2 size={13}/> Generar otra
              </button>
            </div>
          </>
        )}

        {paso === 'accesos' && (esAdmin ? (
          <>
            <div className="flex gap-3 p-3 rounded-xl" style={{ background: 'var(--warn-soft)', border: '1px solid var(--warn-line)' }}>
              <AlertTriangle size={18} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--warn)' }}/>
              <p className="text-xs" style={{ color: 'var(--t2)' }}>
                Un administrador tiene <b>acceso total</b> y no se le puede recortar: ve todas las sucursales,
                pagos y correos, y en Acceso y Disposición puede crear cuentas, ver contraseñas y decidir qué ve cada sub-admin.
              </p>
            </div>
            <div className="rounded-xl p-3" style={{ background: 'var(--soft-bg)', border: '1px solid var(--card-border)' }}>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--t3)' }}>Podrá ver</p>
              <Lista items={[{ clave: 'dashboard', label: 'Dashboard' }, ...APARTADOS, { clave: 'acceso', label: 'Acceso y Disposición' }]} ok/>
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs" style={{ color: 'var(--t2)' }}>Marca los apartados del panel que podrá abrir.</p>
              <div className="flex gap-1.5">
                {[['Todos', TODOS_LOS_APARTADOS], ['Los de siempre', APARTADOS_POR_DEFECTO], ['Ninguno', []]].map(([t, v]) => (
                  <button key={t} type="button" onClick={() => setApartados(v)}
                    className="text-[11px] font-semibold px-2.5 min-h-9 rounded-lg"
                    style={{ background: 'var(--soft-bg)', border: '1px solid var(--card-border)', color: 'var(--t2)' }}>{t}</button>
                ))}
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-1.5">
              {APARTADOS.map(a => (
                <div key={a.clave} className="rounded-lg px-2.5 py-1.5" style={{ background: 'var(--soft-bg)', border: '1px solid var(--card-border)' }}>
                  <NeonCheckbox checked={apartados.includes(a.clave)} onChange={() => alternar(a.clave)}
                    label={<span className="text-sm">{a.label}{a.sensible && <span className="text-[10px] font-bold ml-1.5" style={{ color: 'var(--warn)' }}>SENSIBLE</span>}</span>}/>
                  <p className="text-[11px] pl-7" style={{ color: 'var(--t3)' }}>{a.detalle}</p>
                </div>
              ))}
            </div>
            <ul className="text-[11px] space-y-1 rounded-xl p-3" style={{ background: 'var(--soft-bg)', color: 'var(--t3)' }}>
              <li>· El <b>Dashboard</b> lo ve siempre.</li>
              <li>· <b>Acceso y Disposición</b> nunca: es solo de administradores.</li>
              <li>· Además, solo verá los datos de las sucursales o grupos que le asignes en su tarjeta.</li>
            </ul>
          </>
        ))}

        {paso === 'confirmar' && (
          <>
            <div className="rounded-xl p-3 text-sm" style={{ background: 'var(--soft-bg)', border: '1px solid var(--card-border)', color: 'var(--t2)' }}>
              <p className="font-bold" style={{ color: 'var(--t1)' }}>{nombre}</p>
              <p className="text-xs">{correo} · {esAdmin ? 'Administrador' : 'Sub-admin'}</p>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="rounded-xl p-3" style={{ background: 'var(--good-soft)', border: '1px solid var(--good-line)' }}>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--good)' }}>Podrá ver</p>
                <Lista items={[{ clave: 'dashboard', label: 'Dashboard' }, ...si, ...(esAdmin ? [{ clave: 'acceso', label: 'Acceso y Disposición' }] : [])]} ok/>
              </div>
              <div className="rounded-xl p-3" style={{ background: 'var(--bad-soft)', border: '1px solid var(--bad-line)' }}>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--bad)' }}>No podrá ver</p>
                <Lista items={esAdmin ? [] : [...no, { clave: 'acceso', label: 'Acceso y Disposición' }]}/>
              </div>
            </div>
            <ul className="text-xs space-y-1" style={{ color: 'var(--t3)' }}>
              <li>· Al terminar verás su correo y contraseña para copiarlos y entregárselos.</li>
              {!esAdmin && <li>· Empieza sin sucursales: se las asignas en su tarjeta, que quedará resaltada.</li>}
              {!esAdmin && <li>· Podrás cambiar sus apartados cuando quieras desde su tarjeta.</li>}
            </ul>
          </>
        )}

        {error && <p role="alert" className="text-xs font-semibold" style={{ color: 'var(--bad)' }}>{error}</p>}
      </div>

      <div className="flex gap-3 px-5 py-3.5" style={{ borderTop: '1px solid var(--divider)' }}>
        {paso === 'datos' ? (
          <>
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center min-h-11">Cancelar</button>
            <button type="button" onClick={validarDatos} className="btn-primary flex-1 justify-center min-h-11">Continuar</button>
          </>
        ) : paso === 'accesos' ? (
          <>
            <button type="button" onClick={() => setPaso('datos')} className="btn-secondary flex-1 justify-center min-h-11">Volver</button>
            <button type="button" onClick={() => { setError(''); setPaso('confirmar') }} className="btn-primary flex-1 justify-center min-h-11">Continuar</button>
          </>
        ) : (
          <>
            <button type="button" onClick={() => setPaso('accesos')} disabled={creando} className="btn-secondary flex-1 justify-center min-h-11">Volver</button>
            <button type="button" onClick={crear} disabled={creando} className="btn-primary flex-1 justify-center min-h-11">
              {creando ? 'Creando…' : esAdmin ? 'Sí, crear administrador' : 'Sí, crear sub-admin'}
            </button>
          </>
        )}
      </div>
    </ModalPortal>
  )
}
