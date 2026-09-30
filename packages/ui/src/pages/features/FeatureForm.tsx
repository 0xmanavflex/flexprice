import { get, useFieldArray, useForm, type Resolver } from 'react-hook-form'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import {
  AGGREGATION_LABEL,
  ALERT_CONDITION_LABEL,
  ALERT_SEVERITY_LABEL,
  ALERT_SEVERITY_ORDER,
  ALERT_THRESHOLD_TYPE_LABEL,
  AggregationType,
  AlertCondition,
  AlertThresholdType,
  FEATURE_TYPE_LABEL,
  FeatureType,
  ResetUsage,
  createFeatureSchema,
  defaultFeatureLookupKey,
  editFeatureSchema,
  needsAggregationTarget,
  type AlertSeverity,
  type CreateFeature,
  type EditFeature,
  type Feature,
} from '@fp/domain'
import { PlusIcon, Trash2Icon } from 'lucide-react'
import { Button } from '@ui/components/primitives/button'
import { Input } from '@ui/components/primitives/input'
import { Switch } from '@ui/components/primitives/switch'
import { Textarea } from '@ui/components/primitives/textarea'
import { Field } from '@ui/compositions/Field'
import { FormActions } from '@ui/compositions/FormActions'
import { OptionSelect, type Option } from '@ui/compositions/OptionSelect'
import { provenance } from '@ui/provenance'

/**
 * Create or edit a feature.
 *
 * Replaces `AddFeature.tsx` — 1,106 lines holding a bespoke form hook and four
 * `useState` slices. This holds one form value and hands it to the domain
 * schema, which is a discriminated union: the type decides whether a meter
 * exists, the aggregation decides which meter fields are needed.
 *
 * The form value is deliberately looser than the schema's input (blank strings
 * instead of absent keys, comma-separated filter values), because that is what
 * inputs hold. `normalize` is the single place that turns it into a schema
 * candidate, and it drops anything the current type or aggregation hides, so a
 * stale meter field cannot be submitted invisibly.
 *
 * Presentational: it takes a value and emits a validated `CreateFeature` (or
 * `EditFeature`). It does not fetch and cannot import `@fp/query`.
 */
export const FeatureFormProvenance = provenance({
  source: 'composition',
  composes: [
    'ui/input',
    'ui/textarea',
    'ui/switch',
    'compositions/field',
    'compositions/form-actions',
  ],
  note: 'RHF + the domain schemas; replaces a 1,106-line page holding four state slices.',
})

type FeatureFormProps = {
  onCancel?: () => void
  isSubmitting?: boolean
  /** Server-side failure, already a sentence. */
  submitError?: string | null
  /** The groups a feature can be filed under; the field is hidden when there are none. */
  groups?: readonly Option[]
} & (
  | {
      mode: 'create'
      defaultValue?: CreateFeature
      onSubmit: (feature: CreateFeature) => void
    }
  | {
      mode: 'edit'
      /** The feature being edited; its type, lookup key and meter are shown read-only. */
      feature: Feature
      onSubmit: (feature: EditFeature) => void
    }
)

export type { FeatureFormProps }

interface ThresholdValues {
  condition: AlertCondition
  threshold: string
}

interface FormValues {
  type: FeatureType
  name: string
  lookupKey: string
  description: string
  unitSingular: string
  unitPlural: string
  groupId: string
  reportingUnit: { unitSingular: string; unitPlural: string; conversionRate: string }
  meter: {
    eventName: string
    aggregationType: AggregationType
    field: string
    multiplier: string
    groupBy: string
    resetUsage: ResetUsage
  }
  filters: { key: string; valuesText: string }[]
  alertsOn: boolean
  alerts: {
    thresholdType: AlertThresholdType
    info: ThresholdValues
    warning: ThresholdValues
    critical: ThresholdValues
  }
}

const TYPES = [FeatureType.Metered, FeatureType.Boolean, FeatureType.Static] as const

const TYPE_OPTIONS: Option[] = TYPES.map((value) => ({
  value,
  label: FEATURE_TYPE_LABEL[value],
}))

const TYPE_HINT: Record<FeatureType, string> = {
  [FeatureType.Metered]: 'Measured from events you send. Needs a meter.',
  [FeatureType.Boolean]: 'On or off for a plan.',
  [FeatureType.Static]: 'A fixed quantity, such as 10 seats.',
  [FeatureType.Config]: 'A configuration value carried on the plan.',
}

