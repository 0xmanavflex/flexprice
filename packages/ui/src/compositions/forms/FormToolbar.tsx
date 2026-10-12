import type { ReactNode } from 'react'
import { ArrowLeftIcon, ArrowRightIcon, XIcon } from '@ui/icons'
import { Button } from '@ui/components/primitives/button'
import { Separator } from '@ui/components/primitives/separator'
import { provenance } from '@ui/provenance'

/**
 * The bar a create/edit page opens with: close (X) and the one primary
 * action, and, optionally, a stepper centred between them. Create leaves the
 * title out — the breadcrumb already names the page. Edit keeps its title.
 *
 * There is no Cancel button and no footer: the X is the way back. A staged
 * form swaps the primary for "Next →" until its last step, and shows
 * "Previous" from the second step on. Secondary actions that belong next to
 * the primary (an invoice's "Save draft") go in `actions`.
 *
 * The structure of the ReUI `form-3` toolbar (`blocks/form-3/components/
 * invoice-toolbar.tsx`), which is hard-wired to an invoice and cannot be edited
 * in place. The submit sits outside the `<form>`, so it targets it by `formId`.
 */
export const FormToolbarProvenance = provenance({
  source: 'composition',
  composes: ['ui/button', 'ui/separator'],
  note: 'form-3 toolbar structure: close, divider, title, optional Previous/Next and the primary CTA, pinned above the page. Lineage: blocks/form-3.',
})

export interface FormToolbarProps {
  title: string
  mode: 'create' | 'edit'
  /** Noun for the create label, e.g. "group" → "Create group". */
  noun?: string
  /** `id` of the `<form>` the CTA submits. */
  formId: string
  /** The way back, drawn as the close (X) button. Without it there is no close. */
  onCancel?: (() => void) | undefined
  isSubmitting?: boolean
  submitLabel?: string
  /** A multi-step form submits only from its last step; earlier steps show Next instead. */
  hideSubmit?: boolean
  /** Centred between the title and the actions, e.g. the stepper; wraps to its own row on narrow screens. */
  center?: ReactNode
  /** Step back in a staged form. Omit on the first step. */
  onPrevious?: (() => void) | undefined
  /** Step forward in a staged form. Omit on the last step. */
  onNext?: (() => void) | undefined
  /** Secondary actions drawn before the primary, e.g. "Save draft". */
  actions?: ReactNode
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
  center,
  onPrevious,
  onNext,
  actions,
}: FormToolbarProps) {
  const label =
    submitLabel ?? (mode === 'create' ? `Create${noun ? ` ${noun}` : ''}` : 'Save changes')
  return (
    <header className="border-border bg-background flex min-h-14 w-full shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b px-4 py-2 md:flex-nowrap md:py-0">
      <div className="flex min-w-0 flex-1 items-center">
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
        {mode === 'edit' ? (
          <h1 className="text-foreground truncate text-base leading-5 font-medium">{title}</h1>
        ) : null}
      </div>
      {center ? (
        <div className="order-last flex w-full min-w-0 justify-center md:order-none md:w-auto md:flex-none">
          {center}
        </div>
      ) : null}
      <div className="flex shrink-0 items-center justify-end gap-2 md:flex-1">
        {onPrevious ? (
          <Button type="button" variant="outline" onClick={onPrevious} disabled={isSubmitting}>
            <ArrowLeftIcon data-icon="inline-start" aria-hidden="true" />
            Previous
          </Button>
        ) : null}
        {actions}
        {onNext ? (
          <Button
            type="button"
            variant={hideSubmit ? 'default' : 'outline'}
            onClick={onNext}
            disabled={isSubmitting}
          >
            Next
            <ArrowRightIcon data-icon="inline-end" aria-hidden="true" />
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
