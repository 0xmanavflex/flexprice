import { type CreateCharge } from '@fp/domain'
import { FormDialog } from '@ui/compositions/FormDialog'
import { provenance } from '@ui/provenance'
import { ChargeForm, type MeterOption, type PriceUnitOption } from './ChargeForm'

/**
 * The charge editor, as a large centred dialog.
 *
 * Launched from the plan's Charges tab: "Add charge" opens it empty, a row's
 * Edit opens it prefilled. The page owns when it is open and what a submit does.
 */
export const ChargeEditorDialogProvenance = provenance({
  source: 'composition',
  composes: ['compositions/form-dialog'],
  note: 'The charge form in a large dialog, so the plan stays visible behind it.',
})

export interface ChargeEditorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'create' | 'edit'
  defaultValue?: CreateCharge
  meters?: MeterOption[]
  priceUnits?: PriceUnitOption[]
  currencies?: string[]
  onSubmit: (charge: CreateCharge) => void
  isSubmitting?: boolean
  submitError?: string | null
}

export function ChargeEditorDialog({
  open,
  onOpenChange,
  mode,
  defaultValue,
  meters,
  priceUnits,
  currencies,
  onSubmit,
  isSubmitting = false,
  submitError = null,
}: ChargeEditorDialogProps) {
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={mode === 'create' ? 'Add charge' : 'Edit charge'}
      description={
        mode === 'create'
          ? 'A fixed fee, or usage billed against a metered feature.'
          : 'Update the price. Everything else about a charge is fixed once created.'
      }
    >
      <ChargeForm
        key={mode === 'edit' ? `edit:${defaultValue?.displayName ?? ''}` : 'create'}
        mode={mode}
        {...(defaultValue ? { defaultValue } : {})}
        {...(meters ? { meters } : {})}
        {...(priceUnits ? { priceUnits } : {})}
        {...(currencies ? { currencies } : {})}
        onSubmit={onSubmit}
        onCancel={() => onOpenChange(false)}
        isSubmitting={isSubmitting}
        submitError={submitError}
      />
    </FormDialog>
  )
}
