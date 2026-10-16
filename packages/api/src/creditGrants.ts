import { request } from './settings'

/**
 * Credit grants, the list the SDK cannot make.
 *
 * `client.creditGrants` exposes create, get, update, delete and the two
 * single-owner reads (`getPlanCreditGrants`, `getAddonCreditGrants`), but no
 * list: the OpenAPI document omits `GET /creditgrants` although the route is
 * live and takes a repeated `plan_ids`. Without it a grid column counting
 * grants costs one request per row; with it, one per page.
 *
 * `plan_ids` is the filter the route honours — `plan_id` (singular) is
 * accepted and silently ignored, so a caller that sends it gets every grant
 * in the environment back and counts them all against one plan. Verified
 * against the live API, not inferred.
 *
 * Like `settings.ts` and `creditNotes.ts` this speaks `fetch` directly rather
 * than being an `@fp/sdk-adapter` shim, so that deleting the file once the SDK
 * catches up is a diff rather than an archaeology exercise. Returns the raw
 * JSON; `@fp/query` maps it.
 */
export interface ListCreditGrantsParams {
  limit: number
  offset: number
  /** Only the grants attached to these plans. Empty means all of them. */
  planIds?: string[]
}

export async function listCreditGrants(
  serverURL: string,
  token: string,
  environmentId: string,
  params: ListCreditGrantsParams,
): Promise<unknown> {
  const search = new URLSearchParams({
    limit: String(params.limit),
    offset: String(params.offset),
  })
  for (const planId of params.planIds ?? []) search.append('plan_ids', planId)
  return request(serverURL, `/creditgrants?${search.toString()}`, {
    method: 'GET',
    token,
    environmentId,
  })
}
