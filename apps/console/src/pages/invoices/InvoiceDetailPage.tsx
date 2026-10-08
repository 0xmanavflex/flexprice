import { useState } from 'react'
import { formatMoney } from '@fp/domain'
import { useNavigate } from '@tanstack/react-router'
import {
  ApiError,
  useAttemptInvoicePayment,
  useFinalizeInvoice,
  useInvoice,
  useInvoiceCreditNotes,
  useInvoicePayments,
  useRecalculateInvoice,
  useRecordPayment,
  useSendInvoice,
  useTenant,
  useUserInfo,
  useVoidInvoice,
} from '@fp/query'
import { InvoiceDetailView, Toaster, toast } from '@fp/ui/pages'
import { AppFailure, ConfirmDialog, LoadingRows, PageBody } from '@fp/ui/compositions'
import { toInvoiceDocument } from './invoiceDocumentAdapter'

export interface InvoiceDetailPageProps {
  invoiceId: string
  onBack: () => void
  onEdit?: () => void
  onOpenCustomer: (customerId: string) => void
}

type Dialog = 'void' | 'record-payment' | null

/**
 * One invoice, read through `useInvoice`, with its issuer (`useTenant`),
 * payments and credit notes (filtered to this invoice). Every action — finalize,
 * record payment, recalculate, void, send, retry — runs here, outside the view.
 */
export function InvoiceDetailPage({
  invoiceId,
  onBack,
  onEdit,
  onOpenCustomer,
}: InvoiceDetailPageProps) {
  const navigate = useNavigate()
  const invoice = useInvoice(invoiceId)
  // "Bill from" is the signed-in tenant: `GET /tenants/{id}` only answers for
  // one's own tenant, which is also the invoice's issuer. The invoice's own
  // `tenant_id` stands in until the user record has loaded.
  const me = useUserInfo()
  const tenant = useTenant(me.data?.tenantId || invoice.data?.tenantId || '')
  const payments = useInvoicePayments(invoiceId)
  const creditNotes = useInvoiceCreditNotes(invoiceId)
  const finalize = useFinalizeInvoice()
  const voidInvoice = useVoidInvoice()
  const attempt = useAttemptInvoicePayment()
  const recalculate = useRecalculateInvoice()
  const send = useSendInvoice()
  const recordPayment = useRecordPayment()
  const [dialog, setDialog] = useState<Dialog>(null)

  if (invoice.isPending) {
    return (
      <PageBody>
        <div className="pt-4">
          <LoadingRows />
        </div>
      </PageBody>
    )
  }

  if (invoice.error || !invoice.data) {
    return (
      <PageBody>
        <AppFailure
          title={invoice.error ? 'This invoice could not be loaded' : 'Invoice not found'}
          detail="The rest of the console still works. Try again, or go back to the list."
          onRetry={invoice.error ? () => void invoice.refetch() : onBack}
        />
      </PageBody>
    )
  }

  const data = invoice.data
  const run = (action: typeof finalize, done: string) =>
    action.mutate(data.id, {
      onSuccess: () => toast(done),
      onError: (error) => toast(failure(error)),
    })
  const amountDue = data.amountRemaining

  return (
    <>
      <InvoiceDetailView
        invoice={toInvoiceDocument(data, {
          tenant: tenant.data,
          payments: payments.data,
          creditNotes: creditNotes.data,
        })}
        paymentsLoading={payments.isLoading}
        creditNotesLoading={creditNotes.isLoading}
        onBack={onBack}
        {...(onEdit ? { onEdit } : {})}
        isFinalizing={finalize.isPending}
        onFinalize={() => run(finalize, 'Invoice finalized')}
        onRecordPayment={() => setDialog('record-payment')}
        onRecalculate={() => run(recalculate, 'Invoice recalculated')}
        onVoid={() => setDialog('void')}
        onIssueCreditNote={() => void navigate({ to: '/credit-notes/new' })}
        onSend={() => run(send, 'Invoice sent to the customer')}
        onRetryPayment={() => run(attempt, 'Payment attempt started')}
        {...(data.invoicePdfUrl
          ? { onDownload: () => window.open(data.invoicePdfUrl ?? '', '_blank', 'noopener') }
          : {})}
        onOpenCustomer={() => onOpenCustomer(data.customerId)}
        {...(data.subscriptionId
          ? {
              onOpenSubscription: () =>
                void navigate({
                  to: '/subscriptions/$subscriptionId',
                  params: { subscriptionId: data.subscriptionId ?? '' },
                }),
            }
          : {})}
        onOpenPayment={(paymentId) =>
          void navigate({ to: '/payments/$paymentId', params: { paymentId } })
        }
        onOpenCreditNote={(creditNoteId) =>
          void navigate({ to: '/credit-notes/$creditNoteId', params: { creditNoteId } })
        }
      />
      <ConfirmDialog
        open={dialog === 'void'}
        onOpenChange={(open) => setDialog(open ? 'void' : null)}
        title="Void this invoice?"
        description="A voided invoice can no longer be collected. This cannot be undone."
        confirmLabel="Void invoice"
        destructive
        isPending={voidInvoice.isPending}
        error={voidInvoice.error ? failure(voidInvoice.error) : null}
        onConfirm={() => voidInvoice.mutate(data.id, { onSuccess: () => setDialog(null) })}
      />
      <ConfirmDialog
        open={dialog === 'record-payment'}
        onOpenChange={(open) => setDialog(open ? 'record-payment' : null)}
        title="Record a payment?"
        description={`Records an offline payment of ${formatMoney(amountDue)} against this invoice, settling the amount due.`}
        confirmLabel="Record payment"
        isPending={recordPayment.isPending}
        error={recordPayment.error ? failure(recordPayment.error) : null}
        onConfirm={() =>
          recordPayment.mutate(
            {
              invoiceId: data.id,
              currency: amountDue.currency || data.currency,
              amount: amountDue.amount,
              methodType: 'OFFLINE',
              processNow: true,
            },
            {
              onSuccess: () => {
                setDialog(null)
                toast('Payment recorded')
              },
            },
          )
        }
      />
      <Toaster />
    </>
  )
}

function failure(error: unknown): string {
  if (error instanceof ApiError && error.kind === 'forbidden')
    return 'You do not have permission to change invoices here.'
  if (error instanceof ApiError && error.kind === 'invalid')
    return error.message || 'The invoice could not be changed.'
  return 'Could not complete that. Try again.'
}
