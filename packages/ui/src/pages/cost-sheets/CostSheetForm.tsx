import { useForm, type Resolver } from 'react-hook-form'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { type CreateCostSheet, createCostSheetSchema, emptyCostSheet } from '@fp/domain'
import { Input } from '@ui/components/primitives/input'
import { Textarea } from '@ui/components/primitives/textarea'
import { Field } from '@ui/compositions/Field'
import { FormActions } from '@ui/compositions/FormActions'
import { FormPage } from '@ui/compositions/FormPage'
import type { DetailCrumb } from '@ui/compositions/DetailShell'
import { provenance } from '@ui/provenance'

/**
 * Create or edit a cost sheet's details on a full page: name, lookup key, description.
 * One section, so a single `FormPage` with no stepper.
 *
 * Presentational: it emits a validated `CreateCostSheet` and never imports
 * `@fp/query`. The backend treats a blank field on update as "unchanged", so an
 * edit cannot empty a key or description — the hint says so.
 */
export const CostSheetFormProvenance = provenance({
  source: 'composition',
  composes: ['ui/input', 'ui/textarea', 'compositions/form-page', 'compositions/form-actions'],
  note: 'RHF + the domain schema. Prices are attached afterwards.',
})

export interface CostSheetFormProps {
  mode: 'create' | 'edit'
  defaultValue?: CreateCostSheet
  onSubmit: (costSheet: CreateCostSheet) => void
  onCancel: () => void
  /** Breadcrumb; the last crumb is the page itself. */
  trail: DetailCrumb[]
  isSubmitting?: boolean
  submitError?: string | null
}

const FORM_ID = 'cost-sheet-form'

export function CostSheetForm({
  mode,
  trail,
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
    <FormPage
      title={mode === 'create' ? 'Create cost sheet' : `Edit ${defaultValue?.name || 'cost sheet'}`}
      description={
        mode === 'create'
          ? 'Record what each unit of usage costs you, so margin can be measured.'
          : 'Update the cost sheet’s details.'
      }
      trail={trail}
      width="narrow"
      footer={
        <FormActions
          mode={mode}
          noun="cost sheet"
          formId={FORM_ID}
          onCancel={onCancel}
          isSubmitting={isSubmitting}
          submitError={submitError}
        />
      }
    >
      <form
        id={FORM_ID}
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
      </form>
    </FormPage>
  )
}
