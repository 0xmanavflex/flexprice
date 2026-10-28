import { request } from './settings'

/**
 * The payments list, which carries the billing entity.
 *
 * Not an SDK call; replaced when the SDK gains the field. Returns the raw JSON;
 * `@fp/query` maps it.
 */
export interface ListPaymentsParams {
  limit: number
  offset: number
  /** Only payments collected against this destination, e.g. an invoice. */
  destinationId?: string
  destinationType?: string
}

export async function listPayments(
  serverURL: string,
  token: string,
  environmentId: string,
  params: ListPaymentsParams,
  signal?: AbortSignal,
): Promise<unknown> {
  const search = new URLSearchParams({
    limit: String(params.limit),
    offset: String(params.offset),
  })
  if (params.destinationId) search.set('destination_id', params.destinationId)
  if (params.destinationType) search.set('destination_type', params.destinationType)
  return request(serverURL, `/payments?${search.toString()}`, {
    method: 'GET',
    token,
    environmentId,
    ...(signal ? { signal } : {}),
  })
}
