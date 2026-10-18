import { ApiError, kindForStatus, parseRetryAfter, readErrorBody, toApiError } from './errors'
import { fetchWithTimeout, transportError } from './timeout'

/**
 * The public hosted invoice routes: view, download and pay one invoice by the
 * token in its hosted link.
 *
 * `/public/v1` carries no swagger annotations, so these routes are not in the
 * SDK; like `settings.ts` this speaks `fetch` directly and throws `ApiError`.
 * The routes take no API key, session or environment — only the link's token
 * in `X-Session-Token` — and the page's address never leaves in a `Referer`.
 */

export function getHostedInvoice(apiOrigin: string, token: string): Promise<unknown> {
  return publicRequest(apiOrigin, '/public/v1/invoices', { method: 'GET', token })
}

export function getHostedInvoiceDownload(apiOrigin: string, token: string): Promise<unknown> {
  return publicRequest(apiOrigin, '/public/v1/invoices/download', { method: 'GET', token })
}

export function payHostedInvoice(apiOrigin: string, token: string, idempotencyKey: string): Promise<unknown> {
  return publicRequest(apiOrigin, '/public/v1/invoices/pay', {
    method: 'POST',
    token,
    body: { idempotency_key: idempotencyKey },
  })
}

async function publicRequest(
  apiOrigin: string,
  path: string,
  init: { method: string; token: string; body?: unknown },
): Promise<unknown> {
  const url = `${apiOrigin.replace(/\/+$/, '')}${path}`
  const headers = new Headers({ 'X-Session-Token': init.token })
  if (init.body !== undefined) headers.set('Content-Type', 'application/json')

  let response: Response
  try {
    response = await fetchWithTimeout(url, {
      method: init.method,
      headers,
      referrerPolicy: 'no-referrer',
      ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
    })
  } catch (cause) {
    throw transportError(cause)
  }

  const text = await response.text()

  if (!response.ok) {
    const { message, details, fromServer } = readErrorBody(
      text,
      response.statusText || `The request failed (${response.status}).`,
    )
    const retryAfterMs = parseRetryAfter(response.headers.get('retry-after'))
    throw new ApiError(kindForStatus(response.status), message, {
      status: response.status,
      ...(details ? { details } : {}),
      ...(fromServer ? { fromServer } : {}),
      ...(response.status === 429 && retryAfterMs !== undefined ? { retryAfterMs } : {}),
    })
  }

  if (text.length === 0) return null
  try {
    return JSON.parse(text)
  } catch (cause) {
    throw toApiError(cause)
  }
}
