import { useCalmForm } from '@ui/compositions/forms/useCalmForm'
import { useState } from 'react'
import { type Resolver } from 'react-hook-form'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { EyeIcon, EyeOffIcon } from '@ui/icons'
import { type SetPassword, setPasswordSchema } from '@fp/domain'
import { Badge } from '@ui/components/reui/badge'
import { Button } from '@ui/components/primitives/button'
import { Input } from '@ui/components/primitives/input'
import { Field } from '@ui/compositions/forms/Field'
import { provenance } from '@ui/provenance'

/**
 * Accept an invitation by choosing a password.
 *
 * It states **which organisation and which role** before the fields. Somebody
 * arriving from an email has no other way to know what they are joining, and
 * "Finance (read only)" versus "Finance (admin)" is exactly the difference
 * worth noticing before accepting rather than after.
 *
 * The email is shown and not editable: it is what the invitation was issued
 * against, and letting it be changed would turn an invitation into a way of
 * creating an account for someone else.
 */
export const AcceptInvitationFormProvenance = provenance({
  source: 'composition',
  composes: ['ui/button', 'ui/input', '@reui/badge', 'compositions/Field'],
  note: 'States the organisation and role before asking for a password.',
})

export interface AcceptInvitationFormProps {
  organisation: string
  /** As granted by the invitation, in the product's words. */
  role: string
  /** The address the invitation was issued to. Shown, never editable. */
  email: string
  onSubmit: (value: SetPassword) => void
  isSubmitting?: boolean
  error?: string | null
}

export function AcceptInvitationForm({
  organisation,
  role,
  email,
  onSubmit,
  isSubmitting = false,
  error = null,
}: AcceptInvitationFormProps) {
  const [revealed, setRevealed] = useState(false)
  const form = useCalmForm<SetPassword>({
    resolver: standardSchemaResolver(setPasswordSchema) as Resolver<SetPassword>,
    defaultValues: { password: '', confirm: '' },
  })
  const errors = form.formState.errors

  return (
    <form
      onSubmit={form.handleSubmit((values) => onSubmit(values))}
      noValidate
      aria-labelledby="invite-heading"
      className="flex w-full max-w-sm flex-col gap-5"
    >
      <div className="flex flex-col gap-2">
        <h1 id="invite-heading" className="text-2xl font-medium tracking-tight">
          Join {organisation}
        </h1>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Joining as</span>
          <Badge variant="secondary" size="sm">
            {role}
          </Badge>
        </div>
        <p className="text-muted-foreground text-sm">
          Invitation sent to <span className="text-foreground font-medium">{email}</span>
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

      <Field
        label="Choose a password"
        hint="At least 12 characters. A memorable phrase beats a short complicated one."
        error={errors.password?.message}
      >
        {({ id, ...field }) => (
          <div className="relative">
            <Input
              id={id}
              type={revealed ? 'text' : 'password'}
              autoComplete="new-password"
              autoFocus
              disabled={isSubmitting}
              className="pr-10"
              {...field}
              {...form.register('password')}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setRevealed((value) => !value)}
              aria-label={revealed ? 'Hide password' : 'Show password'}
              aria-pressed={revealed}
              className="text-muted-foreground absolute inset-y-0 right-0 h-full w-10 p-0"
            >
              {revealed ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
            </Button>
          </div>
        )}
      </Field>

      <Field
        label="Type it again"
        hint="Repeat the password to make sure it was typed correctly."
        error={errors.confirm?.message}
      >
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

      <Button type="submit" disabled={isSubmitting} className="w-fit">
        {isSubmitting ? 'Joining…' : `Join ${organisation}`}
      </Button>
    </form>
  )
}
