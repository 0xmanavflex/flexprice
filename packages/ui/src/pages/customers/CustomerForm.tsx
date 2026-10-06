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
import { FormCard, FormRow } from '@ui/compositions/FormCard'
import { FormPage } from '@ui/compositions/FormPage'
import type { DetailCrumb } from '@ui/compositions/DetailShell'
import { OptionSelect } from '@ui/compositions/OptionSelect'
import { provenance } from '@ui/provenance'
import { CustomerPreviewCard } from './CustomerPreviewCard'

/**
 * Create or edit a customer on its own page: details, billing address, additional.
 *
 * Presentational: it emits a validated `CreateCustomer` (an edit carries the
 * same fields) and never imports `@fp/query`. The external ID is the key the
 * customer's events are matched on, so the hint says what it is for.
 */
export const CustomerFormProvenance = provenance({
  source: 'composition',
  composes: ['ui/input', 'compositions/form-page', 'compositions/option-select'],
  note: 'RHF + the domain schema, one page: details, billing address, additional, with a live profile rail on create. Create and edit share it. Lineage: compositions/field.',
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
}

const FORM_ID = 'customer-form'

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
}: CustomerFormProps) {
  const isEdit = mode === 'edit'
  const form = useForm<CreateCustomer>({
    resolver: standardSchemaResolver(createCustomerSchema) as Resolver<CreateCustomer>,
    defaultValues: defaultValue ?? emptyCustomer(),
    mode: 'onTouched',
  })

  const errors = form.formState.errors

  const submitAll = form.handleSubmit((values) => onSubmit(values))

  const detailsStep = (
    <FormCard title="Details" status="required">
      <FormRow label="Name" required error={errors.name?.message}>
        {({ id, ...field }) => (
          <Input id={id} disabled={isSubmitting} {...field} {...form.register('name')} />
        )}
      </FormRow>
      <FormRow
        label="External ID"
        required
        hint="Your own identifier. Usage events are matched to the customer by it."
        error={errors.externalId?.message}
      >
        {({ id, ...field }) => (
          <Input id={id} disabled={isSubmitting} {...field} {...form.register('externalId')} />
        )}
      </FormRow>
      <FormRow label="Email" error={errors.email?.message}>
        {({ id, ...field }) => (
          <Input
            id={id}
            type="email"
            disabled={isSubmitting}
            {...field}
            {...form.register('email')}
          />
        )}
      </FormRow>
      <FormRow label="Phone" error={errors.phone?.message}>
        {({ id, ...field }) => (
          <Input
            id={id}
            type="tel"
            disabled={isSubmitting}
            {...field}
            {...form.register('phone')}
          />
        )}
      </FormRow>
    </FormCard>
  )

  const addressStep = (
    <FormCard title="Billing address" status="optional">
      <FormRow label="Address line 1" error={errors.addressLine1?.message}>
        {({ id, ...field }) => (
          <Input id={id} disabled={isSubmitting} {...field} {...form.register('addressLine1')} />
        )}
      </FormRow>
      <FormRow label="Address line 2" error={errors.addressLine2?.message}>
        {({ id, ...field }) => (
          <Input id={id} disabled={isSubmitting} {...field} {...form.register('addressLine2')} />
        )}
      </FormRow>
      <FormRow label="City" error={errors.addressCity?.message}>
        {({ id, ...field }) => (
          <Input id={id} disabled={isSubmitting} {...field} {...form.register('addressCity')} />
        )}
      </FormRow>
      <FormRow label="State" error={errors.addressState?.message}>
        {({ id, ...field }) => (
          <Input id={id} disabled={isSubmitting} {...field} {...form.register('addressState')} />
        )}
      </FormRow>
      <FormRow label="Postal code" error={errors.addressPostalCode?.message}>
        {({ id, ...field }) => (
          <Input
            id={id}
            disabled={isSubmitting}
            {...field}
            {...form.register('addressPostalCode')}
          />
        )}
      </FormRow>
      <FormRow
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
      </FormRow>
    </FormCard>
  )

  const additionalStep = (
    <FormCard title="Additional" status="optional">
      <FormRow
        label="Timezone"
        hint="An IANA name, e.g. Europe/London."
        error={errors.timezone?.message}
      >
        {({ id, ...field }) => (
          <Input id={id} disabled={isSubmitting} {...field} {...form.register('timezone')} />
        )}
      </FormRow>
      <FormRow label="Tax treatment" error={errors.taxTreatment?.message}>
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
      </FormRow>
    </FormCard>
  )

  const formEl = (
    <form
      id={FORM_ID}
      onSubmit={(event) => void submitAll(event)}
      noValidate
      className="flex flex-col gap-6"
    >
      {detailsStep}
      {addressStep}
      {additionalStep}
    </form>
  )

  return (
    <FormPage
      title={isEdit ? `Edit ${customerName || 'customer'}` : 'Create customer'}
      description={
        isEdit
          ? 'Update this customer.'
          : 'Add someone you bill. Subscriptions and invoices are attached afterwards.'
      }
      trail={trail}
      width={isEdit ? 'narrow' : 'wide'}
      preview={
        isEdit ? undefined : (
          <CustomerPreviewCard
            name={form.watch('name')}
            externalId={form.watch('externalId')}
            email={form.watch('email')}
            phone={form.watch('phone')}
            addressLine1={form.watch('addressLine1')}
            addressLine2={form.watch('addressLine2')}
            addressCity={form.watch('addressCity')}
            addressState={form.watch('addressState')}
            addressPostalCode={form.watch('addressPostalCode')}
            addressCountry={form.watch('addressCountry')}
            timezone={form.watch('timezone')}
            taxTreatment={form.watch('taxTreatment')}
          />
        )
      }
      toolbar={{
        mode: mode,
        noun: 'customer',
        formId: FORM_ID,
        onCancel,
        isSubmitting,
        submitError,
      }}
    >
      {formEl}
    </FormPage>
  )
}
