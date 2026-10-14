import { useCalmForm } from '@ui/compositions/forms/useCalmForm'
import { Controller, type Resolver } from 'react-hook-form'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import {
  PAYMENT_METHOD_LABEL,
  type RecordPayment,
  emptyPayment,
  recordPaymentSchema,
} from '@fp/domain'
import { Input } from '@ui/components/primitives/input'
import { Switch } from '@ui/components/primitives/switch'
import { FormCard, FormRow } from '@ui/compositions/forms/FormCard'
import { FormPage } from '@ui/compositions/forms/FormPage'
import type { DetailCrumb } from '@ui/compositions/detail/DetailShell'
import { OptionSelect, type Option } from '@ui/compositions/forms/OptionSelect'
import { provenance } from '@ui/provenance'

export const PaymentFormProvenance = provenance({
  source: 'composition',
  composes: ['ui/input', 'ui/switch', 'compositions/form-card', 'compositions/form-page'],
  note: 'RHF + recordPaymentSchema; the same FormPage shell as the other create forms.',
})

const CURRENCIES = ['USD', 'EUR', 'GBP', 'INR'].map((code) => ({ value: code, label: code }))
const METHODS = Object.entries(PAYMENT_METHOD_LABEL).map(([value, label]) => ({ value, label }))

export interface PaymentFormProps {
  invoices: readonly Option[]
  trail: DetailCrumb[]
  defaultValue?: RecordPayment
  onSubmit: (payment: RecordPayment) => void
  onCancel?: () => void
  isSubmitting?: boolean
  submitError?: string | null
}

/** Record a payment against an invoice: collected elsewhere, or run through a gateway now. */
export function PaymentForm({
  invoices,
  trail,
  defaultValue,
  onSubmit,
  onCancel,
  isSubmitting = false,
  submitError = null,
}: PaymentFormProps) {
  const form = useCalmForm<RecordPayment>({
    resolver: standardSchemaResolver(recordPaymentSchema) as Resolver<RecordPayment>,
    defaultValues: defaultValue ?? emptyPayment(),
  })
  const errors = form.formState.errors

  return (
    <FormPage
      title="Record payment"
      trail={trail}
      width="narrow"
      toolbar={{
        mode: 'create',
        noun: 'payment',
        formId: 'payment-create-form',
        onCancel,
        isSubmitting,
        submitError,
      }}
    >
      <form
        id="payment-create-form"
        onSubmit={form.handleSubmit((values) => onSubmit(values))}
        noValidate
      >
        <FormCard title="Payment details" status="required">
          <FormRow
            label="Invoice"
            hint="The invoice this payment settles."
            required
            error={errors.invoiceId?.message}
          >
            {({ id, ...field }) => (
              <Controller
                control={form.control}
                name="invoiceId"
                render={({ field: control }) => (
                  <OptionSelect
                    id={id}
                    {...field}
                    value={control.value}
                    onValueChange={control.onChange}
                    options={invoices}
                    placeholder="Choose an invoice"
                    disabled={isSubmitting}
                  />
                )}
              />
            )}
          </FormRow>
          <FormRow
            label="Currency"
            hint="The currency the payment was made in."
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
                    onValueChange={control.onChange}
                    options={CURRENCIES}
                    placeholder="Choose a currency"
                    disabled={isSubmitting}
                  />
                )}
              />
            )}
          </FormRow>
          <FormRow label="Amount" hint="How much was paid." required error={errors.amount?.message}>
            {({ id, ...field }) => (
              <Input
                id={id}
                inputMode="decimal"
                placeholder="0.00"
                disabled={isSubmitting}
                {...field}
                {...form.register('amount')}
              />
            )}
          </FormRow>
          <FormRow
            label="Method"
            hint="How the payment was made."
            required
            error={errors.methodType?.message}
          >
            {({ id, ...field }) => (
              <Controller
                control={form.control}
                name="methodType"
                render={({ field: control }) => (
                  <OptionSelect
                    id={id}
                    {...field}
                    value={control.value}
                    onValueChange={control.onChange}
                    options={METHODS}
                    disabled={isSubmitting}
                  />
                )}
              />
            )}
          </FormRow>
          <FormRow label="Process now" hint="Off leaves the payment initiated.">
            {({ id }) => (
              <Controller
                control={form.control}
                name="processNow"
                render={({ field: control }) => (
                  <Switch
                    id={id}
                    checked={control.value}
                    onCheckedChange={control.onChange}
                    disabled={isSubmitting}
                  />
                )}
              />
            )}
          </FormRow>
        </FormCard>
      </form>
    </FormPage>
  )
}
