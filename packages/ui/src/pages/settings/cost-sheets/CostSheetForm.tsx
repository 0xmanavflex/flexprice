import { useCalmForm } from '@ui/compositions/forms/useCalmForm'
import { type Resolver } from 'react-hook-form'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import {
  type CreateCostSheet,
  createCostSheetSchema,
  emptyCostSheet,
  KEY_PREFIX,
  suggestKey,
} from '@fp/domain'
import { Input } from '@ui/components/primitives/input'
import { Textarea } from '@ui/components/primitives/textarea'
import { FormCard, FormRow } from '@ui/compositions/forms/FormCard'
import { FormPage } from '@ui/compositions/forms/FormPage'
import type { DetailCrumb } from '@ui/compositions/detail/DetailShell'
import { provenance } from '@ui/provenance'

/**
 * Create or edit a cost sheet's details on one page: Details (name, description) and
 * Reference (lookup key) cards. No summary rail.
 * TODO(checkout-review): a preview returns only on a future checkout review screen.
 *
 * Presentational: it emits a validated `CreateCostSheet` and never imports
 * `@fp/query`. The backend treats a blank field on update as "unchanged", so an
 * edit cannot empty a key or description: the hint says so.
 */
export const CostSheetFormProvenance = provenance({
  source: 'composition',
  composes: ['ui/input', 'ui/textarea', 'compositions/form-card', 'compositions/form-page'],
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
  const form = useCalmForm<CreateCostSheet>({
    resolver: standardSchemaResolver(createCostSheetSchema) as Resolver<CreateCostSheet>,
    defaultValues: defaultValue ?? emptyCostSheet(),
  })

  const errors = form.formState.errors
  const isEdit = mode === 'edit'

  const nameField = form.register('name', {
    onChange: (event: { target: { value: string } }) => {
      // The lookupKey follows the name until the person types one of their own.
      if (!isEdit && !form.getFieldState('lookupKey').isDirty) {
        form.setValue('lookupKey', suggestKey(KEY_PREFIX.costSheet, event.target.value), {
          shouldValidate: form.formState.isSubmitted,
        })
      }
    },
  })

  const formEl = (
    <form id={FORM_ID} onSubmit={form.handleSubmit((values) => onSubmit(values))} noValidate>
      <FormCard title="Cost sheet details" status="required">
        <FormRow
          label="Name"
          hint="What the cost sheet is called in reports."
          required
          error={errors.name?.message}
        >
          {({ id, ...field }) => (
            <Input id={id} disabled={isSubmitting} {...field} {...nameField} />
          )}
        </FormRow>

        <FormRow
          align="start"
          label="Description"
          hint={
            isEdit
              ? 'A blank field leaves the saved value unchanged.'
              : 'What costs the sheet tracks. Optional.'
          }
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

        <FormRow
          label="Lookup key"
          hint="A stable identifier to reference the cost sheet by. Optional."
          error={errors.lookupKey?.message}
        >
          {({ id, ...field }) => (
            <Input id={id} disabled={isSubmitting} {...field} {...form.register('lookupKey')} />
          )}
        </FormRow>
      </FormCard>
    </form>
  )

  return (
    <FormPage
      title={isEdit ? `Edit ${defaultValue?.name || 'cost sheet'}` : 'Create cost sheet'}
      trail={trail}
      toolbar={{
        mode: mode,
        noun: 'cost sheet',
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
