import { request } from './settings'

/**
 * Customer reads and create that carry billing-entity fields.
 *
 * Not an SDK call; replaced when the SDK gains the field. Bodies are the
 * backend's snake_case JSON and the result is the raw JSON; `@fp/query` maps it.
 */
export async function searchCustomers(
  serverURL: string,
  token: string,
  environmentId: string,
  body: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<unknown> {
  return request(serverURL, '/customers/search', {
    method: 'POST',
    token,
    environmentId,
    body,
    ...(signal ? { signal } : {}),
  })
}

export async function getCustomer(
  serverURL: string,
  token: string,
  environmentId: string,
  id: string,
  signal?: AbortSignal,
): Promise<unknown> {
  return request(serverURL, `/customers/${encodeURIComponent(id)}`, {
    method: 'GET',
    token,
    environmentId,
    ...(signal ? { signal } : {}),
  })
}

export async function createCustomer(
  serverURL: string,
  token: string,
  environmentId: string,
  body: Record<string, unknown>,
): Promise<unknown> {
  return request(serverURL, '/customers', { method: 'POST', token, environmentId, body })
}
