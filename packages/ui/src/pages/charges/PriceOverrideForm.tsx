import { useEffect, useRef } from 'react'
import { useFieldArray, useForm, type Resolver } from 'react-hook-form'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import {
  BILLING_MODEL_LABEL,
  BillingModel,
  TIER_MODE_LABEL,
  TierMode,
  emptyOverride,
  type PriceOverride,
  priceOverrideSchema,
} from '@fp/domain'
import { Button } from '@ui/components/primitives/button'
import { RadioGroup, RadioGroupItem } from '@ui/components/primitives/radio-group'
import { Label } from '@ui/components/primitives/label'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@ui/components/primitives/table'
import { Input } from '@ui/components/primitives/input'
import { ChoiceCards } from '@ui/compositions/DetailKit'
import { Field } from '@ui/compositions/Field'
import { provenance } from '@ui/provenance'

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
 * It is presentational in the same sense `InvoiceGrid` is — it takes a default
 * value and emits a validated `PriceOverride` on submit. It does not fetch, it
 * does not know what a subscription is, and it cannot import `@fp/query`.
 *
 * Errors come from the domain schema, so the message a user reads about
 * overlapping tiers is the same rule an agent-driven action is held to.
 */
export const PriceOverrideFormProvenance = provenance({
  source: 'composition',
  composes: ['ui/button', 'ui/input', 'ui/label'],
  note: 'RHF + the domain Zod schema; holds no state of its own.',
})

export interface PriceOverrideFormProps {
  priceId: string
  /** Existing override when editing; omit to start from the model's empty shape. */
  defaultValue?: PriceOverride
  onSubmit: (override: PriceOverride) => void
  onCancel?: () => void
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
}

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
  onCancel,
  isSubmitting = false,
  submitError = null,
  formId,
  hideActions = false,
  onStartedChange,
}: PriceOverrideFormProps) {
  const form = useForm<PriceOverride>({
    resolver: standardSchemaResolver(priceOverrideSchema) as Resolver<PriceOverride>,
    defaultValues: defaultValue ?? emptyOverride(priceId, BillingModel.FlatFee),
    // Validate once a field has been touched, not on every keystroke from the
    // start: telling someone their empty field is invalid before they have
    // typed in it is noise, and noise is what gets ignored.
    mode: 'onTouched',
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
    form.reset(emptyOverride(priceId, next))
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
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Tiers</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isSubmitting}
                // The unbounded band must stay last, so a new one is inserted
                // before it rather than appended after it.
                onClick={() => insert(fields.length - 1, { upTo: null, unitAmount: '' } as never)}
              >
                Add tier
              </Button>
            </div>

            <Table>
              <TableCaption className="sr-only">
                Price tiers, from the lowest band to the unbounded final band
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Up to</TableHead>
                  <TableHead>Per unit</TableHead>
                  <TableHead>Flat fee</TableHead>
                  <TableHead className="sr-only">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fields.map((field, index) => {
                  const rowErrors = (
                    errors as { tiers?: { message?: string }[] }
                  ).tiers?.[index] as
                    | { upTo?: { message?: string }; unitAmount?: { message?: string } }
                    | undefined
                  const isLast = index === fields.length - 1

                  return (
                    <TableRow key={field.id}>
                      <TableCell className="align-top">
                        <Input
                          type="number"
                          disabled={isSubmitting || isLast}
                          placeholder={isLast ? '∞' : ''}
                          aria-label={`Tier ${index + 1} upper limit`}
                          aria-invalid={rowErrors?.upTo ? true : undefined}
                          {...form.register(`tiers.${index}.upTo` as never, {
                            setValueAs: (v) => (v === '' || v == null ? null : Number(v)),
                          })}
                        />
                        {rowErrors?.upTo ? (
                          <p role="alert" className="mt-1 text-xs text-destructive">
                            {rowErrors.upTo.message}
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell className="align-top">
                        <Input
                          inputMode="decimal"
                          disabled={isSubmitting}
                          aria-label={`Tier ${index + 1} unit price`}
                          aria-invalid={rowErrors?.unitAmount ? true : undefined}
                          {...form.register(`tiers.${index}.unitAmount` as never)}
                        />
                        {rowErrors?.unitAmount ? (
                          <p role="alert" className="mt-1 text-xs text-destructive">
                            {rowErrors.unitAmount.message}
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell className="align-top">
                        <Input
                          inputMode="decimal"
                          disabled={isSubmitting}
                          aria-label={`Tier ${index + 1} flat fee`}
                          {...form.register(`tiers.${index}.flatAmount` as never)}
                        />
                      </TableCell>
                      <TableCell className="align-top">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          // The unbounded band cannot be removed: without it,
                          // usage above the last ceiling is not billed at all.
                          disabled={isSubmitting || isLast || fields.length === 1}
                          aria-label={`Remove tier ${index + 1}`}
                          onClick={() => remove(index)}
                        >
                          Remove
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>

            {tierErrors?.message ? (
              <p role="alert" className="text-xs text-destructive">
                {tierErrors.message}
              </p>
            ) : null}
          </div>
        </>
      ) : null}

      {submitError ? (
        <p role="alert" className="text-sm text-destructive">
          {submitError}
        </p>
      ) : null}

      {hideActions ? null : (
        <div className="flex justify-end gap-2 border-t pt-4">
          {onCancel ? (
            <Button type="button" variant="outline" disabled={isSubmitting} onClick={onCancel}>
              Cancel
            </Button>
          ) : null}
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : 'Save override'}
          </Button>
        </div>
      )}
    </form>
  )
}
