import { useRef, useState } from 'react'
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
  useUpdateInvoiceMetadata,
  useUserInfo,
  useVoidInvoice,
} from '@fp/query'
import { InvoiceDetailView, Toaster, toast, type InvoicePendingAction } from '@fp/ui/pages'
import { ConfirmDialog } from '@fp/ui/compositions'
import { detailGate } from '../shared/detailGate'
import { subTab } from '../shared/subTab'
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
  const saveMetadata = useUpdateInvoiceMetadata()
  const voidInvoice = useVoidInvoice()
  const attempt = useAttemptInvoicePayment()
  const recalculate = useRecalculateInvoice()
  const send = useSendInvoice()
  const recordPayment = useRecordPayment()
  const [dialog, setDialog] = useState<Dialog>(null)
  const inFlight = useRef(false)
  const [pendingAction, setPendingAction] = useState<InvoicePendingAction | null>(null)

  if (!invoice.data) {
    return detailGate(invoice, { noun: 'this invoice', listName: 'invoices', onBack })
  }

  const data = invoice.data

  // One action at a time. The ref closes the gap between a click and the
  // re-render that disables the control, so a double click cannot send twice.
  // No optimistic update: the invoice refetches when the mutation settles.
  const run = (kind: InvoicePendingAction, action: typeof finalize, done: string, verb: string) => {
    if (inFlight.current) return
    inFlight.current = true
    setPendingAction(kind)
    action.mutate(data.id, {
      onSuccess: () => toast(done),
      onError: (error) => toast(failure(error, verb)),
      onSettled: () => {
        inFlight.current = false
        setPendingAction(null)
      },
    })
  }
  const amountDue = data.amountRemaining

  return (
    <>
      <InvoiceDetailView
        invoice={toInvoiceDocument(data, {
          tenant: tenant.data,
          payments: payments.data,
          creditNotes: creditNotes.data,
        })}
        payments={subTab(payments, 'payments')}
        creditNotes={subTab(creditNotes, 'credit notes')}
        pendingAction={pendingAction}
        onBack={onBack}
        {...(onEdit ? { onEdit } : {})}
        onFinalize={() => run('finalize', finalize, 'Invoice finalized', 'finalize the invoice')}
        onRecordPayment={() => setDialog('record-payment')}
        onRecalculate={() =>
          run('recalculate', recalculate, 'Invoice recalculated', 'recalculate the invoice')
        }
        onVoid={() => setDialog('void')}
        onSaveMetadata={(metadata) => saveMetadata.mutateAsync({ id: data.id, metadata })}
        onIssueCreditNote={() =>
          void navigate({ to: '/credit-notes/new', search: { invoice: data.id } })
        }
        onSend={() => run('send', send, 'Invoice sent to the customer', 'send the invoice')}
        onRetryPayment={() =>
          run('retry-payment', attempt, 'Payment attempt started', 'retry the payment')
        }
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
        onOpenChange={(open) => {
          if (!open) voidInvoice.reset()
          setDialog(open ? 'void' : null)
        }}
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
        onOpenChange={(open) => {
          if (!open) recordPayment.reset()
          setDialog(open ? 'record-payment' : null)
        }}
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

function failure(error: unknown, verb = 'change the invoice'): string {
  if (error instanceof ApiError) {
    switch (error.kind) {
      case 'forbidden':
        return `Your role does not include permission to ${verb}.`
      case 'unauthorized':
        return 'Your session has expired. Sign in again, then retry.'
      case 'not_found':
        return `Could not ${verb}: this invoice no longer exists.`
      case 'invalid':
        return error.message ? `Could not ${verb}: ${error.message}` : `Could not ${verb}.`
      case 'network':
        return `Could not ${verb}: Flexprice was unreachable. Nothing was changed; try again.`
      case 'timeout':
        return `Could not ${verb}: the request timed out. Check the invoice before trying again.`
      case 'rate_limited':
        return `Could not ${verb}: too many requests. Wait a moment and try again.`
      default:
        return `Could not ${verb}: Flexprice had a problem. Try again shortly.`
    }
  }
  return `Could not ${verb}. Try again.`
}
