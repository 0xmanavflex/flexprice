import { useEffect, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useSignUpWithToken } from '@fp/query'
import { SignUpConfirmScreen } from '@fp/ui/pages'
import { useSession } from '@/app/session'
import { useRegion } from '@/app/region'
import {
  completeAccount,
  forgetConfirmation,
  readConfirmedSession,
} from '@/app/auth/supabaseSignUp'
import { takeReturnTo } from './returnTo'
import { messageForConfirmError } from './signUpConfirmMessage'

export { messageForConfirmError }

/**
 * The far end of the sign-up confirmation email.
 *
 * The link carries a confirmed Supabase session in its fragment. That session's
 * token creates the account (`POST /auth/signup`); a refreshed token, which now
 * carries the new tenant, becomes the console's session; and the tokens leave
 * the address bar. The session itself stays with the session client, which
 * keeps refreshing it.
 *
 * A link followed a second time finds the account already made: its token
 * already names a tenant: and simply signs the person in.
 */
export function SignUpConfirmPage() {
  const navigate = useNavigate()
  const session = useSession()
  const { region } = useRegion()
  const createAccount = useSignUpWithToken()
  const [error, setError] = useState<string | null>(null)
  // Strict mode mounts twice; the link's session must be spent once.
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    void (async () => {
      try {
        const confirmed = await readConfirmedSession(region)
        // No tenant yet: this link is creating the account, which has not been
        // onboarded. An existing account already names one and goes back to
        // the page that asked, or Home.
        const created = !confirmed.tenantId
        const credentials = await completeAccount(region, confirmed, (details) =>
          createAccount.mutateAsync(details),
        )
        session.signIn(credentials)
        // The link's session is now the console's: the session client keeps refreshing it.
        await forgetConfirmation(region, { endSession: false })
        // Clear a stored return path either way, so a later sign-in does not reuse it.
        const back = takeReturnTo()
        if (created) void navigate({ to: '/onboarding' })
        else void navigate({ href: back })
      } catch (cause) {
        await forgetConfirmation(region, { endSession: true })
        setError(messageForConfirmError(cause))
      }
    })()
    // Runs once, on arrival with the link.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <main className="bg-background min-h-svh">
      <SignUpConfirmScreen
        error={error}
        onSignIn={() => void navigate({ to: '/sign-in', search: {} as never })}
        onSignUp={() => void navigate({ to: '/sign-up', search: {} as never })}
      />
    </main>
  )
}
