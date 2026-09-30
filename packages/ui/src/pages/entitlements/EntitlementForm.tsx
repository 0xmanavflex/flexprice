import { useState, type FormEvent } from 'react'
import { Controller, useForm, type Resolver } from 'react-hook-form'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import {
  type CreateEntitlement,
  type EditEntitlement,
  FeatureType,
  USAGE_RESET_PERIOD_LABEL,
  UsageResetPeriod,
  createEntitlementSchema,
  editEntitlementSchema,
  emptyEntitlement,
} from '@fp/domain'
import { Input } from '@ui/components/primitives/input'
import { Switch } from '@ui/components/primitives/switch'
import { Textarea } from '@ui/components/primitives/textarea'
import { Field } from '@ui/compositions/Field'
import { FormActions } from '@ui/compositions/FormActions'
import { OptionCombobox } from '@ui/compositions/OptionCombobox'
import { OptionSelect } from '@ui/compositions/OptionSelect'
import { provenance } from '@ui/provenance'

/**
 * Grant or change an entitlement, as a form.
 *
 * The feature decides the whole shape: a metered feature asks for a limit, a
 * reset period and whether going over is allowed; a static one a value; a
 * boolean one on/off; a config one a JSON blob. Create picks the feature first
 * and shapes the rest to it; edit opens on a fixed feature and only its own
 * fields. `react-hook-form` owns the values, the domain create and edit schemas
 * the rules.
 */
export const EntitlementFormProvenance = provenance({
  source: 'composition',
  composes: [
    'compositions/field',
    'compositions/form-actions',
    'compositions/option-select',
    'compositions/option-combobox',
    'ui/input',
    'ui/switch',
    'ui/textarea',
  ],
  note: 'RHF + domain entitlement schemas; fields follow the chosen feature’s type.',
})

/** A feature an entitlement can be granted on. */
export interface FeatureOption {
  id: string
  name: string
  type: FeatureType
  /** Unit label for a metered feature, e.g. "calls" — shown beside the limit. */
  unit?: string
}

const RESET_OPTIONS = Object.values(UsageResetPeriod).map((period) => ({
  value: period,
  label: USAGE_RESET_PERIOD_LABEL[period],
}))

const messageOf = (errors: unknown, key: string): string | undefined =>
  (errors as Record<string, { message?: string } | undefined>)[key]?.message

