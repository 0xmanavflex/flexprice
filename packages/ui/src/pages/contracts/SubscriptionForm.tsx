import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Controller, useForm, type Resolver } from 'react-hook-form'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { XIcon } from 'lucide-react'
import {
  BILLING_MODEL_LABEL,
  BILLING_PERIOD_LABEL,
  BillingModel,
  type Charge,
  type CreateCreditGrant,
  type CreateSubscription,
  CREDIT_GRANT_CADENCE_LABEL,
  type Entitlement,
  FeatureType,
  type PriceOverride,
  type PriceTier,
  SUBSCRIPTION_BILLING_PERIODS,
  TierMode,
  createSubscriptionSchema,
  emptySubscription,
} from '@fp/domain'
import { Badge } from '@ui/components/reui/badge'
import { Button } from '@ui/components/primitives/button'
import { Input } from '@ui/components/primitives/input'
import { Switch } from '@ui/components/primitives/switch'
import type { DetailCrumb } from '@ui/compositions/DetailShell'
import { DateInput } from '@ui/compositions/DateInput'
import { EmptyState } from '@ui/compositions/EmptyState'
import { FormCard, FormRow } from '@ui/compositions/FormCard'
import { FormPage } from '@ui/compositions/FormPage'
import { OptionCombobox } from '@ui/compositions/OptionCombobox'
import { type Option, OptionSelect } from '@ui/compositions/OptionSelect'
import { useFormSteps } from '@ui/compositions/useFormSteps'
import { CreditGrantCreateForm } from '@ui/pages/product-catalog/credit-grants/CreditGrantForm'
import { PriceOverrideForm } from '@ui/pages/product-catalog/charges/PriceOverrideForm'
import { provenance } from '@ui/provenance'

/**
 * Create a contract (subscription) in four steps:
 *
 * 1. **Customer** — a single customer field.
 * 2. **Plan & charges** — the plan, its billing period and currency, and the
 *    plan's charges, each of which can be overridden for this contract.
 * 3. **Benefits** — entitlement overrides, credit grants and commitments.
 * 4. **Review** — everything above, with the charges priced as they will bill
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
  isLoading: boolean
}

/** A customer to choose from; `currency` (ISO, any case) seeds the contract's currency. */
export interface SubscriptionCustomerOption extends Option {
  currency?: string | undefined
}

export interface SubscriptionFormProps {
  defaultValue?: Partial<CreateSubscription>
  customers: readonly SubscriptionCustomerOption[]
  plans: readonly Option[]
  /** The chosen plan's charges and entitlements; undefined until a plan is chosen. */
  plan: SubscriptionPlanContext | undefined
  onPlanChange: (planId: string) => void
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

const FALLBACK_CURRENCIES = ['USD', 'EUR', 'GBP', 'INR']

/** Step ids are URL-safe and mirrored by the console's route (`app/subscriptionSteps.ts`). */
export const SUBSCRIPTION_FORM_STEPS = [
  { id: 'customer', title: 'Customer' },
  { id: 'plan', title: 'Plan & charges' },
  { id: 'benefits', title: 'Benefits' },
  { id: 'review', title: 'Review' },
] as const

const STEP_FIELDS: Record<string, (keyof CreateSubscription)[]> = {
  customer: ['customerId'],
  plan: ['planId', 'currency', 'billingPeriod', 'billingPeriodCount', 'trialPeriodDays'],
}

const unique = <T,>(values: T[]) => [...new Set(values)]

export function SubscriptionForm({
  defaultValue,
  customers,
  plans,
  plan,
  onPlanChange,
  customerLocked = false,
  onSubmit,
  onCancel,
  isSubmitting = false,
  submitError = null,
  trail,
  step,
  onStepChange,
}: SubscriptionFormProps) {
  const form = useForm<CreateSubscription>({
    resolver: standardSchemaResolver(createSubscriptionSchema) as Resolver<CreateSubscription>,
    defaultValues: { ...emptySubscription(), ...defaultValue },
    mode: 'onTouched',
  })
  const errors = form.formState.errors
  const values = form.watch()

  const steps = useMemo(
    () =>
      customerLocked
        ? SUBSCRIPTION_FORM_STEPS.filter((s) => s.id !== 'customer')
        : SUBSCRIPTION_FORM_STEPS,
    [customerLocked],
  )

  const flow = useFormSteps({
    steps,
    step,
    onStepChange,
    validate: (id) => (STEP_FIELDS[id] ? form.trigger(STEP_FIELDS[id] as never) : true),
  })

  // A picker has no blur to mark it touched, so a value it sets is validated
  // here: an earlier "Choose a plan" error clears the moment a plan is chosen.
  const pick = (name: 'customerId' | 'planId' | 'currency' | 'billingPeriod', value: string) =>
    form.setValue(name, value as never, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    })

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
  const charges = useMemo(() => {
    const all = plan?.charges ?? []
    const currency = values.currency.toUpperCase()
    const inCurrency = all.filter((c) => c.currency.toUpperCase() === currency)
    return currency && inCurrency.length > 0 ? inCurrency : all
  }, [plan, values.currency])

