import { useCalmForm } from '@ui/compositions/forms/useCalmForm'
import { Controller, type Resolver } from 'react-hook-form'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import {
  type CreateGroup,
  GROUP_ENTITY_TYPE_LABEL,
  GroupEntityType,
  createGroupSchema,
  emptyGroup,
  KEY_PREFIX,
  suggestKey,
} from '@fp/domain'
import { Input } from '@ui/components/primitives/input'
import { FormCard, FormRow } from '@ui/compositions/forms/FormCard'
import { FormPage } from '@ui/compositions/forms/FormPage'
import type { DetailCrumb } from '@ui/compositions/detail/DetailShell'
import { OptionSelect } from '@ui/compositions/forms/OptionSelect'
import { provenance } from '@ui/provenance'

/**
 * Create a group, on a compact full page. A group holds prices or features, never both, and has no
 * update route, so this form is create-only and the kind is chosen once.
 */
export const GroupFormProvenance = provenance({
  source: 'composition',
  composes: ['ui/input', 'compositions/form-card', 'compositions/form-page'],
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
  const form = useCalmForm<CreateGroup>({
    resolver: standardSchemaResolver(createGroupSchema) as Resolver<CreateGroup>,
    defaultValues: defaultValue ?? emptyGroup(),
  })

  const nameField = form.register('name', {
    onChange: (event: { target: { value: string } }) => {
      // The lookupKey follows the name until the person types one of their own.
      if (!form.getFieldState('lookupKey').isDirty) {
        form.setValue('lookupKey', suggestKey(KEY_PREFIX.group, event.target.value), {
          shouldValidate: form.formState.isSubmitted,
        })
      }
    },
  })

  const errors = form.formState.errors

  return (
    <FormPage
      title="Create tag"
      trail={trail}
      width="narrow"
      toolbar={{
        mode: 'create',
        noun: 'tag',
        formId: FORM_ID,
        onCancel,
        isSubmitting,
        submitError,
      }}
    >
      <form id={FORM_ID} onSubmit={form.handleSubmit((values) => onSubmit(values))} noValidate>
        <div className="flex flex-col gap-6">
          <FormCard title="Tag details" status="required">
            <FormRow
              label="Name"
              hint="What the tag is called when you pick it elsewhere."
              required
              error={errors.name?.message}
            >
              {({ id, ...field }) => (
                <Input id={id} disabled={isSubmitting} {...field} {...nameField} />
              )}
            </FormRow>

            <FormRow
              label="Lookup key"
              required
              hint="Stable identifier used by the API. Lowercase letters, numbers, hyphens and underscores."
              error={errors.lookupKey?.message}
            >
              {({ id, ...field }) => (
                <Input id={id} disabled={isSubmitting} {...field} {...form.register('lookupKey')} />
              )}
            </FormRow>

            <FormRow
              label="Holds"
              required
              hint="A tag holds prices or features, never both. Fixed once created."
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
            </FormRow>
          </FormCard>
        </div>
      </form>
    </FormPage>
  )
}
