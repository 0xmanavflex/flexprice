import { ApiError, serverReason } from '@fp/query'

/**
 * A pricing-setup failure, as a sentence the screen can show inline.
 *
 * `noun` names what failed, because the two halves of this flow fail for
 * different reasons and a single message would be wrong for one of them:
 * reading is the model and the proxy, creating is the catalogue APIs.
 */
export function toSubmitError(error: unknown, verb: 'read' | 'create'): string | null {
  if (!error) return null

  const fallback =
    verb === 'read'
      ? 'Could not read that pricing. Try rewording it, or be more specific about what is charged.'
      : 'Some of that could not be created. What was created is kept; read the pricing again to see what is left.'

  if (error instanceof ApiError) {
    switch (error.kind) {
      case 'invalid': {
        const detail = error.details ? Object.values(error.details)[0] : undefined
        return detail || error.message || fallback
      }
      case 'forbidden':
        return serverReason(error) ?? 'You do not have permission to change the catalogue here.'
      case 'network':
        return 'Could not reach Flexprice. Check your connection and try again.'
      case 'timeout':
        return verb === 'read'
          ? 'Reading your pricing took too long. Try a shorter description.'
          : fallback
      default:
        return serverReason(error) ?? fallback
    }
  }
  return fallback
}
