import { useForm, type Resolver } from 'react-hook-form'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { type CreateAddon, createAddonSchema, emptyAddon } from '@fp/domain'
import { Input } from '@ui/components/primitives/input'
import { Textarea } from '@ui/components/primitives/textarea'
import { Field } from '@ui/compositions/Field'
import { FormActions } from '@ui/compositions/FormActions'
import { FormPage } from '@ui/compositions/FormPage'
import type { DetailCrumb } from '@ui/compositions/DetailShell'
import { provenance } from '@ui/provenance'

/**
 * Create or edit an add-on's details, on a full page.
 *
 * One section, so a single `FormPage` rather than a stepper: name, lookup key,
 * description. Charges and entitlements are added on the detail page afterwards.
 *
 * Presentational, like every form here: it takes a default value and emits a
 * validated `CreateAddon`, holding no state of its own beyond the field values
 * and never importing `@fp/query`. The page wires it to a mutation.
 *
 * The lookup key is fixed once set — the update endpoint does not accept a new
 * one, because integrations key off it — so on an edit the field is shown
 * read-only rather than removed, which would hide the value the person is
 * looking for.
 */
export const AddonFormProvenance = provenance({
  source: 'composition',
  composes: ['ui/input', 'ui/textarea', 'compositions/form-page', 'compositions/form-actions'],
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
  const form = useForm<CreateAddon>({
    resolver: standardSchemaResolver(createAddonSchema) as Resolver<CreateAddon>,
    defaultValues: defaultValue ?? emptyAddon(),
    mode: 'onTouched',
  })

  const errors = form.formState.errors

  return (
    <FormPage
      title={mode === 'create' ? 'Create add-on' : `Edit ${defaultValue?.name || 'add-on'}`}
      description={
        mode === 'create'
          ? 'An optional extra customers buy alongside a plan. Charges and entitlements are added afterwards.'
          : 'Update the add-on’s details. Its charges are edited separately.'
      }
      trail={trail}
      width="narrow"
      footer={
        <FormActions
          mode={mode}
          noun="add-on"
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
          required={mode === 'create'}
          hint={
            mode === 'edit'
              ? 'Fixed once set — integrations key off it.'
              : 'Stable identifier used by the API. Lowercase, numbers and underscores.'
          }
          error={errors.lookupKey?.message}
        >
          {({ id, ...field }) => (
            <Input
              id={id}
              disabled={isSubmitting || mode === 'edit'}
              readOnly={mode === 'edit'}
              {...field}
              {...form.register('lookupKey')}
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
      </form>
    </FormPage>
  )
}