const AGGREGATION_OPTIONS: Option[] = Object.values(AggregationType).map((value) => ({
  value,
  label: AGGREGATION_LABEL[value],
}))

const RESET_OPTIONS: Option[] = [
  { value: ResetUsage.BillingPeriod, label: 'Every billing period' },
  { value: ResetUsage.Never, label: 'Never' },
]

const CONDITION_OPTIONS: Option[] = Object.values(AlertCondition).map((value) => ({
  value,
  label: ALERT_CONDITION_LABEL[value],
}))

const THRESHOLD_TYPE_OPTIONS: Option[] = Object.values(AlertThresholdType).map((value) => ({
  value,
  label: ALERT_THRESHOLD_TYPE_LABEL[value],
}))

const blankThreshold = (): ThresholdValues => ({ condition: AlertCondition.Above, threshold: '' })

function emptyValues(): FormValues {
  return {
    type: FeatureType.Metered,
    name: '',
    lookupKey: '',
    description: '',
    unitSingular: '',
    unitPlural: '',
    groupId: '',
    reportingUnit: { unitSingular: '', unitPlural: '', conversionRate: '' },
    meter: {
      eventName: '',
      aggregationType: AggregationType.Count,
      field: '',
      multiplier: '',
      groupBy: '',
      resetUsage: ResetUsage.BillingPeriod,
    },
    filters: [],
    alertsOn: false,
    alerts: {
      thresholdType: AlertThresholdType.Percentage,
      info: blankThreshold(),
      warning: { condition: AlertCondition.Above, threshold: '80' },
      critical: blankThreshold(),
    },
  }
}

function fromCreate(draft: CreateFeature | undefined): FormValues {
  const base = emptyValues()
  if (!draft) return base
  const values: FormValues = {
    ...base,
    type: draft.type,
    name: draft.name,
    lookupKey: draft.lookupKey ?? '',
    description: draft.description ?? '',
    unitSingular: draft.unitSingular ?? '',
    unitPlural: draft.unitPlural ?? '',
    groupId: draft.groupId ?? '',
    ...(draft.reportingUnit ? { reportingUnit: draft.reportingUnit } : {}),
  }
  if (draft.type === FeatureType.Metered) {
    values.meter = {
      eventName: draft.meter.eventName,
      aggregationType: draft.meter.aggregationType,
      field: draft.meter.field ?? '',
      multiplier: draft.meter.multiplier ?? '',
      groupBy: draft.meter.groupBy ?? '',
      resetUsage: draft.meter.resetUsage,
    }
    values.filters = (draft.meter.filters ?? []).map((f) => ({
      key: f.key,
      valuesText: f.values.join(', '),
    }))
  }
  return values
}

function fromFeature(feature: Feature): FormValues {
  const base = emptyValues()
  return {
    ...base,
    type: feature.type,
    name: feature.name,
    lookupKey: feature.lookupKey,
    description: feature.description,
    unitSingular: feature.unitSingular,
    unitPlural: feature.unitPlural,
    groupId: feature.groupId ?? '',
    ...(feature.reportingUnit ? { reportingUnit: feature.reportingUnit } : {}),
    meter: {
      ...base.meter,
      eventName: feature.eventName ?? '',
      ...(feature.aggregationType ? { aggregationType: feature.aggregationType } : {}),
      field: feature.aggregationField ?? '',
      groupBy: feature.aggregationGroupBy ?? '',
    },
    filters: (feature.meterFilters ?? []).map((f) => ({
      key: f.key,
      valuesText: f.values.join(', '),
    })),
  }
}

const splitValues = (text: string): string[] =>
  text
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)

