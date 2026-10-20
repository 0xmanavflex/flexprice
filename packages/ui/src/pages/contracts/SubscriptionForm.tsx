import { useCalmForm } from '@ui/compositions/forms/useCalmForm'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Controller, type FieldErrors, type Resolver, type UseFormRegister } from 'react-hook-form'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import {
  CoinsIcon,
  KeyRoundIcon,
  PencilIcon,
  PlusIcon,
  PuzzleIcon,
  ReceiptIcon,
  ScaleIcon,
  Settings2Icon,
  UsersIcon,
  WalletIcon,
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
  FEATURE_TYPE_LABEL,
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
  USAGE_RESET_PERIOD_LABEL,
  createSubscriptionSchema,
  emptySubscription,
  currencyCodes,
} from '@fp/domain'
import { Badge } from '@ui/components/reui/badge'
import { Button } from '@ui/components/primitives/button'
import { Input } from '@ui/components/primitives/input'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@ui/components/primitives/input-group'
import { Switch } from '@ui/components/primitives/switch'
import type { DetailCrumb } from '@ui/compositions/detail/DetailShell'
import { ChoiceCards, SimpleTable, type SimpleColumn } from '@ui/compositions/detail/DetailKit'
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
import {
  ContractSummary,
  everyPeriod,
  firstInvoiceEstimate,
  formatDay,
  localToday,
  moneyText,
} from './ContractSummary'
import { provenance } from '@ui/provenance'

/**
 * Create a contract (subscription), in five steps:
 *
 * 1. **Customer & plan** — the customer, then the plan, its billing period and
 *    currency, the day it bills on, and a free trial.
 * 2. **Phases & charges** — the contract timeline: each phase's dates, its
 *    charges as a table (quantity inline, price override and commitment from
 *    the row), and its discounts. A dashed button adds the next phase.
 * 3. **Add-ons & benefits** — add-ons, the contract-wide commitment, the
 *    plan's entitlements, credit grants and taxes.
 * 4. **Billing** — payment terms, who pays (this customer, another one, and
 *    customers that inherit the contract), and the remaining settings.
 * 5. **Review** — one card per step, each with its Edit, and the first invoice.
 *
 * Steps 1–4 carry a Summary rail and an estimate of the first invoice
 * (`ContractSummary`); the review is the summary, so it drops the rail.
 *
 * One react-hook-form draft over the domain schema, walked by `useFormSteps`.
 * The toolbar carries the title, the stepper, Previous / Next and, on the last
 * step, Create.
 *
 * The form never fetches: the page hands it the customers and plans to choose
 * from and, once a plan is chosen (reported through `onPlanChange`), that
 * plan's charges and entitlements. `customerLocked` drops the Customer card
 * when the form is opened from a customer's own page. Currency defaults to the
 * customer's own currency when the customer option carries one, else to the
 * plan's when it bills in only one.
 */
