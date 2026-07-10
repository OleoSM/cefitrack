import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Eye, EyeOff, Mail } from 'lucide-react'

const demos = [
  { role: 'Docente', email: 'admin@edutrack.mx', pass: '123456' },
  { role: 'Alumno', email: 'ana.garcia@edutrack.mx', pass: '123456' },
]

/* ── Pupila simple (personajes sin ojo blanco: naranja y amarillo) ── */
function Pupil({ size = 12, maxDistance = 5, pupilColor = 'black', forceLookX, forceLookY }) {
  const [mouseX, setMouseX] = useState(0)
  const [mouseY, setMouseY] = useState(0)
  const pupilRef = useRef(null)

  useEffect(() => {
    const handleMouseMove = e => { setMouseX(e.clientX); setMouseY(e.clientY) }
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  const calculatePupilPosition = () => {
    if (!pupilRef.current) return { x: 0, y: 0 }
    if (forceLookX !== undefined && forceLookY !== undefined) return { x: forceLookX, y: forceLookY }

    const pupil = pupilRef.current.getBoundingClientRect()
    const pupilCenterX = pupil.left + pupil.width / 2
    const pupilCenterY = pupil.top + pupil.height / 2
    const deltaX = mouseX - pupilCenterX
    const deltaY = mouseY - pupilCenterY
    const distance = Math.min(Math.sqrt(deltaX ** 2 + deltaY ** 2), maxDistance)
    const angle = Math.atan2(deltaY, deltaX)
    return { x: Math.cos(angle) * distance, y: Math.sin(angle) * distance }
  }

  const pupilPosition = calculatePupilPosition()

  return (
    <div ref={pupilRef} className="rounded-full" style={{
      width: `${size}px`, height: `${size}px`, backgroundColor: pupilColor,
      transform: `translate(${pupilPosition.x}px, ${pupilPosition.y}px)`,
      transition: 'transform 0.1s ease-out',
    }} />
  )
}

/* ── Ojo completo (blanco + pupila) — personajes morado y negro ── */
function EyeBall({
  size = 48, pupilSize = 16, maxDistance = 10, eyeColor = 'white', pupilColor = 'black',
  isBlinking = false, forceLookX, forceLookY,
}) {
  const [mouseX, setMouseX] = useState(0)
  const [mouseY, setMouseY] = useState(0)
  const eyeRef = useRef(null)

  useEffect(() => {
    const handleMouseMove = e => { setMouseX(e.clientX); setMouseY(e.clientY) }
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  const calculatePupilPosition = () => {
    if (!eyeRef.current) return { x: 0, y: 0 }
    if (forceLookX !== undefined && forceLookY !== undefined) return { x: forceLookX, y: forceLookY }

    const eye = eyeRef.current.getBoundingClientRect()
    const eyeCenterX = eye.left + eye.width / 2
    const eyeCenterY = eye.top + eye.height / 2
    const deltaX = mouseX - eyeCenterX
    const deltaY = mouseY - eyeCenterY
    const distance = Math.min(Math.sqrt(deltaX ** 2 + deltaY ** 2), maxDistance)
    const angle = Math.atan2(deltaY, deltaX)
    return { x: Math.cos(angle) * distance, y: Math.sin(angle) * distance }
  }

  const pupilPosition = calculatePupilPosition()

  return (
    <div ref={eyeRef} className="rounded-full flex items-center justify-center transition-all duration-150" style={{
      width: `${size}px`, height: isBlinking ? '2px' : `${size}px`, backgroundColor: eyeColor, overflow: 'hidden',
    }}>
      {!isBlinking && (
        <div className="rounded-full" style={{
          width: `${pupilSize}px`, height: `${pupilSize}px`, backgroundColor: pupilColor,
          transform: `translate(${pupilPosition.x}px, ${pupilPosition.y}px)`,
          transition: 'transform 0.1s ease-out',
        }} />
      )}
    </div>
  )
}

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()

  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [mouseX, setMouseX] = useState(0)
  const [mouseY, setMouseY] = useState(0)
  const [isPurpleBlinking, setIsPurpleBlinking] = useState(false)
  const [isBlackBlinking, setIsBlackBlinking] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const [isLookingAtEachOther, setIsLookingAtEachOther] = useState(false)
  const [isPurplePeeking, setIsPurplePeeking] = useState(false)
  const purpleRef = useRef(null)
  const blackRef = useRef(null)
  const yellowRef = useRef(null)
  const orangeRef = useRef(null)

  useEffect(() => {
    const handleMouseMove = e => { setMouseX(e.clientX); setMouseY(e.clientY) }
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  // Parpadeo — morado
  useEffect(() => {
    const getRandomBlinkInterval = () => Math.random() * 4000 + 3000
    const scheduleBlink = () => {
      const blinkTimeout = setTimeout(() => {
        setIsPurpleBlinking(true)
        setTimeout(() => { setIsPurpleBlinking(false); scheduleBlink() }, 150)
      }, getRandomBlinkInterval())
      return blinkTimeout
    }
    const timeout = scheduleBlink()
    return () => clearTimeout(timeout)
  }, [])

  // Parpadeo — negro
  useEffect(() => {
    const getRandomBlinkInterval = () => Math.random() * 4000 + 3000
    const scheduleBlink = () => {
      const blinkTimeout = setTimeout(() => {
        setIsBlackBlinking(true)
        setTimeout(() => { setIsBlackBlinking(false); scheduleBlink() }, 150)
      }, getRandomBlinkInterval())
      return blinkTimeout
    }
    const timeout = scheduleBlink()
    return () => clearTimeout(timeout)
  }, [])

  // Se miran entre ellos al empezar a escribir
  useEffect(() => {
    if (isTyping) {
      setIsLookingAtEachOther(true)
      const timer = setTimeout(() => setIsLookingAtEachOther(false), 800)
      return () => clearTimeout(timer)
    } else {
      setIsLookingAtEachOther(false)
    }
  }, [isTyping])

  // El morado se asoma a espiar cuando la contraseña está visible
  useEffect(() => {
    if (password.length > 0 && showPassword) {
      const schedulePeek = () => {
        const peekInterval = setTimeout(() => {
          setIsPurplePeeking(true)
          setTimeout(() => setIsPurplePeeking(false), 800)
        }, Math.random() * 3000 + 2000)
        return peekInterval
      }
      const firstPeek = schedulePeek()
      return () => clearTimeout(firstPeek)
    } else {
      setIsPurplePeeking(false)
    }
  }, [password, showPassword, isPurplePeeking])

  const calculatePosition = ref => {
    if (!ref.current) return { faceX: 0, faceY: 0, bodySkew: 0 }
    const rect = ref.current.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 3
    const deltaX = mouseX - centerX
    const deltaY = mouseY - centerY
    const faceX = Math.max(-15, Math.min(15, deltaX / 20))
    const faceY = Math.max(-10, Math.min(10, deltaY / 30))
    const bodySkew = Math.max(-6, Math.min(6, -deltaX / 120))
    return { faceX, faceY, bodySkew }
  }

  const purplePos = calculatePosition(purpleRef)
  const blackPos = calculatePosition(blackRef)
  const yellowPos = calculatePosition(yellowRef)
  const orangePos = calculatePosition(orangeRef)

  const handleSubmit = async e => {
    e.preventDefault()
    setError('')
    setIsLoading(true)
    const res = await login(email, password)
    setIsLoading(false)
    if (!res.ok) { setError(res.message); return }
    navigate(res.role === 'admin' ? '/admin' : '/student')
  }

  const fillDemo = d => { setEmail(d.email); setPassword(d.pass); setError('') }

  return (
    <div className="min-h-screen grid xl:grid-cols-2">
      {/* ══ IZQUIERDA — panel de marca + personajes ══════════════ */}
      <div className="relative hidden xl:flex flex-col justify-between overflow-hidden p-12 text-white"
        style={{ background: 'linear-gradient(135deg, #0a1428 0%, #122343 55%, #1e3a6e 100%)' }}>

        <div className="relative z-20">
          <img src="/logo.jpeg" alt="SIGA CEFIMAT" className="h-28 w-28 xl:h-32 xl:w-32 rounded-full object-cover"
            style={{ boxShadow: '0 12px 36px rgba(0,0,0,.40)' }} />
        </div>

        <div className="relative z-20 flex items-end justify-center h-[500px]">
          {/* Personajes animados */}
          <div className="relative" style={{ width: '550px', height: '400px' }}>
            {/* Morado — capa trasera */}
            <div ref={purpleRef} className="absolute bottom-0 transition-all duration-700 ease-in-out" style={{
              left: '70px', width: '180px',
              height: (isTyping || (password.length > 0 && !showPassword)) ? '440px' : '400px',
              backgroundColor: '#6C3FF5', borderRadius: '10px 10px 0 0', zIndex: 1,
              transform: (password.length > 0 && showPassword)
                ? 'skewX(0deg)'
                : (isTyping || (password.length > 0 && !showPassword))
                  ? `skewX(${(purplePos.bodySkew || 0) - 12}deg) translateX(40px)`
                  : `skewX(${purplePos.bodySkew || 0}deg)`,
              transformOrigin: 'bottom center',
            }}>
              <div className="absolute flex gap-8 transition-all duration-700 ease-in-out" style={{
                left: (password.length > 0 && showPassword) ? '20px' : isLookingAtEachOther ? '55px' : `${45 + purplePos.faceX}px`,
                top: (password.length > 0 && showPassword) ? '35px' : isLookingAtEachOther ? '65px' : `${40 + purplePos.faceY}px`,
              }}>
                <EyeBall size={18} pupilSize={7} maxDistance={5} eyeColor="white" pupilColor="#2D2D2D"
                  isBlinking={isPurpleBlinking}
                  forceLookX={(password.length > 0 && showPassword) ? (isPurplePeeking ? 4 : -4) : isLookingAtEachOther ? 3 : undefined}
                  forceLookY={(password.length > 0 && showPassword) ? (isPurplePeeking ? 5 : -4) : isLookingAtEachOther ? 4 : undefined} />
                <EyeBall size={18} pupilSize={7} maxDistance={5} eyeColor="white" pupilColor="#2D2D2D"
                  isBlinking={isPurpleBlinking}
                  forceLookX={(password.length > 0 && showPassword) ? (isPurplePeeking ? 4 : -4) : isLookingAtEachOther ? 3 : undefined}
                  forceLookY={(password.length > 0 && showPassword) ? (isPurplePeeking ? 5 : -4) : isLookingAtEachOther ? 4 : undefined} />
              </div>
            </div>

            {/* Negro — capa media */}
            <div ref={blackRef} className="absolute bottom-0 transition-all duration-700 ease-in-out" style={{
              left: '240px', width: '120px', height: '310px', backgroundColor: '#2D2D2D',
              borderRadius: '8px 8px 0 0', zIndex: 2,
              transform: (password.length > 0 && showPassword)
                ? 'skewX(0deg)'
                : isLookingAtEachOther
                  ? `skewX(${(blackPos.bodySkew || 0) * 1.5 + 10}deg) translateX(20px)`
                  : (isTyping || (password.length > 0 && !showPassword))
                    ? `skewX(${(blackPos.bodySkew || 0) * 1.5}deg)`
                    : `skewX(${blackPos.bodySkew || 0}deg)`,
              transformOrigin: 'bottom center',
            }}>
              <div className="absolute flex gap-6 transition-all duration-700 ease-in-out" style={{
                left: (password.length > 0 && showPassword) ? '10px' : isLookingAtEachOther ? '32px' : `${26 + blackPos.faceX}px`,
                top: (password.length > 0 && showPassword) ? '28px' : isLookingAtEachOther ? '12px' : `${32 + blackPos.faceY}px`,
              }}>
                <EyeBall size={16} pupilSize={6} maxDistance={4} eyeColor="white" pupilColor="#2D2D2D"
                  isBlinking={isBlackBlinking}
                  forceLookX={(password.length > 0 && showPassword) ? -4 : isLookingAtEachOther ? 0 : undefined}
                  forceLookY={(password.length > 0 && showPassword) ? -4 : isLookingAtEachOther ? -4 : undefined} />
                <EyeBall size={16} pupilSize={6} maxDistance={4} eyeColor="white" pupilColor="#2D2D2D"
                  isBlinking={isBlackBlinking}
                  forceLookX={(password.length > 0 && showPassword) ? -4 : isLookingAtEachOther ? 0 : undefined}
                  forceLookY={(password.length > 0 && showPassword) ? -4 : isLookingAtEachOther ? -4 : undefined} />
              </div>
            </div>

            {/* Naranja — semicírculo frontal izquierdo */}
            <div ref={orangeRef} className="absolute bottom-0 transition-all duration-700 ease-in-out" style={{
              left: '0px', width: '240px', height: '200px', zIndex: 3, backgroundColor: '#FF9B6B',
              borderRadius: '120px 120px 0 0',
              transform: (password.length > 0 && showPassword) ? 'skewX(0deg)' : `skewX(${orangePos.bodySkew || 0}deg)`,
              transformOrigin: 'bottom center',
            }}>
              <div className="absolute flex gap-8 transition-all duration-200 ease-out" style={{
                left: (password.length > 0 && showPassword) ? '50px' : `${82 + (orangePos.faceX || 0)}px`,
                top: (password.length > 0 && showPassword) ? '85px' : `${90 + (orangePos.faceY || 0)}px`,
              }}>
                <Pupil size={12} maxDistance={5} pupilColor="#2D2D2D"
                  forceLookX={(password.length > 0 && showPassword) ? -5 : undefined}
                  forceLookY={(password.length > 0 && showPassword) ? -4 : undefined} />
                <Pupil size={12} maxDistance={5} pupilColor="#2D2D2D"
                  forceLookX={(password.length > 0 && showPassword) ? -5 : undefined}
                  forceLookY={(password.length > 0 && showPassword) ? -4 : undefined} />
              </div>
            </div>

            {/* Amarillo — frontal derecho */}
            <div ref={yellowRef} className="absolute bottom-0 transition-all duration-700 ease-in-out" style={{
              left: '310px', width: '140px', height: '230px', backgroundColor: '#E8D754',
              borderRadius: '70px 70px 0 0', zIndex: 4,
              transform: (password.length > 0 && showPassword) ? 'skewX(0deg)' : `skewX(${yellowPos.bodySkew || 0}deg)`,
              transformOrigin: 'bottom center',
            }}>
              <div className="absolute flex gap-6 transition-all duration-200 ease-out" style={{
                left: (password.length > 0 && showPassword) ? '20px' : `${52 + (yellowPos.faceX || 0)}px`,
                top: (password.length > 0 && showPassword) ? '35px' : `${40 + (yellowPos.faceY || 0)}px`,
              }}>
                <Pupil size={12} maxDistance={5} pupilColor="#2D2D2D"
                  forceLookX={(password.length > 0 && showPassword) ? -5 : undefined}
                  forceLookY={(password.length > 0 && showPassword) ? -4 : undefined} />
                <Pupil size={12} maxDistance={5} pupilColor="#2D2D2D"
                  forceLookX={(password.length > 0 && showPassword) ? -5 : undefined}
                  forceLookY={(password.length > 0 && showPassword) ? -4 : undefined} />
              </div>
              <div className="absolute w-20 h-[4px] bg-[#2D2D2D] rounded-full transition-all duration-200 ease-out" style={{
                left: (password.length > 0 && showPassword) ? '10px' : `${40 + (yellowPos.faceX || 0)}px`,
                top: (password.length > 0 && showPassword) ? '88px' : `${88 + (yellowPos.faceY || 0)}px`,
              }} />
            </div>
          </div>
        </div>

        <div className="relative z-20 flex items-center gap-8 text-sm text-white/60">
          <a href="#" className="hover:text-white transition-colors">Aviso de Privacidad</a>
          <a href="#" className="hover:text-white transition-colors">Términos y Condiciones</a>
          <a href="#" className="hover:text-white transition-colors">Contacto</a>
        </div>
      </div>

      {/* ══ DERECHA — formulario de login ═══════════════════════ */}
      <div className="flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-[420px]">
          {/* Logo */}
          <div className="flex items-center justify-center mb-12">
            <img src="/siga-wordmark.png" alt="SIGA CEFIMAT" className="h-11 w-auto" />
          </div>

          <div className="text-center mb-10">
            <h1 className="font-display text-3xl font-bold tracking-tight mb-2 text-zinc-900">Bienvenido de vuelta</h1>
            <p className="text-zinc-500 text-sm">Ingresa tus credenciales para continuar</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-zinc-800">Correo electrónico</label>
              <input
                id="email"
                type="email"
                placeholder="correo@cefimat.mx"
                value={email}
                autoComplete="off"
                onChange={e => setEmail(e.target.value)}
                onFocus={() => setIsTyping(true)}
                onBlur={() => setIsTyping(false)}
                required
                className="flex h-12 w-full rounded-md border border-zinc-300/70 bg-white px-3.5 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none transition-colors focus:border-navy-700 focus:ring-2 focus:ring-navy-700/15"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium text-zinc-800">Contraseña</label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  className="flex h-12 w-full rounded-md border border-zinc-300/70 bg-white px-3.5 pr-10 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none transition-colors focus:border-navy-700 focus:ring-2 focus:ring-navy-700/15"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 transition-colors">
                  {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">
                {error}
              </div>
            )}

            <button type="submit" disabled={isLoading}
              className="w-full h-12 text-base font-medium rounded-md bg-navy-900 text-white hover:bg-navy-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              {isLoading ? 'Ingresando…' : 'Iniciar sesión'}
            </button>
          </form>

          <div className="mt-6">
           
          </div>

          <div className="mt-8 pt-6 border-t border-zinc-100">
            <p className="text-center text-[11px] font-bold uppercase tracking-widest text-zinc-400 mb-2.5">
              Acceso de demostración
            </p>
            <div className="flex items-center justify-center gap-2">
              {demos.map(d => (
                <button key={d.role} type="button" onClick={() => fillDemo(d)}
                  className="text-xs font-semibold px-3 py-1.5 rounded-full border border-zinc-200 text-zinc-500 hover:border-navy-700 hover:text-navy-700 transition-colors">
                  {d.role}
                </button>
              ))}
            </div>
            <p className="text-center text-sm text-zinc-500 mt-4">
              ¿Problemas para entrar? Contacta a tu administrador.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
