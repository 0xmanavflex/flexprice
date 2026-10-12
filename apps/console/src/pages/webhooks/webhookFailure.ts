import { ApiError } from '@fp/query'
import { type ListFailure, toListFailure } from '../shared/listFailure'

export type Failure = ListFailure

/**
 * Turns a webhook-portal failure into a sentence.
 *
 * Two services can fail here: Flexprice (handing out the portal token) and Svix
 * (everything after). `ApiError` hides which, and the message `@fp/api` wrote is
 * already the user-facing one, so this keeps that wording and otherwise defers
 * to the shared mapping (`toListFailure`) for the retry judgement, the error
 * kind and any `Retry-After`.
 */
export function toWebhookFailure(error: unknown, what: string): Failure | null {
  const base = toListFailure(error, what)
  if (!base || !(error instanceof ApiError)) return base
  switch (error.kind) {
    case 'network':
      return { ...base, message: error.message || 'Could not reach the webhook service.' }
    case 'server':
      return { ...base, message: `The webhook service had a problem loading ${what}.` }
    case 'unauthorized':
      // A Svix token that lapsed mid-session is fixed by asking again.
      return { ...base, message: error.message || base.message, canRetry: true, kind: 'generic' }
    case 'forbidden':
      return { ...base, message: error.message || base.message }
    default:
      return base
  }
}

/** The message a rejected write should show. */
export function writeError(error: unknown, fallback: string): Error {
  return new Error(error instanceof Error && error.message ? error.message : fallback)
}
