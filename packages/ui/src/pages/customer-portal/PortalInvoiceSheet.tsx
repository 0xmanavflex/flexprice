import { useRef } from 'react'
import {
  type PortalCustomer,
  type PortalInvoice,
  type PortalPaymentMethod,
  isPayable,
} from '@fp/domain'
import { DownloadIcon } from '@ui/icons'
import { Button } from '@ui/components/primitives/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@ui/components/primitives/sheet'
import { Skeleton } from '@ui/components/primitives/skeleton'
import { ErrorState } from '@ui/compositions/feedback/States'
import { TotalRow, TotalsList } from '@ui/compositions/detail/DetailKit'
import { provenance } from '@ui/provenance'
import { Money } from '../shared/Money'
import { toneColor } from '../shared/charts'
import { formatDate, formatNumber } from './format'
import { InvoiceStatusPill } from './parts'
import type { Load } from './types'

/**
 * One invoice in a right-hand drawer, laid out like the invoice document
 * (ReUI receipt-1, after the portal prototype's InvoiceDrawer): the amount
 * and period, who it is to and from and how it was paid, every line, the
 * totals, and Download and Pay.
 */
export const PortalInvoiceSheetProvenance = provenance({
  source: 'composition',
  composes: [
    'primitives/sheet',
    'primitives/button',
    'compositions/feedback/States',
    'compositions/detail-kit',
    'shared/Money',
  ],
  note: 'Customer portal invoice drawer, after the portal prototype (receipt-1 layout, 672px).',
})

