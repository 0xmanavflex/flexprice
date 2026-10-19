import { useCalmForm } from '@ui/compositions/forms/useCalmForm'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Controller, type FieldErrors, type Resolver, type UseFormRegister } from 'react-hook-form'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import {
  CoinsIcon,
  KeyRoundIcon,
  PencilIcon,
  PuzzleIcon,
  ReceiptIcon,
  ScaleIcon,
  SlidersHorizontalIcon,
  TicketPercentIcon,
  XIcon,
} from '@ui/icons'
import {
  BILLING_MODEL_LABEL,
  BILLING_PERIOD_LABEL,
  BillingModel,
  type AddContractCharge,
  BillingCycle,
  type Charge,
  type ChargeCommitment,
  CommitmentType,
  type CreateCreditGrant,
  type CreateSubscription,
  PAYMENT_TERMS_LABEL,
  PaymentTerms,
  PriceType,
  type SubscriptionDiscount,
  type SubscriptionPhase,
  emptyPhase,
  phaseStarts,
  selectContractCharges,
  type ContractChargeSelection,
  CREDIT_GRANT_CADENCE_LABEL,
  CREDIT_GRANT_EXPIRY_DURATION_UNIT_LABEL,
  CREDIT_GRANT_EXPIRY_TYPE_LABEL,
  CREDIT_GRANT_PERIOD_LABEL,
  CreditGrantCadence,
  CreditGrantExpiryType,
  type Entitlement,
  FeatureType,
  type PriceOverride,
  type PriceTier,
  SUBSCRIPTION_BILLING_PERIODS,
  TierMode,
  createSubscriptionSchema,
  emptySubscription,
  currencyCodes,
} from '@fp/domain'
import { Badge } from '@ui/components/reui/badge'
import { Button } from '@ui/components/primitives/button'
import { Input } from '@ui/components/primitives/input'
import { Switch } from '@ui/components/primitives/switch'
import type { DetailCrumb } from '@ui/compositions/detail/DetailShell'
import { DateInput } from '@ui/compositions/forms/DateInput'
import { EmptyState } from '@ui/compositions/feedback/EmptyState'
import { FormCard, FormRow } from '@ui/compositions/forms/FormCard'
import { FormPage } from '@ui/compositions/forms/FormPage'
import { OptionCombobox } from '@ui/compositions/forms/OptionCombobox'
import { type Option, OptionSelect } from '@ui/compositions/forms/OptionSelect'
import { useFormSteps } from '@ui/compositions/forms/useFormSteps'
import { CreditGrantCreateForm } from '@ui/pages/product-catalog/credit-grants/CreditGrantForm'
import { PriceOverrideForm } from '@ui/pages/product-catalog/charges/PriceOverrideForm'
import type { MeterOption, PriceUnitOption } from '@ui/pages/product-catalog/charges/ChargeForm'
import { RowActionsMenu } from '@ui/pages/shared/RowActionsMenu'
import { ContractChargeDialog } from './ContractChargeDialog'
import { provenance } from '@ui/provenance'

/**
 * Create a contract (subscription), in V1's order:
 *
 * 1. **Customer & plan** — the customer, the plan, its billing period and
 *    currency, and the contract's start and end dates and trial.
 * 2. **Phases** — each phase's dates, then its charges. A usage charge's
 *    commitment opens on that charge, in the same card. Discounts follow, then
 *    a button to add the next phase, which collapses the ones before it.
 *    Phase 1 is the contract itself; each later phase starts where the
 *    previous ends.
 * 3. **Commitments & benefits** — the contract-wide commitment (period,
 *    overage, and true-up shown up front), entitlement overrides, credit
 *    grants, taxes (starting from the customer's), and add-ons.
 * 4. **Billing** — billing cycle and anchor, payment terms, proration, the
 *    auto-invoice threshold, and whether to create it as a draft.
 * 5. **Review** — everything above, with the charges priced as they will bill
 *    (an override shows its own model and tiers, not the plan's amount).
 *
 * One react-hook-form draft over the domain schema, walked by `useFormSteps`.
 * The toolbar carries Previous / Next and, on the last step, Create; there is
 * no footer and no preview rail (TODO(checkout-review): a preview returns only
 * on a future checkout review screen).
 *
 * The form never fetches: the page hands it the customers and plans to choose
 * from and, once a plan is chosen (reported through `onPlanChange`), that
 * plan's charges and entitlements. `customerLocked` drops the Customer step
 * when the form is opened from a customer's own page. Currency defaults to the
 * customer's own currency when the customer option carries one, else to the
 * plan's when it bills in only one.
 */
export const SubscriptionFormProvenance = provenance({
  source: 'composition',
  composes: [
    'compositions/form-page',
    'compositions/option-combobox',
    'compositions/date-input',
    'pages/price-override-form',
    'pages/credit-grant-form',
  ],
  note: 'RHF + the domain schema, four steps (customer, plan & charges, benefits, review) with Previous/Next in the toolbar; sub-forms (price override, credit grant) sit outside the form element.',
})

export interface SubscriptionPlanContext {
  charges: Charge[]
  entitlements: Entitlement[]
  /** The plan's own credit grants, as drafts; undefined while they load. */
  creditGrants?: CreateCreditGrant[] | undefined
  isLoading: boolean
}

/** A customer to choose from; `currency` (ISO, any case) seeds the contract's currency. */
export interface SubscriptionCustomerOption extends Option {
  currency?: string | undefined
}

/** A tax rate the contract can carry. */
export interface SubscriptionTaxRateOption {
  code: string
  name: string
  percentage: string
}

export interface SubscriptionFormProps {
  defaultValue?: Partial<CreateSubscription>
  customers: readonly SubscriptionCustomerOption[]
  plans: readonly Option[]
  /** The chosen plan's charges and entitlements; undefined until a plan is chosen. */
  plan: SubscriptionPlanContext | undefined
  onPlanChange: (planId: string) => void
  /** The customer changed: the page loads their tax rates. */
  onCustomerChange?: (customerId: string) => void
  /** Coupons a phase or charge can be discounted with. */
  coupons?: readonly Option[]
  /** Rates that can be added to the contract. */
  taxRates?: readonly SubscriptionTaxRateOption[]
  /** The chosen customer's tax associations, applied when the customer is picked (as V1 does). */
  customerTaxes?: CreateSubscription['taxes'] | null
  /** Add-ons the contract can start with. */
  addons?: readonly Option[]
  /** For charges added to this contract alone: the metered features and price units. */
  meters?: MeterOption[]
  priceUnits?: PriceUnitOption[]
  customerLocked?: boolean
  onSubmit: (subscription: CreateSubscription) => void
  onCancel: () => void
  isSubmitting?: boolean
  submitError?: string | null
  trail: DetailCrumb[]
  step?: string
  onStepChange?: (id: string) => void
}

const FORM_ID = 'subscription-form'

const FALLBACK_CURRENCIES = currencyCodes()

/**
 * Step ids are URL-safe and mirrored by the console's route
 * (`app/subscriptionSteps.ts`).
 *
 * Customer and plan are **one** step, not two. They were split, and the first
 * step was a single combobox — a whole screen, with its own Next, to answer one
 * question. Merging them also puts the two choices that constrain each other
 * side by side: the customer decides the currency, the plan decides the billing
 * periods on offer, and picking them a page apart hides that from the person
 * making the choice.
 *
 * The plan half stays hidden until a customer is chosen, so the merged step
 * opens as one question and grows into the rest rather than presenting an
 * eight-field wall.
 */
export const SUBSCRIPTION_FORM_STEPS = [
  { id: 'plan', title: 'Customer & plan' },
  { id: 'phases', title: 'Phases' },
  { id: 'commitments', title: 'Commitments & benefits' },
  { id: 'billing', title: 'Billing' },
  { id: 'review', title: 'Review' },
] as const

const STEP_FIELDS: Record<string, (keyof CreateSubscription)[]> = {
  plan: [
    'customerId',
    'planId',
    'currency',
    'billingPeriod',
    'billingPeriodCount',
    'trialPeriodDays',
  ],
  phases: ['phases', 'chargeCommitments'],
  commitments: ['commitmentAmount', 'overageFactor'],
  billing: ['billingAnchor', 'autoInvoiceThreshold'],
}

const unique = <T,>(values: T[]) => [...new Set(values)]

