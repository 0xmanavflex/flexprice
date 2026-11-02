import { request } from './settings'

/**
 * Start saving a card for a customer at a payment provider —
 * `POST /payments/customers/{id}/setup/intent`, as V1's "Save card" does.
 *
 * With plain `fetch` because `@flexprice/sdk` has no setup-intent call. The
 * backend creates a hosted setup page at the provider and answers with its
 * address; the customer (or the operator on their behalf) enters the card
 * there, and the provider's `setup_intent.succeeded` webhook saves it.
 */
export async function createCustomerSetupIntent(
  serverURL: string,
  token: string,
  environmentId: string,
  customerId: string,
  body: { provider: string; successUrl: string; cancelUrl: string; setDefault: boolean },
): Promise<{ checkoutUrl: string }> {
  const response = (await request(
    serverURL,
    `/payments/customers/${encodeURIComponent(customerId)}/setup/intent`,
    {
      method: 'POST',
      token,
      environmentId,
      body: {
        provider: body.provider,
        success_url: body.successUrl,
        cancel_url: body.cancelUrl,
        set_default: body.setDefault,
      },
    },
  )) as { checkout_url?: string } | null
  return { checkoutUrl: response?.checkout_url ?? '' }
}
