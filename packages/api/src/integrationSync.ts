import { request } from './settings'

/**
 * Push one entity to every provider whose outbound sync is on for its type —
 * `POST /integrations/sync` with `method: 'push'`.
 *
 * With plain `fetch` because `@flexprice/sdk` 2.1.39 has no sync call. The
 * request names no provider: the backend writes the entity to each connection
 * that syncs this entity type outbound, creating it there when it is not yet
 * mapped. It answers once the sync is queued, not when the provider has it.
 */
export async function pushToIntegrations(
  serverURL: string,
  token: string,
  environmentId: string,
  entity: { entityType: string; entityId: string },
  method: 'push' | 'pull' = 'push',
): Promise<void> {
  await request(serverURL, '/integrations/sync', {
    method: 'POST',
    token,
    environmentId,
    body: { entity_type: entity.entityType, entity_id: entity.entityId, method },
  })
}
