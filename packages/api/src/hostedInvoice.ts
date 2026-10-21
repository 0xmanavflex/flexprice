import { publicRequest } from './publicRequest'

/**
 * The public hosted invoice routes: view, download and pay one invoice by the
 * token in its hosted link.
 *
 * `/public/v1` carries no swagger annotations, so these routes are not in the
 * SDK; `publicRequest` (shared with the customer portal) speaks `fetch`
 * directly and throws `ApiError`.
 * The routes take no API key, session or environment — only the link's token
 * in `X-Session-Token` — and the page's address never leaves in a `Referer`.
 */

export function getHostedInvoice(apiOrigin: string, token: string): Promise<unknown> {
  return publicRequest(apiOrigin, '/public/v1/invoices', { method: 'GET', token })
}

export function getHostedInvoiceDownload(apiOrigin: string, token: string): Promise<unknown> {
  return publicRequest(apiOrigin, '/public/v1/invoices/pdf', { method: 'GET', token })
}

export function payHostedInvoice(
  apiOrigin: string,
  token: string,
  idempotencyKey: string,
): Promise<unknown> {
  return publicRequest(apiOrigin, '/public/v1/invoices/pay', {
    method: 'POST',
    token,
    body: { idempotency_key: idempotencyKey },
  })
}
