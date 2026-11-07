import { InfoIcon, PlusIcon } from '@ui/icons'
import { useCalmForm } from '@ui/compositions/forms/useCalmForm'
import { type ReactNode } from 'react'
import { Controller, type Resolver } from 'react-hook-form'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import {
  BILLING_MODEL_LABEL,
  BILLING_PERIOD_LABEL,
  BillingModel,
  BillingPeriod,
  type CreateCharge,
  INVOICE_CADENCE_LABEL,
  OPEN_START_DATE,
  InvoiceCadence,
  PERCENTAGE_LABEL,
  PRICE_TYPE_LABEL,
  PRICE_WINDOW_SIZE_LABEL,
  PriceType,
  type PriceWindowSize,
  WINDOWABLE_AGGREGATIONS,
  type Tier,
  TIER_MODE_LABEL,
  TierMode,
  createChargeSchema,
  emptyCharge,
  currencyCodes,
} from '@fp/domain'
import { NOT_A_LOGIN } from '@ui/compositions/forms/notALogin'
import { Input } from '@ui/components/primitives/input'
import { ChoiceCards } from '@ui/compositions/detail/DetailKit'
import { Alert, AlertDescription, AlertTitle } from '@ui/components/reui/alert'
import { DateInput } from '@ui/compositions/forms/DateInput'
import { Field } from '@ui/compositions/forms/Field'
import { FormDisclosure } from '@ui/compositions/forms/FormDisclosure'
import { FormActions } from '@ui/compositions/forms/FormActions'
import { OptionCombobox } from '@ui/compositions/forms/OptionCombobox'
import { OptionSelect } from '@ui/compositions/forms/OptionSelect'
import { provenance } from '@ui/provenance'
import { ContractAmountCalculator } from './ContractAmountCalculator'
import { FeatureTypeGlyph } from '../../shared/cells'
import { TierTable, type TierRowError } from './TierTable'

/**
 * One charge (a price), as a form: create or edit.
 *
 * Fixed and usage are one form: the type choice decides which fields exist: a
 * usage charge names the meter it bills and always bills in arrears; a fixed
 * charge chooses its invoice cadence and may carry a free trial. The billing
 * model (flat fee, package, tiered) shows only its own fields.
 *
 * On an edit the API lets only the price itself change: amount or bands, model,
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
    'compositions/field',
    'compositions/form-actions',
    'compositions/option-select',
    'compositions/option-combobox',
    'compositions/date-input',
    '@reui/alert',
    'ui/input',
  ],
  note: 'RHF + the domain charge schema; charge type and billing model as choice cards, tier table for banded pricing. Lineage: compositions/choice-cards.',
})

/** A metered feature the usage variant can charge against. */
export interface MeterOption {
  id: string
  name: string
  /** Singular unit of the meter's feature ("call"), for "per call" wording. */
  unit?: string
  /**
   * The meter's aggregation, which decides whether a usage window is offered.
   *
   * Windowing re-aggregates inside each window, so it changes the answer only
   * for MAX and SUM: the API rejects it on anything else. Absent means the
   * caller did not supply it, and the field is then left out rather than
   * guessed at.
   */
  aggregationType?: string | null
  /**
   * The meter's own window, when it is bucketed at the meter level.
   *
   * A price may not set a second one: the API refuses it rather than deciding
   * which wins. Present means the field is shown disabled, saying why.
   */
  bucketSize?: string | null
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
  /**
   * Not drawn: these forms have no Cancel. The container's own close (the
   * dialog's X, or the staged step's close) is the way out. Kept so callers
   * can still pass it.
   */
  onCancel?: (() => void) | undefined
  isSubmitting?: boolean
  submitError?: string | null
  /** Overrides the submit label, e.g. "Add charge" when the charge is staged, not saved. */
  submitLabel?: string
  /** Hides the Fixed/Usage tabs when the type was already chosen (e.g. by a dialog's first step). */
  lockType?: boolean
  /** Fields that belong to the container, not the price: drawn after the price fields. */
  extras?: ReactNode
  /** Replaces the edit-mode notice, for a container whose edits are not new price versions. */
  notice?: ReactNode
  /** Shows the currency locked: a contract bills in one currency. */
  lockCurrency?: boolean
  /** Shows the display name locked, for a container that cannot rename a charge. */
  lockDisplayName?: boolean
  /**
   * Shows the catalogue's price options on create: price group, start date and,
   * for a fixed charge, minimum quantity. Left out where the container decides
   * these itself, as a contract does.
   */
  priceOptions?: { groups: readonly { value: string; label: string }[] }
  /**
   * Draws the usage window on a metered charge. Default on.
   *
   * Off where the container owns the window itself: a contract collects it in
   * `UsageTermsFields` beside the commitment it interacts with, and two
   * controls for one field in one dialog is worse than either.
   */
  showUsageWindow?: boolean
  /**
   * The billing models on offer. Default: all three. A path that cannot bill in
   * bands (a charge added alongside an entitlement) leaves Tiered out. The
   * model a charge already has is always kept, so an edit never loses it.
   */
  billingModels?: readonly BillingModel[]
  /**
   * Adds "Create feature" to the metered-feature picker. The container decides
   * where it goes (the feature create form); the form only offers it.
   */
  onCreateFeature?: (() => void) | undefined
}

