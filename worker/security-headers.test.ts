import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { workerAssetsConfig } from '../build/worker-assets-config'
import { appShellPath } from '../build/app-shell'
import worker, {
  applySecurityHeaders,
  createRuntimeConfigScript,
  createContentSecurityPolicy,
  runtimeConfigPath,
} from './index'

const supabaseUrl = 'https://project-ref.supabase.co'

const expectedHeaders = {
  'content-security-policy': [
    "default-src 'none'",
    "base-uri 'none'",
    "script-src 'self' https://challenges.cloudflare.com",
    'frame-src https://challenges.cloudflare.com',
    `connect-src 'self' ${supabaseUrl} wss://project-ref.supabase.co`,
    "frame-ancestors 'none'",
  ],
  'cross-origin-opener-policy': ['same-origin'],
  'cross-origin-resource-policy': ['same-origin'],
  'permissions-policy': ['camera=()', 'microphone=()', 'geolocation=()'],
  'referrer-policy': ['strict-origin-when-cross-origin'],
  'x-content-type-options': ['nosniff'],
  'x-frame-options': ['DENY'],
} as const

function expectSecurityHeaders(response: Response) {
  for (const [name, expectedValues] of Object.entries(expectedHeaders)) {
    const value = response.headers.get(name)

    for (const expectedValue of expectedValues) {
      expect(value).toContain(expectedValue)
    }
  }

  const contentSecurityPolicy = response.headers.get(
    'content-security-policy',
  )

  expect(contentSecurityPolicy).not.toContain('*.supabase.co')
  expect(contentSecurityPolicy).not.toContain('api.openai.com')
  expect(contentSecurityPolicy).not.toMatch(/script-src[^;]*'unsafe-inline'/)
}

