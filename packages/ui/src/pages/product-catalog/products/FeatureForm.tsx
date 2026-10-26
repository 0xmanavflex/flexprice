import { useState } from 'react'
import { useCalmForm } from '@ui/compositions/forms/useCalmForm'
import { get, useFieldArray, type Resolver } from 'react-hook-form'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import {
  AGGREGATION_DESCRIPTION,
  AGGREGATION_LABEL,
  AggregationType,
  FEATURE_TYPE_LABEL,
  FeatureType,
  ResetUsage,
  allowsExpression,
  createFeatureSchema,
  defaultFeatureLookupKey,
  editFeatureSchema,
  needsAggregationTarget,
  type CreateFeature,
  type EditFeature,
  type Feature,
} from '@fp/domain'
import { PlusIcon, Trash2Icon } from '@ui/icons'
import { Button } from '@ui/components/primitives/button'
import { Input } from '@ui/components/primitives/input'
import { Textarea } from '@ui/components/primitives/textarea'
import { Field } from '@ui/compositions/forms/Field'
import { CheckboxRow } from '@ui/compositions/forms/CheckboxRow'
import { FormCard, FormRow } from '@ui/compositions/forms/FormCard'
import { FormDisclosure } from '@ui/compositions/forms/FormDisclosure'
import { FormPage } from '@ui/compositions/forms/FormPage'
import { RadioGroup, RadioGroupItem } from '@ui/components/primitives/radio-group'
import type { DetailCrumb } from '@ui/compositions/detail/DetailShell'
import { OptionSelect, type Option } from '@ui/compositions/forms/OptionSelect'
import { provenance } from '@ui/provenance'

/**
 * Create or edit a feature.
 *
 * Replaces `AddFeature.tsx`: 1,106 lines holding a bespoke form hook and four
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
  composes: ['ui/input', 'ui/textarea', 'compositions/field'],
  note: 'RHF + the domain schemas; replaces a 1,106-line page holding four state slices.',
})

type FeatureFormProps = {
  onCancel: () => void
  isSubmitting?: boolean
  /** Server-side failure, already a sentence. */
  submitError?: string | null
  /** The tags a feature can be filed under. Empty disables the picker, never hides it. */
  groups?: readonly Option[]
  trail: DetailCrumb[]
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
    expression: string
    multiplier: string
    groupBy: string
    resetUsage: ResetUsage
  }
  filters: { key: string; valuesText: string }[]
}

const FORM_ID = 'feature-form'

const TYPES = [
  FeatureType.Metered,
  FeatureType.Boolean,
  FeatureType.Static,
  FeatureType.Config,
] as const

const TYPE_HINT: Record<FeatureType, string> = {
  [FeatureType.Metered]: 'Measured from events you send. Needs a meter.',
  [FeatureType.Boolean]: 'On or off for a plan.',
  [FeatureType.Static]: 'A fixed quantity, such as 10 seats.',
  [FeatureType.Config]: 'A configuration value carried on the plan.',
}

const AGGREGATION_ORDER: AggregationType[] = [
  AggregationType.Sum,
  AggregationType.Count,
  AggregationType.CountUnique,
  AggregationType.SumWithMultiplier,
  AggregationType.Latest,
  AggregationType.Max,
  AggregationType.WeightedSum,
]

const AGGREGATION_OPTIONS: Option[] = AGGREGATION_ORDER.map((value) => ({
  value,
  label: AGGREGATION_LABEL[value],
  description: AGGREGATION_DESCRIPTION[value],
}))

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
      aggregationType: AggregationType.Sum,
      field: '',
      expression: '',
      multiplier: '',
      groupBy: '',
      resetUsage: ResetUsage.BillingPeriod,
    },
    filters: [],
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
      expression: draft.meter.expression ?? '',
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
      expression: feature.aggregationExpression ?? '',
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

/**
 * Whether a type is measured, and so has a usage unit and a reporting unit.
 * Only a metered feature counts usage: a boolean is on or off, and a static
 * feature is a fixed quantity set on the plan, with nothing to count.
 */
const hasUnits = (type: FeatureType) => type === FeatureType.Metered

/**
 * The schema candidate: anything hidden or blank is left out rather than sent stale.
 *
 * Feature-level usage alerts are deliberately not offered here, and nothing is
 * sent for them, so an edit leaves whatever thresholds the feature already
 * carries untouched.
 */
