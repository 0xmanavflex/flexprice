import { useCallback, useEffect, useRef, type ReactNode } from 'react'
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
import { Spinner } from '@ui/components/primitives/spinner'
import { provenance } from '@ui/provenance'

/**
 * A confirm step for an action that is hard to shrug off.
 *
 * Archiving a coupon or a group is reversible but consequential: it stops the
 * thing being offered: so it gets a beat rather than firing on a single click.
 * Presentational: the caller owns whether it is open and what confirming does,
 * and passes `isPending` so the button can show progress without the dialog
 * closing underneath a request that has not returned.
 *
 * While `isPending` the dialog cannot be dismissed (Escape, overlay, Cancel and
 * the close control are all ignored) and the confirm button shows a spinner, so
 * a request in flight is never orphaned. A ref guard stops a double click from
 * firing `onConfirm` twice before the pending prop has rendered.
 *
 * Built on the `Dialog` primitive; the confirm button carries the destructive
 * colour when the action deletes or archives, so the weight reads before the
 * words do.
 */
export const ConfirmDialogProvenance = provenance({
  source: 'composition',
  composes: ['ui/dialog', 'ui/button', 'ui/spinner'],
  note: 'A titled confirm/cancel dialog for destructive actions. Caller owns state and effect.',
})

export interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: ReactNode
  /** Content under the description: a link field, a short list. Not inside the description text. */
  children?: ReactNode
  confirmLabel: string
  /** `null` drops the Cancel button, for a dialog whose one action is to finish. */
  cancelLabel?: string | null
  onConfirm: () => void
  /** Request in flight: dismissal is blocked and the confirm button shows progress. */
  isPending?: boolean
  /** Confirm button text while pending. Defaults to "Working…". */
  pendingLabel?: string
  destructive?: boolean
  /** A failure from the action, shown inline so the dialog can stay open. */
  error?: string | null
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  confirmLabel,
  cancelLabel = 'Cancel',
  onConfirm,
  isPending = false,
  pendingLabel = 'Working…',
  destructive = false,
  error = null,
}: ConfirmDialogProps) {
  const submitting = useRef(false)

  const release = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(release.current), [])
  // The caller reporting the request has settled (pending off, or a failure
  // shown) also releases the guard.
  useEffect(() => {
    if (!isPending) submitting.current = false
  }, [isPending, error, open])

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next && isPending) return
      onOpenChange(next)
    },
    [isPending, onOpenChange],
  )

  const handleConfirm = () => {
    if (isPending || submitting.current) return
    submitting.current = true
    // Fallback for callers that never set `isPending`: allow another attempt.
    clearTimeout(release.current)
    release.current = setTimeout(() => {
      submitting.current = false
    }, 600)
    onConfirm()
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent showCloseButton={!isPending}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>

        {children}

        {error ? (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        ) : null}

        <DialogFooter>
          {cancelLabel === null ? null : (
            <DialogClose
              render={
                <Button variant="outline" disabled={isPending}>
                  {cancelLabel}
                </Button>
              }
            />
          )}
          <Button
            variant={destructive ? 'destructive' : 'default'}
            onClick={handleConfirm}
            disabled={isPending}
            aria-busy={isPending || undefined}
          >
            {isPending ? (
              <Spinner aria-hidden className="size-3.5 motion-reduce:animate-none" />
            ) : null}
            {isPending ? pendingLabel : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
