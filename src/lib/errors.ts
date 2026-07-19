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