/** The schema candidate: anything hidden or blank is left out rather than sent stale. */
function normalize(values: FormValues, mode: 'create' | 'edit') {
  const ru = values.reportingUnit
  const hasReportingUnit = [ru.unitSingular, ru.unitPlural, ru.conversionRate].some(
    (v) => v.trim() !== '',
  )

  let alertSettings: unknown
  if (values.alertsOn) {
    const severities: Partial<Record<AlertSeverity, ThresholdValues>> = {}
    for (const severity of ALERT_SEVERITY_ORDER) {
      const row = values.alerts[severity]
      if (row.threshold.trim() !== '') severities[severity] = row
    }
    alertSettings = {
      alertEnabled: true,
      thresholdType: values.alerts.thresholdType,
      ...severities,
    }
  }

  const filters = values.filters.map((f) => ({ key: f.key, values: splitValues(f.valuesText) }))
  const shared = {
    name: values.name,
    description: values.description,
    unitSingular: values.unitSingular,
    unitPlural: values.unitPlural,
    ...(values.groupId ? { groupId: values.groupId } : {}),
    ...(hasReportingUnit ? { reportingUnit: ru } : {}),
    ...(alertSettings ? { alertSettings } : {}),
  }

  if (mode === 'edit') {
    return { ...shared, ...(values.type === FeatureType.Metered ? { filters } : {}) }
  }

  const { meter } = values
  return {
    ...shared,
    type: values.type,
    lookupKey: values.lookupKey,
    ...(values.type === FeatureType.Metered
      ? {
          meter: {
            eventName: meter.eventName,
            aggregationType: meter.aggregationType,
            resetUsage: meter.resetUsage,
            ...(needsAggregationTarget(meter.aggregationType) ? { field: meter.field } : {}),
            ...(meter.aggregationType === AggregationType.SumWithMultiplier
              ? { multiplier: meter.multiplier }
              : {}),
            ...(meter.aggregationType === AggregationType.Max && meter.groupBy
              ? { groupBy: meter.groupBy }
              : {}),
            ...(filters.length > 0 ? { filters } : {}),
          },
        }
      : {}),
  }
}

