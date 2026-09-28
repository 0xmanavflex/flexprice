import { useEffect, useRef } from 'react'
import { useForm, type Resolver } from 'react-hook-form'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { EyeIcon, EyeOffIcon } from 'lucide-react'
import { useState } from 'react'
import { type SignInCredentials, signInSchema } from '@fp/domain'
import { Button } from '@ui/primitives/button'
import { Input } from '@ui/primitives/input'
import { Field } from '@ui/compositions/Field'
import { provenance } from '@ui/provenance'

/**
 * Sign in.
 *
 * The behaviour worth being deliberate about is the failure, because it is the
 * only part most people will ever exercise twice:
 *
 *   - the email is kept, the password is cleared, and focus moves to the
 *     password. Retyping an email you already typed correctly is the small
 *     insult that makes a login feel hostile.
 *   - the message is one sentence about what went wrong — "That email and
 *     password do not match." Not "Invalid credentials", which reads as a
 *     system fault rather than a typo, and not a list of possibilities.
 *   - the error sits above the form and is announced, because a message below
 *     the fold is a message nobody read.
 */
export const SignInFormProvenance = provenance({
  source: 'composition',
  composes: ['ui/button', 'ui/input', 'compositions/Field'],
  note: 'Presentational sign-in; the app owns the session.',
})

export interface SignInFormProps {
  onSubmit: (credentials: SignInCredentials) => void
  onForgotPassword?: () => void
  isSubmitting?: boolean
  /** A failure, already a sentence. The form never sees an ApiError. */
  error?: string | null
  /** Rendered under a divider — SSO, magic link, whatever the deployment has. */
  alternatives?: React.ReactNode
  /**
   * Seed the form's initial email/password. Used to pre-fill demo credentials
   * under mocks; omitted in normal operation so the form starts empty. Only read
   * on mount, the same as react-hook-form's own defaults.
   */
  defaultValues?: { email?: string; password?: string }
}

export function SignInForm({
  onSubmit,
  onForgotPassword,
  isSubmitting = false,
  error = null,
  alternatives,
  defaultValues,
}: SignInFormProps) {
  const [revealed, setRevealed] = useState(false)
  const passwordRef = useRef<HTMLInputElement | null>(null)

  const form = useForm<SignInCredentials>({
    resolver: standardSchemaResolver(signInSchema) as Resolver<SignInCredentials>,
    defaultValues: {
      email: defaultValues?.email ?? '',
      password: defaultValues?.password ?? '',
    },
    mode: 'onTouched',
  })

  // Keep what they got right, clear what they did not, and put the cursor
  // where the next keystroke belongs.
  //
  // `resetField`, not `setValue`: it restores the field to untouched-and-empty
  // without running the resolver. `setValue` re-validated the whole form, so a
  // rejected sign-in also raised "Enter your email" on a field that was filled
  // in correctly — two alerts for one event, one of them scolding the user for
  // something the application had just done itself.
  useEffect(() => {
    if (!error) return
    form.resetField('password')
    passwordRef.current?.focus()
  }, [error, form])

  const { ref: registerPasswordRef, ...password } = form.register('password')
  const errors = form.formState.errors

  return (
    <form
      onSubmit={form.handleSubmit((values) => onSubmit(values))}
      noValidate
      aria-labelledby="sign-in-heading"
      className="flex w-full flex-col gap-4"
    >
      <div className="flex flex-col items-center gap-1 text-center">
        <h1 id="sign-in-heading" className="text-xl font-semibold tracking-tight">
          Sign in to Flexprice
        </h1>
        <p className="text-sm text-muted-foreground">Billing and usage for your product.</p>
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive-foreground dark:text-destructive"
        >
          {error}
        </p>
      ) : null}

      <Field label="Email" error={errors.email?.message}>
        {({ id, ...field }) => (
          <Input
            id={id}
            type="email"
            autoComplete="email"
            // Not autofocused when an attempt has failed: the cursor belongs in
            // the password. Focusing here and then moving away blurs an empty
            // email, and `onTouched` validation raises "Enter your email" on a
            // field the user never touched.
            autoFocus={!error}
            disabled={isSubmitting}
            {...field}
            {...form.register('email')}
          />
        )}
      </Field>

      <Field label="Password" error={errors.password?.message}>
        {({ id, ...field }) => (
          <div className="relative">
            <Input
              id={id}
              type={revealed ? 'text' : 'password'}
              autoComplete="current-password"
              disabled={isSubmitting}
              className="pr-10"
              {...field}
              {...password}
              ref={(node) => {
                registerPasswordRef(node)
                passwordRef.current = node
              }}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setRevealed((value) => !value)}
              aria-label={revealed ? 'Hide password' : 'Show password'}
              aria-pressed={revealed}
              className="absolute inset-y-0 right-0 h-full w-10 p-0 text-muted-foreground"
            >
              {revealed ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
            </Button>
          </div>
        )}
      </Field>

      {onForgotPassword ? (
        <div className="-mt-1 flex justify-end">
          <Button
            type="button"
            variant="link"
            onClick={onForgotPassword}
            className="text-muted-foreground h-auto p-0 text-xs font-normal"
          >
            Forgot password?
          </Button>
        </div>
      ) : null}

      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? 'Signing in…' : 'Sign in'}
      </Button>

      {alternatives ? (
        <>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            or
            <span className="h-px flex-1 bg-border" />
          </div>
          {alternatives}
        </>
      ) : null}
    </form>
  )
}
