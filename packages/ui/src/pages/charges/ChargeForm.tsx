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
  PRICE_TYPE_LABEL,
  PriceType,
  type Tier,
  TIER_MODE_LABEL,
  TierMode,
  createChargeSchema,
  emptyCharge,
} from '@fp/domain'
import { Input } from '@ui/components/primitives/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@ui/components/primitives/tabs'
import { Alert, AlertDescription, AlertTitle } from '@ui/components/reui/alert'
import { DateInput } from '@ui/compositions/DateInput'
import { Field } from '@ui/compositions/Field'
import { FormActions } from '@ui/compositions/FormActions'
import { OptionCombobox } from '@ui/compositions/OptionCombobox'
import { OptionSelect } from '@ui/compositions/OptionSelect'
import { provenance } from '@ui/provenance'
import { TierTable, type TierRowError } from './TierTable'

/**
 * One charge (a price), as a form — create or edit.
 *
 * Fixed and usage are one form: the type tab decides which fields exist — a
 * usage charge names the meter it bills and always bills in arrears; a fixed
 * charge chooses its invoice cadence and may carry a free trial. The billing
 * model tabs (flat fee, package, tiered) each show only their own fields.
 *
 * On an edit the API lets only the price itself change — amount or bands, model,
 * display name. Currency, period, meter, cadence and price unit are shown but
 * locked, and the change is saved as a **new version** from an `Effective from`
 * date, which the form says plainly.
 *
 * `react-hook-form` owns the values and `createChargeSchema` the rules. Switching
 * billing model or type resets to a structurally valid shape rather than leaving
 * the previous one's fields behind. It emits a validated `CreateCharge`; it never
 * touches `@fp/query`.
 */
export const ChargeFormProvenance = provenance({
  source: 'composition',
  composes: [
    'ui/tabs',
    'compositions/field',
    'compositions/form-actions',
    'compositions/option-select',
    'compositions/option-combobox',
    'compositions/date-input',
    '@reui/alert',
    'ui/input',
  ],
  note: 'RHF + the domain charge schema; type and billing model as stock Tabs, tier table for banded pricing.',
})

/** A metered feature the usage variant can charge against. */
export interface MeterOption {
  id: string
  name: string
}

/** A custom price unit a charge can be denominated in instead of a currency. */
export interface PriceUnitOption {
  code: string
  name: string
  /** The currency the unit converts into; the charge's currency follows it. */
  baseCurrency: string
}

export interface ChargeFormProps {
  mode: 'create' | 'edit'
  defaultValue?: CreateCharge
  /** The metered features a usage charge may bill against. */
  meters?: MeterOption[]
  priceUnits?: PriceUnitOption[]
  currencies?: string[]
  onSubmit: (charge: CreateCharge) => void
  onCancel?: () => void
  isSubmitting?: boolean
  submitError?: string | null
  /** Overrides the submit label, e.g. "Add charge" when the charge is staged, not saved. */
  submitLabel?: string
  /** Hides the Fixed/Usage tabs when the type was already chosen (e.g. by a dialog's first step). */
  lockType?: boolean
}

const BILLING_MODELS = [BillingModel.FlatFee, BillingModel.Package, BillingModel.Tiered] as const
const TIER_MODES = [TierMode.Volume, TierMode.Slab] as const
const DEFAULT_CURRENCIES = ['USD', 'EUR', 'GBP', 'INR']
const FIAT = 'FIAT'

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

const periodOptions = (periods: readonly BillingPeriod[]) =>
  periods.map((period) => ({ value: period, label: BILLING_PERIOD_LABEL[period] }))

const messageOf = (errors: unknown, key: string): string | undefined =>
  (errors as Record<string, { message?: string } | undefined>)[key]?.message

