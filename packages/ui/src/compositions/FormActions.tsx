import { Button } from '@ui/primitives/button'
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
  note: 'Uniform form footer: submit-error alert, outline Cancel, primary submit.',
})

export interface FormActionsProps {
  mode: 'create' | 'edit'
  /** Noun for the create label, e.g. "plan" → "Create plan". */
  noun?: string
  onCancel?: (() => void) | undefined
  isSubmitting?: boolean
  submitError?: string | null | undefined
  submitLabel?: string
}

export function FormActions({
  mode,
  noun,
  onCancel,
  isSubmitting = false,
  submitError = null,
  submitLabel,
}: FormActionsProps) {
  const label =
    submitLabel ?? (mode === 'create' ? `Create${noun ? ` ${noun}` : ''}` : 'Save changes')
  return (
    <div className="flex flex-col gap-3 pt-2">
      {submitError ? (
        <Alert variant="destructive">
          <AlertDescription>{submitError}</AlertDescription>
        </Alert>
      ) : null}
      <div className="flex justify-end gap-2">
        {onCancel ? (
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
        ) : null}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : label}
        </Button>
      </div>
    </div>
  )
}