const parseConfig = (text: string): Record<string, unknown> | null => {
  try {
    const parsed: unknown = JSON.parse(text)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

interface SharedProps {
  onCancel?: () => void
  isSubmitting?: boolean
  submitError?: string | null
}

export interface EntitlementCreateFormProps extends SharedProps {
  /** Features not already entitled — offered as the choice. */
  features: FeatureOption[]
  onSubmit: (entitlement: CreateEntitlement) => void
}

export function EntitlementCreateForm({
  features,
  onSubmit,
  onCancel,
  isSubmitting = false,
  submitError = null,
}: EntitlementCreateFormProps) {
  const form = useForm<CreateEntitlement>({
    resolver: standardSchemaResolver(createEntitlementSchema) as Resolver<CreateEntitlement>,
    defaultValues: emptyEntitlement('', FeatureType.Metered),
    mode: 'onTouched',
  })
  const [configText, setConfigText] = useState('{}')
  const [configError, setConfigError] = useState<string | null>(null)

  const featureId = form.watch('featureId')
  const featureType = form.watch('featureType')
  const feature = features.find((option) => option.id === featureId)
  const errors = form.formState.errors
  const unlimited = form.watch('usageLimit' as never) === null

  const choose = (id: string) => {
    const next = features.find((option) => option.id === id)
    setConfigText('{}')
    setConfigError(null)
    form.reset(emptyEntitlement(id, next?.type ?? FeatureType.Metered))
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    if (featureId && featureType === FeatureType.Config) {
      const parsed = parseConfig(configText)
      if (!parsed) {
        event.preventDefault()
        setConfigError('Configuration must be a valid JSON object')
        return undefined
      }
      setConfigError(null)
      form.setValue('configValue' as never, parsed as never)
    }
    return form.handleSubmit((values) => onSubmit(values))(event)
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <Field label="Feature" required error={messageOf(errors, 'featureId')}>
        {({ id, 'aria-describedby': describedBy, 'aria-invalid': invalid }) => (
          <OptionCombobox
            id={id}
            value={featureId}
            onValueChange={choose}
            options={features.map((option) => ({ value: option.id, label: option.name }))}
            placeholder="Choose a feature"
            emptyText="Every feature is already granted."
            disabled={isSubmitting}
            aria-describedby={describedBy}
            aria-invalid={invalid}
          />
        )}
      </Field>

      {feature && featureType === FeatureType.Metered ? (
        <>
          <Field
            label="Usage limit"
            error={messageOf(errors, 'usageLimit')}
            {...(feature.unit ? { hint: `In ${feature.unit}.` } : {})}
          >
            {({ id, ...field }) => (
              <Input
                id={id}
                inputMode="numeric"
                disabled={isSubmitting || unlimited}
                placeholder={unlimited ? 'Unlimited' : '0'}
                {...field}
                {...form.register('usageLimit' as never, {
                  setValueAs: (value: unknown) =>
                    value === '' || value == null ? undefined : Number(value),
                })}
              />
            )}
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <Switch
              checked={unlimited}
              onCheckedChange={(checked) => {
                form.setValue('usageLimit' as never, (checked ? null : 0) as never, {
                  shouldValidate: true,
                })
                form.setValue(
                  'usageResetPeriod' as never,
                  (checked ? null : UsageResetPeriod.Monthly) as never,
                )
              }}
              disabled={isSubmitting}
            />
            Unlimited — no cap on usage
          </label>
          <Field label="Usage reset">
            {({ id }) => (
              <Controller
                control={form.control}
                name={'usageResetPeriod' as never}
                render={({ field }) => (
                  <OptionSelect
                    id={id}
                    value={(field.value as string | null) ?? UsageResetPeriod.Monthly}
                    onValueChange={field.onChange}
                    options={RESET_OPTIONS}
                    disabled={isSubmitting || unlimited}
                  />
                )}
              />
            )}
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <Controller
              control={form.control}
              name={'isSoftLimit' as never}
              render={({ field }) => (
                <Switch
                  checked={Boolean(field.value)}
                  onCheckedChange={field.onChange}
                  disabled={isSubmitting}
                />
              )}
            />
            Soft limit — allow usage past the limit
          </label>
        </>
      ) : null}

      {feature && featureType === FeatureType.Static ? (
        <Field label="Value" required error={messageOf(errors, 'staticValue')}>
          {({ id, ...field }) => (
            <Input
              id={id}
              placeholder="e.g. 25"
              disabled={isSubmitting}
              {...field}
              {...form.register('staticValue' as never)}
            />
          )}
        </Field>
      ) : null}

      {feature && featureType === FeatureType.Boolean ? (
        <label className="flex items-center gap-2 text-sm">
          <Controller
            control={form.control}
            name={'isEnabled' as never}
            render={({ field }) => (
              <Switch
                checked={Boolean(field.value)}
                onCheckedChange={field.onChange}
                disabled={isSubmitting}
              />
            )}
          />
          Enabled on this plan
        </label>
      ) : null}

      {feature && featureType === FeatureType.Config ? (
        <Field label="Configuration (JSON)" required error={configError ?? undefined}>
          {({ id, ...field }) => (
            <Textarea
              id={id}
              rows={5}
              className="font-mono text-xs"
              disabled={isSubmitting}
              value={configText}
              onChange={(event) => setConfigText(event.target.value)}
              {...field}
            />
          )}
        </Field>
      ) : null}

      <FormActions
        mode="create"
        noun="entitlement"
        onCancel={onCancel}
        isSubmitting={isSubmitting}
        submitError={submitError}
      />
    </form>
  )
}

export interface EntitlementEditFormProps extends SharedProps {
  feature: FeatureOption
  defaultValue: EditEntitlement
  onSubmit: (edit: EditEntitlement) => void
}

export function EntitlementEditForm({
  feature,
  defaultValue,
  onSubmit,
  onCancel,
  isSubmitting = false,
  submitError = null,
}: EntitlementEditFormProps) {
  const form = useForm<EditEntitlement>({
    resolver: standardSchemaResolver(editEntitlementSchema) as Resolver<EditEntitlement>,
    defaultValues: defaultValue,
    mode: 'onTouched',
  })
  const [configText, setConfigText] = useState(
    JSON.stringify(defaultValue.configValue ?? {}, null, 2),
  )
  const [configError, setConfigError] = useState<string | null>(null)
  const errors = form.formState.errors

  const submit = (event: FormEvent<HTMLFormElement>) => {
    if (feature.type === FeatureType.Config) {
      const parsed = parseConfig(configText)
      if (!parsed) {
        event.preventDefault()
        setConfigError('Configuration must be a valid JSON object')
        return undefined
      }
      setConfigError(null)
      form.setValue('configValue', parsed)
    }
    return form.handleSubmit((values) => onSubmit(values))(event)
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <Field label="Feature" hint="Fixed once granted. Remove it and add another to change it.">
        {({ id }) => <Input id={id} value={feature.name} readOnly disabled />}
      </Field>

      {feature.type === FeatureType.Metered ? (
        <>
          <Field
            label="Usage limit"
            error={messageOf(errors, 'usageLimit')}
            hint={
              defaultValue.usageLimit === undefined
                ? 'Currently unlimited. A limit cannot be removed once set.'
                : `${feature.unit ? `In ${feature.unit}. ` : ''}A limit cannot be removed once set.`
            }
          >
            {({ id, ...field }) => (
              <Input
                id={id}
                inputMode="numeric"
                disabled={isSubmitting}
                {...field}
                {...form.register('usageLimit', {
                  setValueAs: (value: unknown) =>
                    value === '' || value == null ? undefined : Number(value),
                })}
              />
            )}
          </Field>
          <Field label="Usage reset">
            {({ id }) => (
              <Controller
                control={form.control}
                name="usageResetPeriod"
                render={({ field }) => (
                  <OptionSelect
                    id={id}
                    value={field.value ?? UsageResetPeriod.Monthly}
                    onValueChange={field.onChange}
                    options={RESET_OPTIONS}
                    disabled={isSubmitting}
                  />
                )}
              />
            )}
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <Controller
              control={form.control}
              name="isSoftLimit"
              render={({ field }) => (
                <Switch
                  checked={Boolean(field.value)}
                  onCheckedChange={field.onChange}
                  disabled={isSubmitting}
                />
              )}
            />
            Soft limit — allow usage past the limit
          </label>
        </>
      ) : null}

      {feature.type === FeatureType.Static ? (
        <Field label="Value" required error={messageOf(errors, 'staticValue')}>
          {({ id, ...field }) => (
            <Input id={id} disabled={isSubmitting} {...field} {...form.register('staticValue')} />
          )}
        </Field>
      ) : null}

      {feature.type === FeatureType.Boolean ? (
        <label className="flex items-center gap-2 text-sm">
          <Controller
            control={form.control}
            name="isEnabled"
            render={({ field }) => (
              <Switch
                checked={Boolean(field.value)}
                onCheckedChange={field.onChange}
                disabled={isSubmitting}
              />
            )}
          />
          Enabled on this plan
        </label>
      ) : null}

      {feature.type === FeatureType.Config ? (
        <Field label="Configuration (JSON)" required error={configError ?? undefined}>
          {({ id, ...field }) => (
            <Textarea
              id={id}
              rows={5}
              className="font-mono text-xs"
              disabled={isSubmitting}
              value={configText}
              onChange={(event) => setConfigText(event.target.value)}
              {...field}
            />
          )}
        </Field>
      ) : null}

      <FormActions
        mode="edit"
        onCancel={onCancel}
        isSubmitting={isSubmitting}
        submitError={submitError}
      />
    </form>
  )
}