describe('security headers', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_SUPABASE_URL', supabaseUrl)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('protects HTTPS responses without changing their payload metadata', async () => {
    const original = new Response('ClassSignal', {
      status: 202,
      headers: {
        'cache-control': 'public, max-age=60',
        'content-type': 'text/plain; charset=utf-8',
      },
    })

    const secured = applySecurityHeaders(
      new Request('https://classsignal.example/'),
      original,
      supabaseUrl,
    )

    expectSecurityHeaders(secured)
    expect(secured.headers.get('strict-transport-security')).toBe(
      'max-age=31536000',
    )
    expect(secured.headers.get('cache-control')).toBe('public, max-age=60')
    expect(secured.headers.get('content-type')).toBe(
      'text/plain; charset=utf-8',
    )
    expect(secured.status).toBe(202)
    await expect(secured.text()).resolves.toBe('ClassSignal')
  })

  it('does not advertise HSTS over local HTTP', () => {
    const secured = applySecurityHeaders(
      new Request('http://localhost:5173/'),
      new Response('local'),
      supabaseUrl,
    )

    expectSecurityHeaders(secured)
    expect(secured.headers.has('strict-transport-security')).toBe(false)
  })

  it('protects the SPA fallback response as well as direct assets', async () => {
    const requestedUrls: string[] = []
    const env = {
      ASSETS: {
        async fetch(request: Request) {
          requestedUrls.push(request.url)

          if (new URL(request.url).pathname === appShellPath) {
            return new Response('<main>ClassSignal</main>', {
              headers: { 'content-type': 'text/plain' },
            })
          }

          return new Response('not found', { status: 404 })
        },
      },
    }

    const response = await worker.fetch(
      new Request('https://classsignal.example/profesor', {
        headers: { accept: 'text/html' },
      }),
      env,
    )

    expect(requestedUrls).toEqual([
      'https://classsignal.example/profesor',
      `https://classsignal.example${appShellPath}`,
    ])
    expectSecurityHeaders(response)
    expect(response.headers.get('strict-transport-security')).toBe(
      'max-age=31536000',
    )
    expect(response.headers.get('content-type')).toBe(
      'text/html; charset=utf-8',
    )
    await expect(response.text()).resolves.toContain('ClassSignal')
  })

  it('serves an allowlisted, uncached runtime configuration before assets', async () => {
    let assetRequests = 0
    const env = {
      ASSETS: {
        async fetch() {
          assetRequests += 1
          return new Response('unexpected asset')
        },
      },
      VITE_SUPABASE_URL: supabaseUrl,
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_public_key_for_tests',
    }

    const response = await worker.fetch(
      new Request(`https://classsignal.example${runtimeConfigPath}`),
      env,
    )

    expect(assetRequests).toBe(0)
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe(
      'no-store, max-age=0',
    )
    expect(response.headers.get('content-type')).toBe(
      'application/javascript; charset=utf-8',
    )
    expectSecurityHeaders(response)
    await expect(response.text()).resolves.toBe(
      'globalThis.__CLASS_SIGNAL_CONFIG__=' +
        JSON.stringify({
          VITE_SUPABASE_URL: supabaseUrl,
          VITE_SUPABASE_PUBLISHABLE_KEY:
            'sb_publishable_public_key_for_tests',
        }) +
        ';',
    )
  })

  it('escapes executable delimiters while preserving the public value', () => {
    const script = createRuntimeConfigScript({
      VITE_SUPABASE_URL: 'https://project-ref.supabase.co/<script>',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_public_key_for_tests',
    })

    expect(script).toContain('\\u003cscript>')
    expect(script).not.toContain('<script>')
  })

  it('serializes only allowlisted bindings and refuses secret keys', async () => {
    const secretSentinel = 'sb_secret_never_expose_this_value'
    const response = await worker.fetch(
      new Request(`https://classsignal.example${runtimeConfigPath}`),
      {
        ASSETS: {
          async fetch() {
            return new Response('unexpected asset')
          },
        },
        VITE_SUPABASE_URL: supabaseUrl,
        VITE_SUPABASE_PUBLISHABLE_KEY: secretSentinel,
        OPENAI_API_KEY: 'private-openai-sentinel',
        SUPABASE_SERVICE_ROLE_KEY: 'private-service-role-sentinel',
      },
    )
    const body = await response.text()

    expect(body).toContain(JSON.stringify(supabaseUrl))
    expect(body).not.toContain(secretSentinel)
    expect(body).not.toContain('OPENAI_API_KEY')
    expect(body).not.toContain('private-openai-sentinel')
    expect(body).not.toContain('SUPABASE_SERVICE_ROLE_KEY')
    expect(body).not.toContain('private-service-role-sentinel')
  })

  it('uses the hosted Supabase URL for security headers', async () => {
    const hostedUrl = 'https://hosted-project.supabase.co'
    const response = await worker.fetch(
      new Request('https://classsignal.example/asset.js'),
      {
        ASSETS: {
          async fetch() {
            return new Response('asset')
          },
        },
        VITE_SUPABASE_URL: hostedUrl,
        VITE_SUPABASE_PUBLISHABLE_KEY:
          'sb_publishable_public_key_for_tests',
      },
    )
    const policy = response.headers.get('content-security-policy')

    expect(policy).toContain(
      `connect-src 'self' ${hostedUrl} wss://hosted-project.supabase.co`,
    )
    expect(policy).not.toContain(supabaseUrl)
  })

  it('returns metadata without a body for runtime configuration HEAD requests', async () => {
    const response = await worker.fetch(
      new Request(`https://classsignal.example${runtimeConfigPath}`, {
        method: 'HEAD',
      }),
      {
        ASSETS: {
          async fetch() {
            return new Response('unexpected asset')
          },
        },
        VITE_SUPABASE_URL: supabaseUrl,
        VITE_SUPABASE_PUBLISHABLE_KEY:
          'sb_publishable_public_key_for_tests',
      },
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe(
      'no-store, max-age=0',
    )
    await expect(response.text()).resolves.toBe('')
  })

  it('rejects writes to the runtime configuration endpoint', async () => {
    const response = await worker.fetch(
      new Request(`https://classsignal.example${runtimeConfigPath}`, {
        method: 'POST',
      }),
      {
        ASSETS: {
          async fetch() {
            return new Response('unexpected asset')
          },
        },
        VITE_SUPABASE_URL: supabaseUrl,
      },
    )

    expect(response.status).toBe(405)
    expect(response.headers.get('allow')).toBe('GET, HEAD')
    expect(response.headers.get('cache-control')).toBe(
      'no-store, max-age=0',
    )
  })

  it('protects a non-HTML 404 without rewriting it to the SPA shell', async () => {
    const env = {
      ASSETS: {
        async fetch() {
          return new Response('missing', { status: 404 })
        },
      },
    }

    const response = await worker.fetch(
      new Request('https://classsignal.example/missing.json', {
        headers: { accept: 'application/json' },
      }),
      env,
    )

    expect(response.status).toBe(404)
    expectSecurityHeaders(response)
    await expect(response.text()).resolves.toBe('missing')
  })

  it('uses the Vite index shell during local development', async () => {
    const requestedPaths: string[] = []
    const env = {
      ASSETS: {
        async fetch(request: Request) {
          const path = new URL(request.url).pathname
          requestedPaths.push(path)

          if (path === '/index.html') {
            return new Response('<main>Local ClassSignal</main>', {
              headers: { 'content-type': 'text/html' },
            })
          }

          return new Response('not found', { status: 404 })
        },
      },
    }

    const response = await worker.fetch(
      new Request('http://localhost:5173/', {
        headers: { accept: 'text/html' },
      }),
      env,
    )

    expect(requestedPaths).toEqual(['/', appShellPath, '/index.html'])
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe(
      'text/html; charset=utf-8',
    )
    await expect(response.text()).resolves.toContain('Local ClassSignal')
  })

  it('fails closed when the configured Supabase URL is invalid', () => {
    const policy = createContentSecurityPolicy('not-a-url')

    expect(policy).toContain("connect-src 'self'")
    expect(policy).not.toContain('supabase.co')
    expect(policy).not.toContain('not-a-url')
  })

  it('requests worker-first routing from compatible Cloudflare hosts', () => {
    expect(workerAssetsConfig.run_worker_first).toBe(true)
    expect(workerAssetsConfig.html_handling).toBe('none')
    expect(workerAssetsConfig.not_found_handling).toBe('none')
  })
})
