interface ErrorLike {
  code?: string
  message?: string
}

export function getErrorCode(error: unknown) {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    return String((error as ErrorLike).code ?? '')
  }

  return ''
}

export function getErrorMessage(
  error: unknown,
  fallback = 'Ocurrió un error inesperado. Intenta de nuevo.',
) {
  if (error instanceof Error && error.message) {
    return error.message
  }

  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as ErrorLike).message
    if (message) return message
  }

  return fallback
}

export function getSessionLifecycleErrorMessage(
  error: unknown,
  fallback: string,
) {
  const message = getErrorMessage(error, fallback).toLowerCase()

  if (message.includes('pulse_has_no_responses')) {
    return 'Recibe al menos una señal en el pulso actual antes de abrir el siguiente.'
  }

  if (message.includes('pulse_limit_reached')) {
    return 'Esta clase ya alcanzó el máximo de seis pulsos.'
  }

  if (message.includes('session_inactive')) {
    return 'Reactiva la clase antes de abrir otro pulso.'
  }

  if (message.includes('pulse_inactive')) {
    return 'No encontramos un pulso activo. Actualiza la clase e intenta nuevamente.'
  }

  if (message.includes('session_not_found')) {
    return 'No encontramos esta clase o ya no pertenece a tu cuenta.'
  }

  return getErrorMessage(error, fallback)
}

export function getAuthErrorMessage(error: unknown) {
  const message = getErrorMessage(error).toLowerCase()

  if (message.includes('invalid login credentials')) {
    return 'El correo o la contraseña no coinciden.'
  }

  if (message.includes('email not confirmed')) {
    return 'Confirma tu correo antes de iniciar sesión.'
  }

  if (message.includes('user already registered')) {
    return 'Ya existe una cuenta con este correo.'
  }

  if (message.includes('password')) {
    return 'La contraseña no cumple los requisitos del proyecto.'
  }

  if (message.includes('rate limit')) {
    return 'Se hicieron demasiados intentos. Espera un momento y vuelve a probar.'
  }

  return 'No pudimos completar la autenticación. Intenta nuevamente.'
}

export function getStudentAuthErrorMessage(error: unknown) {
  const message = getErrorMessage(error).toLowerCase()

  if (
    message.includes('rate limit')
    || message.includes('email rate')
    || message.includes('security purposes')
  ) {
    return 'Solicitaste un enlace recientemente. Espera un minuto y vuelve a intentarlo.'
  }

  if (message.includes('signup') && message.includes('disabled')) {
    return 'El registro estudiantil aún no está habilitado. Comunícate con tu profesor.'
  }

  if (message.includes('invalid') && message.includes('email')) {
    return 'Revisa el correo e intenta nuevamente.'
  }

  return 'No pudimos enviar el enlace de acceso. Intenta nuevamente.'
}

export function getStudentPortalErrorMessage(
  error: unknown,
  fallback = 'No pudimos cargar el portal. Revisa tu conexión e intenta nuevamente.',
) {
  const message = getErrorMessage(error, fallback).toLowerCase()

  if (message.includes('student_role_required')) {
    return 'Esta cuenta no tiene acceso al portal del estudiante.'
  }

  if (message.includes('course_enrollment_unavailable')) {
    return 'No pudimos usar ese código. Revísalo con tu profesor; la matrícula puede estar cerrada.'
  }

  if (message.includes('invalid_portal_payload')) {
    return 'El servidor devolvió información inesperada. Actualiza la página e intenta nuevamente.'
  }

  if (
    message.includes('jwt')
    || message.includes('session') && message.includes('expired')
  ) {
    return 'Tu sesión venció. Vuelve a iniciar sesión.'
  }

  return fallback
}

export function getPublicationErrorMessage(error: unknown) {
  const message = getErrorMessage(error).toLowerCase()

  if (
    message.includes('session_not_found')
    || message.includes('row-level security')
    || message.includes('permission denied')
  ) {
    return 'No encontramos esta clase o ya no pertenece a tu cuenta.'
  }

  if (message.includes('invalid_publication_payload')) {
    return 'El servidor devolvió una publicación inesperada. Recarga la página.'
  }

  return 'No pudimos actualizar la publicación para estudiantes. Intenta nuevamente.'
}