  const submitAll = form.handleSubmit(onSubmit, (failed) => {
    const bad = flow.steps.find((s) =>
      STEP_FIELDS[s.id]?.some((field) => failed[field] !== undefined),
    )
    if (bad) flow.goTo(bad.id)
  })

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
      description={`${what} come from the plan. Go back to Plan & charges and choose one.`}
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
    customer: formEl(customerStep),
    plan: (
      <div className="flex flex-col gap-5">
        {formEl(planCard)}
        {values.planId ? (
          <ChargesSection
            charges={charges}
            isLoading={plan?.isLoading ?? true}
            overrides={values.priceOverrides}
            onChange={(next) => form.setValue('priceOverrides', next, { shouldDirty: true })}
          />
        ) : null}
      </div>
    ),
    benefits: (
      <div className="flex flex-col gap-5">
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
          onChange={(next) => form.setValue('creditGrants', next, { shouldDirty: true })}
        />
        <CommitmentsSection />
      </div>
    ),
    review: formEl(
      <ReviewStep
        values={values}
        customerLabel={customer?.label}
        planLabel={planLabel}
        charges={charges}
        entitlements={plan?.entitlements ?? []}
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

function ChargesSection({
  charges,
  isLoading,
  overrides,
  onChange,
}: {
  charges: Charge[]
  isLoading: boolean
  overrides: PriceOverride[]
  onChange: (next: PriceOverride[]) => void
}) {
  const [editing, setEditing] = useState<string | null>(null)
  const byId = new Map(overrides.map((o) => [o.priceId, o]))

  if (isLoading)
    return <p className="text-muted-foreground text-sm">Loading the plan&apos;s charges…</p>
  if (charges.length === 0)
    return (
      <EmptyState
        size="inline"
        title="This plan has no charges"
        description="There is nothing to override. Continue to the next step."
      />
    )

  return (
    <FormCard title="Charges" status="optional">
      <ul className="divide-y">
        {charges.map((charge) => {
          const override = byId.get(charge.id)
          const name = chargeName(charge)
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
                      label={`Close override for ${name}`}
                      onClick={() => setEditing(null)}
                    />
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setEditing(charge.id)}
                    >
                      {override ? 'Edit' : 'Override'}
                    </Button>
                  )}
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
            </li>
          )
        })}
      </ul>
    </FormCard>
  )
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
    <FormCard title="Entitlements" status="optional">
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

