import { useState } from 'react'
import { CreditCardIcon, PlayIcon, Trash2Icon } from '@fp/ui/icons'
import { PaymentStatus, formatMoney, PAYMENT_STATUS_LABEL } from '@fp/domain'
import { ApiError, useDeletePayment, usePayment, useProcessPayment, serverReason } from '@fp/query'
import {
  CatalogDetailFrame,
  EntityLink,
  IntegrationMark,
  PaymentStatusBadge,
  Pill,
} from '@fp/ui/pages'
import { AppFailure, ConfirmDialog, EditableCard, LoadingRows, PageBody } from '@fp/ui/compositions'

export interface PaymentDetailPageProps {
  paymentId: string
  onBack: () => void
  onOpenInvoice: (invoiceId: string) => void
}

const formatDate = (value: Date | null) =>
  value
    ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(value)
    : '—'

/** The gateway's logo beside the ID chip, in place of a text pill. */
function GatewayMark({ gateway }: { gateway: string }) {
  const id = gateway.toLowerCase()
  const name = id.charAt(0).toUpperCase() + id.slice(1).replaceAll('_', ' ')
  return <IntegrationMark integration={{ id, name, providerType: id }} />
}

/**
 * One payment, with what the API lets you do to it: run it if it is still
 * pending, or delete it. The update endpoint overwrites lifecycle fields
 * (status, timestamps) by hand, which is a support tool rather than an edit
 * form, so the fields shown are the record and the two actions are the edit.
 */
export function PaymentDetailPage({ paymentId, onBack, onOpenInvoice }: PaymentDetailPageProps) {
  const payment = usePayment(paymentId)
  const process = useProcessPayment()
  const remove = useDeletePayment()
  const [dialog, setDialog] = useState<'process' | 'delete' | null>(null)

  if (payment.isPending) {
    return (
      <PageBody>
        <div className="pt-4">
          <LoadingRows />
        </div>
      </PageBody>
    )
  }

  if (payment.error || !payment.data) {
    return (
      <PageBody>
        <AppFailure
          title={payment.error ? 'This payment could not be loaded' : 'Payment not found'}
          detail="The rest of the console still works. Try again, or go back to the list."
          onRetry={payment.error ? () => void payment.refetch() : onBack}
        />
      </PageBody>
    )
  }

  const data = payment.data
  const canProcess = data.status === PaymentStatus.Pending
  const close = () => setDialog(null)

  return (
    <CatalogDetailFrame
      listLabel="Payments"
      onBack={onBack}
      icon={<CreditCardIcon />}
      title={`Payment ${formatMoney(data.amount)}`}
      badges={data.methodType ? <Pill>{data.methodType}</Pill> : undefined}
      id={data.id}
      {...(data.gateway ? { leading: <GatewayMark gateway={data.gateway} /> } : {})}
      menuLabel="Payment actions"
      menu={[
        ...(canProcess
          ? [
              {
                id: 'process',
                label: 'Process payment',
                icon: <PlayIcon className="text-muted-foreground" aria-hidden />,
                onSelect: () => setDialog('process'),
              },
            ]
          : []),
        {
          id: 'delete',
          label: 'Delete payment',
          icon: <Trash2Icon aria-hidden />,
          destructive: true,
          onSelect: () => setDialog('delete'),
        },
      ]}
      tabs={[
        {
          value: 'overview',
          label: 'Overview',
          content: (
            <EditableCard
              title="Payment"
              locked
              fields={[
                {
                  key: 'status',
                  label: 'Status',
                  value: PAYMENT_STATUS_LABEL[data.status],
                  display: <PaymentStatusBadge status={data.status} />,
                  readOnly: true,
                },
                { key: 'amount', label: 'Amount', value: formatMoney(data.amount), readOnly: true },
                ...(data.invoiceId
                  ? [
                      {
                        key: 'invoice',
                        label: 'Invoice',
                        value: data.invoiceNumber || '—',
                        display: (
                          <EntityLink
                            label={data.invoiceNumber || '—'}
                            onOpen={() => onOpenInvoice(data.invoiceId)}
                          />
                        ),
                        readOnly: true,
                      },
                    ]
                  : []),
                { key: 'method', label: 'Method', value: data.methodType || '—', readOnly: true },
                { key: 'gateway', label: 'Gateway', value: data.gateway || '—', readOnly: true },
                ...(data.gatewayPaymentId
                  ? [
                      {
                        key: 'gatewayId',
                        label: 'Gateway payment ID',
                        value: data.gatewayPaymentId,
                        display: <span className="font-mono text-xs">{data.gatewayPaymentId}</span>,
                        readOnly: true,
                      },
                    ]
                  : []),
                {
                  key: 'attempts',
                  label: 'Attempts',
                  value: String(data.attempts),
                  readOnly: true,
                },
                {
                  key: 'created',
                  label: 'Created',
                  value: formatDate(data.createdAt),
                  readOnly: true,
                },
                ...(data.succeededAt
                  ? [
                      {
                        key: 'succeeded',
                        label: 'Succeeded',
                        value: formatDate(data.succeededAt),
                        readOnly: true,
                      },
                    ]
                  : []),
                ...(data.failedAt
                  ? [
                      {
                        key: 'failed',
                        label: 'Failed',
                        value: formatDate(data.failedAt),
                        readOnly: true,
                      },
                    ]
                  : []),
                ...(data.errorMessage
                  ? [
                      {
                        key: 'error',
                        label: 'Failure reason',
                        value: data.errorMessage,
                        readOnly: true,
                      },
                    ]
                  : []),
                ...(data.refundedAt
                  ? [
                      {
                        key: 'refunded',
                        label: 'Refunded',
                        value: formatDate(data.refundedAt),
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
          ),
        },
      ]}
    >
      <ConfirmDialog
        open={dialog === 'process'}
        onOpenChange={(open) => (open ? undefined : close())}
        title="Process this payment?"
        description="This runs the payment through its gateway and updates the invoice."
        confirmLabel="Process payment"
        isPending={process.isPending}
        error={toError(process.error, 'process')}
        onConfirm={() => process.mutate(data.id, { onSuccess: close })}
      />
      <ConfirmDialog
        open={dialog === 'delete'}
        onOpenChange={(open) => (open ? undefined : close())}
        title="Delete this payment?"
        description="The payment record is removed. This cannot be undone."
        confirmLabel="Delete payment"
        destructive
        isPending={remove.isPending}
        error={toError(remove.error, 'delete')}
        onConfirm={() => remove.mutate(data.id, { onSuccess: onBack })}
      />
    </CatalogDetailFrame>
  )
}

function toError(error: unknown, verb: 'process' | 'delete'): string | null {
  if (!error) return null
  if (error instanceof ApiError && error.kind === 'forbidden')
    return serverReason(error) ?? `You do not have permission to ${verb} payments here.`
  if (error instanceof ApiError && error.kind === 'invalid')
    return error.message || 'Check the details and try again.'
  return `Could not ${verb} the payment. Try again.`
}
