import { readEnvironmentId } from './storage'

/**
 * Which environment requests are being sent to, readable at any instant.
 *
 * React state cannot answer this. The environment id has two readers that run
 * outside a render: the `X-Environment-ID` header, set per request, and the
 * query cache's key hash, computed whenever a query is looked up. Both must
 * agree *during* a switch, and state is only updated after the render that
 * follows the click: so a request or a cache lookup landing in between would
 * read the previous environment. A module-level value is written in the same
 * tick as the decision, before anything is invalidated, which is what makes
 * "I switched and the data didn't" impossible rather than unlikely.
 *
 * `SessionProvider` is the only writer.
 */
let active: string | null | undefined

/** The active environment id, or null when none has been chosen. */
export function getActiveEnvironmentId(): string | null {
  // Read lazily so a returning user's persisted choice is in force from the
  // first request, before any provider has mounted.
  if (active === undefined) active = readEnvironmentId()
  return active
}

export function setActiveEnvironmentId(id: string | null): void {
  active = id
}
