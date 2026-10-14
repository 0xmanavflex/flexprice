import { useMemo } from 'react'
import { DEFAULT_CUSTOMER_QUERY, emptyInvoice } from '@fp/domain'
import { ApiError, useCreateInvoice, useCustomers } from '@fp/query'
import { LoadingRows, PageBody } from '@fp/ui/compositions'
import { InvoiceForm } from '@fp/ui/pages'

export interface InvoiceFormPageProps {
  /** Set when this page edits an existing invoice. Create leaves it out. */
  /** Create only: start with this customer chosen. */
  customerId?: string
  onCancel: () => void
  onDone: (invoiceId: string) => void
}

/**
 * Create an invoice on its own page — `POST /invoices`.
 *
 * Create only. This page used to serve `/invoices/:id/edit` as well, filling
 * the same form from an existing invoice and then refusing every save, because
 * `PUT /invoices/{id}` accepts none of the fields it collects: its whole body
 * is `invoice_pdf_url`, `due_date`, `metadata` and `apply_discount`. Editing
 * now lives in `InvoiceEditPage`, scoped to what the API will change.
 */
export function InvoiceFormPage({ customerId, onCancel, onDone }: InvoiceFormPageProps) {
  const create = useCreateInvoice()
  const customers = useCustomers({ ...DEFAULT_CUSTOMER_QUERY, page: 1, pageSize: 100 })
  const options = useMemo(
    () =>
      (customers.data?.customers ?? []).map((customer) => ({
        id: customer.id,
        name: customer.name,
        email: customer.email,
      })),
    [customers.data],
  )

  // A preset customer can only be shown once the list it is picked from has arrived.
  if (customerId && customers.isPending) {
    return (
      <PageBody>
        <div className="pt-4">
          <LoadingRows />
        </div>
      </PageBody>
    )
  }

  return (
    <InvoiceForm
      mode="create"
      customers={options}
      trail={[{ label: 'Invoices', onClick: onCancel }, { label: 'New invoice' }]}
      {...(customerId ? { defaultValue: { ...emptyInvoice(), customerId } } : {})}
      onCancel={onCancel}
      isSubmitting={create.isPending}
      submitError={toSubmitError(create.error)}
      onSubmit={(draft) =>
        create.mutate(draft, { onSuccess: (created) => onDone(created.id ?? '') })
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
