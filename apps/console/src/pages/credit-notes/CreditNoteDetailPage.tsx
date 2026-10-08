import { useState } from 'react'
import { FileMinusIcon } from 'lucide-react'
import {
  CREDIT_NOTE_REASON_LABEL,
  CREDIT_NOTE_STATUS_LABEL,
  CREDIT_NOTE_TYPE_LABEL,
  CreditNoteStatus,
  type CreditNoteReason,
  formatMoney,
} from '@fp/domain'
import { ApiError, useCreditNote, useFinalizeCreditNote, useVoidCreditNote } from '@fp/query'
import { CatalogDetailFrame, EntityLink, Pill, Status } from '@fp/ui/pages'
import { AppFailure, ConfirmDialog, EditableCard, LoadingRows, PageBody } from '@fp/ui/compositions'

export interface CreditNoteDetailPageProps {
  creditNoteId: string
  onBack: () => void
  onOpenInvoice: (invoiceId: string) => void
  onOpenCustomer: (customerId: string) => void
}

const formatDate = (value: Date | null) =>
  value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(value) : '—'

/**
 * One credit note, with what the API lets you do to it: finalize a draft or
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
  const finalize = useFinalizeCreditNote()
  const voidNote = useVoidCreditNote()
  const [dialog, setDialog] = useState<'finalize' | 'void' | null>(null)

  if (note.isPending) {
    return (
      <PageBody>
        <div className="pt-4">
          <LoadingRows />
        </div>
      </PageBody>
    )
  }

  if (note.error || !note.data) {
    return (
      <PageBody>
        <AppFailure
          title={note.error ? 'This credit note could not be loaded' : 'Credit note not found'}
          detail="The rest of the console still works. Try again, or go back to the list."
          onRetry={note.error ? () => void note.refetch() : onBack}
        />
      </PageBody>
    )
  }

  const data = note.data
  const isDraft = data.status === CreditNoteStatus.Draft
  const close = () => setDialog(null)

  return (
    <CatalogDetailFrame
      listLabel="Credit notes"
      onBack={onBack}
      icon={<FileMinusIcon />}
      title={`Credit note ${data.number}`}
      badges={
        <>
          <Pill>{formatMoney(data.amount)}</Pill>
          <Status value={CREDIT_NOTE_STATUS_LABEL[data.status]} />
        </>
      }
      id={data.id}
      {...(isDraft ? { primary: { label: 'Finalize', onClick: () => setDialog('finalize') } } : {})}
      menuLabel="Credit note actions"
      menu={[
        {
          id: 'void',
          label: 'Void credit note',
          destructive: true,
          disabled: data.status === CreditNoteStatus.Voided,
          onSelect: () => setDialog('void'),
        },
      ]}
      tabs={[
        {
          value: 'overview',
          label: 'Overview',
          content: (
            <div className="flex flex-col gap-6">
              <EditableCard
                title="Credit note"
                locked
                fields={[
                  {
                    key: 'status',
                    label: 'Status',
                    value: CREDIT_NOTE_STATUS_LABEL[data.status],
                    readOnly: true,
                  },
                  {
                    key: 'type',
                    label: 'Type',
                    value: data.type ? CREDIT_NOTE_TYPE_LABEL[data.type] : '—',
                    readOnly: true,
                  },
                  { key: 'total', label: 'Total', value: formatMoney(data.amount), readOnly: true },
                  {
                    key: 'reason',
                    label: 'Reason',
                    value:
                      CREDIT_NOTE_REASON_LABEL[data.reason as CreditNoteReason] ??
                      (data.reason || '—'),
                    readOnly: true,
                  },
                  ...(data.invoiceId
                    ? [
                        {
                          key: 'invoice',
                          label: 'Invoice',
                          value: data.invoiceNumber,
                          display: (
                            <EntityLink
                              label={data.invoiceNumber}
                              onOpen={() => onOpenInvoice(data.invoiceId)}
                            />
                          ),
                          readOnly: true,
                        },
                      ]
                    : []),
                  ...(data.customerId
                    ? [
                        {
                          key: 'customer',
                          label: 'Customer',
                          value: data.customerName || data.customerId,
                          display: (
                            <EntityLink
                              label={data.customerName || data.customerId}
                              onOpen={() => onOpenCustomer(data.customerId)}
                            />
                          ),
                          readOnly: true,
                        },
                      ]
                    : []),
                  ...(data.memo
                    ? [{ key: 'memo', label: 'Memo', value: data.memo, readOnly: true }]
                    : []),
                  {
                    key: 'created',
                    label: 'Created',
                    value: formatDate(data.createdAt),
                    readOnly: true,
                  },
                  ...(data.finalizedAt
                    ? [
                        {
                          key: 'finalized',
                          label: 'Finalized',
                          value: formatDate(data.finalizedAt),
                          readOnly: true,
                        },
                      ]
                    : []),
                  ...(data.voidedAt
                    ? [
                        {
                          key: 'voided',
                          label: 'Voided',
                          value: formatDate(data.voidedAt),
                          readOnly: true,
                        },
                      ]
                    : []),
                ]}
                onSave={async () => undefined}
              />
              <EditableCard
                title="Credited lines"
                locked
                fields={
                  data.lines.length === 0
                    ? [{ key: 'none', label: 'Lines', value: 'No lines', readOnly: true }]
                    : data.lines.map((line) => ({
                        key: line.id,
                        label: line.description,
                        value: formatMoney(line.amount),
                        readOnly: true,
                      }))
                }
                onSave={async () => undefined}
              />
            </div>
          ),
        },
      ]}
    >
      <ConfirmDialog
        open={dialog === 'finalize'}
        onOpenChange={(open) => (open ? undefined : close())}
        title="Finalize this credit note?"
        description="It is applied to the invoice and can no longer be changed."
        confirmLabel="Finalize"
        isPending={finalize.isPending}
        error={toError(finalize.error, 'finalize')}
        onConfirm={() => finalize.mutate(data.id, { onSuccess: close })}
      />
      <ConfirmDialog
        open={dialog === 'void'}
        onOpenChange={(open) => (open ? undefined : close())}
        title="Void this credit note?"
        description="A voided credit note no longer reduces the invoice. This cannot be undone."
        confirmLabel="Void credit note"
        destructive
        isPending={voidNote.isPending}
        error={toError(voidNote.error, 'void')}
        onConfirm={() => voidNote.mutate(data.id, { onSuccess: close })}
      />
    </CatalogDetailFrame>
  )
}

function toError(error: unknown, verb: 'finalize' | 'void'): string | null {
  if (!error) return null
  if (error instanceof ApiError && error.kind === 'forbidden')
    return `You do not have permission to ${verb} credit notes here.`
  if (error instanceof ApiError && error.kind === 'invalid')
    return error.message || 'Check the details and try again.'
  return `Could not ${verb} the credit note. Try again.`
}
