import { useState } from 'react'
import { useCalmForm } from '@ui/compositions/forms/useCalmForm'
import { Controller, type Resolver } from 'react-hook-form'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import {
  COUPON_CADENCE_LABEL,
  COUPON_TYPE_LABEL,
  CouponCadence,
  CouponType,
  type CreateCoupon,
  PRICE_UNIT_CURRENCIES,
  createCouponSchema,
  currencySymbol,
  emptyCoupon,
} from '@fp/domain'
import { Input } from '@ui/components/primitives/input'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@ui/components/primitives/input-group'
import { FormCard, FormRow } from '@ui/compositions/forms/FormCard'
import { MetadataFields } from '@ui/compositions/forms/MetadataFields'
import { FormPage } from '@ui/compositions/forms/FormPage'
import type { DetailCrumb } from '@ui/compositions/detail/DetailShell'
import { DateInput, utcDayEnd, utcDayOf, utcDayStart } from '@ui/compositions/forms/DateInput'
import { OptionSelect } from '@ui/compositions/forms/OptionSelect'
import { provenance } from '@ui/provenance'

/**
 * Create a coupon, on a full page.
 *
 * Presentational: it emits a validated `CreateCoupon` and never imports
 * `@fp/query`. The discount, cadence and window are fixed once created, so this
 * is the only place they are chosen. Fields that depend on the type or cadence
 * (amount and currency, percentage, number of periods) appear only when they
 * apply, so the person is never asked for something the API would reject.
 */
export const CouponCreateFormProvenance = provenance({
  source: 'composition',
  composes: ['ui/input', 'compositions/form-card', 'compositions/form-page'],
  note: 'RHF + the domain schema. One page of titled sections, no preview rail; type and cadence reveal only the fields that apply.',
})

export interface CouponCreateFormProps {
  defaultValue?: CreateCoupon
  onSubmit: (coupon: CreateCoupon) => void
  onCancel: () => void
  /** Breadcrumb; the last crumb is the page itself. */
  trail: DetailCrumb[]
  isSubmitting?: boolean
  submitError?: string | null
}

const TYPE_OPTIONS = Object.values(CouponType).map((value) => ({
  value,
  label: COUPON_TYPE_LABEL[value],
}))

const CADENCE_OPTIONS = Object.values(CouponCadence).map((value) => ({
  value,
  label: COUPON_CADENCE_LABEL[value],
}))

const CURRENCY_OPTIONS = PRICE_UNIT_CURRENCIES.map((c) => ({ value: c.code, label: c.label }))

const toNumber = (raw: unknown): number | undefined =>
  raw === '' || raw === null || raw === undefined ? undefined : Number(raw)

const FORM_ID = 'coupon-create-form'

