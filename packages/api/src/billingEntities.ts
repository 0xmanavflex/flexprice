import { request } from './settings'

/**
 * Billing entities, the routes the SDK cannot make yet.
 *
 * Not an SDK call; replaced when the SDK gains the field. Everything is per
 * environment (`X-Environment-ID`). Returns the raw JSON; `@fp/query` maps it.
 */
export interface ListBillingEntitiesParams {
  limit: number
  offset: number
  isDefault?: boolean
}

export async function getBillingEntityStatus(
  serverURL: string,
  token: string,
  environmentId: string,
  signal?: AbortSignal,
): Promise<unknown> {
  return request(serverURL, '/billing-entities/status', {
    method: 'GET',
    token,
    environmentId,
    ...(signal ? { signal } : {}),
  })
}

/** Super admins only. 202 while the environment's customers are assigned, 200 once enabled. */
export async function enableBillingEntities(
  serverURL: string,
  token: string,
  environmentId: string,
): Promise<unknown> {
  return request(serverURL, '/billing-entities/enable', { method: 'POST', token, environmentId })
}

export async function listBillingEntities(
  serverURL: string,
  token: string,
  environmentId: string,
  params: ListBillingEntitiesParams = { limit: 100, offset: 0 },
  signal?: AbortSignal,
): Promise<unknown> {
  const search = new URLSearchParams({
    limit: String(params.limit),
    offset: String(params.offset),
  })
  if (params.isDefault !== undefined) search.set('is_default', String(params.isDefault))
  return request(serverURL, `/billing-entities?${search.toString()}`, {
    method: 'GET',
    token,
    environmentId,
    ...(signal ? { signal } : {}),
  })
}

export async function getBillingEntity(
  serverURL: string,
  token: string,
  environmentId: string,
  id: string,
  signal?: AbortSignal,
): Promise<unknown> {
  return request(serverURL, `/billing-entities/${encodeURIComponent(id)}`, {
    method: 'GET',
    token,
    environmentId,
    ...(signal ? { signal } : {}),
  })
}

export async function createBillingEntity(
  serverURL: string,
  token: string,
  environmentId: string,
  body: Record<string, unknown>,
): Promise<unknown> {
  return request(serverURL, '/billing-entities', { method: 'POST', token, environmentId, body })
}

export async function updateBillingEntity(
  serverURL: string,
  token: string,
  environmentId: string,
  id: string,
  body: Record<string, unknown>,
): Promise<unknown> {
  return request(serverURL, `/billing-entities/${encodeURIComponent(id)}`, {
    method: 'PUT',
    token,
    environmentId,
    body,
  })
}
