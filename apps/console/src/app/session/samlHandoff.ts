/**
 * The hand-off from a SAML assertion to a console session.
 *
 * The backend finishes a SAML login by redirecting the browser to
 * `auth.saml.dashboard_url` — `/auth/callback` by default — with the token in
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
 * started, and that a mismatch must be refused — otherwise a token minted for
 * one tenant can be planted on a browser part-way through signing in to
 * another. {@link rememberTenant} records the tenant when the flow starts and
 * {@link takeTenant} reads it back exactly once.
 *
 * Storage is passed in rather than reached for, as `listMemory` does next
 * door. It keeps the one security decision here testable without a browser or
 * a stubbed global — and the global is not dependable anyway: it is absent
 * under SSR, absent in Node 24 (which CI runs) and throws outright in a
 * private window.
 */

/** Where the started-login tenant waits. Session-scoped: a login is one tab's. */
const PENDING_TENANT_KEY = 'fp.saml.pendingTenant'

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
 * Pure, so the awkward parts — an empty fragment, a stray `#`, a token with
 * `=` in it — are testable without a browser. Takes `location.hash` as it
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

/** Record the tenant whose SSO this browser is starting. */
export function rememberTenant(tenantId: string, storage: MaybeStorage): void {
  try {
    storage?.setItem(PENDING_TENANT_KEY, tenantId)
  } catch {
    /* A browser that cannot store it will refuse the callback. See below. */
  }
}

/** Read the started-login tenant and forget it. One login, one use. */
export function takeTenant(storage: MaybeStorage): string | null {
  if (!storage) return null
  try {
    const value = storage.getItem(PENDING_TENANT_KEY)
    storage.removeItem(PENDING_TENANT_KEY)
    return value
  } catch {
    return null
  }
}

/**
 * The whole check, in one place.
 *
 * Refuses when the fragment carries nothing to use, and when the tenant it
 * names is not the tenant this browser started a login to — including the
 * case where no login was started here at all. That last one is the attack
 * the backend describes: a link pasted into a browser that never began a
 * flow has no recorded tenant to agree with, so it is refused rather than
 * trusted for want of something to compare against.
 */
export function readHandoff(hash: string, storage: MaybeStorage): HandoffResult {
  const handoff = parseFragment(hash)
  if (!handoff) return { ok: false, reason: 'missing' }

  const started = takeTenant(storage)
  if (started === null || started !== handoff.tenantId) {
    return { ok: false, reason: 'rejected' }
  }
  return { ok: true, handoff }
}
