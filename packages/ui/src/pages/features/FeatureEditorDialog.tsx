import type { CreateFeature, EditFeature, Feature } from '@fp/domain'
import { FormDialog } from '@ui/compositions/FormDialog'
import type { Option } from '@ui/compositions/OptionSelect'
import { provenance } from '@ui/provenance'
import { FeatureForm } from './FeatureForm'

/**
 * The feature editor, as a centred dialog.
 *
 * Replaces the full-page create form. A feature has a meter, units, filters and
 * alerts, so it is the large size; the list stays visible behind it. In `edit`
 * mode the type, lookup key and meter are shown read-only — the backend treats
 * them as immutable — and only filters remain editable on the meter.
 *
 * Presentational: the page decides when it is open, the mode, and what a submit
 * does.
 */
export const FeatureEditorDialogProvenance = provenance({
  source: 'composition',
  composes: ['compositions/form-dialog'],
  note: 'The feature form in a large dialog, so the list stays visible behind it.',
})

type FeatureEditorDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  isSubmitting?: boolean
  submitError?: string | null
  groups?: readonly Option[]
} & (
  | { mode: 'create'; onSubmit: (feature: CreateFeature) => void; feature?: undefined }
  | { mode: 'edit'; feature: Feature; onSubmit: (feature: EditFeature) => void }
)

export type { FeatureEditorDialogProps }

export function FeatureEditorDialog(props: FeatureEditorDialogProps) {
  const { open, onOpenChange, isSubmitting = false, submitError = null, groups } = props
  const shared = {
    onCancel: () => onOpenChange(false),
    isSubmitting,
    submitError,
    ...(groups ? { groups } : {}),
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={props.mode === 'create' ? 'New feature' : 'Edit feature'}
      description={
        props.mode === 'create'
          ? 'Define what you meter or gate. Plans price it and entitlements limit it afterwards.'
          : 'Update the feature’s details. Its type, lookup key and meter are fixed.'
      }
    >
      {props.mode === 'create' ? (
        <FeatureForm key="create" mode="create" onSubmit={props.onSubmit} {...shared} />
      ) : (
        <FeatureForm
          key={`edit:${props.feature.id}`}
          mode="edit"
          feature={props.feature}
          onSubmit={props.onSubmit}
          {...shared}
        />
      )}
    </FormDialog>
  )
}
