import type { ReactNode } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@ui/primitives/dialog'
import { cn } from 'cn'
import { provenance } from '@ui/provenance'

/**
 * The one container every create and nested-edit form opens in.
 *
 * A centred stock `Dialog`: title and description on top, a scrolling body,
 * and the form's own `FormActions` footer. Sizes are the only knob — `sm` for
 * a name and a code, `md` for a typical entity, `lg` for the heavy ones (a
 * charge with its tier table). Simple edits never open this at all; they happen
 * in the table cell.
 *
 * The caller owns `open`. Remount the form with a `key` per record so
 * react-hook-form's defaults reset.
 */
export const FormDialogProvenance = provenance({
  source: 'composition',
  composes: ['ui/dialog'],
  note: 'The single create/edit container: sized Dialog with header and scrolling body.',
})

const SIZES = {
  sm: 'sm:max-w-md',
  md: 'sm:max-w-xl',
  lg: 'sm:max-w-3xl',
} as const

export interface FormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  size?: keyof typeof SIZES
  children: ReactNode
}

export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  size = 'md',
  children,
}: FormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn('max-h-[90vh] grid-rows-[auto_minmax(0,1fr)] gap-4 p-0', SIZES[size])}
      >
        <DialogHeader className="border-b p-4 pr-12">
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <div className="min-h-0 overflow-y-auto px-4 pb-4">{children}</div>
      </DialogContent>
    </Dialog>
  )
}
