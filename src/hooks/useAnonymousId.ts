import { useState } from 'react'

const anonymousIdKey = 'aula-clara:anonymous-id:v1'

function createAnonymousId() {
  return crypto.randomUUID()
}

function getOrCreateAnonymousId() {
  try {
    const storedId = window.localStorage.getItem(anonymousIdKey)
    if (storedId) return storedId

    const nextId = createAnonymousId()
    window.localStorage.setItem(anonymousIdKey, nextId)
    return nextId
  } catch {
    return createAnonymousId()
  }
}

export function useAnonymousId() {
  const [anonymousId] = useState(getOrCreateAnonymousId)
  return anonymousId
}
