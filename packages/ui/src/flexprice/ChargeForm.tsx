import { useEffect } from 'react'
import { Controller, useForm, type Resolver } from 'react-hook-form'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import {
  BILLING_MODEL_LABEL,
  BILLING_PERIOD_LABEL,
  BillingModel,
  BillingPeriod,
  type CreateCharge,
  INVOICE_CADENCE_LABEL,
  InvoiceCadence,
  PriceType,
  type Tier,
  TIER_MODE_LABEL,
  TierMode,
  createChargeSchema,
  emptyCharge,
} from '@fp/domain'
import { Button } from '@ui/primitives/button'
import { Input } from '@ui/primitives/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@ui/primitives/select'
import {
  NumberField,
  NumberFieldDecrement,
  NumberFieldGroup,
  NumberFieldIncrement,
  NumberFieldInput,
} from '@ui/components/reui/number-field'
import { Field } from '@ui/compositions/Field'
import { provenance } from '@ui/provenance'
import { TierTable, type TierRowError } from './TierTable'

/**
 * One charge, as a form.
 *
 * The Fixed and Usage variants of V1's charge builder, unified: a card's `type`
 * is fixed when it is added, and the form shows exactly the fields that type
 * needs — a usage charge names the feature it meters and always bills in
 * arrears; a fixed charge chooses its invoice cadence. Everything else is
 * shared, so the two do not drift into two half-maintained forms.
 *
 * Like `PriceOverrideForm`, it holds no state: `react-hook-form` owns the values
 * and `createChargeSchema` owns the rules, so switching billing model resets to
 * a structurally valid shape rather than leaving the previous model's fields
 * behind. It emits a validated `CreateCharge`; it never touches `@fp/query`.
 */
export const ChargeFormProvenance = provenance({
  source: 'composition',
  composes: ['@reui/number-field', 'ui/select', 'ui/input', 'ui/button'],
  note: 'RHF + the domain charge schema; a single form for the fixed and usage variants.',
})

/** A metered feature the usage variant can charge against. */
export interface MeterOption {
  id: string
  name: string
}

export interface ChargeFormProps {
  /** Fixed once the card is added — it decides which fields show. */
  type: PriceType
  defaultValue?: CreateCharge
  /** The metered features a usage charge may bill against. */
  meters?: MeterOption[]
  currencies?: string[]
  onSubmit: (charge: CreateCharge) => void
  onCancel?: () => void
  isSubmitting?: boolean
}

const BILLING_MODELS = [BillingModel.FlatFee, BillingModel.Package, BillingModel.Tiered] as const
const TIER_MODES = [TierMode.Volume, TierMode.Slab] as const
const DEFAULT_CURRENCIES = ['USD', 'EUR', 'GBP']

/** Fixed charges can be one-time; usage cannot — you cannot meter a one-off. */
const FIXED_PERIODS = [
  BillingPeriod.Daily,
  BillingPeriod.Weekly,
  BillingPeriod.Monthly,
  BillingPeriod.Quarterly,
  BillingPeriod.HalfYearly,
  BillingPeriod.Annual,
  BillingPeriod.OneTime,
] as const
const USAGE_PERIODS = FIXED_PERIODS.filter((p) => p !== BillingPeriod.OneTime)

