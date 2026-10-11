import { BotonAyuda } from '../../components/ui/Ayuda'
import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { Brush, Sparkles, UserRound } from 'lucide-react'
import { useStudentTheme, esColorClaro } from '../../context/StudentThemeContext'
import AppearancePicker from '../../components/ui/AppearancePicker'
import { useStudentData } from '../../hooks/useStudentData'
import ModalPortal from '../../components/ui/ModalPortal'
import { CabeceraModal, SeccionAvatar, SeccionColor, useAvatares } from './Personalizar'
import { estadoPerfil } from './EstadoPagina'

export default function StudentSettings() {
  const { appearance, setAppearance, t, card } = useStudentTheme()
  const { student: s, group: grp, setStudent, loading, error } = useStudentData()

  /* Las dos rejillas ocupaban la pantalla entera y había que recorrerlas para
     llegar a cualquier otro ajuste. Viven en su propia ventana: aquí queda lo
     que el alumno tiene puesto y el botón para cambiarlo. */
  // El menú de cuenta puede abrir directamente un selector (state.abrir).
  const { state: navState } = useLocation()
  const [modal, setModal] = useState(navState?.abrir ?? null)   // 'avatar' | 'color' | null
  // Si ya estaba aquí y vuelve a pedirlo desde el menú, la ruta no se remonta.
  useEffect(() => { if (navState?.abrir) setModal(navState.abrir) }, [navState])
  const avatares = useAvatares()

  const estado = estadoPerfil({ loading, student: s, error })
  if (estado) return estado

  const tarjetaClara = esColorClaro(card.grad)
  const tinta = tarjetaClara ? '#0f172a' : '#ffffff'
  const avatarActual = avatares.find(a => a.id === s?.avatar) ?? null
  const iniciales = s?.name.split(' ').slice(0, 2).map(n => n[0]).join('') ?? 'AL'

  return (
    <div className="w-full space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="page-title">Configuración</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--t3)' }}>
            Personaliza la apariencia de tu portal.
          </p>
        </div>
        <BotonAyuda titulo="Configuración">
          <p><b>Apariencia:</b> cambia los colores de todo el portal (SIGA oscuro, IPN o UNAM).</p>
          <p><b>Tu presentación:</b> elige tu avatar y el color de tu tarjeta de bienvenida y tu credencial.</p>
          <p>Estos cambios solo se ven en tu cuenta. También los tienes en el menú de tu icono, arriba a la derecha.</p>
        </BotonAyuda>
      </div>

      <AppearancePicker appearance={appearance} setAppearance={setAppearance} t={t} title="Apariencia" />

      {/* ── Resumen: qué tengo puesto y cómo cambiarlo ────────── */}
      <div className="card p-4 sm:p-5 space-y-4">
        <h2 className="section-title flex items-center gap-2"><Brush size={15}/> Tu presentación</h2>

        {/* Vista previa: la tinta se decide por la luminancia del fondo, así que
            un color claro no deja el nombre en blanco sobre blanco. */}
        <div className="rounded-2xl p-5 kw" style={{
          background: card.grad,
          color: tinta,
          border: `1px solid ${tarjetaClara ? 'rgba(15,23,42,.14)' : 'rgba(255,255,255,.10)'}`,
        }}>
          <div className="flex items-center gap-3.5">
            {avatarActual ? (
              <img src={avatarActual.src} alt=""
                className="w-12 h-12 rounded-2xl object-cover flex-shrink-0"/>
            ) : (
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-base font-bold flex-shrink-0"
                style={{ background: tarjetaClara ? 'rgba(15,23,42,.10)' : 'rgba(255,255,255,.15)' }}>
                {iniciales}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-xs" style={{ opacity: .6 }}>Vista previa</p>
              <p className="font-bold truncate">{s?.name ?? 'Alumno'}</p>
              <p className="text-xs truncate" style={{ opacity: .6 }}>
                {[grp?.name, grp?.subject].filter(Boolean).join(' — ')}
              </p>
            </div>
            <Sparkles size={16} className="ml-auto flex-shrink-0" style={{ opacity: .35 }}/>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <button type="button" onClick={() => setModal('avatar')}
            className="min-h-11 flex items-center gap-3 p-3 rounded-xl transition-colors text-left active:scale-[.99]"
            style={{ background: 'var(--soft-bg)', border: '1px solid var(--card-border)' }}>
            {avatarActual
              ? <img src={avatarActual.src} alt="" className="w-9 h-9 rounded-full flex-shrink-0"/>
              : <span className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: 'var(--card-border)', color: 'var(--t2)' }}><UserRound size={16}/></span>}
            <span className="min-w-0">
              <span className="block text-xs font-bold" style={{ color: 'var(--t1)' }}>Personalizar avatar</span>
              <span className="block text-[11px] truncate" style={{ color: 'var(--t3)' }}>
                {avatarActual ? avatarActual.nombre : 'Sin avatar · usas tus iniciales'}
              </span>
            </span>
          </button>

          <button type="button" onClick={() => setModal('color')}
            className="min-h-11 flex items-center gap-3 p-3 rounded-xl transition-colors text-left active:scale-[.99]"
            style={{ background: 'var(--soft-bg)', border: '1px solid var(--card-border)' }}>
            <span className="w-9 h-9 rounded-full flex-shrink-0"
              style={{ background: card.grad, border: '1px solid var(--card-border)' }}/>
            <span className="min-w-0">
              <span className="block text-xs font-bold" style={{ color: 'var(--t1)' }}>Personalizar color</span>
              <span className="block text-[11px] truncate" style={{ color: 'var(--t3)' }}>{card.label}</span>
            </span>
          </button>
        </div>
      </div>

      {modal === 'avatar' && (
        <ModalPortal onClose={() => setModal(null)} maxWidth="max-w-2xl" scrollable>
          <CabeceraModal titulo="Elige tu avatar" onClose={() => setModal(null)}/>
          <div className="p-4 sm:p-5">
            <SeccionAvatar student={s} setStudent={setStudent} avatares={avatares}/>
          </div>
        </ModalPortal>
      )}

      {modal === 'color' && (
        <ModalPortal onClose={() => setModal(null)} maxWidth="max-w-2xl" scrollable>
          <CabeceraModal titulo="Color de tu tarjeta" onClose={() => setModal(null)}/>
          <div className="p-4 sm:p-5">
            <SeccionColor/>
          </div>
        </ModalPortal>
      )}
    </div>
  )
}
