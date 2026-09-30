import { Controller, useForm, type Resolver } from 'react-hook-form'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import {
  CREDIT_GRANT_EXPIRY_DURATION_UNIT_LABEL,
  CREDIT_GRANT_EXPIRY_TYPE_LABEL,
  CREDIT_GRANT_PERIOD_LABEL,
  type CreateCreditGrant,
  CreditGrantCadence,
  CreditGrantExpiryDurationUnit,
  CreditGrantExpiryType,
  CreditGrantPeriod,
  type EditCreditGrant,
  createCreditGrantSchema,
  editCreditGrantSchema,
  emptyCreditGrant,
} from '@fp/domain'
import { Input } from '@ui/components/primitives/input'
import { ChoiceCards } from '@ui/compositions/DetailKit'
import { DateInput } from '@ui/compositions/DateInput'
import { Field } from '@ui/compositions/Field'
import { FormActions } from '@ui/compositions/FormActions'
import { OptionSelect } from '@ui/compositions/OptionSelect'
import { provenance } from '@ui/provenance'

/**
 * Add or edit a credit grant, as a form.
 *
 * Create: a *recurring* grant asks for the period it refreshes on; a *duration*
 * expiry asks how long the credits last. The rules are the domain schema's.
 * Edit: a grant already applied to subscriptions cannot be re-priced, so only
 * its name and end date change. It emits a validated `CreateCreditGrant` or
 * `EditCreditGrant`; the caller saves it (one grant per submit).
 */
export const CreditGrantFormProvenance = provenance({
  source: 'composition',
  composes: [
    'compositions/field',
    'compositions/form-actions',
    'compositions/option-select',
    'compositions/date-input',
    'ui/input',
  ],
  note: 'Credit-grant form, create or edit; period and duration fields appear conditionally.',
})

export interface CreditGrantFormProps<T> {
  isSubmitting?: boolean
  submitError?: string | null
  onSubmit: (grant: T) => void
  onCancel?: () => void
  submitLabel?: string
}

const messageOf = (errors: unknown, key: string): string | undefined =>
  (errors as Record<string, { message?: string } | undefined>)[key]?.message

const optionsOf = <T extends string>(values: T[], labels: Record<T, string>) =>
  values.map((value) => ({ value, label: labels[value] }))

const pad = (n: number) => String(n).padStart(2, '0')
const toIso = (date: Date | undefined) =>
  date ? `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` : ''
const endOfDay = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return y && m && d ? new Date(y, m - 1, d, 23, 59, 59) : undefined
}

export function CreditGrantEditForm({
  defaultValue,
  isSubmitting = false,
  submitError = null,
  onSubmit,
  onCancel,
  submitLabel,
}: CreditGrantFormProps<EditCreditGrant> & { defaultValue: EditCreditGrant }) {
  const form = useForm<EditCreditGrant>({
    resolver: standardSchemaResolver(editCreditGrantSchema) as Resolver<EditCreditGrant>,
    defaultValues: defaultValue,
    mode: 'onTouched',
  })
  const errors = form.formState.errors

  return (
    <form
      onSubmit={form.handleSubmit((values) => onSubmit(values))}
      noValidate
      className="flex flex-col gap-4"
    >
      <Field label="Name" required error={errors.name?.message}>
        {({ id, ...field }) => (
          <Input id={id} disabled={isSubmitting} {...field} {...form.register('name')} />
        )}
      </Field>
      <div className="max-w-xs">
        <Field
          label="End date"
          hint="Optional. The grant stops issuing credits after this day."
          error={errors.endDate?.message}
        >
          {({ id, 'aria-describedby': describedBy, 'aria-invalid': invalid }) => (
            <Controller
              control={form.control}
              name="endDate"
              render={({ field }) => (
                <DateInput
                  id={id}
                  value={toIso(field.value)}
                  onValueChange={(iso) => field.onChange(iso ? endOfDay(iso) : undefined)}
                  disabled={isSubmitting}
                  aria-describedby={describedBy}
                  aria-invalid={invalid}
                />
              )}
            />
          )}
        </Field>
      </div>
      <FormActions
        mode="edit"
        onCancel={onCancel}
        isSubmitting={isSubmitting}
        submitError={submitError}
        {...(submitLabel ? { submitLabel } : {})}
      />
    </form>
  )
}

