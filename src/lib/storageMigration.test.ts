import { describe, expect, it } from 'vitest'

import {
  classSignalStorageKeys,
  getOrCreateAnonymousId,
  migrateTeacherAuthStorage,
  type StorageAdapter,
} from './storageMigration'

const legacyAnonymousKey = 'aula-clara:anonymous-id:v1'
const legacyTeacherKey = 'aula-clara:teacher-auth:v1'

class MemoryStorage implements StorageAdapter {
  private readonly values = new Map<string, string>()

  readonly failedRemovals = new Set<string>()
  readonly failedWrites = new Set<string>()
  failReads = false

  constructor(initialValues: Record<string, string> = {}) {
    for (const [key, value] of Object.entries(initialValues)) {
      this.values.set(key, value)
    }
  }

  getItem(key: string) {
    if (this.failReads) throw new Error('Storage reads are blocked.')
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string) {
    if (this.failedWrites.has(key)) {
      throw new Error(`Storage write blocked for ${key}.`)
    }
    this.values.set(key, value)
  }

  removeItem(key: string) {
    if (this.failedRemovals.has(key)) {
      throw new Error(`Storage removal blocked for ${key}.`)
    }
    this.values.delete(key)
  }

  deleteDirectly(key: string) {
    this.values.delete(key)
  }
}

describe('teacher auth storage migration', () => {
  it('uses the ClassSignal namespace for a new installation', () => {
    const storage = new MemoryStorage()

    expect(migrateTeacherAuthStorage(storage)).toBe(
      classSignalStorageKeys.teacherAuth,
    )
    expect(
      storage.getItem(classSignalStorageKeys.teacherAuthMigration),
    ).toBe('1')
  })

  it('copies the complete legacy Supabase session before deleting it', () => {
    const storage = new MemoryStorage({
      [legacyTeacherKey]: '{"access_token":"teacher-session"}',
      [`${legacyTeacherKey}-code-verifier`]: 'verifier-value',
      [`${legacyTeacherKey}-user`]: '{"id":"teacher-id"}',
    })

    expect(migrateTeacherAuthStorage(storage)).toBe(
      classSignalStorageKeys.teacherAuth,
    )
    expect(storage.getItem(classSignalStorageKeys.teacherAuth)).toBe(
      '{"access_token":"teacher-session"}',
    )
    expect(
      storage.getItem(`${classSignalStorageKeys.teacherAuth}-code-verifier`),
    ).toBe('verifier-value')
    expect(
      storage.getItem(`${classSignalStorageKeys.teacherAuth}-user`),
    ).toBe('{"id":"teacher-id"}')
    expect(storage.getItem(legacyTeacherKey)).toBeNull()
  })

  it('keeps an existing ClassSignal session when both namespaces exist', () => {
    const storage = new MemoryStorage({
      [classSignalStorageKeys.teacherAuth]: 'current-session',
      [legacyTeacherKey]: 'stale-session',
    })

    expect(migrateTeacherAuthStorage(storage)).toBe(
      classSignalStorageKeys.teacherAuth,
    )
    expect(storage.getItem(classSignalStorageKeys.teacherAuth)).toBe(
      'current-session',
    )
    expect(storage.getItem(legacyTeacherKey)).toBeNull()
  })

  it('does not resurrect a legacy session after logout', () => {
    const storage = new MemoryStorage({
      [legacyTeacherKey]: 'legacy-session',
    })
    storage.failedRemovals.add(legacyTeacherKey)

    migrateTeacherAuthStorage(storage)
    storage.deleteDirectly(classSignalStorageKeys.teacherAuth)

    expect(migrateTeacherAuthStorage(storage)).toBe(
      classSignalStorageKeys.teacherAuth,
    )
    expect(storage.getItem(classSignalStorageKeys.teacherAuth)).toBeNull()
    expect(storage.getItem(legacyTeacherKey)).toBe('legacy-session')
  })

  it('rolls back copied values and uses the legacy namespace if a write fails', () => {
    const storage = new MemoryStorage({
      [legacyTeacherKey]: 'legacy-session',
      [`${legacyTeacherKey}-code-verifier`]: 'legacy-verifier',
    })
    storage.failedWrites.add(
      `${classSignalStorageKeys.teacherAuth}-code-verifier`,
    )

    expect(migrateTeacherAuthStorage(storage)).toBe(legacyTeacherKey)
    expect(storage.getItem(classSignalStorageKeys.teacherAuth)).toBeNull()
    expect(storage.getItem(legacyTeacherKey)).toBe('legacy-session')
    expect(
      storage.getItem(classSignalStorageKeys.teacherAuthMigration),
    ).toBeNull()
  })

  it('does not overwrite a partial ClassSignal destination', () => {
    const currentUserKey = `${classSignalStorageKeys.teacherAuth}-user`
    const storage = new MemoryStorage({
      [currentUserKey]: 'current-user',
      [legacyTeacherKey]: 'legacy-session',
      [`${legacyTeacherKey}-user`]: 'legacy-user',
    })

    expect(migrateTeacherAuthStorage(storage)).toBe(
      classSignalStorageKeys.teacherAuth,
    )
    expect(storage.getItem(currentUserKey)).toBe('current-user')
    expect(storage.getItem(classSignalStorageKeys.teacherAuth)).toBe(
      'legacy-session',
    )
  })

  it('keeps a migration completed concurrently by another tab', () => {
    const values = new Map<string, string>([
      [legacyTeacherKey, 'legacy-session'],
      [`${legacyTeacherKey}-code-verifier`, 'legacy-verifier'],
    ])
    const currentVerifierKey =
      `${classSignalStorageKeys.teacherAuth}-code-verifier`
    const storage: StorageAdapter = {
      getItem: (key) => values.get(key) ?? null,
      removeItem: (key) => {
        values.delete(key)
      },
      setItem: (key, value) => {
        if (key === currentVerifierKey) {
          values.set(currentVerifierKey, 'legacy-verifier')
          values.set(classSignalStorageKeys.teacherAuthMigration, '1')
          throw new Error('This tab lost the migration race.')
        }
        values.set(key, value)
      },
    }

    expect(migrateTeacherAuthStorage(storage)).toBe(
      classSignalStorageKeys.teacherAuth,
    )
    expect(values.get(classSignalStorageKeys.teacherAuth)).toBe(
      'legacy-session',
    )
    expect(values.get(currentVerifierKey)).toBe('legacy-verifier')
    expect(values.get(classSignalStorageKeys.teacherAuthMigration)).toBe('1')
  })
})