export function SubscriptionForm({
  defaultValue,
  customers,
  plans,
  plan,
  onPlanChange,
  onCustomerChange,
  coupons = [],
  taxRates = [],
  customerTaxes = null,
  addons = [],
  meters = [],
  priceUnits = [],
  customerLocked = false,
  onSubmit,
  onCancel,
  isSubmitting = false,
  submitError = null,
  trail,
  step,
  onStepChange,
}: SubscriptionFormProps) {
  const form = useCalmForm<CreateSubscription>({
    resolver: standardSchemaResolver(createSubscriptionSchema) as Resolver<CreateSubscription>,
    defaultValues: { ...emptySubscription(), ...defaultValue },
  })
  const errors = form.formState.errors
  const values = form.watch()

  /*
   * Opened from a customer's own page there is no customer to choose, so the
   * step is about the plan alone and says so. The step *list* no longer changes
   * — the customer is a card inside the first step now, not a step of its own.
   */
  const steps = useMemo(
    () =>
      customerLocked
        ? SUBSCRIPTION_FORM_STEPS.map((s) => (s.id === 'plan' ? { ...s, title: 'Plan' } : s))
        : SUBSCRIPTION_FORM_STEPS,
    [customerLocked],
  )

  const flow = useFormSteps({
    steps,
    step,
    onStepChange,
    validate: (id) => {
      const fields: string[] = [...(STEP_FIELDS[id] ?? [])]
      // The contract's end date sits on the first step but lives on the last
      // phase, so it is checked here rather than surfacing only at the end.
      if (id === 'plan') fields.push(`phases.${form.getValues('phases').length - 1}.endDate`)
      return fields.length > 0 ? form.trigger(fields as never) : true
    },
  })

  // A picker has no blur to mark it touched, so a value it sets is validated
  // here: an earlier "Choose a plan" error clears the moment a plan is chosen.
  const pick = (name: 'customerId' | 'planId' | 'currency' | 'billingPeriod', value: string) => {
    form.setValue(name, value as never, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    })
    if (name === 'customerId') onCustomerChange?.(value)
  }

  // V1 starts a contract with the chosen customer's tax rates; once per customer.
  const [taxesFor, setTaxesFor] = useState<string | null>(null)
  useEffect(() => {
    if (!values.customerId || !customerTaxes || taxesFor === values.customerId) return
    form.setValue('taxes', [...customerTaxes], { shouldDirty: true })
    setTaxesFor(values.customerId)
  }, [values.customerId, customerTaxes, taxesFor, form])

  // A contract starts with its plan's credit grants, once per plan.
  const [grantsFor, setGrantsFor] = useState<string | null>(null)
  useEffect(() => {
    if (!values.planId || !plan?.creditGrants || grantsFor === values.planId) return
    form.setValue('creditGrants', [...plan.creditGrants])
    form.setValue('creditGrantsChanged', false)
    setGrantsFor(values.planId)
  }, [values.planId, plan?.creditGrants, grantsFor, form])

  const lastPhase = values.phases.length - 1
  const starts = phaseStarts(values)
  const set = <K extends keyof CreateSubscription>(name: K, value: CreateSubscription[K]) =>
    form.setValue(name, value as never, { shouldDirty: true })

  useEffect(() => {
    if (values.planId) onPlanChange(values.planId)
  }, [values.planId, onPlanChange])

  const customer = customers.find((c) => c.value === values.customerId)
  const customerCurrency = customer?.currency?.trim().toUpperCase() || undefined

  const currencyOptions = useMemo<Option[]>(() => {
    const fromCharges = unique(
      (plan?.charges ?? []).map((c) => c.currency.toUpperCase()).filter(Boolean),
    )
    const codes = fromCharges.length > 0 ? fromCharges : FALLBACK_CURRENCIES
    return codes.map((code) => ({ value: code, label: code }))
  }, [plan])
  const periodOptions = useMemo<Option[]>(() => {
    const fromCharges = unique((plan?.charges ?? []).map((c) => c.billingPeriod as string)).filter(
      (p) => (SUBSCRIPTION_BILLING_PERIODS as readonly string[]).includes(p),
    )
    const periods = fromCharges.length > 0 ? fromCharges : [...SUBSCRIPTION_BILLING_PERIODS]
    return periods.map((p) => ({
      value: p,
      label: BILLING_PERIOD_LABEL[p as keyof typeof BILLING_PERIOD_LABEL],
    }))
  }, [plan])

  // Currency follows the customer when they have one the plan bills in, else
  // the plan when it bills in only one. A choice the person made that is still
  // valid is left alone.
  useEffect(() => {
    const codes = currencyOptions.map((o) => o.value)
    const preferred =
      customerCurrency && codes.includes(customerCurrency)
        ? customerCurrency
        : codes.length === 1
          ? codes[0]
          : undefined
    if (preferred && (!values.currency || !codes.includes(values.currency))) {
      form.setValue('currency', preferred, { shouldValidate: Boolean(values.currency) })
    }
  }, [currencyOptions, customerCurrency, values.currency, form])

  // A plan that bills on one cadence has nothing to choose.
  useEffect(() => {
    if (periodOptions.length > 0 && !periodOptions.some((o) => o.value === values.billingPeriod)) {
      form.setValue('billingPeriod', periodOptions[0]!.value as CreateSubscription['billingPeriod'])
    }
  }, [periodOptions, values.billingPeriod, form])

  // The charges this contract bills: the plan's, in the chosen currency.
  /*
   * The charges this contract will bill, by the API's own rule: in the
   * contract's currency, one-time or on its billing period — plus any charge at
   * another cadence that fits and was opted into. Everything the form shows as
   * billable comes from this, so it never lists a charge the API would drop.
   */
  const selection = useMemo(
    () =>
      selectContractCharges(plan?.charges ?? [], {
        currency: values.currency,
        billingPeriod: values.billingPeriod,
        billingPeriodCount: values.billingPeriodCount,
        optedInIds: values.optedInChargeIds,
      }),
    [
      plan,
      values.currency,
      values.billingPeriod,
      values.billingPeriodCount,
      values.optedInChargeIds,
    ],
  )
  const charges = selection.attached

  /**
   * What is sent: settings on charges this contract will not bill are dropped
   * (they would be refused, or silently ignored), and `include_price_ids` is the
   * selection's own.
   */
  const toSubmit = (draft: CreateSubscription): CreateSubscription => {
    const billed = new Set(selection.attached.map((charge) => charge.id))
    return {
      ...draft,
      phases: draft.phases.map((phase) => ({
        ...phase,
        priceOverrides: phase.priceOverrides.filter((o) => billed.has(o.priceId)),
        quantities: phase.quantities.filter((q) => billed.has(q.priceId)),
        discounts: phase.discounts.filter((d) => !d.priceId || billed.has(d.priceId)),
      })),
      chargeCommitments: draft.chargeCommitments.filter((c) => billed.has(c.priceId)),
      optedInChargeIds: draft.optedInChargeIds.filter((id) => billed.has(id)),
      includePriceIds: selection.includePriceIds,
    }
  }

  const submitAll = form.handleSubmit(
    (draft) => onSubmit(toSubmit(draft)),
    (failed) => {
      const bad = flow.steps.find((s) =>
        STEP_FIELDS[s.id]?.some((field) => failed[field] !== undefined),
      )
      if (bad) flow.goTo(bad.id)
    },
  )

  const planLabel = plans.find((p) => p.value === values.planId)?.label

  const customerStep = (
    <FormCard title="Customer" status="required">
      <FormRow
        label="Customer"
        hint="The customer this contract bills."
        required
        error={errors.customerId?.message}
      >
        {({ id, ...field }) => (
          <Controller
            control={form.control}
            name="customerId"
            render={({ field: control }) => (
              <OptionCombobox
                id={id}
                {...field}
                value={control.value}
                onValueChange={(value) => pick('customerId', value)}
                options={customers}
                placeholder="Search customers…"
                disabled={isSubmitting}
              />
            )}
          />
        )}
      </FormRow>
    </FormCard>
  )

  const planCard = (
    <FormCard title="Plan and billing" status="required">
      <FormRow
        label="Plan"
        hint="The plan whose charges and entitlements apply."
        required
        error={errors.planId?.message}
      >
        {({ id, ...field }) => (
          <Controller
            control={form.control}
            name="planId"
            render={({ field: control }) => (
              <OptionCombobox
                id={id}
                {...field}
                value={control.value}
                onValueChange={(value) => pick('planId', value)}
                options={plans}
                placeholder="Search plans…"
                disabled={isSubmitting}
              />
            )}
          />
        )}
      </FormRow>
      <FormRow
        label="Billing period"
        hint="How often the contract is invoiced."
        required
        error={errors.billingPeriod?.message}
      >
        {({ id, ...field }) => (
          <Controller
            control={form.control}
            name="billingPeriod"
            render={({ field: control }) => (
              <OptionSelect
                id={id}
                {...field}
                value={control.value}
                onValueChange={(value) => pick('billingPeriod', value)}
                options={periodOptions}
                disabled={isSubmitting}
              />
            )}
          />
        )}
      </FormRow>
      <FormRow
        label="Every"
        hint="Number of periods per invoice, e.g. 3 on a monthly cadence bills quarterly."
        error={errors.billingPeriodCount?.message}
      >
        {({ id, ...field }) => (
          <Input
            id={id}
            type="number"
            min={1}
            disabled={isSubmitting}
            {...field}
            {...form.register('billingPeriodCount', { valueAsNumber: true })}
          />
        )}
      </FormRow>
      <FormRow
        label="Currency"
        required
        hint={
          customerCurrency
            ? "Defaults to the customer's currency."
            : "Defaults to the plan's when it bills in one."
        }
        error={errors.currency?.message}
      >
        {({ id, ...field }) => (
          <Controller
            control={form.control}
            name="currency"
            render={({ field: control }) => (
              <OptionSelect
                id={id}
                {...field}
                value={control.value}
                onValueChange={(value) => pick('currency', value)}
                options={currencyOptions}
                placeholder="Choose a currency"
                disabled={isSubmitting}
              />
            )}
          />
        )}
      </FormRow>
      <FormRow label="Start date" hint="Leave empty to start now.">
        {({ id, ...field }) => (
          <Controller
            control={form.control}
            name="startDate"
            render={({ field: control }) => (
              <DateInput
                id={id}
                {...field}
                value={control.value}
                onValueChange={control.onChange}
                disabled={isSubmitting}
              />
            )}
          />
        )}
      </FormRow>
      <FormRow
        label="End date"
        hint={
          values.phases.length > 1
            ? 'Where the last phase ends. Leave empty to run until cancelled.'
            : 'Leave empty to run until cancelled.'
        }
        error={errors.phases?.[lastPhase]?.endDate?.message}
      >
        {({ id, ...field }) => (
          <Controller
            control={form.control}
            name={`phases.${lastPhase}.endDate`}
            render={({ field: control }) => (
              <DateInput
                id={id}
                {...field}
                value={control.value}
                onValueChange={control.onChange}
                placeholder="No end date"
                disabled={isSubmitting}
              />
            )}
          />
        )}
      </FormRow>
      <FormRow
        label="Free trial (days)"
        hint="Optional. Billing starts after the trial."
        error={errors.trialPeriodDays?.message}
      >
        {({ id, ...field }) => (
          <Input
            id={id}
            type="number"
            min={0}
            disabled={isSubmitting}
            {...field}
            {...form.register('trialPeriodDays', {
              setValueAs: (raw) => (raw === '' || raw == null ? undefined : Number(raw)),
            })}
          />
        )}
      </FormRow>
    </FormCard>
  )

  const noPlan = (what: string) => (
    <EmptyState
      size="inline"
      title="No plan chosen yet"
      description={`${what} come from the plan. Go back and choose one.`}
    />
  )

  const formEl = (children: ReactNode) => (
    <form
      id={FORM_ID}
      onSubmit={flow.guardSubmit(submitAll)}
      noValidate
      className="flex flex-col gap-5"
    >
      {children}
    </form>
  )

  const content: Record<string, ReactNode> = {
    plan: (
      <div className="flex flex-col gap-5">
        {/*
          One form element around both cards: they are one step, and a second
          <form> would break Enter-to-advance and the toolbar's submit.
        */}
        {formEl(
          <>
            {customerLocked ? null : customerStep}
            {/*
              The plan is asked for only once there is a customer to ask it
              about — the customer's own currency is what defaults this step's.
            */}
            {customerLocked || values.customerId ? planCard : null}
          </>,
        )}
      </div>
    ),
    phases: values.planId ? (
      <div className="flex flex-col gap-5">
        <OtherCadences
          selection={selection}
          optedIn={values.optedInChargeIds}
          onChange={(next) => set('optedInChargeIds', next)}
        />
        <PhasesStep
          phases={values.phases}
          starts={starts}
          charges={charges}
          isLoading={plan?.isLoading ?? true}
          coupons={coupons}
          errors={errors.phases}
          onChange={(next) => set('phases', next)}
          commitments={values.chargeCommitments}
          commitmentErrors={errors.chargeCommitments}
          onCommitments={(next) => set('chargeCommitments', next)}
          currency={values.currency}
          billingPeriod={values.billingPeriod}
          meters={meters}
          priceUnits={priceUnits}
        />
      </div>
    ) : (
      noPlan('Charges')
    ),
    commitments: (
      <div className="flex flex-col gap-5">
        <CommitmentsSection
          values={values}
          errors={errors}
          register={form.register}
          onDuration={(value) => set('commitmentDuration', value)}
          onTrueUp={(value) => set('enableTrueUp', value)}
        />
        {values.planId ? (
          <EntitlementsSection
            entitlements={plan?.entitlements ?? []}
            isLoading={plan?.isLoading ?? true}
            overrides={values.entitlementOverrides}
            onChange={(next) => form.setValue('entitlementOverrides', next, { shouldDirty: true })}
          />
        ) : (
          noPlan('Entitlements')
        )}
        <CreditsSection
          grants={values.creditGrants}
          changed={values.creditGrantsChanged}
          fromPlan={(plan?.creditGrants?.length ?? 0) > 0}
          onChange={(next) => {
            form.setValue('creditGrants', next, { shouldDirty: true })
            form.setValue('creditGrantsChanged', true)
          }}
          onReset={() => {
            form.setValue('creditGrants', [...(plan?.creditGrants ?? [])])
            form.setValue('creditGrantsChanged', false)
          }}
        />
        <TaxesSection
          taxes={values.taxes}
          taxRates={taxRates}
          onChange={(next) => set('taxes', next)}
        />
        <AddonsSection
          selected={values.addons}
          options={addons}
          onChange={(next) => set('addons', next)}
        />
      </div>
    ),
    billing: formEl(
      <BillingStep
        values={values}
        errors={errors}
        register={form.register}
        isSubmitting={isSubmitting}
        onChange={set}
      />,
    ),
    review: formEl(
      <ReviewStep
        values={values}
        customerLabel={customer?.label}
        planLabel={planLabel}
        charges={charges}
        entitlements={plan?.entitlements ?? []}
        coupons={coupons}
        addons={addons}
        showCustomer={!customerLocked}
        onEdit={flow.goTo}
      />,
    ),
  }

  return (
    <FormPage
      title="Create contract"
      trail={trail}
      toolbar={{
        mode: 'create',
        noun: 'contract',
        formId: FORM_ID,
        onCancel,
        isSubmitting,
        submitError,
      }}
      stepper={{ flow, label: 'Contract steps' }}
    >
      {content[flow.step]}
    </FormPage>
  )
}

