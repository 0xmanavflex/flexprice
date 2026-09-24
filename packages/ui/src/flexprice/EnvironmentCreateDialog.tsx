import { useId } from 'react'
import { Button } from '@ui/primitives/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
 * switcher in the corner of whatever you were already doing.
 *
 * Structured as ReUI builds a dialog: header, body, and a `DialogFooter` bar
 * carrying the actions. The footer is a real part of the component — tinted,
 * with a rule above it — rather than a right-aligned row improvised inside the
 * body, which is what it was and why it looked like a form someone had dropped
 * into a box. The submit button lives in that footer and reaches the form by
 * `form="…"`, so the structure survives the actions moving out of it.
 *
 * Width is the primitive's own `sm:max-w-sm`. The earlier `max-w-lg` gave two
 * short fields the width of a settings page.
 */
export const EnvironmentCreateDialogProvenance = provenance({
  source: 'composition',
  composes: ['ui/dialog', 'ui/button'],
  note: "ReUI's dialog structure — header, body, footer bar — around EnvironmentForm.",
})

export interface EnvironmentCreateDialogProps extends Omit<EnvironmentFormProps, 'id'> {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EnvironmentCreateDialog({
  open,
  onOpenChange,
  ...form
}: EnvironmentCreateDialogProps) {
  const formId = useId()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New environment</DialogTitle>
          <DialogDescription>Data does not cross between environments.</DialogDescription>
        </DialogHeader>

        <EnvironmentForm id={formId} {...form} />

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={form.isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" form={formId} disabled={form.isSubmitting}>
            {form.isSubmitting ? 'Creating…' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
