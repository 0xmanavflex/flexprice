import { Controller, useForm, type Resolver } from 'react-hook-form'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import {
  CUSTOMER_TAX_TREATMENT_LABEL,
  type CreateCustomer,
  CustomerTaxTreatment,
  createCustomerSchema,
  emptyCustomer,
} from '@fp/domain'
import { Input } from '@ui/components/primitives/input'
import type { ReactNode } from 'react'
import { Field } from '@ui/compositions/Field'
import { FormPage } from '@ui/compositions/FormPage'
import { FormSteps, StepFooter, useFormSteps } from '@ui/compositions/useFormSteps'
import type { DetailCrumb } from '@ui/compositions/DetailShell'
import { OptionSelect } from '@ui/compositions/OptionSelect'
import { provenance } from '@ui/provenance'

/**
 * Create or edit a customer on its own page: details, billing address, additional.
 *
 * Presentational: it emits a validated `CreateCustomer` (an edit carries the
 * same fields) and never imports `@fp/query`. The external ID is the key the
 * customer's events are matched on, so the hint says what it is for.
 */
export const CustomerFormProvenance = provenance({
  source: 'composition',
  composes: [
    'ui/input',
    'compositions/form-page',
    'compositions/field',
    'compositions/option-select',
  ],
  note: 'RHF + the domain schema, stepped: details, billing address, additional. Create and edit share it.',
})

export interface CustomerFormProps {
  mode: 'create' | 'edit'
  defaultValue?: CreateCustomer
  /** The customer's name, for the edit page title. */
  customerName?: string
  onSubmit: (customer: CreateCustomer) => void
  onCancel: () => void
  isSubmitting?: boolean
  submitError?: string | null
  trail: DetailCrumb[]
  step?: string
  onStepChange?: (id: string) => void
}

const FORM_ID = 'customer-form'

const STEPS = [
  { id: 'details', title: 'Details' },
  { id: 'address', title: 'Billing address' },
  { id: 'additional', title: 'Additional' },
] as const

const STEP_FIELDS: Record<string, (keyof CreateCustomer)[]> = {
  details: ['name', 'externalId', 'email', 'phone'],
  address: [
    'addressLine1',
    'addressLine2',
    'addressCity',
    'addressState',
    'addressPostalCode',
    'addressCountry',
  ],
  additional: ['timezone', 'taxTreatment'],
}

const TAX_OPTIONS = Object.values(CustomerTaxTreatment).map((value) => ({
  value,
  label: CUSTOMER_TAX_TREATMENT_LABEL[value],
}))

