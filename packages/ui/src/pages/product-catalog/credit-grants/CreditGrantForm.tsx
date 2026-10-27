import { useCalmForm } from '@ui/compositions/forms/useCalmForm'
import { Controller, type Resolver } from 'react-hook-form'
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
import { ChoiceCards } from '@ui/compositions/detail/DetailKit'
import { DateInput, utcDayEnd, utcDayOf } from '@ui/compositions/forms/DateInput'
import { Field } from '@ui/compositions/forms/Field'
import { FormActions } from '@ui/compositions/forms/FormActions'
import { OptionSelect } from '@ui/compositions/forms/OptionSelect'
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
  /**
   * Not drawn: these forms have no Cancel. The container's own close (the
   * dialog's X, or the staged step's close) is the way out. Kept so callers
   * can still pass it.
   */
  onCancel?: (() => void) | undefined
  submitLabel?: string
  /** Opens on this grant instead of a blank one: editing a plan's grant on a contract. */
  defaultValue?: T
}

const messageOf = (errors: unknown, key: string): string | undefined =>
  (errors as Record<string, { message?: string } | undefined>)[key]?.message

const optionsOf = <T extends string>(values: T[], labels: Record<T, string>) =>
  values.map((value) => ({ value, label: labels[value] }))

export function CreditGrantEditForm({
  defaultValue,
  isSubmitting = false,
  submitError = null,
  onSubmit,
  submitLabel,
  allowEndDate = true,
}: CreditGrantFormProps<EditCreditGrant> & {
  defaultValue: EditCreditGrant
  /**
   * False for a plan's grant: the API cannot hold a future end date on one; any
   * end date archives it at once, so it would vanish from the plan. Removing the
   * grant is the honest way to end it.
   */
  allowEndDate?: boolean
}) {
  const form = useCalmForm<EditCreditGrant>({
    resolver: standardSchemaResolver(editCreditGrantSchema) as Resolver<EditCreditGrant>,
    defaultValues: defaultValue,
  })
  const errors = form.formState.errors

  return (
    <form
      onSubmit={form.handleSubmit((values) => onSubmit(values))}
      noValidate
      className="flex flex-col gap-4"
    >
      <Field
        label="Name"
        hint="What this grant is called on the customer's wallet and in reports."
        required
        error={errors.name?.message}
      >
        {({ id, ...field }) => (
          <Input id={id} disabled={isSubmitting} {...field} {...form.register('name')} />
        )}
      </Field>
      {allowEndDate ? (
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
                    value={utcDayOf(field.value)}
                    // Issues through the day picked: the end of that UTC day, in every browser zone.
                    onValueChange={(day) => field.onChange(utcDayEnd(day))}
                    disabled={isSubmitting}
                    aria-describedby={describedBy}
                    aria-invalid={invalid}
                  />
                )}
              />
            )}
          </Field>
        </div>
      ) : (
        <p className="text-muted-foreground text-xs">
          A plan's grant has no end date. To stop issuing it, remove it from the plan; contracts
          already given its credits keep them.
        </p>
      )}
      <FormActions
        mode="edit"
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
  submitLabel,
  defaultValue,
}: CreditGrantFormProps<CreateCreditGrant>) {
  const form = useCalmForm<CreateCreditGrant>({
    resolver: standardSchemaResolver(createCreditGrantSchema) as Resolver<CreateCreditGrant>,
    defaultValues: defaultValue ?? emptyCreditGrant(),
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
      ? new Intl.NumberFormat(undefined, {
          style: 'currency',
          currencyDisplay: 'narrowSymbol',
          currency: 'USD',
        }).format(creditsNumber * rateNumber)
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
    dollarValue ? ` (${dollarValue})` : ''
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
          <Field
            label="Name"
            hint="What this grant is called on the customer's wallet and in reports."
            required
            error={errors.name?.message}
          >
            {({ id, ...field }) => (
              <Input id={id} disabled={isSubmitting} {...field} {...form.register('name')} />
            )}
          </Field>
          <Field
            label="Credits"
            hint="How many credits are issued each time the grant applies."
            required
            error={errors.credits?.message}
          >
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
            hint={
              dollarValue ? `Worth ${dollarValue}.` : 'Optional. 1 credit = this much currency.'
            }
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
            <Field
              label="Refreshes every"
              hint="How often a recurring grant issues its credits again."
              required
              error={messageOf(errors, 'period')}
            >
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
          <Field label="Expiry" hint="When credits from this grant stop being usable." required>
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
              <Field
                label="Duration"
                hint="How long credits last once issued, counted in the unit chosen next."
                required
                error={messageOf(errors, 'expirationDuration')}
              >
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
              <Field label="Unit" hint="The unit the duration is counted in.">
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
          <p className="bg-muted/40 text-muted-foreground rounded-lg border p-3 text-sm">
            {summary}
          </p>
        </div>
      </div>

      <FormActions
        mode="create"
        noun="credit grant"
        isSubmitting={isSubmitting}
        submitError={submitError}
        {...(submitLabel ? { submitLabel } : {})}
      />
    </form>
  )
}
