import { useMemo, useState } from 'react'
import { BellRing, Clock, FileText, GraduationCap, ClipboardList, ChevronDown, Mail, X, Users } from 'lucide-react'
import BarraFiltros from '../ui/BarraFiltros'
import ProgressiveList from '../ui/ProgressiveList'
import ConfirmDialog from './ConfirmDialog'

/*
 * Pestaña "Notificaciones" de Enviar correos: los avisos sugeridos, ordenados
 * por tipo (lo urgente primero) y, dentro de exámenes y actividades, por grupo.
 * Arriba, las fichas de tipo con su conteo y los filtros de sucursal, grupo y
 * búsqueda; así nada se despliega de golpe.
 */
const CATEGORIAS = [
  { id: 'vence',     label: 'Por vencer',           Icono: Clock,         ayuda: 'Materiales que se borran en menos de 3 días.', urgente: true },
  { id: 'material',  label: 'Materiales nuevos',    Icono: FileText,      ayuda: 'Materiales publicados en los últimos 7 días.' },
  { id: 'examen',    label: 'Exámenes',             Icono: GraduationCap, ayuda: 'Exámenes añadidos en los últimos 7 días.', porGrupo: true },
  { id: 'actividad', label: 'Actividades y tareas', Icono: ClipboardList, ayuda: 'Columnas nuevas de la hoja en los últimos 7 días.', porGrupo: true },
]
const fechaCorta = f => new Date(f).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
// En los exámenes la materia es «Exámenes»: repetirla junto a «Examen» sobra.
const tipoYMateria = s => s.materia === 'Exámenes' ? s.tipoTexto : `${s.tipoTexto} · ${s.materia}`
const normal = s => (s ?? '').toLocaleLowerCase('es-MX').normalize('NFD').replace(/\p{M}/gu, '')

