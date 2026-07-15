import { createSecurityHeaders } from '../build/security-headers'

export { createContentSecurityPolicy } from '../build/security-headers'

interface Env {
  ASSETS: {
    fetch(request: Request): Promise<Response>
  }
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
