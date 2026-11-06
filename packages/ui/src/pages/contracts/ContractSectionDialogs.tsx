import { useState } from 'react'
import { ADDON_TIMING_OPTIONS, AddonChargesDialog, type AddonPricing } from './SubscriptionForm'
import { OptionSelect } from '@ui/compositions/forms/OptionSelect'
import { Switch } from '@ui/components/primitives/switch'
import type { MeterOption } from '../product-catalog/charges/ChargeForm'
import {
  emptyTaxAssociation,
  type AddContractAddon,
  type RemoveContractAddon,
  type AddonChangeAt,
  type AddContractCoupon,
  type Charge,
  type CreateCreditGrant,
  type CreateEntitlement,
  type CreateTaxAssociation,
  type CreateTaxRate,
  attachableAddonCharges,
} from '@fp/domain'
import { Field } from '@ui/compositions/forms/Field'
import { DateInput } from '@ui/compositions/forms/DateInput'
import { CheckboxRow } from '@ui/compositions/forms/CheckboxRow'
import { Button } from '@ui/components/primitives/button'
import { PlusIcon, XIcon } from '@ui/icons'
import { Composer } from '@ui/compositions/detail/DetailKit'
import { FormDialog } from '@ui/compositions/forms/FormDialog'
import { LabelWithHint } from '@ui/compositions/forms/LabelWithHint'
import { OptionCombobox } from '@ui/compositions/forms/OptionCombobox'
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
  existingAddons?: { id: string; name: string; addonId?: string }[] | undefined
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
  /**
   * The charges a contract-level coupon may be scoped to instead (V1's "Apply
   * to"). Absent when the dialog was opened from a charge, which is its scope.
   */
  couponLines?: { id: string; name: string }[] | undefined
  taxRates: TaxRateOption[]
  /** The days a new credit grant opens on: today, and the current period's end when known. */
  grantStartDates?: { oneTime: string; recurring: string | null } | undefined
}

export interface ContractSectionActions {
  onAddEntitlement?: ((draft: CreateEntitlement) => Promise<unknown> | void) | undefined
  onAddCreditGrant?: ((draft: CreateCreditGrant) => Promise<unknown> | void) | undefined
  /** One or more add-ons, attached together as one change. */
  onAddAddon?:
    | ((drafts: AddContractAddon[], removals?: RemoveContractAddon[]) => Promise<unknown> | void)
    | undefined
  onAddCoupon?: ((draft: AddContractCoupon) => Promise<unknown> | void) | undefined
  onAddTax?: ((draft: CreateTaxAssociation) => Promise<unknown> | void) | undefined
  onCreateTaxRate?: ((draft: CreateTaxRate) => Promise<TaxRateOption>) | undefined
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
          startDates={options.grantStartDates ?? { oneTime: '', recurring: null }}
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
        existingAddons={options.existingAddons ?? []}
        chargesOf={options.addonCharges}
        chargesFailed={options.addonChargesFailed ?? false}
        meters={options.meters ?? []}
        currency={options.currency ?? ''}
        billingPeriod={options.billingPeriod ?? ''}
        pending={pending}
        error={error}
        onClose={onClose}
        onSubmit={(drafts, removals) =>
          onRun(
            removals.length ? actions.onAddAddon?.(drafts, removals) : actions.onAddAddon?.(drafts),
          )
        }
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
        {...(options.couponLines?.length ? { scopes: options.couponLines } : {})}
        pending={pending}
        error={error}
        onClose={onClose}
        onSubmit={(couponCode, dates, lineItemId) =>
          onRun(
            actions.onAddCoupon?.({ couponCode, ...dates, ...(lineItemId ? { lineItemId } : {}) }),
          )
        }
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
        {...(actions.onCreateTaxRate ? { onCreateTaxRate: actions.onCreateTaxRate } : {})}
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
  scopes,
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
  /** Charges the pick may apply to instead of the whole contract; none hides the choice. */
  scopes?: { id: string; name: string }[]
  pending: boolean
  error: string | null
  onClose: () => void
  onSubmit: (
    value: string,
    dates: { startDate?: string; endDate?: string },
    lineItemId?: string,
  ) => void
}) {
  const [value, setValue] = useState('')
  const [scope, setScope] = useState(WHOLE_CONTRACT)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
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
          if (endDate && startDate && endDate <= startDate)
            return setProblem('End date must be after start date')
          onSubmit(
            value,
            { ...(startDate ? { startDate } : {}), ...(endDate ? { endDate } : {}) },
            scope === WHOLE_CONTRACT ? undefined : scope,
          )
        }}
      >
        <div className="flex flex-col gap-2">
          <LabelWithHint htmlFor={id} hint={hint}>
            {label}
          </LabelWithHint>
          <OptionCombobox
            searchable
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
        {scopes ? (
          <Field label="Apply to" hint="The whole contract, or one of its charges.">
            {({ id }) => (
              <OptionCombobox
                searchable
                id={id}
                value={scope}
                onValueChange={(next) => setScope(next || WHOLE_CONTRACT)}
                options={[
                  { value: WHOLE_CONTRACT, label: 'Whole contract' },
                  ...scopes.map((line) => ({ value: line.id, label: line.name })),
                ]}
              />
            )}
          </Field>
        ) : null}
        <Field label="Start date" hint="Leave blank to apply now.">
          {({ id }) => <DateInput id={id} value={startDate} onValueChange={setStartDate} />}
        </Field>
        <Field label="End date" hint="Leave blank for no end date.">
          {({ id }) => <DateInput id={id} value={endDate} onValueChange={setEndDate} />}
        </Field>
        {problem || error ? (
          <p role="alert" className="text-destructive text-sm">
            {problem ?? error}
          </p>
        ) : null}
      </Composer>
    </FormDialog>
  )
}

