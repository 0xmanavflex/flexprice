import { useForm, type Resolver } from 'react-hook-form'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import {
  AGGREGATION_LABEL,
  AggregationType,
  FEATURE_TYPE_LABEL,
  FeatureType,
  ResetUsage,
  type CreateFeature,
  createFeatureSchema,
  emptyFeature,
  needsAggregationTarget,
} from '@fp/domain'
import { Button } from '@ui/primitives/button'
import { Input } from '@ui/primitives/input'
import { Label } from '@ui/primitives/label'
import { provenance } from '@ui/provenance'

/**
 * Create a feature.
 *
 * Replaces `AddFeature.tsx` — 1,106 lines, the second-largest file in V1 —
 * which carries a bespoke `useFeatureForm` hook holding four `useState` slices
 * (data, errors, formState, meterErrors) and two hand-written validator
 * callbacks that duplicate rules the schema now owns.
 *
 * This holds no state. The type picker drives which fields exist, because the
 * schema is a discriminated union; a leftover meter cannot survive a type
 * switch and be submitted invisibly.
 *
 * Presentational, like everything else in this package: it takes a default
 * value and emits a validated `CreateFeature`. It does not fetch, and cannot
 * import `@fp/query`.
 */
export const FeatureFormProvenance = provenance({
  source: 'composition',
  composes: ['ui/button', 'ui/input', 'ui/label'],
  note: 'RHF + the domain schema; replaces a 1,106-line page holding four state slices.',
})

export interface FeatureFormProps {
  defaultValue?: CreateFeature
  onSubmit: (feature: CreateFeature) => void
  onCancel?: () => void
  isSubmitting?: boolean
  /** Server-side failure, already a sentence. */
  submitError?: string | null
}

const TYPES = [
  FeatureType.Metered,
  FeatureType.Boolean,
  FeatureType.Static,
  FeatureType.Config,
] as const

const AGGREGATIONS = Object.values(AggregationType)

const TYPE_HINT: Record<FeatureType, string> = {
  [FeatureType.Metered]: 'Measured from events you send. Needs a meter.',
  [FeatureType.Boolean]: 'On or off for a plan.',
  [FeatureType.Static]: 'A fixed quantity, such as 10 seats.',
  [FeatureType.Config]: 'A configuration value carried on the plan.',
}

