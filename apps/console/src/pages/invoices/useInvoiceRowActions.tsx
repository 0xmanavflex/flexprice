import { useState, type ReactElement } from 'react'
import { InvoiceStatus, type Invoice, compareMoney } from '@fp/domain'
import {
  useFinalizeInvoice,
  useInvoicePdfLink,
  useRecalculateInvoice,
  useSendInvoice,
  useVoidInvoice,
} from '@fp/query'
import {
  CheckCircle2Icon,
  CreditCardIcon,
  DownloadIcon,
  FileTextIcon,
  PencilIcon,
  ExternalLinkIcon,
  FileMinusIcon,
  RefreshCwIcon,
  SendIcon,
  UserIcon,
  XCircleIcon,
} from '@fp/ui/icons'
import { toast } from '@fp/ui/pages'
import { ConfirmDialog } from '@fp/ui/compositions'
import { useHostedInvoiceLink } from '@/app/hostedInvoice/useHostedInvoiceLink'

export interface InvoiceRowActionOptions {
  /** Record a payment against this invoice. */
  onRecordPayment?: ((invoiceId: string) => void) | undefined
  /** Credit part of this invoice. */
  onIssueCreditNote?: ((invoiceId: string) => void) | undefined
  /** Open the invoice's customer; left out where the customer is already on screen. */
  onOpenCustomer?: ((customerId: string) => void) | undefined
  /** Open the edit page: drafts and unpaid invoices, as V1 allows. */
  onEditInvoice?: ((invoiceId: string) => void) | undefined
  /** Open the contract that raised the invoice. */
  onOpenContract?: ((subscriptionId: string) => void) | undefined
}

/**
 * V1's invoice row menu, offered only where the invoice's status allows it —
 * shared by the invoice list and a customer's Invoices tab. Past draft, it
 * also opens the invoice's hosted link (the invoice page copies it).
 *
 * Each one-click action reports in a toast, so the page must render a
 * `Toaster`; voiding is confirmed first, in the dialog returned as `dialogs`.
 */