export const SubscriptionFormProvenance = provenance({
  source: 'composition',
  composes: [
    'compositions/form-page',
    'compositions/form-card',
    'compositions/option-combobox',
    'compositions/date-input',
    'compositions/detail-kit',
    'pages/contract-summary',
    'pages/price-override-form',
    'pages/credit-grant-form',
  ],
  note: 'RHF + the domain schema, five steps with Previous/Next and the stepper in the toolbar, and a Summary / First invoice rail on steps 1–4 (ChoiceCards and SimpleTable from the detail kit); sub-forms (price override, credit grant) sit outside the form element.',
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
  /** Needed to bill another customer or let one inherit the contract (the API takes external ids). */
  externalId?: string | undefined
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
  /** Today, as `YYYY-MM-DD`; injectable so stories and tests read the same dates. */
  today?: string
}

const FORM_ID = 'subscription-form'

const FALLBACK_CURRENCIES = currencyCodes()

/**
 * Step ids are URL-safe and mirrored by the console's route
 * (`app/subscriptionSteps.ts`). The ids predate the titles: `commitments` is
 * "Add-ons & benefits", kept so links already shared still land.
 *
 * Customer and plan are **one** step: the customer decides the currency, the
 * plan decides the billing periods on offer, and picking them a page apart
 * hides that from the person making the choice. The plan card stays hidden
 * until a customer is chosen, so the step opens as one question.
 */
export const SUBSCRIPTION_FORM_STEPS = [
  { id: 'plan', title: 'Customer & plan' },
  { id: 'phases', title: 'Phases & charges' },
  { id: 'commitments', title: 'Add-ons & benefits' },
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
  phases: ['startDate', 'phases', 'chargeCommitments'],
  commitments: ['commitmentAmount', 'overageFactor'],
  billing: ['billingAnchor', 'autoInvoiceThreshold'],
}

const unique = <T,>(values: T[]) => [...new Set(values)]

/** Calendar billing in words: "The 1st of every month", "The start of every calendar year". */
function calendarTitle(period: string): string {
  return period === 'MONTHLY'
    ? 'The 1st of every month'
    : `The start of ${everyPeriod(period, 1).replace('every', 'every calendar')}`
}

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
  today = localToday(),
}: SubscriptionFormProps) {
  const form = useCalmForm<CreateSubscription>({
    resolver: standardSchemaResolver(createSubscriptionSchema) as Resolver<CreateSubscription>,
    defaultValues: { ...emptySubscription(), ...defaultValue },
  })
  const errors = form.formState.errors
  const values = form.watch()

  // Opened from a customer's own page there is no customer to choose, so the
  // first step is about the plan alone and says so.
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
  const trialDays = values.trialPeriodDays ?? 0

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
            className="w-32"
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
      <FormRow
        label="Bill on"
        hint="The day each invoice falls on: the contract's own start date, or the 1st of each month."
        align="start"
      >
        <ChoiceCards
          label="Bill on"
          value={values.billingCycle}
          onChange={(cycle) => set('billingCycle', cycle)}
          choices={[
            {
              value: BillingCycle.Anniversary,
              title: 'The contract start date',
              description: `Invoices fall on the same day ${everyPeriod(values.billingPeriod, 1).replace('every', 'each')} as the start date.`,
            },
            {
              value: BillingCycle.Calendar,
              title: calendarTitle(values.billingPeriod),
              description: 'The first invoice covers the days up to then, prorated.',
            },
          ]}
        />
      </FormRow>
      <FormRow
        label="Free trial"
        hint="Optional. Billing starts after the trial."
        error={errors.trialPeriodDays?.message}
        align="start"
      >
        {({ id, ...field }) => (
          <div className="flex flex-col gap-1.5">
            <InputGroup className="h-9 w-40">
              <InputGroupInput
                id={id}
                type="number"
                min={0}
                placeholder="0"
                disabled={isSubmitting}
                {...field}
                {...form.register('trialPeriodDays', {
                  setValueAs: (raw) => (raw === '' || raw == null ? undefined : Number(raw)),
                })}
              />
              <InputGroupAddon align="inline-end">days</InputGroupAddon>
            </InputGroup>
            <p className="text-muted-foreground text-xs">
              {trialDays > 0
                ? `Billing starts ${trialDays} ${trialDays === 1 ? 'day' : 'days'} after the contract starts. You set the start date in the next step.`
                : 'Leave empty to bill from the start date, which you set in the next step.'}
            </p>
          </div>
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
    // One form element around both cards: they are one step, and a second
    // <form> would break Enter-to-advance and the toolbar's submit.
    plan: formEl(
      <>
        {customerLocked ? null : customerStep}
        {customerLocked || values.customerId ? planCard : null}
      </>,
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
          startDate={values.startDate}
          onStartDate={(value) =>
            form.setValue('startDate', value, { shouldDirty: true, shouldValidate: true })
          }
          startError={errors.startDate?.message}
          today={today}
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
        <AddonsSection
          selected={values.addons}
          options={addons}
          onChange={(next) => set('addons', next)}
        />
        <CommitmentsSection
          values={values}
          errors={errors}
          register={form.register}
          onDuration={(value) => set('commitmentDuration', value)}
          onTrueUp={(value) => set('enableTrueUp', value)}
        />
        {values.planId ? (
          <EntitlementsSection
            planLabel={planLabel}
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
      </div>
    ),
    billing: formEl(
      <BillingStep
        values={values}
        errors={errors}
        register={form.register}
        isSubmitting={isSubmitting}
        customers={customers}
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
        customers={customers}
        showCustomer={!customerLocked}
        today={today}
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
        showTitle: true,
      }}
      stepper={{ flow, label: 'Contract steps' }}
      preview={
        flow.step === 'review' ? undefined : (
          <ContractSummary
            values={values}
            customerLabel={customer?.label}
            planLabel={planLabel}
            charges={charges}
            today={today}
          />
        )
      }
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
          <label
            htmlFor={`commitment-overage-${priceId}`}
            className="text-muted-foreground text-xs"
          >
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

/* ------------------------------------------------------------------------- */
/* Shared pieces                                                             */
/* ------------------------------------------------------------------------- */

/** A titled block inside a card: heading, a muted line, and an action on the right. */
function SubSection({
  title,
  description,
  action,
  children,
}: {
  title: string
  description?: string
  action?: ReactNode
  children?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 px-5 py-4 sm:px-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 className="text-sm font-medium">{title}</h3>
          {description ? <p className="text-muted-foreground text-xs">{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}

/** The bordered frame a table or an empty list sits in, inside a card. */
function Frame({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-lg border">
      {children}
      {footer ? <div className="border-t px-4 py-2">{footer}</div> : null}
    </div>
  )
}

/** The muted, centred line an empty list shows. */
function EmptyLine({ children }: { children: ReactNode }) {
  return <p className="text-muted-foreground px-4 py-6 text-center text-sm">{children}</p>
}

/** "+ Add …", the quiet button that opens a picker or a sub-form. */
function AddButton({
  children,
  onClick,
  disabled,
  label,
}: {
  children: string
  onClick: () => void
  disabled?: boolean
  label?: string
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="text-muted-foreground hover:text-foreground -ml-2 w-fit"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
    >
      <PlusIcon data-icon="inline-start" aria-hidden />
      {children}
    </Button>
  )
}

/** A charge's kind and model, e.g. "Fixed · Flat fee" or "Usage · Volume tiered". */
function chargeKind(charge: Charge): string {
  const kind = charge.type === PriceType.Usage ? 'Usage' : 'Fixed'
  if (charge.billingModel === BillingModel.Tiered) {
    const mode = charge.tierMode === TierMode.Slab ? 'Slab' : 'Volume'
    return `${kind} · ${mode} tiered`
  }
  return `${kind} · ${BILLING_MODEL_LABEL[charge.billingModel] ?? charge.billingModel}`
}

/** The price cell: the amount, or the tiers in brief. An override wins. */
function priceText(charge: Charge, override: PriceOverride | undefined): string {
  const tiers =
    override?.billingModel === BillingModel.Tiered
      ? override.tiers
      : !override && charge.billingModel === BillingModel.Tiered
        ? charge.tiers
        : null
  if (tiers && tiers.length > 0) {
    const lowest = Math.min(
      ...tiers.map((tier) => Number(tier.unitAmount)).filter((n) => Number.isFinite(n)),
    )
    return `${tiers.length} ${tiers.length === 1 ? 'tier' : 'tiers'}${
      Number.isFinite(lowest) ? `, from ${money(String(lowest), charge.currency)} per unit` : ''
    }`
  }
  return chargePricing(charge, override).summary.replace(/^[^·]+· /, '')
}

/* ------------------------------------------------------------------------- */
/* Phases & charges                                                          */
/* ------------------------------------------------------------------------- */

type ChargeRow =
  | { id: string; kind: 'plan'; charge: Charge }
  | { id: string; kind: 'extra'; extra: AddContractCharge; index: number }

/**
 * A phase's charges as a table: the plan's, then any added to this contract
 * alone. A fixed charge's quantity is edited in its row; the pencil reprices
 * it for this phase; the row menu holds the rest (a usage charge's
 * commitment, a coupon on just that charge).
 */
function ChargesTable({
  charges,
  extraCharges,
  isLoading,
  overrides,
  onChange,
  quantities,
  onQuantities,
  phaseLabel,
  commitments,
  commitmentErrors,
  onCommitment,
  onRemoveExtra,
  onCouponFor,
}: {
  charges: Charge[]
  extraCharges: AddContractCharge[]
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
  onRemoveExtra: (index: number) => void
  onCouponFor?: (priceId: string) => void
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

  if (isLoading) return <EmptyLine>Loading the plan&apos;s charges…</EmptyLine>

  const rows: ChargeRow[] = [
    ...charges.map((charge) => ({ id: charge.id, kind: 'plan' as const, charge })),
    ...extraCharges.map((extra, index) => ({
      id: `extra-${index}`,
      kind: 'extra' as const,
      extra,
      index,
    })),
  ]
  if (rows.length === 0)
    return (
      <Frame>
        <EmptyLine>This plan has no charges.</EmptyLine>
      </Frame>
    )

  const openCommitments = charges.filter(
    (charge) =>
      Boolean(onCommitment) &&
      charge.type === PriceType.Usage &&
      (configuring.has(charge.id) || commitmentOf.has(charge.id)),
  )
  const editingCharge = charges.find((charge) => charge.id === editing)

  const columns: SimpleColumn<ChargeRow>[] = [
    {
      key: 'charge',
      header: 'Charge',
      className: 'whitespace-normal',
      cell: (row) =>
        row.kind === 'plan' ? (
          <span className="flex min-w-0 flex-col gap-0.5 py-2">
            <span className="font-medium">{chargeName(row.charge)}</span>
            <span className="text-muted-foreground text-xs">{chargeKind(row.charge)}</span>
          </span>
        ) : (
          <span className="flex min-w-0 flex-col gap-0.5 py-2">
            <span className="font-medium">{row.extra.charge.displayName || 'Contract charge'}</span>
            <span className="text-muted-foreground text-xs">
              {extraChargeSummary(row.extra)} · This contract only
            </span>
          </span>
        ),
    },
    {
      key: 'price',
      header: 'Price',
      className: 'whitespace-normal',
      cell: (row) =>
        row.kind === 'plan' ? (
          <span className="flex flex-wrap items-center gap-2 tabular-nums">
            {priceText(row.charge, byId.get(row.charge.id))}
            {byId.has(row.charge.id) ? (
              <Badge variant="info-light" size="sm">
                Overridden
              </Badge>
            ) : null}
          </span>
        ) : (
          <span className="tabular-nums">
            {'amount' in row.extra.charge && row.extra.charge.amount
              ? money(row.extra.charge.amount, row.extra.charge.currency)
              : '—'}
          </span>
        ),
    },
    {
      key: 'quantity',
      header: 'Quantity',
      cell: (row) =>
        row.kind === 'plan' ? (
          row.charge.type === PriceType.Fixed ? (
            <Input
              aria-label={`Quantity of ${chargeName(row.charge)} in ${phaseLabel}`}
              inputMode="decimal"
              placeholder="1"
              className="h-8 w-20"
              value={quantityOf(row.charge.id)}
              onChange={(event) => setQuantity(row.charge.id, event.target.value)}
            />
          ) : (
            <span className="text-muted-foreground">Pay as you go</span>
          )
        ) : (
          <span className="tabular-nums">
            {row.extra.charge.type === PriceType.Fixed
              ? row.extra.quantity || '1'
              : 'Pay as you go'}
          </span>
        ),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-0 text-right',
      cell: (row) => {
        if (row.kind === 'extra') {
          const name = row.extra.charge.displayName || 'contract charge'
          return (
            <RowActionsMenu
              label={name}
              removeLabel={`Remove ${name} from ${phaseLabel}`}
              onRemove={() => onRemoveExtra(row.index)}
            />
          )
        }
        const { charge } = row
        const name = chargeName(charge)
        const override = byId.get(charge.id)
        const commitmentOpen =
          Boolean(onCommitment) &&
          charge.type === PriceType.Usage &&
          (configuring.has(charge.id) || commitmentOf.has(charge.id))
        const extra = [
          ...(override
            ? [
                {
                  label: 'Use the plan price',
                  onSelect: () => onChange(overrides.filter((o) => o.priceId !== charge.id)),
                },
              ]
            : []),
          ...(onCommitment && charge.type === PriceType.Usage
            ? [
                commitmentOpen
                  ? {
                      label: 'Remove commitment',
                      onSelect: () => {
                        setConfiguring((current) => {
                          const next = new Set(current)
                          next.delete(charge.id)
                          return next
                        })
                        onCommitment(charge.id, null)
                      },
                    }
                  : {
                      label: 'Configure commitment',
                      onSelect: () => setConfiguring((current) => new Set(current).add(charge.id)),
                    },
              ]
            : []),
          ...(onCouponFor
            ? [{ label: 'Apply a coupon', onSelect: () => onCouponFor(charge.id) }]
            : []),
        ]
        return (
          <span className="flex items-center justify-end gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`${override ? 'Edit' : 'Override'} ${name} in ${phaseLabel}`}
              aria-pressed={editing === charge.id}
              onClick={() => setEditing(editing === charge.id ? null : charge.id)}
            >
              <PencilIcon aria-hidden />
            </Button>
            {extra.length > 0 ? <RowActionsMenu label={name} extra={extra} /> : null}
          </span>
        )
      },
    },
  ]

  return (
    <div className="flex flex-col gap-3">
      <Frame>
        <SimpleTable columns={columns} rows={rows} getRowId={(row) => row.id} />
      </Frame>
      {editingCharge ? (
        <div className="flex flex-col gap-3 rounded-lg border p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium">
              Price for {chargeName(editingCharge)} in {phaseLabel}
            </span>
            <CloseSubForm
              label={`Close override for ${chargeName(editingCharge)} in ${phaseLabel}`}
              onClick={() => setEditing(null)}
            />
          </div>
          <p className="text-muted-foreground text-xs">
            Plan price: <PlanPriceText charge={editingCharge} />
          </p>
          <PriceOverrideForm
            priceId={editingCharge.id}
            {...(byId.get(editingCharge.id) ? { defaultValue: byId.get(editingCharge.id)! } : {})}
            onSubmit={(value) => {
              onChange([...overrides.filter((o) => o.priceId !== editingCharge.id), value])
              setEditing(null)
            }}
          />
        </div>
      ) : null}
      {onCommitment
        ? openCommitments.map((charge) => (
            <div key={charge.id} className="rounded-lg border px-4 pb-4">
              <ChargeMinimum
                priceId={charge.id}
                name={chargeName(charge)}
                commitment={commitmentOf.get(charge.id)}
                error={
                  commitmentErrors?.[(commitments ?? []).findIndex((c) => c.priceId === charge.id)]
                    ?.value?.message
                }
                onChange={(next) => onCommitment(charge.id, next)}
              />
            </div>
          ))
        : null}
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

/**
 * A phase's discounts: coupons on the whole phase, listed, and a picker that
 * opens from "Add coupon" — or from a charge's menu, aimed at that charge.
 */
function PhaseDiscounts({
  discounts,
  charges,
  coupons,
  phaseLabel,
  picking,
  onPicking,
  onChange,
}: {
  discounts: SubscriptionDiscount[]
  charges: Charge[]
  coupons: readonly Option[]
  phaseLabel: string
  /** The target the picker is open for (`all`, or a charge id), or null while closed. */
  picking: string | null
  onPicking: (target: string | null) => void
  onChange: (next: SubscriptionDiscount[]) => void
}) {
  const [couponId, setCouponId] = useState('')
  const idBase = `discount-${phaseLabel.toLowerCase().replace(/\s+/g, '-')}`
  const couponName = (id: string) => coupons.find((c) => c.value === id)?.label ?? id
  const chargeLabel = (id: string) => {
    const charge = charges.find((c) => c.id === id)
    return charge ? chargeName(charge) : id
  }
  const close = () => {
    setCouponId('')
    onPicking(null)
  }

  return (
    <SubSection
      title="Discounts"
      description={`Coupons on all of ${phaseLabel}. A coupon on one charge is applied from that charge's menu.`}
    >
      <Frame
        footer={
          coupons.length === 0 ? (
            <p className="text-muted-foreground py-1.5 text-xs">
              No coupons yet. Create one under Product catalog → Coupons to discount a phase.
            </p>
          ) : picking === null ? (
            <AddButton onClick={() => onPicking('all')} label={`Add a coupon to ${phaseLabel}`}>
              Add coupon
            </AddButton>
          ) : (
            <div className="grid gap-2 py-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto] sm:items-start">
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
                value={picking}
                onValueChange={onPicking}
                options={[
                  { value: 'all', label: `All of ${phaseLabel}` },
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
                    { couponId, ...(picking === 'all' ? {} : { priceId: picking }) },
                  ])
                  close()
                }}
              >
                Add discount
              </Button>
              <CloseSubForm label={`Close coupon picker for ${phaseLabel}`} onClick={close} />
            </div>
          )
        }
      >
        {discounts.length === 0 ? (
          <EmptyLine>No discounts on {phaseLabel}.</EmptyLine>
        ) : (
          <ul className="divide-y">
            {discounts.map((discount, index) => (
              <li
                key={`${discount.couponId}-${discount.priceId ?? 'all'}-${index}`}
                className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-medium">{couponName(discount.couponId)}</span>
                  <span className="text-muted-foreground text-xs">
                    {discount.priceId
                      ? `On ${chargeLabel(discount.priceId)}`
                      : `On all of ${phaseLabel}`}
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
      </Frame>
    </SubSection>
  )
}

/** The phase's number in a filled circle, beside its title. */
function PhaseNumber({ n }: { n: number }) {
  return (
    <span
      aria-hidden
      className="bg-primary text-primary-foreground flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-medium tabular-nums"
    >
      {n}
    </span>
  )
}

/**
 * The contract timeline: each phase a card with its dates, its charges and
 * then its discounts — and, after the last, the dashed button that adds the
 * next phase. Phase 1 starts with the contract; each later phase starts where
 * the one before it ends, so only ends are chosen after the first.
 */
function PhasesStep({
  phases,
  starts,
  startDate,
  onStartDate,
  startError,
  today,
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
  startDate: string
  onStartDate: (value: string) => void
  startError: string | undefined
  today: string
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
  // Which phase's coupon picker is open, and for what.
  const [couponFor, setCouponFor] = useState<{ phase: number; target: string } | null>(null)
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
  const rangeOf = (index: number) =>
    `${formatDay(starts[index] || (index === 0 ? today : '')) || 'When the previous phase ends'} → ${
      phases[index]?.endDate ? formatDay(phases[index]!.endDate) : 'until cancelled'
    }`

  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-base font-medium">Contract timeline</h2>
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
          return (
            <button
              key={index}
              type="button"
              onClick={() => expand(index)}
              className="bg-background hover:bg-muted/40 flex w-full items-center justify-between gap-4 rounded-xl border px-5 py-4 text-left sm:px-6"
            >
              <span className="flex min-w-0 items-center gap-2">
                <PhaseNumber n={index + 1} />
                <span className="text-sm font-medium">{label}</span>
                <span className="text-muted-foreground text-xs">· {rangeOf(index)}</span>
              </span>
              <span className="text-muted-foreground shrink-0 text-xs">Edit</span>
            </button>
          )
        }
        return (
          <FormCard
            key={index}
            title={label}
            icon={<PhaseNumber n={index + 1} />}
            description={rangeOf(index)}
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
            <div>
              <div className="px-5 pt-4 sm:px-6">
                <h3 className="text-sm font-medium">Dates</h3>
              </div>
              {index === 0 ? (
                <FormRow
                  label="Starts"
                  hint="The contract start date. Leave it as today to start now."
                  error={startError}
                >
                  {({ id, ...field }) => (
                    <DateInput
                      id={id}
                      {...field}
                      value={startDate}
                      onValueChange={onStartDate}
                      placeholder={`Today, ${formatDay(today)}`}
                    />
                  )}
                </FormRow>
              ) : (
                <FormRow label="Starts" hint="When the previous phase ends.">
                  {() => (
                    <p className="text-sm">
                      {start ? formatDay(start) : 'When the previous phase ends'}
                    </p>
                  )}
                </FormRow>
              )}
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
            </div>
            <SubSection
              title="Charges"
              description={`The plan's prices for ${label}. Change only what this deal changes.`}
              action={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-label={`Add a charge to ${label}`}
                  onClick={() => setAddingTo(index)}
                >
                  <PlusIcon data-icon="inline-start" aria-hidden />
                  Add charge
                </Button>
              }
            >
              {phases.length > 1 && charges.some((charge) => charge.type === PriceType.Usage) ? (
                <p className="text-muted-foreground text-xs">
                  A commitment on an individual charge is kept for a contract with one phase. Remove
                  the extra phases to set one.
                </p>
              ) : null}
              <ChargesTable
                charges={charges}
                extraCharges={phase.extraCharges}
                isLoading={isLoading}
                overrides={phase.priceOverrides}
                onChange={(priceOverrides) => update(index, { priceOverrides })}
                quantities={phase.quantities}
                onQuantities={(quantities) => update(index, { quantities })}
                phaseLabel={label}
                onRemoveExtra={(at) =>
                  update(index, { extraCharges: phase.extraCharges.filter((_, i) => i !== at) })
                }
                {...(coupons.length > 0
                  ? {
                      onCouponFor: (priceId: string) =>
                        setCouponFor({ phase: index, target: priceId }),
                    }
                  : {})}
                {...(phases.length === 1
                  ? {
                      commitments,
                      commitmentErrors,
                      onCommitment: setCommitment,
                    }
                  : {})}
              />
              {quantityError ? (
                <p className="text-destructive text-xs" role="alert">
                  {quantityError}
                </p>
              ) : null}
            </SubSection>
            <PhaseDiscounts
              discounts={phase.discounts}
              charges={charges}
              coupons={coupons}
              phaseLabel={label}
              picking={couponFor?.phase === index ? couponFor.target : null}
              onPicking={(target) =>
                setCouponFor(target === null ? null : { phase: index, target })
              }
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
      <div className="flex flex-col gap-1.5">
        <Button
          type="button"
          variant="outline"
          className="h-11 w-full border-dashed"
          disabled={!canAdd}
          onClick={() => {
            setCollapsed(new Set(phases.map((_, i) => i)))
            onChange([...phases, emptyPhase()])
          }}
        >
          <PlusIcon data-icon="inline-start" aria-hidden />
          Add phase
        </Button>
        <p className="text-muted-foreground text-center text-xs">
          {canAdd
            ? `Phase ${phases.length + 1} starts when Phase ${phases.length} ends, with its own charges and discounts.`
            : `A new phase starts when Phase ${phases.length} ends, so Phase ${phases.length} needs an end date first.`}
        </p>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------------- */
/* Add-ons & benefits                                                        */
/* ------------------------------------------------------------------------- */

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
  const [picking, setPicking] = useState(false)
  // A fresh picker after each pick, so its list closes and it reads empty again.
  const [pickerKey, setPickerKey] = useState(0)
  return (
    <FormCard
      title="Add-ons"
      status="optional"
      icon={<PuzzleIcon aria-hidden className="text-muted-foreground size-4 shrink-0" />}
    >
      <div className="px-5 py-4 sm:px-6">
        <Frame
          footer={
            options.length === 0 ? (
              <p className="text-muted-foreground py-1.5 text-xs">No add-ons exist yet.</p>
            ) : available.length === 0 ? null : picking ? (
              <div className="flex items-center gap-2 py-2">
                <label htmlFor="contract-add-addon" className="sr-only">
                  Add an add-on
                </label>
                <div className="max-w-sm flex-1">
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
                      setPicking(false)
                    }}
                  />
                </div>
                <CloseSubForm label="Close add-on picker" onClick={() => setPicking(false)} />
              </div>
            ) : (
              <AddButton onClick={() => setPicking(true)}>Add add-on</AddButton>
            )
          }
        >
          {selected.length === 0 ? (
            <EmptyLine>
              No add-ons. An add-on brings its own charges and entitlements onto the contract.
            </EmptyLine>
          ) : (
            <ul className="divide-y">
              {selected.map((addon) => (
                <li
                  key={addon.addonId}
                  className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
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
                </li>
              ))}
            </ul>
          )}
        </Frame>
      </div>
    </FormCard>
  )
}

/**
 * The contract-wide commitment, across every charge. A commitment on one
 * charge is set from that charge's menu, on the phases step. Period, overage,
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
      title="Contract commitment"
      status="optional"
      icon={<ScaleIcon aria-hidden className="text-muted-foreground size-4 shrink-0" />}
      description="Applies to the whole contract, across every charge. Leave the amount empty for none. A commitment on a single charge is set on that charge."
    >
      <FormRow
        label="Commitment amount"
        hint="The least this contract bills per commitment period, across every charge."
        error={errors.commitmentAmount?.message}
      >
        {({ id, ...field }) => (
          <InputGroup className="h-9">
            <InputGroupAddon align="inline-start">
              {values.currency.toUpperCase() || '—'}
            </InputGroupAddon>
            <InputGroupInput
              id={id}
              inputMode="decimal"
              placeholder="No commitment"
              {...field}
              {...register('commitmentAmount')}
            />
          </InputGroup>
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
              { value: 'billing', label: 'Same as billing period' },
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
            className="w-32"
            {...field}
            {...register('overageFactor')}
          />
        )}
      </FormRow>
      <FormRow label="True-up" hint="Bill the shortfall when spend stays under the commitment.">
        {({ id }) => <Switch id={id} checked={values.enableTrueUp} onCheckedChange={onTrueUp} />}
      </FormRow>
    </FormCard>
  )
}

/** "Every billing period", "Daily", or "—". */
function resetsText(entitlement: Entitlement): string {
  if (entitlement.featureType !== FeatureType.Metered || !entitlement.usageResetPeriod) return '—'
  return entitlement.usageResetPeriod === 'MONTHLY'
    ? 'Every billing period'
    : USAGE_RESET_PERIOD_LABEL[entitlement.usageResetPeriod]
}

/**
 * The plan's entitlements, as a table. A metered allowance or an on/off
 * feature can be changed for this contract alone, in its row.
 */
function EntitlementsSection({
  planLabel,
  entitlements,
  isLoading,
  overrides,
  onChange,
}: {
  planLabel: string | undefined
  entitlements: Entitlement[]
  isLoading: boolean
  overrides: CreateSubscription['entitlementOverrides']
  onChange: (next: CreateSubscription['entitlementOverrides']) => void
}) {
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

  const columns: SimpleColumn<Entitlement>[] = [
    {
      key: 'feature',
      header: 'Feature',
      cell: (entitlement) => (
        <span className="font-medium">{entitlement.featureName ?? entitlement.featureId}</span>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      cell: (entitlement) => FEATURE_TYPE_LABEL[entitlement.featureType] ?? entitlement.featureType,
    },
    {
      key: 'allowance',
      header: 'Allowance',
      cell: (entitlement) => {
        const name = entitlement.featureName ?? entitlement.featureId
        const override = overrides.find((o) => o.entitlementId === entitlement.id)
        if (entitlement.featureType === FeatureType.Metered)
          return (
            <Input
              type="number"
              min={0}
              aria-label={`${name} usage limit`}
              placeholder={planEntitlementValue(entitlement)}
              className="h-8 w-32"
              value={override?.usageLimit ?? ''}
              onChange={(event) =>
                patch(entitlement.id, {
                  usageLimit: event.target.value === '' ? undefined : Number(event.target.value),
                })
              }
            />
          )
        if (entitlement.featureType === FeatureType.Boolean)
          return (
            <Switch
              aria-label={`${name} enabled`}
              checked={override?.isEnabled ?? entitlement.isEnabled ?? false}
              onCheckedChange={(checked) =>
                patch(entitlement.id, {
                  isEnabled: checked === (entitlement.isEnabled ?? false) ? undefined : checked,
                })
              }
            />
          )
        return planEntitlementValue(entitlement)
      },
    },
    { key: 'resets', header: 'Resets', cell: resetsText },
  ]

  return (
    <FormCard
      title="Entitlements"
      icon={<KeyRoundIcon aria-hidden className="text-muted-foreground size-4 shrink-0" />}
      description={`From the ${planLabel ?? ''} plan. Change an allowance here to set it for this contract alone.`.replace(
        'the  plan',
        'the plan',
      )}
    >
      <div className="px-5 py-4 sm:px-6">
        <Frame>
          {isLoading ? (
            <EmptyLine>Loading the plan&apos;s entitlements…</EmptyLine>
          ) : entitlements.length === 0 ? (
            <EmptyLine>This plan grants no entitlements.</EmptyLine>
          ) : (
            <SimpleTable columns={columns} rows={entitlements} />
          )}
        </Frame>
      </div>
    </FormCard>
  )
}

/**
 * The contract's credit grants, as a table. They open as the plan's own, and
 * each can be edited or removed for this contract alone, or new ones added.
 * The API uses a changed list *instead of* the plan's, so the card says when
 * that happens and offers the way back.
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
  type Row = { grant: CreateCreditGrant; index: number }
  const columns: SimpleColumn<Row>[] = [
    {
      key: 'grant',
      header: 'Grant',
      cell: ({ grant }) => <span className="font-medium">{grant.name}</span>,
    },
    {
      key: 'credits',
      header: 'Credits',
      cell: ({ grant }) => (
        <span className="tabular-nums">{Number(grant.credits || 0).toLocaleString('en-US')}</span>
      ),
    },
    { key: 'granted', header: 'Granted', cell: ({ grant }) => grantCadenceText(grant) },
    { key: 'expires', header: 'Expires', cell: ({ grant }) => grantExpiryText(grant) },
    { key: 'priority', header: 'Priority', cell: ({ grant }) => grant.priority },
    {
      key: 'actions',
      header: '',
      className: 'w-0 text-right',
      cell: ({ grant, index }) => (
        <RowActionsMenu
          label={grant.name}
          onEdit={() => setEditing(index)}
          onRemove={() => {
            setEditing(null)
            onChange(grants.filter((_, i) => i !== index))
          }}
          removeLabel={`Remove ${grant.name}`}
        />
      ),
    },
  ]
  const editingGrant = editing === null ? undefined : grants[editing]

  return (
    <FormCard
      title="Credit grants"
      status="optional"
      icon={<CoinsIcon aria-hidden className="text-muted-foreground size-4 shrink-0" />}
      {...(fromPlan && changed
        ? {
            adornment: (
              <Button type="button" variant="ghost" size="sm" onClick={onReset}>
                Use the plan&apos;s grants
              </Button>
            ),
            description: "These grants replace the plan's on this contract.",
          }
        : {})}
    >
      <div className="flex flex-col gap-3 px-5 py-4 sm:px-6">
        <Frame
          footer={
            adding ? null : <AddButton onClick={() => setAdding(true)}>Add credit grant</AddButton>
          }
        >
          {grants.length > 0 ? (
            <SimpleTable
              columns={columns}
              rows={grants.map((grant, index) => ({ grant, index }))}
              getRowId={(row) => `${row.grant.name}-${row.index}`}
            />
          ) : (
            <EmptyLine>
              {fromPlan
                ? "All of the plan's grants are removed from this contract."
                : 'No credit grants.'}
            </EmptyLine>
          )}
        </Frame>
        {editingGrant ? (
          <div className="flex flex-col gap-2 rounded-lg border p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">Edit {editingGrant.name}</span>
              <CloseSubForm
                label={`Close edit of ${editingGrant.name}`}
                onClick={() => setEditing(null)}
              />
            </div>
            <CreditGrantCreateForm
              key={editing}
              defaultValue={editingGrant}
              submitLabel="Save grant"
              onSubmit={(next) => {
                onChange(grants.map((g, i) => (i === editing ? next : g)))
                setEditing(null)
              }}
            />
          </div>
        ) : null}
        {adding ? (
          <div className="flex flex-col gap-2 rounded-lg border p-4">
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
        ) : null}
      </div>
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
      <div className="px-5 py-4 sm:px-6">
        <Frame
          footer={
            available.length > 0 ? (
              <div className="max-w-xs py-1.5">
                <label htmlFor="contract-add-tax" className="sr-only">
                  Add a tax rate
                </label>
                <OptionSelect
                  id="contract-add-tax"
                  value={undefined}
                  placeholder="Add tax rate"
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
            ) : null
          }
        >
          {taxes.length === 0 ? (
            <EmptyLine>No taxes are applied to this contract.</EmptyLine>
          ) : (
            <ul className="divide-y">
              {taxes.map((tax) => (
                <li
                  key={tax.taxRateCode}
                  className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
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
                </li>
              ))}
            </ul>
          )}
        </Frame>
      </div>
    </FormCard>
  )
}

/* ------------------------------------------------------------------------- */
/* Billing                                                                   */
/* ------------------------------------------------------------------------- */

const WhoPays = { Same: 'same', Another: 'another' } as const
type WhoPays = (typeof WhoPays)[keyof typeof WhoPays]

/** How and when the contract invoices, and who pays. */
function BillingStep({
  values,
  errors,
  register,
  isSubmitting,
  customers,
  onChange,
}: {
  values: CreateSubscription
  errors: FieldErrors<CreateSubscription>
  register: UseFormRegister<CreateSubscription>
  isSubmitting: boolean
  customers: readonly SubscriptionCustomerOption[]
  onChange: <K extends keyof CreateSubscription>(name: K, value: CreateSubscription[K]) => void
}) {
  const [whoPays, setWhoPays] = useState<WhoPays>(
    values.invoicingCustomerExternalId ? WhoPays.Another : WhoPays.Same,
  )
  // Another customer is chosen by external id, which is what the API takes.
  const others = customers.filter((c) => c.externalId && c.value !== values.customerId)
  const payerOptions = others.map((c) => ({ value: c.externalId!, label: c.label }))
  const inheritable = payerOptions.filter(
    (o) => !values.inheritedCustomerExternalIds.includes(o.value),
  )
  const nameOf = (externalId: string) =>
    payerOptions.find((o) => o.value === externalId)?.label ?? externalId
  const [pickerKey, setPickerKey] = useState(0)

  return (
    <>
      <FormCard
        title="Payment"
        icon={<WalletIcon aria-hidden className="text-muted-foreground size-4 shrink-0" />}
      >
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
      </FormCard>
      <FormCard
        title="Who pays"
        icon={<UsersIcon aria-hidden className="text-muted-foreground size-4 shrink-0" />}
      >
        <FormRow
          label="Billing customer"
          hint="Who this contract's invoices are sent to."
          align="start"
        >
          <ChoiceCards
            label="Billing customer"
            value={whoPays}
            onChange={(next) => {
              setWhoPays(next)
              if (next === WhoPays.Same) onChange('invoicingCustomerExternalId', '')
            }}
            choices={[
              {
                value: WhoPays.Same,
                title: 'Same customer',
                description: 'Invoices go to the customer on this contract.',
              },
              {
                value: WhoPays.Another,
                title: 'Another customer',
                description: 'A parent account pays, e.g. a holding company.',
              },
            ]}
          />
        </FormRow>
        {whoPays === WhoPays.Another ? (
          <FormRow label="Invoiced to" hint="The customer that receives and pays the invoices.">
            {({ id, ...field }) => (
              <OptionCombobox
                id={id}
                {...field}
                value={values.invoicingCustomerExternalId}
                onValueChange={(value) => onChange('invoicingCustomerExternalId', value)}
                options={payerOptions}
                placeholder="Choose a customer…"
                emptyText="No other customer has an external ID."
                disabled={isSubmitting}
              />
            )}
          </FormRow>
        ) : null}
        <FormRow
          label="Inherited customers"
          hint="Customers that get this contract too, billed through it — e.g. a company's subsidiaries."
          align="start"
        >
          {({ id, ...field }) => (
            <div className="flex flex-col gap-2">
              {values.inheritedCustomerExternalIds.length > 0 ? (
                <ul className="flex flex-wrap gap-1.5">
                  {values.inheritedCustomerExternalIds.map((externalId) => (
                    <li key={externalId}>
                      <Badge variant="secondary" className="gap-1 pr-1">
                        {nameOf(externalId)}
                        <button
                          type="button"
                          aria-label={`Remove ${nameOf(externalId)}`}
                          className="hover:text-foreground rounded-sm"
                          onClick={() =>
                            onChange(
                              'inheritedCustomerExternalIds',
                              values.inheritedCustomerExternalIds.filter((e) => e !== externalId),
                            )
                          }
                        >
                          <XIcon aria-hidden className="size-3" />
                        </button>
                      </Badge>
                    </li>
                  ))}
                </ul>
              ) : null}
              <OptionCombobox
                key={pickerKey}
                id={id}
                {...field}
                value=""
                onValueChange={(value) => {
                  if (!value) return
                  onChange('inheritedCustomerExternalIds', [
                    ...values.inheritedCustomerExternalIds,
                    value,
                  ])
                  setPickerKey((n) => n + 1)
                }}
                options={inheritable}
                placeholder="Add a customer…"
                emptyText="No other customer has an external ID."
                disabled={isSubmitting}
              />
            </div>
          )}
        </FormRow>
      </FormCard>
      <FormCard
        title="Other settings"
        icon={<Settings2Icon aria-hidden className="text-muted-foreground size-4 shrink-0" />}
      >
        <FormRow
          label="Prorate changes"
          hint="Charge or credit the part of a period a change falls in."
        >
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
        <FormRow
          label="Auto-invoice threshold"
          hint="Invoice early once unbilled usage reaches this amount. Leave empty to invoice each period."
          error={errors.autoInvoiceThreshold?.message}
        >
          {({ id, ...field }) => (
            <InputGroup className="h-9">
              <InputGroupAddon align="inline-start">
                {values.currency.toUpperCase() || '—'}
              </InputGroupAddon>
              <InputGroupInput
                id={id}
                inputMode="decimal"
                placeholder="Each period"
                disabled={isSubmitting}
                {...field}
                {...register('autoInvoiceThreshold')}
              />
            </InputGroup>
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
    </>
  )
}

/* ------------------------------------------------------------------------- */
/* Review                                                                    */
/* ------------------------------------------------------------------------- */

/**
 * Everything the contract will be, one card per step, each with its Edit.
 * A row names what was chosen and how many — the step itself holds the
 * detail — and the last card is the first invoice.
 */
function ReviewStep({
  values,
  customerLabel,
  planLabel,
  charges,
  entitlements,
  coupons,
  addons,
  customers,
  showCustomer,
  today,
  onEdit,
}: {
  values: CreateSubscription
  customerLabel: string | undefined
  planLabel: string | undefined
  charges: Charge[]
  entitlements: Entitlement[]
  coupons: readonly Option[]
  addons: readonly Option[]
  customers: readonly SubscriptionCustomerOption[]
  showCustomer: boolean
  today: string
  onEdit: (stepId: string) => void
}) {
  const starts = phaseStarts(values)
  const couponName = (id: string) => coupons.find((c) => c.value === id)?.label ?? id
  const chargeLabel = (id: string) => {
    const charge = charges.find((c) => c.id === id)
    return charge ? chargeName(charge) : id
  }
  const customerByExternalId = (externalId: string) =>
    customers.find((c) => c.externalId === externalId)?.label ?? externalId
  const period = BILLING_PERIOD_LABEL[values.billingPeriod].toLowerCase()
  const billing =
    values.billingPeriodCount > 1
      ? `${values.currency.toUpperCase()} · ${everyPeriod(values.billingPeriod, values.billingPeriodCount)}`
      : `${values.currency.toUpperCase()} · ${period}`
  const changedEntitlements = values.entitlementOverrides.length
  const invoice = firstInvoiceEstimate(values, charges, today)
  const other = [
    values.prorate ? 'Prorates changes' : 'No proration',
    values.billingAnchor ? `Anchored on ${formatDay(values.billingAnchor)}` : null,
    values.autoInvoiceThreshold
      ? `Invoices early at ${money(values.autoInvoiceThreshold, values.currency)}`
      : null,
    values.draft ? 'Created as a draft' : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="flex flex-col gap-5">
      <ReviewCard title={showCustomer ? 'Customer & plan' : 'Plan'} step="plan" onEdit={onEdit}>
        {showCustomer ? <ReviewRow label="Customer" value={customerLabel ?? '—'} /> : null}
        <ReviewRow label="Plan" value={planLabel ?? '—'} />
        <ReviewRow label="Billing" value={billing} />
        <ReviewRow
          label="Bill on"
          value={
            values.billingCycle === BillingCycle.Calendar
              ? calendarTitle(values.billingPeriod)
              : 'The contract start date'
          }
        />
        <ReviewRow
          label="Free trial"
          value={values.trialPeriodDays ? `${values.trialPeriodDays} days` : 'None'}
        />
      </ReviewCard>

      <ReviewCard
        title="Phases & charges"
        step="phases"
        onEdit={onEdit}
        count={values.phases.length}
      >
        {values.phases.map((phase, index) => {
          const billed = charges.length + phase.extraCharges.length
          const detail = [
            `${formatDay(starts[index] || (index === 0 ? today : ''))} → ${
              phase.endDate ? formatDay(phase.endDate) : 'until cancelled'
            }`,
            `${billed} ${billed === 1 ? 'charge' : 'charges'}`,
            phase.priceOverrides.length > 0 ? `${phase.priceOverrides.length} repriced` : null,
            phase.extraCharges.length > 0 ? `${phase.extraCharges.length} added` : null,
          ]
            .filter(Boolean)
            .join(' · ')
          return (
            <div key={index}>
              <ReviewRow label={`Phase ${index + 1}`} value={detail} />
              {phase.priceOverrides.map((override) => {
                const charge = charges.find((c) => c.id === override.priceId)
                return charge ? (
                  <ReviewRow
                    key={override.priceId}
                    label={chargeName(charge)}
                    value={`${priceText(charge, override)} (plan: ${priceText(charge, undefined)})`}
                    nested
                  />
                ) : null
              })}
              {phase.discounts.map((discount, i) => (
                <ReviewRow
                  key={`${discount.couponId}-${i}`}
                  label={couponName(discount.couponId)}
                  value={
                    discount.priceId
                      ? `Coupon on ${chargeLabel(discount.priceId)}`
                      : 'Coupon on the whole phase'
                  }
                  nested
                />
              ))}
            </div>
          )
        })}
      </ReviewCard>

      <ReviewCard title="Add-ons & benefits" step="commitments" onEdit={onEdit}>
        <ReviewRow
          label="Add-ons"
          value={
            values.addons.length === 0
              ? 'None'
              : values.addons
                  .map(
                    (addon) =>
                      addon.name ||
                      addons.find((a) => a.value === addon.addonId)?.label ||
                      addon.addonId,
                  )
                  .join(', ')
          }
        />
        <ReviewRow
          label="Commitment"
          value={
            values.commitmentAmount
              ? `${money(values.commitmentAmount, values.currency)} per ${
                  values.commitmentDuration
                    ? BILLING_PERIOD_LABEL[values.commitmentDuration].toLowerCase()
                    : 'billing period'
                }${values.overageFactor ? ` · overage ×${values.overageFactor}` : ''}${
                  values.enableTrueUp ? ' · true-up' : ''
                }`
              : values.chargeCommitments.length > 0
                ? `On ${values.chargeCommitments.length} ${values.chargeCommitments.length === 1 ? 'charge' : 'charges'}`
                : 'None'
          }
        />
        <ReviewRow
          label="Entitlements"
          value={
            entitlements.length === 0
              ? 'None'
              : `${entitlements.length}, from the plan${
                  changedEntitlements > 0 ? ` · ${changedEntitlements} changed` : ''
                }`
          }
        />
        <ReviewRow
          label="Credit grants"
          value={
            values.creditGrants.length === 0
              ? 'None'
              : values.creditGrants
                  .map(
                    (grant) =>
                      `${grant.name} (${Number(grant.credits || 0).toLocaleString('en-US')})`,
                  )
                  .join(', ')
          }
        />
        <ReviewRow
          label="Taxes"
          value={
            values.taxes.length === 0
              ? 'None'
              : values.taxes
                  .map(
                    (tax) =>
                      `${tax.name || tax.taxRateCode}${tax.percentage ? ` (${tax.percentage}%)` : ''}`,
                  )
                  .join(', ')
          }
        />
      </ReviewCard>

      <ReviewCard title="Billing" step="billing" onEdit={onEdit}>
        <ReviewRow
          label="Payment terms"
          value={values.paymentTerms ? PAYMENT_TERMS_LABEL[values.paymentTerms] : 'Due on receipt'}
        />
        <ReviewRow
          label="Billing customer"
          value={
            values.invoicingCustomerExternalId
              ? customerByExternalId(values.invoicingCustomerExternalId)
              : 'Same customer'
          }
        />
        <ReviewRow
          label="Inherited customers"
          value={
            values.inheritedCustomerExternalIds.length === 0
              ? 'None'
              : values.inheritedCustomerExternalIds.map(customerByExternalId).join(', ')
          }
        />
        <ReviewRow label="Other" value={other} />
      </ReviewCard>

      {invoice ? (
        <FormCard>
          <ReviewRow
            label="First invoice"
            value={`${moneyText(invoice.amount, values.currency)} on ${formatDay(invoice.date)}`}
            strong
          />
        </FormCard>
      ) : null}
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
  children,
}: {
  title: string
  step: string
  onEdit: (stepId: string) => void
  /** How many rows the card holds, beside its title. */
  count?: number
  children: ReactNode
}) {
  return (
    <FormCard
      title={count === undefined ? title : `${title} (${count})`}
      adornment={
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          aria-label={`Edit ${title.toLowerCase()}`}
          onClick={() => onEdit(step)}
        >
          <PencilIcon data-icon="inline-start" aria-hidden />
          Edit
        </Button>
      }
    >
      {children}
    </FormCard>
  )
}

/** A label and its value, side by side and left-aligned, as the reference review reads. */
function ReviewRow({
  label,
  value,
  nested = false,
  strong = false,
}: {
  label: string
  value: string
  /** A detail under the row before it, e.g. a repriced charge under its phase. */
  nested?: boolean
  strong?: boolean
}) {
  return (
    <div
      className={
        'grid gap-1 px-5 py-3 text-sm sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] sm:gap-4 sm:px-6' +
        (nested ? ' pt-0' : '')
      }
    >
      <span className={nested ? 'text-muted-foreground pl-4 text-xs' : 'text-muted-foreground'}>
        {label}
      </span>
      <span
        className={
          nested
            ? 'text-muted-foreground text-xs'
            : strong
              ? 'text-base font-medium tabular-nums'
              : 'text-foreground'
        }
      >
        {value}
      </span>
    </div>
  )
}