export function FeatureForm({
  defaultValue,
  onSubmit,
  onCancel,
  isSubmitting = false,
  submitError = null,
}: FeatureFormProps) {
  const form = useForm<CreateFeature>({
    resolver: standardSchemaResolver(createFeatureSchema) as Resolver<CreateFeature>,
    defaultValues: defaultValue ?? emptyFeature(FeatureType.Metered),
    mode: 'onTouched',
  })

  const type = form.watch('type')
  // `watch` on a path that only exists in one branch of the union returns a
  // union of every branch's value, so it is narrowed here rather than asserted.
  const watched: unknown = form.watch('meter.aggregationType' as never)
  const aggregationType =
    typeof watched === 'string' && (AGGREGATIONS as readonly string[]).includes(watched)
      ? (watched as AggregationType)
      : undefined

  // Replacing rather than merging is what stops a meter surviving a switch to
  // Boolean — the bug four parallel state slices make easy.
  const changeType = (next: FeatureType) => {
    if (next === type) return
    form.reset(emptyFeature(next))
  }

  const errors = form.formState.errors as Record<string, { message?: string }> & {
    meter?: Record<string, { message?: string }>
  }
  const showTarget = aggregationType ? needsAggregationTarget(aggregationType) : false
  const showMultiplier = aggregationType === AggregationType.SumWithMultiplier

  return (
    <form
      onSubmit={form.handleSubmit((values) => onSubmit(values))}
      noValidate
      aria-labelledby="feature-form-heading"
      className="flex max-w-2xl flex-col gap-6"
    >
      <h2 id="feature-form-heading" className="text-lg font-semibold">
        New feature
      </h2>

      <fieldset className="flex flex-col gap-2" disabled={isSubmitting}>
        <legend className="mb-2 text-sm font-medium">Type</legend>
        <div className="flex flex-wrap gap-2">
          {TYPES.map((option) => (
            <Button
              key={option}
              type="button"
              variant={option === type ? 'default' : 'outline'}
              aria-pressed={option === type}
              onClick={() => changeType(option)}
            >
              {FEATURE_TYPE_LABEL[option]}
            </Button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{TYPE_HINT[type]}</p>
      </fieldset>

      <Field label="Name" error={errors['name']?.message}>
        {(id, describedBy) => (
          <Input id={id} disabled={isSubmitting} aria-describedby={describedBy}
            {...form.register('name')} />
        )}
      </Field>

      <Field
        label="Lookup key"
        hint="Stable identifier used by the API. Lowercase, numbers and underscores."
        error={errors['lookupKey']?.message}
      >
        {(id, describedBy) => (
          <Input id={id} disabled={isSubmitting} aria-describedby={describedBy}
            {...form.register('lookupKey')} />
        )}
      </Field>

      {type === FeatureType.Metered ? (
        <fieldset className="flex flex-col gap-4 rounded-lg border p-4" disabled={isSubmitting}>
          <legend className="px-1 text-sm font-medium">Meter</legend>

          <Field label="Event name" error={errors.meter?.['eventName']?.message}>
            {(id, describedBy) => (
              <Input id={id} aria-describedby={describedBy}
                {...form.register('meter.eventName' as never)} />
            )}
          </Field>

          <Field label="Aggregation">
            {(id) => (
              <select
                id={id}
                className="h-9 rounded-lg border px-3 text-sm"
                {...form.register('meter.aggregationType' as never)}
              >
                {AGGREGATIONS.map((option) => (
                  <option key={option} value={option}>
                    {AGGREGATION_LABEL[option]}
                  </option>
                ))}
              </select>
            )}
          </Field>

          {/* COUNT is the only aggregation with nothing per event to add up. */}
          {showTarget ? (
            <Field
              label="Event field"
              hint="The property on the event to aggregate. An expression can be used instead."
              error={errors.meter?.['field']?.message}
            >
              {(id, describedBy) => (
                <Input id={id} aria-describedby={describedBy}
                  {...form.register('meter.field' as never)} />
              )}
            </Field>
          ) : null}

          {showTarget ? (
            <Field label="Or an expression" error={errors.meter?.['expression']?.message}>
              {(id, describedBy) => (
                <Input id={id} aria-describedby={describedBy}
                  {...form.register('meter.expression' as never)} />
              )}
            </Field>
          ) : null}

          {showMultiplier ? (
            <Field label="Multiplier" error={errors.meter?.['multiplier']?.message}>
              {(id, describedBy) => (
                <Input id={id} inputMode="decimal" aria-describedby={describedBy}
                  {...form.register('meter.multiplier' as never)} />
              )}
            </Field>
          ) : null}

          <Field label="Reset usage">
            {(id) => (
              <select
                id={id}
                className="h-9 rounded-lg border px-3 text-sm"
                {...form.register('meter.resetUsage' as never)}
              >
                <option value={ResetUsage.BillingPeriod}>Every billing period</option>
                <option value={ResetUsage.Never}>Never</option>
              </select>
            )}
          </Field>
        </fieldset>
      ) : null}

      {submitError ? (
        <p role="alert" className="text-sm text-destructive">
          {submitError}
        </p>
      ) : null}

      <div className="flex gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Creating…' : 'Create feature'}
        </Button>
        {onCancel ? (
          <Button type="button" variant="outline" disabled={isSubmitting} onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  )
}

/** Label, control and error wired together so the association is never forgotten. */
function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string
  hint?: string
  error?: string | undefined
  children: (id: string, describedBy: string | undefined) => React.ReactNode
}) {
  const id = `feature-${label.toLowerCase().replace(/\s+/g, '-')}`
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined

  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id}>{label}</Label>
      {hint ? (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {children(id, describedBy)}
      {error ? (
        <p id={errorId} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}
