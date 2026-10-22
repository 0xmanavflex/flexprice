import { type ReactNode, useRef } from 'react'
import type { HostedInvoice } from '@fp/domain'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@ui/components/primitives/sheet'
import { type SimpleColumn, SimpleTable } from '@ui/compositions/detail/DetailKit'
import { Section } from '@ui/compositions/layout/Section'
import { DetailList, type DetailItem } from '@ui/compositions/tables/DetailList'
import { provenance } from '@ui/provenance'
import { Pill } from '../../shared/cells'
import { Money } from '../../shared/Money'
import { HostedInvoiceStatePill, TenantMark, amountLabelOf } from './parts'
import { formatHostedDate } from './format'

/**
 * The full invoice behind a hosted invoice link, laid out like the customer
 * portal's invoice drawer: the amount, who it is from and to, every line, the
 * totals, and each payment attempt.
 */
export const HostedInvoiceDetailsSheetProvenance = provenance({
  source: 'composition',
  composes: [
    'primitives/sheet',
    'compositions/layout/Section',
    'compositions/detail/DetailKit',
    'compositions/tables/DetailList',
    'shared/Money',
    'shared/cells',
  ],
  note: 'Hosted invoice details drawer, after the customer portal invoice drawer.',
})

export interface HostedInvoiceDetailsSheetProps {
  /** `null` closes the drawer. */
  invoice: HostedInvoice | null
  onClose: () => void
  locale?: string
}

export function HostedInvoiceDetailsSheet({
  invoice,
  onClose,
  locale,
}: HostedInvoiceDetailsSheetProps) {
  // Keep the last invoice so the drawer keeps its title and content while it animates closed.
  const shown = useRef(invoice)
  if (invoice) shown.current = invoice

  return (
    <Sheet open={invoice !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-2xl">
        {shown.current ? <Details invoice={shown.current} locale={locale} /> : null}
      </SheetContent>
    </Sheet>
  )
}

type Line = HostedInvoice['lines'][number]
type Payment = HostedInvoice['payments'][number]

function Details({ invoice, locale }: { invoice: HostedInvoice; locale: string | undefined }) {
  const money = (value: HostedInvoice['total']) => (
    <Money value={value} {...(locale ? { locale } : {})} />
  )
  const settled = invoice.state === 'paid' || invoice.state === 'voided'

  const parties: DetailItem[] = []
  if (invoice.customerName) parties.push({ label: 'Billed to', value: invoice.customerName })
  if (invoice.tenant.name) parties.push({ label: 'From', value: invoice.tenant.name })
  if (invoice.memo) parties.push({ label: 'Memo', value: invoice.memo, full: true })

  const lineColumns: SimpleColumn<Line>[] = [
    { key: 'item', header: 'Item', cell: (line) => line.name, className: 'break-words' },
    {
      key: 'quantity',
      header: 'Quantity',
      cell: (line) => line.quantity ?? '—',
      className: 'text-muted-foreground tabular-nums',
    },
    {
      key: 'amount',
      header: 'Amount',
      cell: (line) => money(line.amount),
      className: 'text-right tabular-nums',
    },
  ]

  const paymentColumns: SimpleColumn<Payment>[] = [
    {
      key: 'amount',
      header: 'Amount',
      cell: (payment) => money(payment.amount),
      className: 'tabular-nums',
    },
    { key: 'method', header: 'Method', cell: (payment) => payment.method },
    {
      key: 'status',
      header: 'Status',
      cell: (payment) => (
        <Pill tone={paymentTone(payment.status)}>{statusLabel(payment.status)}</Pill>
      ),
    },
    {
      key: 'date',
      header: 'Date',
      cell: (payment) => (payment.at ? formatHostedDate(payment.at, locale) : '—'),
      className: 'text-muted-foreground text-right whitespace-nowrap',
    },
  ]

  return (
    <>
      <SheetHeader className="flex-row items-center gap-3 border-b px-6 py-5 pr-12 sm:px-8">
        {invoice.tenant.name ? <TenantMark name={invoice.tenant.name} className="size-9" /> : null}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <SheetTitle className="text-base font-medium break-all">{invoice.number}</SheetTitle>
            <HostedInvoiceStatePill state={invoice.state} />
          </div>
          <SheetDescription>{subtitleOf(invoice, locale)}</SheetDescription>
        </div>
      </SheetHeader>

      <div className="flex-1 space-y-8 overflow-y-auto px-6 py-7 sm:px-8">
        <div className="space-y-1">
          <p className="text-muted-foreground text-xs">{amountLabelOf(invoice.state)}</p>
          <p className="text-3xl font-medium tracking-tight tabular-nums">
            {money(settled ? invoice.total : invoice.amountRemaining)}
          </p>
        </div>

        {parties.length > 0 ? <DetailList items={parties} className="border-y py-5" /> : null}

        <Section title="Items" as="h3" table>
          <SimpleTable
            columns={lineColumns}
            rows={invoice.lines}
            getRowId={(line) => line.id || line.name}
            empty="No line items on this invoice."
          />
        </Section>

        <dl className="ml-auto w-full max-w-xs space-y-2 text-[13px]">
          <Total label="Subtotal">{money(invoice.subtotal)}</Total>
          {invoice.discount ? <Total label="Discount">− {money(invoice.discount)}</Total> : null}
          {invoice.tax ? <Total label="Tax">{money(invoice.tax)}</Total> : null}
          <Total label="Total">{money(invoice.total)}</Total>
          <Total label="Amount paid">− {money(invoice.amountPaid)}</Total>
          <div className="flex justify-between gap-4 border-t pt-3 text-sm font-medium">
            <dt>Amount remaining</dt>
            <dd className="tabular-nums">{money(invoice.amountRemaining)}</dd>
          </div>
        </dl>

        {invoice.payments.length > 0 ? (
          <Section title="Payment history" as="h3" table>
            <SimpleTable columns={paymentColumns} rows={invoice.payments} />
          </Section>
        ) : null}
      </div>

      {invoice.tenant.contactEmail ? (
        <div className="text-muted-foreground border-t px-6 py-4 text-xs sm:px-8">
          Questions about this invoice? Contact{' '}
          <a
            className="text-foreground underline underline-offset-4"
            href={`mailto:${invoice.tenant.contactEmail}`}
          >
            {invoice.tenant.name || invoice.tenant.contactEmail}
          </a>
        </div>
      ) : null}
    </>
  )
}

function subtitleOf(invoice: HostedInvoice, locale: string | undefined): string {
  switch (invoice.state) {
    case 'paid':
      return invoice.paidAt ? `Paid on ${formatHostedDate(invoice.paidAt, locale)}` : 'Invoice paid'
    case 'voided':
      return 'Invoice voided'
    case 'processing':
      return 'Payment processing'
    case 'open':
      return invoice.dueAt ? `Due ${formatHostedDate(invoice.dueAt, locale, 'UTC')}` : 'Amount due'
  }
}

function paymentTone(status: string) {
  if (status === 'SUCCEEDED') return 'success' as const
  if (status === 'FAILED') return 'danger' as const
  return 'neutral' as const
}

function statusLabel(status: string): string {
  const spaced = status.replace(/_/g, ' ').toLowerCase()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

function Total({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular-nums">{children}</dd>
    </div>
  )
}
