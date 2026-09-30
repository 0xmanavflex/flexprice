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
import { Field } from '@ui/compositions/Field'
import { FormActions } from '@ui/compositions/FormActions'
import { OptionSelect } from '@ui/compositions/OptionSelect'
import { provenance } from '@ui/provenance'

/**
 * Create or edit a customer: identity, contact, tax treatment and address.
 *
 * Presentational: it emits a validated `CreateCustomer` (an edit carries the
 * same fields) and never imports `@fp/query`. The external ID is the key the
 * customer's events are matched on, so the hint says what it is for.
 */
export const CustomerFormProvenance = provenance({
  source: 'composition',
  composes: ['ui/input', 'ui/label', 'compositions/field', 'compositions/option-select'],
  note: 'RHF + the domain schema. Identity, contact, tax treatment and billing address.',
})

export interface CustomerFormProps {
  mode: 'create' | 'edit'
  defaultValue?: CreateCustomer
  onSubmit: (customer: CreateCustomer) => void
  onCancel?: () => void
  isSubmitting?: boolean
  submitError?: string | null
}

const TAX_OPTIONS = Object.values(CustomerTaxTreatment).map((value) => ({
  value,
  label: CUSTOMER_TAX_TREATMENT_LABEL[value],
}))

export function CustomerForm({
  mode,
  defaultValue,
  onSubmit,
  onCancel,
  isSubmitting = false,
  submitError = null,
}: CustomerFormProps) {
  const form = useForm<CreateCustomer>({
    resolver: standardSchemaResolver(createCustomerSchema) as Resolver<CreateCustomer>,
    defaultValues: defaultValue ?? emptyCustomer(),
    mode: 'onTouched',
  })

  const errors = form.formState.errors

  return (
    <form
      onSubmit={form.handleSubmit((values) => onSubmit(values))}
      noValidate
      className="flex flex-col gap-5"
    >
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
            <Input id={id} type="tel" disabled={isSubmitting} {...field} {...form.register('phone')} />
          )}
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Timezone" hint="An IANA name, e.g. Europe/London." error={errors.timezone?.message}>
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

      <FormActions
        mode={mode}
        noun="customer"
        onCancel={onCancel}
        isSubmitting={isSubmitting}
        submitError={submitError}
      />
    </form>
  )
}
