import { type CreateCostSheet } from '@fp/domain'
import { FormDialog } from '@ui/compositions/FormDialog'
import { provenance } from '@ui/provenance'
import { CostSheetForm } from './CostSheetForm'

/**
 * The cost sheet editor, as a centred dialog, so the list stays visible behind
 * it. Presentational: the page decides when it is open, its mode, and what a
 * submit does.
 */
export const CostSheetEditorDialogProvenance = provenance({
  source: 'composition',
  composes: ['compositions/form-dialog'],
  note: 'The cost sheet details form in a dialog, so the list stays visible behind it.',
})

export interface CostSheetEditorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'create' | 'edit'
  defaultValue?: CreateCostSheet
  onSubmit: (costSheet: CreateCostSheet) => void
  isSubmitting?: boolean
  submitError?: string | null
}

export function CostSheetEditorDialog({
  open,
  onOpenChange,
  mode,
  defaultValue,
  onSubmit,
  isSubmitting = false,
  submitError = null,
}: CostSheetEditorDialogProps) {
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={mode === 'create' ? 'New cost sheet' : 'Edit cost sheet'}
      description={
        mode === 'create'
          ? 'Record what each unit of usage costs you, so margin can be measured.'
          : 'Update the cost sheet’s details.'
      }
    >
      <CostSheetForm
        key={`${mode}:${defaultValue?.name ?? 'new'}`}
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
