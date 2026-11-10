import { useState } from 'react'
import { type Resolver } from 'react-hook-form'
import { useCalmForm } from '@ui/compositions/forms/useCalmForm'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { type SetPassword, setPasswordSchema } from '@fp/domain'
import { Button } from '@ui/components/primitives/button'
import { Input } from '@ui/components/primitives/input'
import { Field } from '@ui/compositions/forms/Field'
import { provenance } from '@ui/provenance'

/**
 * Choose a new password, at the end of a reset link.
 *
 * Three decisions worth stating.
 *
 * **The link is assumed spent once this submits.** A recovery link is
 * single-use, so the success state offers sign-in rather than the form again:
 * re-submitting would fail with an expired-token error that reads as though the
 * new password did not take.
 *
 * **An expired or missing link is a different screen, not an error on this
 * one.** Someone who opens `/reset-password` directly, or returns to a link
 * from yesterday, cannot be helped by a password field; `expired` replaces the
 * form with the way to get a fresh one.
 *
 * **One reveal toggle for both fields.** The confirmation exists to catch a
 * typo. Letting the two be revealed separately means they can be compared by
 * eye in one and not the other, which is the case the confirmation is for.
 */
export const SetPasswordFormProvenance = provenance({
  source: 'composition',
  composes: ['ui/button', 'ui/input', 'compositions/forms/Field'],
  note: 'New password and confirmation behind one reveal; separate screens for done and for an expired link.',
})

export interface SetPasswordFormProps {
  onSubmit: (value: SetPassword) => void
  isSubmitting?: boolean
  error?: string | null
  /** The link is missing, spent or expired: the form cannot work, so it is not shown. */
  expired?: boolean
  /** The password was changed. Replaces the form with the way on. */
  done?: boolean
  onSignIn?: () => void
  /** Offered on the expired screen, to start again. */
  onRequestAnother?: () => void
  /** Overrides the heading: "Set your password" for an invitation link. */
  title?: string
  /** Overrides the line under the heading. */
  description?: string
  /** Whose password this sets, shown and never editable. */
  email?: string
  /** The link is still being checked: nothing to fill in yet. */
  checking?: boolean
  /**
   * Overrides the expired screen's text, e.g. "Ask your admin for a new one"
   * when links come from an admin rather than an email request.
   */
  expiredDescription?: string
}

export function SetPasswordForm({
  onSubmit,
  isSubmitting = false,
  error = null,
  expired = false,
  done = false,
  onSignIn,
  onRequestAnother,
  title = 'Choose a new password',
  description = 'This replaces the old one everywhere you sign in.',
  email,
  checking = false,
  expiredDescription = 'Reset links are good for one use and a short while. Request a new one and it will arrive in a moment.',
}: SetPasswordFormProps) {
  const [revealed, setRevealed] = useState(false)
  const form = useCalmForm<SetPassword>({
    resolver: standardSchemaResolver(setPasswordSchema) as Resolver<SetPassword>,
    defaultValues: { password: '', confirm: '' },
  })

  if (done) {
    return (
      <div className="flex w-full max-w-sm flex-col gap-4" role="status">
        <h1 className="text-2xl font-medium tracking-tight">Password changed</h1>
        <p className="text-muted-foreground text-sm">
          Use the new password to sign in. The link you followed has been used and will not work
          again.
        </p>
        {onSignIn ? (
          <Button type="button" onClick={onSignIn} className="w-fit">
            Go to sign in
          </Button>
        ) : null}
      </div>
    )
  }

  if (expired) {
    return (
      <div className="flex w-full max-w-sm flex-col gap-4" role="status">
        <h1 className="text-2xl font-medium tracking-tight">That link has expired</h1>
        <p className="text-muted-foreground text-sm">{expiredDescription}</p>
        <div className="flex items-center gap-2">
          {onRequestAnother ? (
            <Button type="button" onClick={onRequestAnother} className="w-fit">
              Request a new link
            </Button>
          ) : null}
          {onSignIn ? (
            <Button type="button" variant="link" size="sm" onClick={onSignIn}>
              Back to sign in
            </Button>
          ) : null}
        </div>
      </div>
    )
  }

  if (checking) {
    return (
      <div className="flex w-full max-w-sm flex-col gap-4" role="status">
        <h1 className="text-2xl font-medium tracking-tight">{title}</h1>
        <p className="text-muted-foreground text-sm">Checking your link…</p>
      </div>
    )
  }

  return (
    <form
      onSubmit={form.handleSubmit((values) => onSubmit(values))}
      noValidate
      aria-labelledby="set-password-heading"
      className="flex w-full max-w-sm flex-col gap-5"
    >
      <div className="flex flex-col gap-1">
        <h1 id="set-password-heading" className="text-2xl font-medium tracking-tight">
          {title}
        </h1>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>

      {error ? (
        <p
          role="alert"
          className="border-destructive/20 bg-destructive/10 text-destructive-foreground dark:text-destructive rounded-lg border px-3 py-2 text-sm"
        >
          {error}
        </p>
      ) : null}

      {email ? (
        <Field label="Email">
          {({ id, ...field }) => <Input id={id} value={email} readOnly disabled {...field} />}
        </Field>
      ) : null}

      <Field label="New password" error={form.formState.errors.password?.message}>
        {({ id, ...field }) => (
          <Input
            id={id}
            type={revealed ? 'text' : 'password'}
            autoComplete="new-password"
            autoFocus
            disabled={isSubmitting}
            {...field}
            {...form.register('password')}
          />
        )}
      </Field>

      <Field label="Confirm password" error={form.formState.errors.confirm?.message}>
        {({ id, ...field }) => (
          <Input
            id={id}
            type={revealed ? 'text' : 'password'}
            autoComplete="new-password"
            disabled={isSubmitting}
            {...field}
            {...form.register('confirm')}
          />
        )}
      </Field>

      <label className="text-muted-foreground flex w-fit items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={revealed}
          onChange={(event) => setRevealed(event.target.checked)}
          className="accent-primary size-4"
        />
        Show password
      </label>

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : 'Save password'}
        </Button>
        {onSignIn ? (
          <Button type="button" variant="link" size="sm" onClick={onSignIn}>
            Back to sign in
          </Button>
        ) : null}
      </div>
    </form>
  )
}
