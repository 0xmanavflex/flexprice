import { useState, type ReactNode } from 'react'
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
 * Authentication is `POST /auth/login`. Google sign-in is drawn because it is
 * part of the design, but until a deployment wires `onProvider` a click says
 * so, in the place errors are announced, instead of appearing to work.
 */
export const SignInScreenProvenance = provenance({
  source: 'composition',
  composes: ['pages/auth/AuthFrame', 'pages/auth/SignInForm', 'ui/button'],
  note: 'Sign-in from the dashboard redesign: auth-11 form column in AuthFrame, review panel right.',
})

export interface SignInScreenProps extends SignInFormProps {
  /** Start Google sign-in. Omitted while no deployment has it configured. */
  onProvider?: (providerId: string) => void
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
  onSignUp,
  onTerms,
  onPrivacy,
  ...form
}: SignInScreenProps) {
  const [providerNotice, setProviderNotice] = useState<string | null>(null)

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
            <GoogleButton
              onClick={() => {
                if (onProvider) {
                  onProvider('google')
                  return
                }
                setProviderNotice(
                  "Google sign-in isn't enabled for this workspace yet. Use your email and password.",
                )
              }}
            />
            {providerNotice ? (
              <p role="status" className="text-muted-foreground text-sm">
                {providerNotice}
              </p>
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
