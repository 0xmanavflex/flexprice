import { useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  ApiError,
  useAttemptInvoicePayment,
  useBillingEntities,
  useChargesByIds,
  useCustomer,
  useCustomerBillingEntity,
  useFinalizeInvoice,
  useInvoice,
  useInvoiceHostedUrl,
  useInvoicePdfLink,
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
  InvoiceStatus,
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
import { billFromFor } from './invoiceParties'
import { downloadInvoiceCsv } from './invoiceCsv'
import { openInvoicePdf } from './useInvoiceRowActions'

export interface InvoiceDetailPageProps {
  invoiceId: string
  onBack: () => void
  onEdit?: () => void
  onOpenCustomer: (customerId: string) => void
}

type Dialog = 'void' | 'payment-status' | 'recalculate' | null

/**
 * One invoice, read through `useInvoice`, with its issuer (`useTenant`),
 * payments and credit memos (filtered to this invoice). Every action: finalize,
 * record payment, recalculate, void, send, retry: runs here, outside the view.
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
  const pdfLink = useInvoicePdfLink()
  const activity = useActivityLog({ entityType: 'invoice', entityId: invoiceId })
  const mappings = useEntityIntegrationControls('invoice', invoiceId)
  // "Bill from" is the signed-in tenant: `GET /tenants/{id}` only answers for
  // one's own tenant, which is also the invoice's issuer. The invoice's own
  // `tenant_id` stands in until the user record has loaded.
  const me = useUserInfo()
  const tenant = useTenant(me.data?.tenantId || invoice.data?.tenantId || '')
  const entities = useBillingEntities()
  // Only a draft is issued from its customer's entity as it is now.
  const isDraft = invoice.data?.status === InvoiceStatus.Draft
  const customer = useCustomer(isDraft && entities.data ? (invoice.data?.customerId ?? '') : '')
  const customerEntity = useCustomerBillingEntity(customer.data)
  // "Bill to" is the invoice's own customer, which the invoice's expanded
  // customer is not when another customer is invoiced for the contract.
  const billTo = useCustomer(invoice.data?.customerId ?? '')
  // A line carries its amount, not its rate: the rate is on its price.
  const charges = useChargesByIds((invoice.data?.lines ?? []).map((line) => line.priceId ?? ''))
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
  // The invoice this page has already voided on the way to a replacement, so a
  // retry after the replacement failed does not try to void it again.
  const voidedFor = useRef<string | null>(null)
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
  const entityId = isDraft
    ? customerEntity?.id
    : data.sellerSnapshot?.billingEntityId || data.billingEntityId
  const entity = entities.data?.find((item) => item.id === entityId)
  // Replacing goes through a confirm: a finalized invoice is voided first, and
  // either way the new invoice is created by a workflow, not here and now.
  const confirmReplace = async () => {
    if (recalculation.kind === 'void-and-replace' && voidedFor.current !== data.id) {
      await voidInvoice.mutateAsync(data.id)
      voidedFor.current = data.id
    }
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
        integrationControls={
          mappings.controls
            ? {
                ...mappings.controls,
                syncing: mappings.push.isPending || mappings.pull.isPending,
                ...(mappings.pushProviders.length > 0
                  ? {
                      pushProviders: mappings.pushProviders,
                      onPush: () =>
                        mappings.push.mutate(undefined, {
                          onSuccess: () =>
                            toast.success(
                              `Pushing invoice to ${mappings.pushProviders.join(', ')}`,
                              {
                                description:
                                  'The provider record is created or updated in the background.',
                              },
                            ),
                          onError: (cause) =>
                            toast.error(
                              cause instanceof Error
                                ? cause.message
                                : 'Could not push this invoice.',
                            ),
                        }),
                    }
                  : {}),
                ...(mappings.pullProviders.length > 0
                  ? {
                      pullProviders: mappings.pullProviders,
                      onPull: () =>
                        mappings.pull.mutate(undefined, {
                          onSuccess: () =>
                            toast.success(
                              `Pulling invoice from ${mappings.pullProviders.join(', ')}`,
                              {
                                description:
                                  'Payments and status recorded there update here in the background.',
                              },
                            ),
                          onError: (cause) =>
                            toast.error(
                              cause instanceof Error
                                ? cause.message
                                : 'Could not pull this invoice.',
                            ),
                        }),
                    }
                  : {}),
              }
            : undefined
        }
        integrationsError={mappings.isError}
        onRetryIntegrations={() => {
          void mappings.refetch()
        }}
        invoice={toInvoiceDocument(data, {
          tenant: tenant.data,
          // Null leaves the tenant's own block: entities off, or issued before them.
          billFrom: billFromFor(data, customerEntity, null),
          hostedUrl: hostedUrl.data ?? null,
          billTo: billTo.data,
          charges: charges.data,
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
        // A draft has no PDF yet; anything issued gets one from the PDF route.
        {...(isDraft ? {} : { onDownload: () => openInvoicePdf(pdfLink(data.id)) })}
        onDownloadCsv={() => downloadInvoiceCsv(data)}
        onOpenCustomer={() => onOpenCustomer(data.customerId)}
        {...(entity
          ? {
              billingEntity: {
                name: entity.name,
                onOpen: () =>
                  void navigate({
                    to: '/settings/billing-entities/$entityId',
                    params: { entityId: entity.id },
                    search: {} as never,
                  }),
              },
            }
          : {})}
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
