import { Controller, useForm, type Resolver } from 'react-hook-form'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import {
  type CreateGroup,
  GROUP_ENTITY_TYPE_LABEL,
  GroupEntityType,
  createGroupSchema,
  emptyGroup,
} from '@fp/domain'
import { Input } from '@ui/components/primitives/input'
import { Field } from '@ui/compositions/Field'
import { FormActions } from '@ui/compositions/FormActions'
import { OptionSelect } from '@ui/compositions/OptionSelect'
import { provenance } from '@ui/provenance'

/**
 * Create a group. A group holds prices or features, never both, and has no
 * update route, so this form is create-only and the kind is chosen once.
 */
export const GroupFormProvenance = provenance({
  source: 'composition',
  composes: ['ui/input', 'ui/label', 'compositions/field'],
  note: 'RHF + the domain schema. Create only: the API has no group update.',
})

export interface GroupFormProps {
  defaultValue?: CreateGroup
  onSubmit: (group: CreateGroup) => void
  onCancel?: () => void
  isSubmitting?: boolean
  submitError?: string | null
}

const ENTITY_OPTIONS = Object.values(GroupEntityType).map((value) => ({
  value,
  label: GROUP_ENTITY_TYPE_LABEL[value],
}))

export function GroupForm({
  defaultValue,
  onSubmit,
  onCancel,
  isSubmitting = false,
  submitError = null,
}: GroupFormProps) {
  const form = useForm<CreateGroup>({
    resolver: standardSchemaResolver(createGroupSchema) as Resolver<CreateGroup>,
    defaultValues: defaultValue ?? emptyGroup(),
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
        required
        hint="Stable identifier used by the API. Lowercase letters, numbers, hyphens and underscores."
        error={errors.lookupKey?.message}
      >
        {({ id, ...field }) => (
          <Input id={id} disabled={isSubmitting} {...field} {...form.register('lookupKey')} />
        )}
      </Field>

      <Field
        label="Holds"
        required
        hint="A group holds prices or features, never both. Fixed once created."
        error={errors.entityType?.message}
      >
        {({ id, ...field }) => (
          <Controller
            control={form.control}
            name="entityType"
            render={({ field: control }) => (
              <OptionSelect
                id={id}
                {...field}
                value={control.value}
                onValueChange={(value) => control.onChange(value)}
                options={ENTITY_OPTIONS}
                disabled={isSubmitting}
              />
            )}
          />
        )}
      </Field>

      <FormActions
        mode="create"
        noun="group"
        onCancel={onCancel}
        isSubmitting={isSubmitting}
        submitError={submitError}
      />
    </form>
  )
}
