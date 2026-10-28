import { request } from './settings'

/**
 * Connections, the list the SDK cannot make.
 *
 * `GET /connections` is live (V1's `ConnectionApi.List` calls it) but the
 * OpenAPI document does not describe it, so like `usageRecords.ts` this speaks
 * `fetch` directly and is not an `@fp/sdk-adapter` shim. Returns the raw JSON;
 * `@fp/query` maps it.
 */
export async function listConnections(
  serverURL: string,
  token: string,
  environmentId: string,
  billingEntityId?: string,
): Promise<unknown> {
  const query = new URLSearchParams({ status: 'published', limit: '100' })
  if (billingEntityId) query.set('billing_entity_id', billingEntityId)
  return request(serverURL, `/connections?${query}`, {
    method: 'GET',
    token,
    environmentId,
  })
}

export interface ConnectionRequest {
  name: string
  provider_type: string
  /** Absent for a connection Flexprice manages itself, e.g. a managed S3 bucket. */
  encrypted_secret_data?: Record<string, string>
  metadata?: Record<string, string>
  sync_config?: Record<string, unknown>
  billing_entity_id?: string
}

export interface ConnectionUpdate {
  name?: string
  metadata?: Record<string, string>
  sync_config?: Record<string, unknown>
  encrypted_secret_data?: Record<string, string>
  billing_entity_id?: string
}

export interface OAuthInitRequest {
  provider: string
  name: string
  credentials: Record<string, string>
  metadata?: Record<string, string>
  sync_config?: Record<string, unknown>
  billing_entity_id?: string
}

export interface OAuthCompleteRequest {
  provider: string
  session_id: string
  code: string
  state: string
  realm_id?: string
  organization_id?: string
}

export async function createConnection(
  serverURL: string,
  token: string,
  environmentId: string,
  body: ConnectionRequest,
): Promise<unknown> {
  return request(serverURL, '/connections', { method: 'POST', token, environmentId, body })
}

export async function getConnection(
  serverURL: string,
  token: string,
  environmentId: string,
  id: string,
): Promise<unknown> {
  return request(serverURL, `/connections/${encodeURIComponent(id)}`, {
    method: 'GET',
    token,
    environmentId,
  })
}

export async function updateConnection(
  serverURL: string,
  token: string,
  environmentId: string,
  id: string,
  body: ConnectionUpdate,
): Promise<unknown> {
  return request(serverURL, `/connections/${encodeURIComponent(id)}`, {
    method: 'PUT',
    token,
    environmentId,
    body,
  })
}

/** Archives the connection. There is no hard delete. */
export async function deleteConnection(
  serverURL: string,
  token: string,
  environmentId: string,
  id: string,
): Promise<void> {
  await request(serverURL, `/connections/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    token,
    environmentId,
  })
}

/** Starts the QuickBooks / Zoho consent flow; returns `{ oauth_url, session_id }`. */
export async function oauthInit(
  serverURL: string,
  token: string,
  environmentId: string,
  body: OAuthInitRequest,
): Promise<unknown> {
  return request(serverURL, '/oauth/init', { method: 'POST', token, environmentId, body })
}

export async function oauthComplete(
  serverURL: string,
  token: string,
  environmentId: string,
  body: OAuthCompleteRequest,
): Promise<unknown> {
  return request(serverURL, '/oauth/complete', { method: 'POST', token, environmentId, body })
}
