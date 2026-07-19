import { useState } from 'react'
import {
  SlidersHorizontal, Timer, Mail, Save, CheckCircle2,
  Scale, ClipboardList, CalendarCheck, Send, Palette,
} from 'lucide-react'
import { loadSettings, saveSettings, DEFAULT_SETTINGS, calcularScore } from '../../lib/settings'
import { sendNotification, NOTIF_EVENTS } from '../../lib/notifications'
import { students } from '../../data/mockData'
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
      style={{ background: checked ? '#10b981' : 'rgba(255,255,255,.13)' }}>
      <span className="absolute top-[3px] left-[3px] w-4 h-4 rounded-full bg-white transition-transform duration-200"
        style={{ transform: checked ? 'translateX(18px)' : 'translateX(0)' }}/>
    </button>
  )
}

export default function Settings() {
  const [settings, setSettings] = useState(loadSettings)
  const [toast, setToast]       = useState(null)
  const { appearance, setAppearance, t: adminT } = useAdminTheme()

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

  // Vista previa del score con la ponderación actual (primer alumno como muestra)
  const sample = students[0]
  const sampleScore = sample ? calcularScore(sample, settings.pesos) : null

  return (
    <div className="max-w-3xl space-y-5">

      <div>
        <h1 className="page-title">Configuración</h1>
        <p className="text-sm mt-1" style={{ color:'rgba(255,255,255,.38)' }}>
          Parámetros generales de la plataforma.
        </p>
      </div>

      {/* ── Ponderación del ranking ─────────────────────────── */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="section-title flex items-center gap-2">
            <SlidersHorizontal size={16}/> Ponderación del lugar en el grupo
          </h2>
          <span className="text-xs px-2.5 py-1 rounded-full font-bold tabular-nums"
            style={pesosOk
              ? { background:'rgba(16,185,129,.14)', color:'#10b981', border:'1px solid rgba(16,185,129,.28)' }
              : { background:'rgba(239,68,68,.14)',  color:'#f87171', border:'1px solid rgba(239,68,68,.28)' }}>
            Suma: {sumPesos}%
          </span>
        </div>
        <p className="text-xs -mt-2" style={{ color:'rgba(255,255,255,.35)' }}>
          Define cómo se calcula la posición de cada alumno en el ranking. La suma debe ser 100%.
        </p>

        <div className="space-y-3">
          {PESO_FIELDS.map(({ id, label, icon: Icon, desc }) => (
            <div key={id} className="flex items-center gap-4 rounded-xl p-3"
              style={{ background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.07)' }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background:'rgba(255,255,255,.07)', border:'1px solid rgba(255,255,255,.10)' }}>
                <Icon size={16} style={{ color:'rgba(255,255,255,.55)' }}/>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color:'rgba(255,255,255,.85)' }}>{label}</p>
                <p className="text-xs truncate" style={{ color:'rgba(255,255,255,.35)' }}>{desc}</p>
              </div>
              <input type="range" min="0" max="100" step="5" value={settings.pesos[id]}
                onChange={e => setPeso(id, e.target.value)}
                className="w-28 hidden sm:block accent-emerald-500"/>
              <div className="flex items-center gap-1">
                <input type="number" min="0" max="100" value={settings.pesos[id]}
                  onChange={e => setPeso(id, e.target.value)}
                  className="w-14 text-center text-sm font-bold rounded-lg py-1.5 outline-none tabular-nums"
                  style={{ background:'rgba(255,255,255,.07)', border:'1px solid rgba(255,255,255,.12)', color:'rgba(255,255,255,.90)' }}/>
                <span className="text-xs" style={{ color:'rgba(255,255,255,.35)' }}>%</span>
              </div>
            </div>
          ))}
        </div>

        {sampleScore !== null && (
          <p className="text-xs" style={{ color:'rgba(255,255,255,.35)' }}>
            Vista previa — {sample.name}: promedio {sample.avgGrade}, tareas {sample.assignmentsDone}/{sample.assignmentsTotal},
            asistencia {sample.attendanceRate}% → <strong style={{ color:'#10b981' }}>score {sampleScore}</strong>
          </p>
        )}
      </div>

      {/* ── Pase de lista ───────────────────────────────────── */}
      <div className="card p-5 space-y-3">
        <h2 className="section-title flex items-center gap-2"><Timer size={16}/> Pase de lista</h2>
        <div className="flex items-center gap-4 rounded-xl p-3"
          style={{ background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.07)' }}>
          <div className="flex-1">
            <p className="text-sm font-semibold" style={{ color:'rgba(255,255,255,.85)' }}>
              Tolerancia por defecto
            </p>
            <p className="text-xs" style={{ color:'rgba(255,255,255,.35)' }}>
              Minutos sugeridos en el pop-up al iniciar el pase de lista. Se puede ajustar en cada sesión.
            </p>
          </div>
          <div className="flex items-center gap-1">
            <input type="number" min="1" max="120" value={settings.toleranciaMin}
              onChange={e => setSettings(s => ({ ...s, toleranciaMin: Math.max(1, Math.min(120, parseInt(e.target.value, 10) || 1)) }))}
              className="w-16 text-center text-sm font-bold rounded-lg py-1.5 outline-none tabular-nums"
              style={{ background:'rgba(255,255,255,.07)', border:'1px solid rgba(255,255,255,.12)', color:'rgba(255,255,255,.90)' }}/>
            <span className="text-xs" style={{ color:'rgba(255,255,255,.35)' }}>min</span>
          </div>
        </div>
      </div>

      {/* ── Notificaciones por correo ───────────────────────── */}
      <div className="card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="section-title flex items-center gap-2"><Mail size={16}/> Notificaciones por correo</h2>
          <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full"
            style={{ background:'rgba(251,191,36,.12)', color:'#fbbf24', border:'1px solid rgba(251,191,36,.25)' }}>
            Envío simulado
          </span>
        </div>
        <p className="text-xs -mt-1" style={{ color:'rgba(255,255,255,.35)' }}>
          El envío real se activará al conectar el backend de correo. La configuración ya queda lista.
        </p>

        <div className="space-y-2.5">
          {NOTIF_EVENTS.map(ev => (
            <div key={ev.id} className="flex items-center gap-4 rounded-xl p-3"
              style={{ background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.07)' }}>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color:'rgba(255,255,255,.85)' }}>{ev.label}</p>
                <p className="text-xs" style={{ color:'rgba(255,255,255,.35)' }}>{ev.desc}</p>
              </div>
              <Toggle checked={!!settings.notif[ev.id]}
                onChange={() => setSettings(s => ({ ...s, notif: { ...s.notif, [ev.id]: !s.notif[ev.id] } }))}/>
            </div>
          ))}
        </div>

        <button onClick={handleTestNotif}
          className="flex items-center gap-2 text-xs font-bold px-3 py-2 rounded-xl transition-all active:scale-95"
          style={{ background:'rgba(255,255,255,.07)', border:'1px solid rgba(255,255,255,.12)', color:'rgba(255,255,255,.70)' }}
          onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,.12)'}
          onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,.07)'}>
          <Send size={12}/> Enviar correo de prueba
        </button>
      </div>

      {/* ── Marca ───────────────────────────────────────────── */}
      <div className="card p-5 space-y-3">
        <h2 className="section-title flex items-center gap-2"><Palette size={16}/> Marca</h2>
        <div className="flex items-center gap-4 rounded-xl p-3"
          style={{ background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.07)' }}>
          <img src="/logo.jpeg" alt="Logo SIGA CEFIMAT"
            className="w-12 h-12 rounded-full object-cover flex-shrink-0"
            style={{ border:'1px solid rgba(255,255,255,.15)' }}
            onError={e => { e.currentTarget.style.display = 'none' }}/>
          <div className="flex-1">
            <p className="text-sm font-semibold" style={{ color:'rgba(255,255,255,.85)' }}>
              Nombre de la plataforma
            </p>
            <p className="text-xs" style={{ color:'rgba(255,255,255,.35)' }}>
              Aparece en el menú lateral, el login y los reportes.
            </p>
          </div>
          <input type="text" value={settings.platformName}
            onChange={e => setSettings(s => ({ ...s, platformName: e.target.value }))}
            placeholder={DEFAULT_SETTINGS.platformName}
            className="w-44 text-sm font-semibold rounded-lg py-2 px-3 outline-none"
            style={{ background:'rgba(255,255,255,.07)', border:'1px solid rgba(255,255,255,.12)', color:'rgba(255,255,255,.90)' }}/>
        </div>
      </div>

      {/* ── Identidad institucional (UNAM/IPN) ─────────────────── */}
      <AppearancePicker appearance={appearance} setAppearance={setAppearance} t={adminT} />

      {/* ── Guardar ─────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <button onClick={handleSave} disabled={!pesosOk}
          className="flex items-center gap-2 text-sm font-bold px-5 py-2.5 rounded-xl transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background:'white', color:'black' }}>
          <Save size={14}/> Guardar configuración
        </button>
        {!pesosOk && (
          <p className="text-xs font-semibold" style={{ color:'#f87171' }}>
            La ponderación debe sumar exactamente 100%.
          </p>
        )}
      </div>

      {/* ── Toast ───────────────────────────────────────────── */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold animate-fade-in"
          style={{ background:'#0f1020', border:'1px solid rgba(16,185,129,.35)', color:'#10b981', boxShadow:'0 12px 40px rgba(0,0,0,.6)' }}>
          <CheckCircle2 size={15}/> {toast}
        </div>
      )}
    </div>
  )
}
