export type TurnstileWidgetId = string

export interface TurnstileRenderOptions {
  sitekey: string
  action: string
  cData: string
  execution: 'execute'
  language: 'es'
  retry: 'never'
  'refresh-expired': 'manual'
  'response-field': false
  callback: (token: string) => void
  'error-callback': (errorCode: string) => boolean
  'expired-callback': () => void
  'timeout-callback': () => void
  'unsupported-callback': () => void
}

export interface TurnstileApi {
  render: (
    container: HTMLElement,
    options: TurnstileRenderOptions,
  ) => TurnstileWidgetId
  execute: (widgetId: TurnstileWidgetId) => void
  reset: (widgetId: TurnstileWidgetId) => void
  remove: (widgetId: TurnstileWidgetId) => void
}

export interface TurnstileWindow extends Window {
  turnstile?: TurnstileApi
  __classSignalTurnstileLoaded?: () => void
}

export type TurnstileStatus = 'loading' | 'ready' | 'running' | 'error'
