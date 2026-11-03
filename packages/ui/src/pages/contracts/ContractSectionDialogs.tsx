import { useState } from 'react'
import { AddonChargesDialog, type AddonPricing } from './SubscriptionForm'
import type { MeterOption } from '../product-catalog/charges/ChargeForm'
import {
  emptyTaxAssociation,
  type AddContractAddon,
  type AddContractCoupon,
  type Charge,
  type CreateCreditGrant,
  type CreateEntitlement,
  type CreateTaxAssociation,
  attachableAddonCharges,
} from '@fp/domain'
import { Composer } from '@ui/compositions/detail/DetailKit'
import { FormDialog } from '@ui/compositions/forms/FormDialog'
import { LabelWithHint } from '@ui/compositions/forms/LabelWithHint'
import { OptionSelect } from '@ui/compositions/forms/OptionSelect'
import { provenance } from '@ui/provenance'
import { TaxDialog, type TaxRateOption } from '../customers/CustomerTaxSection'
import { CreditGrantCreateForm } from '../product-catalog/credit-grants/CreditGrantForm'
import {
  EntitlementCreateForm,
  type FeatureOption,
} from '../product-catalog/entitlements/EntitlementForm'

/**
 * The five "add" dialogs behind the Overview sections of a contract. Each opens
 * from the section's create button, submits through the page's callback, and
 * stays open with the failure shown when the request is rejected.
 */
export const ContractSectionDialogsProvenance = provenance({
  source: 'composition',
  composes: ['compositions/FormDialog', 'pages/product-catalog/entitlements/EntitlementForm'],
  note: 'Add entitlement, credit grant, add-on, coupon and tax to one contract, each as a FormDialog.',
})

export type ContractSectionKind = 'entitlement' | 'creditGrant' | 'addon' | 'coupon' | 'tax'

export interface ContractSectionOptions {
  features: FeatureOption[]
  addons: { id: string; name: string }[]
  /** An add-on's charges, so each usage charge can carry a commitment, as V1. */
  addonCharges?: ((addonId: string) => readonly Charge[] | undefined) | undefined
  /** The add-ons' charges could not be loaded. */
  addonChargesFailed?: boolean | undefined
  /** The metered features, so an add-on usage charge's override offers a bucket where the API takes one. */
  meters?: readonly MeterOption[] | undefined
  /** The contract's currency, for commitment amounts. */
  currency?: string | undefined
  /** The contract's billing period: only prices that attach get a commitment. */
  billingPeriod?: string | undefined
  coupons: { code: string; name: string }[]
  taxRates: TaxRateOption[]
}

export interface ContractSectionActions {
  onAddEntitlement?: ((draft: CreateEntitlement) => Promise<unknown> | void) | undefined
  onAddCreditGrant?: ((draft: CreateCreditGrant) => Promise<unknown> | void) | undefined
  onAddAddon?: ((draft: AddContractAddon) => Promise<unknown> | void) | undefined
  onAddCoupon?: ((draft: AddContractCoupon) => Promise<unknown> | void) | undefined
  onAddTax?: ((draft: CreateTaxAssociation) => Promise<unknown> | void) | undefined
}

export function ContractSectionDialogs({
  kind,
  options,
  actions,
  pending,
  error,
  onRun,
  onClose,
  couponCopy,
}: {
  kind: ContractSectionKind | null
  options: ContractSectionOptions
  actions: ContractSectionActions
  pending: boolean
  error: string | null
  /** Runs one submit with the page's pending and error handling. */
  onRun: (action: Promise<unknown> | void) => void
  onClose: () => void
  /** Overrides the coupon dialog when it is changing one charge rather than the contract. */
  couponCopy?: { title: string; hint: string; submitLabel: string } | undefined
}) {
  return (
    <>
      <FormDialog
        open={kind === 'entitlement'}
        onOpenChange={(next) => (next ? undefined : onClose())}
        title="Add entitlement"
        isPending={pending}
      >
        <EntitlementCreateForm
          features={options.features}
          submitLabel="Add entitlement"
          isSubmitting={pending}
          submitError={error}
          onSubmit={(draft) => onRun(actions.onAddEntitlement?.(draft))}
        />
      </FormDialog>

      <FormDialog
        open={kind === 'creditGrant'}
        onOpenChange={(next) => (next ? undefined : onClose())}
        title="Add credit grant"
        isPending={pending}
      >
        <CreditGrantCreateForm
          submitLabel="Add credit grant"
          isSubmitting={pending}
          submitError={error}
          onSubmit={(draft) => onRun(actions.onAddCreditGrant?.(draft))}
        />
      </FormDialog>

      <AddonDialog
        key={kind === 'addon' ? 'open' : 'closed'}
        open={kind === 'addon'}
        addons={options.addons}
        chargesOf={options.addonCharges}
        chargesFailed={options.addonChargesFailed ?? false}
        meters={options.meters ?? []}
        currency={options.currency ?? ''}
        billingPeriod={options.billingPeriod ?? ''}
        pending={pending}
        error={error}
        onClose={onClose}
        onSubmit={(draft) => onRun(actions.onAddAddon?.(draft))}
      />

      <PickDialog
        key={couponCopy?.title ?? 'add-coupon'}
        open={kind === 'coupon'}
        title={couponCopy?.title ?? 'Add coupon'}
        label="Coupon"
        hint={couponCopy?.hint ?? 'The coupon to apply to this contract.'}
        submitLabel={couponCopy?.submitLabel ?? 'Add coupon'}
        emptyNote="No coupons are available to apply."
        options={options.coupons.map((c) => ({ value: c.code, label: c.name }))}
        pending={pending}
        error={error}
        onClose={onClose}
        onSubmit={(couponCode) => onRun(actions.onAddCoupon?.({ couponCode }))}
      />

      <TaxDialog
        open={kind === 'tax'}
        mode="add"
        subject="contract"
        taxRates={options.taxRates}
        initial={emptyTaxAssociation()}
        pending={pending}
        error={error}
        onClose={onClose}
        onSubmit={(draft) => onRun(actions.onAddTax?.(draft))}
      />
    </>
  )
}

