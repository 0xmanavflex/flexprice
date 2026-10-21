import { ApiError, kindForStatus, parseRetryAfter, readErrorBody, toApiError } from './errors'
import { fetchWithTimeout, transportError } from './timeout'

/**
 * A request authenticated by a link's session token, not the console session:
 * the hosted invoice (`/public/v1`) and the customer portal
 * (`/v1/customer/portal`). No API key, no environment header — the token names
 * the tenant, environment and customer — and the page's address never leaves
 * in a `Referer`. Throws `ApiError`, like the rest of `@fp/api`.
 */
export async function publicRequest(
  apiOrigin: string,
  path: string,
  init: {
    method: string
    token: string
    body?: unknown
    query?: Record<string, string | readonly string[] | undefined>
  },
): Promise<unknown> {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(init.query ?? {})) {
    if (value === undefined) continue
    for (const item of typeof value === 'string' ? [value] : value) params.append(key, item)
  }
  const query = params.toString()
  const search = query ? `?${query}` : ''
  const url = `${apiOrigin.replace(/\/+$/, '')}${path}${search}`
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
