import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { GraduationCap, Eye, EyeOff, BookOpen, Users, BarChart2, BrainCircuit, Lock, Mail } from 'lucide-react'

const demos = [
  { role:'Docente (Admin)', email:'admin@edutrack.mx',       pass:'123456', badge:'bg-navy-900 text-white' },
  { role:'Alumno',          email:'ana.garcia@edutrack.mx',  pass:'123456', badge:'bg-emerald-600 text-white' },
  { role:'Tutor',           email:'tutor@edutrack.mx',       pass:'123456', badge:'bg-amber-500 text-white' },
]

const features = [
  { icon:CalendarCheck2, label:'Control de Asistencias', desc:'Pasa lista en segundos' },
  { icon:BarChart2,      label:'Rankings y Reportes',    desc:'Visualiza el rendimiento' },
  { icon:BrainCircuit,   label:'Análisis con IA',        desc:'Detecta alumnos en riesgo' },
  { icon:Users,          label:'Gestión por Grupos',     desc:'Organiza tu clase fácilmente' },
]

function CalendarCheck2(props) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><polyline points="9 16 11 18 15 14"/>
    </svg>
  )
}

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  const handleSubmit = async e => {
    e.preventDefault()
    setError('')
    setLoading(true)
    await new Promise(r => setTimeout(r, 600))
    const res = login(email, password)
    setLoading(false)
    if (!res.ok) { setError(res.message); return }
    navigate(res.role === 'admin' ? '/admin' : '/student')
  }

  const fillDemo = d => { setEmail(d.email); setPassword(d.pass); setError('') }

  return (
    <div className="min-h-screen flex">
      {/* ── Left panel ─────────────────────────────────────── */}
      <div className="hidden lg:flex w-[52%] bg-navy-900 flex-col justify-between p-12 relative overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute -top-24 -left-24 w-80 h-80 rounded-full bg-navy-800 opacity-60" />
        <div className="absolute top-1/3 -right-16 w-56 h-56 rounded-full bg-gold-500 opacity-10" />
        <div className="absolute -bottom-20 left-1/4 w-96 h-96 rounded-full bg-navy-800 opacity-50" />
        <div className="absolute bottom-1/4 right-0 w-40 h-40 rounded-full bg-gold-400 opacity-8" />

        {/* Logo */}
        <div className="relative flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gold-500 flex items-center justify-center">
            <GraduationCap size={22} className="text-white" />
          </div>
          <span className="text-white text-2xl font-bold">EduTrack</span>
        </div>

        {/* Hero */}
        <div className="relative">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-navy-800 text-gold-400 text-xs font-semibold mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-gold-400 animate-pulse" />
            Plataforma Educativa Integral
          </div>
          <h2 className="text-white text-4xl font-bold leading-tight mb-4">
            Gestión escolar<br />
            <span className="text-gold-400">inteligente</span> y<br />
            eficiente.
          </h2>
          <p className="text-navy-300 text-base leading-relaxed max-w-sm">
            Herramienta diseñada para docentes y alumnos. Controla asistencias,
            evaluaciones, rankings y obtén análisis con IA sobre el desempeño académico.
          </p>

          {/* Feature pills */}
          <div className="mt-8 grid grid-cols-2 gap-3">
            {features.map(({ icon: Icon, label, desc }) => (
              <div key={label} className="flex items-start gap-3 bg-navy-800 rounded-xl p-3">
                <div className="w-8 h-8 rounded-lg bg-navy-700 flex items-center justify-center flex-shrink-0">
                  <Icon size={16} className="text-gold-400" />
                </div>
                <div>
                  <p className="text-white text-xs font-semibold">{label}</p>
                  <p className="text-navy-400 text-[11px] mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Stats strip */}
        <div className="relative flex gap-8">
          {[['20','Alumnos'],['3','Grupos'],['100%','Digital'],['IA','Integrada']].map(([v,l]) => (
            <div key={l}>
              <p className="text-gold-400 text-2xl font-bold">{v}</p>
              <p className="text-navy-400 text-xs">{l}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right panel ────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center bg-white px-8 py-12">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-9 h-9 rounded-xl bg-navy-900 flex items-center justify-center">
              <GraduationCap size={18} className="text-white" />
            </div>
            <span className="text-navy-900 text-xl font-bold">EduTrack</span>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold text-slate-900">Iniciar Sesión</h1>
            <p className="text-slate-500 text-sm mt-1">Ingresa tus credenciales para continuar.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Correo electrónico</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email" value={email} onChange={e=>setEmail(e.target.value)}
                  placeholder="correo@edutrack.mx" required
                  className="input-field pl-9"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Contraseña</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type={showPw ? 'text' : 'password'} value={password} onChange={e=>setPassword(e.target.value)}
                  placeholder="••••••" required
                  className="input-field pl-9 pr-10"
                />
                <button type="button" onClick={()=>setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showPw ? <EyeOff size={16}/> : <Eye size={16}/>}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full bg-navy-900 text-white py-2.5 rounded-lg font-semibold text-sm hover:bg-navy-800 transition-colors disabled:opacity-60 flex items-center justify-center gap-2 mt-2">
              {loading
                ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> Verificando...</>
                : 'Ingresar a EduTrack'}
            </button>
          </form>

          {/* Demo credentials */}
          <div className="mt-8 pt-6 border-t border-slate-100">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
              Credenciales de demostración
            </p>
            <div className="space-y-2">
              {demos.map(d => (
                <button key={d.role} onClick={()=>fillDemo(d)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:border-navy-300 hover:bg-slate-50 transition-all text-left group">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0 ${d.badge}`}>
                    {d.role}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-600 font-mono truncate">{d.email}</p>
                  </div>
                  <span className="text-[10px] text-navy-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                    Usar →
                  </span>
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-400 mt-2 text-center">
              Contraseña para todos: <span className="font-mono font-semibold">123456</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
