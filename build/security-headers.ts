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

export function createSecurityHeaders(
  supabaseUrl: string | undefined,
  secureTransport: boolean,
) {
  return {
    'Content-Security-Policy': createContentSecurityPolicy(supabaseUrl),
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Permissions-Policy':
      'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-Permitted-Cross-Domain-Policies': 'none',
    'X-XSS-Protection': '0',
    ...(secureTransport
      ? { 'Strict-Transport-Security': 'max-age=31536000' }
      : {}),
  }
}
