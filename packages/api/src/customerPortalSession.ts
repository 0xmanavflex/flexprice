import { request } from './settings'

/**
 * `GET /customers/portal/{external_id}` — a session for one customer's portal.
 *
 * Live on the API and absent from `@flexprice/sdk` 2.1.39. Needs write on
 * customers. Answers `{ url, token, expires_at }`; `url` is the backend's
 * configured portal address, which (as in V1) the console does not use: it
 * builds the link to its own portal surface, so the link always opens the
 * portal this deployment serves.
 */
export async function createCustomerPortalSession(
  serverURL: string,
  token: string,
  environmentId: string,
  externalId: string,
): Promise<{ token: string; expiresAt: string | null }> {
  const body = (await request(serverURL, `/customers/portal/${encodeURIComponent(externalId)}`, {
    method: 'GET',
    token,
    environmentId,
  })) as { token?: unknown; expires_at?: unknown } | null
  const session = typeof body?.token === 'string' ? body.token : ''
  return {
    token: session,
    expiresAt: typeof body?.expires_at === 'string' ? body.expires_at : null,
  }
}