function PickDialog({
  open,
  title,
  label,
  hint,
  submitLabel,
  emptyNote,
  options,
  pending,
  error,
  onClose,
  onSubmit,
}: {
  open: boolean
  title: string
  label: string
  hint: string
  submitLabel: string
  emptyNote: string
  options: { value: string; label: string }[]
  pending: boolean
  error: string | null
  onClose: () => void
  onSubmit: (value: string) => void
}) {
  const [value, setValue] = useState('')
  const [problem, setProblem] = useState<string | null>(null)
  const id = `pick-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`

  return (
    <FormDialog
      open={open}
      onOpenChange={(next) => (next ? undefined : onClose())}
      title={title}
      size="sm"
      isPending={pending}
    >
      <Composer
        submitLabel={submitLabel}
        onCancel={onClose}
        submitting={pending}
        disabled={options.length === 0}
        onSubmit={() => {
          if (!value) return setProblem(`Choose a ${label.toLowerCase()}`)
          setProblem(null)
          onSubmit(value)
        }}
      >
        <div className="flex flex-col gap-2">
          <LabelWithHint htmlFor={id} hint={hint}>
            {label}
          </LabelWithHint>
          <OptionSelect
            id={id}
            value={value || undefined}
            onValueChange={setValue}
            options={options}
            placeholder={`Select ${label.toLowerCase()}`}
          />
          {options.length === 0 ? (
            <p className="text-muted-foreground text-[13px]">{emptyNote}</p>
          ) : null}
        </div>
        {problem || error ? (
          <p role="alert" className="text-destructive text-sm">
            {problem ?? error}
          </p>
        ) : null}
      </Composer>
    </FormDialog>
  )
}

/**
 * Attach an add-on, repricing its charges first if you like, as V1's add-on
 * card: choosing one lists all its charges, fixed and usage, each with
 * Override price (sent as `override_line_items`) and, on a usage charge, Add
 * commitment, the same dialogs as a plan charge.
 */
function AddonDialog({
  open,
  addons,
  chargesOf,
  chargesFailed,
  meters,
  currency,
  billingPeriod,
  pending,
  error,
  onClose,
  onSubmit,
}: {
  open: boolean
  addons: { id: string; name: string }[]
  chargesOf: ((addonId: string) => readonly Charge[] | undefined) | undefined
  chargesFailed: boolean
  meters: readonly MeterOption[]
  currency: string
  billingPeriod: string
  pending: boolean
  error: string | null
  onClose: () => void
  onSubmit: (draft: AddContractAddon) => void
}) {
  const [addonId, setAddonId] = useState('')
  const [pricing, setPricing] = useState<AddonPricing>({ priceOverrides: [], commitments: [] })
  const [problem, setProblem] = useState<string | null>(null)
  // Only the prices the API will attach (this currency, this period or one-time).
  const loaded = addonId ? chargesOf?.(addonId) : undefined
  const charges =
    !addonId || !chargesOf
      ? null
      : loaded
        ? attachableAddonCharges(loaded, { currency, billingPeriod })
        : undefined

  return (
    <AddonChargesDialog
      open={open}
      title="Add add-on"
      submitLabel="Add add-on"
      charges={charges}
      chargesFailed={chargesFailed}
      meters={meters}
      currency={currency}
      value={pricing}
      onChange={setPricing}
      pending={pending}
      error={problem ?? error}
      disabled={addons.length === 0}
      onClose={onClose}
      onSubmit={() => {
        if (!addonId) return setProblem('Choose an add-on')
        setProblem(null)
        onSubmit({
          addonId,
          ...(pricing.priceOverrides.length > 0 ? { priceOverrides: pricing.priceOverrides } : {}),
          ...(pricing.commitments.length > 0 ? { commitments: pricing.commitments } : {}),
          ...(pricing.startDate ? { startDate: pricing.startDate } : {}),
        })
      }}
    >
      <div className="flex flex-col gap-2">
        <LabelWithHint htmlFor="pick-add-on" hint="The add-on to attach to this contract.">
          Add-on
        </LabelWithHint>
        <OptionSelect
          id="pick-add-on"
          value={addonId || undefined}
          onValueChange={(next) => {
            setAddonId(next)
            setPricing({ priceOverrides: [], commitments: [] })
          }}
          options={addons.map((a) => ({ value: a.id, label: a.name }))}
          placeholder="Select add-on"
        />
        {addons.length === 0 ? (
          <p className="text-muted-foreground text-[13px]">No add-ons are available to attach.</p>
        ) : null}
      </div>
    </AddonChargesDialog>
  )
}
