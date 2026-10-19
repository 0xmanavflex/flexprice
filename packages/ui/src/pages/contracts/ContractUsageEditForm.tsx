import { CircleAlertIcon, InfoIcon } from '@ui/icons'
import { useState } from 'react'
import {
  BillingModel,
  type BillingPeriod,
  type CreateCharge,
  type EditContractCharge,
  type PriceOverride,
  type SubscriptionLine,
  type UsageTerms,
  InvoiceCadence,
  NO_USAGE_TERMS,
  PriceType,
  TierMode,
  hasTermsErrors,
  validateContractTerms,
} from '@fp/domain'
import { Alert, AlertDescription, AlertTitle } from '@ui/components/reui/alert'
import { provenance } from '@ui/provenance'
import {
  ChargeForm,
  type MeterOption,
  type PriceUnitOption,
} from '../product-catalog/charges/ChargeForm'
import { UsageTermsFields } from './UsageTermsFields'

export const ContractUsageEditFormProvenance = provenance({
  source: 'composition',
  composes: ['pages/ChargeForm', '@reui/alert'],
  note: 'Edit a metered charge on one contract: the plan charge form opened on the line’s own price (model, bands, package size, effective date), plus its bucket size and commitment.',
})

export interface ContractUsageEditFormProps {
  line: SubscriptionLine
  currency: string
  billingPeriod: BillingPeriod
  meters: MeterOption[]
  priceUnits: PriceUnitOption[]
  onSubmit: (draft: EditContractCharge) => void
  isSubmitting?: boolean
  submitError?: string | null
}

/** The form's starting value: the line's price as the form models it. */
function toDraft(
  line: SubscriptionLine,
  currency: string,
  billingPeriod: BillingPeriod,
): CreateCharge | null {
  const pricing = line.pricing
  if (!pricing) return null
  const base = {
    type: PriceType.Usage,
    currency: (pricing.currency || currency || 'USD').toUpperCase(),
    billingPeriod: pricing.billingPeriod ?? billingPeriod,
    invoiceCadence: InvoiceCadence.Arrear,
    meterId: pricing.meterId,
    displayName: line.name,
    ...(pricing.priceUnit ? { priceUnit: pricing.priceUnit } : {}),
  }
  switch (pricing.billingModel) {
    case BillingModel.Package:
      return {
        ...base,
        billingModel: BillingModel.Package,
        amount: line.amount.amount || '0',
        divideBy: pricing.divideBy ?? 1,
      }
    case BillingModel.Tiered:
      return {
        ...base,
        billingModel: BillingModel.Tiered,
        tierMode: pricing.tierMode ?? TierMode.Volume,
        tiers: pricing.tiers,
      }
    case BillingModel.FlatFee:
      return { ...base, billingModel: BillingModel.FlatFee, amount: line.amount.amount || '0' }
  }
}

function toOverride(priceId: string, charge: CreateCharge): PriceOverride {
  switch (charge.billingModel) {
    case BillingModel.Package:
      return {
        priceId,
        billingModel: BillingModel.Package,
        amount: charge.amount,
        divideBy: charge.divideBy,
      }
    case BillingModel.Tiered:
      return {
        priceId,
        billingModel: BillingModel.Tiered,
        tierMode: charge.tierMode ?? TierMode.Volume,
        tiers: charge.tiers,
      }
    case BillingModel.FlatFee:
      return { priceId, billingModel: BillingModel.FlatFee, amount: charge.amount }
  }
}

/** Edit one metered charge on one contract as the same granular form the plan uses. */
export function ContractUsageEditForm({
  line,
  currency,
  billingPeriod,
  meters,
  priceUnits,
  onSubmit,
  isSubmitting = false,
  submitError = null,
}: ContractUsageEditFormProps) {
  const [terms, setTerms] = useState<UsageTerms>(line.pricing?.terms ?? NO_USAGE_TERMS)
  const [showErrors, setShowErrors] = useState(false)
  const draft = toDraft(line, currency, billingPeriod)
  const errors = validateContractTerms({ terms })

  if (!draft) {
    return (
      <Alert variant="destructive">
        <CircleAlertIcon aria-hidden="true" />
        <AlertTitle>This charge cannot be edited here</AlertTitle>
        <AlertDescription>
          The API did not say how it is priced. Reload the contract and try again.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <ChargeForm
      mode="edit"
      lockType
      lockDisplayName
      // Same reason as the add form: the window is collected in
      // `UsageTermsFields` below, so the price form must not draw a second.
      showUsageWindow={false}
      defaultValue={draft}
      meters={meters}
      priceUnits={priceUnits}
      isSubmitting={isSubmitting}
      submitError={submitError}
      submitLabel="Save charge"
      notice={
        <Alert>
          <InfoIcon aria-hidden="true" />
          <AlertTitle>Only this contract changes</AlertTitle>
          <AlertDescription>
            {line.source === 'plan'
              ? 'This charge comes from the plan; the plan keeps its price. '
              : ''}
            Currency, period and meter are fixed once a charge exists. A new price takes effect from
            the date below, so earlier invoices keep the old one.
          </AlertDescription>
        </Alert>
      }
      onSubmit={(charge) => {
        if (hasTermsErrors(errors)) {
          setShowErrors(true)
          return
        }
        onSubmit({
          price: toOverride(line.priceId, charge),
          priceUnit: charge.priceUnit ?? '',
          effectiveFrom: charge.effectiveFrom ?? '',
          terms,
        })
      }}
      extras={
        <UsageTermsFields
          value={terms}
          onChange={setTerms}
          errors={showErrors ? errors : {}}
          disabled={isSubmitting}
          unitLabel={draft.priceUnit || draft.currency}
        />
      }
    />
  )
}