export interface PortalInvoiceSheetProps {
  /** null closes the drawer. */
  invoice: Load<PortalInvoice> | null
  brandName: string | null
  customer: PortalCustomer | null
  /** The default card, for the Payment block. */
  card: PortalPaymentMethod | null
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
      <SheetContent className="flex w-full flex-col gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-2xl">
        {load === null || load.status === 'loading' ? (
          <div className="flex flex-col gap-4 p-8" role="status" aria-label="Loading invoice">
            <SheetTitle className="sr-only">Invoice</SheetTitle>
            <SheetDescription className="sr-only">Loading</SheetDescription>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : load.status === 'error' ? (
          <div className="p-8">
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
  invoice: i,
  brandName,
  customer,
  card,
  locale,
  onPay,
  onDownload,
}: Omit<PortalInvoiceSheetProps, 'invoice'> & { invoice: PortalInvoice }) {
  const money = (value: PortalInvoice['total']) => (
    <Money value={value} {...(locale ? { locale } : {})} />
  )
  const owed = isPayable(i)
  const paidSoFar = Number(i.amountPaid.amount) !== 0
  // The figure the drawer is about: what is left to pay, what was paid, or (void) what it was for.
  const hero = owed ? 'Amount due' : i.status === 'paid' ? 'Total paid' : 'Total'
  const payment =
    i.status === 'paid'
      ? 'Paid'
      : i.status === 'failed'
        ? 'Last attempt declined'
        : i.status === 'void'
          ? 'Voided'
          : 'Not paid yet'
  return (
    <>
      <SheetHeader className="flex-row items-center gap-3 border-b px-8 py-5">
        {brandName ? (
          <span
            aria-hidden="true"
            className="bg-primary text-primary-foreground flex size-9 shrink-0 items-center justify-center rounded-lg text-sm font-medium"
          >
            {brandName.charAt(0).toUpperCase()}
          </span>
        ) : null}
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <SheetTitle className="text-base font-medium">{i.number}</SheetTitle>
            <InvoiceStatusPill status={i.status} />
          </div>
          <SheetDescription>
            {[
              i.issuedAt ? `Issued ${formatDate(i.issuedAt, locale)}` : null,
              i.dueAt ? `due ${formatDate(i.dueAt, locale)}` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </SheetDescription>
        </div>
      </SheetHeader>

      <div className="flex-1 space-y-8 overflow-y-auto px-8 py-7">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-1">
            <p className="text-muted-foreground text-xs">{hero}</p>
            <p className="text-3xl font-medium tracking-tight tabular-nums">
              {money(owed ? i.amountDue : i.total)}
            </p>
          </div>
          {i.periodStart && i.periodEnd ? (
            <div className="text-right text-[13px]">
              <p className="text-muted-foreground text-xs">Billing period</p>
              <p>
                {formatDate(i.periodStart, locale)} – {formatDate(i.periodEnd, locale)}
              </p>
            </div>
          ) : null}
        </div>

        <dl className="grid gap-5 border-y py-5 text-[13px] sm:grid-cols-3">
          <div className="space-y-1">
            <dt className="text-muted-foreground text-[11px] tracking-wider uppercase">
              Billed to
            </dt>
            <dd>{customer?.name ?? '—'}</dd>
            {customer?.email ? <dd className="text-muted-foreground">{customer.email}</dd> : null}
          </div>
          <div className="space-y-1">
            <dt className="text-muted-foreground text-[11px] tracking-wider uppercase">From</dt>
            <dd>{brandName ?? 'Your account team'}</dd>
          </div>
          <div className="space-y-1">
            <dt className="text-muted-foreground text-[11px] tracking-wider uppercase">Payment</dt>
            <dd>{payment}</dd>
            <dd className="text-muted-foreground">
              {card ? `${card.brand} •••• ${card.last4}` : 'No card on file'}
            </dd>
          </div>
        </dl>

        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted-foreground border-b text-left text-[11px] tracking-wider uppercase">
              <th scope="col" className="pb-2 font-normal">
                Item
              </th>
              <th scope="col" className="pb-2 font-normal">
                Quantity
              </th>
              <th scope="col" className="pb-2 text-right font-normal">
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {i.lines.map((line) => (
              <tr key={line.id} className="border-border/60 border-b last:border-b-0">
                <td className="py-3">
                  <span className="flex items-center gap-2">
                    <span
                      className="size-1.5 rounded-full"
                      style={{
                        background: toneColor(line.kind === 'Usage' ? 'series-3' : 'series-1'),
                      }}
                      aria-hidden="true"
                    />
                    {line.name}
                  </span>
                  {line.kind ? (
                    <span className="text-muted-foreground pl-3.5 text-xs">{line.kind}</span>
                  ) : null}
                </td>
                <td className="text-muted-foreground py-3 tabular-nums">
                  {formatNumber(line.quantity, locale)}
                </td>
                <td className="py-3 text-right tabular-nums">{money(line.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* The kit's totals: the sum closes on a rule at Total, and only what applies is listed
            (no "Paid − 0" on an unpaid invoice), so the amount due stands out. */}
        <div className="flex justify-end">
          <TotalsList className="text-[13px]">
            <TotalRow label="Subtotal" value={money(i.subtotal)} />
            {i.discount ? <TotalRow label="Discount" value={<>− {money(i.discount)}</>} /> : null}
            <TotalRow
              label="Tax"
              value={i.tax ? money(i.tax) : money({ amount: '0', currency: i.currency })}
            />
            <TotalRow label="Total" value={money(i.total)} emphasis="total" rule />
            {paidSoFar ? <TotalRow label="Paid" value={<>− {money(i.amountPaid)}</>} /> : null}
            {owed || paidSoFar ? (
              <TotalRow label="Amount due" value={money(i.amountDue)} emphasis="due" />
            ) : null}
          </TotalsList>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 border-t px-8 py-4">
        <p className="text-muted-foreground text-xs">
          Questions about this invoice? Contact {brandName ?? 'your account team'}.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" className="h-8 px-3" onClick={() => onDownload(i)}>
            <DownloadIcon aria-hidden="true" />
            Download
          </Button>
          {owed ? (
            <Button className="h-8 px-3" onClick={() => onPay(i)}>
              Pay {money(i.amountDue)}
            </Button>
          ) : null}
        </div>
      </div>
    </>
  )
}