const ALL_BILLING_MODELS = [
  BillingModel.FlatFee,
  BillingModel.Package,
  BillingModel.Tiered,
] as const

const BILLING_MODEL_DESCRIPTION: Record<BillingModel, string> = {
  [BillingModel.FlatFee]: 'One amount for the charge.',
  [BillingModel.Package]: 'A price for each pack of units.',
  [BillingModel.Tiered]: 'A different rate in each band.',
}

/**
 * The form-only "Percentage" model: V1's percentage fee, saved as a flat fee
 * with the decimal rate and the percentage marker. Offered on usage charges,
 * as in V1.
 */
const PERCENTAGE_CHOICE = 'PERCENTAGE' as const
type ModelChoice = BillingModel | typeof PERCENTAGE_CHOICE

const TIER_MODES = [TierMode.Volume, TierMode.Slab] as const
const DEFAULT_CURRENCIES = currencyCodes()
const FIAT = 'FIAT'

/** Fixed charges can be one-time; usage cannot: you cannot meter a one-off. */
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

/**
 * A catalogue price with no start date starts on {@link OPEN_START_DATE}, not
 * "now": set as the default and again on submit if the field was cleared.
 */
function withOpenStart(charge: CreateCharge, applies: boolean): CreateCharge {
  return applies && !charge.startDate ? { ...charge, startDate: OPEN_START_DATE } : charge
}

const messageOf = (errors: unknown, key: string): string | undefined =>
  (errors as Record<string, { message?: string } | undefined>)[key]?.message

