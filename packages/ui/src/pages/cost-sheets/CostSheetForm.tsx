import { useForm, type Resolver } from 'react-hook-form'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { type CreateCostSheet, createCostSheetSchema, emptyCostSheet } from '@fp/domain'
import { Input } from '@ui/components/primitives/input'
import { Textarea } from '@ui/components/primitives/textarea'
import { FormCard, FormRow } from '@ui/compositions/FormCard'
import { FormPage } from '@ui/compositions/FormPage'
import type { DetailCrumb } from '@ui/compositions/DetailShell'
import { provenance } from '@ui/provenance'
import { CostSheetSummaryCard } from './CostSheetSummaryCard'

/**
 * Create or edit a cost sheet's details on one page: Details (name, description) and
 * Reference (lookup key) cards, with a compact summary rail on create.
 *
 * Presentational: it emits a validated `CreateCostSheet` and never imports
 * `@fp/query`. The backend treats a blank field on update as "unchanged", so an
 * edit cannot empty a key or description — the hint says so.
 */
export const CostSheetFormProvenance = provenance({
  source: 'composition',
  composes: [
    'ui/input',
    'ui/textarea',
    'compositions/form-card',
    'compositions/form-page',
    'pages/cost-sheet-summary-card',
  ],
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
  const isEdit = mode === 'edit'

  const formEl = (
    <form
      id={FORM_ID}
      onSubmit={form.handleSubmit((values) => onSubmit(values))}
      noValidate
      className="flex flex-col gap-6"
    >
      <FormCard
        title="Details"
        status="required"
        description="What this cost sheet is called and what it covers."
      >
        <FormRow label="Name" required error={errors.name?.message}>
          {({ id, ...field }) => (
            <Input id={id} disabled={isSubmitting} {...field} {...form.register('name')} />
          )}
        </FormRow>

        <FormRow
          align="start"
          label="Description"
          {...(isEdit ? { hint: 'A blank field leaves the saved value unchanged.' } : {})}
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

      <FormCard
        title="Reference"
        status="optional"
        description="How other systems refer to this cost sheet."
      >
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
      description={
        isEdit
          ? 'Update the cost sheet’s details.'
          : 'Record what each unit of usage costs you, so margin can be measured.'
      }
      trail={trail}
      width={isEdit ? 'narrow' : 'wide'}
      toolbar={{
        mode: mode,
        noun: 'cost sheet',
        formId: FORM_ID,
        onCancel,
        isSubmitting,
        submitError,
      }}
    >
      {isEdit ? (
        formEl
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start">
          <div className="min-w-0">{formEl}</div>
          <div className="flex flex-col gap-4 lg:sticky lg:top-4">
            <CostSheetSummaryCard
              name={form.watch('name') ?? ''}
              lookupKey={form.watch('lookupKey') ?? ''}
              description={form.watch('description') ?? ''}
            />
          </div>
        </div>
      )}
    </FormPage>
  )
}
