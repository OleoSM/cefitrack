import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import {
  Mail, Phone, Calendar,
  FileText, QrCode, ClipboardList, RefreshCw, Users,
} from 'lucide-react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import {
  getStatusConfig, attendanceColors, getAttendanceColor, getSimulacrosByStudent,
} from '../../data/mockData'
import {
  fetchStudentById, fetchGroupById, fetchEvaluationsByStudent, fetchStudentAttendance,
  saveEvaluation, fetchNombresColumnas, setCeldaRegistro,
} from '../../lib/supabaseData'
import { exportStudentReport } from '../../lib/exportReports'
import ProgressiveList from '../../components/ui/ProgressiveList'
import { SkeletonBlock } from '../../components/ui/DataTable'
import DetalleEvaluacion from '../../components/ui/DetalleEvaluacion'
import ListaEvaluaciones from '../../components/ui/ListaEvaluaciones'
import { useAdminTheme } from '../../context/AdminThemeContext'
import KpiCard, { KpiGrid } from '../../components/ui/KpiCard'
import {
  IconPromedio, IconAsistencia, IconRetardos, IconFaltas, IconRanking,
} from '../../components/ui/SigaKpiIcons'
import { useGroupColors } from '../../hooks/useGroupColors'
import ResetPasswordModal from '../../components/admin/ResetPasswordModal'
import AvatarAlumno from '../../components/ui/AvatarAlumno'
import ConfirmDialog from '../../components/admin/ConfirmDialog'
import { quitarFoto } from '../../lib/fotosPerfil'
import { IconResumen, IconHojaCalificaciones, IconPasarLista, IconReporte, IconQrAlumno, IconCuenta } from '../../components/ui/SigaAdminIcons'
import CredentialsPanel from '../../components/admin/CredentialsPanel'

/* Secciones del perfil. Antes eran cinco pestañas apretadas en una sola
   píldora; ahora cada una es una tarjeta con su descripción, para que se
   entienda qué hay dentro antes de abrirla. */
const TABS = [
  { id:'resumen',      label:'Resumen',      icon:IconResumen, desc:'Gráficas y estado general' },
  { id:'evaluaciones', label:'Evaluaciones', icon:IconHojaCalificaciones, desc:'Todas sus calificaciones' },
  { id:'asistencias',  label:'Asistencias',  icon:IconPasarLista, desc:'Presentes, retardos y faltas' },
  { id:'reportes',     label:'Reportes',     icon:IconReporte, desc:'Avance para el tutor' },
  { id:'qr',           label:'Código QR',    icon:IconQrAlumno, desc:'Su código de asistencia' },
]

const PIE_COLORS = ['var(--good)','var(--warn)','var(--bad)','var(--info)']

/* ── Shared primitives ─────────────────────────────────────────── */
const Sub  = ({ children, className='' }) => (
  <p className={`text-[10px] font-bold uppercase tracking-widest mb-1.5 ${className}`}
    style={{ color:'var(--t3)' }}>{children}</p>
)
const Val  = ({ children, className='' }) => (
  <p className={`text-sm font-semibold truncate ${className}`}
    style={{ color:'var(--t1)' }}>{children}</p>
)

