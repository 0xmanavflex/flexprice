import { useState } from 'react'
import { GaugeIcon, RepeatIcon } from '@ui/icons'
import {
  BillingModel,
  type Charge,
  type CreateCharge,
  PriceType,
  chargeToDraft,
  emptyCharge,
} from '@fp/domain'
import { Button } from '@ui/components/primitives/button'
import { FormDialog } from '../../../compositions/forms/FormDialog'
import { ChoiceCards } from '../../../compositions/detail/DetailKit'
import { ChargeForm, type MeterOption, type PriceUnitOption } from '../charges/ChargeForm'

export interface AddChargeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** A charge being edited; skips the type step. */
  editing?: Charge | null
  meters: MeterOption[]
  priceUnits: PriceUnitOption[]
  /** The account's price groups a new charge may join. */
  priceGroups?: readonly { value: string; label: string }[]
  onSubmit: (draft: CreateCharge) => void
  isSubmitting: boolean
  submitError: string | null
  /** Adds "Create feature" to the metered-feature picker; the page navigates. */
  onCreateFeature?: (() => void) | undefined
}

/**
 * "Add charge": first asks Fixed or Usage, then shows the existing charge form
 * for that type. Editing goes straight to the form.
 */
export function AddChargeDialog({
  open,
  onOpenChange,
  editing = null,
  meters,
  priceUnits,
  priceGroups = [],
  onSubmit,
  isSubmitting,
  submitError,
  onCreateFeature,
}: AddChargeDialogProps) {
  const [type, setType] = useState<PriceType>(PriceType.Fixed)
  const [chosen, setChosen] = useState(false)

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setChosen(false)
      setType(PriceType.Fixed)
    }
    onOpenChange(next)
  }

  const showForm = editing !== null || chosen

  return (
    <FormDialog
      open={open}
      onOpenChange={handleOpenChange}
      size="lg"
      title={editing ? 'Edit charge' : 'Add charge'}
    >
      {showForm ? (
        <ChargeForm
          key={editing ? `edit:${editing.id}` : `create:${type}`}
          mode={editing ? 'edit' : 'create'}
          defaultValue={editing ? chargeToDraft(editing) : emptyCharge(type, BillingModel.FlatFee)}
          lockType
          meters={meters}
          priceUnits={priceUnits}
          priceOptions={{ groups: priceGroups }}
          onCreateFeature={onCreateFeature}
          onSubmit={onSubmit}
          onCancel={() => handleOpenChange(false)}
          isSubmitting={isSubmitting}
          submitError={submitError}
        />
      ) : (
        <div className="flex flex-col gap-5">
          <ChoiceCards
            label="Charge type"
            value={type}
            onChange={setType}
            choices={[
              {
                value: PriceType.Fixed,
                title: 'Fixed',
                description: 'A flat fee billed at the start of each period.',
                icon: <RepeatIcon aria-hidden className="text-muted-foreground size-4" />,
              },
              {
                value: PriceType.Usage,
                title: 'Usage',
                description: 'Billed at the end of the period for what was used.',
                icon: <GaugeIcon aria-hidden className="text-muted-foreground size-4" />,
              },
            ]}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => setChosen(true)}>
              Continue
            </Button>
          </div>
        </div>
      )}
    </FormDialog>
  )
}
