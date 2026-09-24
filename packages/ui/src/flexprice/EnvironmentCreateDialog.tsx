import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@ui/primitives/dialog'
import { provenance } from '@ui/provenance'
import { EnvironmentForm, type EnvironmentFormProps } from './EnvironmentForm'

/**
 * Creating an environment, as a dialog.
 *
 * A dialog rather than a page, which is the opposite of the rule for plans and
 * subscriptions — and for the same reason that rule exists. Complex workflows
 * are pages because they have sequence and more than one conceptual domain;
 * this has two fields and no sequence, and it is always started from the
 * switcher in the corner of whatever you were already doing. Sending someone
 * to a page here would lose the page they were on to ask them for a name.
 *
 * It owns nothing but its own visibility. The form emits a validated value and
 * the caller decides what that means, so every state below — submitting, a
 * rejected name, production withheld — is reachable as a story with no network
 * anywhere near it.
 */
export const EnvironmentCreateDialogProvenance = provenance({
  source: 'composition',
  composes: ['ui/dialog'],
  note: 'EnvironmentForm in a dialog. Two fields and no sequence is not a page.',
})

export interface EnvironmentCreateDialogProps
  extends Omit<EnvironmentFormProps, 'onCancel'> {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EnvironmentCreateDialog({
  open,
  onOpenChange,
  ...form
}: EnvironmentCreateDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New environment</DialogTitle>
          <DialogDescription>
            A separate set of customers, plans and invoices. Nothing crosses between
            environments.
          </DialogDescription>
        </DialogHeader>

        <EnvironmentForm {...form} onCancel={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}