describe('anonymous ID storage migration', () => {
  it('keeps the exact anonymous ID created by the legacy app', () => {
    const storage = new MemoryStorage({
      [legacyAnonymousKey]: 'student-legacy-id',
    })

    expect(getOrCreateAnonymousId(storage, () => 'new-id')).toBe(
      'student-legacy-id',
    )
    expect(storage.getItem(classSignalStorageKeys.anonymousId)).toBe(
      'student-legacy-id',
    )
    expect(storage.getItem(legacyAnonymousKey)).toBeNull()
  })

  it('prefers an existing ClassSignal ID when both values exist', () => {
    const storage = new MemoryStorage({
      [classSignalStorageKeys.anonymousId]: 'current-id',
      [legacyAnonymousKey]: 'stale-id',
    })

    expect(getOrCreateAnonymousId(storage, () => 'new-id')).toBe('current-id')
    expect(storage.getItem(legacyAnonymousKey)).toBeNull()
  })

  it('does not restore a legacy ID after migration was completed', () => {
    const storage = new MemoryStorage({
      [classSignalStorageKeys.anonymousIdMigration]: '1',
      [legacyAnonymousKey]: 'stale-id',
    })

    expect(getOrCreateAnonymousId(storage, () => 'fresh-id')).toBe('fresh-id')
    expect(storage.getItem(classSignalStorageKeys.anonymousId)).toBe(
      'fresh-id',
    )
    expect(storage.getItem(legacyAnonymousKey)).toBeNull()
  })

  it('creates and persists a ClassSignal ID on a new installation', () => {
    const storage = new MemoryStorage()

    expect(getOrCreateAnonymousId(storage, () => 'generated-id')).toBe(
      'generated-id',
    )
    expect(storage.getItem(classSignalStorageKeys.anonymousId)).toBe(
      'generated-id',
    )
    expect(
      storage.getItem(classSignalStorageKeys.anonymousIdMigration),
    ).toBe('1')
  })

  it('returns a usable ID when browser storage is blocked', () => {
    const storage = new MemoryStorage()
    storage.failReads = true

    expect(getOrCreateAnonymousId(storage, () => 'memory-only-id')).toBe(
      'memory-only-id',
    )
  })
})
