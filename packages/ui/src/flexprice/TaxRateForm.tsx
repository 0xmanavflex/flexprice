import { Controller, useForm, type Resolver } from 'react-hook-form'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import {
  type CreateTaxRate,
  type EditTaxRate,
  TAX_RATE_SCOPE_LABEL,
  TAX_RATE_STATUS_LABEL,
  TaxRateScope,
  TaxRateStatus,
  createTaxRateSchema,
  editTaxRateSchema,
  emptyTaxRate,
} from '@fp/domain'
import { Input } from '@ui/primitives/input'
import { Textarea } from '@ui/primitives/textarea'
import { Field } from '@ui/compositions/Field'
import { FormActions } from '@ui/compositions/FormActions'
import { OptionSelect } from '@ui/compositions/OptionSelect'
import { provenance } from '@ui/provenance'

/**
 * Tax rate forms: `TaxRateCreateForm` collects the whole rate; `TaxRateEditForm`
 * changes only what the API lets change (name, code, description, status),
 * because invoices already carry the value and scope.
 *
 * Presentational: each emits a validated draft and never imports `@fp/query`.
 * The percentage stays a string end to end — it is never parsed into a number.
 */
export const TaxRateFormProvenance = provenance({
  source: 'composition',
  composes: ['ui/input', 'ui/textarea', 'ui/label', 'compositions/field'],
  note: 'RHF + the domain schemas. Create takes the value and scope; edit renames, recodes and archives.',
})

interface TaxRateFormBase {
  onCancel?: () => void
  isSubmitting?: boolean
  submitError?: string | null
}

export interface TaxRateCreateFormProps extends TaxRateFormBase {
  defaultValue?: CreateTaxRate
  onSubmit: (taxRate: CreateTaxRate) => void
}

export interface TaxRateEditFormProps extends TaxRateFormBase {
  defaultValue: EditTaxRate
  onSubmit: (taxRate: EditTaxRate) => void
}

const SCOPE_OPTIONS = Object.values(TaxRateScope).map((value) => ({
  value,
  label: TAX_RATE_SCOPE_LABEL[value],
}))

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
}: TaxRateCreateFormProps) {
  const form = useForm<CreateTaxRate>({
    resolver: standardSchemaResolver(createTaxRateSchema) as Resolver<CreateTaxRate>,
    defaultValues: defaultValue ?? emptyTaxRate(),
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
          label="Code"
          required
          hint="Letters and numbers. Case-sensitive."
          error={errors.code?.message}
        >
          {({ id, ...field }) => (
            <Input id={id} disabled={isSubmitting} {...field} {...form.register('code')} />
          )}
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Rate (%)" required error={errors.percentageValue?.message}>
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
        </Field>
        <Field
          label="Scope"
          required
          hint="Fixed once created."
          error={errors.scope?.message}
        >
          {({ id, ...field }) => (
            <Controller
              control={form.control}
              name="scope"
              render={({ field: control }) => (
                <OptionSelect
                  id={id}
                  {...field}
                  value={control.value}
                  onValueChange={(value) => control.onChange(value)}
                  options={SCOPE_OPTIONS}
                  disabled={isSubmitting}
                />
              )}
            />
          )}
        </Field>
      </div>

      <Field label="Description" error={errors.description?.message}>
        {({ id, ...field }) => (
          <Textarea
            id={id}
            rows={3}
            disabled={isSubmitting}
            {...field}
            {...form.register('description')}
          />
        )}
      </Field>

      <FormActions
        mode="create"
        noun="tax rate"
        onCancel={onCancel}
        isSubmitting={isSubmitting}
        submitError={submitError}
      />
    </form>
  )
}

export function TaxRateEditForm({
  defaultValue,
  onSubmit,
  onCancel,
  isSubmitting = false,
  submitError = null,
}: TaxRateEditFormProps) {
  const form = useForm<EditTaxRate>({
    resolver: standardSchemaResolver(editTaxRateSchema) as Resolver<EditTaxRate>,
    defaultValues: defaultValue,
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
        <Field label="Code" required error={errors.code?.message}>
          {({ id, ...field }) => (
            <Input id={id} disabled={isSubmitting} {...field} {...form.register('code')} />
          )}
        </Field>
      </div>

      <Field label="Status" error={errors.status?.message}>
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
      </Field>

      <Field label="Description" error={errors.description?.message}>
        {({ id, ...field }) => (
          <Textarea
            id={id}
            rows={3}
            disabled={isSubmitting}
            {...field}
            {...form.register('description')}
          />
        )}
      </Field>

      <FormActions
        mode="edit"
        noun="tax rate"
        onCancel={onCancel}
        isSubmitting={isSubmitting}
        submitError={submitError}
      />
    </form>
  )
}