export default function AvisosSugeridos({ sugerencias, groups, sucursal, setSucursal, opcionesSucursal, nombreDe, onEnviar, onDescartar }) {
  const [categoria, setCategoria] = useState('todas')
  const [grupo, setGrupo] = useState('')
  const [query, setQuery] = useState('')
  const [abiertos, setAbiertos] = useState({})
  const [confirmar, setConfirmar] = useState(null)   // { titulo, lista }
  const grupoDe = useMemo(() => Object.fromEntries(groups.map(g => [g.id, g])), [groups])

  // Filtros de sucursal (ya aplicado por la página), grupo y búsqueda; el tipo va aparte
  // para que cada ficha diga cuántos hay de lo suyo.
  const base = useMemo(() => {
    const q = normal(query.trim())
    return (sugerencias ?? []).filter(s =>
      (!grupo || s.groupIds?.includes(grupo))
      && (!q || normal(`${s.titulo} ${s.materia ?? ''} ${(s.groupIds ?? []).map(id => grupoDe[id]?.name).join(' ')}`).includes(q)))
  }, [sugerencias, grupo, query, grupoDe])
  const cuenta = id => base.filter(s => s.categoria === id).length

  const gruposConAvisos = useMemo(() => {
    const ids = new Set((sugerencias ?? []).flatMap(s => s.groupIds ?? []))
    return groups.filter(g => ids.has(g.id)).sort((a, b) => a.name.localeCompare(b.name, 'es'))
  }, [sugerencias, groups])

  const secciones = CATEGORIAS
    .filter(c => categoria === 'todas' || categoria === c.id)
    .map(c => ({ ...c, items: base.filter(s => s.categoria === c.id) }))
    .filter(c => c.items.length)

  const pedirDescarte = (titulo, lista) => lista.length === 1 ? onDescartar(lista) : setConfirmar({ titulo, lista })

  if (sugerencias === null) return <p className="card p-8 text-sm text-center" style={{ color: 'var(--t3)' }}>Buscando novedades…</p>

  return (
    <section className="space-y-4">
      <div>
        <h2 className="section-title flex items-center gap-2"><BellRing size={16}/> Avisos sugeridos</h2>
        <p className="text-xs mt-1" style={{ color: 'var(--t3)' }}>
          Lo nuevo de la hoja y de materiales que aún no se ha avisado. Envía el aviso o descártalo; ya no vuelve a aparecer.
        </p>
      </div>

      <BarraFiltros
        filtros={[
          ...(opcionesSucursal.length > 1 ? [{ id: 'sucursal', label: 'Sucursal', value: sucursal, onChange: v => { setSucursal(v); setGrupo('') },
            porDefecto: sucursal, options: opcionesSucursal }] : []),
          { id: 'grupo', label: 'Grupo', value: grupo, onChange: setGrupo, porDefecto: '',
            options: [{ value: '', label: 'Todos los grupos' }, ...gruposConAvisos.map(g => ({ value: g.id, label: `${g.name} · ${nombreDe(g.sucursal)}` }))] },
        ]}
        busqueda={{ value: query, onChange: setQuery, placeholder: 'Buscar actividad, material o grupo…' }}
        resumen={`${base.length} aviso(s)`}/>

      {/* Fichas de tipo */}
      <div role="tablist" aria-label="Tipo de aviso" className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {[{ id: 'todas', label: 'Todos', n: base.length }, ...CATEGORIAS.map(c => ({ ...c, n: cuenta(c.id) }))].map(c => {
          const activa = categoria === c.id
          return (
            <button key={c.id} type="button" role="tab" aria-selected={activa} onClick={() => setCategoria(c.id)}
              disabled={!c.n && c.id !== 'todas'}
              className="flex items-center gap-2 rounded-full px-3.5 min-h-10 text-sm font-semibold whitespace-nowrap flex-shrink-0 transition-colors disabled:opacity-40"
              style={activa
                ? { background: 'var(--accent)', color: 'var(--accent-contrast)', border: '1px solid var(--accent)' }
                : { background: 'var(--soft-bg)', color: 'var(--t1)', border: '1px solid var(--card-border)' }}>
              {c.Icono && <c.Icono size={14}/>} {c.label}
              <span className="text-[11px] font-bold tabular-nums opacity-80">{c.n}</span>
            </button>
          )
        })}
      </div>

      {secciones.length === 0 && (
        <p className="card p-8 text-sm text-center" style={{ color: 'var(--t3)' }}>
          {sugerencias.length ? 'Ningún aviso coincide con los filtros.' : 'No hay nada nuevo que avisar. Cuando crees una actividad o subas un material aparecerá aquí.'}
        </p>
      )}

      {secciones.map(sec => (
        <div key={sec.id} className="card p-4 sm:p-5 space-y-3 min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <span className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: sec.urgente ? 'var(--warn-soft)' : 'var(--soft-bg)', color: sec.urgente ? 'var(--warn)' : 'var(--accent)' }}>
              <sec.Icono size={17}/>
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--t1)' }}>
                {sec.label}
                <span className="text-[11px] font-bold tabular-nums px-2 py-0.5 rounded-full" style={{ background: 'var(--soft-bg)', color: 'var(--t2)' }}>{sec.items.length}</span>
              </h3>
              <p className="text-[11px]" style={{ color: 'var(--t3)' }}>{sec.ayuda}</p>
            </div>
            {sec.items.length > 1 && (
              <button type="button" className="btn-secondary text-xs min-h-10" onClick={() => pedirDescarte(sec.label.toLowerCase(), sec.items)}>
                Descartar {sec.items.length}
              </button>
            )}
          </div>

          {sec.porGrupo
            ? <PorGrupo items={sec.items} grupoDe={grupoDe} nombreDe={nombreDe} seccion={sec.id}
                abiertos={abiertos} setAbiertos={setAbiertos} onEnviar={onEnviar} onDescartar={onDescartar} pedirDescarte={pedirDescarte}/>
            : <ProgressiveList items={sec.items} className="space-y-2" sizes={{ mobile: 4, tablet: 6, desktop: 8 }}>
                {s => <FilaAviso key={s.clave} s={s} onEnviar={onEnviar} onDescartar={onDescartar}
                  meta={s.detalle}/>}
              </ProgressiveList>}
        </div>
      ))}

      {confirmar && (
        <ConfirmDialog
          title={`¿Descartar ${confirmar.lista.length} avisos?`}
          message={`Se descartan los avisos de ${confirmar.titulo} sin enviar nada. Dejan de aparecer en esta lista.`}
          confirmLabel="Sí, descartar" busyLabel="Descartando…"
          onConfirm={() => onDescartar(confirmar.lista)}
          onClose={() => setConfirmar(null)}/>
      )}
    </section>
  )
}

