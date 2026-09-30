import { type CreateEntitlement, type EditEntitlement } from '@fp/domain'
import { FormDialog } from '@ui/compositions/FormDialog'
import { provenance } from '@ui/provenance'
import { EntitlementCreateForm, EntitlementEditForm, type FeatureOption } from './EntitlementForm'

/**
 * Grant or edit an entitlement, in a centred dialog.
 *
 * "Add entitlement" opens it on a feature choice; a row's Edit opens it on that
 * entitlement's own fields. The page owns when it is open and what a submit does.
 */
export const EntitlementDialogProvenance = provenance({
  source: 'composition',
  composes: ['compositions/form-dialog'],
  note: 'The entitlement form in a dialog, create or edit.',
})

export interface EntitlementDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'create' | 'edit'
  /** Create: features not already entitled. */
  features?: FeatureOption[]
  onSubmit?: (entitlement: CreateEntitlement) => void
  /** Edit: the feature being edited and its current values. */
  editing?: { feature: FeatureOption; defaultValue: EditEntitlement }
  onEditSubmit?: (edit: EditEntitlement) => void
  isSubmitting?: boolean
  submitError?: string | null
}

export function EntitlementDialog(props: EntitlementDialogProps) {
  const { open, onOpenChange, isSubmitting = false, submitError = null } = props
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={props.mode === 'create' ? 'Add entitlement' : 'Edit entitlement'}
      description={
        props.mode === 'create'
          ? 'Grant a feature to everyone on this plan.'
          : 'Change what this entitlement grants.'
      }
    >
      {props.mode === 'edit' && props.editing ? (
        <EntitlementEditForm
          key={props.editing.feature.id}
          feature={props.editing.feature}
          defaultValue={props.editing.defaultValue}
          onSubmit={(edit) => props.onEditSubmit?.(edit)}
          onCancel={() => onOpenChange(false)}
          isSubmitting={isSubmitting}
          submitError={submitError}
        />
      ) : (
        <EntitlementCreateForm
          features={props.features ?? []}
          onSubmit={(entitlement) => props.onSubmit?.(entitlement)}
          onCancel={() => onOpenChange(false)}
          isSubmitting={isSubmitting}
          submitError={submitError}
        />
      )}
    </FormDialog>
  )
}
