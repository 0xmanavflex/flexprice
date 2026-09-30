import type { ReactNode } from 'react'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@ui/components/primitives/dialog'
import { Button } from '@ui/components/primitives/button'
import { provenance } from '@ui/provenance'

/**
 * A confirm step for an action that is hard to shrug off.
 *
 * Archiving a coupon or a group is reversible but consequential — it stops the
 * thing being offered — so it gets a beat rather than firing on a single click.
 * Presentational: the caller owns whether it is open and what confirming does,
 * and passes `isPending` so the button can show progress without the dialog
 * closing underneath a request that has not returned.
 *
 * Built on the `Dialog` primitive; the confirm button carries the destructive
 * colour when the action deletes or archives, so the weight reads before the
 * words do.
 */
export const ConfirmDialogProvenance = provenance({
  source: 'composition',
  composes: ['ui/dialog', 'ui/button'],
  note: 'A titled confirm/cancel dialog for destructive actions. Caller owns state and effect.',
})

export interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: ReactNode
  confirmLabel: string
  cancelLabel?: string
  onConfirm: () => void
  isPending?: boolean
  destructive?: boolean
  /** A failure from the action, shown inline so the dialog can stay open. */
  error?: string | null
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  onConfirm,
  isPending = false,
  destructive = false,
  error = null,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>

        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <DialogFooter>
          <DialogClose
            render={
              <Button variant="outline" disabled={isPending}>
                {cancelLabel}
              </Button>
            }
          />
          <Button
            variant={destructive ? 'destructive' : 'default'}
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? 'Working…' : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
