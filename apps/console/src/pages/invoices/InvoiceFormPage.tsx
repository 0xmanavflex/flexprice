import { useMemo } from 'react'
import { DEFAULT_CUSTOMER_QUERY } from '@fp/domain'
import { ApiError, useCreateInvoice, useCustomers } from '@fp/query'
import { InvoiceForm } from '@fp/ui/pages'

export interface InvoiceFormPageProps {
  onCancel: () => void
  onDone: (invoiceId: string) => void
}

/** Create a one-off invoice on its own page: `/invoices/new`. */
export function InvoiceFormPage({ onCancel, onDone }: InvoiceFormPageProps) {
  const create = useCreateInvoice()
  const customers = useCustomers({ ...DEFAULT_CUSTOMER_QUERY, page: 1, pageSize: 100 })
  const options = useMemo(
    () =>
      (customers.data?.customers ?? []).map((c) => ({
        value: c.id,
        label: c.email ? `${c.name} · ${c.email}` : c.name,
      })),
    [customers.data],
  )

  return (
    <InvoiceForm
      customers={options}
      trail={[{ label: 'Invoices', onClick: onCancel }, { label: 'New invoice' }]}
      onCancel={onCancel}
      isSubmitting={create.isPending}
      submitError={toSubmitError(create.error)}
      onSubmit={(draft) =>
        create.mutate(draft, { onSuccess: (invoice) => onDone(invoice.id ?? '') })
      }
    />
  )
}

function toSubmitError(error: unknown): string | null {
  if (!error) return null
  if (error instanceof ApiError) {
    if (error.kind === 'invalid') return error.message || 'Check the details and try again.'
    if (error.kind === 'forbidden') return 'You do not have permission to create invoices here.'
    if (error.kind === 'network') return 'Could not reach Flexprice. Check your connection.'
  }
  return 'Could not create the invoice. Try again.'
}
