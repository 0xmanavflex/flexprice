import { ApiError, ErrorKind } from '@fp/query'

/**
 * Turns a failed sign-in into a sentence worth reading.
 *
 * This deliberately does **not** forward `error.message`, and the live API is
 * the reason. `POST /auth/login` answers a wrong password with
 * `{"code":"permission_denied","message":"Failed to get user","http_status_code":403}`
 * and an unknown address with `404 {"message":"User not found with the provided
 * email"}`. Neither is usable copy:
 *
 *   - "Failed to get user" describes a backend call stack, not the thing the
 *     person did. It reads as a system fault, so the natural response is to
 *     retry the same password rather than to check it.
 *   - "User not found with the provided email" is an account-enumeration
 *     oracle. Anyone can learn which addresses have Flexprice accounts by
 *     watching 404 against 403, and the console should not put that difference
 *     on screen in plain English.
 *
 * And neither message would arrive anyway: `readErrorBody` digs a message out
 * of `{ error: { message } }`, while these bodies carry `message` at the top
 * level, so what actually reaches here is the HTTP status text. Rendering that
 * would show the user the word "Forbidden".
 *
 * So the *kind* is what is mapped, and the two credential outcomes deliberately
 * collapse to one sentence. A network failure stays distinct, because that one
 * genuinely changes what the person should do next: nothing they type will
 * help until they are back online. A timeout, a rate limit and a server fault
 * are likewise told apart from a wrong password: the first two say the details
 * were not judged, and the rate limit says how long to wait.
 */
export function messageForSignInError(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return 'Something went wrong signing in. Try again.'
  }

  switch (error.kind) {
    case ErrorKind.Network:
      return 'Could not reach Flexprice. Check your connection and try again.'
    case ErrorKind.Timeout:
      return 'Signing in took too long. Your details were not rejected; try again.'
    case ErrorKind.RateLimited: {
      const seconds = error.retryAfterMs ? Math.ceil(error.retryAfterMs / 1000) : 0
      return seconds > 0
        ? `Too many sign-in attempts. Try again in ${seconds} ${seconds === 1 ? 'second' : 'seconds'}.`
        : 'Too many sign-in attempts. Wait a moment, then try again.'
    }
    case ErrorKind.Unauthorized:
    case ErrorKind.Forbidden:
    case ErrorKind.NotFound:
      return 'That email and password do not match.'
    case ErrorKind.Server:
      return 'Flexprice is having trouble right now. Try again in a moment.'
    default:
      // An `Invalid` carries a real field-level complaint from the API, so its
      // own words are better than anything this function could substitute.
      return error.message
  }
}
