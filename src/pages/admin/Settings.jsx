import { useState, useEffect } from 'react'
import {
  SlidersHorizontal, Timer, Mail, Save, CheckCircle2,
  Scale, ClipboardList, CalendarCheck, Send, Palette,
} from 'lucide-react'
import { loadSettings, saveSettings, DEFAULT_SETTINGS, calcularScore } from '../../lib/settings'
import { sendNotification, NOTIF_EVENTS } from '../../lib/notifications'
import { fetchStudents } from '../../lib/supabaseData'
import { useAdminTheme } from '../../context/AdminThemeContext'
import { TOKENS } from '../../context/StudentThemeContext'
import AppearancePicker from '../../components/ui/AppearancePicker'

const PESO_FIELDS = [
  { id: 'examenes',   label: 'Exámenes',   icon: Scale,         desc: 'Promedio de evaluaciones y simulacros' },
  { id: 'tareas',     label: 'Tareas',     icon: ClipboardList, desc: 'Porcentaje de tareas entregadas' },
  { id: 'asistencia', label: 'Asistencia', icon: CalendarCheck, desc: 'Porcentaje de asistencia a clases' },
]

function Toggle({ checked, onChange }) {
  return (
    <button onClick={onChange} role="switch" aria-checked={checked}
      className="relative inline-flex w-10 h-[22px] rounded-full transition-colors duration-200 flex-shrink-0"
      style={{ background: checked ? 'var(--good)' : 'var(--t4)' }}>
      <span className="absolute top-[3px] left-[3px] w-4 h-4 rounded-full bg-white transition-transform duration-200"
        style={{ transform: checked ? 'translateX(18px)' : 'translateX(0)' }}/>
    </button>
  )
}

