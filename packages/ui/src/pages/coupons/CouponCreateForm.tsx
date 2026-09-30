import { Controller, useForm, type Resolver } from 'react-hook-form'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import {
  COUPON_CADENCE_LABEL,
  COUPON_TYPE_LABEL,
  CouponCadence,
  CouponType,
  type CreateCoupon,
  PRICE_UNIT_CURRENCIES,
  createCouponSchema,
  emptyCoupon,
} from '@fp/domain'
import { Input } from '@ui/components/primitives/input'
import { Field } from '@ui/compositions/Field'
import { FormActions } from '@ui/compositions/FormActions'
import { FormPage } from '@ui/compositions/FormPage'
import type { DetailCrumb } from '@ui/compositions/DetailShell'
import { DateInput } from '@ui/compositions/DateInput'
import { OptionSelect } from '@ui/compositions/OptionSelect'
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
  composes: ['ui/input', 'compositions/form-page', 'compositions/form-actions'],
  note: 'RHF + the domain schema. Type and cadence reveal only the fields that apply.',
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

const pad = (n: number) => String(n).padStart(2, '0')
const toIso = (d: Date | undefined) =>
  d ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` : ''
const fromIso = (s: string): Date | undefined => {
  const [y, m, d] = s.split('-').map(Number)
  return y && m && d ? new Date(y, m - 1, d) : undefined
}
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
  const form = useForm<CreateCoupon>({
    resolver: standardSchemaResolver(createCouponSchema) as Resolver<CreateCoupon>,
    defaultValues: defaultValue ?? emptyCoupon(),
    mode: 'onTouched',
  })

  const errors = form.formState.errors
  const type = form.watch('type')
  const cadence = form.watch('cadence')

  return (
    <FormPage
      title="Create coupon"
      description="A discount customers can redeem. Its type, amount and duration are fixed once created."
      trail={trail}
      width="narrow"
      footer={
        <FormActions
          mode="create"
          noun="coupon"
          formId={FORM_ID}
          onCancel={onCancel}
          isSubmitting={isSubmitting}
          submitError={submitError}
        />
      }
    >
      <form
        id={FORM_ID}
        onSubmit={form.handleSubmit((values) => onSubmit(values))}
        noValidate
        className="flex flex-col gap-5"
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Name" required error={errors.name?.message}>
            {({ id, ...field }) => (
              <Input id={id} disabled={isSubmitting} {...field} {...form.register('name')} />
            )}
          </Field>
          <Field
            label="Code"
            hint="What a customer types to redeem it. Optional."
            error={errors.couponCode?.message}
          >
            {({ id, ...field }) => (
              <Input id={id} disabled={isSubmitting} {...field} {...form.register('couponCode')} />
            )}
          </Field>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Discount type" required error={errors.type?.message}>
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
          </Field>

          {type === CouponType.Percentage ? (
            <Field label="Percentage off" required error={errors.percentageOff?.message}>
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
            </Field>
          ) : (
            <Field label="Amount off" required error={errors.amountOff?.message}>
              {({ id, ...field }) => (
                <Input
                  id={id}
                  inputMode="decimal"
                  placeholder="25.00"
                  disabled={isSubmitting}
                  {...field}
                  {...form.register('amountOff')}
                />
              )}
            </Field>
          )}
        </div>

        {type === CouponType.Fixed ? (
          <Field label="Currency" required error={errors.currency?.message}>
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
          </Field>
        ) : null}

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Duration" required error={errors.cadence?.message}>
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
          </Field>

          {cadence === CouponCadence.Repeated ? (
            <Field label="Billing periods" required error={errors.durationInPeriods?.message}>
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
            </Field>
          ) : null}
        </div>

        <Field
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
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Redeemable from" error={errors.redeemAfter?.message}>
            {({ id, ...field }) => (
              <Controller
                control={form.control}
                name="redeemAfter"
                render={({ field: control }) => (
                  <DateInput
                    id={id}
                    {...field}
                    value={toIso(control.value)}
                    onValueChange={(value) => control.onChange(fromIso(value))}
                    disabled={isSubmitting}
                  />
                )}
              />
            )}
          </Field>
          <Field label="Redeemable until" error={errors.redeemBefore?.message}>
            {({ id, ...field }) => (
              <Controller
                control={form.control}
                name="redeemBefore"
                render={({ field: control }) => (
                  <DateInput
                    id={id}
                    {...field}
                    value={toIso(control.value)}
                    onValueChange={(value) => control.onChange(fromIso(value))}
                    disabled={isSubmitting}
                  />
                )}
              />
            )}
          </Field>
        </div>
      </form>
    </FormPage>
  )
}
