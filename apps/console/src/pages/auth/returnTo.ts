/**
 * Where a sign-in lands: the page that sent the person to `/sign-in`.
 *
 * The guard puts that address in `?redirect=`, which is enough for a password
 * sign-in on the same page. Google and SSO leave the console for the
 * provider and come back to a different route (`/sign-up/confirm`,
 * `/auth/callback`) with no `?redirect=` — so the address is also kept for the
 * tab in session storage when sign-in begins, and whichever route finishes
 * the sign-in takes it from there. A shared `/invoices/inv_1?tab=payments`
 * then opens as itself after any of the three.
 */

const KEY = 'fp:return-to'

/**
 * Only same-origin paths. A `redirect` is attacker-supplied by definition,
 * and one that accepted `https://…` would make the console a convincing hop
 * for a phishing link. A protocol-relative `//evil.test` is a URL the browser
 * treats as absolute, which is why it is rejected alongside the obvious ones;
 * so is `/sign-in` itself, which would loop.
 */
export function safeRedirect(target: string | undefined | null): string {
  if (!target) return '/'
  if (!target.startsWith('/') || target.startsWith('//') || target.startsWith('/\\')) return '/'
  if (target === '/sign-in' || target.startsWith('/sign-in?')) return '/'
  return target
}

type ReturnStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function tabStore(): ReturnStore | null {
  try {
    return globalThis.sessionStorage ?? null
  } catch {
    return null
  }
}

/** Keeps `target` for this tab, so a provider round trip can find it again. */
export function rememberReturnTo(
  target: string | undefined,
  storage: ReturnStore | null = tabStore(),
): void {
  if (!target || safeRedirect(target) === '/') return
  try {
    storage?.setItem(KEY, target)
  } catch {
    // Storage blocked: the password sign-in still has `?redirect=`.
  }
}

/** Where to go now that sign-in finished: `preferred`, else what was kept, else home. Clears what was kept. */
export function takeReturnTo(
  preferred?: string | undefined,
  storage: ReturnStore | null = tabStore(),
): string {
  // Always read, so what was kept is cleared even when `preferred` wins.
  const kept = readOnce(storage)
  return safeRedirect(preferred || kept)
}

function readOnce(storage: ReturnStore | null): string | null {
  try {
    const kept = storage?.getItem(KEY) ?? null
    storage?.removeItem(KEY)
    return kept
  } catch {
    return null
  }
}
