import { useMemo, useState } from 'react'
import { DEFAULT_INVOICE_QUERY, PAYMENT_LINK_GATEWAYS, emptyPayment } from '@fp/domain'
import {
  useConnections,
  useCustomerWallets,
  useInvoice,
  useInvoices,
  useRecordPayment,
} from '@fp/query'
import { PaymentForm, toast } from '@fp/ui/pages'
import { ConfirmDialog, LoadingRows, PageBody } from '@fp/ui/compositions'

export interface PaymentFormPageProps {
  /** Start with this invoice chosen and its amount due filled in. */
  invoiceId?: string
  onCancel: () => void
  onDone: (paymentId: string) => void
}

/** Record a payment against an invoice on its own page: `/payments/new`. */
export function PaymentFormPage({ invoiceId, onCancel, onDone }: PaymentFormPageProps) {
  const record = useRecordPayment()
  // Where a payment link can be raised: the connected providers V1 offers.
  const connections = useConnections()
  const gateways = useMemo(
    () =>
      (connections.data ?? [])
        .filter(
          (integration) =>
            integration.connections.length > 0 &&
            (PAYMENT_LINK_GATEWAYS as readonly string[]).includes(integration.providerType),
        )
        .map((integration) => ({ value: integration.providerType, label: integration.name })),
    [connections.data],
  )
  // The link a payment-link payment came back with, shown before leaving the page.
  const [link, setLink] = useState<{ url: string; paymentId: string } | null>(null)
  const invoices = useInvoices({ ...DEFAULT_INVOICE_QUERY, page: 1, pageSize: 100 })
  const chosen = useInvoice(invoiceId ?? '', { enabled: Boolean(invoiceId) })
  // "Credits" pays from a wallet of the chosen invoice's customer, in its currency.
  const [pickedInvoiceId, setPickedInvoiceId] = useState(invoiceId ?? '')
  const picked =
    (invoices.data?.invoices ?? []).find((invoice) => invoice.id === pickedInvoiceId) ??
    (chosen.data?.id === pickedInvoiceId ? chosen.data : undefined)
  const walletsQuery = useCustomerWallets(picked?.customerId ?? '')
  const wallets = useMemo(
    () =>
      picked && walletsQuery.data
        ? walletsQuery.data
            .filter(
              (wallet) =>
                wallet.status === 'active' &&
                wallet.currency.toUpperCase() === picked.total.currency.toUpperCase(),
            )
            .map((wallet) => ({
              value: wallet.id,
              label: `${wallet.description || wallet.currency.toUpperCase()} wallet · ${wallet.creditBalance} credits`,
            }))
        : undefined,
    [picked, walletsQuery.data],
  )
  const options = useMemo(
    () =>
      (invoices.data?.invoices ?? []).map((invoice) => ({
        value: invoice.id,
        label: `${invoice.number || '—'} · ${invoice.customerName}`,
      })),
    [invoices.data],
  )

  const invoiceCurrencies = useMemo(
    () =>
      Object.fromEntries(
        (invoices.data?.invoices ?? []).map((invoice) => [invoice.id, invoice.total.currency]),
      ),
    [invoices.data],
  )

  // A preset invoice waits for its record, so the amount due can be filled in.
  if (invoiceId && chosen.isPending) {
    return (
      <PageBody>
        <div className="pt-4">
          <LoadingRows />
        </div>
      </PageBody>
    )
  }
  const preset = chosen.data
  // The preset invoice is offered even when it is outside the first page of the list.
  const offered =
    preset && !options.some((option) => option.value === preset.id)
      ? [
          { value: preset.id, label: `${preset.number || '—'} · ${preset.customerName}` },
          ...options,
        ]
      : options

  return (
    <>
      <PaymentForm
        key={preset?.id ?? 'new'}
        invoices={offered}
        {...(preset
          ? {
              defaultValue: {
                ...emptyPayment(),
                invoiceId: preset.id,
                currency: preset.currency.toUpperCase(),
                amount: preset.amountRemaining.amount,
              },
            }
          : {})}
        trail={[{ label: 'Payments', onClick: onCancel }, { label: 'Record payment' }]}
        wallets={wallets}
        gateways={gateways}
        invoiceCurrencies={invoiceCurrencies}
        onInvoiceChange={setPickedInvoiceId}
        onCancel={onCancel}
        isSubmitting={record.isPending}
        // The API's refusal is a toast (MutationToasts); validation stays in the form.
        submitError={null}
        onSubmit={(draft) =>
          record.mutate(
            draft.methodType === 'PAYMENT_LINK'
              ? { ...draft, returnUrl: `${window.location.origin}/invoices/${draft.invoiceId}` }
              : draft,
            {
              onSuccess: (payment) =>
                payment.paymentUrl
                  ? setLink({ url: payment.paymentUrl, paymentId: payment.id ?? '' })
                  : onDone(payment.id ?? ''),
            },
          )
        }
      />
      <ConfirmDialog
        open={link !== null}
        onOpenChange={(open) => (open || !link ? undefined : onDone(link.paymentId))}
        title="Payment link ready"
        description={
          <>
            Send this link to the customer. The invoice is paid once they complete it.{' '}
            <a
              href={link?.url ?? '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground font-mono break-all underline"
            >
              {link?.url}
            </a>
          </>
        }
        confirmLabel="Copy link"
        cancelLabel="Done"
        onConfirm={() =>
          void navigator.clipboard
            ?.writeText(link?.url ?? '')
            .then(() => toast.success('Payment link copied'))
            .catch(() => toast.error('Copy failed'))
        }
      />
    </>
  )
}
