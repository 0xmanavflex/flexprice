import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Controller, useForm, type Resolver } from 'react-hook-form'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import {
  BILLING_PERIOD_LABEL,
  type Charge,
  type CreateCreditGrant,
  type CreateSubscription,
  CREDIT_GRANT_CADENCE_LABEL,
  type Entitlement,
  FeatureType,
  type PriceOverride,
  SUBSCRIPTION_BILLING_PERIODS,
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
import { FormSteps, StepFooter, useFormSteps } from '@ui/compositions/useFormSteps'
import { CreditGrantCreateForm } from '@ui/pages/credit-grants/CreditGrantForm'
import { PriceOverrideForm } from '@ui/pages/charges/PriceOverrideForm'
import { provenance } from '@ui/provenance'
import { SubscriptionPreviewCard } from './SubscriptionPreviewCard'

/**
 * Start a subscription: customer, plan, prices, entitlements, credits, review.
 *
 * One react-hook-form draft over the domain schema, walked by `useFormSteps` —
 * the same shape as the customer form. The form never fetches: the page hands it
 * the customers and plans to choose from and, once a plan is chosen (reported
 * through `onPlanChange`), that plan's charges and entitlements to override.
 * `customerLocked` drops the Customer step when the form is opened from a
 * customer's own page.
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
  note: 'RHF + the domain schema, stepped, with a live summary rail beside it like the plan and customer forms; sub-forms (price override, credit grant) sit outside the form element.',
})

export interface SubscriptionPlanContext {
  charges: Charge[]
  entitlements: Entitlement[]
  isLoading: boolean
}

export interface SubscriptionFormProps {
  defaultValue?: Partial<CreateSubscription>
  customers: readonly Option[]
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
  embedded?: boolean
}

const FORM_ID = 'subscription-form'

const FALLBACK_CURRENCIES = ['USD', 'EUR', 'GBP', 'INR']

const ALL_STEPS = [
  { id: 'customer', title: 'Customer' },
  { id: 'plan', title: 'Plan' },
  { id: 'prices', title: 'Prices' },
  { id: 'entitlements', title: 'Entitlements' },
  { id: 'credits', title: 'Credits' },
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
  embedded = false,
}: SubscriptionFormProps) {
  const form = useForm<CreateSubscription>({
    resolver: standardSchemaResolver(createSubscriptionSchema) as Resolver<CreateSubscription>,
    defaultValues: { ...emptySubscription(), ...defaultValue },
    mode: 'onTouched',
  })
  const errors = form.formState.errors
  const values = form.watch()

  const steps = useMemo(
    () => (customerLocked ? ALL_STEPS.filter((s) => s.id !== 'customer') : ALL_STEPS),
    [customerLocked],
  )

  const flow = useFormSteps({
    steps,
    step,
    onStepChange,
    validate: (id) => (STEP_FIELDS[id] ? form.trigger(STEP_FIELDS[id] as never) : true),
  })

  useEffect(() => {
    if (values.planId) onPlanChange(values.planId)
  }, [values.planId, onPlanChange])

  const currencyOptions = useMemo<Option[]>(() => {
    const fromCharges = unique(
      (plan?.charges ?? []).map((c) => c.currency.toUpperCase()).filter(Boolean),
    )
    return (fromCharges.length > 0 ? fromCharges : FALLBACK_CURRENCIES).map((code) => ({
      value: code,
      label: code,
    }))
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

  // A plan that bills in one currency or on one cadence has nothing to choose.
  useEffect(() => {
    if (currencyOptions.length === 1 && values.currency !== currencyOptions[0]?.value) {
      form.setValue('currency', currencyOptions[0]!.value, { shouldValidate: true })
    }
    if (periodOptions.length > 0 && !periodOptions.some((o) => o.value === values.billingPeriod)) {
      form.setValue('billingPeriod', periodOptions[0]!.value as CreateSubscription['billingPeriod'])
    }
  }, [currencyOptions, periodOptions, values.currency, values.billingPeriod, form])

  const submitAll = form.handleSubmit(onSubmit, (failed) => {
    const bad = flow.steps.find((s) =>
      STEP_FIELDS[s.id]?.some((field) => failed[field] !== undefined),
    )
    if (bad) flow.goTo(bad.id)
  })

  const customerStep = (
    <FormCard title="Customer" status="required">
      <FormRow
        label="Customer"
        hint="The customer being subscribed."
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
                onValueChange={control.onChange}
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

  const planStep = (
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
                onValueChange={control.onChange}
                options={plans}
                placeholder="Search plans…"
                disabled={isSubmitting}
              />
            )}
          />
        )}
      </FormRow>
      <FormRow
        label="Currency"
        required
        hint="Taken from the plan's charges."
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
                onValueChange={control.onChange}
                options={currencyOptions}
                placeholder={values.planId ? 'Choose a currency' : 'Choose a plan first'}
                disabled={isSubmitting}
              />
            )}
          />
        )}
      </FormRow>
      <FormRow
        label="Billing period"
        hint="How often the subscription is invoiced."
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
                onValueChange={control.onChange}
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
      title="Choose a plan first"
      description={`${what} are the plan's, so there is nothing to change until a plan is chosen.`}
    />
  )

  const content: Record<string, ReactNode> = {
    customer: (
      <form id={FORM_ID} onSubmit={flow.guardSubmit(submitAll)} noValidate>
        {customerStep}
      </form>
    ),
    plan: (
      <form id={FORM_ID} onSubmit={flow.guardSubmit(submitAll)} noValidate>
        {planStep}
      </form>
    ),
    prices: !values.planId ? (
      noPlan('Prices')
    ) : (
      <PricesStep
        charges={plan?.charges ?? []}
        isLoading={plan?.isLoading ?? true}
        overrides={values.priceOverrides}
        onChange={(next) => form.setValue('priceOverrides', next, { shouldDirty: true })}
      />
    ),
    entitlements: !values.planId ? (
      noPlan('Entitlements')
    ) : (
      <EntitlementsStep
        entitlements={plan?.entitlements ?? []}
        isLoading={plan?.isLoading ?? true}
        overrides={values.entitlementOverrides}
        onChange={(next) => form.setValue('entitlementOverrides', next, { shouldDirty: true })}
      />
    ),
    credits: (
      <CreditsStep
        grants={values.creditGrants}
        onChange={(next) => form.setValue('creditGrants', next, { shouldDirty: true })}
      />
    ),
    review: (
      <form id={FORM_ID} onSubmit={flow.guardSubmit(submitAll)} noValidate>
        <ReviewStep
          values={values}
          customerLabel={customers.find((c) => c.value === values.customerId)?.label}
          planLabel={plans.find((p) => p.value === values.planId)?.label}
          onEdit={flow.goTo}
        />
      </form>
    ),
  }

  const footer = (
    <StepFooter
      flow={flow}
      mode="create"
      noun="subscription"
      formId={FORM_ID}
      onCancel={onCancel}
      isSubmitting={isSubmitting}
      submitError={submitError}
    />
  )
  const stepper = (
    <FormSteps flow={flow} label="Subscription steps">
      {content[flow.step]}
    </FormSteps>
  )
  const preview = (
    <SubscriptionPreviewCard
      customer={customers.find((c) => c.value === values.customerId)?.label}
      plan={plans.find((p) => p.value === values.planId)?.label}
      currency={values.currency}
      billingPeriod={values.billingPeriod}
      billingPeriodCount={values.billingPeriodCount}
      startDate={values.startDate}
      trialPeriodDays={values.trialPeriodDays}
      priceOverrides={values.priceOverrides.length}
      entitlementOverrides={values.entitlementOverrides.length}
      creditGrants={values.creditGrants.length}
    />
  )

  if (embedded) {
    return (
      <section className="flex flex-col gap-4">
        {stepper}
        {footer}
      </section>
    )
  }

  return (
    <FormPage
      title="Create subscription"
      trail={trail}
      width="wide"
      toolbar={{
        mode: 'create',
        noun: 'subscription',
        formId: FORM_ID,
        onCancel,
        isSubmitting,
        submitError,
      }}
      stepper={{ flow, label: 'Subscription steps' }}
      preview={preview}
    >
      {content[flow.step]}
    </FormPage>
  )
}

function PricesStep({
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

  if (isLoading) return <p className="text-muted-foreground text-sm">Loading the plan's charges…</p>
  if (charges.length === 0)
    return (
      <EmptyState
        size="inline"
        title="This plan has no charges"
        description="There is nothing to override. Continue to the next step."
      />
    )

  return (
    <FormCard title="Charges">
      <ul className="divide-y">
        {charges.map((charge) => {
          const override = byId.get(charge.id)
          return (
            <li key={charge.id} className="flex flex-col gap-3 px-5 py-4 sm:px-6">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium">
                    {charge.displayName || charge.description || charge.id}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {charge.displayAmount || charge.amount || 'Tiered'} ·{' '}
                    {BILLING_PERIOD_LABEL[charge.billingPeriod]}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {override ? <Badge variant="info-light">Overridden</Badge> : null}
                  {override ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onChange(overrides.filter((o) => o.priceId !== charge.id))}
                    >
                      Remove
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setEditing(editing === charge.id ? null : charge.id)}
                  >
                    {editing === charge.id ? 'Close' : override ? 'Edit' : 'Override'}
                  </Button>
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
                  onCancel={() => setEditing(null)}
                />
              ) : null}
            </li>
          )
        })}
      </ul>
    </FormCard>
  )
}

function EntitlementsStep({
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
    return <p className="text-muted-foreground text-sm">Loading the plan's entitlements…</p>
  const editable = entitlements.filter(
    (e) => e.featureType === FeatureType.Metered || e.featureType === FeatureType.Boolean,
  )
  if (editable.length === 0)
    return (
      <EmptyState
        size="inline"
        title="Nothing to override"
        description="This plan has no metered or on/off entitlements. Continue to the next step."
      />
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
    <FormCard title="Entitlements">
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
                      isEnabled: checked === (entitlement.isEnabled ?? false) ? undefined : checked,
                    })
                  }
                />
              )}
            </li>
          )
        })}
      </ul>
    </FormCard>
  )
}

function CreditsStep({
  grants,
  onChange,
}: {
  grants: CreateCreditGrant[]
  onChange: (next: CreateCreditGrant[]) => void
}) {
  const [adding, setAdding] = useState(false)

  return (
    <FormCard title="Credit grants">
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
          <CreditGrantCreateForm
            submitLabel="Add grant"
            onSubmit={(grant) => {
              onChange([...grants, grant])
              setAdding(false)
            }}
            onCancel={() => setAdding(false)}
          />
        ) : (
          <Button type="button" variant="outline" size="sm" onClick={() => setAdding(true)}>
            Add credit grant
          </Button>
        )}
      </div>
    </FormCard>
  )
}

function ReviewStep({
  values,
  customerLabel,
  planLabel,
  onEdit,
}: {
  values: CreateSubscription
  customerLabel: string | undefined
  planLabel: string | undefined
  onEdit: (stepId: string) => void
}) {
  const rows: { label: string; value: string; step: string }[] = [
    { label: 'Customer', value: customerLabel ?? '—', step: 'customer' },
    { label: 'Plan', value: planLabel ?? '—', step: 'plan' },
    {
      label: 'Billing',
      value: `${values.currency.toUpperCase() || '—'} · every ${values.billingPeriodCount} × ${
        BILLING_PERIOD_LABEL[values.billingPeriod]
      }`,
      step: 'plan',
    },
    { label: 'Starts', value: values.startDate || 'Now', step: 'plan' },
    {
      label: 'Trial',
      value: values.trialPeriodDays ? `${values.trialPeriodDays} days` : 'None',
      step: 'plan',
    },
    {
      label: 'Price overrides',
      value: String(values.priceOverrides.length),
      step: 'prices',
    },
    {
      label: 'Entitlement overrides',
      value: String(values.entitlementOverrides.length),
      step: 'entitlements',
    },
    { label: 'Credit grants', value: String(values.creditGrants.length), step: 'credits' },
  ]

  return (
    <FormCard title="Review">
      <dl className="divide-y">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between gap-4 px-5 py-3 text-sm sm:px-6"
          >
            <dt className="text-muted-foreground">{row.label}</dt>
            <dd className="flex items-center gap-3">
              <span className="font-medium">{row.value}</span>
              <Button type="button" variant="link" size="sm" onClick={() => onEdit(row.step)}>
                Edit
              </Button>
            </dd>
          </div>
        ))}
      </dl>
    </FormCard>
  )
}
