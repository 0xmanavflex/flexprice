import { type CreatePriceUnit } from '@fp/domain'
import { FormDialog } from '@ui/compositions/FormDialog'
import { provenance } from '@ui/provenance'
import { PriceUnitForm } from './PriceUnitForm'

/**
 * The price-unit editor, as a centred dialog.
 *
 * A dialog rather than a page or a modal — V1's own choice, and there is no
 * detail page to navigate to — so creating or editing one keeps the list
 * visible behind it. Presentational: it owns nothing but the form's field
 * values. The page decides when it is open, which mode it is in, and what a
 * submit does.
 */
export const PriceUnitEditorDialogProvenance = provenance({
  source: 'composition',
  composes: ['compositions/form-dialog'],
  note: 'The price-unit details form in a dialog, so the list stays visible behind it.',
})

export interface PriceUnitEditorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'create' | 'edit'
  defaultValue?: CreatePriceUnit
  onSubmit: (priceUnit: CreatePriceUnit) => void
  isSubmitting?: boolean
  submitError?: string | null
}

export function PriceUnitEditorDialog({
  open,
  onOpenChange,
  mode,
  defaultValue,
  onSubmit,
  isSubmitting = false,
  submitError = null,
}: PriceUnitEditorDialogProps) {
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={mode === 'create' ? 'New price unit' : 'Edit price unit'}
      description={
        mode === 'create'
          ? 'Define a unit to charge in — its code, symbol, and the rate it converts to a currency at.'
          : 'Update the price unit’s name. Its code, symbol, currency and rate are fixed once created.'
      }
    >
      <PriceUnitForm
        key={`${mode}:${defaultValue?.code ?? 'new'}`}
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
