import { useState } from 'react'
import { setPasswordSchema } from '@fp/domain'
import { Button } from '@ui/components/primitives/button'
import { Input } from '@ui/components/primitives/input'
import { Field } from '@ui/compositions/forms/Field'
import { FormDialog } from '@ui/compositions/forms/FormDialog'
import { provenance } from '@ui/provenance'

/**
 * Change your own password, from the account menu (self-hosted).
 *
 * A new password typed twice, checked against `setPasswordSchema` before it
 * leaves the form. The page owns the request: this takes the pending state and
 * the server's error and hands back the password.
 */
export const ChangePasswordDialogProvenance = provenance({
  source: 'composition',
  composes: ['compositions/forms/FormDialog', 'compositions/forms/Field', 'ui/input', 'ui/button'],
  note: 'New password and confirmation in a small dialog; the save is outline, as every non-create action is.',
})

export interface ChangePasswordDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (password: string) => void
  isPending?: boolean
  /** The server's refusal, shown under the fields. */
  error?: string | null
}

export function ChangePasswordDialog({
  open,
  onOpenChange,
  onSubmit,
  isPending = false,
  error = null,
}: ChangePasswordDialogProps) {
  return (
    <FormDialog
      open={open}
      size="sm"
      title="Change password"
      description="Use it the next time you sign in. Any password link made for you stops working."
      isPending={isPending}
      onOpenChange={onOpenChange}
    >
      <ChangePasswordBody
        isPending={isPending}
        error={error}
        onCancel={() => onOpenChange(false)}
        onSubmit={onSubmit}
      />
    </FormDialog>
  )
}

/** The fields, remounted fresh each time the dialog opens (`FormDialog` keys its body). */
function ChangePasswordBody({
  isPending,
  error,
  onCancel,
  onSubmit,
}: {
  isPending: boolean
  error: string | null
  onCancel: () => void
  onSubmit: (password: string) => void
}) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({})

  return (
    <form
      className="flex flex-col gap-4"
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        const parsed = setPasswordSchema.safeParse({ password, confirm })
        if (!parsed.success) {
          const next: { password?: string; confirm?: string } = {}
          for (const issue of parsed.error.issues) {
            const key = issue.path[0]
            if ((key === 'password' || key === 'confirm') && !next[key]) next[key] = issue.message
          }
          setErrors(next)
          return
        }
        setErrors({})
        onSubmit(parsed.data.password)
      }}
    >
      <Field label="New password" required {...(errors.password ? { error: errors.password } : {})}>
        {({ id, ...field }) => (
          <Input
            id={id}
            type="password"
            autoComplete="new-password"
            autoFocus
            disabled={isPending}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            {...field}
          />
        )}
      </Field>
      <Field
        label="Confirm password"
        required
        {...(errors.confirm ? { error: errors.confirm } : {})}
      >
        {({ id, ...field }) => (
          <Input
            id={id}
            type="password"
            autoComplete="new-password"
            disabled={isPending}
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            {...field}
          />
        )}
      </Field>
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="outline" disabled={isPending} onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="outline" disabled={isPending}>
          {isPending ? 'Saving…' : 'Change password'}
        </Button>
      </div>
    </form>
  )
}