const WHOLE_CONTRACT = '__contract__'

/** V1's cap: adds and removes together in one `addon` modification. */
const MAX_ADDONS = 20

/**
 * Attach add-ons, repricing their charges first if you like, as V1's add-on
 * dialog: choosing one lists all its charges, fixed and usage, each with
 * Override price (sent as `override_line_items`) and, on a usage charge, Add
 * commitment, the same dialogs as a plan charge. "Add another add-on" sets the
 * one in hand aside with its pricing and clears the picker, so several are
 * attached together as one change.
 */
function AddonDialog({
  open,
  existingAddons,
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
  existingAddons: { id: string; name: string; addonId?: string }[]
  onSubmit: (drafts: AddContractAddon[], removals: RemoveContractAddon[]) => void
}) {
  const [removals, setRemovals] = useState<string[]>([])
  // When the removals take effect, as V1 asks it: one choice for all of them in this change.
  const [removeWhen, setRemoveWhen] = useState<AddonChangeAt | 'date'>('end_of_period')
  const [removeOn, setRemoveOn] = useState('')
  const [removeProrate, setRemoveProrate] = useState(true)
  // Add-ons set aside to attach with the one in hand.
  const [staged, setStaged] = useState<{ draft: AddContractAddon; name: string }[]>([])
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

  const current = (): AddContractAddon | null =>
    addonId
      ? {
          addonId,
          ...(pricing.priceOverrides.length > 0 ? { priceOverrides: pricing.priceOverrides } : {}),
          ...(pricing.commitments.length > 0 ? { commitments: pricing.commitments } : {}),
          ...(pricing.quantities?.length ? { quantities: pricing.quantities } : {}),
          // A day, or now / at period end (V1's timing), and whether to prorate.
          ...(pricing.startWhen === 'date'
            ? pricing.startDate
              ? { startDate: pricing.startDate }
              : {}
            : { changeAt: pricing.startWhen ?? 'immediate' }),
          prorate: pricing.prorate ?? true,
        }
      : null
  const total = staged.length + (addonId ? 1 : 0)
  // An add-on goes on a contract once: those set aside leave the picker.
  const choosable = addons.filter(
    (a) =>
      !staged.some(({ draft }) => draft.addonId === a.id) &&
      !existingAddons.some(
        (existing) => existing.addonId === a.id && !removals.includes(existing.id),
      ),
  )

  return (
    <AddonChargesDialog
      open={open}
      title="Modify add-ons"
      timing
      submitLabel="Apply add-on changes"
      charges={charges}
      chargesFailed={chargesFailed}
      meters={meters}
      currency={currency}
      value={pricing}
      onChange={setPricing}
      pending={pending}
      error={problem ?? error}
      disabled={
        total + removals.length === 0 || (addons.length === 0 && existingAddons.length === 0)
      }
      onClose={onClose}
      onSubmit={() => {
        const inHand = current()
        const drafts = [...staged.map(({ draft }) => draft), ...(inHand ? [inHand] : [])]
        if (
          drafts.some((draft) =>
            existingAddons.some(
              (existing) => existing.addonId === draft.addonId && !removals.includes(existing.id),
            ),
          )
        )
          return setProblem('An add-on already attached must be removed before adding it again')
        if (drafts.length + removals.length === 0)
          return setProblem('Choose an add-on to add or remove')
        if (drafts.length + removals.length > MAX_ADDONS)
          return setProblem('Change at most 20 add-ons at once')
        if (drafts.some((draft) => draft.changeAt === undefined && !draft.startDate))
          return setProblem('Choose the day the add-on starts')
        if (removals.length && removeWhen === 'date' && !removeOn)
          return setProblem('Choose the day the add-ons are removed')
        setProblem(null)
        onSubmit(
          drafts,
          removals.map((id) => ({
            id,
            ...(removeWhen === 'date' ? { effectiveDate: removeOn } : { changeAt: removeWhen }),
            prorate: removeProrate,
          })),
        )
      }}
    >
      {existingAddons.length > 0 ? (
        <Field
          label="Remove existing add-ons"
          hint="Removals and additions are submitted together as one change."
        >
          {() => (
            <div className="flex flex-col gap-2">
              {existingAddons.map((addon) => (
                <CheckboxRow
                  key={addon.id}
                  checked={removals.includes(addon.id)}
                  onCheckedChange={(checked) =>
                    setRemovals((ids) =>
                      checked ? [...ids, addon.id] : ids.filter((id) => id !== addon.id),
                    )
                  }
                >
                  {addon.name}
                </CheckboxRow>
              ))}
            </div>
          )}
        </Field>
      ) : null}
      {removals.length > 0 ? (
        <>
          <Field label="Removed" hint="When the add-ons you are removing stop billing.">
            {({ id }) => (
              <OptionSelect
                id={id}
                value={removeWhen}
                onValueChange={(next) => setRemoveWhen(next as AddonChangeAt | 'date')}
                options={ADDON_TIMING_OPTIONS}
              />
            )}
          </Field>
          {removeWhen === 'date' ? (
            <Field label="Remove on">
              {({ id }) => <DateInput id={id} value={removeOn} onValueChange={setRemoveOn} />}
            </Field>
          ) : null}
          <span className="flex items-center justify-between gap-4 text-sm">
            <label htmlFor="addon-remove-prorate">Prorate the removed add-ons</label>
            <Switch
              id="addon-remove-prorate"
              checked={removeProrate}
              onCheckedChange={setRemoveProrate}
            />
          </span>
        </>
      ) : null}
      {staged.length > 0 ? (
        <ul
          className="divide-border flex flex-col divide-y rounded-lg border"
          aria-label="Add-ons to attach"
        >
          {staged.map(({ draft, name }) => (
            <li key={draft.addonId} className="flex items-center justify-between gap-3 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{name}</p>
                <p className="text-muted-foreground text-xs">
                  {draft.priceOverrides?.length || draft.commitments?.length
                    ? 'Repriced for this contract'
                    : draft.quantities?.length
                      ? 'At its catalog prices, quantity changed'
                      : 'At its catalog prices'}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-muted-foreground size-7 shrink-0"
                aria-label={`Remove ${name}`}
                onClick={() =>
                  setStaged((list) => list.filter((item) => item.draft.addonId !== draft.addonId))
                }
              >
                <XIcon aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex flex-col gap-2">
        <LabelWithHint htmlFor="pick-add-on" hint="The add-on to attach to this contract.">
          Add-on
        </LabelWithHint>
        <OptionCombobox
          searchable
          id="pick-add-on"
          value={addonId || undefined}
          onValueChange={(next) => {
            setAddonId(next)
            setPricing({ priceOverrides: [], commitments: [] })
          }}
          options={choosable.map((a) => ({ value: a.id, label: a.name }))}
          placeholder={staged.length > 0 ? 'Select another add-on' : 'Select add-on'}
        />
        {addons.length === 0 ? (
          <p className="text-muted-foreground text-[13px]">No add-ons are available to attach.</p>
        ) : null}
        {addonId && choosable.length > 1 && total < MAX_ADDONS ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() => {
              const inHand = current()
              if (!inHand) return
              const name = addons.find((a) => a.id === addonId)?.name ?? addonId
              setStaged((list) => [...list, { draft: inHand, name }])
              setAddonId('')
              setPricing({ priceOverrides: [], commitments: [] })
              setProblem(null)
            }}
          >
            <PlusIcon aria-hidden />
            Add another add-on
          </Button>
        ) : null}
      </div>
    </AddonChargesDialog>
  )
}
