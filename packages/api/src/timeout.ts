import type { Fetcher } from '@flexprice/sdk'
import { ApiError, ErrorKind } from './errors'

/**
 * How long a request may wait for the API to start answering.
 *
 * Long enough for a slow report, short enough that a hung connection becomes a
 * retryable "took too long" rather than a skeleton that never resolves.
 */
export const DEFAULT_REQUEST_TIMEOUT_MS = 20_000

function timeoutReason(): Error {
  return new DOMException('The request timed out.', 'TimeoutError')
}

function abortReason(): Error {
  return new DOMException('The request was aborted.', 'AbortError')
}

/**
 * Runs `base` under a deadline, merged with the caller's own signal.
 *
 * The rejection reason distinguishes the two ways out — `TimeoutError` when the
 * deadline passed, `AbortError` when the caller cancelled — which is what lets
 * the layers above say "slow" and "cancelled" instead of "offline" for both.
 *
 * The deadline covers the wait for response headers. Once the API has started
 * answering, the timer is released so a large body is never cut off mid-read.
 */
export function withDeadline(
  base: Fetcher,
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  timeoutMs: number,
): Promise<Response> {
  const upstream = init?.signal ?? (input instanceof Request ? input.signal : undefined)
  if (upstream?.aborted) return Promise.reject(abortReason())
  if (!(timeoutMs > 0)) return base(input, init)

  const controller = new AbortController()
  const onAbort = () => controller.abort(abortReason())
  upstream?.addEventListener('abort', onAbort, { once: true })
  const timer = setTimeout(() => controller.abort(timeoutReason()), timeoutMs)

  return base(input, { ...init, signal: controller.signal }).finally(() => {
    clearTimeout(timer)
    upstream?.removeEventListener('abort', onAbort)
  })
}

/** Wraps a fetcher so every call it makes has a deadline. */
export function withTimeout(base: Fetcher, timeoutMs: number): Fetcher {
  return (input, init) => withDeadline(base, input, init, timeoutMs)
}

const globalFetcher: Fetcher = (input, init) => fetch(input, init)

/** `fetch` with a deadline, for the routes the SDK cannot reach. */
export function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit,
  timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
): Promise<Response> {
  return withDeadline(globalFetcher, input, init, timeoutMs)
}

/**
 * Classifies a rejected `fetch`.
 *
 * `fetch` rejects only for transport, so there is no status; the reason on the
 * rejection is the only evidence of whether it was slow, cancelled or offline.
 */
export function transportError(cause: unknown): ApiError {
  const name = typeof cause === 'object' && cause !== null && 'name' in cause ? cause.name : ''
  if (name === 'TimeoutError') {
    return new ApiError(ErrorKind.Timeout, 'Flexprice took too long to respond.', { cause })
  }
  if (name === 'AbortError') {
    return new ApiError(ErrorKind.Cancelled, 'The request was cancelled.', { cause })
  }
  return new ApiError(ErrorKind.Network, 'Could not reach Flexprice.', { cause })
}
