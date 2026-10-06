import type { ReactNode } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@ui/components/primitives/dialog'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'
import { DescriptionTip } from './DescriptionTip'
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
 * react-hook-form's defaults reset.
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
        className={cn('flex max-h-[88vh] flex-col gap-0 overflow-hidden p-0', SIZES[size])}
      >
        <DialogHeader className="border-b px-6 py-5">
          <div className="flex items-center gap-2">
            <DialogTitle className="text-base font-medium">{title}</DialogTitle>
            {description ? <DescriptionTip>{description}</DescriptionTip> : null}
          </div>
          {description ? (
            <DialogDescription className="sr-only">{description}</DialogDescription>
          ) : null}
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          <FormDialogBodyContext.Provider value>{children}</FormDialogBodyContext.Provider>
        </div>
      </DialogContent>
    </Dialog>
  )
}
