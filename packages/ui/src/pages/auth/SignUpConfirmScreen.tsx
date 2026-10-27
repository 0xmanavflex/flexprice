import { Button } from '@ui/components/primitives/button'
import { Spinner } from '@ui/components/primitives/spinner'
import { provenance } from '@ui/provenance'
import { AuthFrame, FormHead } from './AuthFrame'

export const SignUpConfirmScreenProvenance = provenance({
  source: 'composition',
  composes: ['pages/auth/AuthFrame', 'ui/button', 'ui/spinner'],
  note: 'The far end of the sign-up confirmation email: finishing, or why it could not.',
})

export interface SignUpConfirmScreenProps {
  /** Why the account could not be finished, as a sentence; null while it is being finished. */
  error?: string | null
  /** Start again from the sign-up form. */
  onSignUp?: () => void
  onSignIn?: () => void
}

/**
 * Where the confirmation link lands. While the account is being created it
 * says so; if the link was stale or the account could not be made, it says
 * that and offers the two ways forward.
 */
export function SignUpConfirmScreen({
  error = null,
  onSignUp,
  onSignIn,
}: SignUpConfirmScreenProps) {
  return (
    <AuthFrame quote="optimality">
      {error ? (
        <div className="flex w-full flex-col gap-6" role="alert">
          <FormHead title="We could not finish your sign-up" description={error} />
          <div className="flex flex-wrap gap-2">
            {onSignIn ? (
              <Button type="button" onClick={onSignIn}>
                Sign in
              </Button>
            ) : null}
            {onSignUp ? (
              <Button type="button" variant="outline" onClick={onSignUp}>
                Sign up again
              </Button>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="flex w-full flex-col gap-6" role="status">
          <FormHead
            title="Setting up your account"
            description="Your email is confirmed. Creating your organisation now."
          />
          <Spinner className="text-muted-foreground size-5" aria-hidden="true" />
        </div>
      )}
    </AuthFrame>
  )
}
