import { useForm, type Resolver } from 'react-hook-form'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { type CreateAddon, createAddonSchema, emptyAddon } from '@fp/domain'
import { Button } from '@ui/primitives/button'
import { Input } from '@ui/primitives/input'
import { Textarea } from '@ui/primitives/textarea'
import { Field } from '@ui/compositions/Field'
import { provenance } from '@ui/provenance'

/**
 * Create or edit an add-on's details.
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
  composes: ['ui/button', 'ui/input', 'ui/textarea', 'ui/label'],
  note: 'RHF + the domain schema. Details only; charges are the surface shared with plans.',
})

export interface AddonFormProps {
  /** `create` requires a lookup key; `edit` shows it read-only. */
  mode: 'create' | 'edit'
  defaultValue?: CreateAddon
  onSubmit: (addon: CreateAddon) => void
  onCancel?: () => void
  isSubmitting?: boolean
  /** Server-side failure, already a sentence. */
  submitError?: string | null
}

export function AddonForm({
  mode,
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
    <form
      onSubmit={form.handleSubmit((values) => onSubmit(values))}
      noValidate
      className="flex min-h-full flex-col gap-6"
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
          <Textarea id={id} rows={3} disabled={isSubmitting} {...field}
            {...form.register('description')} />
        )}
      </Field>

      {/* Pinned to the bottom of the drawer: the actions sit on a divider at the
          foot of the panel rather than floating under the last field. */}
      <div className="mt-auto flex flex-col gap-3 border-t pt-4">
        {submitError ? (
          <p role="alert" className="text-sm text-destructive">
            {submitError}
          </p>
        ) : null}
        <div className="flex gap-2">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? mode === 'create'
                ? 'Creating…'
                : 'Saving…'
              : mode === 'create'
                ? 'Create add-on'
                : 'Save changes'}
          </Button>
          {onCancel ? (
            <Button type="button" variant="outline" disabled={isSubmitting} onClick={onCancel}>
              Cancel
            </Button>
          ) : null}
        </div>
      </div>
    </form>
  )
}
