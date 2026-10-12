import { ApiError, ErrorKind, kindForStatus, toApiError } from './errors'
import { fetchWithTimeout, transportError } from './timeout'

/**
 * The tenant's webhook portal, spoken to directly.
 *
 * Flexprice does not proxy webhook management. `GET /webhooks/dashboard`
 * (see `settings.ts`) hands the console a Svix **app-portal token** scoped to
 * this environment's Svix application, and from there the console talks to the
 * Svix API itself — exactly what V1 does through `svix-react`. These are the
 * calls V1's portal makes, written as `fetch` against the same REST paths the
 * `svix` SDK uses, so there is no SDK to pin and nothing to keep in step with
 * `svix-react`'s hook shapes.
 *
 * **The token is a live credential.** It signs the holder in to this tenant's
 * webhook configuration, signing secrets included. Nothing here logs it, puts it
 * in an error message or a URL; it travels in the `Authorization` header and
 * nowhere else. The same goes for the endpoint secret `getWebhookEndpointSecret`
 * returns.
 *
 * Svix's JSON is already camelCase. Like the rest of this package the functions
 * return the raw body; `@fp/query` maps it onto `@fp/domain`.
 */

/** Everything a Svix call needs: where, which application, and the portal token. */
export interface SvixSession {
  appId: string
  token: string
  /** Optional override for a self-hosted Svix. Otherwise derived from the token. */
  serverURL?: string | undefined
}

/** Svix's regional API hosts, keyed by the suffix after the token's first `.`. */
const SVIX_REGIONS: Record<string, string> = {
  us: 'https://api.us.svix.com',
  eu: 'https://api.eu.svix.com',
  in: 'https://api.in.svix.com',
  ca: 'https://api.ca.svix.com',
  au: 'https://api.au.svix.com',
}

/**
 * The Svix API base for a token, as the `svix` SDK resolves it.
 *
 * A token minted in a region carries it after the first dot (`sk_….eu`). An
 * explicit server URL wins; a token without a known region goes to the global
 * host.
 */
export function svixServerURL(token: string, override?: string): string {
  if (override) return override.replace(/\/+$/, '')
  const region = token.split('.')[1] ?? ''
  return SVIX_REGIONS[region] ?? 'https://api.svix.com'
}

/** A Svix list page: `iterator` continues it, `done` says there is no more. */
export interface SvixListPage<T> {
  data: T[]
  iterator: string | null
  done: boolean
}

type Query = Record<string, string | number | boolean | Date | readonly string[] | undefined>

function describeSvixFailure(text: string, fallback: string): string {
  try {
    const parsed: unknown = JSON.parse(text)
    if (parsed && typeof parsed === 'object') {
      const detail = (parsed as { detail?: unknown }).detail
      if (typeof detail === 'string' && detail.length > 0) return detail
      // Validation failures arrive as `[{loc, msg, type}]`.
      if (Array.isArray(detail)) {
        const messages = detail
          .map((entry: unknown) =>
            entry && typeof entry === 'object' ? (entry as { msg?: unknown }).msg : undefined,
          )
          .filter((msg): msg is string => typeof msg === 'string')
        if (messages.length > 0) return messages.join(' ')
      }
    }
  } catch {
    // Not JSON.
  }
  return fallback
}

function encodeQuery(query: Query | undefined): string {
  if (!query) return ''
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) continue
    if (Array.isArray(value)) {
      for (const item of value) params.append(key, String(item))
    } else if (value instanceof Date) {
      params.set(key, value.toISOString())
    } else {
      params.set(key, String(value))
    }
  }
  const encoded = params.toString()
  return encoded ? `?${encoded}` : ''
}

