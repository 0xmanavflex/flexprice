import { ApiError } from '@fp/query'

/** A save failure, as a sentence the dialog can show inline. */
export function toSubmitError(error: unknown, verb = 'save'): string | null {
  if (!error) return null

  if (error instanceof ApiError) {
    switch (error.kind) {
      // A duplicate lookup key is the common one; the server's own message names the field.
      case 'invalid': {
        const detail = error.details ? Object.values(error.details)[0] : undefined
        return detail || error.message || 'Check the details and try again.'
      }
      case 'forbidden':
        return 'You do not have permission to change products here.'
      case 'network':
        return 'Could not reach Flexprice. Check your connection and try again.'
      default:
        return `Could not ${verb} the product. Try again.`
    }
  }
  return `Could not ${verb} the product. Try again.`
}
