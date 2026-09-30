import { useForm, type Resolver } from 'react-hook-form'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { type ResetRequest, resetRequestSchema } from '@fp/domain'
import { Button } from '@ui/components/primitives/button'
import { Input } from '@ui/components/primitives/input'
import { Field } from '@ui/compositions/Field'
import { provenance } from '@ui/provenance'

/**
 * Request a password reset.
 *
 * Two decisions worth stating.
 *
 * The confirmation replaces the form **on the same screen** rather than
 * navigating. Sending someone to a new page for one sentence loses the email
 * they typed, and makes "did that work?" answerable only by going back.
 *
 * The confirmation never says whether the address exists. "If that address has
 * an account, we have sent a link" is the same message either way, because a
 * different one turns the form into a way of discovering who has an account.
 */
export const ForgotPasswordFormProvenance = provenance({
  source: 'composition',
  composes: ['ui/button', 'ui/input', 'compositions/Field'],
  note: 'Request-and-confirm on one screen; the reply never reveals whether an account exists.',
})

export interface ForgotPasswordFormProps {
  onSubmit: (request: ResetRequest) => void
  onBack?: () => void
  isSubmitting?: boolean
  /** Switches the screen to its confirmation. The app sets this on success. */
  sentTo?: string | null
  error?: string | null
}

export function ForgotPasswordForm({
  onSubmit,
  onBack,
  isSubmitting = false,
  sentTo = null,
  error = null,
}: ForgotPasswordFormProps) {
  const form = useForm<ResetRequest>({
    resolver: standardSchemaResolver(resetRequestSchema) as Resolver<ResetRequest>,
    defaultValues: { email: '' },
    mode: 'onTouched',
  })

  if (sentTo) {
    return (
      <div className="flex w-full max-w-sm flex-col gap-4" role="status">
        <h1 className="text-xl font-semibold">Check your email</h1>
        <p className="text-muted-foreground text-sm">
          If <span className="text-foreground font-medium">{sentTo}</span> has an account, we have
          sent a link to reset the password. It expires in an hour.
        </p>
        {onBack ? (
          <Button type="button" variant="outline" onClick={onBack} className="w-fit">
            Back to sign in
          </Button>
        ) : null}
      </div>
    )
  }

  return (
    <form
      onSubmit={form.handleSubmit((values) => onSubmit(values))}
      noValidate
      aria-labelledby="forgot-heading"
      className="flex w-full max-w-sm flex-col gap-5"
    >
      <div className="flex flex-col gap-1">
        <h1 id="forgot-heading" className="text-xl font-semibold">
          Reset your password
        </h1>
        <p className="text-muted-foreground text-sm">
          We will email you a link to choose a new one.
        </p>
      </div>

      {error ? (
        <p
          role="alert"
          className="border-destructive/20 bg-destructive/10 text-destructive-foreground dark:text-destructive rounded-lg border px-3 py-2 text-sm"
        >
          {error}
        </p>
      ) : null}

      <Field label="Email" error={form.formState.errors.email?.message}>
        {({ id, ...field }) => (
          <Input
            id={id}
            type="email"
            autoComplete="email"
            autoFocus
            disabled={isSubmitting}
            {...field}
            {...form.register('email')}
          />
        )}
      </Field>

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Sending…' : 'Send reset link'}
        </Button>
        {onBack ? (
          <Button type="button" variant="link" size="sm" onClick={onBack}>
            Back to sign in
          </Button>
        ) : null}
      </div>
    </form>
  )
}