export function ChargeForm({
  mode,
  defaultValue,
  meters = [],
  priceUnits = [],
  currencies = DEFAULT_CURRENCIES,
  onSubmit,
  isSubmitting = false,
  submitError = null,
  submitLabel,
  lockType = false,
  extras,
  notice,
  lockCurrency = false,
  lockDisplayName = false,
  priceOptions,
  showUsageWindow = true,
  billingModels = ALL_BILLING_MODELS,
  onCreateFeature,
}: ChargeFormProps) {
  const isEdit = mode === 'edit'
  const form = useCalmForm<CreateCharge>({
    resolver: standardSchemaResolver(createChargeSchema) as Resolver<CreateCharge>,
    defaultValues: withOpenStart(
      defaultValue ?? emptyCharge(PriceType.Fixed, BillingModel.FlatFee),
      !isEdit && Boolean(priceOptions),
    ),
  })

  const type = form.watch('type')
  const billingModel = form.watch('billingModel')
  const percentage =
    billingModel === BillingModel.FlatFee && Boolean(form.watch('percentage' as never))
  const currency = form.watch('currency')
  const billingPeriod = form.watch('billingPeriod')
  const priceUnit = form.watch('priceUnit')
  const errors = form.formState.errors
  const isUsage = type === PriceType.Usage
  /*
   * Whether this charge may carry a usage window, and why not when it may not.
   *
   * The three rules are the API's, checked here so the field is never offered
   * where saving would fail: windows are for usage charges, only MAX and SUM
   * change their answer when re-aggregated, and a meter that already buckets
   * refuses a second source rather than letting the price shadow it.
   *
   * A meter whose aggregation the caller did not supply is treated as not
   * offerable. Showing the field on a guess and failing on save is worse than
   * leaving a rarely-used option out.
   */
  const selectedMeterId = (form.watch('meterId' as never) as unknown as string | undefined) ?? ''
  const selectedMeter = meters.find((meter) => meter.id === selectedMeterId)
  const meterBuckets = Boolean(selectedMeter?.bucketSize)
  const windowable =
    selectedMeter?.aggregationType != null &&
    (WINDOWABLE_AGGREGATIONS as readonly string[]).includes(selectedMeter.aggregationType)
  const showWindow =
    showUsageWindow && isUsage && Boolean(selectedMeter) && (windowable || meterBuckets)
  // Only name fields this form will actually draw. A contract charge collects
  // its start, window and commitment beside the price, so those must not be
  // promised here and the section must not open onto an empty panel.
  const advancedParts = [
    (priceUnits.length > 0 || priceUnit) && 'price unit',
    showWindow && 'usage window',
    !isUsage && !isEdit && billingPeriod !== BillingPeriod.OneTime && 'free trial',
    priceOptions && !isEdit && !isUsage && 'minimum quantity',
    priceOptions && !isEdit && priceOptions.groups.length > 0 && 'tag',
    !isEdit && priceOptions && 'start date',
  ].filter((part): part is string => Boolean(part))
  const advancedSummary =
    advancedParts.length === 0
      ? ''
      : advancedParts.join(', ').replace(/^./, (letter) => letter.toUpperCase())
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
      ...(current.groupId ? { groupId: current.groupId } : {}),
      ...(current.startDate ? { startDate: current.startDate } : {}),
      ...(current.metadata ? { metadata: current.metadata } : {}),
      ...(nextType === PriceType.Fixed && current.minQuantity !== undefined
        ? { minQuantity: current.minQuantity }
        : {}),
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
      const row = rowError as {
        upTo?: { message?: string }
        unitAmount?: { message?: string }
        transformQuantity?: { divideBy?: { message?: string } }
      }
      const packageSize = row?.transformQuantity?.divideBy?.message
      if (row?.upTo?.message || row?.unitAmount?.message || packageSize) {
        tierRowErrors[index] = {
          ...(row.upTo?.message ? { upTo: row.upTo.message } : {}),
          ...(row.unitAmount?.message ? { unitAmount: row.unitAmount.message } : {}),
          ...(packageSize ? { packageSize } : {}),
        }
      }
    })
  }
  const tierMessage = (rawTierErrors as { message?: string } | undefined)?.message

  // Percentage is a flat fee underneath: picking it re-seeds a flat fee and marks it.
  const chooseModel = (next: ModelChoice) => {
    if (next === PERCENTAGE_CHOICE) {
      reseed(type, BillingModel.FlatFee)
      form.setValue('percentage' as never, true as never, { shouldDirty: true })
      return
    }
    reseed(type, next)
  }
  const modelChoice: ModelChoice = percentage ? PERCENTAGE_CHOICE : billingModel
  const modelChoices: ModelChoice[] = [
    ...ALL_BILLING_MODELS.filter(
      (model) => (model === billingModel && !percentage) || billingModels.includes(model),
    ),
    ...((isUsage && billingModels.includes(BillingModel.FlatFee)) || percentage
      ? [PERCENTAGE_CHOICE as ModelChoice]
      : []),
  ]

  const amountField = (label: string, hint?: string) => (
    <Field label={label} required error={messageOf(errors, 'amount')} {...(hint ? { hint } : {})}>
      {({ id, ...field }) => (
        <Input
          {...NOT_A_LOGIN}
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
      onSubmit={form.handleSubmit((values) =>
        onSubmit(withOpenStart(values, !isEdit && Boolean(priceOptions))),
      )}
      noValidate
      className="flex flex-col gap-5"
    >
      {isEdit && notice ? (
        notice
      ) : isEdit ? (
        <Alert variant="info">
          <InfoIcon aria-hidden="true" />
          <AlertTitle>Changing the price creates a new version</AlertTitle>
          <AlertDescription>
            The current price keeps billing until the effective date, so past invoices are
            unaffected. Currency, period, meter and invoice timing are fixed once a charge exists.
          </AlertDescription>
        </Alert>
      ) : lockType ? null : (
        <ChoiceCards
          label="Charge type"
          value={type}
          onChange={(next) => reseed(next, billingModel)}
          choices={[
            {
              value: PriceType.Fixed,
              title: PRICE_TYPE_LABEL[PriceType.Fixed],
              description: 'A flat fee, billed at the start of each period.',
            },
            {
              value: PriceType.Usage,
              title: PRICE_TYPE_LABEL[PriceType.Usage],
              description: 'Billed at the end of the period for what was used.',
            },
          ]}
        />
      )}

      {/*
       * The few fields every charge needs, in the order they are decided: what
       * it bills and is called, how often and in what, then the model and the
       * amount. Everything optional waits under Advanced.
       */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {isUsage ? (
          <>
            <Field
              label="Metered feature"
              required
              error={messageOf(errors, 'meterId')}
              hint={isEdit ? 'Fixed once created.' : 'The feature whose usage this charge bills.'}
            >
              {({ id, 'aria-describedby': describedBy, 'aria-invalid': invalid }) =>
                isEdit ? (
                  lockedInput(
                    id,
                    meters.find(
                      (meter) => meter.id === (form.getValues() as { meterId?: string }).meterId,
                    )?.name ?? '',
                  )
                ) : (
                  <Controller
                    control={form.control}
                    name={'meterId' as never}
                    render={({ field }) => (
                      <OptionCombobox
                        id={id}
                        value={(field.value as string) || ''}
                        onValueChange={(next) => {
                          // The feature names the charge, unless the name is one of its own:
                          // empty, or still the previous feature's name, it follows the pick.
                          const previous = meters.find((option) => option.id === field.value)
                          const meter = meters.find((option) => option.id === next)
                          const name = (form.getValues('displayName') ?? '').trim()
                          field.onChange(next)
                          if (meter && (!name || name === previous?.name)) {
                            form.setValue('displayName', meter.name, { shouldDirty: true })
                          }
                        }}
                        options={meters.map((meter) => ({
                          value: meter.id,
                          label: meter.name,
                          trailing: <FeatureTypeGlyph type="metered" />,
                        }))}
                        searchable
                        {...(onCreateFeature
                          ? {
                              createAction: {
                                label: 'Create feature',
                                icon: <PlusIcon aria-hidden />,
                                onSelect: onCreateFeature,
                              },
                            }
                          : {})}
                        placeholder="Search metered features…"
                        emptyText="No metered features match."
                        disabled={isSubmitting || isEdit}
                        aria-describedby={describedBy}
                        aria-invalid={invalid}
                      />
                    )}
                  />
                )
              }
            </Field>
            <Field label="Display name" hint="Optional. What this charge is called on an invoice.">
              {({ id, ...field }) =>
                lockDisplayName ? (
                  lockedInput(id, form.getValues('displayName') ?? '')
                ) : (
                  <Input
                    {...NOT_A_LOGIN}
                    id={id}
                    disabled={isSubmitting}
                    placeholder={isUsage ? 'e.g. API calls' : 'e.g. Platform base'}
                    {...field}
                    {...form.register('displayName' as never)}
                  />
                )
              }
            </Field>

            <Field label="Billing period" hint="How often the charge is billed." required>
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

            <Field
              label="Currency"
              hint={
                priceUnit
                  ? 'Follows the price unit.'
                  : lockCurrency
                    ? 'Set by the contract.'
                    : 'The currency the charge is billed in.'
              }
              required
            >
              {({ id, 'aria-describedby': describedBy }) =>
                isEdit || priceUnit || lockCurrency ? (
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
          </>
        ) : (
          <>
            <Field label="Display name" hint="Optional. What this charge is called on an invoice.">
              {({ id, ...field }) =>
                lockDisplayName ? (
                  lockedInput(id, form.getValues('displayName') ?? '')
                ) : (
                  <Input
                    {...NOT_A_LOGIN}
                    id={id}
                    disabled={isSubmitting}
                    placeholder={isUsage ? 'e.g. API calls' : 'e.g. Platform base'}
                    {...field}
                    {...form.register('displayName' as never)}
                  />
                )
              }
            </Field>

            <Field
              label="Currency"
              hint={
                priceUnit
                  ? 'Follows the price unit.'
                  : lockCurrency
                    ? 'Set by the contract.'
                    : 'The currency the charge is billed in.'
              }
              required
            >
              {({ id, 'aria-describedby': describedBy }) =>
                isEdit || priceUnit || lockCurrency ? (
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

            <Field label="Billing period" hint="How often the charge is billed." required>
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

            <Field
              label="Invoice timing"
              hint="Whether the charge is invoiced at the start or the end of each period."
              required
            >
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
          </>
        )}
      </div>

      <fieldset disabled={isSubmitting} className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Billing model</legend>
        <ChoiceCards<ModelChoice>
          label="Billing model"
          value={modelChoice}
          onChange={chooseModel}
          choices={modelChoices.map((model) =>
            model === PERCENTAGE_CHOICE
              ? {
                  value: model,
                  title: PERCENTAGE_LABEL,
                  description: 'A percentage of the billable value.',
                }
              : {
                  value: model,
                  title: BILLING_MODEL_LABEL[model],
                  description: BILLING_MODEL_DESCRIPTION[model],
                },
          )}
        />
      </fieldset>

      {percentage
        ? amountField('Percentage (%)', 'Entered as a percent: 7.125 bills 7.125%.')
        : null}

      {billingModel === BillingModel.FlatFee && isUsage && !percentage
        ? // A usage flat fee is a rate per unit: a contract value per period does not apply.
          amountField(`Amount (${unitLabel})`)
        : null}

      {billingModel === BillingModel.FlatFee && !isUsage && !percentage ? (
        // The calculator sits at the field's bottom edge, beside its input.
        <div className="flex items-end gap-2">
          <div className="min-w-0 flex-1">{amountField(`Amount (${unitLabel})`)}</div>
          <ContractAmountCalculator
            billingPeriod={billingPeriod}
            amount={String(form.watch('amount' as never) ?? '')}
            unitLabel={unitLabel}
            disabled={isSubmitting}
            onApply={(amount) =>
              form.setValue('amount' as never, amount as never, {
                shouldDirty: true,
                shouldValidate: true,
              })
            }
          />
        </div>
      ) : null}

      {billingModel === BillingModel.Package ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {amountField(`Price per package (${unitLabel})`)}
          <Field
            label="Units per package"
            hint="The price buys this many units."
            error={messageOf(errors, 'divideBy')}
          >
            {({ id, ...field }) => (
              <Input
                {...NOT_A_LOGIN}
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
      ) : null}

      {billingModel === BillingModel.Tiered ? (
        <div className="flex flex-col gap-3">
          <div className="max-w-sm">
            <Field
              label="Tier mode"
              hint="Whether the whole quantity is priced at its tier rate (volume) or tier by tier (slab)."
            >
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
        </div>
      ) : null}

      {/* Editing a price is a new version from a date, so that date stays in sight. */}
      {isEdit ? (
        <div>
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

      {advancedSummary ? (
      <FormDisclosure
        title="Advanced"
        summary={advancedSummary}
        forceOpen={Boolean(
          messageOf(errors, 'trialPeriodDays') ||
          messageOf(errors, 'minQuantity') ||
          messageOf(errors, 'bucketSize') ||
          messageOf(errors, 'startDate'),
        )}
      >
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                          // The unit's base currency exactly as stored ("usd"): the API
                          // compares the two case-sensitively and refuses "USD" with a
                          // 400. The locked Currency field upper-cases it for display.
                          ...(unit
                            ? { priceUnit: unit.code, currency: unit.baseCurrency }
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
            {!isUsage && !isEdit && billingPeriod !== BillingPeriod.OneTime ? (
              <Field
                label="Free trial (days)"
                hint="Optional. Subscribers are not billed for this charge during the trial."
                error={messageOf(errors, 'trialPeriodDays')}
              >
                {({ id, ...field }) => (
                  <Input
                    {...NOT_A_LOGIN}
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
          {showWindow ? (
            <div className="max-w-xs">
              <Field
                label="Usage window"
                hint={
                  meterBuckets
                    ? `Set on the ${selectedMeter?.name ?? 'meter'} feature itself, so it cannot be changed here.`
                    : 'Optional. Aggregate the meter inside each window and price the windows, instead of once across the period.'
                }
                error={messageOf(errors, 'bucketSize')}
              >
                {({ id }) =>
                  meterBuckets ? (
                    lockedInput(
                      id,
                      PRICE_WINDOW_SIZE_LABEL[selectedMeter?.bucketSize as PriceWindowSize] ??
                        String(selectedMeter?.bucketSize ?? ''),
                    )
                  ) : (
                    <Controller
                      control={form.control}
                      name={'bucketSize' as never}
                      render={({ field }) => (
                        <OptionCombobox
                          id={id}
                          value={(field.value as string) || ''}
                          onValueChange={(next) => field.onChange(next === '' ? undefined : next)}
                          options={[
                            { value: '', label: 'No window: the whole period' },
                            ...Object.entries(PRICE_WINDOW_SIZE_LABEL).map(([value, label]) => ({
                              value,
                              label,
                            })),
                          ]}
                          placeholder="No window: the whole period"
                          disabled={isSubmitting}
                        />
                      )}
                    />
                  )
                }
              </Field>
            </div>
          ) : null}
          {priceOptions && !isEdit && (priceOptions.groups.length > 0 || !isUsage) ? (
            <div className="grid gap-5 sm:grid-cols-2">
              {priceOptions.groups.length > 0 ? (
                <Field
                  label="Tag"
                  hint="Optional. Tags related prices for reporting and bulk changes."
                >
                  {({ id }) => (
                    <Controller
                      control={form.control}
                      name={'groupId' as never}
                      render={({ field }) => (
                        <OptionCombobox
                          id={id}
                          value={(field.value as string | undefined) ?? ''}
                          onValueChange={(value) => field.onChange(value || undefined)}
                          options={[...priceOptions.groups]}
                          placeholder="No tag"
                          disabled={isSubmitting}
                        />
                      )}
                    />
                  )}
                </Field>
              ) : null}
              {!isUsage ? (
                <Field
                  label="Minimum quantity"
                  hint="Optional. The fewest units a subscriber can hold of this charge."
                  error={messageOf(errors, 'minQuantity')}
                >
                  {({ id, ...field }) => (
                    <Input
                      {...NOT_A_LOGIN}
                      id={id}
                      type="number"
                      min={0}
                      inputMode="numeric"
                      disabled={isSubmitting}
                      {...field}
                      {...form.register('minQuantity' as never, {
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
          ) : null}
          {!isEdit && priceOptions ? (
            // A new price's start date: it belongs to the price, not to its model.
            <div>
              <Field
                label="Start date"
                hint="Optional. The price applies from this day; empty means now."
              >
                {({ id, 'aria-describedby': describedBy }) => (
                  <Controller
                    control={form.control}
                    name={'startDate' as never}
                    render={({ field }) => (
                      <DateInput
                        id={id}
                        value={(field.value as string | undefined) ?? ''}
                        onValueChange={(value) => field.onChange(value || undefined)}
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
        </div>
      </FormDisclosure>
      ) : null}

      {extras}

      <FormActions
        mode={mode}
        noun="charge"
        isSubmitting={isSubmitting}
        submitError={submitError}
        {...(submitLabel ? { submitLabel } : isEdit ? { submitLabel: 'Save new version' } : {})}
      />
    </form>
  )
}