export default function Settings() {
  const [settings, setSettings] = useState(loadSettings)
  const [toast, setToast]       = useState(null)
  const [sampleStudent, setSampleStudent] = useState(null)
  const { appearance, setAppearance, t: adminT } = useAdminTheme()

  useEffect(() => {
    fetchStudents().then(s => setSampleStudent(s[0] ?? null)).catch(() => {})
  }, [])

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2600)
  }

  const sumPesos  = settings.pesos.examenes + settings.pesos.tareas + settings.pesos.asistencia
  const pesosOk   = sumPesos === 100

  const setPeso = (id, val) => {
    const n = Math.max(0, Math.min(100, parseInt(val, 10) || 0))
    setSettings(s => ({ ...s, pesos: { ...s.pesos, [id]: n } }))
  }

  const handleSave = () => {
    if (!pesosOk) return
    saveSettings(settings)
    showToast('Configuración guardada')
  }

  const handleTestNotif = () => {
    sendNotification('prueba', 'tutor@ejemplo.com', { alumno: 'Alumno de prueba' })
    showToast('Correo de prueba enviado a tutor@ejemplo.com (simulado)')
  }

  // Vista previa del score con la ponderación actual (primer alumno real como muestra)
  const sample = sampleStudent
  const sampleScore = sample ? calcularScore(sample, settings.pesos) : null

  return (
    <div className="space-y-5">

      <div>
        <h1 className="page-title">Configuración</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--t3)' }}>
          Parámetros generales de la plataforma.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">

      {/* ── Ponderación del ranking ─────────────────────────── */}
      <div className="card p-5 space-y-4 lg:col-span-2">
        <div className="flex items-center justify-between">
          <h2 className="section-title flex items-center gap-2">
            <SlidersHorizontal size={16}/> Ponderación del lugar en el grupo
          </h2>
          <span className="text-xs px-2.5 py-1 rounded-full font-bold tabular-nums"
            style={pesosOk
              ? { background:'var(--good-soft)', color:'var(--good)', border:'1px solid var(--good-line)' }
              : { background:'var(--bad-soft)',  color:'var(--bad)', border:'1px solid var(--bad-line)' }}>
            Suma: {sumPesos}%
          </span>
        </div>
        <p className="text-xs -mt-2" style={{ color: 'var(--t3)' }}>
          Define cómo se calcula la posición de cada alumno en el ranking. La suma debe ser 100%.
        </p>

        <div className="space-y-3">
          {PESO_FIELDS.map(({ id, label, icon: Icon, desc }) => (
            <div key={id} className="flex items-center gap-4 rounded-xl p-3"
              style={{ background: 'var(--card-bg)', border: '1px solid var(--divider)' }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'var(--soft-bg)', border: '1px solid var(--card-border)' }}>
                <Icon size={16} style={{ color: 'var(--t2)' }}/>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color: 'var(--t1)' }}>{label}</p>
                <p className="text-xs truncate" style={{ color: 'var(--t3)' }}>{desc}</p>
              </div>
              <input type="range" min="0" max="100" step="5" value={settings.pesos[id]}
                onChange={e => setPeso(id, e.target.value)}
                className="w-28 hidden sm:block accent-emerald-500"/>
              <div className="flex items-center gap-1">
                <input type="number" min="0" max="100" value={settings.pesos[id]}
                  onChange={e => setPeso(id, e.target.value)}
                  className="w-14 text-center text-sm font-bold rounded-lg py-1.5 outline-none tabular-nums"
                  style={{ background: 'var(--soft-bg)', border: '1px solid var(--card-border)', color: 'var(--t1)' }}/>
                <span className="text-xs" style={{ color: 'var(--t3)' }}>%</span>
              </div>
            </div>
          ))}
        </div>

        {sampleScore !== null && (
          <p className="text-xs" style={{ color: 'var(--t3)' }}>
            Vista previa — {sample.name}: promedio {sample.avgGrade ?? '—'}, tareas {sample.assignmentsDone ?? 0}/{sample.assignmentsTotal ?? 0},
            asistencia {sample.attendanceRate ?? 0}% → <strong style={{ color:'var(--good)' }}>score {sampleScore}</strong>
          </p>
        )}
      </div>

      {/* ── Pase de lista ───────────────────────────────────── */}
      <div className="card p-5 space-y-3">
        <h2 className="section-title flex items-center gap-2"><Timer size={16}/> Pase de lista</h2>
        <div className="flex items-center gap-4 rounded-xl p-3"
          style={{ background: 'var(--card-bg)', border: '1px solid var(--divider)' }}>
          <div className="flex-1">
            <p className="text-sm font-semibold" style={{ color: 'var(--t1)' }}>
              Tolerancia por defecto
            </p>
            <p className="text-xs" style={{ color: 'var(--t3)' }}>
              Minutos sugeridos en el pop-up al iniciar el pase de lista. Se puede ajustar en cada sesión.
            </p>
          </div>
          <div className="flex items-center gap-1">
            <input type="number" min="1" max="120" value={settings.toleranciaMin}
              onChange={e => setSettings(s => ({ ...s, toleranciaMin: Math.max(1, Math.min(120, parseInt(e.target.value, 10) || 1)) }))}
              className="w-16 text-center text-sm font-bold rounded-lg py-1.5 outline-none tabular-nums"
              style={{ background: 'var(--soft-bg)', border: '1px solid var(--card-border)', color: 'var(--t1)' }}/>
            <span className="text-xs" style={{ color: 'var(--t3)' }}>min</span>
          </div>
        </div>
      </div>

      {/* ── Notificaciones por correo ───────────────────────── */}
      <div className="card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="section-title flex items-center gap-2"><Mail size={16}/> Notificaciones por correo</h2>
          <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full"
            style={{ background:'var(--warn-soft)', color:'var(--warn)', border:'1px solid var(--warn-line)' }}>
            Envío simulado
          </span>
        </div>
        <p className="text-xs -mt-1" style={{ color: 'var(--t3)' }}>
          El envío real se activará al conectar el backend de correo. La configuración ya queda lista.
        </p>

        <div className="space-y-2.5">
          {NOTIF_EVENTS.map(ev => (
            <div key={ev.id} className="flex items-center gap-4 rounded-xl p-3"
              style={{ background: 'var(--card-bg)', border: '1px solid var(--divider)' }}>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color: 'var(--t1)' }}>{ev.label}</p>
                <p className="text-xs" style={{ color: 'var(--t3)' }}>{ev.desc}</p>
              </div>
              <Toggle checked={!!settings.notif[ev.id]}
                onChange={() => setSettings(s => ({ ...s, notif: { ...s.notif, [ev.id]: !s.notif[ev.id] } }))}/>
            </div>
          ))}
        </div>

        <button onClick={handleTestNotif}
          className="flex items-center gap-2 text-xs font-bold px-3 py-2 rounded-xl transition-all active:scale-95"
          style={{ background: 'var(--soft-bg)', border: '1px solid var(--card-border)', color: 'var(--t2)' }}
          onMouseEnter={e => e.currentTarget.style.background= 'var(--t4)'}
          onMouseLeave={e => e.currentTarget.style.background= 'var(--t2)'}>
          <Send size={12}/> Enviar correo de prueba
        </button>
      </div>

      {/* ── Marca ───────────────────────────────────────────── */}
      <div className="card p-5 space-y-3">
        <h2 className="section-title flex items-center gap-2"><Palette size={16}/> Marca</h2>
        <div className="flex items-center gap-4 rounded-xl p-3"
          style={{ background: 'var(--card-bg)', border: '1px solid var(--divider)' }}>
          <img src="/logo.jpeg" alt="Logo SIGA CEFIMAT"
            className="w-12 h-12 rounded-full object-cover flex-shrink-0"
            style={{ border:'1px solid rgba(255,255,255,.15)' }}
            onError={e => { e.currentTarget.style.display = 'none' }}/>
          <div className="flex-1">
            <p className="text-sm font-semibold" style={{ color: 'var(--t1)' }}>
              Nombre de la plataforma
            </p>
            <p className="text-xs" style={{ color: 'var(--t3)' }}>
              Aparece en el menú lateral, el login y los reportes.
            </p>
          </div>
          <input type="text" value={settings.platformName}
            onChange={e => setSettings(s => ({ ...s, platformName: e.target.value }))}
            placeholder={DEFAULT_SETTINGS.platformName}
            className="w-44 text-sm font-semibold rounded-lg py-2 px-3 outline-none"
            style={{ background: 'var(--soft-bg)', border: '1px solid var(--card-border)', color: 'var(--t1)' }}/>
        </div>
      </div>

      </div>

      {/* ── Identidad institucional (UNAM/IPN) ─────────────────── */}
      <AppearancePicker appearance={appearance} setAppearance={setAppearance} t={adminT} />

      {/* ── Guardar ─────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <button onClick={handleSave} disabled={!pesosOk}
          className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed">
          <Save size={14}/> Guardar configuración
        </button>
        {!pesosOk && (
          <p className="text-xs font-semibold" style={{ color:'var(--bad)' }}>
            La ponderación debe sumar exactamente 100%.
          </p>
        )}
      </div>

      {/* ── Toast ───────────────────────────────────────────── */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold animate-fade-in"
          style={{ background:'var(--panel-bg)', border:'1px solid var(--good-line)', color:'var(--good)', boxShadow:'0 12px 40px rgba(0,0,0,.6)' }}>
          <CheckCircle2 size={15}/> {toast}
        </div>
      )}
    </div>
  )
}
