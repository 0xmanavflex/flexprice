import { useState, type ReactElement } from 'react'
import { InvoiceStatus, type Invoice } from '@fp/domain'
import {
  useFinalizeInvoice,
  useRecalculateInvoice,
  useSendInvoice,
  useVoidInvoice,
} from '@fp/query'
import {
  CheckCircle2Icon,
  CreditCardIcon,
  ExternalLinkIcon,
  FileMinusIcon,
  LinkIcon,
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
}

/**
 * V1's invoice row menu, offered only where the invoice's status allows it —
 * shared by the invoice list and a customer's Invoices tab. Past draft, it
 * also opens or copies the invoice's hosted link.
 *
 * Each one-click action reports in a toast, so the page must render a
 * `Toaster`; voiding is confirmed first, in the dialog returned as `dialogs`.
 */
export function useInvoiceRowActions({
  onRecordPayment,
  onIssueCreditNote,
  onOpenCustomer,
}: InvoiceRowActionOptions) {
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
    // The link the customer receives: issued once an invoice is finalized.
    if (invoice.status !== InvoiceStatus.Draft) {
      items.push(
        {
          label: 'Open hosted invoice',
          icon: <ExternalLinkIcon aria-hidden className="size-4" />,
          readOnly: true,
          onSelect: () => void hostedLink.open(invoice.id),
        },
        {
          label: 'Copy hosted invoice link',
          icon: <LinkIcon aria-hidden className="size-4" />,
          readOnly: true,
          onSelect: () => void hostedLink.copy(invoice.id),
        },
      )
    }
    if (onOpenCustomer && invoice.customerId) {
      items.push({
        label: 'View customer',
        icon: <UserIcon aria-hidden className="size-4" />,
        onSelect: () => onOpenCustomer(invoice.customerId),
      })
    }
    if (open) {
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
