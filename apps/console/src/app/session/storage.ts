/**
 * The session, as it survives a refresh.
 *
 * Two keys rather than one object, because they have different lifetimes: the
 * credentials outlive a tenant switch, the chosen environment must not. Keeping
 * them separate makes "clear the environment but keep the session" a delete
 * rather than a read-modify-write.
 *
 * Every access is wrapped. `localStorage` is not a plain object on the web: it
 * throws on *read* in Safari private mode, throws on write when the origin's
 * quota is full, and is absent entirely in a non-DOM environment. A console
 * that white-screens because a browser setting made a getter throw is a worse
 * failure than one that simply asks the user to sign in again, so every path
 * here degrades to "signed out" instead of propagating.
 */

const SESSION_KEY = 'flexprice.session'
const ENVIRONMENT_KEY = 'flexprice.environment'

/** The credentials a signed-in console holds. Mirrors `SessionCredentials`. */
export interface StoredSession {
  token: string
  userId: string
  tenantId: string
}

function store(): Storage | null {
  try {
    // Touching the property is itself what throws in a blocked-storage browser,
    // which is why this is inside the try and not a truthiness check outside it.
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

function readRaw(key: string): string | null {
  try {
    return store()?.getItem(key) ?? null
  } catch {
    return null
  }
}

function writeRaw(key: string, value: string): void {
  try {
    store()?.setItem(key, value)
  } catch {
    // A full or read-only quota is not worth failing a sign-in over. The
    // session still works for this tab; it just will not survive a refresh.
  }
}

function removeRaw(key: string): void {
  try {
    store()?.removeItem(key)
  } catch {
    // Nothing useful to do. Treated as already gone.
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

/**
 * The stored session, or null.
 *
 * Anything that is not a complete, token-bearing record reads as signed out.
 * A half-written entry: a token-less object from an older shape of this file,
 * a value someone edited in devtools: must not sign a user in to a console
 * whose every request will then 401.
 */
export function readSession(): StoredSession | null {
  const raw = readRaw(SESSION_KEY)
  if (raw === null) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    // Not JSON. Drop it rather than leaving a poison value that fails forever.
    removeRaw(SESSION_KEY)
    return null
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
  const record = parsed as Record<string, unknown>
  if (!isNonEmptyString(record['token'])) return null

  return {
    token: record['token'],
    // The ids are informational: the token is what authenticates. A session
    // missing them is still usable, so they degrade to empty rather than
    // rejecting the whole record.
    userId: typeof record['userId'] === 'string' ? record['userId'] : '',
    tenantId: typeof record['tenantId'] === 'string' ? record['tenantId'] : '',
  }
}

export function writeSession(session: StoredSession): void {
  writeRaw(SESSION_KEY, JSON.stringify(session))
}

export function clearSession(): void {
  removeRaw(SESSION_KEY)
}

/** The active environment id, or null when one has not been chosen. */
export function readEnvironmentId(): string | null {
  const raw = readRaw(ENVIRONMENT_KEY)
  return isNonEmptyString(raw) ? raw : null
}

export function writeEnvironmentId(id: string): void {
  writeRaw(ENVIRONMENT_KEY, id)
}

export function clearEnvironmentId(): void {
  removeRaw(ENVIRONMENT_KEY)
}
