import { ApiError } from '@fp/query'
import type { ErrorKind as UiErrorKind } from '@fp/ui/compositions'

export interface ListFailure {
  message: string
  canRetry: boolean
  /** Picks the figure and tone in `ErrorState`. */
  kind: UiErrorKind
  /** Present on a 429 that sent `Retry-After`. */
  retryAfterMs?: number
}

/**
 * A failed query as a sentence, a retry judgement and an error kind. One
 * mapping for every list and detail page, so "forbidden" never offers a retry
 * and a timeout never reads as "offline".
 *
 * `noun` is what was being loaded: "plans", "this invoice".
 */
export function toListFailure(error: unknown, noun: string): ListFailure | null {
  if (!error) return null
  if (error instanceof ApiError) {
    switch (error.kind) {
      case 'forbidden':
        return {
          message: `Your role does not include access to ${noun}.`,
          canRetry: false,
          kind: 'denied',
        }
      case 'unauthorized':
        return {
          message: 'Your session has expired. Sign in again.',
          canRetry: false,
          kind: 'denied',
        }
      case 'not_found':
        return {
          message: `We could not find ${noun}. It may have been deleted.`,
          canRetry: false,
          kind: 'unavailable',
        }
      case 'network':
        return { message: 'Could not reach Flexprice.', canRetry: true, kind: 'network' }
      case 'timeout':
        return { message: `Loading ${noun} took too long.`, canRetry: true, kind: 'timeout' }
      case 'rate_limited':
        return {
          message: 'Too many requests. Give it a moment.',
          canRetry: true,
          kind: 'rate-limited',
          ...(error.retryAfterMs ? { retryAfterMs: error.retryAfterMs } : {}),
        }
      case 'server':
        return {
          message: `Flexprice had a problem loading ${noun}.`,
          canRetry: true,
          kind: 'server',
        }
      default:
        return { message: error.message, canRetry: false, kind: 'generic' }
    }
  }
  return { message: `Something went wrong loading ${noun}.`, canRetry: true, kind: 'generic' }
}
