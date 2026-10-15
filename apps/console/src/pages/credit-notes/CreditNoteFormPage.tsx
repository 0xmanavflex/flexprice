import { useMemo, useState } from 'react'
import { DEFAULT_INVOICE_QUERY } from '@fp/domain'
import { ApiError, useCreateCreditNote, useInvoice, useInvoices, serverReason } from '@fp/query'
import { CreditNoteForm } from '@fp/ui/pages'

export interface CreditNoteFormPageProps {
  /** Start with this invoice chosen, e.g. from the invoice's "Issue credit note". */
  invoiceId?: string
  onCancel: () => void
  onDone: (creditNoteId: string) => void
}

/** Credit part of an invoice on its own page: `/credit-notes/new`. */
export function CreditNoteFormPage({
  invoiceId: startInvoiceId,
  onCancel,
  onDone,
}: CreditNoteFormPageProps) {
  const create = useCreateCreditNote()
  const invoices = useInvoices({ ...DEFAULT_INVOICE_QUERY, page: 1, pageSize: 100 })
  const [invoiceId, setInvoiceId] = useState(startInvoiceId ?? '')
  const chosen = useInvoice(invoiceId, { enabled: invoiceId !== '' })

  const options = useMemo(
    () =>
      (invoices.data?.invoices ?? []).map((invoice) => ({
        value: invoice.id,
        label: `${invoice.number || '—'} · ${invoice.customerName}`,
      })),
    [invoices.data],
  )
  const lines = useMemo(
    () =>
      invoiceId && chosen.data
        ? chosen.data.lines.map((line) => ({
            id: line.id,
            description: line.description,
            amount: line.amount,
          }))
        : [],
    [invoiceId, chosen.data],
  )

  return (
    <CreditNoteForm
      invoices={options}
      invoiceLines={lines}
      linesLoading={invoiceId !== '' && chosen.isPending}
      onInvoiceChange={setInvoiceId}
      {...(startInvoiceId ? { defaultInvoiceId: startInvoiceId } : {})}
      trail={[{ label: 'Credit notes', onClick: onCancel }, { label: 'New credit note' }]}
      onCancel={onCancel}
      isSubmitting={create.isPending}
      submitError={toSubmitError(create.error)}
      onSubmit={(draft) => create.mutate(draft, { onSuccess: (note) => onDone(note.id ?? '') })}
    />
  )
}

function toSubmitError(error: unknown): string | null {
  if (!error) return null
  if (error instanceof ApiError) {
    if (error.kind === 'invalid') return error.message || 'Check the details and try again.'
    if (error.kind === 'forbidden')
      return serverReason(error) ?? 'You do not have permission to create credit notes here.'
    if (error.kind === 'network') return 'Could not reach Flexprice. Check your connection.'
  }
  return 'Could not create the credit note. Try again.'
}
