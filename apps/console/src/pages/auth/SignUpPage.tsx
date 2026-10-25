import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { ApiError, ErrorKind, useSignUp } from '@fp/query'
import { RegionField, SignUpScreen } from '@fp/ui/pages'
import { useSession } from '@/app/session'
import { useRegion } from '@/app/region'
import { resendConfirmation, startSignUp, supabaseSignUpFor } from '@/app/auth/supabaseSignUp'

/** A failed sign-up as a sentence. Same reasoning as `messageForSignInError`: map the kind, not the API's words. */
export function messageForSignUpError(error: unknown): string {
  if (!(error instanceof ApiError)) return 'Something went wrong creating your account. Try again.'
  if (error.status === 409) return 'An account with that email already exists. Sign in instead.'
  switch (error.kind) {
    case ErrorKind.Network:
      return 'Could not reach Flexprice. Check your connection and try again.'
    case ErrorKind.Timeout:
      return 'Creating your account took too long. Try again.'
    case ErrorKind.RateLimited:
      return 'Too many attempts. Wait a moment, then try again.'
    case ErrorKind.Server:
      return 'Flexprice is having trouble right now. Try again in a moment.'
    default:
      // An `Invalid` carries the API's own field-level complaint.
      return error.message || 'That account could not be created. Check the details and try again.'
  }
}

/**
 * Create an account.
 *
 * On the hosted regions this is the first half of a two-step sign-up: the email
 * and password go to Supabase, which emails a confirmation link, and the screen
 * says to check the inbox. The account itself is created on `/auth/signup/confirmation`
 * (see `supabaseSignUp`), because the backend creates one only for a confirmed
 * email.
 *
 * Self-hosted has no Supabase, and `POST /auth/signup` there takes the email and
 * password and answers with a session, so the person lands straight in the
 * console.
 */
export function SignUpPage() {
  const navigate = useNavigate()
  const session = useSession()
  const signUp = useSignUp()
  const { regions, region, setRegion } = useRegion()
  const viaSupabase = supabaseSignUpFor(region)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [resent, setResent] = useState(false)

  const isSubmitting = viaSupabase ? pending : signUp.isPending
  const error = viaSupabase ? failure : signUp.error ? messageForSignUpError(signUp.error) : null

  return (
    <main className="bg-background min-h-svh">
      <SignUpScreen
        {...(regions.length > 0
          ? {
              region: (
                <RegionField
                  regions={regions}
                  value={region}
                  onChange={(next) => {
                    setRegion(next)
                    signUp.reset()
                  }}
                  disabled={isSubmitting}
                />
              ),
            }
          : {})}
        isSubmitting={isSubmitting}
        error={error}
        sentTo={sentTo}
        resent={resent}
        {...(sentTo
          ? {
              onResend: () => {
                setPending(true)
                setFailure(null)
                resendConfirmation(region, sentTo)
                  .then(() => setResent(true))
                  .catch((cause: unknown) => setFailure(supabaseMessage(cause)))
                  .finally(() => setPending(false))
              },
            }
          : {})}
        onSignIn={() => void navigate({ to: '/sign-in', search: {} as never })}
        onSubmit={(details) => {
          if (viaSupabase) {
            setPending(true)
            setFailure(null)
            startSignUp(region, details.email, details.password)
              .then(() => setSentTo(details.email.trim()))
              .catch((cause: unknown) => setFailure(supabaseMessage(cause)))
              .finally(() => setPending(false))
            return
          }
          signUp.mutate(details, {
            onSuccess: (result) => {
              session.signIn({
                token: result.token,
                userId: result.userId,
                tenantId: result.tenantId,
              })
              void navigate({ to: '/', search: {} as never })
            },
          })
        }}
      />
    </main>
  )
}

/**
 * Supabase's own words for a refused sign-up are worth showing: they carry the
 * password policy and rate limits the project enforces: except a bare network
 * failure, which reads better as ours.
 */
function supabaseMessage(cause: unknown): string {
  if (!(cause instanceof Error) || !cause.message || /fetch/i.test(cause.message)) {
    return 'Could not reach Flexprice. Check your connection and try again.'
  }
  return cause.message
}
