import { ApiError, serverReason } from '@fp/query'

/** A save failure, as a sentence the form can show inline. */
export function toSubmitError(error: unknown, verb = 'save'): string | null {
  if (!error) return null

  if (error instanceof ApiError) {
    switch (error.kind) {
      // A duplicate lookup key is the common one; the server's own message names the field.
      case 'invalid':
        return error.message || 'Check the details and try again.'
      case 'forbidden':
        return serverReason(error) ?? 'You do not have permission to change coupons here.'
      case 'network':
        return 'Could not reach Flexprice. Check your connection and try again.'
      default:
        return serverReason(error) ?? `Could not ${verb} the coupon. Try again.`
    }
  }
  return `Could not ${verb} the coupon. Try again.`
}