export function CustomerForm({
  mode,
  defaultValue,
  customerName,
  onSubmit,
  onCancel,
  isSubmitting = false,
  submitError = null,
  trail,
  step,
  onStepChange,
}: CustomerFormProps) {
  const isEdit = mode === 'edit'
  const form = useForm<CreateCustomer>({
    resolver: standardSchemaResolver(createCustomerSchema) as Resolver<CreateCustomer>,
    defaultValues: defaultValue ?? emptyCustomer(),
    mode: 'onTouched',
  })

  const errors = form.formState.errors

  const flow = useFormSteps({
    steps: STEPS,
    step,
    onStepChange,
    unlockAll: isEdit,
    validate: (id) => form.trigger(STEP_FIELDS[id] as never),
  })

  const submitAll = form.handleSubmit(
    (values) => onSubmit(values),
    (failed) => {
      // Send the person to the first step that has something to fix.
      const bad = flow.steps.find((s) =>
        STEP_FIELDS[s.id]?.some((field) => failed[field] !== undefined),
      )
      if (bad) flow.goTo(bad.id)
    },
  )

  const detailsStep = (
    <>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Name" required error={errors.name?.message}>
          {({ id, ...field }) => (
            <Input id={id} disabled={isSubmitting} {...field} {...form.register('name')} />
          )}
        </Field>
        <Field
          label="External ID"
          required
          hint="Your own identifier. Usage events are matched to the customer by it."
          error={errors.externalId?.message}
        >
          {({ id, ...field }) => (
            <Input id={id} disabled={isSubmitting} {...field} {...form.register('externalId')} />
          )}
        </Field>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Email" error={errors.email?.message}>
          {({ id, ...field }) => (
            <Input
              id={id}
              type="email"
              disabled={isSubmitting}
              {...field}
              {...form.register('email')}
            />
          )}
        </Field>
        <Field label="Phone" error={errors.phone?.message}>
          {({ id, ...field }) => (
            <Input
              id={id}
              type="tel"
              disabled={isSubmitting}
              {...field}
              {...form.register('phone')}
            />
          )}
        </Field>
      </div>
    </>
  )

  const addressStep = (
    <div className="grid gap-5 sm:grid-cols-2">
      <Field label="Address line 1" error={errors.addressLine1?.message}>
        {({ id, ...field }) => (
          <Input id={id} disabled={isSubmitting} {...field} {...form.register('addressLine1')} />
        )}
      </Field>
      <Field label="Address line 2" error={errors.addressLine2?.message}>
        {({ id, ...field }) => (
          <Input id={id} disabled={isSubmitting} {...field} {...form.register('addressLine2')} />
        )}
      </Field>
      <Field label="City" error={errors.addressCity?.message}>
        {({ id, ...field }) => (
          <Input id={id} disabled={isSubmitting} {...field} {...form.register('addressCity')} />
        )}
      </Field>
      <Field label="State" error={errors.addressState?.message}>
        {({ id, ...field }) => (
          <Input id={id} disabled={isSubmitting} {...field} {...form.register('addressState')} />
        )}
      </Field>
      <Field label="Postal code" error={errors.addressPostalCode?.message}>
        {({ id, ...field }) => (
          <Input
            id={id}
            disabled={isSubmitting}
            {...field}
            {...form.register('addressPostalCode')}
          />
        )}
      </Field>
      <Field
        label="Country"
        hint="Two-letter code, e.g. GB."
        error={errors.addressCountry?.message}
      >
        {({ id, ...field }) => (
          <Input
            id={id}
            maxLength={2}
            disabled={isSubmitting}
            {...field}
            {...form.register('addressCountry')}
          />
        )}
      </Field>
    </div>
  )

  const additionalStep = (
    <div className="grid gap-5 sm:grid-cols-2">
      <Field
        label="Timezone"
        hint="An IANA name, e.g. Europe/London."
        error={errors.timezone?.message}
      >
        {({ id, ...field }) => (
          <Input id={id} disabled={isSubmitting} {...field} {...form.register('timezone')} />
        )}
      </Field>
      <Field label="Tax treatment" error={errors.taxTreatment?.message}>
        {({ id, ...field }) => (
          <Controller
            control={form.control}
            name="taxTreatment"
            render={({ field: control }) => (
              <OptionSelect
                id={id}
                {...field}
                value={control.value ?? CustomerTaxTreatment.Taxable}
                onValueChange={(value) => control.onChange(value)}
                options={TAX_OPTIONS}
                disabled={isSubmitting}
              />
            )}
          />
        )}
      </Field>
    </div>
  )

  const content: Record<string, ReactNode> = {
    details: detailsStep,
    address: addressStep,
    additional: additionalStep,
  }

  return (
    <FormPage
      title={isEdit ? `Edit ${customerName || 'customer'}` : 'Create customer'}
      description={
        isEdit
          ? 'Update this customer. Steps are the same as when it was created.'
          : 'Add someone you bill. Subscriptions and invoices are attached afterwards.'
      }
      trail={trail}
      width="narrow"
      footer={
        <StepFooter
          flow={flow}
          mode={mode}
          noun="customer"
          formId={FORM_ID}
          onCancel={onCancel}
          isSubmitting={isSubmitting}
          submitError={submitError}
        />
      }
    >
      <FormSteps flow={flow} label="Customer steps">
        <form
          id={FORM_ID}
          onSubmit={flow.guardSubmit(submitAll)}
          noValidate
          className="flex flex-col gap-5"
        >
          {content[flow.step]}
        </form>
      </FormSteps>
    </FormPage>
  )
}