export function useInvoiceRowActions({
  onRecordPayment,
  onIssueCreditNote,
  onOpenCustomer,
  onEditInvoice,
  onOpenContract,
}: InvoiceRowActionOptions) {
  const pdfLink = useInvoicePdfLink()
  const finalize = useFinalizeInvoice()
  const recalculate = useRecalculateInvoice()
  const send = useSendInvoice()
  const voidInvoice = useVoidInvoice()
  const hostedLink = useHostedInvoiceLink()
  const [voiding, setVoiding] = useState<Invoice | null>(null)

  /** One request from the row menu, reported in a toast. */
  const run = (
    action: {
      mutate: (id: string, options: { onSuccess: () => void; onError: () => void }) => void
    },
    invoice: Invoice,
    done: string,
    verb: string,
  ) =>
    action.mutate(invoice.id, {
      onSuccess: () => toast(done),
      onError: () => toast.error(`Could not ${verb}. Try again.`),
    })

  const actionsFor = (invoice: Invoice) => {
    const items: {
      label: string
      onSelect: () => void
      /** Every item leads with one, so the menu's labels line up. */
      icon: ReactElement
      destructive?: boolean
      /** Reading, not writing: offered to every role that can see the invoice. */
      readOnly?: boolean
    }[] = []
    const open = invoice.status === InvoiceStatus.Open || invoice.status === InvoiceStatus.Overdue
    if (invoice.status === InvoiceStatus.Draft) {
      items.push(
        {
          label: 'Finalize',
          icon: <CheckCircle2Icon aria-hidden className="size-4" />,
          onSelect: () => run(finalize, invoice, 'Invoice finalized', 'finalize the invoice'),
        },
        {
          label: 'Recalculate',
          icon: <RefreshCwIcon aria-hidden className="size-4" />,
          onSelect: () =>
            run(recalculate, invoice, 'Invoice recalculated', 'recalculate the invoice'),
        },
      )
    }
    if (open && onRecordPayment) {
      items.push({
        label: 'Record payment',
        icon: <CreditCardIcon aria-hidden className="size-4" />,
        onSelect: () => onRecordPayment(invoice.id),
      })
    }
    if (invoice.status !== InvoiceStatus.Draft && invoice.status !== InvoiceStatus.Void) {
      items.push({
        label: 'Send to customer',
        icon: <SendIcon aria-hidden className="size-4" />,
        onSelect: () => run(send, invoice, 'Invoice sent to the customer', 'send the invoice'),
      })
      if (onIssueCreditNote) {
        items.push({
          label: 'Issue credit memo',
          icon: <FileMinusIcon aria-hidden className="size-4" />,
          onSelect: () => onIssueCreditNote(invoice.id),
        })
      }
    }
    if (onEditInvoice && (invoice.status === InvoiceStatus.Draft || open)) {
      items.push({
        label: 'Edit invoice',
        icon: <PencilIcon aria-hidden className="size-4" />,
        onSelect: () => onEditInvoice(invoice.id),
      })
    }
    if (invoice.status !== InvoiceStatus.Draft) {
      items.push({
        label: 'Download invoice',
        icon: <DownloadIcon aria-hidden className="size-4" />,
        readOnly: true,
        onSelect: () => {
          // Opened on the click so pop-up blockers allow it, then pointed at the PDF.
          const tab = window.open('about:blank', '_blank')
          if (tab) tab.opener = null
          pdfLink(invoice.id)
            .then((url) => {
              if (!url) {
                tab?.close()
                toast.error('This invoice has no PDF yet.')
                return
              }
              if (tab) tab.location.replace(url)
              else window.open(url, '_blank', 'noopener')
            })
            .catch(() => {
              tab?.close()
              toast.error('Could not download the invoice. Try again.')
            })
        },
      })
    }
    // The link the customer receives: issued once an invoice is finalized.
    if (invoice.status !== InvoiceStatus.Draft) {
      items.push({
        label: 'Open hosted invoice',
        icon: <ExternalLinkIcon aria-hidden className="size-4" />,
        readOnly: true,
        onSelect: () => void hostedLink.open(invoice.id),
      })
    }
    if (onOpenCustomer && invoice.customerId) {
      items.push({
        label: 'View customer',
        icon: <UserIcon aria-hidden className="size-4" />,
        onSelect: () => onOpenCustomer(invoice.customerId),
      })
    }
    if (onOpenContract && invoice.subscriptionId) {
      const subscriptionId = invoice.subscriptionId
      items.push({
        label: 'View contract',
        icon: <FileTextIcon aria-hidden className="size-4" />,
        onSelect: () => onOpenContract(subscriptionId),
      })
    }
    // The API voids only unpaid invoices: one with money against it is not
    // offered, as on the invoice's own page.
    // Against what is payable, not the gross: a discount is not a payment.
    const partlyPaid = compareMoney(invoice.amountRemaining, invoice.amountDue) < 0
    if (open && !partlyPaid) {
      items.push({
        label: 'Void invoice',
        icon: <XCircleIcon aria-hidden className="size-4" />,
        destructive: true,
        onSelect: () => setVoiding(invoice),
      })
    }
    return items
  }

  const dialogs = (
    <ConfirmDialog
      open={voiding !== null}
      onOpenChange={(next) => {
        if (!next) {
          setVoiding(null)
          voidInvoice.reset()
        }
      }}
      title={`Void ${voiding?.number || 'this invoice'}?`}
      description="A voided invoice is no longer owed. This cannot be undone."
      confirmLabel="Void invoice"
      destructive
      isPending={voidInvoice.isPending}
      error={voidInvoice.isError ? 'Could not void the invoice. Try again.' : null}
      onConfirm={() => {
        if (voiding) voidInvoice.mutate(voiding.id, { onSuccess: () => setVoiding(null) })
      }}
    />
  )

  return { actionsFor, dialogs }
}
