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
 * equivalent picks from a list — they are not. Here each is a card carrying
 * one line about what it means, because the person about to create a
 * production environment should have read "real customers, real money" first.
 *
 * Creating production can be withheld — most tenants arrange it rather than
 * self-serving it. When it is, the option stays visible and disabled with the
 * reason attached: an option that silently does not exist reads as a bug, and
 * people go looking for it.
 *
 * It renders no buttons. The dialog that hosts it puts them in a
 * `DialogFooter` and submits with `form="…"`, which is what keeps the footer
 * ReUI's own bar rather than a row improvised inside the body.
 */
export const EnvironmentFormProvenance = provenance({
  source: 'composition',
  composes: ['ui/input', 'ui/radio-group', 'ui/field'],
  note: 'RHF + the domain schema. The type is a pair of one-line cards, not a select.',
})

export interface EnvironmentFormProps {
  /** Ties the submit button in the dialog footer to this form. */
  id: string
  defaultValue?: CreateEnvironment
  onSubmit: (environment: CreateEnvironment) => void
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
  id,
  defaultValue = emptyEnvironment,
  onSubmit,
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
  const error = form.formState.errors.type?.message ?? submitError

  return (
    <form
      id={id}
      className="flex flex-col gap-4"
      /*
       * Production is refused here as well as disabled in the control, because
       * `aria-disabled` is an announcement rather than a lock: Base UI renders
       * the radio as a `span`, so nothing structurally prevents the value from
       * arriving. A rule that only exists in the UI is not a rule.
       */
      onSubmit={form.handleSubmit((value) => {
        if (value.type === EnvironmentType.Production && !canCreateProduction) {
          form.setError('type', {
            message: productionUnavailableReason ?? 'Production cannot be created here.',
          })
          return
        }
        onSubmit(value)
      })}
      noValidate
    >
      {/* No hint under the label: the placeholder already shows the shape. */}
      <Field label="Name" error={form.formState.errors.name?.message}>
        {({ id: fieldId, ...field }) => (
          <Input
            id={fieldId}
            autoFocus
            placeholder="EU staging"
            disabled={isSubmitting}
            {...field}
            {...form.register('name')}
          />
        )}
      </Field>

      <fieldset className="flex flex-col gap-1.5" disabled={isSubmitting}>
        <legend className="text-sm font-medium">Type</legend>
        <RadioGroup
          value={type}
          onValueChange={(value) => form.setValue('type', value as CreateEnvironment['type'])}
          className="grid gap-1.5"
        >
          {TYPES.map((option) => {
            const isProduction = option === EnvironmentType.Production
            const disabled = isProduction && !canCreateProduction

            return (
              <label
                key={option}
                className={cn(
                  'flex cursor-pointer items-center gap-2.5 rounded-lg border p-2.5 transition-colors',
                  type === option && 'border-primary/40 bg-accent/50',
                  disabled && 'cursor-not-allowed opacity-60',
                )}
              >
                <RadioGroupItem value={option} disabled={disabled} />
                <span className="flex min-w-0 flex-col">
                  <span className="text-sm font-medium">{ENVIRONMENT_TYPE_LABEL[option]}</span>
                  <span className="text-muted-foreground text-xs">
                    {disabled && productionUnavailableReason
                      ? productionUnavailableReason
                      : ENVIRONMENT_TYPE_DESCRIPTION[option]}
                  </span>
                </span>
              </label>
            )
          })}
        </RadioGroup>
      </fieldset>

      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
    </form>
  )
}