function CreditsSection({
  grants,
  onChange,
}: {
  grants: CreateCreditGrant[]
  onChange: (next: CreateCreditGrant[]) => void
}) {
  const [adding, setAdding] = useState(false)

  return (
    <FormCard title="Credit grants" status="optional">
      {grants.length > 0 ? (
        <ul className="divide-y">
          {grants.map((grant, index) => (
            <li
              key={`${grant.name}-${index}`}
              className="flex items-center justify-between gap-3 px-5 py-4 sm:px-6"
            >
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-medium">{grant.name}</span>
                <span className="text-muted-foreground text-xs">
                  {grant.credits} credits · {CREDIT_GRANT_CADENCE_LABEL[grant.cadence]}
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onChange(grants.filter((_, i) => i !== index))}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="px-5 py-4 sm:px-6">
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
 * Commitments have no field on the create request yet (`CreateSubscription`
 * carries none), so this section says where they are set rather than
 * collecting values the API would drop.
 */
function CommitmentsSection() {
  return (
    <FormCard title="Commitments" status="optional">
      <p className="text-muted-foreground px-5 py-4 text-sm sm:px-6">
        Minimum-spend commitments are added on the contract once it is created.
      </p>
    </FormCard>
  )
}

function ReviewStep({
  values,
  customerLabel,
  planLabel,
  charges,
  entitlements,
  showCustomer,
  onEdit,
}: {
  values: CreateSubscription
  customerLabel: string | undefined
  planLabel: string | undefined
  charges: Charge[]
  entitlements: Entitlement[]
  showCustomer: boolean
  onEdit: (stepId: string) => void
}) {
  const overrides = new Map(values.priceOverrides.map((o) => [o.priceId, o]))
  const every =
    values.billingPeriodCount > 1
      ? `Every ${values.billingPeriodCount} × ${BILLING_PERIOD_LABEL[values.billingPeriod]}`
      : BILLING_PERIOD_LABEL[values.billingPeriod]
  const entitlementName = (id: string) => {
    const match = entitlements.find((e) => e.id === id)
    return match?.featureName ?? match?.featureId ?? id
  }

  return (
    <div className="flex flex-col gap-5">
      {showCustomer ? (
        <ReviewCard title="Customer" step="customer" onEdit={onEdit}>
          <ReviewRow label="Customer" value={customerLabel ?? '—'} />
        </ReviewCard>
      ) : null}

      <ReviewCard title="Plan & charges" step="plan" onEdit={onEdit}>
        <ReviewRow label="Plan" value={planLabel ?? '—'} />
        <ReviewRow label="Billing" value={`${values.currency.toUpperCase() || '—'} · ${every}`} />
        <ReviewRow label="Starts" value={values.startDate || 'Now'} />
        <ReviewRow
          label="Trial"
          value={values.trialPeriodDays ? `${values.trialPeriodDays} days` : 'None'}
        />
        {charges.length === 0 ? (
          <ReviewRow label="Charges" value="None" />
        ) : (
          charges.map((charge) => {
            const pricing = chargePricing(charge, overrides.get(charge.id))
            return (
              <div
                key={charge.id}
                className="flex items-start justify-between gap-4 px-5 py-3 text-sm sm:px-6"
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate">{chargeName(charge)}</span>
                  <PricingText
                    pricing={pricing}
                    period={BILLING_PERIOD_LABEL[charge.billingPeriod]}
                  />
                </div>
                {pricing.overridden ? <Badge variant="info-light">Overridden</Badge> : null}
              </div>
            )
          })
        )}
      </ReviewCard>

      <ReviewCard title="Benefits" step="benefits" onEdit={onEdit}>
        {values.entitlementOverrides.length === 0 ? (
          <ReviewRow label="Entitlements" value="As the plan" />
        ) : (
          values.entitlementOverrides.map((o) => (
            <ReviewRow
              key={o.entitlementId}
              label={entitlementName(o.entitlementId)}
              value={
                o.usageLimit !== undefined
                  ? `Limit ${o.usageLimit.toLocaleString('en-US')}`
                  : o.isEnabled
                    ? 'On'
                    : 'Off'
              }
            />
          ))
        )}
        {values.creditGrants.length === 0 ? (
          <ReviewRow label="Credit grants" value="None" />
        ) : (
          values.creditGrants.map((grant, index) => (
            <ReviewRow
              key={`${grant.name}-${index}`}
              label={grant.name}
              value={`${grant.credits} credits · ${CREDIT_GRANT_CADENCE_LABEL[grant.cadence]}`}
            />
          ))
        )}
        <ReviewRow label="Commitments" value="None" />
      </ReviewCard>
    </div>
  )
}

function ReviewCard({
  title,
  step,
  onEdit,
  children,
}: {
  title: string
  step: string
  onEdit: (stepId: string) => void
  children: ReactNode
}) {
  return (
    <FormCard title={title}>
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
