import { useMemo, useState } from 'react'
import { DEFAULT_INVOICE_QUERY } from '@fp/domain'
import { useCreateCreditNote, useInvoice, useInvoices } from '@fp/query'
import { CreditNoteForm } from '@fp/ui/pages'

export interface CreditNoteFormPageProps {
  /** Start with this invoice chosen, e.g. from the invoice's "Issue credit memo". */
  invoiceId?: string
  onCancel: () => void
  onDone: (creditNoteId: string) => void
}

/** Credit part of an invoice on its own page: `/credit-memos/new`. */
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
      trail={[{ label: 'Credit memos', onClick: onCancel }, { label: 'New credit memo' }]}
      onCancel={onCancel}
      isSubmitting={create.isPending}
      // The API's refusal is a toast (MutationToasts); validation stays in the form.
      submitError={null}
      onSubmit={(draft) => create.mutate(draft, { onSuccess: (note) => onDone(note.id ?? '') })}
    />
  )
}