export default function StudentProfile() {
  const { studentId } = useParams()
  const { getAccent } = useGroupColors()
  const [tab, setTab] = useState('resumen')

  /* ── Tira de pestañas deslizable ──────────────────────────────
     Con el tabindex móvil del patrón WAI-ARIA el tabulador entra una sola
     vez a la tira y son las flechas las que mueven entre pestañas: hay que
     implementarlas o el teclado se queda sin poder cambiar de sección. */
  const tabsRef = useRef(null)

  const irAPestana = id => {
    setTab(id)
    // El navegador desplazaría el carril por su cuenta al enfocar; lo hace
    // el efecto de abajo, que además respeta el margen de la píldora.
    tabsRef.current?.querySelector(`[data-tab="${id}"]`)?.focus({ preventScroll:true })
  }

  const onTabKeyDown = e => {
    const ids = TABS.map(t => t.id)
    const i = ids.indexOf(tab)
    const salto = { ArrowRight: 1, ArrowLeft: -1 }[e.key]
    if (salto !== undefined) {
      e.preventDefault()
      irAPestana(ids[(i + salto + ids.length) % ids.length])
    } else if (e.key === 'Home') {
      e.preventDefault(); irAPestana(ids[0])
    } else if (e.key === 'End') {
      e.preventDefault(); irAPestana(ids[ids.length - 1])
    }
  }

  /* Trae la pestaña activa al carril cuando queda fuera de vista. Mueve sólo
     el scroll del contenedor —no `scrollIntoView`— para que la página nunca
     dé un salto vertical al cambiar de sección en móvil. */
  useEffect(() => {
    const carril = tabsRef.current
    const activa = carril?.querySelector(`[data-tab="${tab}"]`)
    if (!carril || !activa) return
    const c = carril.getBoundingClientRect()
    const a = activa.getBoundingClientRect()
    const aire = 8
    if (a.left < c.left + aire) {
      carril.scrollBy({ left: a.left - c.left - aire, behavior:'smooth' })
    } else if (a.right > c.right - aire) {
      carril.scrollBy({ left: a.right - c.right + aire, behavior:'smooth' })
    }
  }, [tab])

  /* Alumno, grupo, calificaciones y asistencia vienen de la BD.
     Antes se leían de mockData, cuyos ids s1–s20 chocaban con los reales:
     un alumno existente mostraba el perfil de otra persona, y los ids
     superiores a s20 daban "Alumno no encontrado". */
  const [s, setS]         = useState(null)
  const [grp, setGrp]     = useState(null)
  const [evals, setEvals] = useState([])
  const [att, setAtt]     = useState([])
  const [cargando, setCargando] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [reload, setReload] = useState(0)
  // Botón "Cuenta": usuario y contraseña vigentes (los consulta el servidor,
  // que solo se los da al admin o al sub-admin del grupo).
  const [cuentaAbierta, setCuentaAbierta] = useState(false)
  const [credNueva, setCredNueva] = useState(null)
  // Detalle de una calificación (asignación completa) y nombres de las
  // columnas de la hoja ("Tarea 3") para titular cada fila.
  const [detalle, setDetalle] = useState(null)
  const [nombresColumnas, setNombresColumnas] = useState({})
  // Quitar la foto de perfil si no es adecuada (son fotos de menores).
  const [quitarFotoOpen, setQuitarFotoOpen] = useState(false)
  const navigate = useNavigate()
  const { t: tAdmin } = useAdminTheme()
  useEffect(() => {
    let vivo = true
    fetchNombresColumnas(evals.map(e => e.columnaId)).then(m => { if (vivo) setNombresColumnas(m) }).catch(() => {})
    return () => { vivo = false }
  }, [evals])

  useEffect(() => {
    let vivo = true
    setCargando(true)
    setLoadError(null)
    ;(async () => {
      try {
        const alumno = await fetchStudentById(studentId)
        if (!vivo) return
        setS(alumno)
        if (alumno) {
          const [g, ev, as] = await Promise.all([
            fetchGroupById(alumno.groupId),
            fetchEvaluationsByStudent(studentId),
            fetchStudentAttendance(studentId, alumno.groupId),
          ])
          if (!vivo) return
          setGrp(g); setEvals(ev); setAtt(as)
        }
      } catch (err) {
        if (vivo) setLoadError(err?.message || 'No se pudo cargar el alumno.')
      }
      finally { if (vivo) setCargando(false) }
    })()
    return () => { vivo = false }
  }, [studentId, reload])

  /* Guarda una calificación editada en la BD y recarga el historial. */
  const guardarCalificacion = useCallback(async (e, n) => {
    /* Si la calificación sale de una columna de la hoja, se guarda por el
       mismo camino que la hoja (set_valor_registro): actualiza la CELDA
       (registro_valores) y la evaluación a la vez. Antes se escribía solo en
       `evaluations`: el promedio cambiaba pero la hoja seguía mostrando el
       valor viejo, porque la hoja lee sus celdas. */
    let res
    if (e.columnaId) {
      try { await setCeldaRegistro(studentId, e.columnaId, n); res = { ok: true } }
      catch (err) {
        res = { ok: false, message: (err?.message ?? '').includes('forbidden')
          ? 'No tienes permiso para corregir calificaciones de este grupo.'
          : 'No se pudo guardar la calificación.' }
      }
    } else {
      res = await saveEvaluation({
        id: e.id, studentId, materia: e.materia, tipo: e.tipo,
        calificacion: n, calMax: e.calMax, fecha: e.fecha, periodo: e.periodo,
      })
    }
    if (res.ok) {
      try { setEvals(await fetchEvaluationsByStudent(studentId)) } catch { /* se queda la lista anterior */ }
    }
    return res
  }, [studentId])

  if (cargando) return (
    <div className="w-full space-y-4" role="status" aria-label="Cargando alumno">
      <SkeletonBlock className="h-44"/>
      <SkeletonBlock className="h-11 sm:w-96"/>
      <SkeletonBlock className="h-64"/>
    </div>
  )
  if (loadError) return (
    <div role="alert" className="card p-5 flex flex-col sm:flex-row sm:items-center gap-3 justify-between"
      style={{ background:'var(--bad-soft)', borderColor:'var(--bad-line)' }}>
      <span className="text-sm" style={{ color:'var(--bad)' }}>{loadError}</span>
      <button onClick={() => setReload(r => r + 1)} className="btn-secondary min-h-11 justify-center">
        <RefreshCw size={14}/> Reintentar
      </button>
    </div>
  )
  if (!s) return (
    <div className="card p-8 text-center">
      <p className="text-sm" style={{ color:'var(--t3)' }}>Este alumno no existe o fue eliminado.</p>
    </div>
  )

  const cfg   = getStatusConfig(s.status)
  const accent = getAccent(s.groupId)

  /* Sin "justificado": el criterio del centro es tardanza o inasistencia, y
     tres tardanzas hacen una inasistencia. Una cuarta categoría que no cambia
     ese cálculo sólo repartía la gráfica en un trozo que nadie usaba. */
  const attCounts = {
    presente: att.filter(a => a.status === 'presente').length,
    tardanza: att.filter(a => a.status === 'tardanza').length,
    ausente:  att.filter(a => a.status !== 'presente' && a.status !== 'tardanza').length,
  }
  const attPie = Object.entries(attCounts).map(([k, v]) => ({
    name: attendanceColors[k].label, value: v,
  }))

  // Porcentaje real: presentes + tardanzas sobre las sesiones del grupo.
  const asistenciaPct = att.length
    ? Math.round(((attCounts.presente + attCounts.tardanza) / att.length) * 100)
    : null


  /* Reporte de aprovechamiento hasta el momento — para el tutor */
  const handleExportReport = () => exportStudentReport({
    student: s,
    group: grp,
    evals,
    attendance: att,
    sims: getSimulacrosByStudent(s.id),
  })

  return (
    <div className="w-full space-y-5">

      {/* ── Cabecera del perfil ──────────────────────────────────────
          Orden por importancia: quién es (identidad) → qué puedo hacer con él
          (acciones, cada una con su descripción) → cómo va (indicadores).
          Antes la única acción vivía escondida en la tarjeta del tutor. */}
      <div className="card p-4 sm:p-5 space-y-4">
        <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">

          {/* Identidad */}
          <div className="flex gap-4 flex-1 min-w-0">
            {/* Foto que se tomó en Mi QR, o su avatar, o sus iniciales sobre el
                color del grupo. Si la foto no es adecuada, se puede quitar. */}
            <div className="flex flex-col items-center gap-1 flex-shrink-0">
              <AvatarAlumno student={s} size={null} accent={accent} redondez="rounded-2xl"
                className="w-16 h-16 sm:w-[72px] sm:h-[72px] text-xl"/>
              {s.fotoPath && (
                <button type="button" onClick={() => setQuitarFotoOpen(true)}
                  className="text-[10px] font-semibold min-h-8 px-1.5 rounded-lg" style={{ color:'var(--bad)' }}>
                  Quitar foto
                </button>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start gap-2 flex-wrap">
                <h1 className="text-xl font-bold tracking-tight min-w-0" style={{ color:'var(--t1)' }}>
                  {s.name}
                </h1>
                <span className={`badge ${cfg.bg} ${cfg.color} border ${cfg.border} mt-1`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`}/>{cfg.label}
                </span>
              </div>
              <p className="text-sm mt-0.5" style={{ color:'var(--t2)' }}>
                {[grp?.name, grp?.subject].filter(Boolean).join(' — ') || 'Sin grupo asignado'}
              </p>
              {/* Un correo institucional largo no parte por sí solo: se trunca
                  con el texto completo en el título. */}
              <p className="flex items-center gap-1.5 mt-2 text-sm min-w-0" style={{ color:'var(--t3)' }} title={s.email}>
                <Mail size={13} className="flex-shrink-0"/>
                <span className="truncate">{s.email}</span>
              </p>
            </div>
          </div>

          {/* Acciones, cada una con su peso: la cuenta primero (es lo que más
              se pide en ventanilla: "¿cuál es mi contraseña?"). */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2 lg:w-72 flex-shrink-0">
            <button type="button" onClick={() => setCuentaAbierta(true)}
              className="w-full flex items-center gap-3 p-3 rounded-xl text-left"
              style={{ background:'var(--accent)', color:'var(--accent-contrast)' }}
              title="Ver el usuario y la contraseña con los que entra el alumno">
              <span className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background:'rgba(255,255,255,.18)' }}>
                <IconCuenta size={19}/>
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-bold">Cuenta</span>
                <span className="block text-[11px] opacity-85">Ver su usuario y contraseña</span>
              </span>
            </button>
            <button type="button" onClick={handleExportReport}
              className="w-full flex items-center gap-3 p-3 rounded-xl text-left"
              style={{ background:'var(--soft-bg)', border:'1px solid var(--card-border)', color:'var(--t1)' }}
              title="Descarga el aprovechamiento del alumno hasta el momento para compartirlo con el tutor">
              <span className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-white" style={{ background:'var(--good-solid)' }}>
                <IconReporte size={18}/>
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-bold">Reporte de avance</span>
                <span className="block text-[11px]" style={{ color:'var(--t3)' }}>PDF para compartir con el tutor</span>
              </span>
            </button>
          </div>
        </div>

        {/* Indicadores rápidos: superficie, para no competir con la
            cabecera; el color va en la ficha del icono. */}
        <div className="pt-4" style={{ borderTop:'1px solid var(--divider)' }}>
              <KpiGrid cols={4}>
                <KpiCard variant="surface" icon={IconPromedio} label="Promedio"
                  tone={s.avgGrade == null ? 'neutral' : s.avgGrade >= 8 ? 'good' : s.avgGrade >= 7 ? 'info' : 'bad'}
                  value={s.avgGrade ?? '—'}/>
                {/* La asistencia se calcula de las sesiones reales ya cargadas;
                    students.attendance_rate quedó obsoleto y venía en null. */}
                <KpiCard variant="surface" icon={IconAsistencia} label="Asistencia"
                  tone={asistenciaPct === null ? 'neutral' : asistenciaPct >= 85 ? 'good' : asistenciaPct >= 75 ? 'warn' : 'bad'}
                  value={asistenciaPct === null ? '—' : `${asistenciaPct}%`}/>
                <KpiCard variant="surface" icon={ClipboardList} label="Tareas"
                  tone={s.assignmentsTotal ? 'info' : 'neutral'}
                  value={s.assignmentsTotal ? `${s.assignmentsDone}/${s.assignmentsTotal}` : '—'}/>
                <KpiCard variant="surface" icon={IconRanking} label="Ranking"
                  tone={s.rank ? 'warn' : 'neutral'} value={s.rank ? `#${s.rank}` : '—'}/>
              </KpiGrid>
        </div>
      </div>

      {/* ── Contacto del tutor ── en su propia tarjeta, horizontal. */}
      <div className="card p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background:'var(--soft-bg)', border:'1px solid var(--card-border)', color:'var(--t2)' }}>
            <Users size={18}/>
          </span>
          <div className="min-w-0">
            <Sub>Contacto del tutor</Sub>
            {/* Cada dato se muestra sólo si existe. */}
            <Val>{s.tutor?.name || 'Sin tutor registrado'}</Val>
          </div>
        </div>
        {(s.tutor?.email || s.tutor?.phone) && (
          <div className="flex flex-wrap gap-2 sm:ml-auto">
            {s.tutor?.email && (
              <a href={`mailto:${s.tutor.email}`} className="inline-flex items-center gap-1.5 min-h-10 px-3 rounded-xl text-xs font-semibold max-w-full"
                style={{ background:'var(--soft-bg)', border:'1px solid var(--card-border)', color:'var(--t2)' }} title={`Escribir a ${s.tutor.email}`}>
                <Mail size={13} className="flex-shrink-0"/><span className="truncate">{s.tutor.email}</span>
              </a>
            )}
            {s.tutor?.phone && (
              <a href={`tel:${s.tutor.phone}`} className="inline-flex items-center gap-1.5 min-h-10 px-3 rounded-xl text-xs font-semibold"
                style={{ background:'var(--soft-bg)', border:'1px solid var(--card-border)', color:'var(--t2)' }} title={`Llamar a ${s.tutor.phone}`}>
                <Phone size={13}/>{s.tutor.phone}
              </a>
            )}
          </div>
        )}
      </div>

      {/* ── Secciones ──────────────────────────────────────────────────
          Antes: cinco pestañas en una sola píldora con scroll. Ahora una
          rejilla de tarjetas, cada una con icono y qué contiene. Teclado:
          flechas ← → entre secciones (patrón WAI-ARIA de pestañas). */}
      <div ref={tabsRef} role="tablist" aria-label="Secciones del alumno"
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {TABS.map(t => {
          const activa = tab === t.id
          return (
            <button key={t.id} type="button" onClick={() => setTab(t.id)}
              data-tab={t.id} id={`pestana-${t.id}`} aria-controls="panel-alumno"
              role="tab" aria-selected={activa} tabIndex={activa ? 0 : -1}
              onKeyDown={onTabKeyDown}
              className="w-full flex items-center gap-2.5 p-2.5 sm:p-3 rounded-xl text-left min-h-14"
              style={activa
                ? { background:'var(--card-bg)', border:'2px solid var(--accent)', boxShadow:'var(--card-shadow)' }
                : { background:'var(--card-bg)', border:'1px solid var(--card-border)' }}>
              <span className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                style={activa ? { background:'var(--accent)', color:'var(--accent-contrast)' } : { background:'var(--soft-bg)', color:'var(--t2)' }}>
                <t.icon size={17}/>
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-bold truncate" style={{ color:'var(--t1)' }}>{t.label}</span>
                <span className="hidden sm:block text-[11px] truncate" style={{ color:'var(--t3)' }}>{t.desc}</span>
              </span>
            </button>
          )
        })}
      </div>

      {/* Un solo panel para las seis secciones: como sólo se pinta la activa,
          basta con que se anuncie etiquetado por la pestaña en curso. */}
      {/* `min-w-0`: el panel es hijo de un contenedor en flujo normal, pero sus
          nietos (rejillas y tablas) sí necesitan poder encoger. Sin esto una
          tabla ancha empujaba el ancho del panel y aparecía la barra horizontal
          de la página entera en vez de la del propio bloque. */}
      <div id="panel-alumno" role="tabpanel" aria-labelledby={`pestana-${tab}`} className="min-w-0">

      {/* ══════════════════════════════════════════════════════════
          TAB: RESUMEN
      ══════════════════════════════════════════════════════════ */}
      {tab === 'resumen' && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 min-w-0">

          {/* `min-w-0` en cada tarjeta con gráfica: Recharts mide el hueco y
              escribe un ancho en píxeles en el <svg>, así que la aportación de
              contenido mínimo de la celda se queda anclada al ancho anterior y
              la rejilla no vuelve a encoger al girar el teléfono. */}
          <div className="card p-5 min-w-0">
            <h3 className="section-title mb-4">Competencias</h3>
            {/* No hay fuente real de competencias todavía. Antes se leía un
                mock indexado por id que mostraba datos de otra persona. */}
            <div className="h-48 flex items-center justify-center text-sm"
              style={{ color:'var(--t3)' }}>Sin datos todavía</div>
          </div>

          <div className="card p-5 min-w-0 xl:col-span-2">
            <h3 className="section-title mb-4">Evolución de Calificaciones</h3>
            <div className="h-48 flex items-center justify-center text-sm"
              style={{ color:'var(--t3)' }}>Sin datos todavía</div>
          </div>

          <div className="card p-5 min-w-0">
            <h3 className="section-title mb-4">Asistencia General</h3>
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={attPie} cx="50%" cy="50%" innerRadius={40} outerRadius={65}
                  dataKey="value" stroke="none">
                  {attPie.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]}/>)}
                </Pie>
                <Tooltip contentStyle={{ fontSize:11, borderRadius:10, background:'var(--tooltip-bg)', border:'1px solid var(--tooltip-border)', color:'var(--tooltip-text)' }}/>
              </PieChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-2 gap-1.5 mt-2">
              {attPie.map((d, i) => (
                <div key={d.name} className="flex items-center gap-1.5 text-xs min-w-0">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: PIE_COLORS[i] }}/>
                  <span className="truncate" style={{ color:'var(--t2)' }}>
                    {d.name}: <strong style={{ color:'var(--t1)' }}>{d.value}</strong>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          TAB: EVALUACIONES
      ══════════════════════════════════════════════════════════ */}
      {tab === 'evaluaciones' && (
        <section className="card p-4 sm:p-5 space-y-3">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div>
              <h3 className="section-title">Historial de evaluaciones</h3>
              <p className="text-xs mt-0.5" style={{ color:'var(--t3)' }}>
                Toca una calificación para ver la asignación completa o corregirla.
              </p>
            </div>
            {evals.length > 0 && (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background:'var(--soft-bg)', color:'var(--t2)', border:'1px solid var(--card-border)' }}>
                {evals.length} registrada{evals.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <ListaEvaluaciones evaluaciones={evals} nombresColumnas={nombresColumnas}
            light={tAdmin.light} onAbrir={setDetalle}/>
        </section>
      )}

      {/* ══════════════════════════════════════════════════════════
          TAB: ASISTENCIAS
      ══════════════════════════════════════════════════════════ */}
      {tab === 'asistencias' && (
        <div className="space-y-4">
          {/* Conteo por estado. Relleno mate —color pleno y opaco del token,
              sin alfa ni degradado— con el texto y el icono en blanco. Antes
              usaba las clases neón de `attendanceColors`, que en IPN y UNAM
              (página blanca) se veían fuera de registro. Ojo: ese mapa sigue
              alimentando la lista de sesiones de abajo y otras pantallas, por
              eso se deja intacto y aquí sólo se toma la etiqueta. */}
          <KpiGrid cols={4}>
            {[
              { k:'presente', tone:'good', icon:IconAsistencia },
              { k:'tardanza', tone:'warn', icon:IconRetardos },
              { k:'ausente',  tone:'bad',  icon:IconFaltas },
            ].map(({ k, tone, icon }) => (
              <KpiCard key={k} icon={icon} tone={tone}
                label={attendanceColors[k].label} value={attCounts[k]}
                sub={att.length ? `${Math.round((attCounts[k] / att.length) * 100)}% del total` : 'Sin sesiones'}/>
            ))}
            <KpiCard icon={Calendar} tone="info" label="Sesiones" value={att.length}
              sub={asistenciaPct === null ? 'Sin sesiones' : `${asistenciaPct}% asistió`}/>
          </KpiGrid>

          <div className="card overflow-hidden">
            <div className="px-5 py-3"
              style={{ borderBottom:'1px solid var(--divider)', background:'var(--soft-bg)' }}>
              <h3 className="section-title">Registro de asistencias</h3>
            </div>
            <div className="max-h-96 overflow-y-auto p-2 sm:p-0">
              <ProgressiveList className="divide-y" items={att}
                sizes={{ mobile: 8, tablet: 14, desktop: 24 }}
                emptyLabel="Todavía no hay sesiones registradas para este alumno.">
              {a => {
                const c = getAttendanceColor(a.status)
                return (
                  <div key={a.id}
                    className="flex items-center justify-between gap-2 px-4 sm:px-5 py-2.5 transition-colors"
                    onMouseEnter={e => e.currentTarget.style.background='var(--soft-bg)'}
                    onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                    {/* La fecha cede el ancho y la etiqueta de estado no: al
                        revés, "Justificado" se partía en dos líneas y la fila
                        crecía al doble de alto. */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${c.bg}`}>
                        <span className={`w-2 h-2 rounded-full ${c.dot}`}/>
                      </div>
                      <span className="text-sm truncate" style={{ color:'var(--t1)' }}>
                        {new Date(a.date + 'T12:00').toLocaleDateString('es-MX', {
                          weekday:'short', day:'numeric', month:'short',
                        })}
                      </span>
                    </div>
                    <span className={`badge flex-shrink-0 whitespace-nowrap ${c.bg} ${c.text} border ${c.border}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`}/>{c.label}
                    </span>
                  </div>
                )
              }}
              </ProgressiveList>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          TAB: REPORTES
      ══════════════════════════════════════════════════════════ */}
      {tab === 'reportes' && (
        /* Los reportes mensuales salían de un mock indexado por id (datos de
           otra persona). Hasta que exista la tabla, no se inventan. */
        <div className="card p-8 text-center" style={{ color:'var(--t3)' }}>
          <FileText size={36} className="mx-auto mb-2 opacity-40"/>
          <p className="text-sm">Sin datos todavía. Los reportes mensuales aún no se generan.</p>
          <p className="text-xs mt-1">Usa «Reporte de avance» en la cabecera para descargar el aprovechamiento actual.</p>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          TAB: CÓDIGO QR
      ══════════════════════════════════════════════════════════ */}
      {tab === 'qr' && (
        <div className="flex flex-col items-center gap-5 py-4 max-w-sm mx-auto">
          <div className="card p-6 w-full flex flex-col items-center">
            <div className="flex items-center gap-2 mb-5 self-start">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background:'var(--soft-bg)', border:'1px solid var(--card-border)' }}>
                <QrCode size={16} style={{ color:'var(--t2)' }}/>
              </div>
              <span className="font-bold text-sm" style={{ color:'var(--t1)' }}>
                Código QR de asistencia
              </span>
            </div>

            {/* El QR va sobre blanco en las tres identidades: es lo que lee el
                escáner, no decoración. */}
            <div className="p-4 rounded-2xl" style={{ background:'#ffffff', boxShadow:'var(--card-shadow)', border:'1px solid var(--card-border)' }}>
              <QRCodeSVG
                value={`EDUTRACK:${s.id}`}
                size={230}
                level="H"
                fgColor="#0f172a"
                bgColor="#ffffff"
              />
            </div>

            <div className="mt-5 text-center">
              <p className="text-lg font-bold" style={{ color:'var(--t1)' }}>{s.name}</p>
              <p className="text-sm mt-0.5" style={{ color:'var(--t3)' }}>
                {grp?.name} — {grp?.subject}
              </p>
              <code className="text-[11px] font-mono block mt-2" style={{ color:'var(--t3)' }}>
                ID {s.id}
              </code>
            </div>
          </div>

          <div className="card p-4 w-full"
            style={{ background:'var(--soft-bg)' }}>
            <p className="text-xs text-center leading-relaxed" style={{ color:'var(--t2)' }}>
              El alumno puede mostrar este código desde su portal en{' '}
              <span className="font-semibold" style={{ color:'var(--t1)' }}>Mi Código QR</span>.
              Usa el escáner en{' '}
              <span className="font-semibold" style={{ color:'var(--t1)' }}>Pasar Lista</span>{' '}
              para registrar su asistencia.
            </p>
          </div>
        </div>
      )}

      </div>

      {cuentaAbierta && (
        <ResetPasswordModal
          student={s}
          onClose={() => setCuentaAbierta(false)}
          onDone={cred => { setCuentaAbierta(false); setCredNueva(cred) }}/>
      )}
      {credNueva && <CredentialsPanel cred={credNueva} onClose={() => setCredNueva(null)}/>}
      {quitarFotoOpen && (
        <ConfirmDialog
          title="¿Quitar la foto de este alumno?"
          message={`Se borra la foto de perfil de ${s.name}. Volverá a aparecer con su avatar o sus iniciales y podrá tomarse otra desde Mi QR.`}
          confirmLabel="Sí, quitar foto" busyLabel="Quitando…"
          onConfirm={async () => { await quitarFoto(s.id); setS(x => x && ({ ...x, fotoPath: null })) }}
          onClose={() => setQuitarFotoOpen(false)}/>
      )}
      {detalle && (
        <DetalleEvaluacion evaluacion={detalle} grupo={grp?.name} light={tAdmin.light}
          onClose={() => setDetalle(null)}
          onGuardar={async n => {
            const res = await guardarCalificacion(detalle, n)
            if (res?.ok) setDetalle(d => ({ ...d, calificacion: n }))
            return res
          }}
          onAbrirHoja={() => navigate('/admin/registrar', {
            state: { groupId: s.groupId, columnaId: detalle.columnaId, studentId: s.id },
          })}/>
      )}
    </div>
  )
}
