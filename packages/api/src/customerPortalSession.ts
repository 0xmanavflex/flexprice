import { request } from './settings'

/**
 * `GET /customers/portal/{external_id}` — a session for one customer's portal.
 *
 * Live on the API and absent from `@flexprice/sdk` 2.1.39. Needs write on
 * customers. Answers `{ url, token, expires_at }`. `url` is the full link to
 * the customer's portal as the backend builds it for its region (for example
 * `https://portal.flexprice.io/in?token=…`): the link the console copies and
 * opens. Null when the answer carries no usable web address.
 */
export async function createCustomerPortalSession(
  serverURL: string,
  token: string,
  environmentId: string,
  externalId: string,
): Promise<{ token: string; url: string | null; expiresAt: string | null }> {
  const body = (await request(serverURL, `/customers/portal/${encodeURIComponent(externalId)}`, {
    method: 'GET',
    token,
    environmentId,
  })) as { token?: unknown; url?: unknown; expires_at?: unknown } | null
  const session = typeof body?.token === 'string' ? body.token : ''
  return {
    token: session,
    url: webUrl(body?.url),
    expiresAt: typeof body?.expires_at === 'string' ? body.expires_at : null,
  }
}

/** An http(s) address, or null: a link the console hands to a customer must be a web page. */
function webUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null
  try {
    const url = new URL(value.trim())
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null
  } catch {
    return null
  }
}