/* ------------------------------------------------------------------------- */
/* Pricing text                                                              */
/* ------------------------------------------------------------------------- */

function money(amount: string | undefined, currency: string): string {
  const raw = (amount ?? '').trim()
  if (!raw) return '—'
  const code = currency.trim().toUpperCase()
  const value = Number(raw)
  if (!Number.isFinite(value) || !/^[A-Z]{3}$/.test(code)) return `${raw} ${code}`.trim()
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currencyDisplay: 'narrowSymbol',
      currency: code,
      maximumFractionDigits: 8,
    }).format(value)
  } catch {
    return `${raw} ${code}`
  }
}

function tierLines(tiers: readonly PriceTier[], currency: string): string[] {
  let from = 0
  return tiers.map((tier) => {
    const band =
      tier.upTo == null
        ? from > 0
          ? `Above ${from.toLocaleString('en-US')}`
          : 'Any quantity'
        : `${from > 0 ? `${(from + 1).toLocaleString('en-US')}–` : 'Up to '}${tier.upTo.toLocaleString('en-US')}`
    if (tier.upTo != null) from = tier.upTo
    const flat = tier.flatAmount?.trim() ? ` + ${money(tier.flatAmount, currency)} flat` : ''
    return `${band}: ${money(tier.unitAmount, currency)} / unit${flat}`
  })
}

const TIER_MODE_SHORT: Record<string, string> = {
  [TierMode.Volume]: 'volume',
  [TierMode.Slab]: 'slab',
}

export interface ChargePricing {
  /** One line: model and amount, e.g. "Tiered (volume) · 3 tiers". */
  summary: string
  /** The tier bands, when the pricing is tiered. */
  tiers: string[]
  overridden: boolean
}

/**
 * How a charge will bill on this contract. An override wins: its own model,
 * amount or tiers, never the plan's `displayAmount`.
 */
export function chargePricing(charge: Charge, override: PriceOverride | undefined): ChargePricing {
  const currency = charge.currency
  if (override) {
    switch (override.billingModel) {
      case BillingModel.FlatFee:
        return {
          summary: `${BILLING_MODEL_LABEL[BillingModel.FlatFee]} · ${money(override.amount, currency)}`,
          tiers: [],
          overridden: true,
        }
      case BillingModel.Package:
        return {
          summary: `${BILLING_MODEL_LABEL[BillingModel.Package]} · ${money(override.amount, currency)} per ${override.divideBy.toLocaleString('en-US')} units`,
          tiers: [],
          overridden: true,
        }
      case BillingModel.Tiered:
        return {
          summary: `${BILLING_MODEL_LABEL[BillingModel.Tiered]} (${TIER_MODE_SHORT[override.tierMode] ?? override.tierMode}) · ${override.tiers.length} ${override.tiers.length === 1 ? 'tier' : 'tiers'}`,
          tiers: tierLines(override.tiers, currency),
          overridden: true,
        }
    }
  }
  if (charge.billingModel === BillingModel.Tiered && charge.tiers.length > 0) {
    const mode = charge.tierMode ? ` (${TIER_MODE_SHORT[charge.tierMode] ?? charge.tierMode})` : ''
    return {
      summary: `${BILLING_MODEL_LABEL[BillingModel.Tiered]}${mode} · ${charge.tiers.length} ${charge.tiers.length === 1 ? 'tier' : 'tiers'}`,
      tiers: tierLines(charge.tiers, currency),
      overridden: false,
    }
  }
  const amount = charge.displayAmount || money(charge.amount, currency)
  const model = BILLING_MODEL_LABEL[charge.billingModel] ?? ''
  const pack =
    charge.billingModel === BillingModel.Package && charge.transformQuantity
      ? ` per ${charge.transformQuantity.divideBy.toLocaleString('en-US')} units`
      : ''
  return { summary: `${model ? `${model} · ` : ''}${amount}${pack}`, tiers: [], overridden: false }
}

function chargeName(charge: Charge): string {
  return charge.displayName || charge.description || charge.meterName || charge.id
}

/* ------------------------------------------------------------------------- */
/* Sections                                                                  */
/* ------------------------------------------------------------------------- */

