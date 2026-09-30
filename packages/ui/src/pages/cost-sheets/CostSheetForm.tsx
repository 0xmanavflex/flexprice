import { useForm, type Resolver } from 'react-hook-form'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { type CreateCostSheet, createCostSheetSchema, emptyCostSheet } from '@fp/domain'
import { Input } from '@ui/components/primitives/input'
import { Textarea } from '@ui/components/primitives/textarea'
import { Field } from '@ui/compositions/Field'
import { FormActions } from '@ui/compositions/FormActions'
import { provenance } from '@ui/provenance'

/**
 * Create or edit a cost sheet's details: name, lookup key, description.
 *
 * Presentational: it emits a validated `CreateCostSheet` and never imports
 * `@fp/query`. The backend treats a blank field on update as "unchanged", so an
 * edit cannot empty a key or description — the hint says so.
 */
export const CostSheetFormProvenance = provenance({
  source: 'composition',
  composes: ['ui/input', 'ui/textarea', 'ui/label'],
  note: 'RHF + the domain schema. Prices are attached afterwards.',
})

export interface CostSheetFormProps {
  mode: 'create' | 'edit'
  defaultValue?: CreateCostSheet
  onSubmit: (costSheet: CreateCostSheet) => void
  onCancel?: () => void
  isSubmitting?: boolean
  submitError?: string | null
}

export function CostSheetForm({
  mode,
  defaultValue,
  onSubmit,
  onCancel,
  isSubmitting = false,
  submitError = null,
}: CostSheetFormProps) {
  const form = useForm<CreateCostSheet>({
    resolver: standardSchemaResolver(createCostSheetSchema) as Resolver<CreateCostSheet>,
    defaultValues: defaultValue ?? emptyCostSheet(),
    mode: 'onTouched',
  })

  const errors = form.formState.errors

  return (
    <form
      onSubmit={form.handleSubmit((values) => onSubmit(values))}
      noValidate
      className="flex flex-col gap-5"
    >
      <Field label="Name" required error={errors.name?.message}>
        {({ id, ...field }) => (
          <Input id={id} disabled={isSubmitting} {...field} {...form.register('name')} />
        )}
      </Field>

      <Field
        label="Lookup key"
        hint="A stable identifier to reference the cost sheet by. Optional."
        error={errors.lookupKey?.message}
      >
        {({ id, ...field }) => (
          <Input id={id} disabled={isSubmitting} {...field} {...form.register('lookupKey')} />
        )}
      </Field>

      <Field
        label="Description"
        {...(mode === 'edit' ? { hint: 'A blank field leaves the saved value unchanged.' } : {})}
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
      </Field>

      <FormActions
        mode={mode}
        noun="cost sheet"
        onCancel={onCancel}
        isSubmitting={isSubmitting}
        submitError={submitError}
      />
    </form>
  )
}
