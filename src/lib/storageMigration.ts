export interface StorageAdapter {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export const classSignalStorageKeys = {
  anonymousId: 'classsignal:anonymous-id:v1',
  anonymousIdMigration: 'classsignal:anonymous-id:migrated:v1',
  publicAuth: 'classsignal:public-auth:v1',
  teacherAuth: 'classsignal:teacher-auth:v1',
  teacherAuthMigration: 'classsignal:teacher-auth:migrated:v1',
} as const

// Compatibility aliases used only while existing clients move to ClassSignal.
const legacyStorageKeys = {
  anonymousId: 'aula-clara:anonymous-id:v1',
  teacherAuth: 'aula-clara:teacher-auth:v1',
} as const

const authStorageSuffixes = ['', '-code-verifier', '-user'] as const
const migrationMarker = '1'

function removeBestEffort(storage: StorageAdapter, keys: readonly string[]) {
  for (const key of keys) {
    try {
      storage.removeItem(key)
    } catch {
      // A failed cleanup must not make an otherwise valid session unusable.
    }
  }
}

function markMigrationBestEffort(storage: StorageAdapter, key: string) {
  try {
    storage.setItem(key, migrationMarker)
  } catch {
    // The copied value remains usable even if the marker cannot be persisted.
  }
}

export function migrateTeacherAuthStorage(storage: StorageAdapter) {
  const currentBaseKey = classSignalStorageKeys.teacherAuth
  const legacyBaseKey = legacyStorageKeys.teacherAuth
  const legacyKeys = authStorageSuffixes.map(
    (suffix) => `${legacyBaseKey}${suffix}`,
  )

  try {
    const currentSession = storage.getItem(currentBaseKey)
    if (currentSession !== null) {
      markMigrationBestEffort(
        storage,
        classSignalStorageKeys.teacherAuthMigration,
      )
      removeBestEffort(storage, legacyKeys)
      return currentBaseKey
    }

    const migrationCompleted =
      storage.getItem(classSignalStorageKeys.teacherAuthMigration) ===
      migrationMarker

    if (migrationCompleted) {
      removeBestEffort(storage, legacyKeys)
      return currentBaseKey
    }

    const legacyEntries = authStorageSuffixes.map((suffix) => ({
      sourceKey: `${legacyBaseKey}${suffix}`,
      targetKey: `${currentBaseKey}${suffix}`,
      value: storage.getItem(`${legacyBaseKey}${suffix}`),
    }))

    if (!legacyEntries.some(({ value }) => value !== null)) {
      markMigrationBestEffort(
        storage,
        classSignalStorageKeys.teacherAuthMigration,
      )
      return currentBaseKey
    }

    const copiedKeys: string[] = []

    try {
      for (const { targetKey, value } of legacyEntries) {
        if (value === null || storage.getItem(targetKey) !== null) continue

        storage.setItem(targetKey, value)
        copiedKeys.push(targetKey)

        if (storage.getItem(targetKey) !== value) {
          throw new Error('The migrated auth value could not be verified.')
        }
      }

      storage.setItem(
        classSignalStorageKeys.teacherAuthMigration,
        migrationMarker,
      )
      if (
        storage.getItem(classSignalStorageKeys.teacherAuthMigration) !==
        migrationMarker
      ) {
        throw new Error('The auth migration marker could not be verified.')
      }
    } catch {
      try {
        const anotherTabCompletedMigration =
          storage.getItem(classSignalStorageKeys.teacherAuthMigration) ===
          migrationMarker

        if (anotherTabCompletedMigration) {
          removeBestEffort(storage, legacyKeys)
          return currentBaseKey
        }
      } catch {
        // Fall through to the rollback when storage cannot be read reliably.
      }

      removeBestEffort(storage, [
        ...copiedKeys,
        classSignalStorageKeys.teacherAuthMigration,
      ])
      return legacyBaseKey
    }

    removeBestEffort(
      storage,
      legacyEntries.map(({ sourceKey }) => sourceKey),
    )
    return currentBaseKey
  } catch {
    return legacyBaseKey
  }
}

export function getOrCreateAnonymousId(
  storage: StorageAdapter,
  createId: () => string,
) {
  const currentKey = classSignalStorageKeys.anonymousId
  const legacyKey = legacyStorageKeys.anonymousId
  const markerKey = classSignalStorageKeys.anonymousIdMigration

  try {
    const currentId = storage.getItem(currentKey)
    if (currentId) {
      markMigrationBestEffort(storage, markerKey)
      removeBestEffort(storage, [legacyKey])
      return currentId
    }

    const migrationCompleted = storage.getItem(markerKey) === migrationMarker
    const legacyId = storage.getItem(legacyKey)

    if (!migrationCompleted && legacyId) {
      try {
        storage.setItem(currentKey, legacyId)
        if (storage.getItem(currentKey) !== legacyId) {
          throw new Error('The migrated anonymous ID could not be verified.')
        }

        storage.setItem(markerKey, migrationMarker)
        if (storage.getItem(markerKey) !== migrationMarker) {
          throw new Error(
            'The anonymous ID migration marker could not be verified.',
          )
        }

        removeBestEffort(storage, [legacyKey])
      } catch {
        removeBestEffort(storage, [currentKey, markerKey])
      }

      return legacyId
    }

    if (migrationCompleted) removeBestEffort(storage, [legacyKey])

    const nextId = createId()
    try {
      storage.setItem(currentKey, nextId)
      storage.setItem(markerKey, migrationMarker)
    } catch {
      // The ID remains valid for the current page even if storage is blocked.
    }
    return nextId
  } catch {
    return createId()
  }
}
