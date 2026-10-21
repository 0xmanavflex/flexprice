import { useState } from 'react'
import { CreditNoteStatus } from '@fp/domain'
import {
  ApiError,
  useCreditNote,
  useInvoice,
  useFinalizeCreditNote,
  useVoidCreditNote,
  serverReason,
} from '@fp/query'
import { CreditNoteDetailView } from '@fp/ui/pages'
import { ConfirmDialog } from '@fp/ui/compositions'
import { toCreditNoteDocument } from './creditNoteDocument'
import { detailGate } from '../shared/detailGate'

export interface CreditNoteDetailPageProps {
  creditNoteId: string
  onBack: () => void
  onOpenInvoice: (invoiceId: string) => void
  onOpenCustomer: (customerId: string) => void
}

/**
 * One credit memo, with what the API lets you do to it: finalize a draft or
 * void it. There is no update endpoint, so a draft that is wrong is voided and
 * recreated rather than edited.
 */
export function CreditNoteDetailPage({
  creditNoteId,
  onBack,
  onOpenInvoice,
  onOpenCustomer,
}: CreditNoteDetailPageProps) {
  const note = useCreditNote(creditNoteId)
  const invoice = useInvoice(note.data?.invoiceId ?? '', { enabled: Boolean(note.data?.invoiceId) })
  const finalize = useFinalizeCreditNote()
  const voidNote = useVoidCreditNote()
  const [dialog, setDialog] = useState<'finalize' | 'void' | null>(null)

  if (!note.data) {
    return detailGate(note, {
      noun: 'this credit memo',
      listName: 'credit memos',
      onBack,
      recordPath: `/creditnotes/${encodeURIComponent(creditNoteId)}`,
    })
  }

  const data = note.data
  const isDraft = data.status === CreditNoteStatus.Draft
  const close = () => setDialog(null)

  return (
    <>
      <CreditNoteDetailView
        document={toCreditNoteDocument(data, invoice.data)}
        onBack={onBack}
        onOpenInvoice={onOpenInvoice}
        onOpenCustomer={onOpenCustomer}
        {...(isDraft ? { onFinalize: () => setDialog('finalize') } : {})}
        {...(data.status !== CreditNoteStatus.Voided ? { onVoid: () => setDialog('void') } : {})}
      />
      <ConfirmDialog
        open={dialog === 'finalize'}
        onOpenChange={(open) => (open ? undefined : close())}
        title="Finalize this credit memo?"
        description="It is applied to the invoice and can no longer be changed."
        confirmLabel="Finalize"
        isPending={finalize.isPending}
        error={toError(finalize.error, 'finalize')}
        onConfirm={() => finalize.mutate(data.id, { onSuccess: close })}
      />
      <ConfirmDialog
        open={dialog === 'void'}
        onOpenChange={(open) => (open ? undefined : close())}
        title="Void this credit memo?"
        description="A voided credit memo no longer reduces the invoice. This cannot be undone."
        confirmLabel="Void credit memo"
        destructive
        isPending={voidNote.isPending}
        error={toError(voidNote.error, 'void')}
        onConfirm={() => voidNote.mutate(data.id, { onSuccess: close })}
      />
    </>
  )
}

function toError(error: unknown, verb: 'finalize' | 'void'): string | null {
  if (!error) return null
  if (error instanceof ApiError && error.kind === 'forbidden')
    return serverReason(error) ?? `You do not have permission to ${verb} credit memos here.`
  if (error instanceof ApiError && error.kind === 'invalid')
    return error.message || 'Check the details and try again.'
  return `Could not ${verb} the credit memo. Try again.`
}
