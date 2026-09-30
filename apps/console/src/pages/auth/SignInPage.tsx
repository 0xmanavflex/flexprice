import { useNavigate } from '@tanstack/react-router'
import { ApiError, ErrorKind, useSignIn } from '@fp/query'
import { SignInScreen } from '@fp/ui/pages'
import { useSession } from '@/app/session'
import { env } from '@/env'

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

/**
 * Turns a failed sign-in into a sentence worth reading.
 *
 * This deliberately does **not** forward `error.message`, and the live API is
 * the reason. `POST /auth/login` answers a wrong password with
 * `{"code":"permission_denied","message":"Failed to get user","http_status_code":403}`
 * and an unknown address with `404 {"message":"User not found with the provided
 * email"}`. Neither is usable copy:
 *
 *   - "Failed to get user" describes a backend call stack, not the thing the
 *     person did. It reads as a system fault, so the natural response is to
 *     retry the same password rather than to check it.
 *   - "User not found with the provided email" is an account-enumeration
 *     oracle. Anyone can learn which addresses have Flexprice accounts by
 *     watching 404 against 403, and the console should not put that difference
 *     on screen in plain English.
 *
 * And neither message would arrive anyway: `readErrorBody` digs a message out
 * of `{ error: { message } }`, while these bodies carry `message` at the top
 * level, so what actually reaches here is the HTTP status text. Rendering that
 * would show the user the word "Forbidden".
 *
 * So the *kind* is what is mapped, and the two credential outcomes deliberately
 * collapse to one sentence. A network failure stays distinct, because that one
 * genuinely changes what the person should do next — nothing they type will
 * help until they are back online.
 */
export function messageForSignInError(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return 'Something went wrong signing in. Try again.'
  }

  switch (error.kind) {
    case ErrorKind.Network:
      return 'Could not reach Flexprice. Check your connection and try again.'
    case ErrorKind.Unauthorized:
    case ErrorKind.Forbidden:
    case ErrorKind.NotFound:
      return 'That email and password do not match.'
    case ErrorKind.Server:
      return 'Flexprice is having trouble right now. Try again in a moment.'
    default:
      // An `Invalid` carries a real field-level complaint from the API, so its
      // own words are better than anything this function could substitute.
      return error.message
  }
}

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
}

export function SignInPage({ redirect }: SignInPageProps) {
  const navigate = useNavigate()
  const session = useSession()
  const signIn = useSignIn()

  // Under mocks the form is seeded and announces itself; against a real API it
  // stays empty and silent. Spread conditionally rather than passing `undefined`
  // — the props are exact-optional, so an explicit `undefined` would not type.
  const demoProps = env.useMocks ? { defaultValues: DEMO_CREDENTIALS, hint: DEMO_HINT } : {}

  return (
    <main className="bg-background min-h-svh">
      <SignInScreen
        {...demoProps}
        isSubmitting={signIn.isPending}
        error={signIn.error ? messageForSignInError(signIn.error) : null}
        onSubmit={(credentials) => {
          signIn.mutate(credentials, {
            onSuccess: (result) => {
              session.signIn({
                token: result.token,
                userId: result.userId,
                tenantId: result.tenantId,
              })
              void navigate({ to: safeRedirect(redirect), search: {} as never })
            },
          })
        }}
      />
    </main>
  )
}
