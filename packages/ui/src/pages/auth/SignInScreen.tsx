import type { ReactNode } from 'react'
import { Google } from '@ui/components/ui/svgs/google'
import { Button } from '@ui/components/primitives/button'
import { provenance } from '@ui/provenance'
import { AuthFrame } from './AuthFrame'
import { SignInForm, type SignInFormProps } from './SignInForm'

/**
 * The sign-in page, after the dashboard redesign: the Flexprice mark, a
 * left-aligned form (data region, email, password, Google), and the review
 * panel on the right.
 *
 * Authentication is `POST /auth/login`. Google is drawn only when the app
 * passes `onProvider`, which it does only when the deployment reports Google as
 * available (`useAuthCapabilities`). A button that renders unconditionally and
 * then explains that it does not work is worse than no button: it reads as a
 * broken feature rather than an absent one, and it is the first thing a new
 * user reaches for.
 */
export const SignInScreenProvenance = provenance({
  source: 'composition',
  composes: ['pages/auth/AuthFrame', 'pages/auth/SignInForm', 'ui/button'],
  note: 'Sign-in from the dashboard redesign: auth-11 form column in AuthFrame, review panel right.',
})

export interface SignInScreenProps extends SignInFormProps {
  /** Start Google sign-in. Omitted: and the button not drawn: when the
   * deployment does not offer it. */
  onProvider?: (providerId: string) => void
  /**
   * Start single sign-on.
   *
   * Separate from `onProvider`, which is Google and draws Google's mark. SSO
   * is per tenant and the screen is not told which identity provider is
   * behind it, so the button names the method rather than a brand.
   */
  onSso?: (() => void) | undefined
  /** The SSO button shows a pending state while the login is being started. */
  ssoPending?: boolean | undefined
  /** "Don't have an account? Sign up". Omitted, the line is not shown. */
  onSignUp?: () => void
  /** Footer links after the copyright. */
  onTerms?: () => void
  onPrivacy?: () => void
}

/** The full-width outline Google button the design draws under the divider. */
export function GoogleButton({
  label = 'Continue with Google',
  onClick,
}: {
  label?: string
  onClick: () => void
}) {
  return (
    <Button type="button" variant="outline" className="h-9 w-full" onClick={onClick}>
      <Google aria-hidden="true" />
      {label}
    </Button>
  )
}

/** "Don't have an account? Sign up" and its mirror on the sign-up page. */
export function SwitchLine({ children }: { children: ReactNode }) {
  return <p className="text-muted-foreground text-sm">{children}</p>
}

function FooterLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="hover:text-foreground">
      {label}
    </button>
  )
}

export function SignInScreen({
  onProvider,
  onSso,
  ssoPending = false,
  onSignUp,
  onTerms,
  onPrivacy,
  ...form
}: SignInScreenProps) {
  return (
    <AuthFrame
      quote="optimality"
      footer={
        <>
          {onPrivacy ? <FooterLink label="Privacy" onClick={onPrivacy} /> : null}
          {onTerms ? <FooterLink label="Terms" onClick={onTerms} /> : null}
        </>
      }
    >
      <SignInForm
        {...form}
        alternatives={
          <>
            {onProvider ? <GoogleButton onClick={() => onProvider('google')} /> : null}
            {onSso ? (
              <Button
                type="button"
                variant="outline"
                className="h-9 w-full"
                disabled={ssoPending}
                onClick={onSso}
              >
                {ssoPending ? 'Starting…' : 'Continue with SSO'}
              </Button>
            ) : null}
            {onSignUp ? (
              <SwitchLine>
                Don&apos;t have an account?{' '}
                <button
                  type="button"
                  onClick={onSignUp}
                  className="text-foreground underline-offset-4 hover:underline"
                >
                  Sign up
                </button>
              </SwitchLine>
            ) : null}
          </>
        }
      />
    </AuthFrame>
  )
}
