import { request } from './settings'

/**
 * An invoice's customer-facing link — `hosted_invoice_url` on `GET /invoices/{id}`.
 *
 * Read with plain `fetch` because `@flexprice/sdk` 2.1.39 does not declare the
 * field and its response schema drops fields it does not know. The backend
 * answers Stripe's hosted URL when the invoice synced to Stripe, otherwise the
 * Flexprice hosted invoice page for its active token (when the deployment sets
 * `hosted_invoice.base_url`). Null when the invoice has neither — a draft, or a
 * deployment that does not serve the page.
 */
export async function fetchInvoiceHostedLink(
  serverURL: string,
  token: string,
  environmentId: string,
  invoiceId: string,
): Promise<string | null> {
  const body = (await request(serverURL, `/invoices/${encodeURIComponent(invoiceId)}`, {
    method: 'GET',
    token,
    environmentId,
  })) as { hosted_invoice_url?: unknown } | null
  const url = body?.hosted_invoice_url
  return typeof url === 'string' && url.trim() ? url.trim() : null
}
