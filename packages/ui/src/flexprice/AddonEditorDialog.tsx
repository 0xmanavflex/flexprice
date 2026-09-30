import { type CreateAddon } from '@fp/domain'
import { FormDialog } from '@ui/compositions/FormDialog'
import { provenance } from '@ui/provenance'
import { AddonForm } from './AddonForm'

/**
 * The add-on editor, as a centred dialog.
 *
 * A dialog rather than a page or a modal: it keeps the list visible behind it —
 * V1's own choice for add-on details — so creating one in context does not lose
 * the place. A modal would be wrong for a record with several fields; a page
 * would throw the list away.
 *
 * Presentational: it owns nothing but the form's field values. The page decides
 * when it is open, which mode it is in, and what a submit does.
 */
export const AddonEditorDialogProvenance = provenance({
  source: 'composition',
  composes: ['compositions/form-dialog'],
  note: 'The add-on details form in a dialog, so the list stays visible behind it.',
})

export interface AddonEditorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'create' | 'edit'
  defaultValue?: CreateAddon
  onSubmit: (addon: CreateAddon) => void
  isSubmitting?: boolean
  submitError?: string | null
}

export function AddonEditorDialog({
  open,
  onOpenChange,
  mode,
  defaultValue,
  onSubmit,
  isSubmitting = false,
  submitError = null,
}: AddonEditorDialogProps) {
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={mode === 'create' ? 'New add-on' : 'Edit add-on'}
      description={
        mode === 'create'
          ? 'Create the add-on. Charges and entitlements are added afterwards.'
          : 'Update the add-on’s details. Its charges are edited separately.'
      }
    >
      <AddonForm
        key={`${mode}:${defaultValue?.lookupKey ?? 'new'}`}
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
