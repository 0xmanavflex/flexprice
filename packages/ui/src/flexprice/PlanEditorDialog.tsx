import { type CreatePlan } from '@fp/domain'
import { FormDialog } from '@ui/compositions/FormDialog'
import { provenance } from '@ui/provenance'
import { PlanForm } from './PlanForm'

/**
 * The plan editor, as a centred dialog.
 *
 * The same dialog shape as `AddonEditorDialog` — the list stays visible behind
 * it, V1's own choice for plan details — carrying the plan form instead. The
 * page owns when it is open and what a submit does.
 */
export const PlanEditorDialogProvenance = provenance({
  source: 'composition',
  composes: ['compositions/form-dialog'],
  note: 'The plan details form in a dialog, so the list stays visible behind it.',
})

export interface PlanEditorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'create' | 'edit'
  defaultValue?: CreatePlan
  onSubmit: (plan: CreatePlan) => void
  isSubmitting?: boolean
  submitError?: string | null
}

export function PlanEditorDialog({
  open,
  onOpenChange,
  mode,
  defaultValue,
  onSubmit,
  isSubmitting = false,
  submitError = null,
}: PlanEditorDialogProps) {
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={mode === 'create' ? 'New plan' : 'Edit plan'}
      description={
        mode === 'create'
          ? 'Create the plan. Charges and entitlements are added afterwards.'
          : 'Update the plan’s details. Its charges are edited separately.'
      }
    >
      <PlanForm
        key={
          mode === 'edit'
            ? `edit:${defaultValue?.name ?? ''}:${defaultValue?.lookupKey ?? ''}`
            : 'create'
        }
        mode={mode}
        {...(defaultValue ? { defaultValue } : {})}
        onSubmit={onSubmit}
        onCancel={() => onOpenChange(false)}
        isSubmitting={isSubmitting}
        submitError={submitError}
      />
    </FormDialog>
  )
}
