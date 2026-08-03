/**
 * El avatar de un alumno, tal como él mismo lo eligió.
 *
 * Si aún no ha elegido ninguno se dibujan sus iniciales sobre el color de su
 * grupo, que es como se le ha representado siempre. Existe como componente
 * porque la misma persona aparece en una docena de pantallas del panel —lista,
 * rankings, pase de lista, escáner, evaluaciones— y en todas debe reconocerse
 * igual; antes cada una repetía el `split(' ').map(n => n[0])` por su cuenta.
 *
 * `size` es el lado en píxeles; pásalo como `null` cuando el tamaño venga de
 * clases (por ejemplo un podio que encoge en móvil), o el estilo en línea
 * ganaría siempre. `redondez` permite el círculo de las tablas o el cuadrado
 * redondeado de las fichas.
 */
export default function AvatarAlumno({
  student, size = 32, accent, redondez = 'rounded-full', className = '', style = {},
}) {
  const iniciales = (student?.name ?? '')
    .split(' ').slice(0, 2).map(n => n[0]).join('') || '?'

  const lado = size == null ? {} : { width: size, height: size }

  if (student?.avatarSrc) {
    return (
      <img
        src={student.avatarSrc} alt="" loading="lazy"
        className={`${redondez} object-cover flex-shrink-0 ${className}`}
        style={{ ...lado, border: '1px solid var(--card-border)', ...style }}
      />
    )
  }

  return (
    <div
      className={`${redondez} flex items-center justify-center font-bold flex-shrink-0 ${className}`}
      style={{
        ...lado,
        ...(size == null ? {} : { fontSize: Math.max(10, Math.round(size * 0.34)) }),
        ...(accent
          ? { background: `${accent}30`, color: accent, border: `1px solid ${accent}60` }
          : { background: 'var(--soft-bg)', color: 'var(--t1)', border: '1px solid var(--card-border)' }),
        ...style,
      }}>
      {iniciales}
    </div>
  )
}
