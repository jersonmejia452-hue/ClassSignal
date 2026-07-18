import { useState } from 'react'

import { getOrCreateAnonymousId } from '../lib/storageMigration'

function createAnonymousId() {
  return crypto.randomUUID()
}

function resolveAnonymousId() {
  try {
    return getOrCreateAnonymousId(window.localStorage, createAnonymousId)
  } catch {
    return createAnonymousId()
  }
}

export function useAnonymousId() {
  const [anonymousId] = useState(resolveAnonymousId)
  return anonymousId
}