export function ChargeForm({
  type,
  defaultValue,
  meters = [],
  currencies = DEFAULT_CURRENCIES,
  onSubmit,
  onCancel,
  isSubmitting = false,
}: ChargeFormProps) {
  const form = useForm<CreateCharge>({
    resolver: standardSchemaResolver(createChargeSchema) as Resolver<CreateCharge>,
    defaultValues: defaultValue ?? emptyCharge(type, BillingModel.FlatFee),
    mode: 'onTouched',
  })

  useEffect(() => {
    if (defaultValue) form.reset(defaultValue)
  }, [defaultValue, form])

  const billingModel = form.watch('billingModel')
  const errors = form.formState.errors
  const isUsage = type === PriceType.Usage
  const periods = isUsage ? USAGE_PERIODS : FIXED_PERIODS

  // Switching model replaces the whole value, so a tier array can never survive
  // into a flat fee and be submitted invisibly. Common fields are re-seeded from
  // the current values so the choice made so far is not lost.
  const changeModel = (next: BillingModel) => {
    if (next === billingModel) return
    const fresh = emptyCharge(type, next)
    const current = form.getValues()
    form.reset({
      ...fresh,
      currency: current.currency,
      billingPeriod: current.billingPeriod,
      invoiceCadence: current.invoiceCadence,
      ...(isUsage ? { meterId: current.meterId } : {}),
      ...(current.displayName ? { displayName: current.displayName } : {}),
    } as CreateCharge)
  }

  const tiers = (form.watch('tiers' as never) ?? []) as Tier[]
  const tierRowErrors: Record<number, TierRowError> = {}
  const rawTierErrors = (errors as { tiers?: unknown }).tiers
  if (Array.isArray(rawTierErrors)) {
    rawTierErrors.forEach((rowError, index) => {
      const row = rowError as { upTo?: { message?: string }; unitAmount?: { message?: string } }
      if (row?.upTo?.message || row?.unitAmount?.message) {
        tierRowErrors[index] = {
          ...(row.upTo?.message ? { upTo: row.upTo.message } : {}),
          ...(row.unitAmount?.message ? { unitAmount: row.unitAmount.message } : {}),
        }
      }
    })
  }
  const tierMessage = (rawTierErrors as { message?: string } | undefined)?.message

  return (
    <form
      onSubmit={form.handleSubmit((values) => onSubmit(values))}
      noValidate
      className="flex flex-col gap-4"
    >
      {isUsage ? (
        <Field label="Metered feature" required error={errors.meterId?.message}>
          {({ id }) => (
            <Controller
              control={form.control}
              name={'meterId' as never}
              render={({ field }) => (
                <Select
                  value={(field.value as string) || ''}
                  onValueChange={field.onChange}
                  disabled={isSubmitting}
                >
                  <SelectTrigger id={id}>
                    <SelectValue placeholder="Choose a feature to meter" />
                  </SelectTrigger>
                  <SelectContent>
                    {meters.length === 0 ? (
                      <SelectItem value="__none" disabled>
                        No metered features
                      </SelectItem>
                    ) : (
                      meters.map((meter) => (
                        <SelectItem key={meter.id} value={meter.id}>
                          {meter.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              )}
            />
          )}
        </Field>
      ) : null}

      <Field label="Display name" hint="Optional. What this charge is called on an invoice.">
        {({ id, ...field }) => (
          <Input
            id={id}
            disabled={isSubmitting}
            placeholder={isUsage ? 'e.g. API calls' : 'e.g. Platform base'}
            {...field}
            {...form.register('displayName' as never)}
          />
        )}
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Currency" required>
          {({ id }) => (
            <Controller
              control={form.control}
              name="currency"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange} disabled={isSubmitting}>
                  <SelectTrigger id={id}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {currencies.map((code) => (
                      <SelectItem key={code} value={code}>
                        {code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          )}
        </Field>

        <Field label="Billing period" required>
          {({ id }) => (
            <Controller
              control={form.control}
              name="billingPeriod"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange} disabled={isSubmitting}>
                  <SelectTrigger id={id}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {periods.map((period) => (
                      <SelectItem key={period} value={period}>
                        {BILLING_PERIOD_LABEL[period]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          )}
        </Field>
      </div>

      <fieldset className="flex flex-col gap-2" disabled={isSubmitting}>
        <legend className="mb-1 text-sm font-medium">Billing model</legend>
        <div className="flex flex-wrap gap-2">
          {BILLING_MODELS.map((model) => (
            <Button
              key={model}
              type="button"
              size="sm"
              variant={model === billingModel ? 'default' : 'outline'}
              aria-pressed={model === billingModel}
              onClick={() => changeModel(model)}
            >
              {BILLING_MODEL_LABEL[model]}
            </Button>
          ))}
        </div>
      </fieldset>

      {billingModel === BillingModel.FlatFee || billingModel === BillingModel.Package ? (
        <div className="grid grid-cols-2 gap-3">
          <Field
            label={billingModel === BillingModel.Package ? 'Price per package' : 'Amount'}
            required
            error={(errors as { amount?: { message?: string } }).amount?.message}
          >
            {({ id, 'aria-describedby': describedBy }) => (
              <Controller
                control={form.control}
                name={'amount' as never}
                render={({ field }) => (
                  <NumberField
                    id={id}
                    min={0}
                    value={
                      field.value === '' || field.value == null ? null : Number(field.value)
                    }
                    onValueChange={(value) =>
                      field.onChange(value == null ? '' : String(value))
                    }
                    disabled={isSubmitting}
                  >
                    <NumberFieldGroup>
                      <NumberFieldDecrement />
                      <NumberFieldInput
                        aria-label="Amount"
                        aria-describedby={describedBy}
                        aria-invalid={
                          (errors as { amount?: unknown }).amount ? true : undefined
                        }
                      />
                      <NumberFieldIncrement />
                    </NumberFieldGroup>
                  </NumberField>
                )}
              />
            )}
          </Field>

          {billingModel === BillingModel.Package ? (
            <Field
              label="Units per package"
              hint="The price above buys this many units."
              error={(errors as { divideBy?: { message?: string } }).divideBy?.message}
            >
              {({ id }) => (
                <Controller
                  control={form.control}
                  name={'divideBy' as never}
                  render={({ field }) => (
                    <NumberField
                      id={id}
                      min={1}
                      step={1}
                      value={typeof field.value === 'number' ? field.value : null}
                      onValueChange={(value) => field.onChange(value ?? 1)}
                      disabled={isSubmitting}
                    >
                      <NumberFieldGroup>
                        <NumberFieldDecrement />
                        <NumberFieldInput aria-label="Units per package" />
                        <NumberFieldIncrement />
                      </NumberFieldGroup>
                    </NumberField>
                  )}
                />
              )}
            </Field>
          ) : null}
        </div>
      ) : null}

      {billingModel === BillingModel.Tiered ? (
        <div className="flex flex-col gap-3">
          <Field label="Tier mode">
            {({ id }) => (
              <Controller
                control={form.control}
                name={'tierMode' as never}
                render={({ field }) => (
                  <Select
                    value={(field.value as string) || TierMode.Volume}
                    onValueChange={field.onChange}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger id={id}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIER_MODES.map((mode) => (
                        <SelectItem key={mode} value={mode}>
                          {TIER_MODE_LABEL[mode]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            )}
          </Field>

          <TierTable
            tiers={tiers}
            onChange={(next) =>
              form.setValue('tiers' as never, next as never, {
                shouldDirty: true,
                shouldValidate: true,
              })
            }
            disabled={isSubmitting}
          />
          {tierMessage ? (
            <p role="alert" className="text-xs text-destructive">
              {tierMessage}
            </p>
          ) : null}
        </div>
      ) : null}

      {!isUsage ? (
        <Field label="Invoice timing" required>
          {({ id }) => (
            <Controller
              control={form.control}
              name="invoiceCadence"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange} disabled={isSubmitting}>
                  <SelectTrigger id={id}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[InvoiceCadence.Advance, InvoiceCadence.Arrear].map((cadence) => (
                      <SelectItem key={cadence} value={cadence}>
                        {INVOICE_CADENCE_LABEL[cadence]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          )}
        </Field>
      ) : (
        <p className="text-xs text-muted-foreground">
          Usage charges bill in arrears — once the period's usage is known.
        </p>
      )}

      <div className="flex gap-2 border-t pt-3">
        <Button type="submit" size="sm" disabled={isSubmitting}>
          {defaultValue ? 'Update charge' : 'Add charge'}
        </Button>
        {onCancel ? (
          <Button type="button" size="sm" variant="outline" disabled={isSubmitting} onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  )
}