export function CouponCreateForm({
  defaultValue,
  trail,
  onSubmit,
  onCancel,
  isSubmitting = false,
  submitError = null,
}: CouponCreateFormProps) {
  const form = useCalmForm<CreateCoupon>({
    resolver: standardSchemaResolver(createCouponSchema) as Resolver<CreateCoupon>,
    defaultValues: defaultValue ?? emptyCoupon(),
  })

  const errors = form.formState.errors
  const type = form.watch('type')
  const [metadataProblem, setMetadataProblem] = useState<string | null>(null)
  const currency = form.watch('currency')
  const cadence = form.watch('cadence')

  const formEl = (
    <form
      id={FORM_ID}
      onSubmit={form.handleSubmit((values) => {
        // The metadata rows say what is wrong with them; nothing is sent until fixed.
        if (metadataProblem) return
        onSubmit(values)
      })}
      noValidate
    >
      <FormCard title="Coupon details">
        <FormRow
          label="Name"
          hint="Shown on invoices wherever the discount is applied."
          required
          error={errors.name?.message}
        >
          {({ id, ...field }) => (
            <Input id={id} disabled={isSubmitting} {...field} {...form.register('name')} />
          )}
        </FormRow>
        <FormRow
          label="Code"
          hint="What a customer types to redeem it. Optional."
          error={errors.couponCode?.message}
        >
          {({ id, ...field }) => (
            <Input id={id} disabled={isSubmitting} {...field} {...form.register('couponCode')} />
          )}
        </FormRow>

        <FormRow
          label="Discount type"
          hint="A percentage of the price, or a fixed amount."
          required
          error={errors.type?.message}
        >
          {({ id, ...field }) => (
            <Controller
              control={form.control}
              name="type"
              render={({ field: control }) => (
                <OptionSelect
                  id={id}
                  {...field}
                  value={control.value}
                  onValueChange={(value) => control.onChange(value)}
                  options={TYPE_OPTIONS}
                  disabled={isSubmitting}
                />
              )}
            />
          )}
        </FormRow>

        {/* Currency first, so the amount below can show its sign. */}
        {type === CouponType.Fixed ? (
          <FormRow
            label="Currency"
            hint="The currency the amount off is in."
            required
            error={errors.currency?.message}
          >
            {({ id, ...field }) => (
              <Controller
                control={form.control}
                name="currency"
                render={({ field: control }) => (
                  <OptionSelect
                    id={id}
                    {...field}
                    value={control.value}
                    onValueChange={(value) => control.onChange(value)}
                    options={CURRENCY_OPTIONS}
                    placeholder="Select a currency"
                    disabled={isSubmitting}
                  />
                )}
              />
            )}
          </FormRow>
        ) : null}

        {type === CouponType.Percentage ? (
          <FormRow
            label="Percentage off"
            hint="The share of the price taken off, from 0 to 100."
            required
            error={errors.percentageOff?.message}
          >
            {({ id, ...field }) => (
              <Input
                id={id}
                inputMode="decimal"
                placeholder="10"
                disabled={isSubmitting}
                {...field}
                {...form.register('percentageOff')}
              />
            )}
          </FormRow>
        ) : (
          <FormRow
            label="Amount off"
            hint="The fixed amount taken off the price."
            required
            error={errors.amountOff?.message}
          >
            {({ id, ...field }) => (
              // The amount is in the currency chosen above, so it carries its sign.
              <InputGroup className="h-9">
                {currency ? (
                  <InputGroupAddon align="inline-start">{currencySymbol(currency)}</InputGroupAddon>
                ) : null}
                <InputGroupInput
                  id={id}
                  inputMode="decimal"
                  placeholder="25.00"
                  disabled={isSubmitting}
                  {...field}
                  {...form.register('amountOff')}
                />
              </InputGroup>
            )}
          </FormRow>
        )}

        <FormRow
          label="Duration"
          hint="Whether the discount applies once, for a set number of billing periods, or forever."
          required
          error={errors.cadence?.message}
        >
          {({ id, ...field }) => (
            <Controller
              control={form.control}
              name="cadence"
              render={({ field: control }) => (
                <OptionSelect
                  id={id}
                  {...field}
                  value={control.value}
                  onValueChange={(value) => control.onChange(value)}
                  options={CADENCE_OPTIONS}
                  disabled={isSubmitting}
                />
              )}
            />
          )}
        </FormRow>

        {cadence === CouponCadence.Repeated ? (
          <FormRow
            label="Billing periods"
            hint="How many billing periods the discount repeats for."
            required
            error={errors.durationInPeriods?.message}
          >
            {({ id, ...field }) => (
              <Input
                id={id}
                inputMode="numeric"
                placeholder="3"
                disabled={isSubmitting}
                {...field}
                {...form.register('durationInPeriods', { setValueAs: toNumber })}
              />
            )}
          </FormRow>
        ) : null}

        <FormRow
          label="Max redemptions"
          hint="Leave blank for unlimited."
          error={errors.maxRedemptions?.message}
        >
          {({ id, ...field }) => (
            <Input
              id={id}
              inputMode="numeric"
              disabled={isSubmitting}
              {...field}
              {...form.register('maxRedemptions', { setValueAs: toNumber })}
            />
          )}
        </FormRow>
        <FormRow
          label="Redeemable from"
          hint="The first day the coupon can be redeemed. Optional."
          error={errors.redeemAfter?.message}
        >
          {({ id, ...field }) => (
            <Controller
              control={form.control}
              name="redeemAfter"
              render={({ field: control }) => (
                <DateInput
                  id={id}
                  {...field}
                  value={utcDayOf(control.value)}
                  // Starts at midnight UTC on the day picked, in every browser zone.
                  onValueChange={(value) => control.onChange(utcDayStart(value))}
                  disabled={isSubmitting}
                />
              )}
            />
          )}
        </FormRow>
        <FormRow
          label="Redeemable until"
          hint="The last day the coupon can be redeemed. Optional."
          error={errors.redeemBefore?.message}
        >
          {({ id, ...field }) => (
            <Controller
              control={form.control}
              name="redeemBefore"
              render={({ field: control }) => (
                <DateInput
                  id={id}
                  {...field}
                  value={utcDayOf(control.value)}
                  // The last day counts: redeemable until the end of that UTC day.
                  onValueChange={(value) => control.onChange(utcDayEnd(value))}
                  disabled={isSubmitting}
                />
              )}
            />
          )}
        </FormRow>
      </FormCard>
      <FormCard title="Metadata" status="optional">
        <FormRow
          label="Fields"
          hint="Free-form key/value pairs kept with the coupon, for your own systems. Optional."
          align="start"
        >
          {() => (
            <MetadataFields
              label="Coupon metadata"
              defaultValue={form.getValues('metadata')}
              disabled={isSubmitting}
              onChange={(metadata, problem) => {
                setMetadataProblem(problem)
                form.setValue('metadata', Object.keys(metadata).length > 0 ? metadata : undefined, {
                  shouldDirty: true,
                })
              }}
            />
          )}
        </FormRow>
      </FormCard>
    </form>
  )

  return (
    <FormPage
      title="Create coupon"
      trail={trail}
      toolbar={{
        mode: 'create',
        noun: 'coupon',
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
