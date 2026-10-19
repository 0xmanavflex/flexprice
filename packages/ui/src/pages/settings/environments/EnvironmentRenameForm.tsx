import { CircleAlertIcon } from '@ui/icons'
import { useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { createEnvironmentSchema } from '@fp/domain'
import { Composer } from '@ui/compositions/detail/DetailKit'
import { FormDialog } from '@ui/compositions/forms/FormDialog'
import { Field, FieldError, FieldGroup, FieldLabel } from '@ui/components/primitives/field'
import { Input } from '@ui/components/primitives/input'
import { Alert, AlertDescription } from '@ui/components/reui/alert'
import { provenance } from '@ui/provenance'

/**
 * Rename an environment, in a small dialog opened from the switcher's pencil.
 *
 * One field. The type is not editable — the API refuses to change it — so it is
 * not shown as though it were. The name follows the same rule as create.
 */
export const EnvironmentRenameFormProvenance = provenance({
  source: 'composition',
  composes: [
    'compositions/form-dialog',
    'compositions/detail-kit',
    'ui/input',
    'ui/field',
    '@reui/alert',
  ],
  note: 'Reference FormDialog and Composer with a single name field.',
})

const renameSchema = createEnvironmentSchema.pick({ name: true })
interface RenameDraft {
  name: string
}

export interface EnvironmentRenameFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The environment's current name, which the field starts from. */
  name: string
  onSubmit: (name: string) => void
  isSubmitting?: boolean
  submitError?: string | null
}

export function EnvironmentRenameForm({
  open,
  onOpenChange,
  name,
  onSubmit,
  isSubmitting = false,
  submitError = null,
}: EnvironmentRenameFormProps) {
  const form = useForm<RenameDraft>({
    resolver: standardSchemaResolver(renameSchema),
    defaultValues: { name },
    mode: 'onSubmit',
  })

  const wasOpen = useRef(false)
  useEffect(() => {
    if (open && !wasOpen.current) form.reset({ name })
    wasOpen.current = open
  }, [open, name, form])

  const submit = form.handleSubmit((value) => onSubmit(value.name))
  const error = form.formState.errors.name?.message

  return (
    <FormDialog
      open={open}
      onOpenChange={(next) => {
        if (!next && isSubmitting) return
        onOpenChange(next)
      }}
      size="sm"
      title="Rename environment"
    >
      <Composer
        submitLabel={isSubmitting ? 'Saving…' : 'Save'}
        submitting={isSubmitting}
        onCancel={() => onOpenChange(false)}
        onSubmit={() => void submit()}
      >
        <FieldGroup className="gap-4">
          <Field className="gap-2">
            <FieldLabel htmlFor="environment-rename">Name</FieldLabel>
            <Input
              id="environment-rename"
              autoFocus
              disabled={isSubmitting}
              aria-invalid={error ? true : undefined}
              {...form.register('name')}
            />
            {error ? <FieldError>{error}</FieldError> : null}
          </Field>
        </FieldGroup>

        {submitError ? (
          <Alert variant="destructive">
            <CircleAlertIcon aria-hidden="true" />
            <AlertDescription>{submitError}</AlertDescription>
          </Alert>
        ) : null}
      </Composer>
    </FormDialog>
  )
}
