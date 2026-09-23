/**
 * The type that makes "temporary" enforceable.
 *
 * A compatibility layer without an expiry date is just a second API client
 * with an apology attached. Every shim must name the endpoint it reaches, why
 * the SDK cannot reach it, and the issue whose closure deletes it — and
 * `shims.test.ts` fails the build if any of those is missing or malformed.
 *
 * The count is expected to go down. A shim whose issue is closed is a bug.
 */
export interface Shim<Args extends unknown[], Result> {
  /** The route this reaches, e.g. `GET /environments`. */
  endpoint: string
  /** Why the SDK cannot do this. Usually: absent from the OpenAPI document. */
  reason: string
  /**
   * The tracking issue that removes this shim. Required, and validated —
   * `flexprice/flexprice#1234`. Without one, nobody ever deletes it.
   */
  removalIssue: string
  call: (...args: Args) => Promise<Result>
}

export const REMOVAL_ISSUE_PATTERN = /^[\w.-]+\/[\w.-]+#\d+$/

export function defineShim<Args extends unknown[], Result>(
  shim: Shim<Args, Result>,
): Shim<Args, Result> {
  return shim
}
