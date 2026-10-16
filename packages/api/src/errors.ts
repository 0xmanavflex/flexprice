import {
  ConnectionError,
  FlexPriceError,
  RequestAbortedError,
  RequestTimeoutError,
  ResponseValidationError,
} from '@flexprice/sdk'

/**
 * One error shape for everything that leaves this package.
 *
 * The SDK throws several unrelated classes — `FlexPriceError` for an HTTP
 * failure, `ConnectionError` and `RequestTimeoutError` for transport, a plain
 * `Error` for anything unforeseen — and its HTTP body arrives as an unparsed
 * string. The UI should branch on *kind*, not on which class the SDK happened
 * to construct, so every caller can write `if (err.kind === 'forbidden')` and
 * nothing above this layer imports an SDK error type.
 */
export const ErrorKind = {
  /** No usable response — offline, DNS, CORS. */
  Network: 'network',
  /**
   * The caller abandoned the request (a query was cancelled, a component
   * unmounted). Not a failure: nothing should be shown and nothing retried.
   */
  Cancelled: 'cancelled',
  /** The request outlived its deadline. Safe to retry; says "slow", not "offline". */
  Timeout: 'timeout',
  /** 429 — too many requests. Retry only after `retryAfterMs`. */
  RateLimited: 'rate_limited',
  /** 401 — the session is gone or was never valid. */
  Unauthorized: 'unauthorized',
  /** 403 — authenticated, but not allowed. Often a missing environment. */
  Forbidden: 'forbidden',
  NotFound: 'not_found',
  /** 4xx the caller can fix by sending something else. */
  Invalid: 'invalid',
  /** 5xx — retryable, and not the caller's fault. */
  Server: 'server',
  Unknown: 'unknown',
} as const

export type ErrorKind = (typeof ErrorKind)[keyof typeof ErrorKind]

/**
 * A `Retry-After` header as milliseconds.
 *
 * The header is either whole seconds ("30") or an HTTP date. Anything else is
 * undefined rather than guessed, and a date already in the past is zero, which
 * means "retry now". Browsers only expose the header to a cross-origin page if
 * the API lists it in `Access-Control-Expose-Headers`; when it does not, this
 * is simply undefined and callers fall back to their own backoff.
 */
export function parseRetryAfter(
  value: string | null | undefined,
  now = Date.now(),
): number | undefined {
  if (value === null || value === undefined) return undefined
  const text = value.trim()
  if (text.length === 0) return undefined
  if (/^\d+(\.\d+)?$/.test(text)) return Math.round(Number(text) * 1000)
  // An HTTP date always names its month; this rejects "-5" and similar, which
  // Date.parse would otherwise read as a year in the distant past.
  if (!/[a-z]/i.test(text)) return undefined
  const at = Date.parse(text)
  if (Number.isNaN(at)) return undefined
  return Math.max(0, at - now)
}

export class ApiError extends Error {
  readonly kind: ErrorKind
  readonly status: number | undefined
  /** Field-level messages, when the API sent them. Feeds form error mapping. */
  readonly details: Record<string, string> | undefined
  /** From a `Retry-After` header on a 429, in milliseconds. */
  readonly retryAfterMs: number | undefined
  /**
   * Whether `message` is the server's own sentence, read from the response
   * body, rather than one this package made up (a status, a transport fault).
   * Screens prefer a server sentence to their generic copy: it says why.
   */
  readonly fromServer: boolean

  constructor(
    kind: ErrorKind,
    message: string,
    options: {
      status?: number
      details?: Record<string, string>
      cause?: unknown
      retryAfterMs?: number
      fromServer?: boolean
    } = {},
  ) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause })
    this.name = 'ApiError'
    this.kind = kind
    this.status = options.status
    this.details = options.details
    this.retryAfterMs = options.retryAfterMs
    this.fromServer = options.fromServer ?? false
  }

  /** True when retrying the identical request could plausibly succeed. */
  get retryable(): boolean {
    return (
      this.kind === ErrorKind.Network ||
      this.kind === ErrorKind.Timeout ||
      this.kind === ErrorKind.Server
    )
  }
}

export function kindForStatus(status: number): ErrorKind {
  if (status === 401) return ErrorKind.Unauthorized
  if (status === 403) return ErrorKind.Forbidden
  if (status === 404) return ErrorKind.NotFound
  if (status === 429) return ErrorKind.RateLimited
  if (status >= 500) return ErrorKind.Server
  if (status >= 400) return ErrorKind.Invalid
  return ErrorKind.Unknown
}

/**
 * Digs the human-readable message out of a failed response.
 *
 * The backend answers in several envelopes: `{ success: false, error: { message } }`,
 * the flat `{ code, message, http_status_code }` its error handler writes, and
 * `{ error: "Access denied", message }` from the auth middleware. Each carries
 * the one sentence worth showing, and missing it meant the screen showed the
 * HTTP status text instead — which over HTTP/2 is empty, so "The request
 * failed (403)".
 *
 * `FlexPriceError.body` is the raw response text, so this has to parse and then
 * distrust what it parsed — a 502 from a load balancer is HTML, and a truncated
 * response is nothing at all. Anything unrecognised falls back to the caller's
 * message rather than surfacing a JSON fragment to a user.
 */
