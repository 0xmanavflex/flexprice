import { useMemo } from 'react'
import { DEFAULT_INVOICE_QUERY, emptyPayment } from '@fp/domain'
import { ApiError, useInvoice, useInvoices, useRecordPayment } from '@fp/query'
import { PaymentForm } from '@fp/ui/pages'
import { LoadingRows, PageBody } from '@fp/ui/compositions'

export interface PaymentFormPageProps {
  /** Start with this invoice chosen and its amount due filled in. */
  invoiceId?: string
  onCancel: () => void
  onDone: (paymentId: string) => void
}

/** Record a payment against an invoice on its own page: `/payments/new`. */
export function PaymentFormPage({ invoiceId, onCancel, onDone }: PaymentFormPageProps) {
  const record = useRecordPayment()
  const invoices = useInvoices({ ...DEFAULT_INVOICE_QUERY, page: 1, pageSize: 100 })
  const chosen = useInvoice(invoiceId ?? '', { enabled: Boolean(invoiceId) })
  const options = useMemo(
    () =>
      (invoices.data?.invoices ?? []).map((invoice) => ({
        value: invoice.id,
        label: `${invoice.number || '—'} · ${invoice.customerName}`,
      })),
    [invoices.data],
  )

  // A preset invoice waits for its record, so the amount due can be filled in.
  if (invoiceId && chosen.isPending) {
    return (
      <PageBody>
        <div className="pt-4">
          <LoadingRows />
        </div>
      </PageBody>
    )
  }
  const preset = chosen.data
  // The preset invoice is offered even when it is outside the first page of the list.
  const offered =
    preset && !options.some((option) => option.value === preset.id)
      ? [
          { value: preset.id, label: `${preset.number || '—'} · ${preset.customerName}` },
          ...options,
        ]
      : options

  return (
    <PaymentForm
      key={preset?.id ?? 'new'}
      invoices={offered}
      {...(preset
        ? {
            defaultValue: {
              ...emptyPayment(),
              invoiceId: preset.id,
              currency: preset.currency.toUpperCase(),
              amount: preset.amountRemaining.amount,
            },
          }
        : {})}
      trail={[{ label: 'Payments', onClick: onCancel }, { label: 'Record payment' }]}
      onCancel={onCancel}
      isSubmitting={record.isPending}
      submitError={toSubmitError(record.error)}
      onSubmit={(draft) =>
        record.mutate(draft, { onSuccess: (payment) => onDone(payment.id ?? '') })
      }
    />
  )
}

function toSubmitError(error: unknown): string | null {
  if (!error) return null
  if (error instanceof ApiError) {
    if (error.kind === 'invalid') return error.message || 'Check the details and try again.'
    if (error.kind === 'forbidden') return 'You do not have permission to record payments here.'
    if (error.kind === 'network') return 'Could not reach Flexprice. Check your connection.'
  }
  return 'Could not record the payment. Try again.'
}
