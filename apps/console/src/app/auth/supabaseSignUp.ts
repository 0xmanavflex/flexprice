import { env } from '@/env'
import { clientFor } from './supabaseClient'
import { ConfirmationLinkInvalid, EmailNotConfirmed } from './signUpErrors'

export { ConfirmationLinkInvalid, EmailNotConfirmed }

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
 *   2. The link lands on `/auth/signup/confirmation` with a session in the URL fragment.
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
 * V1's confirmation path, kept on purpose. The Supabase projects' Redirect URLs
 * already allow it on every origin V1 runs on, localhost included. Anything not
 * on that list is not refused: GoTrue silently sends the browser to the
 * project's Site URL — prod — instead. That is how Google sign-in from a local
 * V2 ended up on the production dashboard while it returned to `/sign-up/confirm`.
 */
export const SIGN_UP_CONFIRM_PATH = '/auth/signup/confirmation'

/**
 * Where the confirmation link and Google sign-in come back to. Built from the
 * live origin, so it must be listed in the Supabase project's Redirect URLs.
 */
export function signUpConfirmURL(origin: string = globalThis.location.origin): string {
  return `${origin}${SIGN_UP_CONFIRM_PATH}`
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

/**
 * Start Google sign-in, and say where to send the browser.
 *
 * The same two-halves shape as email sign-up, with Google standing in for the
 * inbox: Supabase authenticates, then the browser comes back to
 * `/auth/signup/confirmation` with a session in the fragment, and that page either
 * creates the Flexprice account or — when the user already has one, so the
 * session's `app_metadata` already names a tenant — simply signs them in.
 * Nothing new is needed there; it already distinguishes the two.
 *
 * Returns the URL rather than navigating, so the caller owns the page
 * transition and this stays testable. `scopes` are the two V1 asks for: an
 * email to key the account on and a profile to name it.
 */
export async function startGoogleSignIn(region: string): Promise<string> {
  const { data, error } = await clientFor(configFor(region)).auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: signUpConfirmURL(), scopes: 'email profile' },
  })
  if (error) throw new Error(error.message)
  // supabase-js returns the provider URL for the caller to navigate to; with
  // no URL there is nowhere to send the browser and nothing happened.
  if (!data?.url) throw new Error('Google sign-in is unavailable right now.')
  return data.url
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

/**
 * A sign-up that stopped half way, picked up at sign-in.
 *
 * If the confirmation page never finished — the tab was closed, the request
 * failed, the link was opened twice — Supabase has a confirmed user and
 * Flexprice has none, so `POST /auth/login` refuses and the one-use link is
 * spent. V1 recovered by signing in through Supabase; so does this.
 *
 * Called only after `POST /auth/login` refused. Resolves with the confirmed
 * session when there is an account to finish (no tenant yet), and with null
 * when there is not — wrong password, or a user who already has an organisation
 * and was refused for another reason, which must stand. Rejects with
 * {@link EmailNotConfirmed} when the password is right but the email was never
 * confirmed, which is worth saying.
 */
export async function unfinishedSignUp(
  region: string,
  email: string,
  password: string,
): Promise<ConfirmedSession | null> {
  const client = clientFor(configFor(region))
  const { data, error } = await client.auth.signInWithPassword({ email: email.trim(), password })
  if (error) {
    if (/not confirmed/i.test(error.message)) throw new EmailNotConfirmed(email.trim())
    return null
  }
  const session = data.session
  const tenant = (session?.user.app_metadata as { tenant_id?: unknown } | undefined)?.tenant_id
  if (!session || !session.user.email || (typeof tenant === 'string' && tenant)) {
    await client.auth.signOut({ scope: 'local' }).catch(() => undefined)
    return null
  }
  return {
    email: session.user.email,
    userId: session.user.id,
    accessToken: session.access_token,
    tenantId: null,
  }
}

/** The console session a finished sign-up hands over. */
export interface NewSession {
  token: string
  userId: string
  tenantId: string
}

/**
 * Creates the account behind a confirmed session and returns the console's
 * session for it: `create` is `POST /auth/signup` with the session's token, and
 * the token is then refreshed so it carries the tenant the backend assigned.
 * A session that already names a tenant has nothing to create.
 */
export async function completeAccount(
  region: string,
  confirmed: ConfirmedSession,
  create: (details: {
    email: string
    token: string
    metadata: Record<string, string>
  }) => Promise<{ userId: string; tenantId: string }>,
  /** Injected like `create`, so both branches are testable without a client. */
  refresh: (region: string) => Promise<string> = refreshedToken,
): Promise<NewSession> {
  if (confirmed.tenantId) {
    /*
     * Refresh before handing the token on, even though this account exists.
     *
     * The API reads the tenant from the token's `app_metadata.tenant_id`, and
     * `ValidateToken` returns an empty tenant rather than an error when it is
     * missing — the middleware then refuses with "Invalid token claims". The
     * session *object* can carry a tenant the *token* does not, because the
     * token was minted earlier; `confirmed.tenantId` is read from the former.
     * Refreshing mints one from the current metadata, which is what V1 does
     * after every signup for the same reason.
     *
     * A refresh that fails is not fatal: the token in hand may well be fine,
     * and refusing the sign-in over it would turn a working login into a dead
     * button. Try, and fall back to what we have.
     */
    const token = await refresh(region).catch(() => confirmed.accessToken)
    return { token, userId: confirmed.userId, tenantId: confirmed.tenantId }
  }
  const created = await create({
    email: confirmed.email,
    token: confirmed.accessToken,
    metadata: SIGN_UP_METADATA,
  })
  return {
    token: await refresh(region),
    userId: created.userId || confirmed.userId,
    tenantId: created.tenantId,
  }
}
