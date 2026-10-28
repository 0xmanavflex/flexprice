import { request } from './settings'

/**
 * Invoice reads that carry billing-entity fields.
 *
 * Not an SDK call; replaced when the SDK gains the field. The search body is
 * the backend's snake_case JSON and the result is the raw JSON; `@fp/query`
 * maps it.
 */
export async function searchInvoices(
  serverURL: string,
  token: string,
  environmentId: string,
  body: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<unknown> {
  return request(serverURL, '/invoices/search', {
    method: 'POST',
    token,
    environmentId,
    body,
    ...(signal ? { signal } : {}),
  })
}

export async function getInvoice(
  serverURL: string,
  token: string,
  environmentId: string,
  id: string,
  signal?: AbortSignal,
): Promise<unknown> {
  return request(serverURL, `/invoices/${encodeURIComponent(id)}`, {
    method: 'GET',
    token,
    environmentId,
    ...(signal ? { signal } : {}),
  })
}
