import { useForm } from 'react-hook-form'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import {
  ENVIRONMENT_TYPE_DESCRIPTION,
  ENVIRONMENT_TYPE_LABEL,
  EnvironmentType,
  type CreateEnvironment,
  createEnvironmentSchema,
  emptyEnvironment,
} from '@fp/domain'
import { Button } from '@ui/primitives/button'
import { Input } from '@ui/primitives/input'
import { RadioGroup, RadioGroupItem } from '@ui/primitives/radio-group'
import { Field } from '@ui/compositions/Field'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'

/**
 * Create an environment.
 *
 * Two fields, and the second one is the whole point. V1 presents the type as a
 * `Select` of two options, which makes "Production" and "Sandbox" look like
 * equivalent choices from a list — they are not. Here each is a card carrying
 * what it means, because the person about to create a production environment
 * should have read the sentence "changes here bill someone" before they do.
 *
 * Creating production can be withheld — most tenants are on a plan where it is
 * arranged rather than self-served. When it is, the option is visibly present
 * and disabled with the reason attached, rather than absent: an option that
 * silently does not exist reads as a bug, and people go looking for it.
 *
 * Presentational, like everything else here: it takes a default and emits a
 * validated `CreateEnvironment`. It does not fetch.
 */
export const EnvironmentFormProvenance = provenance({
  source: 'composition',
  composes: ['ui/button', 'ui/input', 'ui/radio-group'],
  note: 'RHF + the domain schema. The type is a pair of explained cards, not a select.',
})

export interface EnvironmentFormProps {
  defaultValue?: CreateEnvironment
  onSubmit: (environment: CreateEnvironment) => void
  onCancel: () => void
  isSubmitting?: boolean
  submitError?: string | null
  /**
   * Whether production can be created here at all. When false, the reason is
   * required — a disabled control with no explanation is just a broken one.
   */
  canCreateProduction?: boolean
  productionUnavailableReason?: string
}

const TYPES = [EnvironmentType.Sandbox, EnvironmentType.Production] as const

export function EnvironmentForm({
  defaultValue = emptyEnvironment,
  onSubmit,
  onCancel,
  isSubmitting = false,
  submitError = null,
  canCreateProduction = true,
  productionUnavailableReason,
}: EnvironmentFormProps) {
  const form = useForm<CreateEnvironment>({
    resolver: standardSchemaResolver(createEnvironmentSchema),
    defaultValues: defaultValue,
    mode: 'onSubmit',
  })

  const type = form.watch('type')

  return (
    <form
      className="flex flex-col gap-5"
      /*
       * Production is refused here as well as disabled in the control, because
       * `aria-disabled` is an announcement rather than a lock: Base UI renders
       * the radio as a `span`, so nothing structurally prevents the value from
       * arriving. A rule that only exists in the UI is not a rule.
       */
      onSubmit={form.handleSubmit((value) => {
        if (value.type === EnvironmentType.Production && !canCreateProduction) {
          form.setError('type', {
            message:
              productionUnavailableReason ?? 'Production environments cannot be created here.',
          })
          return
        }
        onSubmit(value)
      })}
      noValidate
    >
      <Field
        label="Name"
        hint="What this environment is for — “EU staging”, not “Environment 4”."
        error={form.formState.errors.name?.message}
      >
        {({ id, ...field }) => (
          <Input
            id={id}
            autoFocus
            placeholder="Sandbox"
            disabled={isSubmitting}
            {...field}
            {...form.register('name')}
          />
        )}
      </Field>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">Type</legend>
        <RadioGroup
          value={type}
          onValueChange={(value) => form.setValue('type', value as CreateEnvironment['type'])}
          className="grid gap-2"
        >
          {TYPES.map((option) => {
            const isProduction = option === EnvironmentType.Production
            const disabled = isProduction && !canCreateProduction

            return (
              <label
                key={option}
                className={cn(
                  'flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors',
                  type === option && 'border-primary/40 bg-accent/50',
                  disabled && 'cursor-not-allowed opacity-60',
                )}
              >
                <RadioGroupItem value={option} disabled={disabled} className="mt-0.5" />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-sm font-medium">{ENVIRONMENT_TYPE_LABEL[option]}</span>
                  <span className="text-muted-foreground text-sm">
                    {ENVIRONMENT_TYPE_DESCRIPTION[option]}
                  </span>
                  {disabled && productionUnavailableReason ? (
                    <span className="text-muted-foreground mt-1 text-xs">
                      {productionUnavailableReason}
                    </span>
                  ) : null}
                </span>
              </label>
            )
          })}
        </RadioGroup>
      </fieldset>

      {form.formState.errors.type?.message ?? submitError ? (
        <p role="alert" className="text-destructive text-sm">
          {form.formState.errors.type?.message ?? submitError}
        </p>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Creating…' : 'Create environment'}
        </Button>
      </div>
    </form>
  )
}
