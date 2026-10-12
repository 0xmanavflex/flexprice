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
  /** No usable response — offline, DNS, CORS, aborted. */
  Network: 'network',
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

export class ApiError extends Error {
  readonly kind: ErrorKind
  readonly status: number | undefined
  /** Field-level messages, when the API sent them. Feeds form error mapping. */
  readonly details: Record<string, string> | undefined
  /** From a `Retry-After` header on a 429, in milliseconds. */
  readonly retryAfterMs: number | undefined

  constructor(
    kind: ErrorKind,
    message: string,
    options: {
      status?: number
      details?: Record<string, string>
      cause?: unknown
      retryAfterMs?: number
    } = {},
  ) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause })
    this.name = 'ApiError'
    this.kind = kind
    this.status = options.status
    this.details = options.details
    this.retryAfterMs = options.retryAfterMs
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
 * Digs the human-readable message out of `{ success: false, error: {...} }`.
 *
 * `FlexPriceError.body` is the raw response text, so this has to parse and then
 * distrust what it parsed — a 502 from a load balancer is HTML, and a truncated
 * response is nothing at all. Anything unrecognised falls back to the caller's
 * message rather than surfacing a JSON fragment to a user.
 */
export function readErrorBody(
  body: string,
  fallback: string,
): { message: string; details?: Record<string, string> } {
  let parsed: unknown
  try {
    parsed = JSON.parse(body)
  } catch {
    return { message: fallback }
  }

  if (parsed && typeof parsed === 'object' && 'error' in parsed) {
    const inner = (parsed as { error: unknown }).error
    if (inner && typeof inner === 'object') {
      const { message, details } = inner as { message?: unknown; details?: unknown }
      if (typeof message === 'string' && message.length > 0) {
        return isStringMap(details) ? { message, details } : { message }
      }
    }
  }
  return { message: fallback }
}

function isStringMap(value: unknown): value is Record<string, string> {
  return (
    !!value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.values(value).every((v) => typeof v === 'string')
  )
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
    const { message, details } = readErrorBody(
      cause.body,
      cause.rawResponse.statusText || 'The request failed.',
    )
    return new ApiError(kindForStatus(cause.statusCode), message, {
      status: cause.statusCode,
      ...(details ? { details } : {}),
      cause,
    })
  }

  if (
    cause instanceof ConnectionError ||
    cause instanceof RequestTimeoutError ||
    cause instanceof RequestAbortedError
  ) {
    return new ApiError(ErrorKind.Network, cause.message, { cause })
  }

  return new ApiError(
    ErrorKind.Unknown,
    cause instanceof Error ? cause.message : 'Something went wrong.',
    { cause },
  )
}
