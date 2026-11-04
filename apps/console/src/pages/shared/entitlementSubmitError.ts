import { serverReason } from '@fp/query'

/**
 * What an entitlement form says when the API refused it.
 *
 * The server's reason when it sent one: a rejected grant explains itself (the
 * meter has a tiered price; use a flat fee or drop the grant), and "try again"
 * cannot fix that. The generic sentence only when the server said nothing.
 */
export function entitlementSubmitError(
  mutation: { isError: boolean; error: unknown },
  action: 'add' | 'save',
): string | null {
  if (!mutation.isError) return null
  return serverReason(mutation.error) ?? `Could not ${action} the entitlement. Try again.`
}
