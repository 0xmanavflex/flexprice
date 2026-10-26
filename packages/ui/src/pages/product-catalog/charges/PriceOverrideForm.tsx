import { useCalmForm } from '@ui/compositions/forms/useCalmForm'
import { useEffect, useRef } from 'react'
import { useFieldArray, type Resolver } from 'react-hook-form'
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
} from '@fp/domain'
import { Button } from '@ui/components/primitives/button'
import { RadioGroup, RadioGroupItem } from '@ui/components/primitives/radio-group'
import { Label } from '@ui/components/primitives/label'
import { Input } from '@ui/components/primitives/input'
import { ChoiceCards, SimpleTable } from '@ui/compositions/detail/DetailKit'
import { Field } from '@ui/compositions/forms/Field'
import { OptionSelect } from '@ui/compositions/forms/OptionSelect'
import { provenance } from '@ui/provenance'
import type { MeterOption } from './ChargeForm'

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
  composes: ['ui/button', 'ui/input', 'ui/label', 'composition/DetailKit'],
  note: 'RHF + the domain Zod schema; holds no state of its own.',
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
        (tier.flatAmount ?? '').trim() !== '' ||
        tier.upTo != null,
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
  const watchedTierMode: unknown = form.watch('tierMode' as never)
  const tierMode = typeof watchedTierMode === 'string' ? watchedTierMode : TierMode.Volume

  const { fields, insert, remove } = useFieldArray({
    control: form.control,
    // Only present on the tiered branch; RHF tolerates the absent path.
    name: 'tiers' as never,
  })

  // Switching model replaces the whole value rather than merging, so a tier
  // array cannot survive into a flat fee and be submitted invisibly.
  const changeModel = (next: BillingModel) => {
    if (next === billingModel) return
    // The bucket size is not part of the price: it survives a change of model.
    const bucketSize = form.getValues('bucketSize')
    form.reset({ ...emptyOverride(priceId, next), ...(bucketSize ? { bucketSize } : {}) })
  }

  useEffect(() => {
    if (defaultValue) form.reset(defaultValue)
  }, [defaultValue, form])

  const started = overrideStarted(form.watch())
  const onStartedChangeRef = useRef(onStartedChange)
  onStartedChangeRef.current = onStartedChange
  useEffect(() => {
    onStartedChangeRef.current?.(started)
  }, [started])

  const errors = form.formState.errors
  const tierErrors = (errors as { tiers?: { message?: string } }).tiers
  const tierRowErrors = (index: number) =>
    (errors as { tiers?: { message?: string }[] }).tiers?.[index] as
      { upTo?: { message?: string }; unitAmount?: { message?: string } } | undefined

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
        <>
          <fieldset className="flex flex-col gap-2" disabled={isSubmitting}>
            <legend className="mb-2 text-sm font-medium">Tier mode</legend>
            <RadioGroup
              value={tierMode}
              onValueChange={(value) =>
                form.setValue('tierMode' as never, value as never, { shouldDirty: true })
              }
              className="flex flex-col gap-2"
            >
              {TIER_MODES.map((mode) => (
                <div key={mode} className="flex items-center gap-2">
                  <RadioGroupItem value={mode} id={`tier-mode-${mode}`} />
                  <Label htmlFor={`tier-mode-${mode}`} className="text-sm font-normal">
                    {TIER_MODE_LABEL[mode]}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </fieldset>

          <div className="flex flex-col gap-3">
            <span className="text-sm font-medium">Tiers</span>

            <div className="overflow-hidden rounded-lg border">
              <SimpleTable
                rows={fields.map((field, index) => ({ field, index }))}
                getRowId={(row) => row.field.id}
                columns={[
                  {
                    key: 'upTo',
                    header: 'Up to',
                    className: 'whitespace-normal py-2 align-top',
                    cell: ({ index }) => {
                      const rowErrors = tierRowErrors(index)
                      return (
                        <>
                          <Input
                            type="number"
                            disabled={isSubmitting || index === fields.length - 1}
                            placeholder={index === fields.length - 1 ? '∞' : ''}
                            aria-label={`Tier ${index + 1} upper limit`}
                            aria-invalid={rowErrors?.upTo ? true : undefined}
                            {...form.register(`tiers.${index}.upTo` as never, {
                              setValueAs: (v) => (v === '' || v == null ? null : Number(v)),
                            })}
                          />
                          {rowErrors?.upTo ? (
                            <p role="alert" className="text-destructive mt-1 text-xs">
                              {rowErrors.upTo.message}
                            </p>
                          ) : null}
                        </>
                      )
                    },
                  },
                  {
                    key: 'unit',
                    header: 'Per unit',
                    className: 'whitespace-normal py-2 align-top',
                    cell: ({ index }) => {
                      const rowErrors = tierRowErrors(index)
                      return (
                        <>
                          <Input
                            inputMode="decimal"
                            disabled={isSubmitting}
                            aria-label={`Tier ${index + 1} unit price`}
                            aria-invalid={rowErrors?.unitAmount ? true : undefined}
                            {...form.register(`tiers.${index}.unitAmount` as never)}
                          />
                          {rowErrors?.unitAmount ? (
                            <p role="alert" className="text-destructive mt-1 text-xs">
                              {rowErrors.unitAmount.message}
                            </p>
                          ) : null}
                        </>
                      )
                    },
                  },
                  {
                    key: 'flat',
                    header: 'Flat fee',
                    className: 'whitespace-normal py-2 align-top',
                    cell: ({ index }) => (
                      <Input
                        inputMode="decimal"
                        disabled={isSubmitting}
                        aria-label={`Tier ${index + 1} flat fee`}
                        {...form.register(`tiers.${index}.flatAmount` as never)}
                      />
                    ),
                  },
                  {
                    key: 'actions',
                    header: '',
                    className: 'py-2 align-top',
                    cell: ({ index }) => (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        // The unbounded band cannot be removed: without it,
                        // usage above the last ceiling is not billed at all.
                        disabled={
                          isSubmitting || index === fields.length - 1 || fields.length === 1
                        }
                        aria-label={`Remove tier ${index + 1}`}
                        onClick={() => remove(index)}
                      >
                        Remove
                      </Button>
                    ),
                  },
                ]}
              />
            </div>

            {/* Below the table, where the next band goes. */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-fit"
              disabled={isSubmitting}
              // The unbounded band must stay last, so a new one is inserted
              // before it rather than appended after it.
              onClick={() => insert(fields.length - 1, { upTo: null, unitAmount: '' } as never)}
            >
              Add tier
            </Button>

            {tierErrors?.message ? (
              <p role="alert" className="text-destructive text-xs">
                {tierErrors.message}
              </p>
            ) : null}
          </div>
        </>
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
