import type { TurnstileApi, TurnstileWindow } from '../types/turnstile'

const TURNSTILE_SCRIPT_ID = 'classsignal-turnstile-api'
const TURNSTILE_ONLOAD_CALLBACK = '__classSignalTurnstileLoaded'
const TURNSTILE_LOAD_TIMEOUT_MS = 12_000
const TURNSTILE_SCRIPT_URL =
  `https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=${TURNSTILE_ONLOAD_CALLBACK}`

let loaderPromise: Promise<TurnstileApi> | null = null

function getTurnstileWindow() {
  return window as TurnstileWindow
}

export function loadTurnstile() {
  const turnstileWindow = getTurnstileWindow()
  if (turnstileWindow.turnstile) {
    return Promise.resolve(turnstileWindow.turnstile)
  }

  if (loaderPromise) return loaderPromise

  loaderPromise = new Promise<TurnstileApi>((resolve, reject) => {
    const existingScript = document.getElementById(TURNSTILE_SCRIPT_ID)
    if (existingScript) existingScript.remove()

    const script = document.createElement('script')
    script.id = TURNSTILE_SCRIPT_ID
    script.src = TURNSTILE_SCRIPT_URL
    script.async = true
    script.defer = true

    const timeoutId = window.setTimeout(() => {
      loaderPromise = null
      turnstileWindow.__classSignalTurnstileLoaded = undefined
      script.remove()
      reject(new Error('Turnstile tardó demasiado en cargar.'))
    }, TURNSTILE_LOAD_TIMEOUT_MS)

    const rejectLoad = () => {
      window.clearTimeout(timeoutId)
      loaderPromise = null
      turnstileWindow.__classSignalTurnstileLoaded = undefined
      script.remove()
      reject(new Error('No se pudo cargar la verificación segura.'))
    }

    turnstileWindow.__classSignalTurnstileLoaded = () => {
      window.clearTimeout(timeoutId)
      turnstileWindow.__classSignalTurnstileLoaded = undefined

      if (!turnstileWindow.turnstile) {
        rejectLoad()
        return
      }

      resolve(turnstileWindow.turnstile)
    }

    script.addEventListener('error', rejectLoad, { once: true })
    document.head.append(script)
  })

  return loaderPromise
}
