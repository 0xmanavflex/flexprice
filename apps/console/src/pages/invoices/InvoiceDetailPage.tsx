import { useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  ApiError,
  useAttemptInvoicePayment,
  useFinalizeInvoice,
  useInvoice,
  useInvoiceHostedUrl,
  useEntityIntegrationControls,
  useInvoiceCreditNotes,
  useInvoicePayments,
  useRecalculateInvoice,
  useReplaceVoidedInvoice,
  useSendInvoice,
  useTenant,
  useUpdateInvoiceMetadata,
  useUpdateInvoicePaymentStatus,
  useUserInfo,
  useActivityLog,
  useVoidInvoice,
  serverReason,
} from '@fp/query'
import {
  PAYMENT_STATUS_LABEL,
  PaymentStatus,
  invoiceRecalculation,
  manualPaymentStatusBlocked,
  manualPaymentStatusChoices,
  moneyOr,
} from '@fp/domain'
import {
  InvoiceDetailView,
  PaymentStatusDialog,
  toast,
  type InvoicePendingAction,
} from '@fp/ui/pages'
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

type Dialog = 'void' | 'payment-status' | 'recalculate' | null

/**
 * One invoice, read through `useInvoice`, with its issuer (`useTenant`),
 * payments and credit memos (filtered to this invoice). Every action — finalize,
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
  const hostedUrl = useInvoiceHostedUrl(invoiceId)
  const activity = useActivityLog({ entityType: 'invoice', entityId: invoiceId })
  const mappings = useEntityIntegrationControls('invoice', invoiceId)
  // "Bill from" is the signed-in tenant: `GET /tenants/{id}` only answers for
  // one's own tenant, which is also the invoice's issuer. The invoice's own
  // `tenant_id` stands in until the user record has loaded.
  const me = useUserInfo()
  const tenant = useTenant(me.data?.tenantId || invoice.data?.tenantId || '')
  const payments = useInvoicePayments(invoiceId)
  const creditNotes = useInvoiceCreditNotes(invoiceId)
  const finalize = useFinalizeInvoice()
  const saveMetadata = useUpdateInvoiceMetadata()
  const setPaymentStatus = useUpdateInvoicePaymentStatus()
  const voidInvoice = useVoidInvoice()
  const attempt = useAttemptInvoicePayment()
  const recalculate = useRecalculateInvoice()
  const replace = useReplaceVoidedInvoice()
  const send = useSendInvoice()
  const [dialog, setDialog] = useState<Dialog>(null)
  const inFlight = useRef(false)
  const [pendingAction, setPendingAction] = useState<InvoicePendingAction | null>(null)

  if (!invoice.data) {
    return detailGate(invoice, {
      noun: 'this invoice',
      listName: 'invoices',
      onBack,
      recordPath: `/invoices/${encodeURIComponent(invoiceId)}`,
    })
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

  const recalculation = invoiceRecalculation(data)
  // Replacing goes through a confirm: a finalized invoice is voided first, and
  // either way the new invoice is created by a workflow, not here and now.
  const confirmReplace = async () => {
    if (recalculation.kind === 'void-and-replace') await voidInvoice.mutateAsync(data.id)
    await replace.mutateAsync(data.id)
    setDialog(null)
    toast('Recalculation started', {
      description: 'The replacement invoice appears in Invoices once it is ready.',
    })
  }

  return (
    <>
      <InvoiceDetailView
        integrationLinks={mappings.data}
        integrationControls={mappings.controls}
        integrationsError={mappings.isError}
        onRetryIntegrations={() => {
          void mappings.refetch()
        }}
        invoice={toInvoiceDocument(data, {
          tenant: tenant.data,
          hostedUrl: hostedUrl.data ?? null,
          payments: payments.data,
          creditNotes: creditNotes.data,
          activity: activity.data ?? [],
          ...(activity.isPending
            ? { activityEmptyText: 'Loading activity…' }
            : activity.isError
              ? { activityEmptyText: 'Could not load activity.' }
              : {}),
          ...(activity.isAwaiting ? { activityAwaiting: true } : {}),
        })}
        payments={subTab(payments, 'payments')}
        creditNotes={subTab(creditNotes, 'credit memos')}
        pendingAction={pendingAction}
        onBack={onBack}
        {...(onEdit ? { onEdit } : {})}
        onFinalize={() => run('finalize', finalize, 'Invoice finalized', 'finalize the invoice')}
        onRecordPayment={() => void navigate({ to: '/payments/new', search: { invoice: data.id } })}
        recalculateBlocked={recalculation.kind === 'unavailable' ? recalculation.reason : null}
        onRecalculate={() =>
          recalculation.kind === 'in-place'
            ? run('recalculate', recalculate, 'Invoice recalculated', 'recalculate the invoice')
            : setDialog('recalculate')
        }
        onVoid={() => setDialog('void')}
        onUpdatePaymentStatus={() => setDialog('payment-status')}
        paymentStatusBlocked={manualPaymentStatusBlocked({
          status: data.status,
          paymentStatus: data.paymentStatus,
          succeededPayments: (payments.data ?? []).filter(
            (payment) => payment.status === PaymentStatus.Succeeded,
          ).length,
        })}
        onSaveMetadata={(metadata) => saveMetadata.mutateAsync({ id: data.id, metadata })}
        onIssueCreditNote={() =>
          void navigate({ to: '/credit-memos/new', search: { invoice: data.id } })
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
                  to: '/contracts/$subscriptionId',
                  params: { subscriptionId: data.subscriptionId ?? '' },
                }),
            }
          : {})}
        onOpenPayment={(paymentId) =>
          void navigate({ to: '/payments/$paymentId', params: { paymentId } })
        }
        onOpenCreditNote={(creditNoteId) =>
          void navigate({ to: '/credit-memos/$creditNoteId', params: { creditNoteId } })
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
        open={dialog === 'recalculate'}
        onOpenChange={(open) => {
          if (!open) {
            voidInvoice.reset()
            replace.reset()
          }
          setDialog(open ? 'recalculate' : null)
        }}
        title="Recalculate this invoice?"
        description={
          recalculation.kind === 'void-and-replace'
            ? 'This invoice will be voided and a fresh one for the same period queued for calculation. The voided invoice can no longer be collected.'
            : 'A fresh invoice for the same period will be queued for calculation. This voided invoice stays as it is.'
        }
        confirmLabel={
          recalculation.kind === 'void-and-replace' ? 'Void and recalculate' : 'Recalculate'
        }
        destructive={recalculation.kind === 'void-and-replace'}
        isPending={voidInvoice.isPending || replace.isPending}
        error={
          voidInvoice.error
            ? failure(voidInvoice.error)
            : replace.error
              ? failure(replace.error)
              : null
        }
        onConfirm={() => void confirmReplace().catch(() => undefined)}
      />
      <PaymentStatusDialog
        open={dialog === 'payment-status'}
        onOpenChange={(open) => {
          if (!open) setPaymentStatus.reset()
          setDialog(open ? 'payment-status' : null)
        }}
        current={data.paymentStatus}
        choices={manualPaymentStatusChoices(data.paymentStatus)}
        amountDue={data.amountDue}
        amountPaid={moneyOr(data.amountPaid, data.currency)}
        amountRemaining={data.amountRemaining}
        isPending={setPaymentStatus.isPending}
        error={setPaymentStatus.error ? failure(setPaymentStatus.error) : null}
        onSubmit={(change) =>
          setPaymentStatus.mutate(
            { id: data.id, ...change },
            {
              onSuccess: () => {
                setDialog(null)
                toast(`Payment status set to ${PAYMENT_STATUS_LABEL[change.status].toLowerCase()}`)
              },
            },
          )
        }
      />
    </>
  )
}

function failure(error: unknown, verb = 'change the invoice'): string {
  if (error instanceof ApiError) {
    switch (error.kind) {
      case 'forbidden':
        return serverReason(error) ?? `Your role does not include permission to ${verb}.`
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
        return (
          serverReason(error) ?? `Could not ${verb}: Flexprice had a problem. Try again shortly.`
        )
    }
  }
  return `Could not ${verb}. Try again.`
}
