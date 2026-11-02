import { request } from './settings'

/**
 * Credit notes, the list the SDK cannot make.
 *
 * `client.creditNotes` exposes create, get, process and void, but no list: the
 * OpenAPI document omits `GET /creditnotes` although the route is live (V1's
 * `CreditNoteApi.getCreditNotes` calls it). Like `settings.ts` this speaks
 * `fetch` directly and is not an `@fp/sdk-adapter` shim, so annotating the
 * handler makes deleting this file a diff. Returns the raw JSON; `@fp/query`
 * maps it.
 */
export interface ListCreditNotesParams {
  limit: number
  offset: number
  /** Wire statuses, e.g. `DRAFT`. Empty means all. */
  statuses?: string[]
  /** Only the credit notes issued against this invoice. */
  invoiceId?: string
  /** Only credit notes of this billing entity; sent only while entities are enabled. */
  billingEntityId?: string
}

export async function listCreditNotes(
  serverURL: string,
  token: string,
  environmentId: string,
  params: ListCreditNotesParams,
): Promise<unknown> {
  const search = new URLSearchParams({
    limit: String(params.limit),
    offset: String(params.offset),
  })
  for (const status of params.statuses ?? []) search.append('credit_note_status', status)
  if (params.invoiceId) search.set('invoice_id', params.invoiceId)
  if (params.billingEntityId) search.set('billing_entity_id', params.billingEntityId)
  return request(serverURL, `/creditnotes?${search.toString()}`, {
    method: 'GET',
    token,
    environmentId,
  })
}
