import { useCalmForm } from '@ui/compositions/forms/useCalmForm'
import { useId, useState, type ReactNode } from 'react'
import { type Resolver } from 'react-hook-form'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { EyeIcon, EyeOffIcon } from '@ui/icons'
import { type SignUpDetails, signUpSchema } from '@fp/domain'
import { Button } from '@ui/components/primitives/button'
import { Field, FieldError, FieldGroup, FieldLabel } from '@ui/components/primitives/field'
import { Input } from '@ui/components/primitives/input'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@ui/components/primitives/input-group'
import { Separator } from '@ui/components/primitives/separator'
import { provenance } from '@ui/provenance'
import { AuthFrame, FormHead } from './AuthFrame'
import { GoogleButton, SwitchLine } from './SignInScreen'

/**
 * Create an account, after the dashboard redesign: data region, work email,
 * password and its confirmation, then Google and the way back to sign in, in
 * the same frame as sign-in.
 */
export const SignUpScreenProvenance = provenance({
  source: 'composition',
  composes: ['pages/auth/AuthFrame', 'ui/field', 'ui/input', 'ui/input-group', 'ui/button'],
  note: 'Sign-up from the dashboard redesign: auth-11 form column in AuthFrame, review panel right.',
})

export interface SignUpScreenProps {
  onSubmit: (details: { email: string; password: string }) => void
  isSubmitting?: boolean
  /** A failure, already a sentence. */
  error?: string | null
  /** Drawn first in the fields, e.g. the data-region picker. */
  region?: ReactNode
  /** "Already have an account? Log in". */
  onSignIn?: () => void
  /** Start Google sign-up. Omitted: and the button not drawn: when the
   * deployment does not offer it. */
  onProvider?: (providerId: string) => void
  /**
   * Switches the screen to "check your email" for this address: the account is
   * created only once the link in that email is followed.
   */
  sentTo?: string | null
  /** Sends the confirmation email again; drawn on the "check your email" screen. */
  onResend?: () => void
  /** The resend went out. */
  resent?: boolean
}

/** A password box with the eye toggle, as the design draws it. */
function PasswordInput({
  id,
  placeholder,
  autoComplete,
  invalid,
  describedBy,
  disabled,
  registration,
}: {
  id: string
  placeholder: string
  autoComplete: string
  invalid: boolean
  describedBy: string | undefined
  disabled: boolean
  registration: ReturnType<ReturnType<typeof useCalmForm<SignUpDetails>>['register']>
}) {
  const [shown, setShown] = useState(false)
  return (
    <InputGroup className="h-9">
      <InputGroupInput
        id={id}
        type={shown ? 'text' : 'password'}
        autoComplete={autoComplete}
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={invalid ? true : undefined}
        aria-describedby={describedBy}
        {...registration}
      />
      <InputGroupAddon align="inline-end">
        <InputGroupButton
          size="icon-xs"
          aria-label={shown ? 'Hide password' : 'Show password'}
          aria-pressed={shown}
          onClick={() => setShown((value) => !value)}
        >
          {shown ? <EyeOffIcon aria-hidden="true" /> : <EyeIcon aria-hidden="true" />}
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  )
}

