import { useState } from 'react'
import { setPasswordSchema } from '@fp/domain'
import { ApiError, useChangeOwnPassword } from '@fp/query'
import { Field, FormDialog } from '@fp/ui/compositions'
import { toast } from '@fp/ui/pages'
import { Button, Input } from '@fp/ui/primitives'

/**
 * Change your own password, from the account menu (self-hosted).
 *
 * `PUT /users/me/password` takes the new password only: no current one, as
 * V1 has it (flexprice#3123). The session stays signed in; the next sign-in
 * uses the new password. Setting it also spends any password link an admin
 * made for this account, because a link is signed over the old hash.
 */
export function ChangePasswordDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const change = useChangeOwnPassword()

  return (
    <FormDialog
      open={open}
      size="sm"
      title="Change password"
      description="Use it the next time you sign in. Any password link made for you stops working."
      isPending={change.isPending}
      onOpenChange={(next) => {
        if (!next) change.reset()
        onOpenChange(next)
      }}
    >
      <ChangePasswordBody
        isPending={change.isPending}
        error={
          change.error
            ? change.error instanceof ApiError && change.error.fromServer
              ? change.error.message
              : 'The password could not be changed. Try again.'
            : null
        }
        onCancel={() => {
          change.reset()
          onOpenChange(false)
        }}
        onSubmit={(password) =>
          change.mutate(password, {
            onSuccess: () => {
              onOpenChange(false)
              toast.success('Password changed')
            },
          })
        }
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
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Saving…' : 'Change password'}
        </Button>
      </div>
    </form>
  )
}
