interface Env {
  ASSETS: {
    fetch(request: Request): Promise<Response>
  }
}

function getSupabaseConnectSources(supabaseUrl: string | undefined) {
  if (!supabaseUrl) return []

  try {
    const url = new URL(supabaseUrl)

    if (url.protocol !== 'https:' && url.protocol !== 'http:') return []

    const httpOrigin = url.origin
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'

    return [httpOrigin, url.origin]
  } catch {
    return []
  }
}

export function createContentSecurityPolicy(supabaseUrl: string | undefined) {
  const connectSources = [
    "'self'",
    ...getSupabaseConnectSources(supabaseUrl),
  ].join(' ')

  return [
    "default-src 'none'",
    "base-uri 'none'",
    `connect-src ${connectSources}`,
    "font-src 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    'frame-src https://challenges.cloudflare.com',
    "img-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "script-src 'self' https://challenges.cloudflare.com",
    "style-src 'self' 'unsafe-inline'",
    "worker-src 'none'",
  ].join('; ')
}

const SECURITY_HEADERS = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Permissions-Policy':
    'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-Permitted-Cross-Domain-Policies': 'none',
  'X-XSS-Protection': '0',
} as const

export function applySecurityHeaders(
  request: Request,
  response: Response,
  supabaseUrl = import.meta.env.VITE_SUPABASE_URL,
) {
  const headers = new Headers(response.headers)

  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(name, value)
  }

  headers.set(
    'Content-Security-Policy',
    createContentSecurityPolicy(supabaseUrl),
  )

  if (new URL(request.url).protocol === 'https:') {
    headers.set('Strict-Transport-Security', 'max-age=31536000')
  } else {
    headers.delete('Strict-Transport-Security')
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

export default {
  async fetch(request: Request, env: Env) {
    const response = await env.ASSETS.fetch(request)
    const acceptsHtml = request.headers.get('accept')?.includes('text/html')

    if (response.status !== 404 || request.method !== 'GET' || !acceptsHtml) {
      return applySecurityHeaders(request, response)
    }

    const indexUrl = new URL('/', request.url)
    const indexResponse = await env.ASSETS.fetch(new Request(indexUrl, request))

    return applySecurityHeaders(request, indexResponse)
  },
}