function normalize(values: FormValues, mode: 'create' | 'edit', useExpression: boolean) {
  const ru = values.reportingUnit
  const units = hasUnits(values.type)
  const hasReportingUnit =
    units && [ru.unitSingular, ru.unitPlural, ru.conversionRate].some((v) => v.trim() !== '')

  const filters = values.filters.map((f) => ({ key: f.key, values: splitValues(f.valuesText) }))
  const expressionOn = useExpression && allowsExpression(values.meter.aggregationType)
  const shared = {
    name: values.name,
    description: values.description,
    ...(units ? { unitSingular: values.unitSingular, unitPlural: values.unitPlural } : {}),
    ...(values.groupId ? { groupId: values.groupId } : {}),
    ...(hasReportingUnit ? { reportingUnit: ru } : {}),
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
            ...(needsAggregationTarget(meter.aggregationType) && !expressionOn
              ? { field: meter.field }
              : {}),
            ...(expressionOn && meter.expression ? { expression: meter.expression } : {}),
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
  const { mode, onCancel, isSubmitting = false, submitError = null, groups = [], trail } = props
  const feature = props.mode === 'edit' ? props.feature : undefined
  const isEdit = mode === 'edit'

  const [useExpression, setUseExpression] = useState(
    Boolean(feature?.aggregationExpression?.trim()),
  )
  const schemaResolver = (isEdit
    ? standardSchemaResolver(editFeatureSchema)
    : standardSchemaResolver(createFeatureSchema)) as unknown as Resolver<FormValues>
  const resolver: Resolver<FormValues> = (values, context, options) => {
    const candidate = normalize(values, mode, useExpression) as unknown as FormValues
    return schemaResolver(candidate, context, options)
  }

  const form = useCalmForm<FormValues>({
    resolver,
    defaultValues: feature
      ? fromFeature(feature)
      : fromCreate(props.mode === 'create' ? props.defaultValue : undefined),
  })
  const filters = useFieldArray({ control: form.control, name: 'filters' })

  const type = form.watch('type')
  const aggregationType = form.watch('meter.aggregationType')
  const isMetered = type === FeatureType.Metered
  const expressionOn = useExpression && allowsExpression(aggregationType)

  const filterPath = isEdit ? 'filters' : 'meter.filters'
  const message = (path: string): string | undefined => {
    const found = get(form.formState.errors, path) as { message?: string } | undefined
    return found?.message
  }

  const nameField = form.register('name', {
    onChange: (event: { target: { value: string } }) => {
      // The key follows the name until the person types a key of their own.
      if (!isEdit && !form.getFieldState('lookupKey').isDirty) {
        form.setValue('lookupKey', defaultFeatureLookupKey(event.target.value))
      }
    },
  })

  const submitAll = form.handleSubmit((values) => {
    // The resolver returns the schema's parsed output, not the form value.
    if (props.mode === 'edit') props.onSubmit(values as unknown as EditFeature)
    else props.onSubmit(values as unknown as CreateFeature)
  })

  const singularField = form.register('unitSingular', {
    onChange: (event: { target: { value: string } }) => {
      if (!form.getFieldState('unitPlural').isDirty) {
        const singular = event.target.value.trim()
        form.setValue('unitPlural', singular ? `${singular}s` : '')
      }
    },
  })
  const reportingSingularField = form.register('reportingUnit.unitSingular', {
    onChange: (event: { target: { value: string } }) => {
      if (!form.getFieldState('reportingUnit.unitPlural').isDirty) {
        const singular = event.target.value.trim()
        form.setValue('reportingUnit.unitPlural', singular ? `${singular}s` : '')
      }
    },
  })

  const chooseAggregation = (next: AggregationType) => {
    form.setValue('meter.aggregationType', next, { shouldDirty: true })
    if (!allowsExpression(next)) {
      setUseExpression(false)
      form.setValue('meter.expression', '')
    }
  }

  const detailsRows = (
    <>
      <FormRow
        label="Name"
        hint="What the feature is called in the console and on plans. Also fills the lookup key and, for a metered feature, the meter name."
        required
        error={message('name')}
      >
        {({ id, ...field }) => <Input id={id} disabled={isSubmitting} {...field} {...nameField} />}
      </FormRow>
    </>
  )

  const optionalRows = (
    <>
      <FormRow
        label="Lookup key"
        hint={
          isEdit
            ? 'Fixed once set: integrations key off it.'
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
      </FormRow>
      <FormRow
        label="Description"
        hint="What the feature measures or unlocks. Optional."
        align="start"
        error={message('description')}
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
      </FormRow>
      <FormRow
        label="Tag"
        hint={
          groups.length > 0
            ? 'File the feature under a tag.'
            : 'File the feature under a tag. None exist yet: create one under Tags.'
        }
        error={message('groupId')}
      >
        {({ id, ...field }) => (
          <OptionSelect
            id={id}
            aria-describedby={field['aria-describedby']}
            value={form.watch('groupId')}
            options={groups}
            placeholder="No tag"
            disabled={isSubmitting || groups.length === 0}
            onValueChange={(next) => form.setValue('groupId', next, { shouldDirty: true })}
          />
        )}
      </FormRow>
    </>
  )

  const typeRows = (
    <FormRow
      label="Type"
      align="start"
      hint={
        isEdit
          ? 'The type is fixed once the feature exists.'
          : 'What kind of feature this is decides what you configure next.'
      }
    >
      <RadioGroup
        aria-label="Feature type"
        value={type}
        disabled={isSubmitting || isEdit}
        className="grid gap-3"
        onValueChange={(next) => {
          if (next === type || isEdit) return
          // A type switch keeps the shared fields and lets the schema drop the rest.
          form.setValue('type', next as FeatureType, { shouldDirty: true })
          form.clearErrors()
        }}
      >
        {TYPES.map((value) => (
          <label
            key={value}
            className="has-data-checked:border-primary has-data-checked:bg-primary/5 hover:bg-muted/40 flex cursor-pointer items-start gap-3 rounded-lg border p-3 has-[[data-disabled]]:cursor-not-allowed has-[[data-disabled]]:opacity-60"
          >
            <RadioGroupItem value={value} className="mt-0.5" />
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">{FEATURE_TYPE_LABEL[value]}</span>
              <span className="text-muted-foreground text-xs">{TYPE_HINT[value]}</span>
            </span>
          </label>
        ))}
      </RadioGroup>
    </FormRow>
  )

  const eventRows = (
    <>
      <FormRow
        label="Event name"
        required
        hint="The event whose usage is measured."
        error={message('meter.eventName')}
      >
        {({ id, ...field }) => (
          <Input
            id={id}
            readOnly={isEdit}
            disabled={isEdit}
            {...field}
            {...form.register('meter.eventName')}
          />
        )}
      </FormRow>
      <FormRow
        label="Event filters"
        hint="Only events whose property matches one of the values are counted."
        align="start"
      >
        <div className="flex flex-col gap-3">
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
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() => filters.append({ key: '', valuesText: '' })}
          >
            <PlusIcon aria-hidden className="size-4" />
            Add filter
          </Button>
        </div>
      </FormRow>
    </>
  )

  const aggregationRows = (
    <>
      <FormRow label="Aggregation" hint="How events are combined into a usage number.">
        {({ id, ...field }) => (
          <OptionSelect
            id={id}
            aria-describedby={field['aria-describedby']}
            value={aggregationType}
            options={AGGREGATION_OPTIONS}
            disabled={isEdit}
            onValueChange={(next) => chooseAggregation(next as AggregationType)}
          />
        )}
      </FormRow>

      {needsAggregationTarget(aggregationType) ? (
        <FormRow
          label={expressionOn ? 'Custom expression' : 'Event field'}
          required
          align="start"
          hint={
            expressionOn
              ? 'A CEL expression over the event. It replaces the event field, and only this is saved.'
              : 'The property on the event to aggregate.'
          }
          error={expressionOn ? message('meter.expression') : message('meter.field')}
        >
          {({ id, ...field }) => (
            <div className="flex flex-col gap-3">
              {allowsExpression(aggregationType) ? (
                <CheckboxRow
                  checked={useExpression}
                  disabled={isEdit}
                  onCheckedChange={(checked) => {
                    setUseExpression(checked)
                    if (checked) form.setValue('meter.field', '', { shouldDirty: true })
                    else form.setValue('meter.expression', '', { shouldDirty: true })
                  }}
                >
                  Use a custom expression
                </CheckboxRow>
              ) : null}
              {expressionOn ? (
                <Textarea
                  id={id}
                  rows={2}
                  readOnly={isEdit}
                  disabled={isEdit}
                  {...field}
                  {...form.register('meter.expression')}
                />
              ) : (
                <Input
                  id={id}
                  readOnly={isEdit}
                  disabled={isEdit}
                  {...field}
                  {...form.register('meter.field')}
                />
              )}
            </div>
          )}
        </FormRow>
      ) : null}

      {aggregationType === AggregationType.SumWithMultiplier ? (
        <FormRow
          label="Multiplier"
          hint="Scales each event's value before it is summed."
          required
          error={message('meter.multiplier')}
        >
          {({ id, ...field }) => (
            <Input
              id={id}
              inputMode="decimal"
              disabled={isEdit}
              {...field}
              {...form.register('meter.multiplier')}
            />
          )}
        </FormRow>
      ) : null}

      {aggregationType === AggregationType.Max ? (
        <FormRow
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
        </FormRow>
      ) : null}

      {/*
        Reset stays on the billing period. The control is kept out of the form
        until a second choice is something we want people to pick.
        <FormRow label="Reset usage">...</FormRow>
      */}
    </>
  )

  /* Only a metered feature is counted, so only it has units. */
  const unitRows = hasUnits(type) ? (
    <>
      <FormRow
        label="Unit (singular)"
        hint="Shown after a quantity of one, for example call."
        error={message('unitSingular')}
      >
        {({ id, ...field }) => (
          <Input id={id} placeholder={isMetered ? 'call' : 'seat'} {...field} {...singularField} />
        )}
      </FormRow>
      <FormRow
        label="Unit (plural)"
        hint="Shown after any other quantity, for example calls."
        error={message('unitPlural')}
      >
        {({ id, ...field }) => (
          <Input
            id={id}
            placeholder={isMetered ? 'calls' : 'seats'}
            {...field}
            {...form.register('unitPlural')}
          />
        )}
      </FormRow>
      <FormRow
        label="Reporting unit (singular)"
        hint="How usage is displayed in reports: the feature unit times a conversion rate. Fill all three or none."
        error={message('reportingUnit.unitSingular')}
      >
        {({ id, ...field }) => <Input id={id} {...field} {...reportingSingularField} />}
      </FormRow>
      <FormRow
        label="Reporting unit (plural)"
        hint="The unit usage is shown in on reports."
        error={message('reportingUnit.unitPlural')}
      >
        {({ id, ...field }) => (
          <Input id={id} {...field} {...form.register('reportingUnit.unitPlural')} />
        )}
      </FormRow>
      <FormRow
        label="Conversion rate"
        hint="How many feature units make one reporting unit."
        error={message('reportingUnit.conversionRate')}
      >
        {({ id, ...field }) => (
          <Input
            id={id}
            inputMode="decimal"
            {...field}
            {...form.register('reportingUnit.conversionRate')}
          />
        )}
      </FormRow>
    </>
  ) : null

  /*
   * What the feature *is* (Details), then, for a metered feature only, how it
   * is counted (Metering). Boolean and static features have no usage to count,
   * so they are Details alone.
   */
  const formEl = (
    <form id={FORM_ID} onSubmit={submitAll} noValidate>
      <fieldset className="flex min-w-0 flex-col gap-6 border-0 p-0" disabled={isSubmitting}>
        <legend className="sr-only">Feature</legend>
        <FormCard title="Feature">
          {detailsRows}
          {typeRows}
        </FormCard>
        {isMetered ? (
          <>
            <FormCard title="Units">{unitRows}</FormCard>
            <FormCard title="Event">{eventRows}</FormCard>
            <FormCard title="Aggregation">{aggregationRows}</FormCard>
          </>
        ) : null}
        <FormDisclosure
          title="Optional details"
          summary="Lookup key, description, and tag."
          forceOpen={Boolean(message('lookupKey') || message('description') || message('groupId'))}
        >
          {optionalRows}
        </FormDisclosure>
      </fieldset>
    </form>
  )

  return (
    <FormPage
      title={isEdit ? `Edit ${feature?.name ?? 'feature'}` : 'Create feature'}
      trail={trail}
      toolbar={{
        mode,
        noun: 'feature',
        formId: FORM_ID,
        onCancel,
        isSubmitting,
        submitError,
      }}
    >
      {formEl}
    </FormPage>
  )
}
