import { useCallback, useState, type ReactNode } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@ui/components/primitives/dialog'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'
import { FormDialogBodyContext } from './formDialogContext'

/**
 * The one container every create and nested-edit form opens in (reference
 * `FormDialog`): a header with a rule under it, then a scrolling body.
 *
 * `md` is 672px and `lg` 896px; `sm` is kept for a name and a code. The body
 * pads itself (`p-6`); a `Composer` inside knows it is in a dialog and does not
 * pad again. The form's footer (a `Composer`'s, or `FormActions`) sits at the
 * end of the body.
 *
 * The caller owns `open`. Remount the form with a `key` per record so
 * react-hook-form's defaults reset. Reopening remounts the body, so a form
 * never reopens holding the half-typed values of the last time it was dismissed.
 *
 * Pass `isPending` while a submit is in flight: Escape, the overlay and the
 * close control are then ignored so the dialog cannot close under the request.
 * Pass `dismissible={false}` when the body's own button is the only way out (a
 * one-time secret): the close control is hidden and Escape/overlay are ignored.
 */
export const FormDialogProvenance = provenance({
  source: 'composition',
  composes: ['ui/dialog'],
  note: 'The single create/edit container: sized Dialog with ruled header and scrolling body.',
})

const SIZES = {
  sm: 'sm:max-w-md',
  md: 'sm:max-w-2xl',
  lg: 'sm:max-w-4xl',
} as const

export interface FormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  /** A line under the title: what the dialog is for, or the one fact it is about. */
  description?: ReactNode
  size?: keyof typeof SIZES
  /** A submit is in flight: the dialog cannot be dismissed until it settles. */
  isPending?: boolean | undefined
  /** False hides the close control and ignores Escape/overlay; the body must offer its own exit. */
  dismissible?: boolean | undefined
  children: ReactNode
}

export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  size = 'md',
  isPending = false,
  dismissible = true,
  children,
}: FormDialogProps) {
  // Bumped on each close-to-open transition so the body (and any uncontrolled or
  // react-hook-form state in it) remounts fresh. Done during render, not in an
  // effect, so the old values are never painted and the exit animation of the
  // closing dialog is not disturbed.
  const [session, setSession] = useState(0)
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setSession((n) => n + 1)
  }

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next && (isPending || !dismissible)) return
      onOpenChange(next)
    },
    [isPending, dismissible, onOpenChange],
  )

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={!isPending && dismissible}
        className={cn('flex max-h-[88vh] flex-col gap-0 overflow-hidden p-0', SIZES[size])}
      >
        <DialogHeader className="border-b px-6 py-5">
          <DialogTitle className="text-base font-medium">{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          <FormDialogBodyContext.Provider key={session} value>
            {children}
          </FormDialogBodyContext.Provider>
        </div>
      </DialogContent>
    </Dialog>
  )
}
