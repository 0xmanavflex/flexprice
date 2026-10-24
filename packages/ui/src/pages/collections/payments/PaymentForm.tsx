import { useCalmForm } from '@ui/compositions/forms/useCalmForm'
import { Controller, type Resolver } from 'react-hook-form'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import {
  PAYMENT_METHOD_LABEL,
  PaymentMethod,
  RECORDABLE_PAYMENT_METHODS,
  type RecordPayment,
  emptyPayment,
  recordPaymentSchema,
  currencyCodes,
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

const CURRENCIES = currencyCodes().map((code) => ({ value: code, label: code }))
const METHODS = RECORDABLE_PAYMENT_METHODS.map((value) => ({
  value,
  label: PAYMENT_METHOD_LABEL[value],
}))

export interface PaymentFormProps {
  invoices: readonly Option[]
  trail: DetailCrumb[]
  defaultValue?: RecordPayment
  onSubmit: (payment: RecordPayment) => void
  onCancel?: () => void
  isSubmitting?: boolean
  submitError?: string | null
  /**
   * The chosen invoice's customer's wallets that can pay it (active, in its
   * currency), for "Credits". Undefined while they load.
   */
  wallets?: readonly Option[] | undefined
  /** Reports the chosen invoice, so the page can load its customer's wallets. */
  onInvoiceChange?: ((invoiceId: string) => void) | undefined
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
  wallets,
  onInvoiceChange,
}: PaymentFormProps) {
  const form = useCalmForm<RecordPayment>({
    resolver: standardSchemaResolver(recordPaymentSchema) as Resolver<RecordPayment>,
    defaultValues: defaultValue ?? emptyPayment(),
  })
  const errors = form.formState.errors
  const methodType = form.watch('methodType')

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
                    onValueChange={(value) => {
                      control.onChange(value)
                      onInvoiceChange?.(value)
                    }}
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
          {methodType === PaymentMethod.Credits ? (
            <FormRow
              label="Wallet"
              hint="The customer's wallet the credits are drawn from."
              required
              error={errors.walletId?.message}
            >
              {({ id, ...field }) => (
                <Controller
                  control={form.control}
                  name="walletId"
                  render={({ field: control }) => (
                    <OptionSelect
                      id={id}
                      {...field}
                      value={control.value ?? ''}
                      onValueChange={control.onChange}
                      options={wallets ?? []}
                      placeholder={
                        wallets === undefined
                          ? 'Choose an invoice first'
                          : wallets.length === 0
                            ? 'No active wallet in this currency'
                            : 'Choose a wallet'
                      }
                      disabled={isSubmitting || !wallets?.length}
                    />
                  )}
                />
              )}
            </FormRow>
          ) : null}
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
