import { type CreateGroup } from '@fp/domain'
import { FormDialog } from '@ui/compositions/FormDialog'
import { provenance } from '@ui/provenance'
import { GroupForm } from './GroupForm'

/**
 * Create a group, in a centred dialog. Create only — groups cannot be edited.
 * Presentational: the page owns open/close and the mutation.
 */
export const GroupEditorDialogProvenance = provenance({
  source: 'composition',
  composes: ['compositions/form-dialog'],
  note: 'The group create form in a dialog, so the list stays visible behind it.',
})

export interface GroupEditorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultValue?: CreateGroup
  onSubmit: (group: CreateGroup) => void
  isSubmitting?: boolean
  submitError?: string | null
}

export function GroupEditorDialog({
  open,
  onOpenChange,
  defaultValue,
  onSubmit,
  isSubmitting = false,
  submitError = null,
}: GroupEditorDialogProps) {
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="New group"
      description="Bundle prices or features so they can be filtered, reported and invoiced together."
    >
      <GroupForm
        {...(defaultValue ? { defaultValue } : {})}
        onSubmit={onSubmit}
        onCancel={() => onOpenChange(false)}
        isSubmitting={isSubmitting}
        submitError={submitError}
      />
    </FormDialog>
  )
}
