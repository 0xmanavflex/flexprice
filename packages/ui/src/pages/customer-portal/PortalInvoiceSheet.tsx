import { type ReactNode, useRef } from 'react'
import { type PortalCustomer, type PortalInvoice, isPayable } from '@fp/domain'
import { DownloadIcon, XIcon } from '@ui/icons'
import { Button } from '@ui/components/primitives/button'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@ui/components/primitives/sheet'
import { Skeleton } from '@ui/components/primitives/skeleton'
import { SimpleTable } from '@ui/compositions/detail/DetailKit'
import { Badge } from '@ui/components/reui/badge'
import { ErrorState } from '@ui/compositions/feedback/States'
import { provenance } from '@ui/provenance'
import { Money } from '../shared/Money'
import { formatDate, formatNumber, formatRange } from './format'
import { InvoiceStatusPill } from './parts'
import type { Load } from './types'

/** One invoice, in a drawer: who it is to and from, every line, the totals, Download and Pay. */
export const PortalInvoiceSheetProvenance = provenance({
  source: 'composition',
  composes: [
    'primitives/sheet',
    'compositions/detail/DetailKit',
    'primitives/separator',
    'reui/badge',
    'shared/Money',
  ],
  note: 'Customer portal invoice drawer, after the reference portal and the hosted invoice details sheet.',
})

export interface PortalInvoiceSheetProps {
  /** null closes the drawer. */
  invoice: Load<PortalInvoice> | null
  brandName: string | null
  customer: PortalCustomer | null
  locale: string | undefined
  onClose: () => void
  onPay: (invoice: PortalInvoice) => void
  onDownload: (invoice: PortalInvoice) => void
}

export function PortalInvoiceSheet(props: PortalInvoiceSheetProps) {
  // Keep the last content so the drawer does not empty itself while it animates closed.
  const shown = useRef(props.invoice)
  if (props.invoice) shown.current = props.invoice
  const load = shown.current
  return (
    <Sheet open={props.invoice !== null} onOpenChange={(open) => !open && props.onClose()}>
      <SheetContent showCloseButton={false} className="w-full gap-0 sm:max-w-xl">
        {load === null || load.status === 'loading' ? (
          <div className="flex flex-col gap-4 p-6" role="status" aria-label="Loading invoice">
            <SheetTitle className="sr-only">Invoice</SheetTitle>
            <SheetDescription className="sr-only">Loading</SheetDescription>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : load.status === 'error' ? (
          <div className="p-6">
            <SheetTitle className="sr-only">Invoice</SheetTitle>
            <SheetDescription className="sr-only">Failed to load</SheetDescription>
            <ErrorState title="We couldn’t load this invoice" onRetry={load.retry} />
          </div>
        ) : (
          <Details {...props} invoice={load.data} />
        )}
      </SheetContent>
    </Sheet>
  )
}

function Details({
  invoice,
  brandName,
  customer,
  locale,
  onClose,
  onPay,
  onDownload,
}: Omit<PortalInvoiceSheetProps, 'invoice'> & { invoice: PortalInvoice }) {
  const money = (value: PortalInvoice['total']) => (
    <Money value={value} {...(locale ? { locale } : {})} />
  )
  const issued = invoice.issuedAt ? `Issued ${formatDate(invoice.issuedAt, locale)}` : null
  const due = invoice.dueAt ? `due ${formatDate(invoice.dueAt, locale)}` : null
  return (
    <>
      <div className="flex items-start justify-between gap-4 border-b p-6">
        <div className="flex min-w-0 flex-col gap-1">
          <SheetTitle className="flex items-center gap-2 text-base font-medium">
            {invoice.number}
            <InvoiceStatusPill status={invoice.status} />
          </SheetTitle>
          <SheetDescription>{[issued, due].filter(Boolean).join(' · ')}</SheetDescription>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close">
          <XIcon aria-hidden="true" />
        </Button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-6">
        <div className="grid grid-cols-2 gap-4">
          <Fact
            label={isPayable(invoice) ? 'Amount due' : 'Total'}
            value={
              <span className="text-xl font-medium">
                {money(isPayable(invoice) ? invoice.amountDue : invoice.total)}
              </span>
            }
          />
          <Fact
            label="Billing period"
            value={formatRange(invoice.periodStart, invoice.periodEnd, locale)}
          />
          <Fact
            label="Billed to"
            value={
              customer ? (
                <>
                  {customer.name}
                  {customer.email ? (
                    <span className="text-muted-foreground block text-xs">{customer.email}</span>
                  ) : null}
                </>
              ) : (
                '—'
              )
            }
          />
          {brandName ? <Fact label="From" value={brandName} /> : null}
        </div>
        {invoice.status === 'failed' ? (
          <p className="text-destructive-foreground dark:text-destructive text-sm">
            The last attempt to pay this invoice was declined.
          </p>
        ) : null}
        <div className="-mx-6 border-y">
          <SimpleTable
            rows={invoice.lines}
            columns={[
              {
                key: 'item',
                header: 'Item',
                className: 'whitespace-normal',
                cell: (line) => (
                  <span className="flex items-center gap-2">
                    {line.name}
                    {line.kind ? <Badge variant="outline">{line.kind}</Badge> : null}
                  </span>
                ),
              },
              {
                key: 'quantity',
                header: 'Quantity',
                className: 'text-right tabular-nums',
                cell: (line) => formatNumber(line.quantity, locale),
              },
              {
                key: 'amount',
                header: 'Amount',
                className: 'text-right',
                cell: (line) => money(line.amount),
              },
            ]}
            empty="No line items."
          />
        </div>
        <dl className="flex flex-col gap-2 text-sm">
          <Total label="Subtotal" value={money(invoice.subtotal)} />
          {invoice.discount ? (
            <Total label="Discount" value={<>−{money(invoice.discount)}</>} />
          ) : null}
          {invoice.tax ? <Total label="Tax" value={money(invoice.tax)} /> : null}
          <Total label="Total" divided value={money(invoice.total)} strong />
          <Total label="Paid" value={money(invoice.amountPaid)} />
          <Total label="Amount due" value={money(invoice.amountDue)} strong />
        </dl>
        <p className="text-muted-foreground text-xs">
          Questions about this invoice? Contact {brandName ?? 'the business that sent it'}.
        </p>
      </div>
      <div className="flex justify-end gap-2 border-t p-4">
        <Button variant="outline" onClick={() => onDownload(invoice)}>
          <DownloadIcon aria-hidden="true" />
          Download
        </Button>
        {isPayable(invoice) ? (
          <Button onClick={() => onPay(invoice)}>Pay {money(invoice.amountDue)}</Button>
        ) : null}
      </div>
    </>
  )
}

function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{label}</p>
      <div className="text-sm">{value}</div>
    </div>
  )
}

function Total({
  label,
  value,
  strong = false,
  divided = false,
}: {
  label: string
  value: ReactNode
  strong?: boolean
  /** A rule above: the line where the arithmetic ends. */
  divided?: boolean
}) {
  return (
    <div
      className={
        divided ? 'flex justify-between gap-4 border-t pt-2' : 'flex justify-between gap-4'
      }
    >
      <dt className={strong ? 'font-medium' : 'text-muted-foreground'}>{label}</dt>
      <dd className={strong ? 'font-medium tabular-nums' : 'tabular-nums'}>{value}</dd>
    </div>
  )
}
