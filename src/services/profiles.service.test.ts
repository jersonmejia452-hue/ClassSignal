import { beforeEach, describe, expect, it, vi } from 'vitest'

const { fromMock, getAccountSupabaseMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  getAccountSupabaseMock: vi.fn(),
}))

vi.mock('./supabase', () => ({
  getAccountSupabase: getAccountSupabaseMock,
}))

import { getMyProfile } from './profiles.service'

const userId = '00000000-0000-4000-8000-000000000001'
const profile = {
  id: userId,
  role: 'student',
  display_name: 'Andrea',
  created_at: '2026-07-19T01:00:00.000Z',
  updated_at: '2026-07-19T01:00:00.000Z',
}

function mockProfileResult(result: { data: unknown; error: unknown }) {
  const maybeSingle = vi.fn().mockResolvedValue(result)
  const eq = vi.fn(() => ({ maybeSingle }))
  const select = vi.fn(() => ({ eq }))
  fromMock.mockReturnValue({ select })
  return { eq, maybeSingle, select }
}

describe('profiles.service', () => {
  beforeEach(() => {
    fromMock.mockReset()
    getAccountSupabaseMock.mockReset()
    getAccountSupabaseMock.mockReturnValue({ from: fromMock })
  })

  it('consulta el perfil propio mediante el cliente autenticado', async () => {
    const query = mockProfileResult({ data: profile, error: null })

    await expect(getMyProfile(userId)).resolves.toEqual(profile)
    expect(getAccountSupabaseMock).toHaveBeenCalledOnce()
    expect(fromMock).toHaveBeenCalledWith('profiles')
    expect(query.select).toHaveBeenCalledWith(
      'id, role, display_name, created_at, updated_at',
    )
    expect(query.eq).toHaveBeenCalledWith('id', userId)
  })

  it('devuelve null cuando la cuenta todavía no tiene perfil', async () => {
    mockProfileResult({ data: null, error: null })

    await expect(getMyProfile(userId)).resolves.toBeNull()
  })

  it('rechaza perfiles con campos privados o inesperados', async () => {
    mockProfileResult({
      data: { ...profile, email: 'andrea@example.edu' },
      error: null,
    })

    await expect(getMyProfile(userId)).rejects.toThrow(
      'account_profile_invalid',
    )
  })

  it('propaga errores de la consulta autenticada', async () => {
    const databaseError = new Error('profile query unavailable')
    mockProfileResult({ data: null, error: databaseError })

    await expect(getMyProfile(userId)).rejects.toBe(databaseError)
  })
})
