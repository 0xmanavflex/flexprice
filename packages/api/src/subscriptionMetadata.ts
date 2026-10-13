import { ApiError, ErrorKind } from './errors'
import { request } from './settings'

/**
 * `PUT /subscriptions/{id}` with `{metadata}` — a field the SDK cannot send.
 *
 * The SDK's `UpdateSubscriptionRequest` declares only status, cancel and
 * parent fields, and its outbound zod schema silently strips anything else, so
 * a metadata edit sent through it never leaves the browser. This goes around
 * it with `fetch`, the same way `settings.ts` does.
 *
 * The API does not yet store metadata on a subscription update (its
 * `UpdateSubscriptionRequest` has no `metadata` field and ignores unknown
 * keys), so a 200 alone proves nothing. The response's own `metadata` is
 * compared to what was sent, and a mismatch is reported as a failure rather
 * than shown as saved. Once the backend accepts the field this starts
 * succeeding with no change here.
 */
export async function updateSubscriptionMetadata(
  serverURL: string,
  token: string,
  environmentId: string,
  subscriptionId: string,
  metadata: Record<string, string>,
): Promise<Record<string, string>> {
  const body = await request(serverURL, `/subscriptions/${encodeURIComponent(subscriptionId)}`, {
    method: 'PUT',
    token,
    environmentId,
    body: { metadata },
  })
  const saved =
    body && typeof body === 'object' && 'metadata' in body
      ? ((body as { metadata?: Record<string, string> | null }).metadata ?? {})
      : {}
  if (!sameMap(saved, metadata)) {
    throw new ApiError(
      ErrorKind.Unknown,
      'The API did not save the metadata. Contract metadata cannot be edited yet.',
    )
  }
  return saved
}

function sameMap(a: Record<string, string>, b: Record<string, string>): boolean {
  const keys = Object.keys(a)
  return keys.length === Object.keys(b).length && keys.every((key) => a[key] === b[key])
}
