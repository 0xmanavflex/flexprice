import { useCalmForm } from '@ui/compositions/forms/useCalmForm'
import { Controller, type Resolver } from 'react-hook-form'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import {
  CUSTOMER_TAX_TREATMENT_LABEL,
  type CreateCustomer,
  CustomerTaxTreatment,
  createCustomerSchema,
  emptyCustomer,
  KEY_PREFIX,
  countryOptions,
  suggestKey,
} from '@fp/domain'
import { Input } from '@ui/components/primitives/input'
import { FormCard, FormRow } from '@ui/compositions/forms/FormCard'
import { FormDisclosure } from '@ui/compositions/forms/FormDisclosure'
import { FormPage } from '@ui/compositions/forms/FormPage'
import type { DetailCrumb } from '@ui/compositions/detail/DetailShell'
import { OptionCombobox } from '@ui/compositions/forms/OptionCombobox'
import { OptionSelect } from '@ui/compositions/forms/OptionSelect'
import { TimezoneCombobox } from '@ui/compositions/forms/TimezoneCombobox'
import { provenance } from '@ui/provenance'

/**
 * Create or edit a customer on its own page: name, ID and email, then billing configuration (tax treatment, timezone), then the billing address under a disclosure.
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
    'compositions/option-select',
    'compositions/option-combobox',
    'compositions/timezone-combobox',
    'compositions/form-disclosure',
  ],
  note: 'RHF + the domain schema, one page: name, external ID and email up front, a Billing configuration card (tax treatment, timezone) shown on create and edit, the address folded under Billing address, no preview rail. Create and edit share it. Lineage: compositions/field.',
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

const ADDRESS_FIELDS = [
  'addressLine1',
  'addressLine2',
  'addressCity',
  'addressState',
  'addressPostalCode',
  'addressCountry',
] as const satisfies readonly (keyof CreateCustomer)[]

/** Countries, named in the viewer's language and found by name or code. */
const COUNTRY_CHOICES = countryOptions().map((option) => ({
  value: option.code,
  label: option.label,
}))

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
  const form = useCalmForm<CreateCustomer>({
    resolver: standardSchemaResolver(createCustomerSchema) as Resolver<CreateCustomer>,
    defaultValues: defaultValue ?? emptyCustomer(),
  })

  const nameField = form.register('name', {
    onChange: (event: { target: { value: string } }) => {
      // The externalId follows the name until the person types one of their own.
      if (!isEdit && !form.getFieldState('externalId').isDirty) {
        form.setValue('externalId', suggestKey(KEY_PREFIX.customer, event.target.value), {
          shouldValidate: form.formState.isSubmitted,
        })
      }
    },
  })

  const errors = form.formState.errors

  const submitAll = form.handleSubmit((values) => onSubmit(values))

  const detailsRows = (
    <>
      <FormRow
        label="Name"
        hint="The customer's display name on invoices and in the console."
        required
        error={errors.name?.message}
      >
        {({ id, ...field }) => <Input id={id} disabled={isSubmitting} {...field} {...nameField} />}
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
      <FormRow
        label="Email"
        hint="Where invoices and billing emails are sent."
        error={errors.email?.message}
      >
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
    </>
  )

  const addressRows = (
    <>
      <FormRow
        label="Address line 1"
        hint="Street address printed on invoices."
        error={errors.addressLine1?.message}
      >
        {({ id, ...field }) => (
          <Input id={id} disabled={isSubmitting} {...field} {...form.register('addressLine1')} />
        )}
      </FormRow>
      <FormRow
        label="Address line 2"
        hint="Apartment, suite or unit. Optional."
        error={errors.addressLine2?.message}
      >
        {({ id, ...field }) => (
          <Input id={id} disabled={isSubmitting} {...field} {...form.register('addressLine2')} />
        )}
      </FormRow>
      <FormRow
        label="City"
        hint="City or town for the billing address."
        error={errors.addressCity?.message}
      >
        {({ id, ...field }) => (
          <Input id={id} disabled={isSubmitting} {...field} {...form.register('addressCity')} />
        )}
      </FormRow>
      <FormRow label="State" hint="State, province or region." error={errors.addressState?.message}>
        {({ id, ...field }) => (
          <Input id={id} disabled={isSubmitting} {...field} {...form.register('addressState')} />
        )}
      </FormRow>
      <FormRow
        label="Postal code"
        hint="ZIP or postal code."
        error={errors.addressPostalCode?.message}
      >
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
        hint="Stored as the two-letter code; search by name."
        error={errors.addressCountry?.message}
      >
        {({ id, ...field }) => (
          <Controller
            control={form.control}
            name="addressCountry"
            render={({ field: control }) => (
              <OptionCombobox
                id={id}
                {...field}
                searchable
                value={control.value || undefined}
                onValueChange={(value) => control.onChange(value)}
                options={COUNTRY_CHOICES}
                placeholder="Search countries…"
                emptyText="No matching country."
                disabled={isSubmitting}
              />
            )}
          />
        )}
      </FormRow>
    </>
  )

  const billingRows = (
    <>
      <FormRow
        label="Tax treatment"
        hint="How tax is handled on this customer's invoices."
        error={errors.taxTreatment?.message}
      >
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
      <FormRow
        label="Timezone"
        hint="The customer's local time zone, e.g. Europe/London."
        error={errors.timezone?.message}
      >
        {({ id, ...field }) => (
          <Controller
            control={form.control}
            name="timezone"
            render={({ field: control }) => (
              <TimezoneCombobox
                id={id}
                {...field}
                value={control.value || undefined}
                onValueChange={(value) => control.onChange(value)}
                disabled={isSubmitting}
              />
            )}
          />
        )}
      </FormRow>
    </>
  )

  const formEl = (
    <form id={FORM_ID} onSubmit={(event) => void submitAll(event)} noValidate>
      <div className="flex flex-col gap-5">
        <FormCard title="Customer details" status="required">
          {detailsRows}
        </FormCard>
        <FormCard
          title="Billing configuration"
          status="optional"
          description="How this customer is taxed and which time zone their billing runs in."
        >
          {billingRows}
        </FormCard>
        <FormDisclosure
          title="Billing address"
          summary="Printed on invoices. Optional."
          defaultOpen={isEdit}
          forceOpen={ADDRESS_FIELDS.some((name) => errors[name])}
        >
          {addressRows}
        </FormDisclosure>
      </div>
    </form>
  )

  return (
    <FormPage
      title={isEdit ? `Edit ${customerName || 'customer'}` : 'Create customer'}
      trail={trail}
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