function PricingText({ pricing, period }: { pricing: ChargePricing; period?: string }) {
  return (
    <span className="text-muted-foreground flex flex-col text-xs">
      <span>
        {pricing.summary}
        {period ? ` · ${period}` : ''}
      </span>
      {pricing.tiers.length > 0 ? (
        <ul className="mt-1 flex flex-col gap-0.5 tabular-nums">
          {pricing.tiers.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : null}
    </span>
  )
}

/** A close (X) for an in-place sub-form: the sub-forms draw no Cancel of their own. */
function CloseSubForm({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button type="button" variant="ghost" size="icon-sm" aria-label={label} onClick={onClick}>
      <XIcon aria-hidden />
    </Button>
  )
}

/**
 * Charges the contract does not bill by default: those at another cadence that
 * fits (which can be opted in, as V1's "additional plan prices"), and those it
 * cannot bill at all — said plainly, so nothing looks billable that is not.
 */
function OtherCadences({
  selection,
  optedIn,
  onChange,
}: {
  selection: ContractChargeSelection
  optedIn: string[]
  onChange: (next: string[]) => void
}) {
  const optedInCharges = selection.attached.filter((charge) => optedIn.includes(charge.id))
  const offered = [...optedInCharges, ...selection.optional]
  if (offered.length === 0 && selection.excluded.length === 0) return null
  const why = (reason: 'currency' | 'cadence') =>
    reason === 'currency' ? 'another currency' : "a cadence this contract can't bill"
  return (
    <FormCard title="Charges at other cadences" status="optional">
      {offered.length > 0 ? (
        <ul className="divide-y">
          {offered.map((charge) => {
            const on = optedIn.includes(charge.id)
            const name = chargeName(charge)
            return (
              <li
                key={charge.id}
                className="flex items-center justify-between gap-4 px-5 py-4 sm:px-6"
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-sm font-medium">{name}</span>
                  <PricingText
                    pricing={chargePricing(charge, undefined)}
                    period={BILLING_PERIOD_LABEL[charge.billingPeriod]}
                  />
                </div>
                <Switch
                  aria-label={`Also bill ${name}`}
                  checked={on}
                  onCheckedChange={(next) =>
                    onChange(
                      next ? [...optedIn, charge.id] : optedIn.filter((id) => id !== charge.id),
                    )
                  }
                />
              </li>
            )
          })}
        </ul>
      ) : null}
      {selection.excluded.length > 0 ? (
        <div className="text-muted-foreground border-t px-5 py-3 text-xs sm:px-6">
          Not billed on this contract:{' '}
          {selection.excluded
            .map(({ charge, reason }) => `${chargeName(charge)} (${why(reason)})`)
            .join(', ')}
          .
        </div>
      ) : null}
    </FormCard>
  )
}

/**
 * A usage charge's commitment, opened from that charge's menu and kept in the
 * charges list. Every option is shown at once — including true-up — so none
 * of them has to be discovered by filling in another field first.
 *
 * Only a single-phase contract can carry these — the API takes them on the
 * contract's charges, not on a phase's.
 */
function ChargeMinimum({
  priceId,
  name,
  commitment,
  error,
  onChange,
}: {
  priceId: string
  name: string
  commitment: ChargeCommitment | undefined
  error: string | undefined
  onChange: (next: Partial<ChargeCommitment> | null) => void
}) {
  const draft = commitment ?? {
    type: CommitmentType.Amount,
    value: '',
    overageFactor: '',
    trueUp: false,
  }
  return (
    <div className="flex flex-col gap-3 border-t border-dashed pt-3">
      <div className="flex items-center gap-2">
        <ScaleIcon aria-hidden className="text-primary size-4 shrink-0" />
        <span className="text-sm font-medium">Commitment</span>
      </div>
      <p className="text-muted-foreground text-xs">
        The least {name} bills. Usage past it is multiplied by the overage factor; 1 is the normal
        rate. True-up bills the shortfall when usage stays under it.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor={`commitment-type-${priceId}`} className="text-muted-foreground text-xs">
            Measured as
          </label>
          <OptionSelect
            id={`commitment-type-${priceId}`}
            value={draft.type}
            onValueChange={(type) => onChange({ type: type as CommitmentType })}
            options={[
              { value: CommitmentType.Amount, label: 'Spend' },
              { value: CommitmentType.Quantity, label: 'Units' },
            ]}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`commitment-value-${priceId}`} className="text-muted-foreground text-xs">
            Minimum
          </label>
          <Input
            id={`commitment-value-${priceId}`}
            inputMode="decimal"
            placeholder={draft.type === CommitmentType.Amount ? 'Amount' : 'Units'}
            value={draft.value}
            aria-invalid={error ? true : undefined}
            onChange={(event) => onChange({ value: event.target.value })}
          />
          {error ? (
            <p className="text-destructive text-xs" role="alert">
              {error}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`commitment-overage-${priceId}`} className="text-muted-foreground text-xs">
            Overage factor
          </label>
          <Input
            id={`commitment-overage-${priceId}`}
            inputMode="decimal"
            placeholder="1"
            value={draft.overageFactor}
            onChange={(event) => onChange({ overageFactor: event.target.value })}
          />
        </div>
        <label className="flex items-center gap-2 self-end pb-2 text-sm">
          <Switch
            aria-label={`True-up on ${name}`}
            checked={draft.trueUp}
            onCheckedChange={(trueUp) => onChange({ trueUp })}
          />
          True-up
        </label>
      </div>
    </div>
  )
}

/** A colored mark to the left of a section title, matching the charges table. */
function SectionTitle({
  icon: Icon,
  tone,
  children,
}: {
  icon: typeof ScaleIcon
  tone: string
  children: string
}) {
  return (
    <div className="flex items-center gap-2 px-5 pt-4 sm:px-6">
      <Icon aria-hidden className={`size-4 shrink-0 ${tone}`} />
      <h3 className="text-sm font-medium">{children}</h3>
    </div>
  )
}

/** The plan's charges in one phase, each of which can be repriced for that phase. */
function ChargeOverrides({
  charges,
  isLoading,
  overrides,
  onChange,
  quantities,
  onQuantities,
  phaseLabel,
  commitments,
  commitmentErrors,
  onCommitment,
}: {
  charges: Charge[]
  isLoading: boolean
  overrides: PriceOverride[]
  onChange: (next: PriceOverride[]) => void
  quantities: SubscriptionPhase['quantities']
  onQuantities: (next: SubscriptionPhase['quantities']) => void
  phaseLabel: string
  /** Present on a single-phase contract, where a usage charge can carry a minimum. */
  commitments?: ChargeCommitment[]
  commitmentErrors?: FieldErrors<CreateSubscription>['chargeCommitments']
  onCommitment?: (priceId: string, next: Partial<ChargeCommitment> | null) => void
}) {
  const quantityOf = (priceId: string) =>
    quantities.find((q) => q.priceId === priceId)?.quantity ?? ''
  const setQuantity = (priceId: string, quantity: string) =>
    onQuantities(
      quantity.trim() === ''
        ? quantities.filter((q) => q.priceId !== priceId)
        : [...quantities.filter((q) => q.priceId !== priceId), { priceId, quantity }],
    )
  const [editing, setEditing] = useState<string | null>(null)
  // Charges whose commitment options are open. A saved commitment stays open.
  const [configuring, setConfiguring] = useState<ReadonlySet<string>>(new Set())
  const byId = new Map(overrides.map((o) => [o.priceId, o]))
  const commitmentOf = new Map((commitments ?? []).map((c) => [c.priceId, c]))

  if (isLoading)
    return (
      <p className="text-muted-foreground px-5 py-4 text-sm sm:px-6">
        Loading the plan&apos;s charges…
      </p>
    )
  if (charges.length === 0)
    return (
      <p className="text-muted-foreground px-5 py-4 text-sm sm:px-6">
        This plan has no charges.
      </p>
    )

  return (
    <ul className="divide-y">
      {charges.map((charge) => {
        const override = byId.get(charge.id)
        const name = chargeName(charge)
        const commitment = commitmentOf.get(charge.id)
        const commitmentOpen =
          Boolean(onCommitment) &&
          charge.type === PriceType.Usage &&
          (configuring.has(charge.id) || Boolean(commitment))
        return (
          <li key={charge.id} className="flex flex-col gap-3 px-5 py-4 sm:px-6">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-sm font-medium">{name}</span>
                <PricingText
                  pricing={chargePricing(charge, override)}
                  period={BILLING_PERIOD_LABEL[charge.billingPeriod]}
                />
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {/* A fixed charge can be billed at another quantity, e.g. 25 seats. */}
                {charge.type === PriceType.Fixed ? (
                  <Input
                    aria-label={`Quantity of ${name} in ${phaseLabel}`}
                    inputMode="decimal"
                    placeholder="Qty 1"
                    className="h-8 w-20"
                    value={quantityOf(charge.id)}
                    onChange={(event) => setQuantity(charge.id, event.target.value)}
                  />
                ) : null}
                {override ? <Badge variant="info-light">Overridden</Badge> : null}
                {override && editing !== charge.id ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onChange(overrides.filter((o) => o.priceId !== charge.id))}
                  >
                    Remove
                  </Button>
                ) : null}
                {editing === charge.id ? (
                  <CloseSubForm
                    label={`Close override for ${name} in ${phaseLabel}`}
                    onClick={() => setEditing(null)}
                  />
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-label={`${override ? 'Edit' : 'Override'} ${name} in ${phaseLabel}`}
                    onClick={() => setEditing(charge.id)}
                  >
                    {override ? 'Edit' : 'Override'}
                  </Button>
                )}
                {onCommitment && charge.type === PriceType.Usage ? (
                  <RowActionsMenu
                    label={name}
                    extra={
                      commitmentOpen
                        ? [
                            {
                              label: 'Remove commitment',
                              onSelect: () => {
                                setConfiguring((current) => {
                                  const next = new Set(current)
                                  next.delete(charge.id)
                                  return next
                                })
                                onCommitment(charge.id, null)
                              },
                            },
                          ]
                        : [
                            {
                              label: 'Configure commitment',
                              onSelect: () =>
                                setConfiguring((current) => new Set(current).add(charge.id)),
                            },
                          ]
                    }
                  />
                ) : null}
              </div>
            </div>
            {editing === charge.id ? (
              <PriceOverrideForm
                priceId={charge.id}
                {...(override ? { defaultValue: override } : {})}
                onSubmit={(value) => {
                  onChange([...overrides.filter((o) => o.priceId !== charge.id), value])
                  setEditing(null)
                }}
              />
            ) : null}
            {commitmentOpen && onCommitment ? (
              <ChargeMinimum
                priceId={charge.id}
                name={name}
                commitment={commitment}
                error={
                  commitmentErrors?.[
                    (commitments ?? []).findIndex((c) => c.priceId === charge.id)
                  ]?.value?.message
                }
                onChange={(next) => onCommitment(charge.id, next)}
              />
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}

/**
 * Charges for this contract (or this phase) alone, beyond the plan's — added
 * with the same dialog a running contract uses.
 */
function ExtraCharges({
  charges,
  phaseLabel,
  onRemove,
  onAdd,
}: {
  charges: AddContractCharge[]
  phaseLabel: string
  onRemove: (index: number) => void
  onAdd: () => void
}) {
  return (
    <div className="flex flex-col gap-2 px-5 py-4 sm:px-6">
      {charges.map((extra, index) => (
        <div
          key={`${extra.charge.displayName ?? 'charge'}-${index}`}
          className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm"
        >
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-medium">
              {extra.charge.displayName || 'Contract charge'}
              {extra.charge.type === PriceType.Fixed && extra.quantity && extra.quantity !== '1'
                ? ` × ${extra.quantity}`
                : ''}
            </span>
            <span className="text-muted-foreground text-xs">{extraChargeSummary(extra)}</span>
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={`Remove ${extra.charge.displayName || 'contract charge'} from ${phaseLabel}`}
            onClick={() => onRemove(index)}
          >
            Remove
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-fit"
        aria-label={`Add a charge to ${phaseLabel}`}
        onClick={onAdd}
      >
        Add charge
      </Button>
      <p className="text-muted-foreground text-xs">
        A charge for this contract alone, on top of the plan&apos;s.
      </p>
    </div>
  )
}

/** "Usage · Monthly", or "Flat fee · $250.00 · One time". */
function extraChargeSummary(extra: AddContractCharge): string {
  const { charge } = extra
  const amount =
    'amount' in charge && charge.amount ? ` · ${money(charge.amount, charge.currency)}` : ''
  const kind = charge.type === PriceType.Usage ? 'Usage' : BILLING_MODEL_LABEL[charge.billingModel]
  return `${kind}${amount} · ${BILLING_PERIOD_LABEL[charge.billingPeriod]}`
}

/** A phase's discounts: coupons on the whole phase, or on one of its charges. */
function PhaseDiscounts({
  discounts,
  charges,
  coupons,
  phaseLabel,
  onChange,
}: {
  discounts: SubscriptionDiscount[]
  charges: Charge[]
  coupons: readonly Option[]
  phaseLabel: string
  onChange: (next: SubscriptionDiscount[]) => void
}) {
  const [couponId, setCouponId] = useState('')
  const [target, setTarget] = useState('all')
  const idBase = `discount-${phaseLabel.toLowerCase().replace(/\s+/g, '-')}`
  const couponName = (id: string) => coupons.find((c) => c.value === id)?.label ?? id
  const chargeLabel = (id: string) => {
    const charge = charges.find((c) => c.id === id)
    return charge ? chargeName(charge) : id
  }

  return (
    <div className="flex flex-col gap-3 px-5 py-4 sm:px-6">
      <div className="flex items-center gap-2">
        <TicketPercentIcon aria-hidden className="text-success-foreground size-4 shrink-0" />
        <h3 className="text-sm font-medium">Coupons</h3>
      </div>
      <p className="text-muted-foreground text-xs">
        Apply a coupon to this phase, or to one of its charges.
      </p>
      {discounts.length > 0 && (
        <ul className="flex flex-col gap-2">
          {discounts.map((discount, index) => (
            <li
              key={`${discount.couponId}-${discount.priceId ?? 'all'}-${index}`}
              className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm"
            >
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-medium">{couponName(discount.couponId)}</span>
                <span className="text-muted-foreground text-xs">
                  {discount.priceId ? `On ${chargeLabel(discount.priceId)}` : 'On the whole phase'}
                </span>
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onChange(discounts.filter((_, i) => i !== index))}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}
      {coupons.length === 0 ? (
        <p className="text-muted-foreground text-xs">
          No coupons yet. Create one under Product catalog → Coupons to discount a phase.
        </p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-start">
          <label htmlFor={`${idBase}-coupon`} className="sr-only">
            Coupon for {phaseLabel}
          </label>
          <OptionCombobox
            id={`${idBase}-coupon`}
            value={couponId}
            onValueChange={setCouponId}
            options={coupons}
            placeholder="Choose a coupon…"
          />
          <label htmlFor={`${idBase}-target`} className="sr-only">
            Discount applies to, in {phaseLabel}
          </label>
          <OptionSelect
            id={`${idBase}-target`}
            value={target}
            onValueChange={setTarget}
            options={[
              { value: 'all', label: 'The whole phase' },
              ...charges.map((charge) => ({ value: charge.id, label: chargeName(charge) })),
            ]}
          />
          <Button
            type="button"
            variant="outline"
            disabled={!couponId}
            onClick={() => {
              onChange([
                ...discounts,
                { couponId, ...(target === 'all' ? {} : { priceId: target }) },
              ])
              setCouponId('')
              setTarget('all')
            }}
          >
            Add discount
          </Button>
        </div>
      )}
    </div>
  )
}

/**
 * The phases of a contract, each a card with its dates, its charges and then
 * its discounts — and, after the last, the button that adds the next phase.
 * A phase starts where the one before it ends, so only ends are chosen.
 */
function PhasesStep({
  phases,
  starts,
  charges,
  isLoading,
  coupons,
  errors,
  onChange,
  commitments,
  commitmentErrors,
  onCommitments,
  currency,
  billingPeriod,
  meters,
  priceUnits,
}: {
  phases: SubscriptionPhase[]
  starts: string[]
  charges: Charge[]
  isLoading: boolean
  coupons: readonly Option[]
  errors: FieldErrors<CreateSubscription>['phases']
  onChange: (next: SubscriptionPhase[]) => void
  commitments: ChargeCommitment[]
  commitmentErrors: FieldErrors<CreateSubscription>['chargeCommitments']
  onCommitments: (next: ChargeCommitment[]) => void
  currency: string
  billingPeriod: CreateSubscription['billingPeriod']
  meters: MeterOption[]
  priceUnits: PriceUnitOption[]
}) {
  const update = (index: number, patch: Partial<SubscriptionPhase>) =>
    onChange(phases.map((phase, i) => (i === index ? { ...phase, ...patch } : phase)))
  const setCommitment = (priceId: string, change: Partial<ChargeCommitment> | null) => {
    const rest = commitments.filter((c) => c.priceId !== priceId)
    if (change === null) {
      onCommitments(rest)
      return
    }
    const current = commitments.find((c) => c.priceId === priceId) ?? {
      priceId,
      type: CommitmentType.Amount,
      value: '',
      overageFactor: '',
      trueUp: false,
    }
    onCommitments([...rest, { ...current, ...change }])
  }
  // Which phase the add-charge dialog adds to; null while it is closed.
  const [addingTo, setAddingTo] = useState<number | null>(null)
  // Phases folded away so a newly added one can take the page.
  const [collapsed, setCollapsed] = useState<ReadonlySet<number>>(new Set())
  const last = phases[phases.length - 1]
  const canAdd = Boolean(last?.endDate)
  const expand = (index: number) =>
    setCollapsed((current) => {
      const next = new Set(current)
      next.delete(index)
      return next
    })
  const shiftCollapsed = (removed: number) =>
    setCollapsed((current) => {
      const next = new Set<number>()
      for (const i of current) {
        if (i === removed) continue
        next.add(i > removed ? i - 1 : i)
      }
      return next
    })

  return (
    <div className="flex flex-col gap-5">
      {phases.map((phase, index) => {
        const label = `Phase ${index + 1}`
        const start = starts[index]
        const endError = errors?.[index]?.endDate?.message
        const quantityErrors = errors?.[index]?.quantities
        const quantityError = quantityErrors
          ? Object.values(quantityErrors as Record<string, { quantity?: { message?: string } }>)
              .map((row) => row?.quantity?.message)
              .find(Boolean)
          : undefined
        if (collapsed.has(index)) {
          const range = `${start ? formatDay(start) : 'Immediately'} – ${
            phase.endDate ? formatDay(phase.endDate) : 'until cancelled'
          }`
          return (
            <button
              key={index}
              type="button"
              onClick={() => expand(index)}
              className="bg-background hover:bg-muted/40 flex w-full items-center justify-between gap-4 rounded-xl border px-5 py-4 text-left sm:px-6"
            >
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-sm font-medium">{label}</span>
                <span className="text-muted-foreground text-xs">{range}</span>
              </span>
              <span className="text-muted-foreground shrink-0 text-xs">Edit</span>
            </button>
          )
        }
        return (
          <FormCard
            key={index}
            title={label}
            adornment={
              index > 0 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={`Remove ${label.toLowerCase()}`}
                  onClick={() => {
                    const next = phases.filter((_, i) => i !== index)
                    // The phase before now runs to where the removed one ended.
                    const before = next[index - 1]
                    if (before && index === phases.length - 1) {
                      next[index - 1] = { ...before, endDate: phase.endDate }
                    }
                    shiftCollapsed(index)
                    onChange(next)
                  }}
                >
                  Remove phase
                </Button>
              ) : undefined
            }
          >
            <FormRow
              label="Starts"
              hint={
                index === 0
                  ? 'The contract start date, from the previous step.'
                  : 'When the previous phase ends.'
              }
            >
              {() => (
                <p className="text-sm">{start ? formatDay(start) : 'Immediately'}</p>
              )}
            </FormRow>
            <FormRow
              label="Ends"
              hint={
                index === phases.length - 1
                  ? 'The contract end date. Leave empty to run until cancelled.'
                  : 'The next phase starts when this one ends.'
              }
              error={endError}
            >
              {({ id, ...field }) => (
                <DateInput
                  id={id}
                  {...field}
                  value={phase.endDate}
                  onValueChange={(endDate) => update(index, { endDate })}
                  placeholder={
                    index === phases.length - 1 ? 'Runs until cancelled' : 'Choose a date'
                  }
                />
              )}
            </FormRow>
            <div>
              <SectionTitle icon={PencilIcon} tone="text-info-foreground">
                Charges
              </SectionTitle>
              {phases.length > 1 &&
              charges.some((charge) => charge.type === PriceType.Usage) ? (
                <p className="text-muted-foreground px-5 pt-2 text-xs sm:px-6">
                  A commitment on an individual charge is kept for a contract with one phase.
                  Remove the extra phases to set one.
                </p>
              ) : null}
              <ChargeOverrides
                charges={charges}
                isLoading={isLoading}
                overrides={phase.priceOverrides}
                onChange={(priceOverrides) => update(index, { priceOverrides })}
                quantities={phase.quantities}
                onQuantities={(quantities) => update(index, { quantities })}
                phaseLabel={label}
                {...(phases.length === 1
                  ? {
                      commitments,
                      commitmentErrors,
                      onCommitment: setCommitment,
                    }
                  : {})}
              />
              {quantityError ? (
                <p className="text-destructive px-5 pb-3 text-xs sm:px-6" role="alert">
                  {quantityError}
                </p>
              ) : null}
              <ExtraCharges
                charges={phase.extraCharges}
                phaseLabel={label}
                onRemove={(at) =>
                  update(index, { extraCharges: phase.extraCharges.filter((_, i) => i !== at) })
                }
                onAdd={() => setAddingTo(index)}
              />
            </div>
            <PhaseDiscounts
              discounts={phase.discounts}
              charges={charges}
              coupons={coupons}
              phaseLabel={label}
              onChange={(discounts) => update(index, { discounts })}
            />
          </FormCard>
        )
      })}
      <ContractChargeDialog
        state={addingTo === null ? null : { mode: 'add' }}
        onClose={() => setAddingTo(null)}
        currency={currency}
        billingPeriod={billingPeriod}
        meters={meters}
        priceUnits={priceUnits}
        onAdd={(draft) => {
          if (addingTo === null) return
          const phase = phases[addingTo]
          if (phase) update(addingTo, { extraCharges: [...phase.extraCharges, draft] })
          setAddingTo(null)
        }}
        onEdit={() => undefined}
        onEnd={() => undefined}
      />
      <div className="flex flex-col items-start gap-1">
        <Button
          type="button"
          variant="outline"
          disabled={!canAdd}
          onClick={() => {
            setCollapsed(new Set(phases.map((_, i) => i)))
            onChange([...phases, emptyPhase()])
          }}
        >
          Add phase
        </Button>
        <p className="text-muted-foreground text-xs">
          {canAdd
            ? 'The next phase starts when this one ends, with its own charges and discounts.'
            : 'Give the last phase an end date to add another after it.'}
        </p>
      </div>
    </div>
  )
}

/** `YYYY-MM-DD` as "Oct 15, 2026". */
function formatDay(day: string): string {
  const date = new Date(`${day}T00:00:00`)
  return Number.isNaN(date.getTime())
    ? day
    : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function EntitlementsSection({
  entitlements,
  isLoading,
  overrides,
  onChange,
}: {
  entitlements: Entitlement[]
  isLoading: boolean
  overrides: CreateSubscription['entitlementOverrides']
  onChange: (next: CreateSubscription['entitlementOverrides']) => void
}) {
  if (isLoading)
    return <p className="text-muted-foreground text-sm">Loading the plan&apos;s entitlements…</p>
  const editable = entitlements.filter(
    (e) => e.featureType === FeatureType.Metered || e.featureType === FeatureType.Boolean,
  )

  const patch = (
    entitlementId: string,
    change: { usageLimit?: number | undefined; isEnabled?: boolean | undefined },
  ) => {
    const rest = overrides.filter((o) => o.entitlementId !== entitlementId)
    const current = overrides.find((o) => o.entitlementId === entitlementId)
    const merged = { entitlementId, ...current, ...change }
    const hasValue = merged.usageLimit !== undefined || merged.isEnabled !== undefined
    onChange(hasValue ? [...rest, merged] : rest)
  }

  return (
    <FormCard
      title="Entitlements"
      status="optional"
      icon={<KeyRoundIcon aria-hidden className="text-muted-foreground size-4 shrink-0" />}
    >
      {editable.length === 0 ? (
        <p className="text-muted-foreground px-5 py-4 text-sm sm:px-6">
          This plan has no metered or on/off entitlements to change.
        </p>
      ) : (
        <ul className="divide-y">
          {editable.map((entitlement) => {
            const override = overrides.find((o) => o.entitlementId === entitlement.id)
            const name = entitlement.featureName ?? entitlement.featureId
            return (
              <li
                key={entitlement.id}
                className="flex items-center justify-between gap-4 px-5 py-4 sm:px-6"
              >
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium">{name}</span>
                  <span className="text-muted-foreground text-xs">
                    {entitlement.featureType === FeatureType.Metered
                      ? `Plan limit: ${entitlement.usageLimit ?? 'unlimited'}`
                      : `Plan: ${entitlement.isEnabled ? 'on' : 'off'}`}
                  </span>
                </div>
                {entitlement.featureType === FeatureType.Metered ? (
                  <Input
                    type="number"
                    min={0}
                    aria-label={`${name} usage limit`}
                    placeholder="Plan default"
                    className="w-40"
                    value={override?.usageLimit ?? ''}
                    onChange={(event) =>
                      patch(entitlement.id, {
                        usageLimit:
                          event.target.value === '' ? undefined : Number(event.target.value),
                      })
                    }
                  />
                ) : (
                  <Switch
                    aria-label={`${name} enabled`}
                    checked={override?.isEnabled ?? entitlement.isEnabled ?? false}
                    onCheckedChange={(checked) =>
                      patch(entitlement.id, {
                        isEnabled:
                          checked === (entitlement.isEnabled ?? false) ? undefined : checked,
                      })
                    }
                  />
                )}
              </li>
            )
          })}
        </ul>
      )}
    </FormCard>
  )
}

/**
 * The contract's credit grants. They open as the plan's own, and each can be
 * edited or removed for this contract alone, or new ones added. The API uses
 * a changed list *instead of* the plan's, so the card says when that happens
 * and offers the way back.
 */
function CreditsSection({
  grants,
  changed,
  fromPlan,
  onChange,
  onReset,
}: {
  grants: CreateCreditGrant[]
  changed: boolean
  fromPlan: boolean
  onChange: (next: CreateCreditGrant[]) => void
  onReset: () => void
}) {
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<number | null>(null)

  return (
    <FormCard
      title="Credit grants"
      status="optional"
      icon={<CoinsIcon aria-hidden className="text-muted-foreground size-4 shrink-0" />}
      {...(fromPlan
        ? {
            adornment: changed ? (
              <Button type="button" variant="ghost" size="sm" onClick={onReset}>
                Use the plan&apos;s grants
              </Button>
            ) : (
              <Badge variant="secondary">From the plan</Badge>
            ),
          }
        : {})}
    >
      {fromPlan && changed ? (
        <p className="text-muted-foreground border-b px-5 py-3 text-xs sm:px-6">
          These grants replace the plan&apos;s on this contract.
        </p>
      ) : null}
      {grants.length > 0 ? (
        <ul className="divide-y">
          {grants.map((grant, index) => (
            <li key={`${grant.name}-${index}`} className="flex flex-col gap-3 px-5 py-4 sm:px-6">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium">{grant.name}</span>
                  <span className="text-muted-foreground text-xs">
                    {Number(grant.credits || 0).toLocaleString()} credits ·{' '}
                    {grantCadenceText(grant)} · {grantExpiryText(grant)}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {editing === index ? (
                    <CloseSubForm
                      label={`Close edit of ${grant.name}`}
                      onClick={() => setEditing(null)}
                    />
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label={`Edit ${grant.name}`}
                      onClick={() => setEditing(index)}
                    >
                      Edit
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={`Remove ${grant.name}`}
                    onClick={() => {
                      setEditing(null)
                      onChange(grants.filter((_, i) => i !== index))
                    }}
                  >
                    Remove
                  </Button>
                </div>
              </div>
              {editing === index ? (
                <CreditGrantCreateForm
                  defaultValue={grant}
                  submitLabel="Save grant"
                  onSubmit={(next) => {
                    onChange(grants.map((g, i) => (i === index ? next : g)))
                    setEditing(null)
                  }}
                />
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground px-5 py-4 text-sm sm:px-6">
          {fromPlan
            ? "All of the plan's grants are removed from this contract."
            : 'No credit grants.'}
        </p>
      )}
      <div className="border-t px-5 py-4 sm:px-6">
        {adding ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">Add credit grant</span>
              <CloseSubForm label="Close add credit grant" onClick={() => setAdding(false)} />
            </div>
            <CreditGrantCreateForm
              submitLabel="Add grant"
              onSubmit={(grant) => {
                onChange([...grants, grant])
                setAdding(false)
              }}
            />
          </div>
        ) : (
          <Button type="button" variant="outline" size="sm" onClick={() => setAdding(true)}>
            Add credit grant
          </Button>
        )}
      </div>
    </FormCard>
  )
}

/**
 * The contract-wide commitment, across every charge. A commitment on one
 * charge is edited beside that charge, on the phases step. Period, overage,
 * and true-up stay visible so they can be found before an amount is entered.
 */
function CommitmentsSection({
  values,
  errors,
  register,
  onDuration,
  onTrueUp,
}: {
  values: CreateSubscription
  errors: FieldErrors<CreateSubscription>
  register: UseFormRegister<CreateSubscription>
  onDuration: (value: CreateSubscription['commitmentDuration']) => void
  onTrueUp: (value: boolean) => void
}) {
  return (
    <FormCard
      title="Commitment"
      status="optional"
      icon={<ScaleIcon aria-hidden className="text-primary size-4 shrink-0" />}
    >
        <FormRow
          label="Minimum commitment"
          hint={`The least this contract bills per period, across every charge, in ${values.currency || 'the contract currency'}. A commitment on one charge is set beside that charge. Leave empty for none.`}
          error={errors.commitmentAmount?.message}
        >
          {({ id, ...field }) => (
            <Input
              id={id}
              inputMode="decimal"
              placeholder="No commitment"
              {...field}
              {...register('commitmentAmount')}
            />
          )}
        </FormRow>
        <FormRow
          label="Commitment period"
          hint="The period the commitment is measured over, e.g. annual on a monthly contract."
        >
          {({ id, ...field }) => (
            <OptionSelect
              id={id}
              {...field}
              value={values.commitmentDuration || 'billing'}
              onValueChange={(value) =>
                onDuration(
                  (value === 'billing' ? '' : value) as CreateSubscription['commitmentDuration'],
                )
              }
              options={[
                { value: 'billing', label: 'The billing period' },
                ...SUBSCRIPTION_BILLING_PERIODS.map((period) => ({
                  value: period,
                  label: BILLING_PERIOD_LABEL[period],
                })),
              ]}
            />
          )}
        </FormRow>
        <FormRow
          label="Overage factor"
          hint="Multiplier on usage beyond the commitment. 1 bills it at the normal rate."
          error={errors.overageFactor?.message}
        >
          {({ id, ...field }) => (
            <Input
              id={id}
              inputMode="decimal"
              placeholder="1"
              {...field}
              {...register('overageFactor')}
            />
          )}
        </FormRow>
        <FormRow label="True-up" hint="Bill the shortfall when spend stays under the commitment.">
          {({ id }) => (
            <Switch id={id} checked={values.enableTrueUp} onCheckedChange={onTrueUp} />
          )}
        </FormRow>
    </FormCard>
  )
}

/** The contract's tax rates: the customer's to start with, removable, and addable. */
function TaxesSection({
  taxes,
  taxRates,
  onChange,
}: {
  taxes: CreateSubscription['taxes']
  taxRates: readonly SubscriptionTaxRateOption[]
  onChange: (next: CreateSubscription['taxes']) => void
}) {
  const available = taxRates.filter((rate) => !taxes.some((tax) => tax.taxRateCode === rate.code))
  return (
    <FormCard
      title="Taxes"
      status="optional"
      icon={<ReceiptIcon aria-hidden className="text-muted-foreground size-4 shrink-0" />}
    >
      <div className="flex flex-col gap-2 px-5 py-4 sm:px-6">
        {taxes.length === 0 ? (
          <p className="text-muted-foreground text-sm">No taxes are applied to this contract.</p>
        ) : (
          taxes.map((tax) => (
            <div
              key={tax.taxRateCode}
              className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm"
            >
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-medium">
                  {tax.name || tax.taxRateCode}
                  {tax.percentage ? ` · ${tax.percentage}%` : ''}
                </span>
                <span className="text-muted-foreground text-xs">
                  {tax.taxRateCode} ·{' '}
                  {tax.taxBehavior === 'inclusive' ? 'Included in the price' : 'Added on top'}
                </span>
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={`Remove ${tax.name || tax.taxRateCode}`}
                onClick={() => onChange(taxes.filter((t) => t.taxRateCode !== tax.taxRateCode))}
              >
                Remove
              </Button>
            </div>
          ))
        )}
        {available.length > 0 ? (
          <div className="max-w-xs">
            <label htmlFor="contract-add-tax" className="sr-only">
              Add a tax rate
            </label>
            <OptionSelect
              id="contract-add-tax"
              value={undefined}
              placeholder="Add a tax rate"
              options={available.map((rate) => ({
                value: rate.code,
                label: `${rate.name}${rate.percentage ? ` (${rate.percentage}%)` : ''}`,
              }))}
              onValueChange={(code) => {
                const rate = available.find((r) => r.code === code)
                if (!rate) return
                onChange([
                  ...taxes,
                  {
                    taxRateCode: rate.code,
                    name: rate.name,
                    percentage: rate.percentage,
                    taxBehavior: 'exclusive',
                    priority: taxes.length + 1,
                    autoApply: true,
                  },
                ])
              }}
            />
          </div>
        ) : null}
      </div>
    </FormCard>
  )
}

/** Add-ons the contract starts with. */
function AddonsSection({
  selected,
  options,
  onChange,
}: {
  selected: CreateSubscription['addons']
  options: readonly Option[]
  onChange: (next: CreateSubscription['addons']) => void
}) {
  const available = options.filter((o) => !selected.some((a) => a.addonId === o.value))
  // A fresh picker after each pick, so its list closes and it reads empty again.
  const [pickerKey, setPickerKey] = useState(0)
  return (
    <FormCard
      title="Add-ons"
      status="optional"
      icon={<PuzzleIcon aria-hidden className="text-muted-foreground size-4 shrink-0" />}
    >
      <div className="flex flex-col gap-2 px-5 py-4 sm:px-6">
        {selected.length === 0 ? (
          <p className="text-muted-foreground text-sm">No add-ons. The plan alone is billed.</p>
        ) : (
          selected.map((addon) => (
            <div
              key={addon.addonId}
              className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm"
            >
              <span className="truncate font-medium">{addon.name || addon.addonId}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={`Remove ${addon.name || addon.addonId}`}
                onClick={() => onChange(selected.filter((a) => a.addonId !== addon.addonId))}
              >
                Remove
              </Button>
            </div>
          ))
        )}
        {options.length === 0 ? (
          <p className="text-muted-foreground text-xs">No add-ons exist yet.</p>
        ) : available.length > 0 ? (
          <div className="max-w-sm">
            <label htmlFor="contract-add-addon" className="sr-only">
              Add an add-on
            </label>
            <OptionCombobox
              key={pickerKey}
              id="contract-add-addon"
              value=""
              placeholder="Add an add-on…"
              options={available}
              onValueChange={(id) => {
                const option = available.find((o) => o.value === id)
                if (!option) return
                onChange([...selected, { addonId: option.value, name: option.label }])
                setPickerKey((n) => n + 1)
              }}
            />
          </div>
        ) : null}
      </div>
    </FormCard>
  )
}

/** How and when the contract invoices — the last thing V1 asks. */
function BillingStep({
  values,
  errors,
  register,
  isSubmitting,
  onChange,
}: {
  values: CreateSubscription
  errors: FieldErrors<CreateSubscription>
  register: UseFormRegister<CreateSubscription>
  isSubmitting: boolean
  onChange: <K extends keyof CreateSubscription>(name: K, value: CreateSubscription[K]) => void
}) {
  return (
    <FormCard
      title="Billing configuration"
      icon={<SlidersHorizontalIcon aria-hidden className="text-muted-foreground size-4 shrink-0" />}
    >
      <FormRow
        label="Billing cycle"
        hint="Anniversary bills on the day the contract started; calendar bills on the first of each period."
      >
        {({ id, ...field }) => (
          <OptionSelect
            id={id}
            {...field}
            value={values.billingCycle}
            onValueChange={(value) => onChange('billingCycle', value as BillingCycle)}
            options={[
              { value: BillingCycle.Anniversary, label: 'Anniversary' },
              { value: BillingCycle.Calendar, label: 'Calendar' },
            ]}
            disabled={isSubmitting}
          />
        )}
      </FormRow>
      <FormRow
        label="Billing anchor"
        hint="The day billing periods are counted from. Leave empty to follow the start date."
        error={errors.billingAnchor?.message}
      >
        {({ id, ...field }) => (
          <DateInput
            id={id}
            {...field}
            value={values.billingAnchor}
            onValueChange={(value) => onChange('billingAnchor', value)}
            placeholder="Follows the start date"
            disabled={isSubmitting}
          />
        )}
      </FormRow>
      <FormRow label="Payment terms" hint="How long the customer has to pay each invoice.">
        {({ id, ...field }) => (
          <OptionSelect
            id={id}
            {...field}
            value={values.paymentTerms || 'none'}
            onValueChange={(value) =>
              onChange(
                'paymentTerms',
                (value === 'none' ? '' : value) as CreateSubscription['paymentTerms'],
              )
            }
            options={[
              { value: 'none', label: 'Due on receipt' },
              ...Object.values(PaymentTerms).map((terms) => ({
                value: terms,
                label: PAYMENT_TERMS_LABEL[terms],
              })),
            ]}
            disabled={isSubmitting}
          />
        )}
      </FormRow>
      <FormRow label="Prorate" hint="Charge or credit the part of a period a change falls in.">
        {({ id }) => (
          <Switch
            id={id}
            checked={values.prorate}
            onCheckedChange={(prorate) => onChange('prorate', prorate)}
            disabled={isSubmitting}
          />
        )}
      </FormRow>
      <FormRow
        label="Auto-invoice threshold"
        hint="Invoice early once unbilled usage reaches this amount. Leave empty to invoice each period."
        error={errors.autoInvoiceThreshold?.message}
      >
        {({ id, ...field }) => (
          <Input
            id={id}
            inputMode="decimal"
            placeholder="Each period"
            disabled={isSubmitting}
            {...field}
            {...register('autoInvoiceThreshold')}
          />
        )}
      </FormRow>
      <FormRow
        label="Create as draft"
        hint="Save the contract without starting it, to activate later."
      >
        {({ id }) => (
          <Switch
            id={id}
            checked={values.draft}
            onCheckedChange={(draft) => onChange('draft', draft)}
            disabled={isSubmitting}
          />
        )}
      </FormRow>
    </FormCard>
  )
}

/**
 * Everything the contract will be, on one screen.
 *
 * The previous version summarised: it showed the overrides and said "As the
 * plan" for the rest, so checking what a customer would actually get meant
 * stepping back through the wizard. A review that sends you back to the form
 * is not a review.
 *
 * So each card now shows the full set in the same shape the step used — every
 * charge with how it prices, every entitlement with the value that will apply,
 * every grant with its cadence and expiry — and marks the ones that differ
 * from the plan rather than showing only those.
 */
function ReviewStep({
  values,
  customerLabel,
  planLabel,
  charges,
  entitlements,
  coupons,
  addons,
  showCustomer,
  onEdit,
}: {
  values: CreateSubscription
  customerLabel: string | undefined
  planLabel: string | undefined
  charges: Charge[]
  entitlements: Entitlement[]
  coupons: readonly Option[]
  addons: readonly Option[]
  showCustomer: boolean
  onEdit: (stepId: string) => void
}) {
  const starts = phaseStarts(values)
  const lastEnd = values.phases[values.phases.length - 1]?.endDate ?? ''
  const couponName = (id: string) => coupons.find((c) => c.value === id)?.label ?? id
  const chargeLabel = (id: string) => {
    const charge = charges.find((c) => c.id === id)
    return charge ? chargeName(charge) : id
  }
  const overrides = new Map((values.phases[0]?.priceOverrides ?? []).map((o) => [o.priceId, o]))
  const every =
    values.billingPeriodCount > 1
      ? `Every ${values.billingPeriodCount} × ${BILLING_PERIOD_LABEL[values.billingPeriod]}`
      : BILLING_PERIOD_LABEL[values.billingPeriod]
  const entitlementOverride = new Map(values.entitlementOverrides.map((o) => [o.entitlementId, o]))

  const overriddenCount = values.phases[0]?.priceOverrides.length ?? 0
  const changedEntitlements = values.entitlementOverrides.length

  return (
    <div className="flex flex-col gap-5">
      {showCustomer ? (
        <ReviewCard title="Customer" step="plan" onEdit={onEdit}>
          <ReviewRow label="Customer" value={customerLabel ?? '—'} />
        </ReviewCard>
      ) : null}

      <ReviewCard title="Plan" step="plan" onEdit={onEdit}>
        <ReviewRow label="Plan" value={planLabel ?? '—'} />
        <ReviewRow label="Currency" value={values.currency.toUpperCase() || '—'} />
        <ReviewRow label="Billing period" value={every} />
        <ReviewRow
          label="Starts"
          value={values.startDate ? formatDay(values.startDate) : 'Immediately'}
        />
        <ReviewRow label="Ends" value={lastEnd ? formatDay(lastEnd) : 'Runs until cancelled'} />
        <ReviewRow
          label="Trial"
          value={values.trialPeriodDays ? `${values.trialPeriodDays} days` : 'No trial'}
        />
      </ReviewCard>

      {/*
        Every charge, priced as it will bill — not just the overridden ones.
        A charge left at the plan's price says so, next to one that was
        changed, so the two are compared here rather than from memory.
      */}
      {values.phases.length > 1 ? (
        <ReviewCard title="Phases" step="phases" onEdit={onEdit} count={values.phases.length}>
          {values.phases.map((phase, index) => (
            <div
              key={index}
              className="flex items-start justify-between gap-4 px-5 py-3 text-sm sm:px-6"
            >
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="font-medium">Phase {index + 1}</span>
                <span className="text-muted-foreground text-xs">
                  {starts[index] ? formatDay(starts[index]) : 'From the start'} →{' '}
                  {phase.endDate ? formatDay(phase.endDate) : 'until cancelled'}
                </span>
              </div>
              <span className="text-muted-foreground text-right text-xs">
                {phase.extraCharges.length > 0 ? `${phase.extraCharges.length} added · ` : ''}
                {phase.priceOverrides.length} overridden · {phase.discounts.length}{' '}
                {phase.discounts.length === 1 ? 'discount' : 'discounts'}
              </span>
            </div>
          ))}
        </ReviewCard>
      ) : null}

      <ReviewCard
        title={values.phases.length > 1 ? 'Charges in phase 1' : 'Charges'}
        step="phases"
        onEdit={onEdit}
        count={charges.length}
        note={overriddenCount > 0 ? `${overriddenCount} overridden` : undefined}
      >
        {charges.length === 0 ? (
          <ReviewRow label="Charges" value="None" />
        ) : (
          charges.map((charge) => {
            const override = overrides.get(charge.id)
            const pricing = chargePricing(charge, override)
            const quantity = values.phases[0]?.quantities.find((q) => q.priceId === charge.id)
            const commitment = values.chargeCommitments.find((c) => c.priceId === charge.id)
            return (
              <div
                key={charge.id}
                className="flex items-start justify-between gap-4 px-5 py-3 text-sm sm:px-6"
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate font-medium">
                    {chargeName(charge)}
                    {quantity ? ` × ${quantity.quantity}` : ''}
                  </span>
                  <PricingText
                    pricing={pricing}
                    period={BILLING_PERIOD_LABEL[charge.billingPeriod]}
                  />
                  {/*
                    What it would have been. Shown only when overridden, which
                    is the only time the difference is the point.
                  */}
                  {pricing.overridden ? (
                    <span className="text-muted-foreground text-xs">
                      Plan price: <PlanPriceText charge={charge} />
                    </span>
                  ) : null}
                  {commitment ? (
                    <span className="text-muted-foreground text-xs">
                      Minimum{' '}
                      {commitment.type === CommitmentType.Amount
                        ? money(commitment.value, values.currency)
                        : `${commitment.value} units`}
                      {commitment.overageFactor ? ` · overage ×${commitment.overageFactor}` : ''}
                      {commitment.trueUp ? ' · true-up' : ''}
                    </span>
                  ) : null}
                </div>
                {pricing.overridden ? (
                  <Badge variant="info-light" className="shrink-0">
                    Overridden
                  </Badge>
                ) : (
                  <span className="text-muted-foreground shrink-0 text-xs">As the plan</span>
                )}
              </div>
            )
          })
        )}
      </ReviewCard>

      {/*
        Every entitlement the plan grants, at the value this contract will
        use. Listing only the changed ones meant the answer to "what does this
        customer get?" was not on the review page at all.
      */}
      {values.phases.some((phase) => phase.extraCharges.length > 0) ? (
        <ReviewCard
          title="Charges for this contract"
          step="phases"
          onEdit={onEdit}
          count={values.phases.reduce((n, phase) => n + phase.extraCharges.length, 0)}
        >
          {values.phases.flatMap((phase, index) =>
            phase.extraCharges.map((extra, i) => (
              <ReviewRow
                key={`${index}-${i}`}
                label={`${values.phases.length > 1 ? `Phase ${index + 1} · ` : ''}${
                  extra.charge.displayName || 'Contract charge'
                }`}
                value={extraChargeSummary(extra)}
              />
            )),
          )}
        </ReviewCard>
      ) : null}

      <ReviewCard
        title="Coupons"
        step="phases"
        onEdit={onEdit}
        count={values.phases.reduce((n, phase) => n + phase.discounts.length, 0)}
      >
        {values.phases.every((phase) => phase.discounts.length === 0) ? (
          <ReviewRow label="Coupons" value="None" />
        ) : (
          values.phases.flatMap((phase, index) =>
            phase.discounts.map((discount, i) => (
              <ReviewRow
                key={`${index}-${i}`}
                label={`${values.phases.length > 1 ? `Phase ${index + 1} · ` : ''}${couponName(discount.couponId)}`}
                value={discount.priceId ? `On ${chargeLabel(discount.priceId)}` : 'Whole phase'}
              />
            )),
          )
        )}
      </ReviewCard>

      <ReviewCard title="Commitments" step="commitments" onEdit={onEdit}>
        <ReviewRow
          label="Minimum commitment"
          value={
            values.commitmentAmount
              ? `${money(values.commitmentAmount, values.currency)} per ${
                  values.commitmentDuration
                    ? BILLING_PERIOD_LABEL[values.commitmentDuration].toLowerCase()
                    : 'billing period'
                }${values.overageFactor ? ` · overage ×${values.overageFactor}` : ''}${
                  values.enableTrueUp ? ' · true-up' : ''
                }`
              : 'None'
          }
        />
      </ReviewCard>

      <ReviewCard
        title="Entitlements"
        step="commitments"
        onEdit={onEdit}
        count={entitlements.length}
        note={changedEntitlements > 0 ? `${changedEntitlements} changed` : undefined}
      >
        {entitlements.length === 0 ? (
          <ReviewRow label="Entitlements" value="This plan grants none" />
        ) : (
          entitlements.map((entitlement) => {
            const override = entitlementOverride.get(entitlement.id)
            const changed = override !== undefined
            return (
              <div
                key={entitlement.id}
                className="flex items-start justify-between gap-4 px-5 py-3 text-sm sm:px-6"
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate font-medium">
                    {entitlement.featureName ?? entitlement.featureId}
                  </span>
                  {changed ? (
                    <span className="text-muted-foreground text-xs">
                      Plan: {planEntitlementValue(entitlement)}
                    </span>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="font-medium">
                    {effectiveEntitlementValue(entitlement, override)}
                  </span>
                  {changed ? <Badge variant="info-light">Changed</Badge> : null}
                </div>
              </div>
            )
          })
        )}
      </ReviewCard>

      <ReviewCard
        title="Credit grants"
        step="commitments"
        onEdit={onEdit}
        count={values.creditGrants.length}
      >
        {values.creditGrants.length === 0 ? (
          <ReviewRow label="Credit grants" value="None" />
        ) : (
          values.creditGrants.map((grant, index) => (
            <div
              key={`${grant.name}-${index}`}
              className="flex items-start justify-between gap-4 px-5 py-3 text-sm sm:px-6"
            >
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate font-medium">{grant.name}</span>
                <span className="text-muted-foreground text-xs">{grantCadenceText(grant)}</span>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-0.5">
                <span className="font-medium tabular-nums">
                  {Number(grant.credits || 0).toLocaleString()} credits
                </span>
                <span className="text-muted-foreground text-xs">{grantExpiryText(grant)}</span>
              </div>
            </div>
          ))
        )}
      </ReviewCard>

      <ReviewCard title="Taxes" step="commitments" onEdit={onEdit} count={values.taxes.length}>
        {values.taxes.length === 0 ? (
          <ReviewRow label="Taxes" value="None" />
        ) : (
          values.taxes.map((tax) => (
            <ReviewRow
              key={tax.taxRateCode}
              label={tax.name || tax.taxRateCode}
              value={tax.percentage ? `${tax.percentage}%` : tax.taxRateCode}
            />
          ))
        )}
      </ReviewCard>

      <ReviewCard title="Add-ons" step="commitments" onEdit={onEdit} count={values.addons.length}>
        {values.addons.length === 0 ? (
          <ReviewRow label="Add-ons" value="None" />
        ) : (
          values.addons.map((addon) => (
            <ReviewRow
              key={addon.addonId}
              label={
                addon.name || addons.find((a) => a.value === addon.addonId)?.label || addon.addonId
              }
              value="Starts with the contract"
            />
          ))
        )}
      </ReviewCard>

      <ReviewCard title="Billing" step="billing" onEdit={onEdit}>
        <ReviewRow
          label="Billing cycle"
          value={values.billingCycle === BillingCycle.Calendar ? 'Calendar' : 'Anniversary'}
        />
        <ReviewRow
          label="Billing anchor"
          value={values.billingAnchor ? formatDay(values.billingAnchor) : 'Follows the start date'}
        />
        <ReviewRow
          label="Payment terms"
          value={values.paymentTerms ? PAYMENT_TERMS_LABEL[values.paymentTerms] : 'Due on receipt'}
        />
        <ReviewRow label="Prorate" value={values.prorate ? 'Yes' : 'No'} />
        <ReviewRow
          label="Auto-invoice threshold"
          value={
            values.autoInvoiceThreshold
              ? money(values.autoInvoiceThreshold, values.currency)
              : 'Each period'
          }
        />
        <ReviewRow label="Status on creation" value={values.draft ? 'Draft' : 'Active'} />
      </ReviewCard>
    </div>
  )
}

/** The plan's own price for a charge, ignoring any override on it. */
function PlanPriceText({ charge }: { charge: Charge }) {
  return (
    <PricingText
      pricing={chargePricing(charge, undefined)}
      period={BILLING_PERIOD_LABEL[charge.billingPeriod]}
    />
  )
}

/** What the plan grants, in words. */
function planEntitlementValue(entitlement: Entitlement): string {
  switch (entitlement.featureType) {
    case FeatureType.Metered:
      return entitlement.usageLimit == null
        ? 'Unlimited'
        : entitlement.usageLimit.toLocaleString('en-US')
    case FeatureType.Static:
      return entitlement.staticValue || '—'
    default:
      return entitlement.isEnabled ? 'On' : 'Off'
  }
}

/** What this contract will grant: the override where there is one, else the plan's. */
function effectiveEntitlementValue(
  entitlement: Entitlement,
  override: CreateSubscription['entitlementOverrides'][number] | undefined,
): string {
  if (override?.usageLimit !== undefined) return override.usageLimit.toLocaleString('en-US')
  if (override?.isEnabled !== undefined) return override.isEnabled ? 'On' : 'Off'
  return planEntitlementValue(entitlement)
}

/** "Every month", "Every 3 × month", or "Once". */
function grantCadenceText(grant: CreateSubscription['creditGrants'][number]): string {
  if (grant.cadence !== CreditGrantCadence.Recurring || !grant.period) {
    return CREDIT_GRANT_CADENCE_LABEL[grant.cadence]
  }
  const period = CREDIT_GRANT_PERIOD_LABEL[grant.period]
  return grant.periodCount && grant.periodCount > 1
    ? `Every ${grant.periodCount} × ${period.toLowerCase()}`
    : `Every ${period.toLowerCase()}`
}

/** "Never expires", "Expires with the billing cycle", or "Expires after 30 days". */
function grantExpiryText(grant: CreateSubscription['creditGrants'][number]): string {
  if (
    grant.expirationType === CreditGrantExpiryType.Duration &&
    grant.expirationDuration &&
    grant.expirationDurationUnit
  ) {
    const unit = CREDIT_GRANT_EXPIRY_DURATION_UNIT_LABEL[grant.expirationDurationUnit].toLowerCase()
    return `Expires after ${grant.expirationDuration} ${unit}${grant.expirationDuration === 1 ? '' : 's'}`
  }
  return CREDIT_GRANT_EXPIRY_TYPE_LABEL[grant.expirationType]
}

function ReviewCard({
  title,
  step,
  onEdit,
  count,
  note,
  children,
}: {
  title: string
  step: string
  onEdit: (stepId: string) => void
  /** How many rows the card holds, beside its title. */
  count?: number
  /** A short qualifier, e.g. "2 overridden". */
  note?: string | undefined
  children: ReactNode
}) {
  return (
    <FormCard
      title={count === undefined ? title : `${title} (${count})`}
      {...(note ? { adornment: <Badge variant="info-light">{note}</Badge> } : {})}
    >
      <div className="divide-y">{children}</div>
      <div className="border-t px-5 py-2 sm:px-6">
        <Button
          type="button"
          variant="link"
          size="sm"
          className="px-0"
          aria-label={`Edit ${title.toLowerCase()}`}
          onClick={() => onEdit(step)}
        >
          Edit
        </Button>
      </div>
    </FormCard>
  )
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-3 text-sm sm:px-6">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  )
}
