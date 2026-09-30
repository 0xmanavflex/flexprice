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
import { FormPage } from '@ui/compositions/FormPage'
import type { DetailCrumb } from '@ui/compositions/DetailShell'
import { OptionSelect } from '@ui/compositions/OptionSelect'
import { provenance } from '@ui/provenance'

/**
 * Create a group, on a compact full page. A group holds prices or features, never both, and has no
 * update route, so this form is create-only and the kind is chosen once.
 */
export const GroupFormProvenance = provenance({
  source: 'composition',
  composes: [
    'ui/input',
    'compositions/field',
    'compositions/form-page',
    'compositions/form-actions',
  ],
  note: 'RHF + the domain schema. Create only: the API has no group update.',
})

export interface GroupFormProps {
  defaultValue?: CreateGroup
  onSubmit: (group: CreateGroup) => void
  onCancel?: () => void
  isSubmitting?: boolean
  submitError?: string | null
  trail: DetailCrumb[]
}

const ENTITY_OPTIONS = Object.values(GroupEntityType).map((value) => ({
  value,
  label: GROUP_ENTITY_TYPE_LABEL[value],
}))

const FORM_ID = 'group-form'

export function GroupForm({
  defaultValue,
  onSubmit,
  onCancel,
  isSubmitting = false,
  submitError = null,
  trail,
}: GroupFormProps) {
  const form = useForm<CreateGroup>({
    resolver: standardSchemaResolver(createGroupSchema) as Resolver<CreateGroup>,
    defaultValues: defaultValue ?? emptyGroup(),
    mode: 'onTouched',
  })

  const errors = form.formState.errors

  return (
    <FormPage
      title="Create group"
      description="Bundle prices or features so they can be filtered, reported and invoiced together."
      trail={trail}
      width="narrow"
      footer={
        <FormActions
          mode="create"
          noun="group"
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
      </form>
    </FormPage>
  )
}
