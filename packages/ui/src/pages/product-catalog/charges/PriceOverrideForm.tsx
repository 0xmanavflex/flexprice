import { useCalmForm } from '@ui/compositions/forms/useCalmForm'
import { useEffect, useRef } from 'react'
import { Controller, type Resolver } from 'react-hook-form'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import {
  BILLING_MODEL_LABEL,
  BUCKET_SIZE_LABEL,
  BillingModel,
  BucketSize,
  TIER_MODE_LABEL,
  TierMode,
  WINDOWABLE_AGGREGATIONS,
  emptyOverride,
  type PriceOverride,
  priceOverrideSchema,
  type Tier,
} from '@fp/domain'
import { Button } from '@ui/components/primitives/button'
import { Input } from '@ui/components/primitives/input'
import { ChoiceCards } from '@ui/compositions/detail/DetailKit'
import { Field } from '@ui/compositions/forms/Field'
import { OptionSelect } from '@ui/compositions/forms/OptionSelect'
import { provenance } from '@ui/provenance'
import type { MeterOption } from './ChargeForm'
import { TierTable, type TierRowError } from './TierTable'

/**
 * A price override, as one form rather than twelve pieces of state.
 *
 * V1's `PriceOverrideDialog.tsx` is 807 lines and holds twelve `useState`
 * hooks, with the relationships between them spread across render branches and
 * effects. This holds **none**: `react-hook-form` owns the values,
 * `priceOverrideSchema` owns the rules, and switching billing model resets to a
 * structurally valid shape rather than leaving the previous model's fields
 * lying around.
 *
 * It is presentational in the same sense `InvoiceGrid` is: it takes a default
 * value and emits a validated `PriceOverride` on submit. It does not fetch, it
 * does not know what a subscription is, and it cannot import `@fp/query`.
 *
 * Errors come from the domain schema, so the message a user reads about
 * overlapping tiers is the same rule an agent-driven action is held to.
 */
export const PriceOverrideFormProvenance = provenance({
  source: 'composition',
  composes: ['ui/button', 'ui/input', 'composition/DetailKit', 'pages/TierTable'],
  note: 'RHF + the domain Zod schema; tiered prices use the same TierTable as a charge.',
})

export interface PriceOverrideFormProps {
  priceId: string
  /** Existing override when editing; omit to start from the model's empty shape. */
  defaultValue?: PriceOverride
  onSubmit: (override: PriceOverride) => void
  /**
   * Not drawn: these forms have no Cancel. The container's own close (the
   * dialog's X, or the staged step's close) is the way out. Kept so callers
   * can still pass it.
   */
  onCancel?: (() => void) | undefined
  /** Disables the form while a save is in flight. The page owns that flag. */
  isSubmitting?: boolean
  /** Server-side failure, already turned into a sentence by the page. */
  submitError?: string | null
  /** Lets a wizard footer submit this form from outside the element. */
  formId?: string
  /** Hides Save override when the surrounding wizard owns Cancel and Next. */
  hideActions?: boolean
  /**
   * True once an amount or a tier has been entered. A wizard uses this so Next
   * saves a started override and still skips the step when it was left blank.
   */
  onStartedChange?: (started: boolean) => void
  /**
   * A usage charge's meter: offers an optional bucket size, the window usage is
   * summed in. By the API's rules, as `ChargeForm` applies them, it is offered
   * only on a MAX or SUM meter and shown locked when the meter has its own
   * bucket. Absent on a fixed charge.
   */
  meter?: Pick<MeterOption, 'name' | 'aggregationType' | 'bucketSize'> | undefined
}

/** The bucket picker's "keep the charge's own" choice: `OptionSelect` reads `''` as no value. */
const CHARGES_OWN = 'CHARGES_OWN'

const TIER_MODES = [TierMode.Volume, TierMode.Slab] as const

function overrideStarted(value: PriceOverride): boolean {
  if (value.billingModel === BillingModel.Tiered) {
    return value.tiers.some(
      (tier) =>
        (tier.unitAmount ?? '').trim() !== '' ||
        ((tier.flatAmount ?? '').trim() !== '' && tier.flatAmount !== '0') ||
        tier.upTo != null ||
        !!tier.transformQuantity?.divideBy,
    )
  }
  if (value.billingModel === BillingModel.Package) {
    return (value.amount ?? '').trim() !== '' || value.divideBy !== 1
  }
  return (value.amount ?? '').trim() !== ''
}

