import { ApiError, ErrorKind } from '@fp/query'
import { ConfirmationLinkInvalid } from '../../app/auth/signUpErrors'

/** Why the account could not be finished, as a sentence. */
export function messageForConfirmError(error: unknown): string {
  if (error instanceof ConfirmationLinkInvalid) {
    // Supabase's own sentence arrives without a full stop.
    const reason = /[.!?]$/.test(error.message) ? error.message : `${error.message}.`
    return `${reason} Sign in if you already confirmed it, or sign up again for a new link.`
  }
  if (error instanceof ApiError) {
    if (error.status === 409) {
      return 'An account with this email already exists. Sign in instead.'
    }
    switch (error.kind) {
      case ErrorKind.Network:
        return 'Could not reach Flexprice. Check your connection, then open the link again.'
      case ErrorKind.Forbidden:
      case ErrorKind.Unauthorized:
        return 'Your email is not confirmed yet. Open the link in the latest email we sent.'
      case ErrorKind.Server:
        return 'Flexprice is having trouble right now. Open the link again in a moment.'
      default:
        break
    }
  }
  return 'Your account could not be created. Open the link again, or sign up again.'
}
