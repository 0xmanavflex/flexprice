import { useNavigate } from '@tanstack/react-router'
import { ApiError, ErrorKind, useSignUp } from '@fp/query'
import { SignUpScreen } from '@fp/ui/pages'
import { useSession } from '@/app/session'

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
 * Create an account — `POST /auth/signup`, which answers with a session the
 * same way sign-in does, so a new account lands straight in the console.
 */
export function SignUpPage() {
  const navigate = useNavigate()
  const session = useSession()
  const signUp = useSignUp()

  return (
    <main className="bg-background min-h-svh">
      <SignUpScreen
        isSubmitting={signUp.isPending}
        error={signUp.error ? messageForSignUpError(signUp.error) : null}
        onSignIn={() => void navigate({ to: '/sign-in', search: {} as never })}
        onSubmit={(details) => {
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
