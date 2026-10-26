import { useCalmForm } from '@ui/compositions/forms/useCalmForm'
import { useEffect, useId, useRef } from 'react'
import { type Resolver } from 'react-hook-form'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { EyeIcon, EyeOffIcon } from '@ui/icons'
import { useState } from 'react'
import { type SignInCredentials, signInSchema } from '@fp/domain'
import { Button } from '@ui/components/primitives/button'
import {
  Field as FieldRoot,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@ui/components/primitives/field'
import { Separator } from '@ui/components/primitives/separator'
import { Input } from '@ui/components/primitives/input'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@ui/components/primitives/input-group'
import { Field } from '@ui/compositions/forms/Field'
import { provenance } from '@ui/provenance'
import { FormHead } from './AuthFrame'

/**
 * Sign in.
 *
 * The behaviour worth being deliberate about is the failure, because it is the
 * only part most people will ever exercise twice:
 *
 *   - the email is kept, the password is cleared, and focus moves to the
 *     password. Retyping an email you already typed correctly is the small
 *     insult that makes a login feel hostile.
 *   - the message is one sentence about what went wrong: "That email and
 *     password do not match." Not "Invalid credentials", which reads as a
 *     system fault rather than a typo, and not a list of possibilities.
 *   - the error sits above the form and is announced, because a message below
 *     the fold is a message nobody read.
 */
export const SignInFormProvenance = provenance({
  source: 'composition',
  composes: ['ui/button', 'ui/input', 'ui/input-group', 'ui/field', 'compositions/Field'],
  note: 'Presentational sign-in; the app owns the session.',
})

export interface SignInFormProps {
  onSubmit: (credentials: SignInCredentials) => void
  onForgotPassword?: () => void
  isSubmitting?: boolean
  /** A failure, already a sentence. The form never sees an ApiError. */
  error?: string | null
  /** Rendered under a divider: SSO, magic link, whatever the deployment has. */
  alternatives?: React.ReactNode
  /**
   * Seed the form's initial email/password. Used to pre-fill demo credentials
   * under mocks; omitted in normal operation so the form starts empty. Only read
   * on mount, the same as react-hook-form's own defaults.
   */
  defaultValues?: { email?: string; password?: string }
  /** Drawn first in the fields, e.g. the data-region picker. */
  region?: React.ReactNode
  /** A note above the fields: under mocks, that the demo credentials are filled in. */
  hint?: React.ReactNode
}

export function SignInForm({
  onSubmit,
  onForgotPassword,
  isSubmitting = false,
  error = null,
  alternatives,
  defaultValues,
  region,
  hint,
}: SignInFormProps) {
  const [revealed, setRevealed] = useState(false)
  const passwordRef = useRef<HTMLInputElement | null>(null)

  const form = useCalmForm<SignInCredentials>({
    resolver: standardSchemaResolver(signInSchema) as Resolver<SignInCredentials>,
    defaultValues: {
      email: defaultValues?.email ?? '',
      password: defaultValues?.password ?? '',
    },
  })

  // Keep what they got right, clear what they did not, and put the cursor
  // where the next keystroke belongs.
  //
  // `resetField`, not `setValue`: it restores the field to untouched-and-empty
  // without running the resolver. `setValue` re-validated the whole form, so a
  // rejected sign-in also raised "Enter your email" on a field that was filled
  // in correctly: two alerts for one event, one of them scolding the user for
  // something the application had just done itself.
  useEffect(() => {
    if (!error) return
    // `defaultValue: ''` explicitly, because a bare `resetField` restores the
    // field's *default*: and under mocks that default is the pre-filled demo
    // password. Clearing a rejected password only to put a password straight
    // back is the one thing this branch exists to prevent.
    form.resetField('password', { defaultValue: '' })
    passwordRef.current?.focus()
  }, [error, form])

  const { ref: registerPasswordRef, ...password } = form.register('password')
  const errors = form.formState.errors
  const passwordId = useId()
  const passwordErrorId = errors.password ? `${passwordId}-error` : undefined

  return (
    <form
      onSubmit={form.handleSubmit((values) => onSubmit(values))}
      noValidate
      aria-labelledby="sign-in-heading"
      className="flex w-full flex-col gap-6"
    >
      <FormHead
        id="sign-in-heading"
        title="Sign in to Flexprice"
        description="Monetization infrastructure for AI-native companies"
      />

      {hint ? (
        <p
          role="note"
          className="border-primary/30 bg-primary/5 text-muted-foreground rounded-lg border px-3 py-2 text-xs leading-relaxed"
        >
          {hint}
        </p>
      ) : null}

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
        <Field label="Email" error={errors.email?.message}>
          {({ id, ...field }) => (
            <Input
              id={id}
              type="email"
              autoComplete="email"
              // Not autofocused when an attempt has failed: the cursor belongs in
              // the password. Focusing here and then moving away blurs an empty
              // email, and blur validation would raise "Enter your email" on a
              // field the user never touched.
              autoFocus={!error}
              disabled={isSubmitting}
              placeholder="you@company.com"
              className="h-9"
              {...field}
              {...form.register('email')}
            />
          )}
        </Field>

        <FieldRoot data-invalid={errors.password ? true : undefined}>
          <div className="flex items-center justify-between">
            <FieldLabel htmlFor={passwordId}>Password</FieldLabel>
            {onForgotPassword ? (
              <button
                type="button"
                onClick={onForgotPassword}
                className="text-muted-foreground hover:text-foreground text-xs"
              >
                Forgot your password?
              </button>
            ) : null}
          </div>
          <InputGroup className="h-9">
            <InputGroupInput
              id={passwordId}
              type={revealed ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Enter your password"
              disabled={isSubmitting}
              aria-invalid={errors.password ? true : undefined}
              aria-describedby={passwordErrorId}
              {...password}
              ref={(node) => {
                registerPasswordRef(node)
                passwordRef.current = node
              }}
            />
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                size="icon-xs"
                aria-label={revealed ? 'Hide password' : 'Show password'}
                aria-pressed={revealed}
                onClick={() => setRevealed((value) => !value)}
              >
                {revealed ? <EyeOffIcon aria-hidden="true" /> : <EyeIcon aria-hidden="true" />}
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
          {errors.password?.message ? (
            <FieldError id={passwordErrorId} className="text-xs">
              {errors.password.message}
            </FieldError>
          ) : null}
        </FieldRoot>
      </FieldGroup>

      <Button type="submit" disabled={isSubmitting} className="h-9">
        {isSubmitting ? 'Signing in…' : 'Sign in'}
      </Button>

      {alternatives ? (
        <>
          <div className="text-muted-foreground flex items-center gap-3 text-xs">
            <Separator className="flex-1" />
            or
            <Separator className="flex-1" />
          </div>
          {alternatives}
        </>
      ) : null}
    </form>
  )
}
