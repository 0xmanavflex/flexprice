import { useMemo } from 'react'
import { DEFAULT_INVOICE_QUERY } from '@fp/domain'
import { ApiError, useInvoices, useRecordPayment } from '@fp/query'
import { PaymentForm } from '@fp/ui/pages'

export interface PaymentFormPageProps {
  onCancel: () => void
  onDone: (paymentId: string) => void
}

/** Record a payment against an invoice on its own page: `/payments/new`. */
export function PaymentFormPage({ onCancel, onDone }: PaymentFormPageProps) {
  const record = useRecordPayment()
  const invoices = useInvoices({ ...DEFAULT_INVOICE_QUERY, page: 1, pageSize: 100 })
  const options = useMemo(
    () =>
      (invoices.data?.invoices ?? []).map((invoice) => ({
        value: invoice.id,
        label: `${invoice.number || '—'} · ${invoice.customerName}`,
      })),
    [invoices.data],
  )

  return (
    <PaymentForm
      invoices={options}
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
