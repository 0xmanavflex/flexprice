import { request } from './settings'

/**
 * `DELETE /taxes/associations/{id}`, sent with `fetch` rather than the SDK.
 *
 * The API answers a successful removal with 200 and an empty body. The SDK
 * declares a `TaxAssociationResponse` body for that 200 and rejects the empty
 * one, so a removal that worked surfaced as "The request failed (200)" and the
 * caller never refreshed. `request` treats any 2xx as success and still throws
 * on a real 4xx/5xx, so nothing else is swallowed.
 */
export async function deleteTaxAssociation(
  serverURL: string,
  token: string,
  environmentId: string,
  associationId: string,
): Promise<void> {
  await request(serverURL, `/taxes/associations/${encodeURIComponent(associationId)}`, {
    method: 'DELETE',
    token,
    environmentId,
  })
}
