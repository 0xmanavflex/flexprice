import { CircleAlertIcon } from '@ui/icons'
import type { ReactNode } from 'react'
import { Button } from '@ui/components/primitives/button'
import { Alert, AlertDescription } from '@ui/components/reui/alert'
import { provenance } from '@ui/provenance'

/**
 * The footer every form ends with: a server error, Cancel, and the submit.
 *
 * Labels are decided here so the platform says "Create"/"Save changes" the same
 * way everywhere. Render it as the last child of the `<form>`.
 */
export const FormActionsProvenance = provenance({
  source: 'composition',
  composes: ['ui/button', '@reui/alert'],
  note: 'Uniform form footer: submit-error alert, ghost Cancel, primary submit (the reference Composer footer).',
})

export interface FormActionsProps {
  mode: 'create' | 'edit'
  /** Noun for the create label, e.g. "plan" → "Create plan". */
  noun?: string
  onCancel?: (() => void) | undefined
  isSubmitting?: boolean
  submitError?: string | null | undefined
  submitLabel?: string
  /** `id` of the `<form>` to submit, when the footer sits outside it (a page's sticky bar). */
  formId?: string
  /** Rendered between Cancel and the submit, e.g. a stepper's Previous/Next. */
  between?: ReactNode
  hideSubmit?: boolean
}

export function FormActions({
  mode,
  noun,
  onCancel,
  isSubmitting = false,
  submitError = null,
  submitLabel,
  formId,
  between,
  hideSubmit = false,
}: FormActionsProps) {
  const label =
    submitLabel ?? (mode === 'create' ? `Create${noun ? ` ${noun}` : ''}` : 'Save changes')
  return (
    <div className="flex flex-col gap-3 pt-2">
      {submitError ? (
        <Alert variant="destructive">
          <CircleAlertIcon aria-hidden="true" />
          <AlertDescription>{submitError}</AlertDescription>
        </Alert>
      ) : null}
      <div className="flex justify-end gap-2">
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
        ) : null}
        {between}
        {hideSubmit ? null : (
          <Button type="submit" disabled={isSubmitting} {...(formId ? { form: formId } : {})}>
            {isSubmitting ? 'Saving…' : label}
          </Button>
        )}
      </div>
    </div>
  )
}
