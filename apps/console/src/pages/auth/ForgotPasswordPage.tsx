import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { AuthFrame, ForgotPasswordForm } from '@fp/ui/pages'
import { useRegion } from '@/app/region'
import { PasswordResetUnavailable, requestPasswordReset } from '@/app/auth/passwordReset'

/**
 * Request a reset link.
 *
 * Not a `useMutation`: this is a fire-and-forget call to Supabase rather than
 * to the Flexprice API, so there is no cache to touch and nothing a retry on
 * focus could usefully do. Local state is the honest size of the problem.
 *
 * The confirmation never says whether the address has an account: the form
 * component owns that wording, and the reason is that a different answer either
 * way turns this page into a way of discovering who has one.
 */
export function ForgotPasswordPage() {
  const navigate = useNavigate()
  const { region } = useRegion()
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [isSubmitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toSignIn = () => void navigate({ to: '/sign-in', search: {} as never })

  return (
    <main className="bg-background min-h-svh">
      <AuthFrame quote="optimality">
        <ForgotPasswordForm
          sentTo={sentTo}
          isSubmitting={isSubmitting}
          error={error}
          onBack={toSignIn}
          onSubmit={({ email }) => {
            setSubmitting(true)
            setError(null)
            requestPasswordReset(region, email)
              .then(() => setSentTo(email))
              .catch((cause: unknown) => {
                setError(
                  cause instanceof PasswordResetUnavailable
                    ? 'Password reset is not set up for this deployment. Ask an administrator to reset it for you.'
                    : 'Could not send the reset link. Check your connection and try again.',
                )
              })
              .finally(() => setSubmitting(false))
          }}
        />
      </AuthFrame>
    </main>
  )
}
