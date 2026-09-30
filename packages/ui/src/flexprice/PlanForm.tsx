import { useForm, type Resolver } from 'react-hook-form'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { type CreatePlan, createPlanSchema, emptyPlan } from '@fp/domain'
import { Input } from '@ui/primitives/input'
import { Textarea } from '@ui/primitives/textarea'
import { Field } from '@ui/compositions/Field'
import { FormActions } from '@ui/compositions/FormActions'
import { provenance } from '@ui/provenance'

/**
 * Create or edit a plan's details.
 *
 * The same presentational shape as `AddonForm`: RHF over the domain schema, a
 * validated `CreatePlan` out, no state and no `@fp/query`. What differs is the
 * plan's own rules — the lookup key is optional and stays editable, so it is a
 * plain field in both modes rather than one locked after creation.
 *
 * This is the details step only. A plan bills nothing until it has charges; that
 * editor, with entitlements and credit grants, is the larger surface added after
 * the shell exists — a "no charges yet" note points there.
 */
export const PlanFormProvenance = provenance({
  source: 'composition',
  composes: ['ui/button', 'ui/input', 'ui/textarea', 'ui/label'],
  note: 'RHF + the domain schema. Details only; charges/entitlements are a later surface.',
})

export interface PlanFormProps {
  mode: 'create' | 'edit'
  defaultValue?: CreatePlan
  onSubmit: (plan: CreatePlan) => void
  onCancel?: () => void
  isSubmitting?: boolean
  /** Server-side failure, already a sentence. */
  submitError?: string | null
}

export function PlanForm({
  mode,
  defaultValue,
  onSubmit,
  onCancel,
  isSubmitting = false,
  submitError = null,
}: PlanFormProps) {
  const form = useForm<CreatePlan>({
    resolver: standardSchemaResolver(createPlanSchema) as Resolver<CreatePlan>,
    defaultValues: defaultValue ?? emptyPlan(),
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
        hint="Optional stable identifier for the API. Lowercase, numbers and underscores."
        error={errors.lookupKey?.message}
      >
        {({ id, ...field }) => (
          <Input id={id} disabled={isSubmitting} {...field} {...form.register('lookupKey')} />
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

      <p className="text-muted-foreground text-xs">
        {mode === 'create'
          ? 'Charges, entitlements and credit grants are added after the plan is created.'
          : 'Charges, entitlements and credit grants are edited separately.'}
      </p>

      <FormActions
        mode={mode}
        noun="plan"
        onCancel={onCancel}
        isSubmitting={isSubmitting}
        submitError={submitError}
      />
    </form>
  )
}
