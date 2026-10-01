import { Controller, useForm, type Resolver } from 'react-hook-form'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { z } from 'zod'
import { BILLING_PERIOD_LABEL, BillingPeriod } from '@fp/domain'
import { Input } from '@ui/components/primitives/input'
import type { DetailCrumb } from '@ui/compositions/DetailShell'
import { FormActions } from '@ui/compositions/FormActions'
import { FormCard, FormRow } from '@ui/compositions/FormCard'
import { FormPage } from '@ui/compositions/FormPage'
import { OptionCombobox } from '@ui/compositions/OptionCombobox'
import { OptionSelect } from '@ui/compositions/OptionSelect'
import { provenance } from '@ui/provenance'

/**
 * Create a subscription for a customer who is already known.
 *
 * The customer id arrives with the page, so this form does not ask for it.
 * Layout is ReUI `form-12`: one card, the label and hint on the left of each
 * row, the control on the right, rows split by dashed rules.
 *
 * Presentational. It emits a validated draft and never imports `@fp/query`.
 * There is no create-subscription call in this build, so the caller decides
 * what a submit means.
 */
export const SubscriptionFormProvenance = provenance({
  source: 'composition',
  composes: [
    'compositions/form-page',
    'compositions/form-card',
    'compositions/option-select',
    'compositions/option-combobox',
    'ui/input',
  ],
  note: 'form-12 subscription create: customer is passed in, plan, billing period and start date are the rows.',
})

const PERIODS = [
  BillingPeriod.Monthly,
  BillingPeriod.Quarterly,
  BillingPeriod.HalfYearly,
  BillingPeriod.Annual,
  BillingPeriod.Weekly,
  BillingPeriod.Daily,
] as const

const PERIOD_OPTIONS = PERIODS.map((value) => ({
  value,
  label: BILLING_PERIOD_LABEL[value],
}))

const draftSchema = z.object({
  planId: z.string().trim().min(1, 'Choose a plan'),
  billingPeriod: z.enum(PERIODS),
  startDate: z.string().trim().min(1, 'Choose a start date'),
})

export type SubscriptionDraft = z.infer<typeof draftSchema> & { customerId: string }

export interface SubscriptionPlanOption {
  id: string
  name: string
}

export interface SubscriptionFormProps {
  customerId: string
  customerName: string
  plans: readonly SubscriptionPlanOption[]
  trail: DetailCrumb[]
  onSubmit: (draft: SubscriptionDraft) => void
  onCancel: () => void
  isSubmitting?: boolean
  submitError?: string | null
}

const FORM_ID = 'subscription-form'

function today(): string {
  const date = new Date()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

export function SubscriptionForm({
  customerId,
  customerName,
  plans,
  trail,
  onSubmit,
  onCancel,
  isSubmitting = false,
  submitError = null,
}: SubscriptionFormProps) {
  const form = useForm<z.infer<typeof draftSchema>>({
    resolver: standardSchemaResolver(draftSchema) as Resolver<z.infer<typeof draftSchema>>,
    defaultValues: { planId: '', billingPeriod: BillingPeriod.Monthly, startDate: today() },
    mode: 'onTouched',
  })
  const errors = form.formState.errors
  const planOptions = plans.map((plan) => ({ value: plan.id, label: plan.name }))

  return (
    <FormPage
      title="New subscription"
      trail={trail}
      width="narrow"
      footer={
        <FormActions
          mode="create"
          noun="subscription"
          formId={FORM_ID}
          onCancel={onCancel}
          isSubmitting={isSubmitting}
          submitError={submitError}
        />
      }
    >
      <form
        id={FORM_ID}
        noValidate
        onSubmit={form.handleSubmit((value) => onSubmit({ ...value, customerId }))}
      >
        <FormCard>
          <FormRow label="Customer" hint={customerId}>
            <p className="text-sm">{customerName}</p>
          </FormRow>
          <FormRow
            label="Plan"
            required
            hint="The plan this customer will be billed on."
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
                    options={planOptions}
                    placeholder="Search plans"
                    emptyText="No plans match."
                    disabled={isSubmitting}
                  />
                )}
              />
            )}
          </FormRow>
          <FormRow label="Billing period" required error={errors.billingPeriod?.message}>
            {({ id, ...field }) => (
              <Controller
                control={form.control}
                name="billingPeriod"
                render={({ field: control }) => (
                  <OptionSelect
                    id={id}
                    {...field}
                    value={control.value}
                    onValueChange={(value) => control.onChange(value)}
                    options={PERIOD_OPTIONS}
                    disabled={isSubmitting}
                  />
                )}
              />
            )}
          </FormRow>
          <FormRow
            label="Start date"
            hint="Billing starts on this date."
            required
            error={errors.startDate?.message}
          >
            {({ id, ...field }) => (
              <Input
                id={id}
                type="date"
                disabled={isSubmitting}
                {...field}
                {...form.register('startDate')}
              />
            )}
          </FormRow>
        </FormCard>
      </form>
    </FormPage>
  )
}
