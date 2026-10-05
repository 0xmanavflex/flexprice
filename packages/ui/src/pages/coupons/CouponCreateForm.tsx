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
import { FormCard, FormRow } from '@ui/compositions/FormCard'
import { FormActions } from '@ui/compositions/FormActions'
import { FormPage } from '@ui/compositions/FormPage'
import type { DetailCrumb } from '@ui/compositions/DetailShell'
import { DateInput } from '@ui/compositions/DateInput'
import { OptionSelect } from '@ui/compositions/OptionSelect'
import { provenance } from '@ui/provenance'
import { CouponPreviewCard } from './CouponPreviewCard'

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
  composes: [
    'ui/input',
    'compositions/form-card',
    'compositions/form-page',
    'compositions/form-actions',
    'pages/coupon-preview-card',
  ],
  note: 'RHF + the domain schema. One page of titled sections with a live summary rail; type and cadence reveal only the fields that apply.',
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

  const formEl = (
    <form
      id={FORM_ID}
      onSubmit={form.handleSubmit((values) => onSubmit(values))}
      noValidate
      className="flex flex-col gap-6"
    >
      <FormCard title="Basics">
        <FormRow label="Name" required error={errors.name?.message}>
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
      </FormCard>

      <FormCard
        title="Discount"
        description="The type, amount and duration are fixed once the coupon is created."
      >
        <FormRow label="Discount type" required error={errors.type?.message}>
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

        {type === CouponType.Percentage ? (
          <FormRow label="Percentage off" required error={errors.percentageOff?.message}>
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
          <FormRow label="Amount off" required error={errors.amountOff?.message}>
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
          </FormRow>
        )}

        {type === CouponType.Fixed ? (
          <FormRow label="Currency" required error={errors.currency?.message}>
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

        <FormRow label="Duration" required error={errors.cadence?.message}>
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
          <FormRow label="Billing periods" required error={errors.durationInPeriods?.message}>
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
      </FormCard>

      <FormCard title="Limits">
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
        <FormRow label="Redeemable from" error={errors.redeemAfter?.message}>
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
        </FormRow>
        <FormRow label="Redeemable until" error={errors.redeemBefore?.message}>
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
        </FormRow>
      </FormCard>
    </form>
  )

  return (
    <FormPage
      title="Create coupon"
      description="A discount customers can redeem. Its type, amount and duration are fixed once created."
      trail={trail}
      width="wide"
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
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start">
        <div className="min-w-0">{formEl}</div>
        <div className="flex flex-col gap-4 lg:sticky lg:top-4">
          <CouponPreviewCard
            name={form.watch('name')}
            code={form.watch('couponCode') ?? ''}
            type={type}
            percentageOff={form.watch('percentageOff')}
            amountOff={form.watch('amountOff')}
            currency={form.watch('currency')}
            cadence={cadence}
            durationInPeriods={form.watch('durationInPeriods')}
            maxRedemptions={form.watch('maxRedemptions')}
            redeemAfter={form.watch('redeemAfter')}
            redeemBefore={form.watch('redeemBefore')}
          />
        </div>
      </div>
    </FormPage>
  )
}