export function SignUpScreen({
  onSubmit,
  isSubmitting = false,
  error = null,
  region,
  onSignIn,
  onProvider,
  sentTo = null,
  onResend,
  resent = false,
}: SignUpScreenProps) {
  const form = useCalmForm<SignUpDetails>({
    resolver: standardSchemaResolver(signUpSchema) as Resolver<SignUpDetails>,
    defaultValues: { email: '', password: '', confirm: '' },
  })
  const errors = form.formState.errors
  const emailId = useId()
  const passwordId = useId()
  const confirmId = useId()
  const errorId = (id: string, present: boolean) => (present ? `${id}-error` : undefined)

  if (sentTo) {
    return (
      <AuthFrame quote="truffle">
        <div className="flex w-full flex-col gap-6" role="status">
          <FormHead
            title="Check your email"
            description={
              <>
                We sent a link to <span className="text-foreground font-medium">{sentTo}</span>.
                Open it to confirm the address and finish creating your account.
              </>
            }
          />
          {error ? (
            <p
              role="alert"
              className="border-destructive/20 bg-destructive/10 text-destructive-foreground dark:text-destructive rounded-lg border px-3 py-2 text-sm"
            >
              {error}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {onResend ? (
              <Button
                type="button"
                variant="outline"
                onClick={onResend}
                disabled={isSubmitting || resent}
              >
                {resent ? 'Email sent again' : isSubmitting ? 'Sending…' : 'Resend email'}
              </Button>
            ) : null}
            {onSignIn ? (
              <Button type="button" variant="ghost" onClick={onSignIn}>
                Back to sign in
              </Button>
            ) : null}
          </div>
        </div>
      </AuthFrame>
    )
  }

  return (
    <AuthFrame quote="truffle">
      <form
        onSubmit={form.handleSubmit(({ email, password }) => onSubmit({ email, password }))}
        noValidate
        aria-labelledby="sign-up-heading"
        className="flex w-full flex-col gap-6"
      >
        <FormHead
          id="sign-up-heading"
          title="Create your account"
          description="Get started in minutes."
        />

        {error ? (
          <p
            role="alert"
            className="border-destructive/20 bg-destructive/10 text-destructive-foreground dark:text-destructive rounded-lg border px-3 py-2 text-sm"
          >
            {error}
          </p>
        ) : null}

        <FieldGroup className="gap-4">
          {region}
          <Field data-invalid={errors.email ? true : undefined}>
            <FieldLabel htmlFor={emailId}>Work email</FieldLabel>
            <Input
              id={emailId}
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              className="h-9"
              disabled={isSubmitting}
              aria-invalid={errors.email ? true : undefined}
              aria-describedby={errorId(emailId, Boolean(errors.email))}
              {...form.register('email')}
            />
            {errors.email?.message ? (
              <FieldError id={`${emailId}-error`} className="text-xs">
                {errors.email.message}
              </FieldError>
            ) : null}
          </Field>
          <Field data-invalid={errors.password ? true : undefined}>
            <FieldLabel htmlFor={passwordId}>Password</FieldLabel>
            <PasswordInput
              id={passwordId}
              placeholder="At least 8 characters"
              autoComplete="new-password"
              invalid={Boolean(errors.password)}
              describedBy={errorId(passwordId, Boolean(errors.password))}
              disabled={isSubmitting}
              registration={form.register('password')}
            />
            {errors.password?.message ? (
              <FieldError id={`${passwordId}-error`} className="text-xs">
                {errors.password.message}
              </FieldError>
            ) : null}
          </Field>
          <Field data-invalid={errors.confirm ? true : undefined}>
            <FieldLabel htmlFor={confirmId}>Confirm password</FieldLabel>
            <PasswordInput
              id={confirmId}
              placeholder="Type it again"
              autoComplete="new-password"
              invalid={Boolean(errors.confirm)}
              describedBy={errorId(confirmId, Boolean(errors.confirm))}
              disabled={isSubmitting}
              registration={form.register('confirm')}
            />
            {errors.confirm?.message ? (
              <FieldError id={`${confirmId}-error`} className="text-xs">
                {errors.confirm.message}
              </FieldError>
            ) : null}
          </Field>
        </FieldGroup>

        <Button type="submit" disabled={isSubmitting} className="h-9">
          {isSubmitting ? 'Creating account…' : 'Create account'}
        </Button>

        <div className="text-muted-foreground flex items-center gap-3 text-xs">
          <Separator className="flex-1" />
          or
          <Separator className="flex-1" />
        </div>

        {onProvider ? <GoogleButton onClick={() => onProvider('google')} /> : null}

        {onSignIn ? (
          <SwitchLine>
            Already have an account?{' '}
            <button
              type="button"
              onClick={onSignIn}
              className="text-foreground underline-offset-4 hover:underline"
            >
              Log in
            </button>
          </SwitchLine>
        ) : null}
      </form>
    </AuthFrame>
  )
}
