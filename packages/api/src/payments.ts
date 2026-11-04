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
  /** Only payments of this billing entity; sent only while entities are enabled. */
  billingEntityId?: string
  /** The column to order by (`created_at`) and its direction. */
  sort?: string
  order?: 'asc' | 'desc'
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
  if (params.billingEntityId) search.set('billing_entity_id', params.billingEntityId)
  if (params.sort) search.set('sort', params.sort)
  if (params.order) search.set('order', params.order)
  return request(serverURL, `/payments?${search.toString()}`, {
    method: 'GET',
    token,
    environmentId,
    ...(signal ? { signal } : {}),
  })
}
