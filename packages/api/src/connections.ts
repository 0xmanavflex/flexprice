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
): Promise<unknown> {
  return request(serverURL, '/connections?status=published&limit=100', {
    method: 'GET',
    token,
    environmentId,
  })
}
