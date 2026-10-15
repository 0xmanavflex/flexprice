import { env } from '@/env'
import { clientFor } from './supabaseClient'
import { ConfirmationLinkInvalid } from './signUpErrors'

export { ConfirmationLinkInvalid }

/**
 * Sign-up on the hosted regions, which is two halves with an inbox between them.
 *
 * The backend creates an account only for an email Supabase has confirmed: in
 * Supabase mode `POST /auth/signup` takes the confirmed session's access token
 * and refuses without one ("A verified sign-in is required to create an
 * account"). So, as V1 does it:
 *
 *   1. {@link startSignUp} registers the email and password with Supabase from
 *      the browser. Supabase emails a confirmation link; nothing exists in
 *      Flexprice yet.
 *   2. The link lands on `/sign-up/confirm` with a session in the URL fragment.
 *      {@link readConfirmedSession} reads it, the page calls `POST /auth/signup`
 *      with its token, and {@link refreshedToken} swaps that token for one
 *      carrying the new tenant — the backend puts `tenant_id` into the user's
 *      `app_metadata`, and only a refreshed token has it.
 *
 * A self-hosted build has no Supabase; {@link supabaseSignUpFor} says so and the
 * page signs up through the API directly, which there takes a password.
 */

/** Whether this region signs up through Supabase. */
export function supabaseSignUpFor(region: string): boolean {
  return env.supabaseFor(region) !== null
}

/**
 * Where the confirmation link comes back to. Built from the live origin, so it
 * must be listed in the Supabase project's Redirect URLs (see `passwordReset`).
 */
export function signUpConfirmURL(): string {
  return `${globalThis.location.origin}/sign-up/confirm`
}

/** What the signup tells the backend about where it came from. */
export const SIGN_UP_METADATA: Record<string, string> = { signup_method: 'email' }

function configFor(region: string) {
  const config = env.supabaseFor(region)
  if (!config) throw new Error('Sign-up is not configured for this deployment.')
  return config
}

/**
 * Registers the email and password with Supabase, which emails a confirmation
 * link. Resolves the same way whether or not the address is already taken —
 * Supabase does not say, and neither does the screen that follows.
 */
export async function startSignUp(region: string, email: string, password: string): Promise<void> {
  const { error } = await clientFor(configFor(region)).auth.signUp({
    email: email.trim(),
    password,
    options: { emailRedirectTo: signUpConfirmURL() },
  })
  if (error) throw new Error(error.message)
}

/** Sends the confirmation email again. */
export async function resendConfirmation(region: string, email: string): Promise<void> {
  const { error } = await clientFor(configFor(region)).auth.resend({
    type: 'signup',
    email: email.trim(),
    options: { emailRedirectTo: signUpConfirmURL() },
  })
  if (error) throw new Error(error.message)
}

export interface ConfirmedSession {
  email: string
  userId: string
  accessToken: string
  /** Set when the account already exists — the link was followed a second time. */
  tenantId: string | null
}

/**
 * The session the confirmation link established.
 *
 * A link Supabase rejected comes back with `error_description` in the fragment
 * instead of tokens; that sentence is shown as it is, since it says why.
 */
export async function readConfirmedSession(
  region: string,
  hash: string = globalThis.location.hash,
): Promise<ConfirmedSession> {
  const fragment = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash)
  const rejected = fragment.get('error_description')
  if (rejected) throw new ConfirmationLinkInvalid(rejected.replace(/\+/g, ' '))

  // `getSession` waits for supabase-js to finish consuming the fragment.
  const { data, error } = await clientFor(configFor(region)).auth.getSession()
  const session = data.session
  if (error || !session || !session.user.email) throw new ConfirmationLinkInvalid()

  const tenant = (session.user.app_metadata as { tenant_id?: unknown } | undefined)?.tenant_id
  return {
    email: session.user.email,
    userId: session.user.id,
    accessToken: session.access_token,
    tenantId: typeof tenant === 'string' && tenant ? tenant : null,
  }
}

/** A fresh access token, now carrying the tenant the backend just assigned. */
export async function refreshedToken(region: string): Promise<string> {
  const { data, error } = await clientFor(configFor(region)).auth.refreshSession()
  if (error || !data.session) throw new Error(error?.message ?? 'Could not refresh the session.')
  return data.session.access_token
}

/**
 * Drops the link's session from supabase-js and the tokens from the address
 * bar. The console's own session is what stays; the access token handed to it
 * remains valid on its own, as the one `POST /auth/login` returns does.
 */
export async function forgetConfirmation(region: string): Promise<void> {
  if (globalThis.location.hash) {
    globalThis.history.replaceState(
      null,
      '',
      `${globalThis.location.pathname}${globalThis.location.search}`,
    )
  }
  await clientFor(configFor(region))
    .auth.signOut({ scope: 'local' })
    .catch(() => undefined)
}
