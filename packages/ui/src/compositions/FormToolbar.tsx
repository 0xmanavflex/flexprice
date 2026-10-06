import { XIcon } from 'lucide-react'
import { Button } from '@ui/components/primitives/button'
import { Separator } from '@ui/components/primitives/separator'
import { provenance } from '@ui/provenance'

/**
 * The bar a create/edit page opens with: close, the title, Cancel and the one
 * primary action.
 *
 * The structure of the ReUI `form-3` toolbar (`blocks/form-3/components/
 * invoice-toolbar.tsx`), which is hard-wired to an invoice and cannot be edited
 * in place. The submit sits outside the `<form>`, so it targets it by `formId`.
 */
export const FormToolbarProvenance = provenance({
  source: 'composition',
  composes: ['ui/button', 'ui/separator'],
  note: 'form-3 toolbar structure: close, divider, title, Cancel and the primary CTA, pinned above the page. Lineage: blocks/form-3.',
})

export interface FormToolbarProps {
  title: string
  mode: 'create' | 'edit'
  /** Noun for the create label, e.g. "group" → "Create group". */
  noun?: string
  /** `id` of the `<form>` the CTA submits. */
  formId: string
  /** Without it there is no way back, so neither close nor Cancel is drawn. */
  onCancel?: (() => void) | undefined
  isSubmitting?: boolean
  submitLabel?: string
  /** A multi-step form submits only from its last step; earlier steps advance from the step nav instead. */
  hideSubmit?: boolean
}

export function FormToolbar({
  title,
  mode,
  noun,
  formId,
  onCancel,
  isSubmitting = false,
  submitLabel,
  hideSubmit = false,
}: FormToolbarProps) {
  const label =
    submitLabel ?? (mode === 'create' ? `Create${noun ? ` ${noun}` : ''}` : 'Save changes')
  return (
    <header className="border-border bg-background flex min-h-14 w-full shrink-0 items-center justify-between gap-3 border-b px-4">
      <div className="flex min-w-0 items-center">
        {onCancel ? (
          <>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="-ms-2 size-8 shrink-0"
              aria-label="Close form"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              <XIcon aria-hidden="true" />
            </Button>
            <Separator orientation="vertical" className="my-auto mr-4 ml-2 h-4 shrink-0" />
          </>
        ) : null}
        <h1 className="text-foreground truncate text-base leading-5 font-medium">{title}</h1>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {onCancel ? (
          <Button
            type="button"
            variant="ghost"
            className="hidden sm:inline-flex"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
        ) : null}
        {hideSubmit ? null : (
          <Button type="submit" form={formId} disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : label}
          </Button>
        )}
      </div>
    </header>
  )
}