/* Exámenes y actividades: un bloque plegable por grupo, en orden alfabético. */
function PorGrupo({ items, grupoDe, nombreDe, seccion, abiertos, setAbiertos, onEnviar, onDescartar, pedirDescarte }) {
  const bloques = useMemo(() => {
    const por = {}
    for (const s of items) (por[s.groupId] ??= []).push(s)
    return Object.entries(por)
      .map(([gid, lista]) => ({ gid, g: grupoDe[gid], lista: lista.sort((a, b) => (a.materia ?? '').localeCompare(b.materia ?? '', 'es') || b.fecha.localeCompare(a.fecha)) }))
      .sort((a, b) => (a.g?.name ?? '').localeCompare(b.g?.name ?? '', 'es'))
  }, [items, grupoDe])
  // Pocos grupos: abiertos. Muchos: plegados, para leer la lista de grupos de un vistazo.
  const porDefecto = bloques.length <= 3

  return (
    <ProgressiveList items={bloques} className="space-y-2" sizes={{ mobile: 5, tablet: 8, desktop: 10 }}>
      {({ gid, g, lista }) => {
        const clave = `${seccion}:${gid}`
        const abierto = abiertos[clave] ?? porDefecto
        const alumnos = lista[0]?.alumnos.length ?? 0
        // Un solo aviso en el grupo: sin plegar, la fila ya dice todo.
        if (lista.length === 1) {
          const s = lista[0]
          return (
            <FilaAviso key={clave} s={s} onEnviar={onEnviar} onDescartar={onDescartar} icono
              titulo={<>{g?.name ?? 'Grupo'} <span className="font-normal" style={{ color: 'var(--t2)' }}>· {s.nombre}</span></>}
              meta={`${g ? nombreDe(g.sucursal) : ''} · ${tipoYMateria(s)} · creada el ${fechaCorta(s.fecha)} · ${alumnos} alumno(s)`}/>
          )
        }
        return (
          <div key={clave} className="rounded-xl min-w-0" style={{ border: '1px solid var(--divider)' }}>
            <div className="flex items-center gap-2 pr-2">
              <button type="button" aria-expanded={abierto} onClick={() => setAbiertos(v => ({ ...v, [clave]: !abierto }))}
                className="flex-1 min-w-0 flex items-center gap-3 px-3 min-h-12 text-left">
                <Users size={15} className="flex-shrink-0" style={{ color: 'var(--accent)' }}/>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold truncate" style={{ color: 'var(--t1)' }}>{g?.name ?? 'Grupo'}</span>
                  <span className="block text-[11px] truncate" style={{ color: 'var(--t3)' }}>
                    {g ? nombreDe(g.sucursal) : ''} · {alumnos} alumno(s) · {lista.length} aviso(s)
                  </span>
                </span>
                <ChevronDown size={16} className="flex-shrink-0 transition-transform" style={{ color: 'var(--t3)', transform: abierto ? 'rotate(180deg)' : 'none' }}/>
              </button>
              {lista.length > 1 && (
                <button type="button" className="btn-secondary text-xs min-h-9 flex-shrink-0" onClick={() => pedirDescarte(g?.name ?? 'este grupo', lista)}>
                  Descartar {lista.length}
                </button>
              )}
            </div>
            {abierto && (
              <div className="px-2 pb-2 space-y-1.5">
                {lista.map(s => (
                  <FilaAviso key={s.clave} s={s} onEnviar={onEnviar} onDescartar={onDescartar} plano
                    titulo={s.nombre} meta={`${tipoYMateria(s)} · creada el ${fechaCorta(s.fecha)}`}/>
                ))}
              </div>
            )}
          </div>
        )
      }}
    </ProgressiveList>
  )
}

function FilaAviso({ s, titulo, meta, onEnviar, onDescartar, plano = false, icono = false }) {
  const nombre = typeof titulo === 'string' ? titulo : s.titulo
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 rounded-lg px-3 py-2.5 min-w-0"
      style={plano ? { background: 'var(--soft-bg)' } : { border: '1px solid var(--divider)' }}>
      {icono && <Users size={15} className="hidden sm:block flex-shrink-0" style={{ color: 'var(--accent)' }}/>}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold break-words" style={{ color: 'var(--t1)' }}>{titulo ?? s.titulo}</p>
        <p className="text-[11px] mt-0.5" style={{ color: 'var(--t3)' }}>{meta}</p>
      </div>
      <div className="flex gap-2 flex-shrink-0">
        <button type="button" onClick={() => onDescartar([s])} aria-label={`Descartar ${nombre}`} title="Descartar"
          className="btn-secondary text-xs min-h-10 px-3 justify-center flex-1 sm:flex-none">
          <X size={13}/> <span className="sm:hidden">Descartar</span>
        </button>
        <button type="button" onClick={() => onEnviar(s)} className="btn-primary text-xs min-h-10 justify-center flex-1 sm:flex-none">
          <Mail size={13}/> Enviar aviso
        </button>
      </div>
    </div>
  )
}
