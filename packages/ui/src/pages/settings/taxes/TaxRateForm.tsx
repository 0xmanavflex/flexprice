import { useCalmForm } from '@ui/compositions/forms/useCalmForm'
import { Controller, type Resolver } from 'react-hook-form'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import {
  type CreateTaxRate,
  type EditTaxRate,
  TAX_RATE_STATUS_LABEL,
  TaxRateStatus,
  createTaxRateSchema,
  editTaxRateSchema,
  emptyTaxRate,
  suggestTaxCode,
} from '@fp/domain'
import { Input } from '@ui/components/primitives/input'
import { Textarea } from '@ui/components/primitives/textarea'
import { FormCard, FormRow } from '@ui/compositions/forms/FormCard'
import { FormPage } from '@ui/compositions/forms/FormPage'
import type { DetailCrumb } from '@ui/compositions/detail/DetailShell'
import { OptionSelect } from '@ui/compositions/forms/OptionSelect'
import { provenance } from '@ui/provenance'

/**
 * Tax rate pages: `TaxRateCreateForm` collects the whole rate; `TaxRateEditForm`
 * changes only what the API lets change (name, code, description, status),
 * because invoices already carry the value and scope.
 *
 * Presentational: each emits a validated draft and never imports `@fp/query`.
 * The percentage stays a string end to end: it is never parsed into a number.
 */
export const TaxRateFormProvenance = provenance({
  source: 'composition',
  composes: ['ui/input', 'ui/textarea', 'compositions/form-card', 'compositions/form-page'],
  note: 'RHF + the domain schemas. Create takes the value and scope; edit renames, recodes and archives.',
})

interface TaxRateFormBase {
  onCancel?: () => void
  isSubmitting?: boolean
  submitError?: string | null
  trail: DetailCrumb[]
}

export interface TaxRateCreateFormProps extends TaxRateFormBase {
  defaultValue?: CreateTaxRate
  onSubmit: (taxRate: CreateTaxRate) => void
}

export interface TaxRateEditFormProps extends TaxRateFormBase {
  defaultValue: EditTaxRate
  onSubmit: (taxRate: EditTaxRate) => void
}

const STATUS_OPTIONS = [TaxRateStatus.Published, TaxRateStatus.Archived].map((value) => ({
  value,
  label: TAX_RATE_STATUS_LABEL[value],
}))

export function TaxRateCreateForm({
  defaultValue,
  onSubmit,
  onCancel,
  isSubmitting = false,
  submitError = null,
  trail,
}: TaxRateCreateFormProps) {
  const form = useCalmForm<CreateTaxRate>({
    resolver: standardSchemaResolver(createTaxRateSchema) as Resolver<CreateTaxRate>,
    defaultValues: defaultValue ?? emptyTaxRate(),
  })

  const nameField = form.register('name', {
    onChange: (event: { target: { value: string } }) => {
      // The code follows the name until the person types one of their own.
      if (!form.getFieldState('code').isDirty) {
        form.setValue('code', suggestTaxCode(event.target.value), {
          shouldValidate: form.formState.isSubmitted,
        })
      }
    },
  })

  const errors = form.formState.errors

  return (
    <FormPage
      title="Create tax rate"
      trail={trail}
      width="narrow"
      toolbar={{
        mode: 'create',
        noun: 'tax rate',
        formId: 'tax-rate-create-form',
        onCancel,
        isSubmitting,
        submitError,
      }}
    >
      <form
        id="tax-rate-create-form"
        onSubmit={form.handleSubmit((values) => onSubmit(values))}
        noValidate
      >
        <FormCard title="Tax rate details" status="required">
          <FormRow
            label="Name"
            hint="What the tax rate is called on invoices."
            required
            error={errors.name?.message}
          >
            {({ id, ...field }) => (
              <Input id={id} disabled={isSubmitting} {...field} {...nameField} />
            )}
          </FormRow>
          <FormRow
            label="Code"
            required
            hint="Letters, numbers, hyphens and underscores. Case-sensitive."
            error={errors.code?.message}
          >
            {({ id, ...field }) => (
              <Input id={id} disabled={isSubmitting} {...field} {...form.register('code')} />
            )}
          </FormRow>

          <FormRow
            label="Rate (%)"
            hint="The percentage added to taxable amounts."
            required
            error={errors.percentageValue?.message}
          >
            {({ id, ...field }) => (
              <Input
                id={id}
                inputMode="decimal"
                placeholder="18"
                disabled={isSubmitting}
                {...field}
                {...form.register('percentageValue')}
              />
            )}
          </FormRow>
          <FormRow
            label="Description"
            hint="An internal note about when this rate applies. Optional."
            align="start"
            error={errors.description?.message}
          >
            {({ id, ...field }) => (
              <Textarea
                id={id}
                rows={3}
                disabled={isSubmitting}
                {...field}
                {...form.register('description')}
              />
            )}
          </FormRow>
        </FormCard>
      </form>
    </FormPage>
  )
}

export function TaxRateEditForm({
  defaultValue,
  onSubmit,
  onCancel,
  isSubmitting = false,
  submitError = null,
  trail,
}: TaxRateEditFormProps) {
  const form = useCalmForm<EditTaxRate>({
    resolver: standardSchemaResolver(editTaxRateSchema) as Resolver<EditTaxRate>,
    defaultValues: defaultValue,
  })

  const errors = form.formState.errors

  return (
    <FormPage
      title="Edit tax rate"
      trail={trail}
      width="narrow"
      toolbar={{
        mode: 'edit',
        noun: 'tax rate',
        formId: 'tax-rate-edit-form',
        onCancel,
        isSubmitting,
        submitError,
      }}
    >
      <form
        id="tax-rate-edit-form"
        onSubmit={form.handleSubmit((values) => onSubmit(values))}
        noValidate
      >
        <FormCard title="Tax rate details" status="required">
          <FormRow
            label="Name"
            hint="What the tax rate is called on invoices."
            required
            error={errors.name?.message}
          >
            {({ id, ...field }) => (
              <Input id={id} disabled={isSubmitting} {...field} {...form.register('name')} />
            )}
          </FormRow>
          <FormRow
            label="Code"
            hint="Stable identifier used by the API and by tax associations."
            required
            error={errors.code?.message}
          >
            {({ id, ...field }) => (
              <Input id={id} disabled={isSubmitting} {...field} {...form.register('code')} />
            )}
          </FormRow>

          <FormRow
            label="Status"
            hint="Whether the rate can be attached to customers."
            error={errors.status?.message}
          >
            {({ id, ...field }) => (
              <Controller
                control={form.control}
                name="status"
                render={({ field: control }) => (
                  <OptionSelect
                    id={id}
                    {...field}
                    value={control.value ?? TaxRateStatus.Published}
                    onValueChange={(value) => control.onChange(value)}
                    options={STATUS_OPTIONS}
                    disabled={isSubmitting}
                  />
                )}
              />
            )}
          </FormRow>

          <FormRow
            label="Description"
            hint="An internal note about when this rate applies. Optional."
            align="start"
            error={errors.description?.message}
          >
            {({ id, ...field }) => (
              <Textarea
                id={id}
                rows={3}
                disabled={isSubmitting}
                {...field}
                {...form.register('description')}
              />
            )}
          </FormRow>
        </FormCard>
      </form>
    </FormPage>
  )
}
