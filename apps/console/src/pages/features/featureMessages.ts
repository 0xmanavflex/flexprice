import { ApiError, serverReason } from '@fp/query'

/** The server's field complaint, as a sentence. "expression has no variables" → "Expression has no variables." */
function complaint(error: ApiError): string | undefined {
  const said = error.details?.['error']
  const text = said ?? Object.entries(error.details ?? {}).find(([key]) => key !== 'expression')?.[1]
  if (!text) return undefined
  const trimmed = text.trim()
  const capped = trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
  return /[.!?]$/.test(capped) ? capped : `${capped}.`
}

/**
 * When the API refused the custom aggregation expression, the sentence to show
 * on that field. Null for any other failure.
 */
export function expressionFieldError(error: unknown): string | null {
  if (!(error instanceof ApiError) || error.kind !== 'invalid') return null
  const said = error.details?.['error'] ?? ''
  if (!error.details?.['expression'] && !/expression/i.test(said)) return null
  return complaint(error) ?? null
}

/** A save failure, as a sentence the dialog can show inline. */
export function toSubmitError(error: unknown, verb = 'save'): string | null {
  if (!error) return null

  if (error instanceof ApiError) {
    switch (error.kind) {
      // A duplicate lookup key is the common one; the server's own message names the field.
      case 'invalid':
        return complaint(error) || error.message || 'Check the details and try again.'
      case 'forbidden':
        return serverReason(error) ?? 'You do not have permission to change features here.'
      case 'network':
        return 'Could not reach Flexprice. Check your connection and try again.'
      default:
        return serverReason(error) ?? `Could not ${verb} the feature. Try again.`
    }
  }
  return `Could not ${verb} the feature. Try again.`
}
