/**
 * The hand-off from a SAML assertion to a console session.
 *
 * The backend finishes a SAML login by redirecting the browser to
 * `auth.saml.dashboard_url`: `/auth/callback` by default: with the token in
 * the **URL fragment**, not the query:
 *
 *     /auth/callback#token=…&tenant_id=…&state=…
 *
 * A fragment is never sent to a server, which is why the token travels there;
 * but it is still in browser history and readable by any script on the page,
 * so the backend's own note says the dashboard must clear it the moment it has
 * been read. {@link readHandoff} is the only reader, and the callback clears
 * the fragment immediately after.
 *
 * `tenant_id` is **not** an identity. The backend is explicit that it travels
 * so the dashboard can confirm the callback answers the login this browser
 * started, and that a mismatch must be refused: otherwise a token minted for
 * one tenant can be planted on a browser part-way through signing in to
 * another. {@link rememberTenant} records the tenant when the flow starts and
 * {@link takeTenant} reads it back exactly once.
 *
 * Storage is passed in rather than reached for, as `listMemory` does next
 * door. It keeps the one security decision here testable without a browser or
 * a stubbed global: and the global is not dependable anyway: it is absent
 * under SSR, absent in Node 24 (which CI runs) and throws outright in a
 * private window.
 */

/** Where the started-login tenant waits. Session-scoped: a login is one tab's. */
const PENDING_TENANT_KEY = 'fp.saml.pendingTenant'

/**
 * Where the nonce for the login in progress waits.
 *
 * The tenant says a login to this tenant began; it cannot say *which* one,
 * because every login to a tenant carries the same value: the backend's own
 * note makes exactly this point about RelayState. The nonce can: one per
 * sign-in, out as RelayState, back with the assertion, compared here. A token
 * from any other login to the same tenant, including one in flight, does not
 * carry it.
 */
const PENDING_STATE_KEY = 'fp.saml.pendingState'

export interface SamlHandoff {
  token: string
  tenantId: string
  /** The relay state the backend echoed, when the login carried one. */
  state?: string
}

export type HandoffResult =
  | { ok: true; handoff: SamlHandoff }
  /**
   * Why it was refused, in words the screen can show.
   *
   * `reason` is deliberately coarse. A caller that could tell "no token" from
   * "wrong tenant" on screen would be telling whoever planted the URL which
   * of the two they got wrong.
   */
  | { ok: false; reason: 'missing' | 'rejected' }

/**
 * Read the hand-off out of a URL fragment.
 *
 * Pure, so the awkward parts: an empty fragment, a stray `#`, a token with
 * `=` in it: are testable without a browser. Takes `location.hash` as it
 * comes, leading `#` and all.
 */
export function parseFragment(hash: string): SamlHandoff | null {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash
  if (raw.length === 0) return null

  const values = new URLSearchParams(raw)
  const token = values.get('token')?.trim() ?? ''
  const tenantId = values.get('tenant_id')?.trim() ?? ''
  // Both or neither: a token with no tenant cannot be checked against the
  // login that started, and a tenant with no token signs nobody in.
  if (token === '' || tenantId === '') return null

  const state = values.get('state')?.trim()
  return { token, tenantId, ...(state ? { state } : {}) }
}

/** Absent under SSR and in Node, and throws in a private window; neither is an error here. */
export type MaybeStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | undefined

/**
 * Random, unguessable, and short enough for RelayState.
 *
 * Well under the 80 bytes the SAML profile allows (SAMLProfiles 3.6.3.1);
 * identity providers may reject or truncate anything longer.
 */
export function newNonce(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * Record that this browser is starting an SSO login, and with what nonce.
 *
 * Returns the nonce to send as RelayState. A browser that cannot store it
 * gets one anyway: the callback will refuse, which is the safe direction,
 * and refusing here instead would be the same outcome with a worse message.
 */
export function startLogin(tenantId: string, storage: MaybeStorage): string {
  const nonce = newNonce()
  try {
    storage?.setItem(PENDING_TENANT_KEY, tenantId)
    storage?.setItem(PENDING_STATE_KEY, nonce)
  } catch {
    /* See above: the callback refuses rather than this throwing. */
  }
  return nonce
}

/** Read what the started login recorded, and forget it. One login, one use. */
export function takeStarted(storage: MaybeStorage): {
  tenantId: string | null
  nonce: string | null
} {
  if (!storage) return { tenantId: null, nonce: null }
  try {
    const tenantId = storage.getItem(PENDING_TENANT_KEY)
    const nonce = storage.getItem(PENDING_STATE_KEY)
    storage.removeItem(PENDING_TENANT_KEY)
    storage.removeItem(PENDING_STATE_KEY)
    return { tenantId, nonce }
  } catch {
    return { tenantId: null, nonce: null }
  }
}

/**
 * The whole check, in one place.
 *
 * Refuses when the fragment carries nothing to use, and when the tenant it
 * names is not the tenant this browser started a login to: including the
 * case where no login was started here at all. That last one is the attack
 * the backend describes: a link pasted into a browser that never began a
 * flow has no recorded tenant to agree with, so it is refused rather than
 * trusted for want of something to compare against.
 */
export function readHandoff(hash: string, storage: MaybeStorage): HandoffResult {
  const handoff = parseFragment(hash)
  if (!handoff) return { ok: false, reason: 'missing' }

  const started = takeStarted(storage)
  // Both must agree. The tenant says a login to this tenant began here; the
  // nonce says it was *this* login and not another to the same tenant.
  if (started.tenantId === null || started.tenantId !== handoff.tenantId) {
    return { ok: false, reason: 'rejected' }
  }
  if (started.nonce === null || started.nonce !== handoff.state) {
    return { ok: false, reason: 'rejected' }
  }
  return { ok: true, handoff }
}
