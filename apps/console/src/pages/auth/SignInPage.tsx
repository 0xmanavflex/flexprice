import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import {
  ApiError,
  ErrorKind,
  useAuthCapabilitiesValue,
  useSignIn,
  useSignUpWithToken,
} from '@fp/query'
import { RegionField, SignInScreen } from '@fp/ui/pages'
import { useSession } from '@/app/session'
import { useRegion } from '@/app/region'
import { resetAvailableFor } from '@/app/auth/passwordReset'
import { env } from '@/env'
import { resolveSsoTenant, startSamlLogin } from './samlLogin'
import {
  EmailNotConfirmed,
  completeAccount,
  forgetConfirmation,
  startGoogleSignIn,
  supabaseSignUpFor,
  unfinishedSignUp,
} from '@/app/auth/supabaseSignUp'
import { messageForSignInError } from './signInMessage'

/**
 * Demo credentials for mock mode.
 *
 * A shared contract with the mock `POST /auth/login` handler: these exact
 * values are what it accepts, so pre-filling them lets someone reach the
 * dashboard by clicking **Sign in** with nothing to type. The password is eight
 * characters, which the domain schema accepts. Kept as a literal rather than an
 * import because the handler owns its own copy and the two only have to agree on
 * the string, not the module.
 */
const DEMO_CREDENTIALS = { email: 'demo@flexprice.io', password: 'demo1234' } as const

/** Shown only under mocks, so it never appears in front of the live API. */
const DEMO_HINT = 'Demo mode — the sample data is loaded. Just click Sign in.'

export { messageForSignInError }

/**
 * Where a successful sign-in lands.
 *
 * The guard puts the address it turned away into `?redirect=`, so a bookmarked
 * `/invoices?status=overdue` survives the detour. Only same-origin paths are
 * honoured: a `redirect` is attacker-supplied by definition, and one that
 * accepted `https://…` would make the console a convincing hop for a phishing
 * link. A protocol-relative `//evil.test` is a URL the browser treats as
 * absolute, which is why it is rejected alongside the obvious ones.
 */
export function safeRedirect(target: string | undefined): string {
  if (!target) return '/'
  if (!target.startsWith('/') || target.startsWith('//')) return '/'
  return target
}

export interface SignInPageProps {
  /** Where to go once signed in. Defaults to the console's home. */
  redirect?: string | undefined
  /**
   * The tenant whose identity provider should handle this login, from
   * `?sso=`. Its presence is what offers the SSO button — SSO is configured
   * per tenant, and without one there is no provider to send the browser to.
   */
  ssoTenantId?: string | undefined
}

