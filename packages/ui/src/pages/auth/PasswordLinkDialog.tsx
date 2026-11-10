import { useEffect, useState } from 'react'
import { Button } from '@ui/components/primitives/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@ui/components/primitives/dialog'
import { Input } from '@ui/components/primitives/input'
import { Field } from '@ui/compositions/forms/Field'
import { provenance } from '@ui/provenance'

/**
 * A one-time link for a member to set their own password (self-hosted).
 *
 * From an invitation, or from "Reset password" on their row. The admin never
 * sees a password: they share the link, and the member chooses one there.
 * Setting it spends this link and every older one. Closing the dialog loses
 * the link, but nothing is lost with it: "Reset password" makes another.
 */
export const PasswordLinkDialogProvenance = provenance({
  source: 'composition',
  composes: ['ui/dialog', 'compositions/forms/Field', 'ui/input', 'ui/button'],
  note: 'Read-only link with a copy button; all actions outline.',
})

export interface PasswordLinkDialogProps {
  /** Whose link it is. `null` closes the dialog. */
  member: { name: string; email: string } | null
  /** The link, once made; `null` while it is being created. */
  link: { url: string; purpose: 'invite' | 'reset'; expiry: string | null } | null
  isPending?: boolean
  error?: string | null
  onClose: () => void
}

export function PasswordLinkDialog({
  member,
  link,
  isPending = false,
  error = null,
  onClose,
}: PasswordLinkDialogProps) {
  const [copied, setCopied] = useState(false)
  const url = link?.url ?? ''
  useEffect(() => setCopied(false), [url])
  if (!member) return null

  const invite = link?.purpose === 'invite'
  const recipient = member.email || member.name

  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {invite ? `Invitation link for ${member.name}` : `Password link for ${member.name}`}
          </DialogTitle>
          <DialogDescription>
            {invite
              ? `Send this to ${recipient}. They open it to set their password and sign in.`
              : `Send this to ${recipient}. They open it to choose a new password; their current one keeps working until they do.`}{' '}
            It works once{link?.expiry ? ` and expires ${link.expiry}` : ''}. Anyone with it can set
            the password, so send it privately.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          {link ? (
            <Field label={invite ? 'Invitation link' : 'Password link'}>
              {({ id, ...field }) => (
                <span className="flex gap-2">
                  <Input id={id} readOnly value={url} className="font-mono" {...field} />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      void navigator.clipboard?.writeText(url).then(() => setCopied(true))
                    }}
                  >
                    {copied ? 'Copied' : 'Copy'}
                  </Button>
                </span>
              )}
            </Field>
          ) : isPending ? (
            <p className="text-muted-foreground text-sm" role="status">
              Creating the link…
            </p>
          ) : null}
          {error ? (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
