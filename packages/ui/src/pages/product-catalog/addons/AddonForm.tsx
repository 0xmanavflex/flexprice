import { useCalmForm } from '@ui/compositions/forms/useCalmForm'
import { type Resolver } from 'react-hook-form'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { type CreateAddon, createAddonSchema, emptyAddon, KEY_PREFIX, suggestKey } from '@fp/domain'
import { Input } from '@ui/components/primitives/input'
import { Textarea } from '@ui/components/primitives/textarea'
import { FormCard, FormRow } from '@ui/compositions/forms/FormCard'
import { FormPage } from '@ui/compositions/forms/FormPage'
import type { DetailCrumb } from '@ui/compositions/detail/DetailShell'
import { provenance } from '@ui/provenance'

/**
 * Create or edit an add-on's details, on a full page.
 *
 * One page (no stepper): Basics (name, description), Identifier (lookup key),
 * no preview rail. Charges and entitlements are added on the detail page afterwards.
 * TODO(checkout-review): a preview returns only on a future checkout review screen.
 *
 * Presentational, like every form here: it takes a default value and emits a
 * validated `CreateAddon`, holding no state of its own beyond the field values
 * and never importing `@fp/query`. The page wires it to a mutation.
 *
 * The lookup key is fixed once set: the update endpoint does not accept a new
 * one, because integrations key off it: so on an edit the field is shown
 * read-only rather than removed, which would hide the value the person is
 * looking for.
 */
export const AddonFormProvenance = provenance({
  source: 'composition',
  composes: ['ui/input', 'ui/textarea', 'compositions/form-card', 'compositions/form-page'],
  note: 'RHF + the domain schema. Details only; charges are the surface shared with plans.',
})

export interface AddonFormProps {
  /** `create` requires a lookup key; `edit` shows it read-only. */
  mode: 'create' | 'edit'
  defaultValue?: CreateAddon
  onSubmit: (addon: CreateAddon) => void
  onCancel: () => void
  /** Breadcrumb; the last crumb is the page itself. */
  trail: DetailCrumb[]
  isSubmitting?: boolean
  /** Server-side failure, already a sentence. */
  submitError?: string | null
}

const FORM_ID = 'addon-form'

export function AddonForm({
  mode,
  trail,
  defaultValue,
  onSubmit,
  onCancel,
  isSubmitting = false,
  submitError = null,
}: AddonFormProps) {
  const form = useCalmForm<CreateAddon>({
    resolver: standardSchemaResolver(createAddonSchema) as Resolver<CreateAddon>,
    defaultValues: defaultValue ?? emptyAddon(),
  })

  const errors = form.formState.errors
  const isEdit = mode === 'edit'

  const nameField = form.register('name', {
    onChange: (event: { target: { value: string } }) => {
      // The lookupKey follows the name until the person types one of their own.
      if (!isEdit && !form.getFieldState('lookupKey').isDirty) {
        form.setValue('lookupKey', suggestKey(KEY_PREFIX.addon, event.target.value), {
          shouldValidate: form.formState.isSubmitted,
        })
      }
    },
  })

  const formEl = (
    <form id={FORM_ID} onSubmit={form.handleSubmit((values) => onSubmit(values))} noValidate>
      <FormCard title="Add-on details" status="required">
        <FormRow
          label="Name"
          hint="What the add-on is called on a contract and on invoices."
          required
          error={errors.name?.message}
        >
          {({ id, ...field }) => (
            <Input id={id} disabled={isSubmitting} {...field} {...nameField} />
          )}
        </FormRow>

        <FormRow
          label="Description"
          hint="What the add-on provides. Optional."
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

        <FormRow
          label="Lookup key"
          required={!isEdit}
          hint={
            isEdit
              ? 'Fixed once set: integrations key off it.'
              : 'Stable identifier used by the API. Lowercase, numbers, hyphens and underscores.'
          }
          error={errors.lookupKey?.message}
        >
          {({ id, ...field }) => (
            <Input
              id={id}
              disabled={isSubmitting || isEdit}
              readOnly={isEdit}
              {...field}
              {...form.register('lookupKey')}
            />
          )}
        </FormRow>
      </FormCard>
    </form>
  )

  return (
    <FormPage
      title={mode === 'create' ? 'Create add-on' : `Edit ${defaultValue?.name || 'add-on'}`}
      trail={trail}
      toolbar={{
        mode: mode,
        noun: 'add-on',
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
