import { type CreateTaxRate, type EditTaxRate } from '@fp/domain'
import { FormDialog } from '@ui/compositions/FormDialog'
import { provenance } from '@ui/provenance'
import { TaxRateCreateForm, TaxRateEditForm } from './TaxRateForm'

/**
 * The tax rate editor, as a centred dialog. `create` collects the value and
 * scope; `edit` changes only what the API allows (name, code, description,
 * status). Presentational: the page owns open/close and the mutation.
 */
export const TaxRateEditorDialogProvenance = provenance({
  source: 'composition',
  composes: ['compositions/form-dialog'],
  note: 'Tax rate create and edit in a dialog, so the list stays visible behind it.',
})

interface TaxRateEditorDialogBase {
  open: boolean
  onOpenChange: (open: boolean) => void
  isSubmitting?: boolean
  submitError?: string | null
}

export interface TaxRateCreateDialogProps extends TaxRateEditorDialogBase {
  mode: 'create'
  defaultValue?: CreateTaxRate
  onSubmit: (taxRate: CreateTaxRate) => void
}

export interface TaxRateEditDialogProps extends TaxRateEditorDialogBase {
  mode: 'edit'
  defaultValue: EditTaxRate
  onSubmit: (taxRate: EditTaxRate) => void
}

export type TaxRateEditorDialogProps = TaxRateCreateDialogProps | TaxRateEditDialogProps

export function TaxRateEditorDialog(props: TaxRateEditorDialogProps) {
  const { open, onOpenChange, isSubmitting = false, submitError = null } = props

  if (props.mode === 'create') {
    return (
      <FormDialog
        open={open}
        onOpenChange={onOpenChange}
        title="New tax rate"
        description="A percentage added to invoices. Its value and scope are fixed once created."
        size="md"
      >
        <TaxRateCreateForm
          {...(props.defaultValue ? { defaultValue: props.defaultValue } : {})}
          onSubmit={props.onSubmit}
          onCancel={() => onOpenChange(false)}
          isSubmitting={isSubmitting}
          submitError={submitError}
        />
      </FormDialog>
    )
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Edit tax rate"
      description="Rename, recode or archive the rate. Its value and scope are fixed once created."
      size="md"
    >
      <TaxRateEditForm
        key={props.defaultValue.code}
        defaultValue={props.defaultValue}
        onSubmit={props.onSubmit}
        onCancel={() => onOpenChange(false)}
        isSubmitting={isSubmitting}
        submitError={submitError}
      />
    </FormDialog>
  )
}
