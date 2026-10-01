import { useMemo, useState } from 'react'
import { DEFAULT_CUSTOMER_QUERY, type CreateInvoice, type InvoiceDetail } from '@fp/domain'
import { ApiError, useCreateInvoice, useCustomers, useInvoice } from '@fp/query'
import { AppFailure, LoadingRows, PageBody } from '@fp/ui/compositions'
import { InvoiceForm } from '@fp/ui/pages'

export interface InvoiceFormPageProps {
  /** Set when this page edits an existing invoice. Create leaves it out. */
  invoiceId?: string
  onCancel: () => void
  onDone: (invoiceId: string) => void
}

/**
 * Create or edit an invoice on its own page.
 *
 * Create is `/invoices/new` and saves through `POST /invoices`. Edit is
 * `/invoices/:id/edit` and uses the same Form 3 layout, filled from the
 * invoice. There is no update call on the API, so edit explains that saving
 * changes is not available yet.
 */
export function InvoiceFormPage({ invoiceId, onCancel, onDone }: InvoiceFormPageProps) {
  const editing = Boolean(invoiceId)
  const create = useCreateInvoice()
  const invoice = useInvoice(invoiceId ?? '', { enabled: editing })
  const customers = useCustomers({ ...DEFAULT_CUSTOMER_QUERY, page: 1, pageSize: 100 })
  const [editNotice, setEditNotice] = useState<string | null>(null)
  const options = useMemo(
    () =>
      (customers.data?.customers ?? []).map((customer) => ({
        id: customer.id,
        name: customer.name,
        email: customer.email,
      })),
    [customers.data],
  )

  if (editing && invoice.isPending) {
    return (
      <PageBody>
        <div className="pt-4">
          <LoadingRows />
        </div>
      </PageBody>
    )
  }

  if (editing && (invoice.error || !invoice.data)) {
    return (
      <PageBody>
        <AppFailure
          title={invoice.error ? 'This invoice could not be loaded' : 'Invoice not found'}
          detail="The rest of the console still works. Try again, or go back."
          onRetry={invoice.error ? () => void invoice.refetch() : onCancel}
        />
      </PageBody>
    )
  }

  const existing = invoice.data

  return (
    <InvoiceForm
      key={existing?.id ?? 'new'}
      mode={editing ? 'edit' : 'create'}
      customers={options}
      trail={[
        { label: 'Invoices', onClick: onCancel },
        { label: editing ? 'Edit invoice' : 'New invoice' },
      ]}
      {...(existing
        ? { defaultValue: toDraft(existing), invoiceNumber: existing.number }
        : {})}
      onCancel={onCancel}
      isSubmitting={create.isPending}
      submitError={editing ? editNotice : toSubmitError(create.error)}
      onSubmit={(draft) => {
        if (editing) {
          setEditNotice('Saving changes to an invoice is not available yet.')
          return
        }
        create.mutate(draft, { onSuccess: (created) => onDone(created.id ?? '') })
      }}
    />
  )
}

function toDraft(invoice: InvoiceDetail): CreateInvoice {
  return {
    customerId: invoice.customerId,
    currency: invoice.currency,
    description: invoice.description,
    dueDate: invoice.dueDate ? day(invoice.dueDate) : '',
    total: invoice.total.amount,
    finalize: false,
    lines:
      invoice.lines.length > 0
        ? invoice.lines.map((line) => ({
            description: line.description,
            quantity: line.quantity || '1',
            amount: line.amount,
          }))
        : [{ description: '', quantity: '1', amount: '' }],
  }
}

function day(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const dateOfMonth = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${dateOfMonth}`
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
