import { Controller, useForm, type Resolver } from 'react-hook-form'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import {
  CREDIT_GRANT_CADENCE_LABEL,
  CREDIT_GRANT_EXPIRY_DURATION_UNIT_LABEL,
  CREDIT_GRANT_EXPIRY_TYPE_LABEL,
  CREDIT_GRANT_PERIOD_LABEL,
  type CreateCreditGrant,
  CreditGrantCadence,
  CreditGrantExpiryDurationUnit,
  CreditGrantExpiryType,
  CreditGrantPeriod,
  createCreditGrantSchema,
  emptyCreditGrant,
} from '@fp/domain'
import { Button } from '@ui/primitives/button'
import { Input } from '@ui/primitives/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@ui/primitives/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@ui/primitives/select'
import { Field } from '@ui/compositions/Field'
import { provenance } from '@ui/provenance'

/**
 * Add a credit grant, in a dialog.
 *
 * Two choices bend the form: a *recurring* grant asks for the period it
 * refreshes on; a *duration* expiry asks how long the credits last. Everything
 * else is always shown. The rules — a recurring grant needs a period, a positive
 * number of credits — are the domain schema's, so what the dialog rejects an
 * agent-driven grant is held to as well.
 *
 * It emits a validated `CreateCreditGrant`; the page creates it (there is no
 * bulk grant endpoint, so one dialog makes one grant).
 */
export const CreditGrantDialogProvenance = provenance({
  source: 'composition',
  composes: ['ui/dialog', 'ui/select', 'ui/input', 'ui/button'],
  note: 'Add-credit-grant dialog; period and duration fields appear conditionally.',
})

export interface CreditGrantDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (grant: CreateCreditGrant) => void
  isSubmitting?: boolean
  submitError?: string | null
}

export function CreditGrantDialog({
  open,
  onOpenChange,
  onSubmit,
  isSubmitting = false,
  submitError = null,
}: CreditGrantDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add credit grant</DialogTitle>
          <DialogDescription>
            Hand subscribers a balance of credits to spend against usage.
          </DialogDescription>
        </DialogHeader>
        <CreditGrantFields
          key={open ? 'open' : 'closed'}
          isSubmitting={isSubmitting}
          submitError={submitError}
          onSubmit={onSubmit}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

interface FieldsProps {
  isSubmitting: boolean
  submitError: string | null
  onSubmit: (grant: CreateCreditGrant) => void
  onCancel: () => void
}

function CreditGrantFields({ isSubmitting, submitError, onSubmit, onCancel }: FieldsProps) {
  const form = useForm<CreateCreditGrant>({
    resolver: standardSchemaResolver(createCreditGrantSchema) as Resolver<CreateCreditGrant>,
    defaultValues: emptyCreditGrant(),
    mode: 'onTouched',
  })

  const errors = form.formState.errors
  const cadence = form.watch('cadence')
  const expirationType = form.watch('expirationType')

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

      <div className="grid grid-cols-2 gap-3">
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
          label="Credit type"
          required
        >
          {({ id }) => (
            <Controller
              control={form.control}
              name="cadence"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange} disabled={isSubmitting}>
                  <SelectTrigger id={id}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(CreditGrantCadence).map((value) => (
                      <SelectItem key={value} value={value}>
                        {CREDIT_GRANT_CADENCE_LABEL[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          )}
        </Field>
      </div>

      {cadence === CreditGrantCadence.Recurring ? (
        <Field label="Refreshes every" required error={(errors as { period?: { message?: string } }).period?.message}>
          {({ id }) => (
            <Controller
              control={form.control}
              name="period"
              render={({ field }) => (
                <Select
                  value={field.value ?? ''}
                  onValueChange={field.onChange}
                  disabled={isSubmitting}
                >
                  <SelectTrigger id={id}>
                    <SelectValue placeholder="Choose a period" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(CreditGrantPeriod).map((value) => (
                      <SelectItem key={value} value={value}>
                        {CREDIT_GRANT_PERIOD_LABEL[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          )}
        </Field>
      ) : null}

      <Field label="Expiry" required>
        {({ id }) => (
          <Controller
            control={form.control}
            name="expirationType"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange} disabled={isSubmitting}>
                <SelectTrigger id={id}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(CreditGrantExpiryType).map((value) => (
                    <SelectItem key={value} value={value}>
                      {CREDIT_GRANT_EXPIRY_TYPE_LABEL[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        )}
      </Field>

      {expirationType === CreditGrantExpiryType.Duration ? (
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Duration"
            required
            error={(errors as { expirationDuration?: { message?: string } }).expirationDuration?.message}
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
          <Field label="Unit">
            {({ id }) => (
              <Controller
                control={form.control}
                name="expirationDurationUnit"
                render={({ field }) => (
                  <Select
                    value={field.value ?? CreditGrantExpiryDurationUnit.Day}
                    onValueChange={field.onChange}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger id={id}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(CreditGrantExpiryDurationUnit).map((value) => (
                        <SelectItem key={value} value={value}>
                          {CREDIT_GRANT_EXPIRY_DURATION_UNIT_LABEL[value]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            )}
          </Field>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Conversion rate"
          hint="Optional. 1 credit = this much currency."
          error={(errors as { conversionRate?: { message?: string } }).conversionRate?.message}
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
      </div>

      {submitError ? (
        <p role="alert" className="text-sm text-destructive">
          {submitError}
        </p>
      ) : null}

      <div className="flex gap-2 border-t pt-4">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Adding…' : 'Add credit grant'}
        </Button>
        <Button type="button" variant="outline" disabled={isSubmitting} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
