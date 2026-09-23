/**
 * @fp/sdk-adapter — TEMPORARY, and structured so that it stays temporary.
 *
 * ~109 of the backend's 320 route handlers carry no swagger annotation, so they
 * are absent from the OpenAPI document and therefore from every generated SDK.
 * That is a backend contract problem. It is being fixed upstream, and V2 is
 * built against the *corrected* contract — see `docs/api-contract-gap.md`.
 *
 * This package exists only so that a backend release schedule cannot force
 * special cases into `@fp/query`, the domain layer or an app. Everything the
 * corrected contract will cover lives here and nowhere else, behind one import,
 * with one removal issue each.
 *
 * Rules:
 *   - Nothing here is a permanent home. Every export names the issue that deletes it.
 *   - No app imports a shim directly; `@fp/query` is still the only data door.
 *   - When `SHIMS` reaches zero, delete this package.
 *
 * Currently: zero shims. V2's foundation does not depend on one, and it should
 * stay that way unless a migration gate genuinely cannot wait.
 */
import type { Shim } from './shim'

export { defineShim, REMOVAL_ISSUE_PATTERN } from './shim'
export type { Shim } from './shim'

/** Every shim in the package. `shims.test.ts` validates this list. */
export const SHIMS: readonly Shim<never[], unknown>[] = []
