import { env } from '@/env'
import { clientFor } from './supabaseClient'

/**
 * Password reset, which is the one auth flow the Flexprice API does not have.
 *
 * The backend's public auth surface is `POST /auth/signup`, `POST /auth/login`
 * and the SAML routes: there is no reset endpoint on any provider. V1 reached
 * past the API to Supabase from the browser for exactly this, and this console
 * does the same.
 *
 * ## Scope, deliberately narrow
 *
 * This client exists **only** to request a reset email and to set a new
 * password. It is not the session: sign-in stays `POST /auth/login` and the
 * token stays in `SessionProvider`. Letting Supabase own a second session in
 * parallel is how you get two token lifetimes, two storage keys, and a console
 * whose idea of who is signed in depends on which one you ask.
 *
 * That is enforced here rather than left to convention: `persistSession` and
 * `autoRefreshToken` are off, so supabase-js writes nothing to `localStorage`
 * and never refreshes anything in the background. The one exception is
 * `detectSessionInUrl`, which has to be on: the recovery link puts its tokens
 * in the URL fragment, and that momentary session is what authorises the
 * password update. {@link completePasswordReset} signs it out immediately
 * afterwards so it cannot outlive the update.
 *
 * ## Where it does not exist
 *
 * A self-hosted deployment has no Supabase, so {@link resetAvailableFor}
 * returns false and the console shows no reset link. That is the honest state,
 * not a degraded one: self-hosted has never had password reset, in V1 either.
 */

/** Whether this region can reset a password at all. */
export function resetAvailableFor(region: string): boolean {
  return env.supabaseFor(region) !== null
}

/**
 * Where the email link comes back to.
 *
 * Built from the live origin rather than configured, because the same bundle is
 * served from both region dashboards, from preview deploys and from localhost.
 *
 * **Every one of those origins must be listed in the Supabase project under
 * Authentication → URL Configuration → Redirect URLs.** A missing entry is not
 * an error: GoTrue validates the redirect, silently substitutes the project's
 * Site URL when it does not match, and returns success. The only symptom is a
 * link in someone's inbox pointing at the wrong host, which is why this is
 * written down here as well as in `.env.example`.
 */
export function resetRedirectURL(): string {
  return `${globalThis.location.origin}/reset-password`
}

export class PasswordResetUnavailable extends Error {
  constructor() {
    super('Password reset is not configured for this deployment.')
    this.name = 'PasswordResetUnavailable'
  }
}

/**
 * Asks Supabase to email a reset link.
 *
 * Resolves whether or not the address has an account. GoTrue does not
 * distinguish, and neither should the caller: the confirmation screen says
 * "if that address has an account" precisely so this cannot be used to find out
 * who has one.
 */
export async function requestPasswordReset(region: string, email: string): Promise<void> {
  const config = env.supabaseFor(region)
  if (!config) throw new PasswordResetUnavailable()

  const { error } = await clientFor(config).auth.resetPasswordForEmail(email.trim(), {
    redirectTo: resetRedirectURL(),
  })
  if (error) throw new Error(error.message)
}

/**
 * Sets the new password, using the session the recovery link just established.
 *
 * The session is torn down immediately afterwards, successfully or not. It was
 * minted by a link in an email and is good for exactly this one change; leaving
 * it alive in the tab would be a credential nobody asked for, sitting next to a
 * console that authenticates a different way.
 */
export async function completePasswordReset(region: string, password: string): Promise<void> {
  const config = env.supabaseFor(region)
  if (!config) throw new PasswordResetUnavailable()

  const client = clientFor(config)
  try {
    const { error } = await client.auth.updateUser({ password })
    if (error) throw new Error(error.message)
  } finally {
    await client.auth.signOut().catch(() => {
      // Already gone, or offline. The session was never persisted, so the tab
      // closing ends it regardless; failing the reset over this would be wrong.
    })
  }
}

/**
 * Whether this page load is carrying a recovery link.
 *
 * Read from the fragment rather than from supabase-js, because it is checked on
 * first render to decide what to show, and `detectSessionInUrl` resolves
 * asynchronously. A `type=recovery` fragment is the link; anything else is
 * someone who navigated to `/reset-password` directly and should be told to
 * request a new one rather than shown a form that cannot work.
 */
export function hasRecoveryToken(hash: string = globalThis.location.hash): boolean {
  if (!hash.startsWith('#')) return false
  const params = new URLSearchParams(hash.slice(1))
  return params.get('type') === 'recovery' || params.has('access_token')
}
