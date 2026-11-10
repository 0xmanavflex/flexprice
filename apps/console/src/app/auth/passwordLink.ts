import { env } from '@/env'

/**
 * One-time password links: the self-hosted way to invite a member or reset a
 * password without an admin ever seeing it (flexprice#3123).
 *
 * A deployment has them exactly when it has no Supabase project: hosted
 * regions keep Supabase's own reset email and the invite's one-time password,
 * and their API refuses to mint links. The same test decides the sign-in
 * page's "Forgot your password?" (`resetAvailableFor`), so the two never
 * disagree.
 */
export function passwordLinksAvailableFor(region: string): boolean {
  return env.supabaseFor(region) === null
}

/** Where a link opens. The token goes in the fragment, which no server sees. */
export const SET_PASSWORD_PATH = '/set-password'

export function passwordLinkUrl(linkToken: string, origin = globalThis.location.origin): string {
  return `${origin}${SET_PASSWORD_PATH}#token=${encodeURIComponent(linkToken)}`
}

/** The token from a link's fragment (`#token=…`), or null when there is none. */
export function readPasswordLinkToken(hash: string): string | null {
  const token = new URLSearchParams(hash.replace(/^#/, '')).get('token')?.trim()
  return token || null
}
