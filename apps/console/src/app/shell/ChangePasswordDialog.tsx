import { ApiError, useChangeOwnPassword } from '@fp/query'
import { ChangePasswordDialog as ChangePasswordDialogView, toast } from '@fp/ui/pages'

/**
 * Change your own password, from the account menu (self-hosted): the request
 * behind the UI package's dialog.
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
    <ChangePasswordDialogView
      open={open}
      isPending={change.isPending}
      error={
        change.error
          ? change.error instanceof ApiError && change.error.fromServer
            ? change.error.message
            : 'The password could not be changed. Try again.'
          : null
      }
      onOpenChange={(next) => {
        if (!next) change.reset()
        onOpenChange(next)
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
  )
}
