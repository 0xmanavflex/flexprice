import { useState } from 'react'
import {
  BillingModel,
  type BillingPeriod,
  type AddContractCharge,
  NO_USAGE_TERMS,
  PRORATION,
  PRORATION_LABEL,
  PriceType,
  type Proration,
  type UsageTerms,
  emptyCharge,
  hasTermsErrors,
  validateContractTerms,
} from '@fp/domain'
import { Input } from '@ui/components/primitives/input'
import { DateInput } from '@ui/compositions/forms/DateInput'
import { Field } from '@ui/compositions/forms/Field'
import { OptionSelect } from '@ui/compositions/forms/OptionSelect'
import { provenance } from '@ui/provenance'
import {
  ChargeForm,
  type MeterOption,
  type PriceUnitOption,
} from '../product-catalog/charges/ChargeForm'
import { UsageTermsFields } from './UsageTermsFields'

export const ContractAddChargeFormProvenance = provenance({
  source: 'composition',
  composes: [
    'pages/ChargeForm',
    'compositions/field',
    'compositions/date-input',
    'compositions/option-select',
    'ui/input',
  ],
  note: 'The plan charge form (every pricing model, cadence and trial) plus what only a contract has: quantity, start date and proration for a fixed charge; bucket size and commitment for a metered one.',
})

export interface ContractAddChargeFormProps {
  type: PriceType
  /** The contract's currency; the charge bills in it. */
  currency: string
  /** The contract's billing period, which the new charge starts on. */
  billingPeriod: BillingPeriod
  meters: MeterOption[]
  priceUnits: PriceUnitOption[]
  onSubmit: (draft: AddContractCharge) => void
  isSubmitting?: boolean
  submitError?: string | null
  /** A charge already drafted (not yet saved) to reopen and change. */
  initial?: AddContractCharge | undefined
  /**
   * The contract's start, as an ISO instant, when it is still in the future.
   * The API refuses a charge that starts before its contract, so earlier
   * (UTC) days cannot be picked, and an empty start, or the contract's own
   * day, sends that exact instant rather than midnight, which could fall
   * before a contract that starts later that day.
   */
  earliestStart?: string | undefined
}

/** A new charge on one contract, as one granular form. */
export function ContractAddChargeForm({
  type,
  currency,
  billingPeriod,
  meters,
  priceUnits,
  onSubmit,
  isSubmitting = false,
  submitError = null,
  initial,
  earliestStart,
}: ContractAddChargeFormProps) {
  const isUsage = type === PriceType.Usage
  const earliestDay = earliestStart?.slice(0, 10)
  const [quantity, setQuantity] = useState(initial?.quantity ?? '1')
  const [startDate, setStartDate] = useState(initial?.startDate ?? '')
  const [proration, setProration] = useState<Proration>(initial?.proration ?? PRORATION.Prorate)
  const [terms, setTerms] = useState<UsageTerms>(initial?.terms ?? NO_USAGE_TERMS)
  const [showErrors, setShowErrors] = useState(false)

  const errors = validateContractTerms(isUsage ? { terms } : { quantity })

  const defaultValue = initial?.charge ?? {
    ...emptyCharge(type, BillingModel.FlatFee),
    currency: currency.toUpperCase() || 'USD',
    billingPeriod,
  }

  return (
    <ChargeForm
      mode="create"
      lockType
      lockCurrency
      // The window is collected below in `UsageTermsFields`, beside the
      // commitment it interacts with, so the price form must not draw a second.
      showUsageWindow={false}
      defaultValue={defaultValue}
      meters={meters}
      priceUnits={priceUnits}
      isSubmitting={isSubmitting}
      submitError={submitError}
      submitLabel={initial ? 'Save charge' : 'Add charge'}
      onSubmit={(charge) => {
        if (hasTermsErrors(errors)) {
          setShowErrors(true)
          return
        }
        onSubmit({
          charge,
          quantity,
          startDate:
            earliestStart && (!startDate || startDate === earliestDay) ? earliestStart : startDate,
          proration,
          terms,
        })
      }}
      extras={
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {isUsage ? null : (
              <Field
                label="Quantity"
                hint="How many of this charge the contract buys."
                required
                error={showErrors ? errors.quantity : undefined}
              >
                {({ id, ...field }) => (
                  <Input
                    id={id}
                    inputMode="numeric"
                    value={quantity}
                    disabled={isSubmitting}
                    {...field}
                    onChange={(event) => setQuantity(event.target.value)}
                  />
                )}
              </Field>
            )}
            <Field
              label="Starts on"
              hint={
                earliestStart
                  ? 'Leave empty to start with the contract. A charge cannot start before it.'
                  : 'Leave empty to start the charge now.'
              }
            >
              {({ id, 'aria-describedby': describedBy }) => (
                <DateInput
                  id={id}
                  value={startDate}
                  onValueChange={setStartDate}
                  {...(earliestDay ? { min: earliestDay } : {})}
                  placeholder={earliestStart ? 'With the contract' : 'Now'}
                  disabled={isSubmitting}
                  aria-describedby={describedBy}
                />
              )}
            </Field>
            {isUsage ? null : (
              <Field
                label="Proration"
                hint="Whether a charge added part-way through the period is billed for the remainder only."
              >
                {({ id }) => (
                  <OptionSelect
                    id={id}
                    value={proration}
                    onValueChange={(next) => setProration(next as Proration)}
                    options={Object.values(PRORATION).map((value) => ({
                      value,
                      label: PRORATION_LABEL[value],
                    }))}
                    disabled={isSubmitting}
                  />
                )}
              </Field>
            )}
          </div>

          {isUsage ? (
            <UsageTermsFields
              value={terms}
              onChange={setTerms}
              errors={showErrors ? errors : {}}
              disabled={isSubmitting}
              unitLabel={currency.toUpperCase()}
            />
          ) : null}
        </div>
      }
    />
  )
}
