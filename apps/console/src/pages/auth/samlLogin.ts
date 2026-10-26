import { startLogin, type MaybeStorage } from '../../app/session/samlHandoff'

/**
 * Starting a SAML login from the sign-in screen.
 *
 * SSO is configured **per tenant**, so the browser has to say which tenant it
 * means before anyone has authenticated. That comes from the link a tenant's
 * administrator hands out: `/sign-in?sso=tenant_abc`: rather than from
 * anything typed here: an end user has no reason to know a tenant id, and
 * asking them to paste one would be worse than a bookmark.
 *
 * The button is not gated on the deployment. SAML is a per-tenant feature, so
 * a hosted deployment may still serve tenants that sign in through an identity
 * provider, and gating on the deployment hid SSO from every one of them. It is
 * safe to offer to a tenant that has not set SSO up, because
 * {@link startSamlLogin} asks first and says so on a 404.
 */

/** The query parameter naming the tenant whose identity provider should handle this login. */
export const SSO_TENANT_PARAM = 'sso'

/** The tenant to offer SSO for, or nothing: which means no button. */
export function resolveSsoTenant(param: string | null | undefined): string | undefined {
  return param?.trim() || undefined
}

export type SsoStart = { ok: true; url: string } | { ok: false; reason: 'unavailable' }

/**
 * Work out where to send the browser, and whether to send it at all.
 *
 * Returns a URL for the caller to navigate to rather than navigating itself:
 * a full page navigation is required: the browser must carry its own session
 * to the identity provider, and it is the browser the assertion is posted back
 * through, so an XHR would break both halves: but that is the page's job, and
 * keeping it out of here is what makes this testable.
 *
 * The endpoint answers 404 when SSO is not live for the tenant: not
 * configured, not enabled, or not yet approved. Navigating blind would land
 * the browser on the API's JSON error body with no way back, so it is asked
 * first with `redirect: 'manual'`, which keeps this probe from following the
 * redirect and consuming the login.
 *
 * A network or CORS failure says nothing about whether SSO works, so it falls
 * through to the navigation rather than refusing a login that may well
 * succeed. Only a definite 404 stops it.
 */
export async function startSamlLogin(
  tenantId: string,
  apiBaseUrl: string,
  storage: MaybeStorage,
  fetchImpl: typeof fetch = fetch,
): Promise<SsoStart> {
  const base = apiBaseUrl.replace(/\/$/, '')
  const loginUrl = `${base}/auth/saml/${encodeURIComponent(tenantId)}/login`

  try {
    const probe = await fetchImpl(loginUrl, { method: 'GET', redirect: 'manual' })
    if (probe.status === 404) return { ok: false, reason: 'unavailable' }
  } catch {
    /* Says nothing about SSO; go on and let the navigation decide. */
  }

  // The nonce rides along as RelayState and comes back with the assertion,
  // which is what ties the callback to this login rather than to any other
  // login to the same tenant.
  const nonce = startLogin(tenantId, storage)
  return { ok: true, url: `${loginUrl}?state=${encodeURIComponent(nonce)}` }
}