export function FeatureForm(props: FeatureFormProps) {
  const { mode, onCancel, isSubmitting = false, submitError = null, groups = [] } = props
  const feature = props.mode === 'edit' ? props.feature : undefined
  const isEdit = mode === 'edit'

  const schemaResolver = (isEdit
    ? standardSchemaResolver(editFeatureSchema)
    : standardSchemaResolver(createFeatureSchema)) as unknown as Resolver<FormValues>
  const resolver: Resolver<FormValues> = (values, context, options) => {
    const candidate = normalize(values, mode) as unknown as FormValues
    return schemaResolver(candidate, context, options)
  }

  const form = useForm<FormValues>({
    resolver,
    defaultValues: feature
      ? fromFeature(feature)
      : fromCreate(props.mode === 'create' ? props.defaultValue : undefined),
    mode: 'onTouched',
  })
  const filters = useFieldArray({ control: form.control, name: 'filters' })

  const type = form.watch('type')
  const aggregationType = form.watch('meter.aggregationType')
  const alertsOn = form.watch('alertsOn')
  const isMetered = type === FeatureType.Metered

  const filterPath = isEdit ? 'filters' : 'meter.filters'
  const message = (path: string): string | undefined => {
    const found = get(form.formState.errors, path) as { message?: string } | undefined
    return found?.message
  }

  const submit = form.handleSubmit((values) => {
    // The resolver returns the schema's parsed output, not the form value.
    if (props.mode === 'edit') props.onSubmit(values as unknown as EditFeature)
    else props.onSubmit(values as unknown as CreateFeature)
  })

  const nameField = form.register('name', {
    onChange: (event: { target: { value: string } }) => {
      // The key follows the name until the person types a key of their own.
      if (!isEdit && !form.getFieldState('lookupKey').isDirty) {
        form.setValue('lookupKey', defaultFeatureLookupKey(event.target.value))
      }
    },
  })

  const setAlertsOn = (on: boolean) => form.setValue('alertsOn', on, { shouldDirty: true })

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" required error={message('name')}>
          {({ id, ...field }) => (
            <Input id={id} disabled={isSubmitting} {...field} {...nameField} />
          )}
        </Field>

        <Field
          label="Lookup key"
          hint={
            isEdit
              ? 'Fixed once set — integrations key off it.'
              : 'Stable identifier used by the API. Follows the name until you edit it.'
          }
          error={message('lookupKey')}
        >
          {({ id, ...field }) => (
            <Input
              id={id}
              disabled={isSubmitting || isEdit}
              readOnly={isEdit}
              {...field}
              {...form.register('lookupKey')}
            />
          )}
        </Field>
      </div>

      <Field label="Description" error={message('description')}>
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

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Type" hint={TYPE_HINT[type]}>
          {({ id, ...field }) => (
            <OptionSelect
              id={id}
              aria-describedby={field['aria-describedby']}
              value={type}
              options={TYPE_OPTIONS}
              disabled={isSubmitting || isEdit}
              onValueChange={(next) => {
                if (next === type || isEdit) return
                // A type switch keeps the shared fields and lets the schema drop the rest.
                form.setValue('type', next as FeatureType, { shouldDirty: true })
                form.clearErrors()
              }}
            />
          )}
        </Field>

        {groups.length > 0 ? (
          <Field label="Group" hint="File the feature under a group." error={message('groupId')}>
            {({ id, ...field }) => (
              <OptionSelect
                id={id}
                aria-describedby={field['aria-describedby']}
                value={form.watch('groupId')}
                options={groups}
                placeholder="No group"
                disabled={isSubmitting}
                onValueChange={(next) => form.setValue('groupId', next, { shouldDirty: true })}
              />
            )}
          </Field>
        ) : null}
      </div>

      {isMetered ? (
        <fieldset className="flex flex-col gap-4 rounded-lg border p-4" disabled={isSubmitting}>
          <legend className="px-1 text-sm font-medium">Meter</legend>

          {isEdit ? (
            <p className="text-muted-foreground text-xs">
              The event, aggregation and reset are fixed once the meter exists. Filters can still
              change.
            </p>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Event name" required error={message('meter.eventName')}>
              {({ id, ...field }) => (
                <Input
                  id={id}
                  readOnly={isEdit}
                  disabled={isEdit}
                  {...field}
                  {...form.register('meter.eventName')}
                />
              )}
            </Field>

            <Field label="Aggregation">
              {({ id, ...field }) => (
                <OptionSelect
                  id={id}
                  aria-describedby={field['aria-describedby']}
                  value={aggregationType}
                  options={AGGREGATION_OPTIONS}
                  disabled={isEdit}
                  onValueChange={(next) =>
                    form.setValue('meter.aggregationType', next as AggregationType, {
                      shouldDirty: true,
                    })
                  }
                />
              )}
            </Field>

            {needsAggregationTarget(aggregationType) ? (
              <Field
                label="Event field"
                required
                hint="The property on the event to aggregate."
                error={message('meter.field')}
              >
                {({ id, ...field }) => (
                  <Input
                    id={id}
                    readOnly={isEdit}
                    disabled={isEdit}
                    {...field}
                    {...form.register('meter.field')}
                  />
                )}
              </Field>
            ) : null}

            {aggregationType === AggregationType.SumWithMultiplier ? (
              <Field label="Multiplier" required error={message('meter.multiplier')}>
                {({ id, ...field }) => (
                  <Input
                    id={id}
                    inputMode="decimal"
                    disabled={isEdit}
                    {...field}
                    {...form.register('meter.multiplier')}
                  />
                )}
              </Field>
            ) : null}

            {aggregationType === AggregationType.Max ? (
              <Field
                label="Group by"
                hint="An event property to group by before taking the maximum."
                error={message('meter.groupBy')}
              >
                {({ id, ...field }) => (
                  <Input
                    id={id}
                    readOnly={isEdit}
                    disabled={isEdit}
                    {...field}
                    {...form.register('meter.groupBy')}
                  />
                )}
              </Field>
            ) : null}

            <Field label="Reset usage">
              {({ id, ...field }) => (
                <OptionSelect
                  id={id}
                  aria-describedby={field['aria-describedby']}
                  value={form.watch('meter.resetUsage')}
                  options={RESET_OPTIONS}
                  disabled={isEdit}
                  onValueChange={(next) =>
                    form.setValue('meter.resetUsage', next as ResetUsage, { shouldDirty: true })
                  }
                />
              )}
            </Field>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Event filters</p>
                <p className="text-muted-foreground text-xs">
                  Only events whose property matches one of the values are counted.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => filters.append({ key: '', valuesText: '' })}
              >
                <PlusIcon aria-hidden className="size-4" />
                Add filter
              </Button>
            </div>
            {filters.fields.map((row, index) => (
              <div key={row.id} className="grid items-start gap-3 sm:grid-cols-[1fr_1.5fr_auto]">
                <Field
                  label={`Filter ${index + 1} property`}
                  error={message(`${filterPath}.${index}.key`)}
                >
                  {({ id, ...field }) => (
                    <Input id={id} {...field} {...form.register(`filters.${index}.key`)} />
                  )}
                </Field>
                <Field
                  label={`Filter ${index + 1} values`}
                  hint="Comma separated."
                  error={message(`${filterPath}.${index}.values`)}
                >
                  {({ id, ...field }) => (
                    <Input id={id} {...field} {...form.register(`filters.${index}.valuesText`)} />
                  )}
                </Field>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="mt-6"
                  aria-label={`Remove filter ${index + 1}`}
                  onClick={() => filters.remove(index)}
                >
                  <Trash2Icon aria-hidden className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        </fieldset>
      ) : null}

      <fieldset className="flex flex-col gap-4 rounded-lg border p-4" disabled={isSubmitting}>
        <legend className="px-1 text-sm font-medium">Units</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Unit (singular)" error={message('unitSingular')}>
            {({ id, ...field }) => (
              <Input id={id} placeholder="call" {...field} {...form.register('unitSingular')} />
            )}
          </Field>
          <Field label="Unit (plural)" error={message('unitPlural')}>
            {({ id, ...field }) => (
              <Input id={id} placeholder="calls" {...field} {...form.register('unitPlural')} />
            )}
          </Field>
        </div>
        <p className="text-muted-foreground text-xs">
          Reporting unit: how usage is displayed in reports, as the feature unit times a conversion
          rate. Fill all three or none.
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Reporting unit (singular)" error={message('reportingUnit.unitSingular')}>
            {({ id, ...field }) => (
              <Input id={id} {...field} {...form.register('reportingUnit.unitSingular')} />
            )}
          </Field>
          <Field label="Reporting unit (plural)" error={message('reportingUnit.unitPlural')}>
            {({ id, ...field }) => (
              <Input id={id} {...field} {...form.register('reportingUnit.unitPlural')} />
            )}
          </Field>
          <Field label="Conversion rate" error={message('reportingUnit.conversionRate')}>
            {({ id, ...field }) => (
              <Input
                id={id}
                inputMode="decimal"
                {...field}
                {...form.register('reportingUnit.conversionRate')}
              />
            )}
          </Field>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-4 rounded-lg border p-4" disabled={isSubmitting}>
        <legend className="px-1 text-sm font-medium">Alerts</legend>
        <Field
          label="Usage alerts"
          hint={
            isEdit
              ? 'Turning this on replaces the feature’s current alert thresholds.'
              : 'Notify when usage crosses a threshold.'
          }
          error={message('alertSettings.info')}
        >
          {({ id, ...field }) => (
            <Switch
              id={id}
              aria-describedby={field['aria-describedby']}
              checked={alertsOn}
              onCheckedChange={setAlertsOn}
            />
          )}
        </Field>

        {alertsOn ? (
          <div className="flex flex-col gap-4">
            <Field label="Threshold type">
              {({ id, ...field }) => (
                <OptionSelect
                  id={id}
                  aria-describedby={field['aria-describedby']}
                  value={form.watch('alerts.thresholdType')}
                  options={THRESHOLD_TYPE_OPTIONS}
                  onValueChange={(next) =>
                    form.setValue('alerts.thresholdType', next as AlertThresholdType, {
                      shouldDirty: true,
                    })
                  }
                />
              )}
            </Field>
            {ALERT_SEVERITY_ORDER.map((severity) => (
              <div key={severity} className="grid gap-3 sm:grid-cols-2">
                <Field label={`${ALERT_SEVERITY_LABEL[severity]} condition`}>
                  {({ id, ...field }) => (
                    <OptionSelect
                      id={id}
                      aria-describedby={field['aria-describedby']}
                      value={form.watch(`alerts.${severity}.condition`)}
                      options={CONDITION_OPTIONS}
                      onValueChange={(next) =>
                        form.setValue(`alerts.${severity}.condition`, next as AlertCondition, {
                          shouldDirty: true,
                        })
                      }
                    />
                  )}
                </Field>
                <Field
                  label={`${ALERT_SEVERITY_LABEL[severity]} threshold`}
                  error={
                    message(`alertSettings.${severity}.threshold`) ??
                    message(`alertSettings.${severity}`)
                  }
                >
                  {({ id, ...field }) => (
                    <Input
                      id={id}
                      inputMode="decimal"
                      {...field}
                      {...form.register(`alerts.${severity}.threshold`)}
                    />
                  )}
                </Field>
              </div>
            ))}
          </div>
        ) : null}
      </fieldset>

      <FormActions
        mode={mode}
        noun="feature"
        onCancel={onCancel}
        isSubmitting={isSubmitting}
        submitError={submitError}
      />
    </form>
  )
}
