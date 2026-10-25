import { useCalmForm } from '@ui/compositions/forms/useCalmForm'
import { useState, type FormEvent } from 'react'
import { Controller, type Resolver } from 'react-hook-form'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import {
  type CreateEntitlement,
  type EditEntitlement,
  FeatureType,
  UsageResetPeriod,
  createEntitlementSchema,
  editEntitlementSchema,
  emptyEntitlement,
} from '@fp/domain'
import { Input } from '@ui/components/primitives/input'
import { Switch } from '@ui/components/primitives/switch'
import { Textarea } from '@ui/components/primitives/textarea'
import { Field } from '@ui/compositions/forms/Field'
import { FormActions } from '@ui/compositions/forms/FormActions'
import { OptionCombobox } from '@ui/compositions/forms/OptionCombobox'
import { provenance } from '@ui/provenance'
import { FeatureTypeGlyph } from '../../shared/cells'
import { MeteredEntitlementFields } from './MeteredEntitlementFields'

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
    'compositions/option-combobox',
    'ui/input',
    'ui/switch',
    'ui/textarea',
  ],
  note: 'RHF + domain entitlement schemas; fields follow the chosen feature’s type. Lineage: compositions/option-select.',
})

/** A feature an entitlement can be granted on. */
export interface FeatureOption {
  id: string
  name: string
  type: FeatureType
  /** Unit label for a metered feature, e.g. "calls": shown beside the limit. */
  unit?: string
}

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
  /** The plan's usage price for a metered feature, shown in the billing note. */
  usagePrice?: string | undefined
  /**
   * Not drawn: these forms have no Cancel. The container's own close (the
   * dialog's X, or the staged step's close) is the way out. Kept so callers
   * can still pass it.
   */
  onCancel?: (() => void) | undefined
  isSubmitting?: boolean
  submitError?: string | null
  submitLabel?: string
}

export interface EntitlementCreateFormProps extends SharedProps {
  /** Features not already entitled: offered as the choice. */
  features: FeatureOption[]
  /** Opens with this feature already chosen, e.g. from the product it was started on. */
  defaultFeatureId?: string
  /** Opens on a draft not yet saved, e.g. a staged entitlement being edited. */
  defaultValue?: CreateEntitlement | undefined
  onSubmit: (entitlement: CreateEntitlement) => void
}

export function EntitlementCreateForm({
  features,
  defaultFeatureId,
  defaultValue,
  onSubmit,
  isSubmitting = false,
  submitError = null,
  submitLabel,
  usagePrice,
}: EntitlementCreateFormProps) {
  const form = useCalmForm<CreateEntitlement>({
    resolver: standardSchemaResolver(createEntitlementSchema) as Resolver<CreateEntitlement>,
    defaultValues:
      defaultValue ??
      emptyEntitlement(
        defaultFeatureId ?? '',
        features.find((option) => option.id === defaultFeatureId)?.type ?? FeatureType.Metered,
      ),
  })
  const [configText, setConfigText] = useState(() =>
    defaultValue && 'configValue' in defaultValue && defaultValue.configValue
      ? JSON.stringify(defaultValue.configValue, null, 2)
      : '{}',
  )
  const [configError, setConfigError] = useState<string | null>(null)

  const featureId = form.watch('featureId')
  const featureType = form.watch('featureType')
  const feature = features.find((option) => option.id === featureId)
  const errors = form.formState.errors

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
      <Field
        label="Feature"
        hint="The feature being granted."
        required
        error={messageOf(errors, 'featureId')}
      >
        {({ id, 'aria-describedby': describedBy, 'aria-invalid': invalid }) => (
          <OptionCombobox
            id={id}
            value={featureId}
            onValueChange={choose}
            options={features.map((option) => ({
              value: option.id,
              label: option.name,
              ...(option.unit ? { hint: option.unit } : {}),
              trailing: <FeatureTypeGlyph type={option.type} />,
            }))}
            searchable
            placeholder="Search features…"
            emptyText="Every feature is already granted."
            disabled={isSubmitting}
            aria-describedby={describedBy}
            aria-invalid={invalid}
          />
        )}
      </Field>

      {feature && featureType === FeatureType.Metered ? (
        <MeteredEntitlementFields
          limit={form.watch('usageLimit' as never) as unknown as number | null | undefined}
          unlimited={form.watch('usageLimit' as never) === null}
          onLimitChange={(next) => {
            form.setValue('usageLimit' as never, next as never, { shouldValidate: true })
            if (next === null) form.setValue('usageResetPeriod' as never, null as never)
            else if (form.getValues('usageResetPeriod' as never) == null)
              form.setValue('usageResetPeriod' as never, UsageResetPeriod.Monthly as never)
          }}
          resetPeriod={
            form.watch('usageResetPeriod' as never) as unknown as UsageResetPeriod | null
          }
          onResetPeriodChange={(period) =>
            form.setValue('usageResetPeriod' as never, period as never)
          }
          unit={feature.unit}
          limitError={messageOf(errors, 'usageLimit')}
          disabled={isSubmitting}
          usagePrice={usagePrice}
        />
      ) : null}

      {feature && featureType === FeatureType.Static ? (
        <Field
          label="Value"
          hint="How much of the feature is included."
          required
          error={messageOf(errors, 'staticValue')}
        >
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
        <Field
          label="Configuration (JSON)"
          hint="Extra settings passed with the entitlement, as a JSON object."
          required
          error={configError ?? undefined}
        >
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
        isSubmitting={isSubmitting}
        submitError={submitError}
        {...(submitLabel ? { submitLabel } : {})}
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
  isSubmitting = false,
  submitError = null,
  usagePrice,
}: EntitlementEditFormProps) {
  const form = useCalmForm<EditEntitlement>({
    resolver: standardSchemaResolver(editEntitlementSchema) as Resolver<EditEntitlement>,
    defaultValues: defaultValue,
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
        <MeteredEntitlementFields
          limit={form.watch('usageLimit')}
          unlimited={form.watch('usageLimit') == null}
          onLimitChange={(next) =>
            form.setValue('usageLimit', next ?? undefined, { shouldValidate: true })
          }
          resetPeriod={form.watch('usageResetPeriod')}
          onResetPeriodChange={(period) => form.setValue('usageResetPeriod', period)}
          unit={feature.unit}
          limitError={messageOf(errors, 'usageLimit')}
          disabled={isSubmitting}
          lockUnlimited
          usagePrice={usagePrice}
        />
      ) : null}

      {feature.type === FeatureType.Static ? (
        <Field
          label="Value"
          hint="How much of the feature is included."
          required
          error={messageOf(errors, 'staticValue')}
        >
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
        <Field
          label="Configuration (JSON)"
          hint="Extra settings passed with the entitlement, as a JSON object."
          required
          error={configError ?? undefined}
        >
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

      <FormActions mode="edit" isSubmitting={isSubmitting} submitError={submitError} />
    </form>
  )
}
