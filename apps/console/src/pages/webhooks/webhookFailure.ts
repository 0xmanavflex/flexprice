import { ApiError } from '@fp/query'

export interface Failure {
  message: string
  canRetry: boolean
}

/**
 * Turns a webhook-portal failure into a sentence.
 *
 * Two services can fail here: Flexprice (handing out the portal token) and Svix
 * (everything after). `ApiError` hides which, and the message `@fp/api` wrote is
 * already the user-facing one, so this only decides whether a retry is worth
 * offering.
 */
export function toWebhookFailure(error: unknown, what: string): Failure | null {
  if (!error) return null
  if (error instanceof ApiError) {
    switch (error.kind) {
      case 'network':
        return { message: error.message || 'Could not reach the webhook service.', canRetry: true }
      case 'server':
        return { message: `The webhook service had a problem loading ${what}.`, canRetry: true }
      case 'unauthorized':
        return {
          message: error.message || 'Your session has expired. Sign in again.',
          canRetry: true,
        }
      case 'forbidden':
        return { message: error.message || `You do not have access to ${what}.`, canRetry: false }
      default:
        return { message: error.message, canRetry: false }
    }
  }
  return { message: `Something went wrong loading ${what}.`, canRetry: true }
}

/** The message a rejected write should show. */
export function writeError(error: unknown, fallback: string): Error {
  return new Error(error instanceof Error && error.message ? error.message : fallback)
}
