import { type CreateCustomer } from '@fp/domain'
import { FormDialog } from '@ui/compositions/FormDialog'
import { provenance } from '@ui/provenance'
import { CustomerForm } from './CustomerForm'

/**
 * The customer editor, as a centred dialog, so the list stays visible behind
 * it. Presentational: the page owns open/close, the mode and the mutation.
 */
export const CustomerEditorDialogProvenance = provenance({
  source: 'composition',
  composes: ['compositions/form-dialog'],
  note: 'The customer details form in a dialog, so the list stays visible behind it.',
})

export interface CustomerEditorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'create' | 'edit'
  defaultValue?: CreateCustomer
  onSubmit: (customer: CreateCustomer) => void
  isSubmitting?: boolean
  submitError?: string | null
}

export function CustomerEditorDialog({
  open,
  onOpenChange,
  mode,
  defaultValue,
  onSubmit,
  isSubmitting = false,
  submitError = null,
}: CustomerEditorDialogProps) {
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={mode === 'create' ? 'New customer' : 'Edit customer'}
      description={
        mode === 'create'
          ? 'Add someone you bill. Subscriptions and invoices are attached afterwards.'
          : 'Update the customer’s details. Blank fields keep their saved value.'
      }
      size="lg"
    >
      <CustomerForm
        key={`${mode}:${defaultValue?.externalId ?? 'new'}`}
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
