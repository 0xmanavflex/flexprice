import { useForm, type Resolver } from 'react-hook-form'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { type CloneFeature, type Feature, cloneFeatureSchema, emptyCloneFeature } from '@fp/domain'
import { Input } from '@ui/components/primitives/input'
import { Textarea } from '@ui/components/primitives/textarea'
import { Field } from '@ui/compositions/Field'
import { FormActions } from '@ui/compositions/FormActions'
import { FormDialog } from '@ui/compositions/FormDialog'
import { provenance } from '@ui/provenance'

/** Clone a feature: a new name and lookup key, both required and unique. */
export const FeatureCloneDialogProvenance = provenance({
  source: 'composition',
  composes: ['compositions/form-dialog', 'compositions/field'],
  note: 'Name, lookup key and description for the copy; the meter is copied by the backend.',
})

export interface FeatureCloneDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  source: Feature | null
  onSubmit: (draft: CloneFeature) => void
  isSubmitting?: boolean
  submitError?: string | null
}

export function FeatureCloneDialog({
  open,
  onOpenChange,
  source,
  onSubmit,
  isSubmitting = false,
  submitError = null,
}: FeatureCloneDialogProps) {
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} size="sm" title="Clone product">
      {source ? (
        <CloneForm
          key={source.id}
          source={source}
          onSubmit={onSubmit}
          onCancel={() => onOpenChange(false)}
          isSubmitting={isSubmitting}
          submitError={submitError}
        />
      ) : null}
    </FormDialog>
  )
}

function CloneForm({
  source,
  onSubmit,
  onCancel,
  isSubmitting,
  submitError,
}: {
  source: Feature
  onSubmit: (draft: CloneFeature) => void
  onCancel: () => void
  isSubmitting: boolean
  submitError: string | null
}) {
  const form = useForm<CloneFeature>({
    resolver: standardSchemaResolver(cloneFeatureSchema) as Resolver<CloneFeature>,
    defaultValues: emptyCloneFeature(source),
    mode: 'onTouched',
  })
  const errors = form.formState.errors

  return (
    <form
      onSubmit={form.handleSubmit((values) => onSubmit(values))}
      noValidate
      className="flex flex-col gap-5"
    >
      <Field label="Name" hint="Display name for the copy." required error={errors.name?.message}>
        {({ id, ...field }) => (
          <Input id={id} disabled={isSubmitting} {...field} {...form.register('name')} />
        )}
      </Field>
      <Field
        label="Lookup key"
        hint="Stable identifier the API uses to find the copy. Must be unique."
        required
        error={errors.lookupKey?.message}
      >
        {({ id, ...field }) => (
          <Input id={id} disabled={isSubmitting} {...field} {...form.register('lookupKey')} />
        )}
      </Field>
      <Field
        label="Description"
        hint="What the copy measures or unlocks. Optional."
        error={errors.description?.message}
      >
        {({ id, ...field }) => (
          <Textarea
            id={id}
            rows={2}
            disabled={isSubmitting}
            {...field}
            {...form.register('description')}
          />
        )}
      </Field>
      <FormActions
        mode="create"
        noun="copy"
        onCancel={onCancel}
        isSubmitting={isSubmitting}
        submitError={submitError}
      />
    </form>
  )
}
