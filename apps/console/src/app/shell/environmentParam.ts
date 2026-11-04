/**
 * The search parameter every console URL carries: the environment it shows.
 *
 * A link names a page (`/subscriptions`, `/invoices/inv_1`, `/`), and the data
 * on it belongs to one environment. Without the environment in the address,
 * whoever opens a shared link sees that page in whichever environment their
 * console last used: a teammate's Production contracts open as their Sandbox
 * list. With it, the link opens where it was copied.
 */
export const ENVIRONMENT_PARAM = 'env'

/** `?env=` as the shell route reads it: a non-empty id, or absent. */
export function parseEnvironmentParam(search: Record<string, unknown>): { env?: string } {
  const raw = search[ENVIRONMENT_PARAM]
  return typeof raw === 'string' && raw.trim() ? { env: raw.trim() } : {}
}
