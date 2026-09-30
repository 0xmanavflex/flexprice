import { request } from './settings'

/**
 * Usage records, the list the SDK cannot make.
 *
 * The OpenAPI document has no `POST /usage-records/search` although the route
 * is live (V1's `UsageRecordApi.searchUsageRecords` calls it), so like
 * `creditNotes.ts` this speaks `fetch` directly and is not an
 * `@fp/sdk-adapter` shim. Returns the raw JSON; `@fp/query` maps it.
 */
export interface SearchUsageRecordsParams {
  limit: number
  offset: number
  /** `true` for records pushed to a marketplace, `false` for those not yet. Omit for both. */
  synced?: boolean
  customerId?: string
  subscriptionId?: string
}

export async function searchUsageRecords(
  serverURL: string,
  token: string,
  environmentId: string,
  params: SearchUsageRecordsParams,
): Promise<unknown> {
  return request(serverURL, '/usage-records/search', {
    method: 'POST',
    token,
    environmentId,
    body: {
      limit: params.limit,
      offset: params.offset,
      ...(params.synced === undefined ? {} : { synced: params.synced }),
      ...(params.customerId ? { customer_id: params.customerId } : {}),
      ...(params.subscriptionId ? { subscription_id: params.subscriptionId } : {}),
    },
  })
}
