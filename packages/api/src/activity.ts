import { request } from './settings'

/**
 * `POST /activity` with `expand: ["state"]`.
 *
 * The route is on `@flexprice/sdk`, but its generated `state` schema is
 * `z.object({})`, which strips every key. A list through the SDK therefore
 * comes back with an empty snapshot, and the rail cannot show an amount.
 * This reads the JSON itself so the entity snapshot survives.
 *
 * With `expand`, the API caps `limit` at 50.
 */
export interface ListActivityParams {
  customerId?: string
  entityType?: string
  entityId?: string
  limit?: number
}

export async function listActivity(
  serverURL: string,
  token: string,
  environmentId: string,
  params: ListActivityParams,
): Promise<unknown> {
  return request(serverURL, '/activity', {
    method: 'POST',
    token,
    environmentId,
    body: {
      ...(params.customerId ? { customer_id: params.customerId } : {}),
      ...(params.entityType ? { entity_type: params.entityType } : {}),
      ...(params.entityId ? { entity_id: params.entityId } : {}),
      expand: ['state'],
      limit: params.limit ?? 20,
    },
  })
}
