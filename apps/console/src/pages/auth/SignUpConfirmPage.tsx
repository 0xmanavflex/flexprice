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
 * carries the new tenant, becomes the console's session; and the link's own
 * session is dropped, along with the tokens in the address bar.
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
        const credentials = await completeAccount(region, confirmed, (details) =>
          createAccount.mutateAsync(details),
        )
        session.signIn(credentials)
        await forgetConfirmation(region)
        // Google sign-in returns here: back to the page that asked for it, if any.
        void navigate({ href: takeReturnTo() })
      } catch (cause) {
        await forgetConfirmation(region)
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