export function CreditGrantCreateForm({
  isSubmitting = false,
  submitError = null,
  onSubmit,
  onCancel,
  submitLabel,
}: CreditGrantFormProps<CreateCreditGrant>) {
  const form = useForm<CreateCreditGrant>({
    resolver: standardSchemaResolver(createCreditGrantSchema) as Resolver<CreateCreditGrant>,
    defaultValues: emptyCreditGrant(),
    mode: 'onTouched',
  })

  const errors = form.formState.errors
  const cadence = form.watch('cadence')
  const expirationType = form.watch('expirationType')
  const credits = form.watch('credits')
  const rate = form.watch('conversionRate')
  const period = form.watch('period')
  const duration = form.watch('expirationDuration')
  const durationUnit = form.watch('expirationDurationUnit')

  const creditsNumber = Number(credits)
  const rateNumber = Number(rate)
  const dollarValue =
    creditsNumber > 0 && rateNumber > 0
      ? new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(
          creditsNumber * rateNumber,
        )
      : null

  const expiry =
    expirationType === CreditGrantExpiryType.Never
      ? 'never expire'
      : expirationType === CreditGrantExpiryType.BillingCycle
        ? 'expire at the end of the billing cycle'
        : `expire after ${duration && duration > 0 ? duration : '?'} ${(
            CREDIT_GRANT_EXPIRY_DURATION_UNIT_LABEL[
              durationUnit ?? CreditGrantExpiryDurationUnit.Day
            ] ?? ''
          ).toLowerCase()}`
  const summary = `${
    cadence === CreditGrantCadence.Recurring
      ? `Every ${period ? (CREDIT_GRANT_PERIOD_LABEL[period] ?? period).toLowerCase() : 'period'}, subscribers receive`
      : 'Subscribers receive once'
  } ${creditsNumber > 0 ? creditsNumber.toLocaleString() : 'some'} credits${
    dollarValue ? ` (${dollarValue})`: ''
  }. Credits ${expiry}; priority ${form.watch('priority') ?? 0}.`

  return (
    <form
      onSubmit={form.handleSubmit((values) => onSubmit(values))}
      noValidate
      className="flex flex-col gap-5"
    >
      <Controller
        control={form.control}
        name="cadence"
        render={({ field }) => (
          <ChoiceCards
            label="Grant type"
            value={field.value}
            onChange={field.onChange}
            choices={[
              {
                value: CreditGrantCadence.OneTime,
                title: 'One-time',
                description: 'Issued once when a customer starts on the plan.',
              },
              {
                value: CreditGrantCadence.Recurring,
                title: 'Recurring',
                description: 'Refreshed on a schedule while the plan is active.',
              },
            ]}
          />
        )}
      />

      <div className="grid gap-x-6 gap-y-4 md:grid-cols-2">
        <div className="flex flex-col gap-4">
          <Field label="Name" required error={errors.name?.message}>
            {({ id, ...field }) => (
              <Input id={id} disabled={isSubmitting} {...field} {...form.register('name')} />
            )}
          </Field>
          <Field label="Credits" required error={errors.credits?.message}>
            {({ id, ...field }) => (
              <Input
                id={id}
                inputMode="decimal"
                placeholder="e.g. 500"
                disabled={isSubmitting}
                {...field}
                {...form.register('credits')}
              />
            )}
          </Field>
          <Field
            label="Conversion rate"
            hint={dollarValue ? `Worth ${dollarValue}.` : 'Optional. 1 credit = this much currency.'}
            error={messageOf(errors, 'conversionRate')}
          >
            {({ id, ...field }) => (
              <Input
                id={id}
                inputMode="decimal"
                placeholder="e.g. 0.01"
                disabled={isSubmitting}
                {...field}
                {...form.register('conversionRate')}
              />
            )}
          </Field>
          {cadence === CreditGrantCadence.Recurring ? (
            <Field label="Refreshes every" required error={messageOf(errors, 'period')}>
              {({ id }) => (
                <Controller
                  control={form.control}
                  name="period"
                  render={({ field }) => (
                    <OptionSelect
                      id={id}
                      value={field.value ?? ''}
                      onValueChange={field.onChange}
                      options={optionsOf(
                        Object.values(CreditGrantPeriod),
                        CREDIT_GRANT_PERIOD_LABEL,
                      )}
                      placeholder="Choose a period"
                      disabled={isSubmitting}
                    />
                  )}
                />
              )}
            </Field>
          ) : null}
        </div>

        <div className="flex flex-col gap-4">
          <Field label="Expiry" required>
            {({ id }) => (
              <Controller
                control={form.control}
                name="expirationType"
                render={({ field }) => (
                  <OptionSelect
                    id={id}
                    value={field.value}
                    onValueChange={field.onChange}
                    options={optionsOf(
                      Object.values(CreditGrantExpiryType),
                      CREDIT_GRANT_EXPIRY_TYPE_LABEL,
                    )}
                    disabled={isSubmitting}
                  />
                )}
              />
            )}
          </Field>
          {expirationType === CreditGrantExpiryType.Duration ? (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Duration" required error={messageOf(errors, 'expirationDuration')}>
                {({ id, ...field }) => (
                  <Input
                    id={id}
                    type="number"
                    min={1}
                    disabled={isSubmitting}
                    {...field}
                    {...form.register('expirationDuration', { valueAsNumber: true })}
                  />
                )}
              </Field>
              <Field label="Unit">
                {({ id }) => (
                  <Controller
                    control={form.control}
                    name="expirationDurationUnit"
                    render={({ field }) => (
                      <OptionSelect
                        id={id}
                        value={field.value ?? CreditGrantExpiryDurationUnit.Day}
                        onValueChange={field.onChange}
                        options={optionsOf(
                          Object.values(CreditGrantExpiryDurationUnit),
                          CREDIT_GRANT_EXPIRY_DURATION_UNIT_LABEL,
                        )}
                        disabled={isSubmitting}
                      />
                    )}
                  />
                )}
              </Field>
            </div>
          ) : null}
          <Field label="Priority" hint="0 is highest." error={errors.priority?.message}>
            {({ id, ...field }) => (
              <Input
                id={id}
                type="number"
                min={0}
                disabled={isSubmitting}
                {...field}
                {...form.register('priority', { valueAsNumber: true })}
              />
            )}
          </Field>
          <p className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
            {summary}
          </p>
        </div>
      </div>

      <FormActions
        mode="create"
        noun="credit grant"
        onCancel={onCancel}
        isSubmitting={isSubmitting}
        submitError={submitError}
        {...(submitLabel ? { submitLabel } : {})}
      />
    </form>
  )
}
