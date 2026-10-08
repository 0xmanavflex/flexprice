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
import { FormDisclosure } from '@ui/compositions/FormDisclosure'
import { FormPage } from '@ui/compositions/FormPage'
import type { DetailCrumb } from '@ui/compositions/DetailShell'
import { OptionSelect } from '@ui/compositions/OptionSelect'
import { provenance } from '@ui/provenance'

/**
 * Create or edit a customer on its own page: name, ID and email, then the optional rest under More details.
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
    'compositions/form-disclosure',
  ],
  note: 'RHF + the domain schema, one page: name, external ID and email up front, the rest folded under More details, with a live profile rail on create. Create and edit share it. Lineage: compositions/field.',
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

const OPTIONAL_FIELDS = [
  'phone',
  'addressLine1',
  'addressLine2',
  'addressCity',
  'addressState',
  'addressPostalCode',
  'addressCountry',
  'timezone',
  'taxTreatment',
] as const satisfies readonly (keyof CreateCustomer)[]

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

  const detailsRows = (
    <>
      <FormRow
        label="Name"
        hint="The customer's display name on invoices and in the console."
        required
        error={errors.name?.message}
      >
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
        label="Phone"
        hint="A contact number for the customer. Optional."
        error={errors.phone?.message}
      >
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
    </>
  )

  const additionalRows = (
    <>
      <FormRow
        label="Timezone"
        hint="An IANA name, e.g. Europe/London."
        error={errors.timezone?.message}
      >
        {({ id, ...field }) => (
          <Input id={id} disabled={isSubmitting} {...field} {...form.register('timezone')} />
        )}
      </FormRow>
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
    </>
  )

  const formEl = (
    <form id={FORM_ID} onSubmit={(event) => void submitAll(event)} noValidate>
      <div className="flex flex-col gap-5">
        <FormCard title="Customer details" status="required">
          {detailsRows}
        </FormCard>
        <FormDisclosure
          title="More details"
          summary="Phone, billing address, timezone and tax treatment. All optional."
          defaultOpen={isEdit}
          forceOpen={OPTIONAL_FIELDS.some((name) => errors[name])}
        >
          {addressRows}
          {additionalRows}
        </FormDisclosure>
      </div>
    </form>
  )

  return (
    <FormPage
      title={isEdit ? `Edit ${customerName || 'customer'}` : 'Create customer'}
      trail={trail}
      width="wide"
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
