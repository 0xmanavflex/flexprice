import { useNavigate } from '@tanstack/react-router'
import { useSignIn } from '@fp/query'
import { SignInScreen } from '@fp/ui/pages'
import { useSession } from '@/app/session'
import { env } from '@/env'
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
        onSignUp={() => void navigate({ to: '/sign-up', search: {} as never })}
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
