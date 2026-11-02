import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { AuthFrame, SetPasswordForm } from '@fp/ui/pages'
import { useRegion } from '@/app/region'
import { useSession } from '@/app/session'
import {
  PasswordResetUnavailable,
  completePasswordReset,
  hasRecoveryToken,
} from '@/app/auth/passwordReset'

/**
 * The far end of a reset link.
 *
 * Supabase sends the recovery tokens in the URL **fragment**, which never
 * leaves the browser, and supabase-js consumes them to establish the momentary
 * session that authorises the change. `completePasswordReset` signs that
 * session out the instant the update finishes.
 *
 * Whether a link is present is read once, on mount, from the fragment the page
 * loaded with. It cannot be read later: supabase-js strips the fragment as soon
 * as it has consumed it, so a check on any subsequent render would conclude the
 * link was never there and show the expired screen over a working form.
 *
 * A console session already open in this browser ends once the password is
 * changed. The page is reachable signed in, and `/sign-in` steps aside to the
 * dashboard for a live session, so "Back to sign in" would otherwise land on
 * the dashboard of whoever was signed in, under the old password.
 */
export function ResetPasswordPage() {
  const navigate = useNavigate()
  const { region } = useRegion()
  const session = useSession()
  const [arrivedWithLink] = useState(hasRecoveryToken)
  const [done, setDone] = useState(false)
  const [isSubmitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toSignIn = () => void navigate({ to: '/sign-in', search: {} as never })

  return (
    <main className="bg-background min-h-svh">
      <AuthFrame quote="optimality">
        <SetPasswordForm
          expired={!arrivedWithLink}
          done={done}
          isSubmitting={isSubmitting}
          error={error}
          onSignIn={toSignIn}
          onRequestAnother={() => void navigate({ to: '/forgot-password', search: {} as never })}
          onSubmit={({ password }) => {
            setSubmitting(true)
            setError(null)
            completePasswordReset(region, password)
              .then(() => {
                if (session.session) session.signOut()
                setDone(true)
              })
              .catch((cause: unknown) => {
                setError(
                  cause instanceof PasswordResetUnavailable
                    ? 'Password reset is not set up for this deployment.'
                    : // Supabase's own message is worth showing here, unlike at
                      // sign-in: it carries the password policy the project
                      // enforces, which this console cannot know in advance.
                      cause instanceof Error
                      ? cause.message
                      : 'Could not change the password. Try again.',
                )
              })
              .finally(() => setSubmitting(false))
          }}
        />
      </AuthFrame>
    </main>
  )
}
