import { appShellPath } from '../build/app-shell'
import { createSecurityHeaders } from '../build/security-headers'

export { createContentSecurityPolicy } from '../build/security-headers'

interface Env {
  ASSETS: {
    fetch(request: Request): Promise<Response>
  }
  VITE_SUPABASE_URL?: string
  VITE_SUPABASE_PUBLISHABLE_KEY?: string
}

interface PublicRuntimeConfig {
  VITE_SUPABASE_URL?: string
  VITE_SUPABASE_PUBLISHABLE_KEY?: string
}

const runtimeConfigPath = '/__classsignal-config.js'

function asPublishableKey(value: string | undefined) {
  const key = value?.trim()

  return key?.startsWith('sb_publishable_') ? key : undefined
}

function resolveRuntimeConfig(env: Env): PublicRuntimeConfig {
  const hasHostedSupabaseConfig =
    env.VITE_SUPABASE_URL !== undefined ||
    env.VITE_SUPABASE_PUBLISHABLE_KEY !== undefined
  const supabaseUrl = hasHostedSupabaseConfig
    ? env.VITE_SUPABASE_URL
    : import.meta.env.VITE_SUPABASE_URL
  const publishableKey = hasHostedSupabaseConfig
    ? env.VITE_SUPABASE_PUBLISHABLE_KEY
    : import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

  return {
    VITE_SUPABASE_URL: supabaseUrl,
    VITE_SUPABASE_PUBLISHABLE_KEY: asPublishableKey(publishableKey),
  }
}

export function createRuntimeConfigScript(config: PublicRuntimeConfig) {
  const serialized = JSON.stringify(config)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')

  return `globalThis.__CLASS_SIGNAL_CONFIG__=${serialized};`
}

export function applySecurityHeaders(
  request: Request,
  response: Response,
  supabaseUrl = import.meta.env.VITE_SUPABASE_URL,
) {
  const headers = new Headers(response.headers)
  const secureTransport = new URL(request.url).protocol === 'https:'

  for (const [name, value] of Object.entries(
    createSecurityHeaders(supabaseUrl, secureTransport),
  )) {
    headers.set(name, value)
  }

  if (!secureTransport) {
    headers.delete('Strict-Transport-Security')
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

function asHtml(response: Response) {
  const headers = new Headers(response.headers)
  headers.set('Content-Type', 'text/html; charset=utf-8')

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

function serveRuntimeConfig(
  request: Request,
  config: PublicRuntimeConfig,
) {
  if (!['GET', 'HEAD'].includes(request.method)) {
    return applySecurityHeaders(
      request,
      new Response('Method Not Allowed', {
        status: 405,
        headers: {
          Allow: 'GET, HEAD',
          'Cache-Control': 'no-store, max-age=0',
          'Content-Type': 'text/plain; charset=utf-8',
        },
      }),
      config.VITE_SUPABASE_URL,
    )
  }

  const body =
    request.method === 'HEAD' ? null : createRuntimeConfigScript(config)

  return applySecurityHeaders(
    request,
    new Response(body, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        'Content-Type': 'application/javascript; charset=utf-8',
      },
    }),
    config.VITE_SUPABASE_URL,
  )
}

export default {
  async fetch(request: Request, env: Env) {
    const runtimeConfig = resolveRuntimeConfig(env)

    if (new URL(request.url).pathname === runtimeConfigPath) {
      return serveRuntimeConfig(request, runtimeConfig)
    }

    const response = await env.ASSETS.fetch(request)
    const acceptsHtml = request.headers.get('accept')?.includes('text/html')

    if (
      response.status !== 404 ||
      !['GET', 'HEAD'].includes(request.method) ||
      !acceptsHtml
    ) {
      return applySecurityHeaders(
        request,
        response,
        runtimeConfig.VITE_SUPABASE_URL,
      )
    }

    const shellUrl = new URL(appShellPath, request.url)
    let shellResponse = await env.ASSETS.fetch(new Request(shellUrl, request))

    if (shellResponse.status === 404) {
      const developmentShellUrl = new URL('/index.html', request.url)
      shellResponse = await env.ASSETS.fetch(
        new Request(developmentShellUrl, request),
      )
    }

    return applySecurityHeaders(
      request,
      asHtml(shellResponse),
      runtimeConfig.VITE_SUPABASE_URL,
    )
  },
}