export function SignInPage({ redirect, ssoTenantId }: SignInPageProps) {
  const navigate = useNavigate()
  const session = useSession()
  const signIn = useSignIn()
  const createAccount = useSignUpWithToken()
  // Picking up a sign-up that stopped half way; see `unfinishedSignUp`.
  const [recovering, setRecovering] = useState(false)
  const [recoveryError, setRecoveryError] = useState<string | null>(null)
  const { regions, region, setRegion } = useRegion()
  // Google is drawn only where it exists. Reads password-only until the
  // backend serves `/auth/capabilities`, which is how the console behaves today.
  const capabilities = useAuthCapabilitiesValue()
  /*
   * Reset runs against Supabase from the browser, not against the Flexprice
   * API, so what decides the link is whether *this region* has a Supabase
   * project configured — not what `/auth/capabilities` says. A self-hosted
   * build has none, and correctly shows no link: it has never had reset.
   *
   * The server's answer is honoured too, so that brokering reset later turns
   * the link on without touching this page.
   */
  const canReset = resetAvailableFor(region) || capabilities.passwordReset.enabled

  // Under mocks the form is seeded and announces itself; against a real API it
  // stays empty and silent. Spread conditionally rather than passing `undefined`
  // — the props are exact-optional, so an explicit `undefined` would not type.
  const demoProps = env.useMocks ? { defaultValues: DEMO_CREDENTIALS, hint: DEMO_HINT } : {}

  /*
   * SSO is offered when the link names a tenant, and not otherwise.
   *
   * Deliberately not gated on `capabilities.saml.enabled`: that reads
   * password-only on every deployment until the backend grows
   * `/auth/capabilities`, which would hide SSO from every tenant that has it.
   * It is safe to offer to a tenant without SSO — `startSamlLogin` asks the
   * endpoint first and says so on a 404 rather than navigating the browser
   * onto a JSON error body.
   */
  const tenantForSso = resolveSsoTenant(ssoTenantId)
  const [ssoPending, setSsoPending] = useState(false)
  const [ssoError, setSsoError] = useState<string | null>(null)
  const [providerError, setProviderError] = useState<string | null>(null)

  const beginSso = async (tenant: string) => {
    setSsoError(null)
    setSsoPending(true)
    try {
      let storage
      try {
        storage = globalThis.sessionStorage
      } catch {
        storage = undefined
      }
      const started = await startSamlLogin(tenant, env.apiUrl, storage)
      if (!started.ok) {
        setSsoError('Single sign-on is not set up for this organisation yet.')
        return
      }
      // A full page navigation, not a fetch: the browser carries its own
      // session to the identity provider, and the assertion is posted back
      // through the browser.
      globalThis.location.assign(started.url)
    } finally {
      setSsoPending(false)
    }
  }

  /*
   * Google is offered wherever this region has Supabase configured.
   *
   * Not behind `capabilities.oauth.google`: that reads false on every
   * deployment until the backend serves `/auth/capabilities`, which returns
   * 404 today — so gating on it hides a Google sign-in that works. The honest
   * test is whether the thing it needs is actually present, which is exactly
   * what `supabaseSignUpFor` already answers for sign-up.
   *
   * There is no Flexprice route for this. Google goes through Supabase, as it
   * does in V1 and as sign-up already does here, and comes back to
   * `/auth/signup/confirmation` — which creates the account or, when the session
   * already names a tenant, just signs the person in.
   */
  const googleAvailable = supabaseSignUpFor(region)
  const [providerPending, setProviderPending] = useState(false)

  const beginGoogle = async () => {
    setProviderError(null)
    setProviderPending(true)
    try {
      globalThis.location.assign(await startGoogleSignIn(region))
    } catch (cause) {
      setProviderError(cause instanceof Error ? cause.message : 'Could not start Google sign-in.')
      setProviderPending(false)
    }
  }
  return (
    <main className="bg-background min-h-svh">
      <SignInScreen
        {...demoProps}
        {...(regions.length > 0
          ? {
              region: (
                <RegionField
                  regions={regions}
                  value={region}
                  onChange={(next) => {
                    setRegion(next)
                    signIn.reset()
                  }}
                  disabled={signIn.isPending}
                />
              ),
            }
          : {})}
        {...(capabilities.signUp.enabled
          ? { onSignUp: () => void navigate({ to: '/sign-up', search: {} as never }) }
          : {})}
        {...(canReset
          ? {
              onForgotPassword: () =>
                void navigate({ to: '/forgot-password', search: {} as never }),
            }
          : {})}
        {...(googleAvailable && !providerPending ? { onProvider: () => void beginGoogle() } : {})}
        {...(tenantForSso ? { onSso: () => void beginSso(tenantForSso), ssoPending } : {})}
        isSubmitting={signIn.isPending || recovering}
        error={
          providerError ??
          ssoError ??
          recoveryError ??
          (signIn.error && !recovering ? messageForSignInError(signIn.error) : null)
        }
        onSubmit={(credentials) => {
          setRecoveryError(null)
          const enter = (result: { token: string; userId: string; tenantId: string }) => {
            session.signIn(result)
            void navigate({ to: safeRedirect(redirect), search: {} as never })
          }
          signIn.mutate(credentials, {
            onSuccess: enter,
            onError: (error) => {
              // Refused credentials on a hosted region may be a sign-up that
              // never finished; anything else is reported as it is.
              if (!supabaseSignUpFor(region) || !isRefusal(error)) return
              setRecovering(true)
              void (async () => {
                try {
                  const pending = await unfinishedSignUp(
                    region,
                    credentials.email,
                    credentials.password,
                  )
                  if (!pending) return
                  const result = await completeAccount(region, pending, (details) =>
                    createAccount.mutateAsync(details),
                  )
                  await forgetConfirmation(region)
                  signIn.reset()
                  enter(result)
                } catch (cause) {
                  await forgetConfirmation(region)
                  setRecoveryError(
                    cause instanceof EmailNotConfirmed
                      ? `Confirm your email first: open the link we sent to ${cause.email}. No email? Sign up again with the same address to get a new one.`
                      : 'Your account could not be finished. Try again in a moment.',
                  )
                } finally {
                  setRecovering(false)
                }
              })()
            },
          })
        }}
      />
    </main>
  )
}

/** A wrong-credentials answer from `POST /auth/login`, as opposed to a fault. */
function isRefusal(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    (error.kind === ErrorKind.Unauthorized ||
      error.kind === ErrorKind.Forbidden ||
      error.kind === ErrorKind.NotFound)
  )
}