export function readErrorBody(
  body: string,
  fallback: string,
): { message: string; details?: Record<string, string>; fromServer?: boolean } {
  let parsed: unknown
  try {
    parsed = JSON.parse(body)
  } catch {
    return { message: fallback }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { message: fallback }
  const root = parsed as Record<string, unknown>
  const text = (value: unknown): string | null =>
    typeof value === 'string' && value.trim().length > 0 ? value.trim() : null

  // `{ success: false, error: { message, details } }` — the documented envelope.
  const inner = root['error']
  if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
    const { message, details } = inner as { message?: unknown; details?: unknown }
    const said = text(message)
    if (said) return withDetails(said, details)
  }

  // `{ code, message, http_status_code, details }` — what `ierr` handlers send —
  // and `{ error: "Access denied", message }` from the auth middleware. The
  // message is the sentence; a string `error` is only a label for it.
  const message = text(root['message'])
  if (message) return withDetails(message, root['details'])

  // Supabase (`msg`, `error_description`), or a bare `{ error: "…" }`.
  const other = text(root['msg']) ?? text(root['error_description']) ?? text(inner)
  return other ? { message: other, fromServer: true } : { message: fallback }
}

/** Keeps the string-valued details (field → complaint); anything else is not for display. */
function withDetails(
  message: string,
  details: unknown,
): { message: string; details?: Record<string, string>; fromServer: true } {
  if (!details || typeof details !== 'object' || Array.isArray(details)) {
    return { message, fromServer: true }
  }
  const strings = Object.fromEntries(
    Object.entries(details as Record<string, unknown>).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  )
  return Object.keys(strings).length > 0
    ? { message, details: strings, fromServer: true }
    : { message, fromServer: true }
}

/**
 * Normalizes anything the SDK can throw.
 *
 * Every call site funnels through here, so adding a new SDK error class is a
 * change in one file rather than a new `instanceof` branch in every hook.
 */
export function toApiError(cause: unknown): ApiError {
  if (cause instanceof ApiError) return cause

  /*
   * A response the server was happy with and the SDK was not.
   *
   * This has to come before the `FlexPriceError` branch, because
   * `ResponseValidationError` extends it — and going through that branch
   * produced the worst message in the app. The status is the *successful* one,
   * so `kindForStatus` returned `unknown` and the message fell back to
   * `statusText`: a schema mismatch rendered an error box titled **"OK"**,
   * indistinguishable from a 403. That is exactly how we found it — a fixture
   * sent `tax_rate_type: "PERCENTAGE"` where the SDK's enum accepts only
   * `"percentage"`, and the screen blamed permissions.
   *
   * It is not the caller's fault and retrying cannot fix it: the client and
   * the server disagree about the contract. Saying so is more useful than any
   * HTTP status, because the fix is a regenerated SDK or a backend change.
   */
  if (cause instanceof ResponseValidationError) {
    return new ApiError(
      ErrorKind.Unknown,
      'Flexprice returned data this version of the console does not understand. This is a version mismatch, not something you did.',
      { status: cause.statusCode, cause },
    )
  }

  if (cause instanceof FlexPriceError) {
    const { message, details, fromServer } = readErrorBody(
      cause.body,
      cause.rawResponse.statusText || `The request failed (${cause.statusCode}).`,
    )
    const retryAfterMs =
      cause.statusCode === 429 || cause.statusCode === 503
        ? parseRetryAfter(cause.rawResponse.headers.get('retry-after'))
        : undefined
    return new ApiError(kindForStatus(cause.statusCode), message, {
      status: cause.statusCode,
      ...(details ? { details } : {}),
      ...(fromServer ? { fromServer } : {}),
      ...(retryAfterMs !== undefined ? { retryAfterMs } : {}),
      cause,
    })
  }

  // The three transport outcomes are different things to a person: the network
  // is down, the API is slow, or the caller walked away. Only the first two are
  // ever shown, and only the second says "slow" rather than "offline".
  if (cause instanceof RequestTimeoutError) {
    return new ApiError(ErrorKind.Timeout, 'Flexprice took too long to respond.', { cause })
  }
  if (cause instanceof RequestAbortedError) {
    return new ApiError(ErrorKind.Cancelled, 'The request was cancelled.', { cause })
  }
  if (cause instanceof ConnectionError) {
    return new ApiError(ErrorKind.Network, cause.message, { cause })
  }

  return new ApiError(
    ErrorKind.Unknown,
    cause instanceof Error ? cause.message : 'Something went wrong.',
    { cause },
  )
}

/**
 * The server's own reason for a failure, when it sent one.
 *
 * Screens map an error's kind to their own sentence ("You do not have
 * permission to change plans here"), which is right when the server said
 * nothing useful and wrong when it did: a 403 can mean a missing role, an
 * environment the session cannot reach, or a business rule, and only the
 * server's message tells them apart. Prefer this, and keep the screen's own
 * copy as the fallback.
 */
export function serverReason(error: unknown): string | null {
  return error instanceof ApiError && error.fromServer && error.message ? error.message : null
}
