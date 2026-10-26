import { env } from '@/env'
import { clientFor, sessionClientFor } from './supabaseClient'
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
 *      {@link readConfirmedSession} hands it to the console's session client,
 *      the page calls `POST /auth/signup` with its token, and
 *      {@link refreshedToken} swaps that token for one carrying the new tenant:
 *      the backend puts `tenant_id` into the user's `app_metadata`, and only a
 *      refreshed token has it. The session then stays in that client, which
 *      keeps refreshing it.
 *
 * Password sign-in on a hosted region goes through Supabase as well
 * ({@link signInWithSupabase}), as V1's does, so it gets a refresh token too.
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
 * project's Site URL: prod: instead. That is how Google sign-in from a local
 * V2 ended up on the production dashboard while it returned to `/sign-up/confirm`.
 */
export const SIGN_UP_CONFIRM_PATH = '/auth/signup/confirmation'

/**
 * Where the confirmation link and Google sign-in come back to: the live origin,
 * or `VITE_AUTH_REDIRECT_ORIGIN` where one is set (staging, see `env`). Either
 * way it must be listed in the Supabase project's Redirect URLs.
 */
export function signUpConfirmURL(
  origin: string = env.authRedirectOrigin ?? globalThis.location.origin,
): string {
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
 * link. Resolves the same way whether or not the address is already taken:
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
 * creates the Flexprice account or: when the user already has one, so the
 * session's `app_metadata` already names a tenant: simply signs them in.
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
  /** Set when the account already exists: the link was followed a second time. */
  tenantId: string | null
}

type SupabaseSession = NonNullable<
  Awaited<ReturnType<ReturnType<typeof sessionClientFor>['auth']['getSession']>>['data']['session']
>

function confirmedFrom(session: SupabaseSession): ConfirmedSession {
  const tenant = (session.user.app_metadata as { tenant_id?: unknown } | undefined)?.tenant_id
  return {
    email: session.user.email ?? '',
    userId: session.user.id,
    accessToken: session.access_token,
    tenantId: typeof tenant === 'string' && tenant ? tenant : null,
  }
}

/**
 * The session the confirmation link established, now held by the console's
 * session client.
 *
 * The fragment's two tokens are handed to that client directly, rather than
 * letting a second client consume the link: Supabase rotates refresh tokens, so
 * two clients refreshing one session would spend each other's token and end it.
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

  const accessToken = fragment.get('access_token')
  const refreshToken = fragment.get('refresh_token')
  if (!accessToken || !refreshToken) throw new ConfirmationLinkInvalid()

  const { data, error } = await sessionClientFor(configFor(region)).auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  })
  const session = data.session
  if (error || !session || !session.user.email) throw new ConfirmationLinkInvalid()
  return confirmedFrom(session)
}

/** A fresh access token, now carrying the tenant the backend just assigned. */
export async function refreshedToken(region: string): Promise<string> {
  const { data, error } = await sessionClientFor(configFor(region)).auth.refreshSession()
  if (error || !data.session) throw new Error(error?.message ?? 'Could not refresh the session.')
  return data.session.access_token
}

/**
 * Takes the link's tokens out of the address bar. After a failure it also ends
 * the session the link started, which would otherwise sit in storage with no
 * account behind it; after a success that session *is* the console's, and
 * stays.
 */
export async function forgetConfirmation(
  region: string,
  { endSession }: { endSession: boolean },
): Promise<void> {
  if (globalThis.location.hash) {
    globalThis.history.replaceState(
      null,
      '',
      `${globalThis.location.pathname}${globalThis.location.search}`,
    )
  }
  if (!endSession) return
  await sessionClientFor(configFor(region))
    .auth.signOut({ scope: 'local' })
    .catch(() => undefined)
}

/** Supabase refused the email and password: wrong, or no such account. */
export class SupabaseCredentialsRefused extends Error {
  constructor() {
    super('That email and password do not match.')
    this.name = 'SupabaseCredentialsRefused'
  }
}

/**
 * Password sign-in on a hosted region, through Supabase as V1 does it.
 *
 * Supabase returns a refresh token along with the access token, and the
 * session client keeps both, so the session outlives the access token. The
 * account behind it is then one of three:
 *
 *   - It names a tenant: signed in.
 *   - It has none: a sign-up that stopped half way (the confirmation page never
 *     finished, or its one-use link was spent). The account is created now, as
 *     the confirmation page would have, and the token refreshed to carry it.
 *   - Supabase refuses: {@link EmailNotConfirmed} when only the confirmation is
 *     missing, which is worth saying, and {@link SupabaseCredentialsRefused}
 *     otherwise.
 */
export async function signInWithSupabase(
  region: string,
  email: string,
  password: string,
  create: Parameters<typeof completeAccount>[2],
): Promise<NewSession> {
  const client = sessionClientFor(configFor(region))
  const { data, error } = await client.auth.signInWithPassword({ email: email.trim(), password })
  if (error) {
    if (/not confirmed/i.test(error.message)) throw new EmailNotConfirmed(email.trim())
    if (/invalid login credentials/i.test(error.message) || error.status === 400) {
      throw new SupabaseCredentialsRefused()
    }
    throw new Error(error.message)
  }
  if (!data.session) throw new SupabaseCredentialsRefused()
  try {
    return await completeAccount(region, confirmedFrom(data.session), create)
  } catch (cause) {
    // No console session follows, so none is left behind in storage either.
    await client.auth.signOut({ scope: 'local' }).catch(() => undefined)
    throw cause
  }
}

/** The console session a finished sign-up hands over. */
export interface NewSession {
  token: string
  userId: string
  tenantId: string
  /** The hosted region whose Supabase session client keeps this session fresh. */
  region: string
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
     * missing: the middleware then refuses with "Invalid token claims". The
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
    return { token, userId: confirmed.userId, tenantId: confirmed.tenantId, region }
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
    region,
  }
}