export function PriceOverrideForm({
  priceId,
  defaultValue,
  onSubmit,
  isSubmitting = false,
  submitError = null,
  formId,
  hideActions = false,
  onStartedChange,
  meter,
}: PriceOverrideFormProps) {
  // The bucket is offered where the API takes one: a MAX or SUM meter without its own.
  const meterBuckets = Boolean(meter?.bucketSize)
  const windowable =
    meter?.aggregationType != null &&
    (WINDOWABLE_AGGREGATIONS as readonly string[]).includes(meter.aggregationType)
  const form = useCalmForm<PriceOverride>({
    resolver: standardSchemaResolver(priceOverrideSchema) as Resolver<PriceOverride>,
    defaultValues: defaultValue ?? emptyOverride(priceId, BillingModel.FlatFee),
    // Validate once a field has been touched, not on every keystroke from the
    // start: telling someone their empty field is invalid before they have
    // typed in it is noise, and noise is what gets ignored.
  })

  const billingModel = form.watch('billingModel')

  // Switching model replaces the whole value rather than merging, so a tier
  // array cannot survive into a flat fee and be submitted invisibly.
  const changeModel = (next: BillingModel) => {
    if (next === billingModel) return
    // The bucket size is not part of the price: it survives a change of model.
    const bucketSize = form.getValues('bucketSize')
    form.reset({ ...emptyOverride(priceId, next), ...(bucketSize ? { bucketSize } : {}) })
  }

  // The dialog remounts per charge. Reset once from the seed so a new object
  // for the same charge (the plan price, rebuilt on a parent render) does not
  // wipe what the person has typed.
  const seed = useRef(defaultValue)
  useEffect(() => {
    if (seed.current) form.reset(seed.current)
  }, [form])

  const started = overrideStarted(form.watch())
  const onStartedChangeRef = useRef(onStartedChange)
  onStartedChangeRef.current = onStartedChange
  useEffect(() => {
    onStartedChangeRef.current?.(started)
  }, [started])

  const errors = form.formState.errors
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

  return (
    <form
      // Wrapped rather than passed straight through: RHF hands its callback a
      // second argument, the React submit event. Forwarding it would leak a
      // form-library detail through a prop that declares one parameter, and a
      // caller could start depending on it.
      {...(formId ? { id: formId } : {})}
      onSubmit={form.handleSubmit((values) => onSubmit(values))}
      noValidate
      aria-labelledby="price-override-heading"
      className="flex flex-col gap-6"
    >
      <h2 id="price-override-heading" className="sr-only">
        Override price
      </h2>

      <fieldset disabled={isSubmitting}>
        <legend className="sr-only">Billing model</legend>
        <ChoiceCards
          label="Billing model"
          value={billingModel}
          onChange={changeModel}
          choices={[
            {
              value: BillingModel.FlatFee,
              title: BILLING_MODEL_LABEL[BillingModel.FlatFee],
              description: 'One amount for the charge.',
            },
            {
              value: BillingModel.Package,
              title: BILLING_MODEL_LABEL[BillingModel.Package],
              description: 'A price for each pack of units.',
            },
            {
              value: BillingModel.Tiered,
              title: BILLING_MODEL_LABEL[BillingModel.Tiered],
              description: 'A different rate in each band.',
            },
          ]}
        />
      </fieldset>

      {billingModel !== BillingModel.Tiered ? (
        <Field
          label={billingModel === BillingModel.Package ? 'Price per package' : 'Amount'}
          error={(errors as { amount?: { message?: string } }).amount?.message}
        >
          {({ id, ...field }) => (
            <Input
              id={id}
              inputMode="decimal"
              disabled={isSubmitting}
              {...field}
              {...form.register('amount' as never)}
            />
          )}
        </Field>
      ) : null}

      {billingModel === BillingModel.Package ? (
        <Field
          label="Units per package"
          hint="The price above buys this many units."
          error={(errors as { divideBy?: { message?: string } }).divideBy?.message}
        >
          {({ id, ...field }) => (
            <Input
              id={id}
              type="number"
              min={1}
              step={1}
              disabled={isSubmitting}
              {...field}
              {...form.register('divideBy' as never, { valueAsNumber: true })}
            />
          )}
        </Field>
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
                      options={TIER_MODES.map((mode) => ({
                        value: mode,
                        label: TIER_MODE_LABEL[mode],
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
            rowErrors={tierRowErrors}
            disabled={isSubmitting}
            onChange={(next) =>
              form.setValue('tiers' as never, next as never, {
                shouldDirty: true,
                shouldValidate: true,
              })
            }
          />
          {tierMessage ? (
            <p role="alert" className="text-destructive text-xs">
              {tierMessage}
            </p>
          ) : null}
        </div>
      ) : null}

      {meter && (meterBuckets || windowable) ? (
        <Field
          label="Bucket size"
          hint={
            meterBuckets
              ? `Set on the ${meter.name} feature itself, so it cannot be changed here.`
              : "Optional. The window usage is summed in before it is priced; leave as the charge's own to keep it."
          }
        >
          {({ id, ...field }) =>
            meterBuckets ? (
              <Input
                id={id}
                value={
                  BUCKET_SIZE_LABEL[meter.bucketSize as BucketSize] ?? String(meter.bucketSize)
                }
                readOnly
                disabled
              />
            ) : (
              <OptionSelect
                id={id}
                {...field}
                value={form.watch('bucketSize') || CHARGES_OWN}
                onValueChange={(next) =>
                  form.setValue(
                    'bucketSize',
                    next === CHARGES_OWN ? '' : (next as PriceOverride['bucketSize']),
                    { shouldDirty: true },
                  )
                }
                options={[
                  { value: CHARGES_OWN, label: "The charge's own" },
                  ...Object.values(BucketSize).map((value) => ({
                    value,
                    label: BUCKET_SIZE_LABEL[value],
                  })),
                ]}
                disabled={isSubmitting}
              />
            )
          }
        </Field>
      ) : null}

      {submitError ? (
        <p role="alert" className="text-destructive text-sm">
          {submitError}
        </p>
      ) : null}

      {hideActions ? null : (
        <div className="flex justify-end gap-2 border-t pt-4">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : 'Save override'}
          </Button>
        </div>
      )}
    </form>
  )
}
