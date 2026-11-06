import { request } from './settings'

/**
 * Invoice reads that carry billing-entity fields.
 *
 * Not an SDK call; replaced when the SDK gains the field. The search body is
 * the backend's snake_case JSON and the result is the raw JSON; `@fp/query`
 * maps it.
 */
export async function searchInvoices(
  serverURL: string,
  token: string,
  environmentId: string,
  body: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<unknown> {
  return request(serverURL, '/invoices/search', {
    method: 'POST',
    token,
    environmentId,
    body,
    ...(signal ? { signal } : {}),
  })
}

export async function getInvoice(
  serverURL: string,
  token: string,
  environmentId: string,
  id: string,
  signal?: AbortSignal,
): Promise<unknown> {
  // The expand attaches each applied tax's rate (name, code, percentage).
  return request(serverURL, `/invoices/${encodeURIComponent(id)}?expand=tax_applied.tax_rate`, {
    method: 'GET',
    token,
    environmentId,
    ...(signal ? { signal } : {}),
  })
}

/**
 * A link to the invoice's PDF: `GET /invoices/{id}/pdf?url=true`, which
 * renders the PDF if needed and answers `{ presigned_url }`. The invoice record
 * itself carries `invoice_pdf_url` only when one was set on it, so reading that
 * left most finalized invoices without a download. V1 asks this route.
 */
export async function getInvoicePdfUrl(
  serverURL: string,
  token: string,
  environmentId: string,
  id: string,
  signal?: AbortSignal,
): Promise<string | null> {
  const body = (await request(serverURL, `/invoices/${encodeURIComponent(id)}/pdf?url=true`, {
    method: 'GET',
    token,
    environmentId,
    ...(signal ? { signal } : {}),
  })) as { presigned_url?: unknown } | null
  return typeof body?.presigned_url === 'string' && body.presigned_url ? body.presigned_url : null
}