export function ChargeForm({
  mode,
  defaultValue,
  meters = [],
  priceUnits = [],
  currencies = DEFAULT_CURRENCIES,
  onSubmit,
  onCancel,
  isSubmitting = false,
  submitError = null,
  submitLabel,
  lockType = false,
}: ChargeFormProps) {
  const isEdit = mode === 'edit'
  const form = useForm<CreateCharge>({
    resolver: standardSchemaResolver(createChargeSchema) as Resolver<CreateCharge>,
    defaultValues: defaultValue ?? emptyCharge(PriceType.Fixed, BillingModel.FlatFee),
    mode: 'onTouched',
  })

  const type = form.watch('type')
  const billingModel = form.watch('billingModel')
  const currency = form.watch('currency')
  const billingPeriod = form.watch('billingPeriod')
  const priceUnit = form.watch('priceUnit')
  const errors = form.formState.errors
  const isUsage = type === PriceType.Usage
  const periods = isUsage ? USAGE_PERIODS : FIXED_PERIODS
  const unitLabel = priceUnit || currency
  const lockedInput = (id: string, value: string) => (
    <Input id={id} value={value} readOnly disabled />
  )

  // Switching type or model replaces the whole value, so a tier array can never
  // survive into a flat fee and be submitted invisibly. Choices made so far are
  // re-seeded from the current values so they are not lost.
  const reseed = (nextType: PriceType, nextModel: BillingModel) => {
    const fresh = emptyCharge(nextType, nextModel)
    const current = form.getValues()
    const period =
      nextType === PriceType.Usage && current.billingPeriod === BillingPeriod.OneTime
        ? BillingPeriod.Monthly
        : current.billingPeriod
    form.reset({
      ...fresh,
      currency: current.currency,
      billingPeriod: period,
      ...(nextType === current.type ? { invoiceCadence: current.invoiceCadence } : {}),
      ...(current.displayName ? { displayName: current.displayName } : {}),
      ...(current.priceUnit ? { priceUnit: current.priceUnit } : {}),
      ...(current.effectiveFrom ? { effectiveFrom: current.effectiveFrom } : {}),
      ...(nextType === PriceType.Fixed && current.trialPeriodDays
        ? { trialPeriodDays: current.trialPeriodDays }
        : {}),
      ...(nextType === PriceType.Usage && nextType === current.type
        ? { meterId: current.meterId }
        : {}),
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

  const amountField = (label: string) => (
    <Field label={label} required error={messageOf(errors, 'amount')}>
      {({ id, ...field }) => (
        <Input
          id={id}
          inputMode="decimal"
          placeholder="0.00"
          disabled={isSubmitting}
          {...field}
          {...form.register('amount' as never)}
        />
      )}
    </Field>
  )

  return (
    <form
      onSubmit={form.handleSubmit((values) => onSubmit(values))}
      noValidate
      className="flex flex-col gap-5"
    >
      {isEdit ? (
        <Alert>
          <AlertTitle>Changing the price creates a new version</AlertTitle>
          <AlertDescription>
            The current price keeps billing until the effective date, so past invoices are
            unaffected. Currency, period, meter and invoice timing are fixed once a charge exists.
          </AlertDescription>
        </Alert>
      ) : lockType ? null : (
        <Tabs value={type} onValueChange={(next) => reseed(next as PriceType, billingModel)}>
          <TabsList aria-label="Charge type">
            {[PriceType.Fixed, PriceType.Usage].map((value) => (
              <TabsTrigger key={value} value={value} disabled={isSubmitting}>
                {PRICE_TYPE_LABEL[value]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {isUsage ? (
          <Field
            label="Metered feature"
            required
            error={messageOf(errors, 'meterId')}
            hint={isEdit ? 'Fixed once created.' : 'The feature whose usage this charge bills.'}
          >
            {({ id, 'aria-describedby': describedBy, 'aria-invalid': invalid }) => (
              <Controller
                control={form.control}
                name={'meterId' as never}
                render={({ field }) => (
                  <OptionCombobox
                    id={id}
                    value={(field.value as string) || ''}
                    onValueChange={field.onChange}
                    options={meters.map((meter) => ({ value: meter.id, label: meter.name }))}
                    placeholder="Choose a feature to meter"
                    emptyText="No metered features."
                    disabled={isSubmitting || isEdit}
                    aria-describedby={describedBy}
                    aria-invalid={invalid}
                  />
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

        <Field
          label="Currency"
          required
          {...(priceUnit ? { hint: 'Follows the price unit.' } : {})}
        >
          {({ id, 'aria-describedby': describedBy }) =>
            isEdit || priceUnit ? (
              lockedInput(id, currency.toUpperCase())
            ) : (
              <Controller
                control={form.control}
                name="currency"
                render={({ field }) => (
                  <OptionSelect
                    id={id}
                    value={field.value.toUpperCase()}
                    onValueChange={field.onChange}
                    options={currencies.map((code) => ({ value: code, label: code }))}
                    disabled={isSubmitting}
                    aria-describedby={describedBy}
                  />
                )}
              />
            )
          }
        </Field>

        <Field label="Billing period" required>
          {({ id }) =>
            isEdit ? (
              lockedInput(id, BILLING_PERIOD_LABEL[billingPeriod])
            ) : (
              <Controller
                control={form.control}
                name="billingPeriod"
                render={({ field }) => (
                  <OptionSelect
                    id={id}
                    value={field.value}
                    onValueChange={field.onChange}
                    options={periodOptions(periods)}
                    disabled={isSubmitting}
                  />
                )}
              />
            )
          }
        </Field>

        {priceUnits.length > 0 || priceUnit ? (
          <Field
            label="Price unit"
            hint={
              isEdit
                ? 'Fixed once created.'
                : 'Optional. Price in credits, tokens or another custom unit instead of a currency.'
            }
          >
            {({ id }) =>
              isEdit ? (
                lockedInput(id, priceUnit || 'None (currency)')
              ) : (
                <OptionSelect
                  id={id}
                  value={priceUnit || FIAT}
                  onValueChange={(code) => {
                    const unit = priceUnits.find((option) => option.code === code)
                    const current = form.getValues()
                    form.reset({
                      ...current,
                      ...(unit
                        ? { priceUnit: unit.code, currency: unit.baseCurrency.toUpperCase() }
                        : { priceUnit: undefined }),
                    } as CreateCharge)
                  }}
                  options={[
                    { value: FIAT, label: 'None (currency)' },
                    ...priceUnits.map((unit) => ({
                      value: unit.code,
                      label: `${unit.name} (${unit.code})`,
                    })),
                  ]}
                  disabled={isSubmitting}
                />
              )
            }
          </Field>
        ) : null}

        {!isUsage ? (
          <Field label="Invoice timing" required>
            {({ id }) =>
              isEdit ? (
                lockedInput(
                  id,
                  INVOICE_CADENCE_LABEL[form.getValues('invoiceCadence') as InvoiceCadence],
                )
              ) : (
                <Controller
                  control={form.control}
                  name="invoiceCadence"
                  render={({ field }) => (
                    <OptionSelect
                      id={id}
                      value={field.value}
                      onValueChange={field.onChange}
                      options={[InvoiceCadence.Advance, InvoiceCadence.Arrear].map((cadence) => ({
                        value: cadence,
                        label: INVOICE_CADENCE_LABEL[cadence],
                      }))}
                      disabled={isSubmitting}
                    />
                  )}
                />
              )
            }
          </Field>
        ) : null}

        {!isUsage && !isEdit && billingPeriod !== BillingPeriod.OneTime ? (
          <Field
            label="Free trial (days)"
            hint="Optional. Subscribers are not billed for this charge during the trial."
            error={messageOf(errors, 'trialPeriodDays')}
          >
            {({ id, ...field }) => (
              <Input
                id={id}
                type="number"
                min={1}
                inputMode="numeric"
                disabled={isSubmitting}
                {...field}
                {...form.register('trialPeriodDays' as never, {
                  setValueAs: (value: unknown) =>
                    value === '' || value == null || Number.isNaN(Number(value))
                      ? undefined
                      : Number(value),
                })}
              />
            )}
          </Field>
        ) : null}
      </div>

      {isUsage ? (
        <p className="text-muted-foreground text-xs">
          Usage charges bill in arrears — once the period’s usage is known.
        </p>
      ) : null}

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Billing model</span>
        <Tabs value={billingModel} onValueChange={(next) => reseed(type, next as BillingModel)}>
          <TabsList aria-label="Billing model">
            {BILLING_MODELS.map((model) => (
              <TabsTrigger key={model} value={model} disabled={isSubmitting}>
                {BILLING_MODEL_LABEL[model]}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value={BillingModel.FlatFee} className="pt-2">
            <div className="max-w-xs">{amountField(`Amount (${unitLabel})`)}</div>
          </TabsContent>

          <TabsContent value={BillingModel.Package} className="pt-2">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {amountField(`Price per package (${unitLabel})`)}
              <Field
                label="Units per package"
                hint="The price buys this many units."
                error={messageOf(errors, 'divideBy')}
              >
                {({ id, ...field }) => (
                  <Input
                    id={id}
                    type="number"
                    min={1}
                    inputMode="numeric"
                    disabled={isSubmitting}
                    {...field}
                    {...form.register('divideBy' as never, { valueAsNumber: true })}
                  />
                )}
              </Field>
            </div>
          </TabsContent>

          <TabsContent value={BillingModel.Tiered} className="flex flex-col gap-3 pt-2">
            <div className="max-w-sm">
              <Field label="Tier mode">
                {({ id }) => (
                  <Controller
                    control={form.control}
                    name={'tierMode' as never}
                    render={({ field }) => (
                      <OptionSelect
                        id={id}
                        value={(field.value as string) || TierMode.Volume}
                        onValueChange={field.onChange}
                        options={TIER_MODES.map((tierMode) => ({
                          value: tierMode,
                          label: TIER_MODE_LABEL[tierMode],
                        }))}
                        disabled={isSubmitting}
                      />
                    )}
                  />
                )}
              </Field>
            </div>
            <TierTable
              tiers={tiers}
              currencySymbol={unitLabel}
              rowErrors={tierRowErrors}
              onChange={(next) =>
                form.setValue('tiers' as never, next as never, {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }
              disabled={isSubmitting}
            />
            {tierMessage ? (
              <p role="alert" className="text-destructive text-xs">
                {tierMessage}
              </p>
            ) : null}
          </TabsContent>
        </Tabs>
      </div>

      {isEdit ? (
        <div className="max-w-xs">
          <Field
            label="Effective from"
            hint="Leave empty to start the new price now. Earlier invoices keep the old price."
          >
            {({ id, 'aria-describedby': describedBy }) => (
              <Controller
                control={form.control}
                name={'effectiveFrom' as never}
                render={({ field }) => (
                  <DateInput
                    id={id}
                    value={(field.value as string | undefined) ?? ''}
                    onValueChange={field.onChange}
                    placeholder="Now"
                    disabled={isSubmitting}
                    aria-describedby={describedBy}
                  />
                )}
              />
            )}
          </Field>
        </div>
      ) : null}

      <FormActions
        mode={mode}
        noun="charge"
        onCancel={onCancel}
        isSubmitting={isSubmitting}
        submitError={submitError}
        {...(submitLabel ? { submitLabel } : isEdit ? { submitLabel: 'Save new version' } : {})}
      />
    </form>
  )
}