/** One request path for every Svix call; failures leave as `ApiError`. */
export async function svixRequest(
  session: SvixSession,
  path: string,
  init: { method: string; query?: Query; body?: unknown } = { method: 'GET' },
): Promise<unknown> {
  if (!session.token || !session.appId) {
    throw new ApiError(ErrorKind.Forbidden, 'Webhooks are not set up for this environment.')
  }
  const url = `${svixServerURL(session.token, session.serverURL)}${path}${encodeQuery(init.query)}`

  let response: Response
  try {
    response = await fetchWithTimeout(url, {
      method: init.method,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.token}`,
      },
      ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
    })
  } catch (cause) {
    const failure = transportError(cause)
    throw failure.kind === ErrorKind.Network
      ? new ApiError(ErrorKind.Network, 'Could not reach the webhook service.', { cause })
      : failure
  }

  const text = await response.text()
  if (!response.ok) {
    const message = describeSvixFailure(
      text,
      response.status === 401
        ? 'The webhook portal session expired. Reload to start a new one.'
        : `The webhook service refused the request (${response.status}).`,
    )
    throw new ApiError(kindForStatus(response.status), message, { status: response.status })
  }
  if (text.length === 0) return null
  try {
    return JSON.parse(text)
  } catch (cause) {
    throw toApiError(cause)
  }
}

function app(session: SvixSession): string {
  return `/api/v1/app/${encodeURIComponent(session.appId)}`
}

function seg(value: string): string {
  return encodeURIComponent(value)
}

/* ---- endpoints ---------------------------------------------------------- */

export function listWebhookEndpoints(
  session: SvixSession,
  options: { limit?: number; iterator?: string | undefined } = {},
): Promise<unknown> {
  return svixRequest(session, `${app(session)}/endpoint`, {
    method: 'GET',
    query: { limit: options.limit ?? 250, iterator: options.iterator, order: 'descending' },
  })
}

export function getWebhookEndpoint(session: SvixSession, endpointId: string): Promise<unknown> {
  return svixRequest(session, `${app(session)}/endpoint/${seg(endpointId)}`)
}

/** `EndpointIn`. `filterTypes` is omitted, not `[]`, for "every event": Svix rejects an empty list. */
export interface SvixEndpointIn {
  url: string
  description?: string | undefined
  filterTypes?: string[] | undefined
  rateLimit?: number | null | undefined
  disabled?: boolean | undefined
}

export function createWebhookEndpoint(
  session: SvixSession,
  endpoint: SvixEndpointIn,
): Promise<unknown> {
  return svixRequest(session, `${app(session)}/endpoint`, {
    method: 'POST',
    body: {
      url: endpoint.url,
      version: 1,
      ...(endpoint.description ? { description: endpoint.description } : {}),
      ...(endpoint.filterTypes && endpoint.filterTypes.length > 0
        ? { filterTypes: endpoint.filterTypes }
        : {}),
    },
  })
}

/**
 * `PUT` — replaces the endpoint's settings. Send every field you want kept;
 * `filterTypes: null` means every event type.
 */
export function updateWebhookEndpoint(
  session: SvixSession,
  endpointId: string,
  endpoint: Omit<SvixEndpointIn, 'filterTypes'> & { filterTypes: string[] | null },
): Promise<unknown> {
  return svixRequest(session, `${app(session)}/endpoint/${seg(endpointId)}`, {
    method: 'PUT',
    body: {
      url: endpoint.url,
      description: endpoint.description ?? '',
      filterTypes:
        endpoint.filterTypes && endpoint.filterTypes.length > 0 ? endpoint.filterTypes : null,
      rateLimit: endpoint.rateLimit ?? null,
      disabled: endpoint.disabled ?? false,
    },
  })
}

export async function deleteWebhookEndpoint(
  session: SvixSession,
  endpointId: string,
): Promise<void> {
  await svixRequest(session, `${app(session)}/endpoint/${seg(endpointId)}`, { method: 'DELETE' })
}

/** The signing secret (`whsec_…`). A credential: show it on request, never log it. */
export function getWebhookEndpointSecret(
  session: SvixSession,
  endpointId: string,
): Promise<unknown> {
  return svixRequest(session, `${app(session)}/endpoint/${seg(endpointId)}/secret`)
}

/** Rotates the signing secret; the previous one keeps verifying for 24 hours. */
export async function rotateWebhookEndpointSecret(
  session: SvixSession,
  endpointId: string,
): Promise<void> {
  await svixRequest(session, `${app(session)}/endpoint/${seg(endpointId)}/secret/rotate`, {
    method: 'POST',
    body: { key: null },
  })
}

export function getWebhookEndpointStats(
  session: SvixSession,
  endpointId: string,
  window: { since?: Date; until?: Date } = {},
): Promise<unknown> {
  return svixRequest(session, `${app(session)}/endpoint/${seg(endpointId)}/stats`, {
    method: 'GET',
    query: { since: window.since, until: window.until },
  })
}

export function getWebhookEndpointHeaders(
  session: SvixSession,
  endpointId: string,
): Promise<unknown> {
  return svixRequest(session, `${app(session)}/endpoint/${seg(endpointId)}/headers`)
}

/**
 * `PATCH` the headers: sets the ones named in `headers`, removes `deleteHeaders`,
 * and leaves the rest — including sensitive ones whose values the client never
 * sees, which a `PUT` of the visible set would silently delete.
 */
export async function patchWebhookEndpointHeaders(
  session: SvixSession,
  endpointId: string,
  patch: { headers: Record<string, string>; deleteHeaders?: string[] },
): Promise<void> {
  await svixRequest(session, `${app(session)}/endpoint/${seg(endpointId)}/headers`, {
    method: 'PATCH',
    body: {
      headers: patch.headers,
      ...(patch.deleteHeaders && patch.deleteHeaders.length > 0
        ? { deleteHeaders: patch.deleteHeaders }
        : {}),
    },
  })
}

/** Sends the event type's registered example to one endpoint. 400 `missing_schema` if it has none. */
export function sendWebhookExample(
  session: SvixSession,
  endpointId: string,
  eventType: string,
): Promise<unknown> {
  return svixRequest(session, `${app(session)}/endpoint/${seg(endpointId)}/send-example`, {
    method: 'POST',
    body: { eventType },
  })
}

/** Re-sends every message that failed on this endpoint since `since`. */
export function recoverWebhookEndpoint(
  session: SvixSession,
  endpointId: string,
  since: Date,
): Promise<unknown> {
  return svixRequest(session, `${app(session)}/endpoint/${seg(endpointId)}/recover`, {
    method: 'POST',
    body: { since: since.toISOString() },
  })
}

/* ---- event catalog ------------------------------------------------------ */

export function listWebhookEventTypes(
  session: SvixSession,
  options: { limit?: number; iterator?: string | undefined } = {},
): Promise<unknown> {
  return svixRequest(session, '/api/v1/event-type', {
    method: 'GET',
    query: { limit: options.limit ?? 250, iterator: options.iterator, with_content: true },
  })
}

/* ---- messages and attempts ---------------------------------------------- */

/** Svix's numeric `MessageStatus`: 0 success, 1 pending, 2 fail, 3 sending. */
export type SvixMessageStatus = 0 | 1 | 2 | 3

export function listWebhookMessages(
  session: SvixSession,
  options: { limit?: number; iterator?: string | undefined; eventTypes?: string[] } = {},
): Promise<unknown> {
  return svixRequest(session, `${app(session)}/msg`, {
    method: 'GET',
    query: {
      limit: options.limit ?? 100,
      iterator: options.iterator,
      with_content: true,
      event_types:
        options.eventTypes && options.eventTypes.length > 0 ? options.eventTypes : undefined,
    },
  })
}

export function getWebhookMessage(session: SvixSession, messageId: string): Promise<unknown> {
  return svixRequest(session, `${app(session)}/msg/${seg(messageId)}`)
}

/** Every attempt at delivering one message, across endpoints, newest first. */
export function listWebhookMessageAttempts(
  session: SvixSession,
  messageId: string,
  options: { status?: SvixMessageStatus | undefined; endpointId?: string | undefined } = {},
): Promise<unknown> {
  return svixRequest(session, `${app(session)}/attempt/msg/${seg(messageId)}`, {
    method: 'GET',
    query: { limit: 100, status: options.status, endpoint_id: options.endpointId },
  })
}

/** Messages one endpoint was sent, each with its latest status there. */
export function listWebhookEndpointMessages(
  session: SvixSession,
  endpointId: string,
  options: { status?: SvixMessageStatus | undefined; limit?: number } = {},
): Promise<unknown> {
  return svixRequest(session, `${app(session)}/endpoint/${seg(endpointId)}/msg`, {
    method: 'GET',
    query: { limit: options.limit ?? 100, status: options.status, with_content: true },
  })
}

/** Re-delivers one message to one endpoint, now. */
export async function resendWebhookMessage(
  session: SvixSession,
  messageId: string,
  endpointId: string,
): Promise<void> {
  await svixRequest(
    session,
    `${app(session)}/msg/${seg(messageId)}/endpoint/${seg(endpointId)}/resend`,
    { method: 'POST' },
  )
}

/* ---- Svix Play ---------------------------------------------------------- */

const SVIX_PLAY_TOKEN_URL = 'https://api.play.svix.com/api/v1/token/generate/'

/**
 * A throwaway public inbox from Svix Play, for trying an endpoint before a real
 * receiver exists. The public Play API, not the tenant's portal: no credential
 * is sent. Mirrors V1's `generateSvixPlayEndpoint`.
 */
export async function generateSvixPlayEndpoint(): Promise<{
  ingestUrl: string
  inspectorUrl: string
}> {
  let response: Response
  try {
    response = await fetch(SVIX_PLAY_TOKEN_URL, { method: 'POST' })
  } catch (cause) {
    throw new ApiError(ErrorKind.Network, 'Could not reach Svix Play.', { cause })
  }
  if (!response.ok) {
    throw new ApiError(
      kindForStatus(response.status),
      `Svix Play could not create a test URL (${response.status}).`,
      { status: response.status },
    )
  }
  const raw: unknown = await response.json().catch(() => null)
  const token =
    typeof raw === 'string'
      ? raw
      : raw && typeof raw === 'object' && typeof (raw as { token?: unknown }).token === 'string'
        ? (raw as { token: string }).token
        : ''
  if (!token) throw new ApiError(ErrorKind.Unknown, 'Svix Play sent back an unusable answer.')
  return {
    ingestUrl: `https://play.svix.com/in/${token}/`,
    inspectorUrl: `https://play.svix.com/#${token}`,
  }
}
