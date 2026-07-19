import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const {
  getAccountSupabaseMock,
  signInWithOtpMock,
  signOutMock,
} = vi.hoisted(() => ({
  getAccountSupabaseMock: vi.fn(),
  signInWithOtpMock: vi.fn(),
  signOutMock: vi.fn(),
}))

vi.mock('./supabase', () => ({
  getAccountSupabase: getAccountSupabaseMock,
}))

import {
  getSafeStudentRedirectPath,
  signInStudentWithMagicLink,
  signOutAccount,
} from './auth.service'

describe('auth.service student access', () => {
  beforeEach(() => {
    getAccountSupabaseMock.mockReset()
    signInWithOtpMock.mockReset()
    signOutMock.mockReset()
    getAccountSupabaseMock.mockReturnValue({
      auth: {
        signInWithOtp: signInWithOtpMock,
        signOut: signOutMock,
      },
    })
    vi.stubGlobal('window', {
      location: { origin: 'https://classsignal.example' },
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('envía Magic Link normalizado al redirect estudiantil', async () => {
    const authResult = { user: null, session: null }
    signInWithOtpMock.mockResolvedValue({ data: authResult, error: null })

    await expect(signInStudentWithMagicLink({
      email: '  Estudiante@Universidad.edu  ',
    })).resolves.toBe(authResult)
    expect(getAccountSupabaseMock).toHaveBeenCalledOnce()
    expect(signInWithOtpMock).toHaveBeenCalledWith({
      email: 'estudiante@universidad.edu',
      options: {
        emailRedirectTo: 'https://classsignal.example/estudiante',
        shouldCreateUser: true,
      },
    })
  })

  it('propaga el error al solicitar el enlace', async () => {
    const authError = new Error('email rate limit')
    signInWithOtpMock.mockResolvedValue({ data: null, error: authError })

    await expect(signInStudentWithMagicLink({
      email: 'estudiante@example.edu',
    })).rejects.toBe(authError)
  })

  it('conserva un destino interno del portal en el Magic Link', async () => {
    signInWithOtpMock.mockResolvedValue({ data: {}, error: null })

    await signInStudentWithMagicLink(
      { email: 'estudiante@example.edu' },
      '/estudiante/clase/123?desde=curso',
    )

    expect(signInWithOtpMock).toHaveBeenCalledWith(expect.objectContaining({
      options: expect.objectContaining({
        emailRedirectTo: 'https://classsignal.example/estudiante/clase/123?desde=curso',
      }),
    }))
  })

  it('rechaza destinos externos o ajenos al portal estudiantil', () => {
    expect(getSafeStudentRedirectPath('//evil.example/estudiante')).toBe('/estudiante')
    expect(getSafeStudentRedirectPath('/profesor')).toBe('/estudiante')
    expect(getSafeStudentRedirectPath('/estudiantex')).toBe('/estudiante')
  })

  it('cierra solamente la sesión local de la cuenta', async () => {
    signOutMock.mockResolvedValue({ error: null })

    await expect(signOutAccount()).resolves.toBeUndefined()
    expect(signOutMock).toHaveBeenCalledWith({ scope: 'local' })
  })
})
